// story: e07s04
// Shared by the live check's tests: a live setup (an entry as the install
// writes it, its adapter present, a matching record) that each test changes
// in one part. Pure values only; no file or process is touched.
import { stopHookCommand } from './claude-install.ts';
import type { LiveInput, SettingsSource } from './claude-live.ts';
import type { LastCall } from './last-call.ts';

export const cli = '/opt/weft work/src/claude-hook-cli.ts';
export const now = new Date('2026-11-12T12:00:00.000Z');
export const call: LastCall = { at: '2026-11-12T11:58:00.000Z', cliPath: cli, command: 'npm test' };

/** Settings text with one Stop group holding `hooks`, plus `extra` keys. */
export function settings(hooks: unknown[], extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...extra, hooks: { Stop: [{ hooks: hooks }] } });
}

/** weftwork's entry for `command` and the adapter at `path`. */
export function entry(command = 'npm test', path = cli) {
  return { type: 'command', command: stopHookCommand(path, command), timeout: 660 };
}

export function source(name: string, text: string | null): SettingsSource {
  return { name, read: { ok: true, text } };
}

/** A live setup; each test changes one part. */
export function input(change: Partial<LiveInput> = {}): LiveInput {
  return {
    local: source('.claude/settings.local.json', null),
    project: source('.claude/settings.json', settings([entry()])),
    user: source('/home/u/.claude/settings.json', null),
    exists: (path) => path === cli,
    lastCall: { ok: true, call },
    now,
    ...change,
  };
}
