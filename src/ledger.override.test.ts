// story: e06s05
// State lines for overrides and the override counts (e06s05 AC-02 to
// AC-04). Every ledger lives in a temporary git repository.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  appendState,
  ledgerPath,
  overrideCounts,
  readLedgerTail,
  type StateEntry,
} from './ledger.ts';
import { cleanupTempDirs, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const at = new Date('2026-11-12T03:00:00.000Z');
const hex = 'a'.repeat(64);

function runLine(): string {
  return JSON.stringify({
    at: at.toISOString(),
    done: true,
    exitCode: 0,
    reason: 'passed',
    command: 'true',
    fingerprint: hex,
  });
}

function stateLine(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    at: at.toISOString(),
    state: 'overridden',
    command: 'check',
    runs: 2,
    failStreak: 2,
    threshold: null,
    detail: 'flaky network',
    ...over,
  });
}

function entryOf(over: Partial<StateEntry> = {}): StateEntry {
  return JSON.parse(stateLine(over as Record<string, unknown>)) as StateEntry;
}

async function pathIn(cwd: string): Promise<string> {
  const path = await ledgerPath(cwd);
  assert.notEqual(path, null);
  return path as string;
}

async function ledgerWith(content: string): Promise<string> {
  const path = await pathIn(makeTestRepo());
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
  return path;
}

test('AC-e06s05-02 an override line with a kind and an author is read back', async () => {
  const path = await pathIn(makeTestRepo());
  const written = entryOf({ kind: 'false-alarm', author: 'dom' });
  assert.deepEqual(await appendState(path, written, at), { ok: true });
  const read = await readLedgerTail(path, 1024 * 1024);
  assert.ok(read.ok);
  assert.deepEqual(read.states, [written]);
  assert.equal(read.skipped, 0);
});

test('AC-e06s05-02 a state line with no kind and no author is still read', async () => {
  const path = await ledgerWith(`${stateLine()}\n`);
  const read = await readLedgerTail(path, 1024 * 1024);
  assert.ok(read.ok);
  assert.equal(read.states.length, 1);
  assert.equal(read.states[0]?.state, 'overridden');
  assert.equal(read.skipped, 0);
});

const badFields: ReadonlyArray<[string, Record<string, unknown>]> = [
  ['kind as the number 1', { kind: 1 }],
  ['author as the number 1', { author: 1 }],
];

for (const [name, bad] of badFields) {
  test(`AC-e06s05-03 a bad override field is skipped: ${name}`, async () => {
    const path = await ledgerWith(`${runLine()}\n${stateLine(bad)}\n`);
    const read = await readLedgerTail(path, 1024 * 1024);
    assert.ok(read.ok);
    assert.equal(read.entries.length, 1);
    assert.equal(read.states.length, 0);
    assert.equal(read.skipped, 1);
  });
}

test('AC-e06s05-04 the counts are by command and by kind', () => {
  const states = [
    entryOf({ command: 'a', kind: 'override' }),
    entryOf({ command: 'a', kind: 'override' }),
    entryOf({ command: 'a', kind: 'false-alarm' }),
    entryOf({ command: 'a' }),
    entryOf({ command: 'a', state: 'stalled', kind: 'override' }),
    entryOf({ command: 'b', kind: 'override' }),
  ];
  assert.deepEqual(overrideCounts(states, 'a'), { overrides: 2, falseAlarms: 1 });
  assert.deepEqual(overrideCounts(states, 'b'), { overrides: 1, falseAlarms: 0 });
  assert.deepEqual(overrideCounts(states, 'c'), { overrides: 0, falseAlarms: 0 });
});
