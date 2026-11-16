// The SessionStart entry that lets the session's Bash commands, and so the
// skills, call `weftwork` however it is installed: it appends the resolver
// (launcher.ts) as a shell function to CLAUDE_ENV_FILE, which Claude Code runs
// before each Bash command. With a global install it changes nothing; with a
// clone's own install or a dev dependency it is how `weftwork review` and
// `$(weftwork path)` resolve. Pure, like installStopHook: the settings text
// in, the new text out. docs/INSTALL.md.
import { isDeepStrictEqual } from 'node:util';
import { parseSettings, shellQuote } from './claude-install.ts';
import type { Failure } from './errors.ts';
import { isRecord } from './json.ts';
import { weftworkFunction } from './launcher.ts';

export type EnvInstall = { ok: true; text: string; changed: boolean } | Failure;

/** The start of every command this entry has: Claude Code sets the file only
 * for SessionStart (and a few other) hooks; without it there is nothing to do. */
const envStart = `[ -z "\${CLAUDE_ENV_FILE:-}" ] || printf '%s\\n' `;

/** The command of the SessionStart entry. */
export const envHookCommand = `${envStart}${shellQuote(weftworkFunction)} >> "$CLAUDE_ENV_FILE"`;

/** The SessionStart entry the install writes. */
export const envHookEntry = { type: 'command', command: envHookCommand };

/** True when `hook` is a weftwork SessionStart entry, this one or another
 * version's: it writes a `weftwork` function to CLAUDE_ENV_FILE. */
function isOurs(hook: unknown): boolean {
  return isRecord(hook) && typeof hook.command === 'string' && hook.command.startsWith(envStart) && hook.command.includes('weftwork() {');
}

/** The settings text with one weftwork SessionStart group last. Every other
 * item stays as it was; a group that loses its last hook is dropped. */
export function installEnvHook(text: string | null): EnvInstall {
  const parsed = parseSettings(text);
  if (!parsed.ok) return parsed;
  const list = parsed.hooks.SessionStart === undefined ? [] : parsed.hooks.SessionStart;
  if (!Array.isArray(list)) return { ok: false, error: '"hooks.SessionStart" in the settings is not a list' };
  const group = { hooks: [envHookEntry] };
  const kept = list.flatMap((item: unknown) => {
    if (!isRecord(item) || !Array.isArray(item.hooks)) return [item];
    const hooks = item.hooks.filter((hook) => !isOurs(hook));
    if (hooks.length === item.hooks.length) return [item];
    return hooks.length === 0 ? [] : [{ ...item, hooks }];
  });
  const done = isDeepStrictEqual(list.at(-1), group) && kept.length === list.length - 1;
  const settings = { ...parsed.settings, hooks: { ...parsed.hooks, SessionStart: done ? list : [...kept, group] } };
  const out = `${JSON.stringify(settings, null, 2)}\n`;
  return { ok: true, text: out, changed: out !== text };
}
