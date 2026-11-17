// story: e09s02
// The loop ceiling (e09s02 AC-01 to AC-03): every run of any command since
// the last done counts, so changing the command or passing another one
// does not reset it; only a done opens a new loop. It runs on arrays of
// ledger entries, with no process and no repository.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLoopCeiling } from './breaker.ts';
import type { LedgerEntry } from './ledger.ts';

type Over = Partial<LedgerEntry>;

function run(over: Over = {}): LedgerEntry {
  return {
    at: '2026-11-14T03:00:00.000Z',
    done: false,
    exitCode: 7,
    reason: 'exit-nonzero',
    command: 'a',
    fingerprint: 'A',
    ...over,
  };
}

const pass = (over: Over = {}): LedgerEntry =>
  run({ done: true, exitCode: 0, reason: 'passed', ...over });

const commands = (names: string[]): LedgerEntry[] => names.map((command) => run({ command }));

test('AC-e09s02-01 two runs of different commands are under a ceiling of 3', () => {
  assert.equal(checkLoopCeiling(commands(['a', 'b']), 3), null);
});

test('AC-e09s02-01 the third run of any command reaches a ceiling of 3', () => {
  assert.deepEqual(checkLoopCeiling(commands(['a', 'b', 'c']), 3), {
    state: 'exhausted',
    threshold: 3,
    count: 3,
  });
});

test('AC-e09s02-01 a count above the ceiling still trips and gives the count', () => {
  assert.equal(checkLoopCeiling(commands(['a', 'b', 'c', 'd']), 3)?.count, 4);
});

test('AC-e09s02-01 a ceiling of 1 trips on the first run', () => {
  assert.equal(checkLoopCeiling([run()], 1)?.count, 1);
});

test('AC-e09s02-01 timed-out and killed runs count as runs', () => {
  const entries = [run({ reason: 'timeout', exitCode: null }), run({ reason: 'killed', exitCode: null })];
  assert.equal(checkLoopCeiling(entries, 2)?.count, 2);
});

test('AC-e09s02-02 a done opens a new loop: only the runs after it count', () => {
  const entries = [...commands(['a', 'a', 'b', 'c', 'd']), pass(), run()];
  assert.equal(checkLoopCeiling(entries, 3), null);
  assert.deepEqual(checkLoopCeiling(entries, 1), { state: 'exhausted', threshold: 1, count: 1 });
});

test('AC-e09s02-02 a done of another command opens a new loop as well', () => {
  const entries = [run(), run(), pass({ command: 'b' }), run()];
  assert.equal(checkLoopCeiling(entries, 2), null);
});

test('AC-e09s02-02 a done as the last entry leaves a count of 0', () => {
  assert.equal(checkLoopCeiling([run(), run(), pass()], 1), null);
});

test('AC-e09s02-02 no entries at all is a count of 0', () => {
  assert.equal(checkLoopCeiling([], 1), null);
});

test('AC-e09s02-03 with no maxRuns the loop ceiling never trips', () => {
  const many = Array.from({ length: 1001 }, (_, index) => run({ command: `c${index}` }));
  assert.equal(checkLoopCeiling(many, undefined), null);
});
