// story: e07s03, e07s04
// The settings edit that registers the Stop hook in Claude Code's
// .claude/settings.json. installStopHook is pure: the file's text in, the new
// text out. claude-settings-file.ts does the reading and the atomic write; the
// install command (claude-install-cli.ts) only parses arguments and prints.
//
// The settings file is untrusted input: it may be anything, and the agent can
// edit it. Text of the wrong shape is refused, never repaired or overwritten.
import { isDeepStrictEqual } from 'node:util';
import { hookTimeoutSeconds } from './claude-hook.ts';
import { messageOf } from './errors.ts';
import { isRecord } from './json.ts';

/** What the install did. `reformatted`: the entry was right, only the spacing changed. */
export type Action = 'added' | 'replaced' | 'reformatted' | 'unchanged';

export type Failure = { ok: false; error: string };
export type InstallResult = { ok: true; text: string; changed: boolean; action: Action } | Failure;

/** One group of a Stop list: an object with a `hooks` list. */
type Group = Record<string, unknown> & { hooks: unknown[] };
type Settings = { settings: Record<string, unknown>; hooks: Record<string, unknown> };
type Parsed = ({ ok: true } & Settings) | Failure;
type StopList = { ok: true; groups: Group[] } | Failure;
type HookEdit = { hooks: unknown[]; placed: boolean; touched: boolean };

/** What the edit writes: the adapter path that marks weftwork's entries, and the entry. */
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

/** `node '<adapter>' -- '<command>'` exactly as stopHookCommand writes it: each
 * quoted part is plain text or `'\''`, so a quote inside never ends it early. */
const stopHookText = /^node '((?:[^']|'\\'')*)' -- '((?:[^']|'\\'')*)'$/;

/** Undo shellQuote for the text between the outer quotes. */
function unquote(inner: string): string {
  return inner.replaceAll("'\\''", "'");
}

/** The adapter path and the declared command of a weftwork entry's command text,
 * or null when `text` is not exactly what stopHookCommand writes. The install
 * and the live check both decide what an entry is here, so they cannot drift.
 * An owner hook that mentions the path or adds shell text after it is not ours. */
export function parseStopHookCommand(text: string): { cliPath: string; command: string } | null {
  const match = stopHookText.exec(text);
  if (match === null) {
    return null;
  }
  return { cliPath: unquote(match[1] ?? ''), command: unquote(match[2] ?? '') };
}

/** True when `hook` is a weftwork entry for the adapter at `cliPath`: a command
 * hook whose command text parses. An entry from another checkout is not ours. */
function isOurs(hook: unknown, cliPath: string): boolean {
  return isRecord(hook) && hook.type === 'command' && typeof hook.command === 'string'
    && parseStopHookCommand(hook.command)?.cliPath === cliPath;
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
export function stopListOf(hooks: Record<string, unknown>): StopList {
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

/** Read the settings text as an object. A null, empty or blank `text` is no
 * settings yet. Refuses text that is not a JSON object, and a `hooks` key that
 * is not an object (`null` too). */
export function parseSettings(text: string | null): Parsed {
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

/** The groups after the edit. A group that loses its last hook is dropped; an
 * untouched group stays. The entry gets a new group if none held a weftwork one. */
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
 * file's text, or null when there is no file. An existing weftwork entry is
 * replaced in place and any more are removed. Every other key and hook stays. */
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
