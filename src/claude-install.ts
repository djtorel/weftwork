// story: e07s03
// The settings edit that registers the Stop hook in Claude Code's
// .claude/settings.json. installStopHook is pure: the file's text in, the new
// text out. installInProject does the reading and the atomic write; the install
// command (claude-install-cli.ts) only parses arguments and prints.
//
// The settings file is untrusted input: it may be anything, and the agent can
// edit it. Text of the wrong shape is refused, never repaired or overwritten.
import {
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
import { join } from 'node:path';
import { hookTimeoutSeconds } from './claude-hook.ts';
import { isMissing, messageOf } from './errors.ts';
import { isRecord } from './json.ts';

export type InstallResult =
  | { ok: true; text: string; changed: boolean; action: 'added' | 'replaced' | 'unchanged' }
  | { ok: false; error: string };

export type InstallInProject =
  | { ok: true; action: 'added' | 'replaced' | 'unchanged'; path: string }
  | { ok: false; error: string };

/** One group of a Stop list: an object with a `hooks` list. */
type Group = Record<string, unknown> & { hooks: unknown[] };

type Parsed =
  | { ok: true; settings: Record<string, unknown>; hooks: Record<string, unknown> }
  | { ok: false; error: string };

type StopList = { ok: true; groups: Group[] } | { ok: false; error: string };

type HookEdit = { hooks: unknown[]; placed: boolean; touched: boolean };

/** What the edit writes: the adapter path that marks weftwork's own entries,
 * and the entry that replaces them. */
type Install = { cliPath: string; entry: object };

/** Wrap `text` in single quotes for a POSIX shell: each `'` becomes `'\''`. */
export function shellQuote(text: string): string {
  return `'${text.replaceAll("'", `'\\''`)}'`;
}

/** The command of the hook entry: node runs the adapter, and `command` is the
 * one argument after `--`, as claude-hook-cli.ts reads it. */
export function stopHookCommand(cliPath: string, command: string): string {
  return `node ${shellQuote(cliPath)} -- ${shellQuote(command)}`;
}

/** True when `hook` is a weftwork entry: a command that runs this checkout's
 * adapter. The match is the whole quoted path, so an entry from another
 * checkout, or a path that only starts the same, is not ours. */
function isOurs(hook: unknown, cliPath: string): boolean {
  return isRecord(hook) && typeof hook.command === 'string'
    && hook.command.includes(shellQuote(cliPath));
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
 * wrong shape. A missing `Stop` reads as an empty list. */
function stopListOf(hooks: Record<string, unknown>): StopList {
  const stop = hooks.Stop ?? [];
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
 * which reads as an empty object. Refuses text that is not a JSON object, and
 * a `hooks` key that is not an object. */
function parseSettings(text: string | null): Parsed {
  let value: unknown = {};
  try {
    value = text === null ? {} : JSON.parse(text);
  } catch (error) {
    return { ok: false, error: `the settings are not valid JSON: ${messageOf(error)}` };
  }
  if (!isRecord(value)) {
    return { ok: false, error: 'the settings are not a JSON object' };
  }
  const hooks = value.hooks ?? {};
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

/** True when a group in the list already holds a weftwork entry. */
function hasOurs(groups: Group[], cliPath: string): boolean {
  return groups.some((group) => group.hooks.some((hook) => isOurs(hook, cliPath)));
}

/** The settings as text, with `stop` as the Stop list. Two-space JSON and a
 * final newline, the same form on every run. */
function renderSettings(parsed: { settings: Record<string, unknown>; hooks: Record<string, unknown> }, stop: unknown[]): string {
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
  const out = renderSettings(parsed, editStopGroups(stop.groups, { cliPath, entry }));
  const changed = out !== text;
  const action = changed ? (hasOurs(stop.groups, cliPath) ? 'replaced' : 'added') : 'unchanged';
  return { ok: true, text: out, changed, action };
}

/** Open the settings file without blocking and without following a symlink.
 * Returns null when there is no file. The agent can replace the file, and
 * opening a FIFO blocks (BUG-007). */
function openIfExists(path: string): number | null {
  try {
    return openSync(path, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
  } catch (error) {
    if (isMissing(error)) {
      return null;
    }
    throw new Error(`${path} cannot be opened as a regular file: ${messageOf(error)}`);
  }
}

/** Read the settings file, or null when there is none. Only a regular file is
 * read. Returns the file's mode too, so a rewrite keeps it. */
function readSettings(path: string): { text: string; mode: number } | null {
  const fd = openIfExists(path);
  if (fd === null) {
    return null;
  }
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) {
      throw new Error(`${path} is not a regular file`);
    }
    return { text: readFileSync(fd, 'utf8'), mode: stat.mode & 0o777 };
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

/** Write `text` to `path` through a temporary file in the same directory and a
 * rename, so a crash never leaves half a file. */
function writeAtomic(claudeDir: string, path: string, text: string, mode: number): void {
  mkdirSync(claudeDir, { recursive: true });
  const temp = join(claudeDir, `settings.json.${process.pid}.tmp`);
  try {
    writeFileSync(temp, text, { flag: 'wx', mode });
    renameSync(temp, path);
  } finally {
    rmSync(temp, { force: true });
  }
}

/** A refusal of the install, with the reason. */
function refuseInstall(error: string): InstallInProject {
  return { ok: false, error };
}

/** Register the Stop hook in `dir`'s .claude/settings.json. `dir` must be the
 * root of a git repository. Writes only when the text changes. Returns an
 * error value, and writes nothing, for anything it will not edit. */
export function installInProject(dir: string, cliPath: string, command: string): InstallInProject {
  try {
    const claudeDir = join(dir, '.claude');
    const path = join(claudeDir, 'settings.json');
    const refusal = refusalFor(dir, claudeDir);
    if (refusal !== null) return refuseInstall(refusal);
    const existing = readSettings(path);
    const result = installStopHook(existing?.text ?? null, cliPath, command);
    if (!result.ok) {
      return refuseInstall(`${path}: ${result.error}`);
    }
    if (result.changed) {
      writeAtomic(claudeDir, path, result.text, existing?.mode ?? 0o644);
    }
    return { ok: true, action: result.action, path };
  } catch (error) {
    return refuseInstall(messageOf(error));
  }
}
