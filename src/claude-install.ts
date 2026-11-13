// story: e07s03
// The settings edit that registers the Stop hook in Claude Code's
// .claude/settings.json. installStopHook is pure: the file's text in, the new
// text out. installInProject does the reading and the atomic write; the install
// command (claude-install-cli.ts) only parses arguments and prints.
//
// The settings file is untrusted input: it may be anything, and the agent can
// edit it. Text of the wrong shape is refused, never repaired or overwritten.
import {
  chmodSync,
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { hookTimeoutSeconds } from './claude-hook.ts';
import { isMissing, messageOf } from './errors.ts';
import { isRecord } from './json.ts';

/** What the install did. `reformatted`: the entry was right, only the spacing changed. */
export type Action = 'added' | 'replaced' | 'reformatted' | 'unchanged';

type Failure = { ok: false; error: string };
export type InstallResult = { ok: true; text: string; changed: boolean; action: Action } | Failure;
export type InstallInProject = { ok: true; action: Action; path: string } | Failure;

/** One group of a Stop list: an object with a `hooks` list. */
type Group = Record<string, unknown> & { hooks: unknown[] };
type Settings = { settings: Record<string, unknown>; hooks: Record<string, unknown> };
type Parsed = ({ ok: true } & Settings) | Failure;
type StopList = { ok: true; groups: Group[] } | Failure;
type HookEdit = { hooks: unknown[]; placed: boolean; touched: boolean };
type Opened = { ok: true; fd: number | null } | Failure;
type Read = { ok: true; file: { text: string; mode: number } | null } | Failure;

/** What the edit writes: the adapter path that marks weftwork's own entries,
 * and the entry that replaces them. */
type Install = { cliPath: string; entry: object };

/** Wrap `text` in single quotes for a POSIX shell: each `'` becomes `'\''`. */
export function shellQuote(text: string): string {
  return `'${text.replaceAll("'", `'\\''`)}'`;
}

/** The start of every command this install writes: node runs the adapter, and
 * what follows `--` is the one argument claude-hook-cli.ts reads. */
function stopHookPrefix(cliPath: string): string {
  return `node ${shellQuote(cliPath)} -- `;
}

/** The command of the hook entry: the prefix, then the declared command. */
export function stopHookCommand(cliPath: string, command: string): string {
  return stopHookPrefix(cliPath) + shellQuote(command);
}

/** True when `hook` is a weftwork entry: a command hook that starts with the
 * text this install writes. An owner hook that only mentions the adapter's
 * path, an entry from another checkout, or a hand-written entry in another
 * form is not ours. */
function isOurs(hook: unknown, cliPath: string): boolean {
  return isRecord(hook) && hook.type === 'command' && typeof hook.command === 'string'
    && hook.command.startsWith(stopHookPrefix(cliPath));
}

function isGroup(value: unknown): value is Group {
  return isRecord(value) && Array.isArray(value.hooks);
}

/** The groups of a Stop list, or null when one of them has the wrong shape. */
function groupsOf(stop: unknown[]): Group[] | null {
  const groups: Group[] = [];
  for (const item of stop) {
    if (!isGroup(item)) {
      return null;
    }
    groups.push(item);
  }
  return groups;
}

/** The Stop groups of `hooks`, or an error when the list or a group has the
 * wrong shape. A missing `Stop` reads as an empty list; `null` is refused. */
function stopListOf(hooks: Record<string, unknown>): StopList {
  const stop = hooks.Stop === undefined ? [] : hooks.Stop;
  if (!Array.isArray(stop)) {
    return { ok: false, error: '"hooks.Stop" in the settings is not a list' };
  }
  const groups = groupsOf(stop);
  if (groups === null) {
    return { ok: false, error: 'a group in "hooks.Stop" is not an object with a "hooks" list' };
  }
  return { ok: true, groups };
}

/** Read the settings text as an object. `text` is null when there is no file,
 * and an empty or blank file reads the same: no settings yet. Refuses text that
 * is not a JSON object, and a `hooks` key that is not an object (`null` too). */
function parseSettings(text: string | null): Parsed {
  let value: unknown = {};
  try {
    value = text === null || text.trim() === '' ? {} : JSON.parse(text);
  } catch (error) {
    return { ok: false, error: `the settings are not valid JSON: ${messageOf(error)}` };
  }
  if (!isRecord(value)) {
    return { ok: false, error: 'the settings are not a JSON object' };
  }
  const hooks = value.hooks === undefined ? {} : value.hooks;
  if (!isRecord(hooks)) {
    return { ok: false, error: '"hooks" in the settings is not an object' };
  }
  return { ok: true, settings: value, hooks };
}

/** The hooks of one group with every weftwork entry removed, and `entry` put
 * where the first one was, unless `placed` says it is already placed. */
function editHooks(hooks: unknown[], install: Install, placed: boolean): HookEdit {
  const kept: unknown[] = [];
  let touched = false;
  let inserted = placed;
  for (const hook of hooks) {
    if (!isOurs(hook, install.cliPath)) { kept.push(hook); continue; }
    touched = true;
    if (!inserted) { inserted = true; kept.push(install.entry); }
  }
  return { hooks: kept, placed: inserted, touched };
}

/** The groups after the edit. A group that loses its last hook is dropped; a
 * group that was never touched stays as it was. The entry goes in a new group
 * when no group held a weftwork entry. */
function editStopGroups(groups: Group[], install: Install): unknown[] {
  let placed = false;
  const edited: unknown[] = [];
  for (const group of groups) {
    const edit = editHooks(group.hooks, install, placed);
    placed = edit.placed;
    if (edit.hooks.length > 0 || !edit.touched) {
      edited.push({ ...group, hooks: edit.hooks });
    }
  }
  if (!placed) {
    edited.push({ hooks: [install.entry] });
  }
  return edited;
}

/** What the install did, from the groups as they were. `reformatted` is the
 * one weftwork entry already equal to the new one, with the text changed. */
function actionOf(changed: boolean, groups: Group[], install: Install): Action {
  if (!changed) return 'unchanged';
  const ours = groups.flatMap((group) => group.hooks.filter((hook) => isOurs(hook, install.cliPath)));
  if (ours.length === 0) return 'added';
  return ours.length === 1 && isDeepStrictEqual(ours[0], install.entry) ? 'reformatted' : 'replaced';
}

/** The settings as text, with `stop` as the Stop list. Two-space JSON and a
 * final newline, the same form on every run. */
function renderSettings(parsed: Settings, stop: unknown[]): string {
  return `${JSON.stringify({ ...parsed.settings, hooks: { ...parsed.hooks, Stop: stop } }, null, 2)}\n`;
}

/** The settings text with one weftwork Stop entry for `command`. `text` is the
 * file's text, or null when there is no file. A weftwork entry that exists is
 * replaced in place, and any more of them are removed, so there is at most
 * one. Every other key and hook stays, in order. */
export function installStopHook(text: string | null, cliPath: string, command: string): InstallResult {
  if (command.trim() === '') {
    return { ok: false, error: 'the declared command is blank' };
  }
  const parsed = parseSettings(text);
  if (!parsed.ok) {
    return parsed;
  }
  const stop = stopListOf(parsed.hooks);
  if (!stop.ok) {
    return stop;
  }
  const entry = { type: 'command', command: stopHookCommand(cliPath, command), timeout: hookTimeoutSeconds };
  const install = { cliPath, entry };
  const out = renderSettings(parsed, editStopGroups(stop.groups, install));
  const changed = out !== text;
  return { ok: true, text: out, changed, action: actionOf(changed, stop.groups, install) };
}

/** Open the settings file without blocking and without following a symlink.
 * `fd` is null when there is no file. The agent can replace the file, and
 * opening a FIFO blocks (BUG-007). */
function openIfExists(path: string): Opened {
  try {
    return { ok: true, fd: openSync(path, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW) };
  } catch (error) {
    if (isMissing(error)) return { ok: true, fd: null };
    return { ok: false, error: `${path} cannot be opened as a regular file: ${messageOf(error)}` };
  }
}

/** Read the settings file. `file` is null when there is none. Only a regular
 * file is read. The file's mode comes back too, so a rewrite keeps it. */
function readSettings(path: string): Read {
  const opened = openIfExists(path);
  if (!opened.ok) return opened;
  const fd = opened.fd;
  if (fd === null) return { ok: true, file: null };
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) return { ok: false, error: `${path} is not a regular file` };
    return { ok: true, file: { text: readFileSync(fd, 'utf8'), mode: stat.mode & 0o777 } };
  } catch (error) {
    return { ok: false, error: `${path} could not be read: ${messageOf(error)}` };
  } finally {
    closeSync(fd);
  }
}

/** True when `dir` holds a `.git` entry, a directory or a worktree file. */
function isGitRoot(dir: string): boolean {
  try {
    lstatSync(join(dir, '.git'));
    return true;
  } catch {
    return false;
  }
}

/** True when `claudeDir` is missing or a plain directory. A symlink is refused,
 * so the write cannot be sent to another place. */
function isPlainDirOrMissing(claudeDir: string): boolean {
  try {
    return lstatSync(claudeDir).isDirectory();
  } catch (error) {
    return isMissing(error);
  }
}

/** Why `dir` cannot take the hook, or null when it can. */
function refusalFor(dir: string, claudeDir: string): string | null {
  if (!isGitRoot(dir)) {
    return `${dir} is not the root of a git repository`;
  }
  if (!isPlainDirOrMissing(claudeDir)) {
    return `${claudeDir} is not a directory (a symlink is refused)`;
  }
  return null;
}

/** Remove a leftover temp file. Failing to remove it is not a fault of the install. */
function removeQuietly(path: string): void {
  try {
    rmSync(path, { force: true });
  } catch {
    // The file is ours and harmless; the write's own result is what matters.
  }
}

/** Write `text` to `path` through a random-named temp file and a rename, so a
 * crashed process never leaves half a file (no fsync: a power loss can), and a
 * leftover file is never this run's to delete. `mode` is set with chmod, as the
 * umask would strip it at creation; with no `mode` (a new file) it decides. */
function writeAtomic(path: string, text: string, mode: number | undefined): Failure | null {
  const temp = join(dirname(path), `settings.json.${randomBytes(6).toString('hex')}.tmp`);
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(temp, text, { flag: 'wx' });
    if (mode !== undefined) chmodSync(temp, mode);
    renameSync(temp, path);
    return null;
  } catch (error) {
    return { ok: false, error: `${path} could not be written: ${messageOf(error)}` };
  } finally {
    removeQuietly(temp);
  }
}

/** Register the Stop hook in `dir`'s .claude/settings.json. `dir` must be the
 * root of a git repository. Writes only when the text changes. Returns an
 * error value, and writes nothing, for anything it will not edit. */
export function installInProject(dir: string, cliPath: string, command: string): InstallInProject {
  const claudeDir = join(dir, '.claude');
  const path = join(claudeDir, 'settings.json');
  const refusal = refusalFor(dir, claudeDir);
  if (refusal !== null) return { ok: false, error: refusal };
  const read = readSettings(path);
  if (!read.ok) return read;
  const result = installStopHook(read.file?.text ?? null, cliPath, command);
  if (!result.ok) return { ok: false, error: `${path}: ${result.error}` };
  const failed = result.changed ? writeAtomic(path, result.text, read.file?.mode) : null;
  return failed ?? { ok: true, action: result.action, path };
}
