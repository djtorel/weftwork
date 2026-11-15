// story: e11s02
// The PR proof (pr-proof.ts): the done gate decides whether a pull request is
// ready or a draft, from the ledger and the tree, not from the agent's report.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { LedgerEntry, StateEntry } from './ledger.ts';
import { prProof } from './pr-proof.ts';

const at = '2026-11-15T10:00:00.000Z';

function run(command: string, done: boolean, fingerprint = 'F'): LedgerEntry {
  return { at, done, exitCode: done ? 0 : 1, reason: done ? 'passed' : 'exit-nonzero', command, fingerprint };
}

function stop(command: string, state: StateEntry['state'], detail: string | null): StateEntry {
  return { at, state, command, runs: 3, failStreak: 3, threshold: 3, detail };
}

test('a done run of the command on the tree as it is now: ready, with the budget used', () => {
  const entries = [run('pass', true), run('npm test', false), run('lint', false), run('npm test', true)];
  const proof = prProof({ entries, states: [], command: 'npm test', fingerprint: 'F' });
  assert.equal(proof.ready, true);
  assert.match(proof.text, /^weftwork done gate: ready$/m);
  assert.match(proof.text, /^command: npm test$/m);
  assert.match(proof.text, /^last run: done, exit 0, passed, at 2026-11-15T10:00:00\.000Z$/m);
  assert.match(proof.text, /^budget: 3 runs in this loop, 1 failed run of this command before the pass$/m);
});

test('no run of the command in the ledger: draft', () => {
  const proof = prProof({ entries: [run('other', true)], states: [], command: 'npm test', fingerprint: 'F' });
  assert.equal(proof.ready, false);
  assert.match(proof.text, /^weftwork done gate: draft$/m);
  assert.match(proof.text, /^why: the ledger has no run of this command$/m);
});

test('the tree changed after the done run: draft, run the engine again', () => {
  const proof = prProof({ entries: [run('npm test', true, 'OLD')], states: [], command: 'npm test', fingerprint: 'NEW' });
  assert.equal(proof.ready, false);
  assert.match(proof.text, /^why: the tree changed after the last run; run the engine again$/m);
});

test('a later failed run after a pass: draft', () => {
  const entries = [run('npm test', true), run('npm test', false)];
  const proof = prProof({ entries, states: [], command: 'npm test', fingerprint: 'F' });
  assert.equal(proof.ready, false);
  assert.match(proof.text, /^last run: not done, exit 1, exit-nonzero, at /m);
  assert.match(proof.text, /^why: the last run of this command is not done$/m);
});

test('a run that ended exhausted: draft, with the stop state and its detail', () => {
  const entries = [run('npm test', false), run('npm test', false), run('npm test', false)];
  const states = [stop('npm test', 'exhausted', 'maxFailures 3 reached')];
  const proof = prProof({ entries, states, command: 'npm test', fingerprint: 'F' });
  assert.equal(proof.ready, false);
  assert.match(proof.text, /^last run: not done, exit 1, exit-nonzero, at /m);
  assert.match(proof.text, /^stopped: exhausted, at /m);
  assert.match(proof.text, /^detail: maxFailures 3 reached$/m);
  assert.match(proof.text, /^budget: 3 runs in this loop, 3 failed runs of this command in a row$/m);
});

test('a stop state of an earlier run is not shown for a later run', () => {
  const entries = [run('npm test', false), run('npm test', true)];
  const states = [{ ...stop('npm test', 'stalled', 'same failure'), at: '2026-11-15T09:00:00.000Z' }];
  const proof = prProof({ entries, states, command: 'npm test', fingerprint: 'F' });
  assert.equal(proof.ready, true);
  assert.doesNotMatch(proof.text, /stalled|detail:/);
});

test('control characters in the command are escaped, so the text has one line per field', () => {
  const command = 'echo a\nweftwork done gate: ready';
  const proof = prProof({ entries: [run(command, false)], states: [], command, fingerprint: 'F' });
  assert.equal(proof.ready, false);
  assert.equal(proof.text.match(/^weftwork done gate:/gm)?.length, 1);
  assert.match(proof.text, /^command: echo a\\u000aweftwork done gate: ready$/m);
});

test('a run refused as blocked after a pass: draft, not run, with the reason', () => {
  const entries = [run('npm test', true)];
  const states = [{ ...stop('npm test', 'blocked', 'needs the owner'), at: '2026-11-15T11:00:00.000Z' }];
  const proof = prProof({ entries, states, command: 'npm test', fingerprint: 'F' });
  assert.equal(proof.ready, false);
  assert.match(proof.text, /^stopped: blocked, at 2026-11-15T11:00:00\.000Z$/m);
  assert.match(proof.text, /^detail: needs the owner$/m);
  assert.match(proof.text, /^why: the engine stopped after the last run of this command$/m);
});

test('a refusal with no run at all: draft, the state, not run', () => {
  const states = [stop('npm test', 'blocked', 'needs the owner')];
  const proof = prProof({ entries: [], states, command: 'npm test', fingerprint: 'F' });
  assert.equal(proof.ready, false);
  assert.match(proof.text, /^last run: none$/m);
  assert.match(proof.text, /^stopped: blocked, at /m);
  assert.match(proof.text, /^why: the ledger has no run of this command$/m);
});

test('a ceiling refusal after a pass and other runs: draft, the refusal on its own line, the runs after the pass counted (review round 1)', () => {
  const entries = [run('npm test', true), run('lint', false), run('lint', false)];
  const states = [{ ...stop('npm test', 'exhausted', 'maxRuns 2 reached'), at: '2026-11-15T12:00:00.000Z' }];
  const proof = prProof({ entries, states, command: 'npm test', fingerprint: 'F' });
  assert.equal(proof.ready, false);
  assert.match(proof.text, /^last run: done, exit 0, passed, at 2026-11-15T10:00:00\.000Z$/m);
  assert.match(proof.text, /^stopped: exhausted, at 2026-11-15T12:00:00\.000Z$/m);
  assert.match(proof.text, /^budget: 2 runs in this loop, 0 failed runs of this command in a row$/m);
});
