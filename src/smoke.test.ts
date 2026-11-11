// Smoke test: proves the compiler and the test runner run (e05s02).
// e06 replaces this file with real engine tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passed } from './smoke.ts';

test('passed is true only for exit code 0', () => {
  assert.equal(passed(0), true);
  assert.equal(passed(1), false);
});
