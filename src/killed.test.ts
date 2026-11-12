// story: e06s04
// An abort stops the command and its children (e06s04 AC-16, AC-17;
// threat model C7). Every command runs in a temporary git repository.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runGate } from './gate.ts';
import {
  cleanupTempDirs,
  makeTempDir,
  makeTestRepo,
  readRepoLedger,
  waitForFile,
  waitUntilGone,
} from './test-helpers.ts';

after(cleanupTempDirs);

test('AC-e06s04-16 an abort stops the command and its children', { timeout: 15000 }, async () => {
  const repo = makeTestRepo();
  const pidFile = join(makeTempDir(), 'pid');
  const controller = new AbortController();
  const running = runGate(
    { command: `sleep 30 & echo $! > "${pidFile}"; wait`, cwd: repo },
    controller.signal,
  );
  assert.ok(await waitForFile(pidFile, 5000), 'the command started');
  controller.abort();
  const verdict = await running;
  assert.equal(verdict.done, false);
  assert.equal(verdict.reason, 'killed');
  assert.equal(verdict.exitCode, null);
  const pid = Number(readFileSync(pidFile, 'utf8'));
  assert.ok(await waitUntilGone(pid, 2000), 'the background process is gone');
  const ledger = await readRepoLedger(repo);
  assert.deepEqual(
    ledger.entries.map((entry) => entry.reason),
    ['killed'],
  );
});

test('AC-e06s04-17 an aborted signal means the command does not run', async () => {
  const repo = makeTestRepo();
  const verdict = await runGate({ command: 'touch ran', cwd: repo }, AbortSignal.abort());
  assert.equal(verdict.done, false);
  assert.equal(verdict.reason, 'killed');
  assert.equal(existsSync(join(repo, 'ran')), false);
});

test('AC-e06s04-16 a signal that never aborts changes nothing', async () => {
  const verdict = await runGate(
    { command: 'true', cwd: makeTestRepo() },
    new AbortController().signal,
  );
  assert.equal(verdict.done, true);
  assert.equal(verdict.reason, 'passed');
});

test('AC-e06s04-16 an abort after the command ended leaves the verdict', async () => {
  const controller = new AbortController();
  const verdict = await runGate({ command: 'true', cwd: makeTestRepo() }, controller.signal);
  controller.abort();
  assert.equal(verdict.reason, 'passed');
});
