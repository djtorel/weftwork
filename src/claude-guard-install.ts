// story: e11s01
// The settings edit that registers the guard (guard-cli.ts) as a PreToolUse
// hook in Claude Code's .claude/settings.json. Pure, like installStopHook: the
// file's text in, the new text out. claude-settings-file.ts runs both edits.
//
// The settings file is untrusted input. Text of the wrong shape is refused,
// never repaired or overwritten.
import { isDeepStrictEqual } from 'node:util';
import { isEngineFile, parseSettings, requireWeftwork, shellQuote, weftworkOnPath } from './claude-install.ts';
import type { Failure } from './errors.ts';
import { isRecord } from './json.ts';

/** The tools the guard checks: the four that write a file, and Bash. */
export const guardMatcher = 'Edit|Write|MultiEdit|NotebookEdit|Bash';

/** The host's timeout for the entry, in seconds. The guard blocks by itself
 * after 20 s, before the host cuts it off and lets the call go ahead. */
export const guardTimeoutSeconds = 30;

export type GuardInstall = { ok: true; text: string; changed: boolean } | Failure;

/** The command of the guard entry: `weftwork guard` from PATH, blocking when
 * weftwork is missing (claude-install.ts), or node and the guard's file. */
function guardCommand(cliPath: string): string {
  return cliPath === weftworkOnPath ? `${requireWeftwork}weftwork guard` : `node ${shellQuote(cliPath)}`;
}

/** The hook entry the install writes for the guard at `cliPath`. */
export function guardEntry(cliPath: string): object {
  return { type: 'command', command: guardCommand(cliPath), timeout: guardTimeoutSeconds };
}

/** `node '<file>'`, as an older install wrote the guard entry. */
const fileGuard = /^node '((?:[^']|'\\'')*)'$/;

/** True when `hook` runs the guard at `cliPath`, whatever its other keys. An
 * install from PATH also takes over an entry that names a guard file. */
function isOurs(hook: unknown, cliPath: string): boolean {
  if (!isRecord(hook) || typeof hook.command !== 'string') return false;
  if (hook.command === guardCommand(cliPath)) return true;
  const file = fileGuard.exec(hook.command)?.[1];
  return cliPath === weftworkOnPath && file !== undefined && isEngineFile(file.replaceAll("'\\''", "'"), 'guard-cli');
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
  const group = { matcher: guardMatcher, hooks: [guardEntry(cliPath)] };
  const kept = withoutGuard(read.items, cliPath);
  const done = isDeepStrictEqual(read.items.at(-1), group) && kept.length === read.items.length - 1;
  const list = done ? read.items : [...kept, group];
  const settings = { ...parsed.settings, hooks: { ...parsed.hooks, PreToolUse: list } };
  const out = `${JSON.stringify(settings, null, 2)}\n`;
  return { ok: true, text: out, changed: out !== text };
}
