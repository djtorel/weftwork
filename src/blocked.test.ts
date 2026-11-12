// story: e06s04
// The blocked state (e06s04 AC-24 to AC-26): the worker says it cannot go
// on, and why. The engine logs it, does not run the command, and never gives
// done.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { runEngine } from './engine.ts';
import { appendEntry, ledgerPath } from './ledger.ts';
import { cleanupTempDirs, makeTempDir, makeTestRepo, readRepoLedger, readRepoStates } from './test-helpers.ts';

after(cleanupTempDirs);

test('AC-e06s04-24 blocked is answered and logged, and the command does not run', async () => {
  const repo = makeTestRepo();
  const marker = join(makeTempDir(), 'ran');
  const answer = await runEngine({
    command: `touch "${marker}"`,
    cwd: repo,
    blocked: 'need the API key',
  });
  assert.equal(answer.state, 'blocked');
  assert.equal(answer.done, false);
  assert.equal(answer.reason, 'not-run');
  assert.equal(answer.exitCode, null);
  assert.equal(answer.detail, 'need the API key');
  assert.equal(existsSync(marker), false);
  assert.equal((await readRepoLedger(repo)).entries.length, 0);
  const lines = await readRepoStates(repo);
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.state, 'blocked');
  assert.equal(lines[0]?.detail, 'need the API key');
  assert.equal(lines[0]?.runs, 0);
  assert.equal(lines[0]?.threshold, null);
});

test('AC-e06s04-25 blocked never gives done, even for a command that passes', async () => {
  const answer = await runEngine({ command: 'true', cwd: makeTestRepo(), blocked: 'x' });
  assert.equal(answer.done, false);
  assert.equal(answer.state, 'blocked');
});

test('AC-e06s04-26 exhausted outranks blocked', async () => {
  const repo = makeTestRepo();
  const path = (await ledgerPath(repo)) as string;
  for (let i = 0; i < 5; i += 1) {
    await appendEntry(
      path,
      { done: false, exitCode: 1, reason: 'exit-nonzero', command: 'check', fingerprint: `F${i}` },
      new Date(),
    );
  }
  const answer = await runEngine({ command: 'check', cwd: repo, blocked: 'stuck' });
  assert.equal(answer.state, 'exhausted');
});
