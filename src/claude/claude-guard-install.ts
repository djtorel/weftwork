// story: e11s01
// The settings edit that registers the guard (guard-cli.ts) as a PreToolUse
// hook in Claude Code's .claude/settings.json. Pure, like installStopHook: the
// file's text in, the new text out. claude-settings-file.ts runs both edits.
//
// The settings file is untrusted input. Text of the wrong shape is refused,
// never repaired or overwritten.
import { isDeepStrictEqual } from 'node:util';
import {
  adapterOf,
  adapterPattern,
  adapterWord,
  isEngineFile,
  keptAdapter,
  legacyRequireWeftwork,
  parseSettings,
  weftworkOnPath,
} from './claude-install.ts';
import type { Failure } from '../shared/errors.ts';
import { isRecord } from '../shared/json.ts';
import { resolved } from '../install/launcher.ts';

/** The tools the guard checks: the four that write a file, and Bash. */
export const guardMatcher = 'Edit|Write|MultiEdit|NotebookEdit|Bash';

/** The host's timeout for the entry, in seconds. The guard blocks by itself
 * after 20 s, before the host cuts it off and lets the call go ahead. */
export const guardTimeoutSeconds = 30;

export type GuardInstall = { ok: true; text: string; changed: boolean } | Failure;

/** The command of the guard entry: `weftwork guard` as the resolver finds it,
 * blocking when weftwork is missing (launcher.ts), or node and the guard's file. */
function guardCommand(cliPath: string): string {
  return cliPath === weftworkOnPath ? resolved('guard') : `node ${adapterWord(cliPath)}`;
}

/** The guard command from PATH as 0.2.0 and older wrote it. */
const legacyGuardCommand = `${legacyRequireWeftwork}weftwork guard`;

/** The hook entry the install writes for the guard at `cliPath`. */
export function guardEntry(cliPath: string): object {
  return { type: 'command', command: guardCommand(cliPath), timeout: guardTimeoutSeconds };
}

/** True when `hook` is the guard entry as the install writes it for `cliPath`,
 * or as 0.2.0 and older wrote it from PATH. */
export function isGuardAsInstalled(hook: unknown, cliPath: string): boolean {
  if (isDeepStrictEqual(hook, guardEntry(cliPath))) return true;
  return cliPath === weftworkOnPath && isDeepStrictEqual(hook, { type: 'command', command: legacyGuardCommand, timeout: guardTimeoutSeconds });
}

/** `node '<file>'`, as an older install wrote the guard entry, or
 * `node "$CLAUDE_PROJECT_DIR/<file>"`, as weftwork's own repository does. */
const fileGuard = new RegExp(`^node ${adapterPattern}$`);

/** The guard adapter a hook's command runs: weftworkOnPath, or the guard file
 * (`.../guard-cli.ts` or `.js`) of `node '<file>'` or
 * `node "$CLAUDE_PROJECT_DIR/<file>"`. Null for any other command, so a node
 * hook that runs another file is never the guard (review r1m1). The install
 * and the live check read guard entries through this. */
export function guardCliOf(command: string): string | null {
  if (command === guardCommand(weftworkOnPath) || command === legacyGuardCommand) return weftworkOnPath;
  const match = fileGuard.exec(command);
  const file = match === null ? null : adapterOf(match, 1);
  return file !== null && isEngineFile(file, 'guard-cli') ? file : null;
}

/** The guard adapter `hook` runs, whatever its other keys, or null. */
function guardCliOfHook(hook: unknown): string | null {
  return isRecord(hook) && typeof hook.command === 'string' ? guardCliOf(hook.command) : null;
}

/** True when `hook` runs the guard at `cliPath`, whatever its other keys. An
 * install from PATH also takes over an entry that names a guard file. */
function isOurs(hook: unknown, cliPath: string): boolean {
  const found = guardCliOfHook(hook);
  if (found === null) return false;
  return found === cliPath || (cliPath === weftworkOnPath && isEngineFile(found, 'guard-cli'));
}

type Items = { ok: true; items: unknown[] } | Failure;

/** The PreToolUse list. An item that is not a group with a `hooks` list is
 * the owner's, so it is kept as it is, never refused or repaired. */
function itemsOf(value: unknown): Items {
  const list = value === undefined ? [] : value;
  return Array.isArray(list)
    ? { ok: true, items: list }
    : { ok: false, error: '"hooks.PreToolUse" in the settings is not a list' };
}

/** The items with every guard entry removed; a group that loses its last hook
 * is dropped, every other item stays as it was. */
function withoutGuard(items: unknown[], cliPath: string): unknown[] {
  return items.flatMap((item) => {
    if (!isRecord(item) || !Array.isArray(item.hooks)) return [item];
    const kept = item.hooks.filter((hook) => !isOurs(hook, cliPath));
    if (kept.length === item.hooks.length) return [item];
    return kept.length === 0 ? [] : [{ ...item, hooks: kept }];
  });
}

/** The settings text with one guard group last in the PreToolUse list. A
 * settings file that already ends with exactly that group is unchanged. */
export function installGuardHook(text: string | null, cliPath: string): GuardInstall {
  const parsed = parseSettings(text);
  if (!parsed.ok) return parsed;
  const read = itemsOf(parsed.hooks.PreToolUse);
  if (!read.ok) return read;
  const hooks = read.items.flatMap((item) => (isRecord(item) && Array.isArray(item.hooks) ? item.hooks : []));
  const adapter = keptAdapter(hooks.map((hook) => guardCliOfHook(hook) ?? undefined), cliPath, 'guard-cli');
  const group = { matcher: guardMatcher, hooks: [guardEntry(adapter)] };
  // Which entries are replaced follows the install asked for, so an install
  // from PATH that keeps a "$CLAUDE_PROJECT_DIR" entry still drops a PATH one.
  const kept = withoutGuard(read.items, cliPath);
  const done = isDeepStrictEqual(read.items.at(-1), group) && kept.length === read.items.length - 1;
  const list = done ? read.items : [...kept, group];
  const settings = { ...parsed.settings, hooks: { ...parsed.hooks, PreToolUse: list } };
  const out = `${JSON.stringify(settings, null, 2)}\n`;
  return { ok: true, text: out, changed: out !== text };
}
