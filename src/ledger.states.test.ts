// story: e06s04
// State lines, the capped tail reader and failingRun (e06s04 AC-03 to
// AC-08). Every ledger lives in a temporary git repository.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  appendState,
  countsFor,
  failingRun,
  ledgerPath,
  readLedger,
  readLedgerTail,
  type LedgerEntry,
  type StateEntry,
} from './ledger.ts';
import { cleanupTempDirs, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const at = new Date('2026-11-12T03:00:00.000Z');
const hex = 'a'.repeat(64);

function runLine(command = 'true', done = true): string {
  return JSON.stringify({
    at: at.toISOString(),
    done,
    exitCode: done ? 0 : 1,
    reason: done ? 'passed' : 'exit-nonzero',
    command,
    fingerprint: hex,
  });
}

function stateLine(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    at: at.toISOString(),
    state: 'stalled',
    command: 'check',
    runs: 3,
    failStreak: 3,
    threshold: 3,
    detail: 'three runs',
    ...over,
  });
}

async function pathIn(cwd: string): Promise<string> {
  const path = await ledgerPath(cwd);
  assert.notEqual(path, null);
  return path as string;
}

/** A ledger file with `content` written as it is. */
async function ledgerWith(content: string): Promise<string> {
  const path = await pathIn(makeTestRepo());
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
  return path;
}

function entry(command: string, done: boolean): LedgerEntry {
  return {
    at: at.toISOString(),
    done,
    exitCode: done ? 0 : 1,
    reason: done ? 'passed' : 'exit-nonzero',
    command,
    fingerprint: hex,
  };
}

test('AC-e06s04-03 a state line is written and read back', async () => {
  const path = await pathIn(makeTestRepo());
  const written: StateEntry = {
    at: at.toISOString(),
    state: 'stalled',
    command: 'check',
    runs: 3,
    failStreak: 3,
    threshold: 3,
    detail: 'three runs',
  };
  assert.deepEqual(await appendState(path, written, at), { ok: true });
  const read = await readLedgerTail(path, 1024 * 1024);
  assert.ok(read.ok);
  assert.deepEqual(read.states, [written]);
  assert.equal(read.skipped, 0);
  assert.equal(read.entries.length, 0);
  assert.equal(statSync(path).mode & 0o077, 0);
  assert.equal(statSync(join(path, '..')).mode & 0o077, 0);
});

test('AC-e06s04-03 appendState reports a failure and never throws', async () => {
  const repo = makeTestRepo();
  const path = await pathIn(repo);
  writeFileSync(join(path, '..', '..', 'weftwork'), 'a file, not a directory');
  const result = await appendState(path, JSON.parse(stateLine()) as StateEntry, at);
  assert.equal(result.ok, false);
});

test('AC-e06s04-04 a state line is not a run', async () => {
  const withState = await ledgerWith(
    `${runLine('a', false)}\n${stateLine({ command: 'a' })}\n${runLine('a', true)}\n`,
  );
  const without = await ledgerWith(`${runLine('a', false)}\n${runLine('a', true)}\n`);
  const a = await readLedger(withState);
  const b = await readLedger(without);
  assert.ok(a.ok && b.ok);
  assert.equal(a.entries.length, 2);
  assert.equal(a.skipped, 0);
  assert.deepEqual(countsFor(a.entries, 'a', hex), countsFor(b.entries, 'a', hex));
});

const badStates: ReadonlyArray<[string, Record<string, unknown>]> = [
  ['a state name that is not a State', { state: 'running' }],
  ['a missing runs field', { runs: undefined }],
  ['runs as the string "3"', { runs: '3' }],
  ['threshold as a string', { threshold: '3' }],
];

for (const [name, over] of badStates) {
  test(`AC-e06s04-05 a bad state line is skipped: ${name}`, async () => {
    const path = await ledgerWith(`${runLine()}\n${stateLine(over)}\n`);
    const read = await readLedgerTail(path, 1024 * 1024);
    assert.ok(read.ok);
    assert.equal(read.entries.length, 1);
    assert.equal(read.states.length, 0);
    assert.equal(read.skipped, 1);
  });
}

test('AC-e06s04-06 the tail is capped and drops the cut first line', async () => {
  const lines = Array.from({ length: 40 }, (_, i) => runLine(`cmd-${i}`));
  const path = await ledgerWith(`${lines.join('\n')}\n`);
  const maxBytes = lines[0]!.length * 3 + 10;
  const read = await readLedgerTail(path, maxBytes);
  assert.ok(read.ok);
  assert.equal(read.truncated, true);
  assert.ok(read.entries.length >= 2 && read.entries.length <= 3);
  assert.equal(read.entries.at(-1)?.command, 'cmd-39');
  assert.equal(read.skipped, 0);
});

test('AC-e06s04-06 with a cap larger than the file nothing is cut', async () => {
  const path = await ledgerWith(`${runLine('a')}\n${runLine('b', false)}\n`);
  const tail = await readLedgerTail(path, 1024 * 1024);
  const full = await readLedger(path);
  assert.ok(tail.ok && full.ok);
  assert.equal(tail.truncated, false);
  assert.deepEqual(tail.entries, full.entries);
  assert.equal(tail.skipped, full.skipped);
});

test('AC-e06s04-07 a missing ledger is an empty tail', async () => {
  const path = await pathIn(makeTestRepo());
  assert.deepEqual(await readLedgerTail(path, 1024), {
    ok: true,
    entries: [],
    states: [],
    skipped: 0,
    truncated: false,
  });
});

test('AC-e06s04-07 a directory is not ok and does not throw', async () => {
  const repo = makeTestRepo();
  const path = await pathIn(repo);
  mkdirSync(path, { recursive: true });
  const read = await readLedgerTail(path, 1024);
  assert.equal(read.ok, false);
});

test('AC-e06s04-08 failingRun is the not-done entries after the last done', () => {
  const entries = [
    entry('a', false),
    entry('b', false),
    entry('a', true),
    entry('a', false),
    entry('a', false),
  ];
  assert.deepEqual(failingRun(entries, 'a'), [entries[3], entries[4]]);
  assert.deepEqual(failingRun(entries, 'b'), [entries[1]]);
  assert.deepEqual(failingRun(entries, 'c'), []);
  assert.equal(countsFor(entries, 'a', hex).failStreak, 2);
});
