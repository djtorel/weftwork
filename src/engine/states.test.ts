// story: e06s04
// The terminal states and their exit codes (e06s04 AC-01, AC-02).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badInputExitCode, exitCodes, terminalStates, type State } from './states.ts';

test('AC-e06s04-01 the table maps each state to its code', () => {
  assert.deepEqual(exitCodes, {
    done: 0,
    failed: 1,
    blocked: 3,
    stalled: 4,
    exhausted: 5,
    killed: 6,
    overridden: 7,
  });
  assert.equal(badInputExitCode, 2);
});

test('AC-e06s04-01 only done maps to 0', () => {
  for (const [state, code] of Object.entries(exitCodes)) {
    assert.equal(code === 0, state === 'done', `${state} -> ${code}`);
  }
  assert.notEqual(badInputExitCode, 0);
});

// story: e06s05 (was "the seven codes"; overridden adds an eighth)
test('AC-e06s05-01 the eight codes are all different', () => {
  const codes = [...Object.values(exitCodes), badInputExitCode];
  assert.equal(codes.length, 8);
  assert.equal(new Set(codes).size, 8);
});

test('AC-e06s04-02 the terminal states are the five, and failed is not one', () => {
  assert.deepEqual([...terminalStates], ['done', 'blocked', 'stalled', 'exhausted', 'killed']);
  const failed: State = 'failed';
  assert.ok(!(terminalStates as readonly string[]).includes(failed));
});
