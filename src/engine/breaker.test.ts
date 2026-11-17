// story: e06s04
// The stall rule (e06s04 AC-09 to AC-12): it must trip on a stuck run and
// stay quiet when anything that can move has moved (R15 [S14]). It runs on
// arrays of ledger entries, with no process and no repository.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkStall } from './breaker.ts';
import type { LedgerEntry } from './ledger.ts';

type Over = Partial<LedgerEntry>;

function run(over: Over = {}): LedgerEntry {
  return {
    at: '2026-11-12T03:00:00.000Z',
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

test('AC-e06s04-09 three identical failed runs on one tree are stalled', () => {
  assert.deepEqual(checkStall([run(), run(), run()], 'a', 3), {
    state: 'stalled',
    threshold: 3,
    count: 3,
  });
});

test('AC-e06s04-09 older runs before the stuck ones do not matter', () => {
  const entries = [run({ fingerprint: 'Z' }), run(), run(), run()];
  assert.equal(checkStall(entries, 'a', 3)?.state, 'stalled');
});

const quiet: ReadonlyArray<[string, LedgerEntry[]]> = [
  ['only two failed runs on one tree', [run(), run()]],
  ['the fingerprint of the last differs', [run(), run(), run({ fingerprint: 'B' })]],
  ['the fingerprint of the first differs', [run({ fingerprint: 'B' }), run(), run()]],
  ['one has another reason', [run(), run({ reason: 'timeout', exitCode: null }), run()]],
  ['one has another exit code', [run(), run({ exitCode: 8 }), run()]],
  ['all have a null fingerprint', Array.from({ length: 3 }, () => run({ fingerprint: null }))],
  ['a pass ends the count', [run(), pass(), run(), run()]],
  ['two failed runs, a pass, one failed run', [run(), run(), pass(), run()]],
  ['no entries at all', []],
];

for (const [name, entries] of quiet) {
  test(`AC-e06s04-10 the stall rule stays quiet: ${name}`, () => {
    assert.equal(checkStall(entries, 'a', 3), null);
  });
}

test('AC-e06s04-10 runs of another command neither trip nor break the count', () => {
  const other = run({ command: 'b' });
  assert.equal(checkStall([run(), other, run(), other, run()], 'a', 3)?.state, 'stalled');
  assert.equal(checkStall([other, other, other], 'a', 3), null);
});

test('AC-e06s04-11 the rule follows the tree', () => {
  const onB = () => run({ fingerprint: 'B' });
  const entries = [run(), run(), onB(), onB()];
  assert.equal(checkStall(entries, 'a', 3), null);
  assert.deepEqual(checkStall([...entries, onB()], 'a', 3), {
    state: 'stalled',
    threshold: 3,
    count: 3,
  });
});

test('AC-e06s04-12 the threshold is an input', () => {
  const entries = [run(), run()];
  assert.equal(checkStall(entries, 'a', 2)?.threshold, 2);
  assert.equal(checkStall(entries, 'a', 3), null);
});
