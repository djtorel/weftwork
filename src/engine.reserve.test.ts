// story: e09s03
// The handover reserve in the engine (e09s03 AC-02, AC-06, AC-08, AC-09): a
// failed run within the reserve tells the agent to write the handoff now;
// every other answer is as before. Every command runs in a temporary git
// repository.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { runEngine } from './engine.ts';
import { cleanupTempDirs, makeTestRepo, readRepoStates, seedLedger } from './test-helpers.ts';

after(cleanupTempDirs);

const handoffCli = join(import.meta.dirname, 'handoff-cli.ts');

test('AC-e09s03-06 the failed run that leaves 1 run under maxRuns 4 carries the handoff detail', async () => {
  const repo = makeTestRepo();
  await seedLedger(repo, ['a', 'b']);
  const answer = await runEngine({ command: 'exit 3', cwd: repo, maxRuns: 4 });
  assert.equal(answer.state, 'failed');
  assert.match(answer.detail ?? '', /3 runs since the last done, 1 left before the loop ceiling of 4/);
  const command = `node ${JSON.stringify(handoffCli)} (JSON on stdin: next_skill, branch, note)`;
  assert.ok((answer.detail ?? '').endsWith(command), answer.detail ?? 'no detail');
  assert.deepEqual(await readRepoStates(repo), [], 'a failed answer still logs no state line');
});

test('AC-e09s03-06 a failed run outside the reserve has no detail', async () => {
  const repo = makeTestRepo();
  await seedLedger(repo, ['a']);
  const answer = await runEngine({ command: 'exit 2', cwd: repo, maxRuns: 4 });
  assert.equal(answer.state, 'failed');
  assert.equal('detail' in answer, false);
});

test('AC-e09s03-02 a reserveRuns above the ceiling is clamped to maxRuns - 1', async () => {
  const repo = makeTestRepo();
  const answer = await runEngine({ command: 'exit 1', cwd: repo, maxRuns: 4, reserveRuns: 9 });
  assert.match(answer.detail ?? '', /1 runs since the last done, 3 left before the loop ceiling of 4/);
});

test('AC-e09s03-08 with no maxRuns, or reserveRuns 0, a failed run has no detail', async () => {
  const repo = makeTestRepo();
  await seedLedger(repo, ['a', 'b']);
  assert.equal('detail' in (await runEngine({ command: 'exit 3', cwd: repo })), false);
  const other = makeTestRepo();
  await seedLedger(other, ['a', 'b']);
  const off = await runEngine({ command: 'exit 3', cwd: other, maxRuns: 4, reserveRuns: 0 });
  assert.equal(off.state, 'failed');
  assert.equal('detail' in off, false);
});

test('AC-e09s03-09 the failure ceiling in the reserve window keeps its own detail', async () => {
  const repo = makeTestRepo();
  await seedLedger(repo, ['exit 7', 'exit 7']);
  const answer = await runEngine({ command: 'exit 7', cwd: repo, maxFailures: 3, maxRuns: 4 });
  assert.equal(answer.state, 'exhausted');
  assert.match(answer.detail ?? '', /3 failed runs in a row, the ceiling is 3/);
  assert.doesNotMatch(answer.detail ?? '', /handoff/);
});

test('AC-e09s03-09 a run in the reserve window that passes is done, with no detail', async () => {
  const repo = makeTestRepo();
  await seedLedger(repo, ['a', 'b']);
  const answer = await runEngine({ command: 'true', cwd: repo, maxRuns: 4 });
  assert.equal(answer.state, 'done');
  assert.equal('detail' in answer, false);
});
