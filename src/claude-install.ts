// story: e07s03
// The settings edit that registers the Stop hook in Claude Code's
// .claude/settings.json. Pure: the file's text in, the new text out. The
// install command (claude-install-cli.ts) does the reading and writing.
//
// The settings file is untrusted input: it may be anything, and the agent can
// edit it. Text of the wrong shape is refused, never repaired or overwritten.
import { hookTimeoutSeconds } from './claude-hook.ts';
import { messageOf } from './errors.ts';
import { isRecord } from './json.ts';

export type InstallResult =
  | { ok: true; text: string; changed: boolean; action: 'added' | 'replaced' | 'unchanged' }
  | { ok: false; error: string };

/** Wrap `text` in single quotes for a POSIX shell: each `'` becomes `'\''`. */
export function shellQuote(text: string): string {
  return `'${text.replaceAll("'", `'\\''`)}'`;
}

/** The command of the hook entry: node runs the adapter, and `command` is the
 * one argument after `--`, as claude-hook-cli.ts reads it. */
export function stopHookCommand(cliPath: string, command: string): string {
  return `node ${shellQuote(cliPath)} -- ${shellQuote(command)}`;
}

function refuse(error: string): InstallResult {
  return { ok: false, error };
}

/** True when `hook` is a weftwork entry: a command that runs this checkout's
 * adapter. The match is the whole quoted path, so an entry from another
 * checkout, or a path that only starts the same, is not ours. */
function isOurs(hook: unknown, cliPath: string): boolean {
  return isRecord(hook) && typeof hook.command === 'string' && hook.command.includes(shellQuote(cliPath));
}

/** The settings text with one weftwork Stop entry for `command`. `text` is the
 * file's text, or null when there is no file. A weftwork entry that exists is
 * replaced in place, and any more of them are removed, so there is at most
 * one. Every other key and hook stays, in order. */
export function installStopHook(text: string | null, cliPath: string, command: string): InstallResult {
  if (command.trim() === '') {
    return refuse('the declared command is blank');
  }
  let settings: unknown = {};
  if (text !== null) {
    try {
      settings = JSON.parse(text);
    } catch (error) {
      return refuse(`the settings are not valid JSON: ${messageOf(error)}`);
    }
  }
  if (!isRecord(settings)) {
    return refuse('the settings are not a JSON object');
  }
  const hooks = settings.hooks ?? {};
  if (!isRecord(hooks)) {
    return refuse('"hooks" in the settings is not an object');
  }
  const stop = hooks.Stop ?? [];
  if (!Array.isArray(stop)) {
    return refuse('"hooks.Stop" in the settings is not a list');
  }

  const entry = { type: 'command', command: stopHookCommand(cliPath, command), timeout: hookTimeoutSeconds };
  let found = false;
  const groups: unknown[] = [];
  for (const group of stop as unknown[]) {
    if (!isRecord(group) || !Array.isArray(group.hooks)) {
      return refuse('a group in "hooks.Stop" is not an object with a "hooks" list');
    }
    const kept: unknown[] = [];
    let touched = false;
    for (const hook of group.hooks as unknown[]) {
      if (!isOurs(hook, cliPath)) {
        kept.push(hook);
      } else if (!found) {
        found = true;
        touched = true;
        kept.push(entry);
      } else {
        touched = true;
      }
    }
    if (kept.length > 0 || !touched) {
      groups.push({ ...group, hooks: kept });
    }
  }
  if (!found) {
    groups.push({ hooks: [entry] });
  }

  const out = `${JSON.stringify({ ...settings, hooks: { ...hooks, Stop: groups } }, null, 2)}\n`;
  const changed = out !== text;
  const action = !changed ? 'unchanged' : found ? 'replaced' : 'added';
  return { ok: true, text: out, changed, action };
}
