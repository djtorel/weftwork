// The Stop hook entry's host timeout: the hook reads the lowest one for its
// command, so it can fit its limit under it, and `weftwork update` raises a
// short one (the old 660 s) to what budget.stop_hook_timeout_seconds needs. Text of
// the wrong shape is never rewritten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entryTimeout, hostDefaultTimeoutSeconds, repairStopTimeouts } from './claude-hook-timeout.ts';
import { stopHookCommand, weftworkOnPath } from './claude-install.ts';

const ours = (command: string, timeout?: number) => ({
  type: 'command',
  command: stopHookCommand(weftworkOnPath, command),
  ...(timeout === undefined ? {} : { timeout }),
});
const other = { type: 'command', command: 'npm run lint', timeout: 5 };
const settings = (hooks: unknown[], extra: Record<string, unknown> = {}) =>
  `${JSON.stringify({ ...extra, hooks: { Stop: [{ hooks }] } }, null, 2)}\n`;

test('entryTimeout gives the timeout of the weftwork entry for the command', () => {
  assert.equal(entryTimeout([settings([other, ours('npm test', 660)])], 'npm test'), 660);
});

test('entryTimeout takes the lowest across files and entries, and ignores other commands', () => {
  const project = settings([ours('npm test', 1860), ours('npm run check', 70)]);
  const local = settings([ours('npm test', 900)]);
  assert.equal(entryTimeout([project, local], 'npm test'), 900);
});

test('entryTimeout reads an entry with no timeout as the host default', () => {
  assert.equal(entryTimeout([settings([ours('npm test')])], 'npm test'), hostDefaultTimeoutSeconds);
  assert.equal(hostDefaultTimeoutSeconds, 600);
});

test('entryTimeout is null for no file, no entry, or text of the wrong shape', () => {
  for (const text of [null, '', '{"hooks":', '[]', '{"hooks":{"Stop":7}}', settings([other])]) {
    assert.equal(entryTimeout([text], 'npm test'), null, String(text));
  }
});

test('repairStopTimeouts raises an old 660 entry and keeps every other key and hook', () => {
  const before = settings([other, ours('npm test', 660)], { model: 'x' });
  const repaired = repairStopTimeouts(before, 1860);
  assert.ok(repaired.ok);
  assert.equal(repaired.changed, true);
  assert.equal(repaired.text, settings([other, ours('npm test', 1860)], { model: 'x' }));
});

test('repairStopTimeouts keeps a timeout that already fits, so it changes nothing', () => {
  for (const timeout of [1860, 3600]) {
    const text = settings([ours('npm test', timeout)]);
    assert.deepEqual(repairStopTimeouts(text, 1860), { ok: true, text, changed: false });
  }
  assert.deepEqual(repairStopTimeouts(null, 1860), { ok: true, text: null, changed: false });
});

test('repairStopTimeouts refuses settings it cannot read, and writes nothing', () => {
  for (const text of ['{"hooks":', '[]', '{"hooks":{"Stop":7}}']) {
    assert.equal(repairStopTimeouts(text, 1860).ok, false, text);
  }
});
