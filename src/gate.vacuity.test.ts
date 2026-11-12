// story: e06s02
// Anti-vacuity (e06s02 AC-13). A gate that cannot fail is vacuous, so each
// held-out fixture runs through runGate in a temporary git repository: the
// passing one must be accepted and every failing one rejected, with its
// own reason. Output is never read, so a script that prints "all tests
// passed" and exits 1 must still fail.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { runGate } from './gate.ts';
import { cleanupTempDirs, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const fixtures = join(import.meta.dirname, 'fixtures');

const cases: ReadonlyArray<{ fixture: string; done: boolean; reason: string }> = [
  { fixture: 'pass.sh', done: true, reason: 'passed' },
  { fixture: 'exit1.sh', done: false, reason: 'exit-nonzero' },
  { fixture: 'lies.sh', done: false, reason: 'exit-nonzero' },
  { fixture: 'edits.sh', done: false, reason: 'tree-changed' },
];

for (const { fixture, done, reason } of cases) {
  test(`AC-e06s02-13 ${fixture} is ${done ? 'accepted' : 'rejected'} as ${reason}`, async () => {
    const command = `sh "${join(fixtures, fixture)}"`;
    const verdict = await runGate({ command, cwd: makeTestRepo() });
    assert.equal(verdict.reason, reason);
    assert.equal(verdict.done, done);
  });
}
