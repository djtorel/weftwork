// The `timeout` of weftwork's Stop hook entry in the host's settings. The hook
// reads it to keep its command limit under it (commandLimit in claude-hook.ts),
// and `weftwork update` raises one an older weftwork wrote (660 s) to what the
// setting needs (docs/BUDGET.md). Pure: settings text in, a number or new text
// out. The settings file is untrusted input, so text of the wrong shape is
// left alone here; the install refuses it with the reason.
import { parseSettings, parseStopHook, stopListOf } from './claude-install.ts';
import type { Failure } from '../shared/errors.ts';
import { isRecord } from '../shared/json.ts';

/** The host's timeout for a command hook with no `timeout` of its own
 * (Claude Code hooks docs, read 2026-11-26). */
export const hostDefaultTimeoutSeconds = 600;

/** The weftwork Stop entries in settings `text`, or none when the text is not
 * settings of the right shape. */
function weftworkEntries(text: string | null): Record<string, unknown>[] {
  const parsed = parseSettings(text);
  const stop = parsed.ok ? stopListOf(parsed.hooks) : parsed;
  if (!stop.ok) return [];
  return stop.groups.flatMap((group) => group.hooks).filter(isWeftworkEntry);
}

function isWeftworkEntry(hook: unknown): hook is Record<string, unknown> {
  return isRecord(hook) && parseStopHook(hook) !== null;
}

/** The timeout in seconds the host gives `hook`: its own, or the default. */
function timeoutOf(hook: Record<string, unknown>): number {
  return typeof hook.timeout === 'number' && hook.timeout > 0 ? hook.timeout : hostDefaultTimeoutSeconds;
}

/** The lowest host timeout of a weftwork Stop entry for `command` in any of
 * `texts`, or null when none holds one. */
export function entryTimeout(texts: (string | null)[], command: string): number | null {
  const timeouts = texts
    .flatMap(weftworkEntries)
    .filter((hook) => parseStopHook(hook)?.command === command)
    .map(timeoutOf);
  return timeouts.length === 0 ? null : Math.min(...timeouts);
}

export type Repaired = { ok: true; text: string | null; changed: boolean } | Failure;

/** The settings text with every weftwork Stop entry whose timeout is below
 * `timeout` raised to it. Every other key, hook and field stays. A longer
 * timeout stays: the owner may have set it. Text that is not settings of the
 * right shape is refused, never rewritten. */
export function repairStopTimeouts(text: string | null, timeout: number): Repaired {
  const parsed = parseSettings(text);
  const stop = parsed.ok ? stopListOf(parsed.hooks) : parsed;
  if (!stop.ok) return stop;
  if (!parsed.ok) return parsed; // stop.ok already implies it; this narrows the type
  const low = stop.groups
    .flatMap((group) => group.hooks)
    .filter(isWeftworkEntry)
    .filter((hook) => timeoutOf(hook) < timeout);
  if (low.length === 0) return { ok: true, text, changed: false };
  for (const hook of low) hook.timeout = timeout;
  return { ok: true, text: `${JSON.stringify(parsed.settings, null, 2)}\n`, changed: true };
}
