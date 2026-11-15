// story: e09s04
// Every engine answer carries `budget`: the runs since the last done and the
// failures in a row of this command, counted from the ledger, with the limits
// in force (docs/BUDGET.md, The budget report). Every command runs in a
// temporary git repository. Only process.stderr is mocked.
import { after, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { runEngine } from './engine.ts';
import { ledgerPath } from './ledger.ts';
import { cleanupTempDirs, makeTempDir, makeTestRepo, seedLedger } from './test-helpers.ts';

after(cleanupTempDirs);

async function quietly<T>(body: () => Promise<T>): Promise<T> {
  const write = mock.method(process.stderr, 'write', () => true);
  try {
    return await body();
  } finally {
    write.mock.restore();
  }
}

test('AC-e09s04-01 a failed run reports its runs and failures with the built-in failure ceiling', async () => {
  const repo = makeTestRepo();
  await runEngine({ command: 'exit 1', cwd: repo });
  const answer = await runEngine({ command: 'exit 2', cwd: repo });
  assert.equal(answer.state, 'failed');
  assert.deepEqual(answer.budget, { runs: 2, maxRuns: null, failures: 1, maxFailures: 5 });
});

test('AC-e09s04-02 a done run opens a new loop: 0 runs and 0 failures', async () => {
  const repo = makeTestRepo();
  await runEngine({ command: 'exit 1', cwd: repo });
  const answer = await runEngine({ command: 'true', cwd: repo, maxRuns: 9, maxFailures: 4 });
  assert.equal(answer.state, 'done');
  assert.deepEqual(answer.budget, { runs: 0, maxRuns: 9, failures: 0, maxFailures: 4 });
});

test('AC-e09s04-03 a refused call reports the counts that refused it and adds no run', async () => {
  const repo = makeTestRepo();
  await seedLedger(repo, ['exit 1', 'exit 1']);
  const answer = await runEngine({ command: 'exit 1', cwd: repo, maxRuns: 2 });
  assert.equal(answer.state, 'exhausted');
  assert.deepEqual(answer.budget, { runs: 2, maxRuns: 2, failures: 2, maxFailures: 5 });
  const blocked = await runEngine({ command: 'true', cwd: repo, blocked: 'need the owner', maxRuns: 5 });
  assert.equal(blocked.state, 'blocked');
  assert.deepEqual(blocked.budget, { runs: 2, maxRuns: 5, failures: 0, maxFailures: 5 });
});

test('AC-e09s04-04 a ledger that cannot be read gives null counts, not zero', async () => {
  const repo = makeTestRepo();
  mkdirSync(join((await ledgerPath(repo)) as string), { recursive: true });
  const answer = await quietly(() => runEngine({ command: 'exit 1', cwd: repo }));
  assert.equal(answer.state, 'failed');
  assert.deepEqual(answer.budget, { runs: null, maxRuns: null, failures: null, maxFailures: 5 });
});

test('AC-e09s04-05 outside a git repository there is no ledger, so the counts are null', async () => {
  const answer = await quietly(() => runEngine({ command: 'true', cwd: makeTempDir() }));
  assert.equal(answer.state, 'failed');
  assert.deepEqual(answer.budget, { runs: null, maxRuns: null, failures: null, maxFailures: 5 });
});
