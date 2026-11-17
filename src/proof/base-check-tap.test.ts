// story: e13s04
// The TAP reading of the base check (base-check-tap.ts): the leaf tests of a
// TAP run and whether each passed, so one weak new test in a file is seen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tapTests } from './base-check-tap.ts';

// What `node --test --test-reporter=tap` prints (Node 26), cut short.
const nodeTap = `TAP version 13
# Subtest: strong \\# one
not ok 1 - strong \\# one
  ---
  duration_ms: 0.62
  stack: |-
    ok 9 - not a test point
  ...
# Subtest: weak
ok 2 - weak
# Subtest: group
    # Subtest: inner
    ok 1 - inner
    1..1
ok 3 - group
# Subtest: skipped
ok 4 - skipped # SKIP
ok 5 - later # TODO not yet
1..5
# pass 2
`;

test('TAP: leaf tests with their outcome; suites, SKIP, TODO and YAML blocks are left out', () => {
  assert.deepEqual(tapTests(nodeTap), [
    { name: 'strong # one', passed: false },
    { name: 'weak', passed: true },
    { name: 'inner', passed: true },
  ]);
});

test('output that is not TAP: null, so the file keeps one outcome', () => {
  assert.equal(tapTests('✔ weak (0.15ms)\nok then\n'), null);
  assert.equal(tapTests(''), null);
});

test('TAP with only a plan line (no version line) is still TAP', () => {
  assert.deepEqual(tapTests('1..1\nok 1 - only\n'), [{ name: 'only', passed: true }]);
});
