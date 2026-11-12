// story: e06s04
// The ceiling on failed runs in a row (e06s04 AC-13, AC-14), counted from
// ledger entries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCeiling, defaultMaxFailures, defaultStallAfter } from './breaker.ts';
import type { LedgerEntry } from './ledger.ts';

function run(done: boolean, command = 'a'): LedgerEntry {
  return {
    at: '2026-11-12T03:00:00.000Z',
    done,
    exitCode: done ? 0 : 1,
    reason: done ? 'passed' : 'exit-nonzero',
    command,
    fingerprint: 'A',
  };
}

const fails = (count: number, command = 'a') =>
  Array.from({ length: count }, () => run(false, command));

test('the defaults are 3 identical runs and 5 failed runs', () => {
  assert.equal(defaultStallAfter, 3);
  assert.equal(defaultMaxFailures, 5);
});

test('AC-e06s04-13 the ceiling trips at the limit, not below it', () => {
  assert.equal(checkCeiling(fails(4), 'a', 5), null);
  assert.deepEqual(checkCeiling(fails(5), 'a', 5), {
    state: 'exhausted',
    threshold: 5,
    count: 5,
  });
});

test('AC-e06s04-13 past the limit it still trips, with the full count', () => {
  assert.equal(checkCeiling(fails(8), 'a', 5)?.count, 8);
});

test('AC-e06s04-13 the limit is an input', () => {
  assert.equal(checkCeiling(fails(2), 'a', 2)?.state, 'exhausted');
  assert.equal(checkCeiling(fails(1), 'a', 2), null);
  assert.equal(checkCeiling(fails(1), 'a', 1)?.threshold, 1);
});

test('AC-e06s04-14 a pass ends the count', () => {
  const entries = [...fails(4), run(true), ...fails(4)];
  assert.equal(checkCeiling(entries, 'a', 5), null);
  assert.equal(checkCeiling([...fails(5), run(true)], 'a', 5), null);
});

test('AC-e06s04-13 only the exact command is counted', () => {
  const entries = [...fails(3, 'b'), ...fails(3, 'a'), ...fails(3, 'b')];
  assert.equal(checkCeiling(entries, 'a', 5), null);
  assert.equal(checkCeiling(entries, 'b', 5)?.count, 6);
});
