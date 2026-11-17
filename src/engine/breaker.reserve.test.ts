// story: e09s03
// The handover reserve (e09s03 AC-01 to AC-03): when the runs left under the
// loop ceiling are within the reserve, the agent must write the handoff now.
// The reserve is min(reserveRuns, maxRuns - 1), 1 by default. It runs on
// arrays of ledger entries, with no process and no repository.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkReserve } from './breaker.ts';
import type { LedgerEntry } from './ledger.ts';

function run(command = 'a'): LedgerEntry {
  return {
    at: '2026-11-14T03:00:00.000Z',
    done: false,
    exitCode: 7,
    reason: 'exit-nonzero',
    command,
    fingerprint: 'A',
  };
}

const runs = (count: number): LedgerEntry[] => Array.from({ length: count }, (_, index) => run(`c${index}`));

const pass: LedgerEntry = { ...run(), done: true, exitCode: 0, reason: 'passed' };

test('AC-e09s03-01 three runs under a ceiling of 4 with a reserve of 1 leave 1', () => {
  assert.deepEqual(checkReserve(runs(3), 4, 1), { count: 3, left: 1 });
});

test('AC-e09s03-01 two runs under a ceiling of 4 are outside a reserve of 1', () => {
  assert.equal(checkReserve(runs(2), 4, 1), null);
});

test('AC-e09s03-01 at the ceiling there is no reserve: the ceiling answers', () => {
  assert.equal(checkReserve(runs(4), 4, 1), null);
  assert.equal(checkReserve(runs(5), 4, 1), null);
});

test('AC-e09s03-01 only the runs since the last done count', () => {
  assert.equal(checkReserve([...runs(3), pass, run()], 4, 1), null);
  assert.deepEqual(checkReserve([...runs(3), pass, ...runs(3)], 4, 1), { count: 3, left: 1 });
});

test('AC-e09s03-02 with no reserveRuns the reserve is 1', () => {
  assert.deepEqual(checkReserve(runs(3), 4, undefined), { count: 3, left: 1 });
  assert.equal(checkReserve(runs(2), 4, undefined), null);
});

test('AC-e09s03-02 a ceiling of 2 with the default reserve warns after the first run', () => {
  assert.equal(checkReserve([], 2, undefined), null);
  assert.deepEqual(checkReserve(runs(1), 2, undefined), { count: 1, left: 1 });
});

test('AC-e09s03-02 a ceiling of 1 has no reserve', () => {
  assert.equal(checkReserve([], 1, undefined), null);
  assert.equal(checkReserve([], 1, 5), null);
});

test('AC-e09s03-02 a reserve above the ceiling is clamped to maxRuns - 1', () => {
  assert.deepEqual(checkReserve(runs(1), 4, 9), { count: 1, left: 3 });
  assert.equal(checkReserve([], 4, 9), null);
});

test('AC-e09s03-02 a reserve of 2 covers the last two runs before the ceiling', () => {
  assert.equal(checkReserve(runs(1), 4, 2), null);
  assert.deepEqual(checkReserve(runs(2), 4, 2), { count: 2, left: 2 });
  assert.deepEqual(checkReserve(runs(3), 4, 2), { count: 3, left: 1 });
});

test('AC-e09s03-03 with no maxRuns there is no reserve', () => {
  assert.equal(checkReserve(runs(3), undefined, 1), null);
  assert.equal(checkReserve(runs(3), undefined, undefined), null);
});

test('AC-e09s03-03 a reserve of 0 is off at every count', () => {
  for (let count = 0; count <= 5; count += 1) {
    assert.equal(checkReserve(runs(count), 4, 0), null);
  }
});
