// story: e07s02
// The real Claude Code hook CLI under signals and its own deadline (e07s02
// AC-09, AC-12 and AC-13): a signal kills the command and blocks, a hook whose
// work cannot be aborted still ends in exit 2, and a run that finishes in time
// is not cut off. Work that cannot be aborted is a stub `git` that hangs.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { signalGraceMs } from './claude-hook.ts';
import {
  cliEnv,
  killIfAlive,
  startCli,
  startSleeper,
  stopInput,
  stopStub,
  stuckGitEnv,
} from './hook-cli-test-helpers.ts';
import { cleanupTempDirs, makeTestRepo, waitForFile, waitUntilGone } from './test-helpers.ts';

after(cleanupTempDirs);

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  test(`AC-e07s02-09 ${signal} kills the command and blocks`, async () => {
    const { child, result, pid } = await startSleeper(cliEnv(makeTestRepo()));
    try {
      child.kill(signal);
      const out = await result;
      assert.equal(out.timedOut, false);
      assert.equal(out.status, 2);
      assert.equal(out.stdout, '');
      assert.match(out.stderr, /terminated before it could check/);
      assert.ok(await waitUntilGone(pid, 5000), 'the command is gone');
    } finally {
      killIfAlive(pid);
    }
  });
}

test('AC-e07s02-09 SIGTERM while the CLI waits for input blocks at once', async () => {
  const repo = makeTestRepo();
  const { child, result } = startCli(['--', 'touch ran.txt'], cliEnv(repo), 15000);
  child.stdin.write('{"hook_event_name":"Stop"');
  await new Promise((resolve) => setTimeout(resolve, 1000)); // let the CLI start
  const sent = Date.now();
  child.kill('SIGTERM');
  const out = await result;
  assert.equal(out.timedOut, false);
  assert.equal(out.status, 2);
  assert.match(out.stderr, /terminated before it could check/);
  assert.equal(existsSync(join(repo, 'ran.txt')), false);
  // Without releasing stdin, the wait would run on until the grace timer leaves
  // at `signalGraceMs`. A normal exit takes tens of milliseconds, so a bound at
  // three quarters of the grace period tells the two apart with room for load.
  assert.ok(Date.now() - sent < signalGraceMs * 0.75, 'the wait for input ended at once');
});

test('AC-e07s02-12 a hook whose work cannot be aborted blocks at its own deadline', async () => {
  const repo = makeTestRepo();
  const { env, pidFile } = stuckGitEnv(repo);
  const started = Date.now();
  const { child, result } = startCli(['--', 'true'], { ...env, WEFTWORK_HOOK_DEADLINE_MS: '1500' }, 20000);
  child.stdin.end(stopInput(repo));
  try {
    const out = await result;
    assert.equal(out.timedOut, false);
    assert.equal(out.status, 2);
    assert.equal(out.stdout, '');
    assert.match(out.stderr, /ran out of time before it could check/);
    assert.ok(Date.now() - started < 8000, 'it did not wait for the host');
  } finally {
    stopStub(pidFile);
  }
});

test('AC-e07s02-12 a command that outlives the deadline is killed, and the hook blocks', async () => {
  const env = { ...cliEnv(makeTestRepo()), WEFTWORK_HOOK_DEADLINE_MS: '1500' };
  const { result, pid } = await startSleeper(env);
  try {
    const out = await result;
    assert.equal(out.timedOut, false);
    assert.equal(out.status, 2);
    assert.match(out.stderr, /ran out of time before it could check/);
    assert.ok(await waitUntilGone(pid, 5000), 'the command is gone');
  } finally {
    killIfAlive(pid);
  }
});

test('AC-e07s02-12 a run that finishes in time is not cut off, and the deadline holds nothing open', async () => {
  const repo = makeTestRepo();
  const env = { ...cliEnv(repo), WEFTWORK_HOOK_DEADLINE_MS: '20000' };
  const started = Date.now();
  const { child, result } = startCli(['--', 'true'], env, 20000);
  child.stdin.end(stopInput(repo));
  const out = await result;
  assert.equal(out.status, 0);
  assert.ok(Date.now() - started < 10000, 'the armed timer did not keep the process alive');
});

test('AC-e07s02-13 SIGTERM ends in exit 2 even when the work cannot be aborted', async () => {
  const repo = makeTestRepo();
  const { env, pidFile } = stuckGitEnv(repo);
  const { child, result } = startCli(['--', 'true'], env, 20000);
  child.stdin.end(stopInput(repo));
  try {
    assert.ok(await waitForFile(pidFile, 10000), 'the engine is stuck on git');
    const sent = Date.now();
    child.kill('SIGTERM');
    const out = await result;
    assert.equal(out.timedOut, false);
    assert.equal(out.status, 2);
    assert.match(out.stderr, /terminated before it could check/);
    assert.ok(Date.now() - sent < 6000, 'it left within the grace period');
  } finally {
    stopStub(pidFile);
  }
});

test('AC-e07s02-13 a second signal right after the first still ends in exit 2', async () => {
  const { child, result, pid } = await startSleeper(cliEnv(makeTestRepo()));
  try {
    child.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 5));
    child.kill('SIGTERM');
    const out = await result;
    assert.equal(out.timedOut, false);
    assert.equal(out.status, 2, 'a second SIGTERM must not fall back to the default action');
    assert.match(out.stderr, /terminated before it could check/);
    assert.ok(await waitUntilGone(pid, 5000), 'the command is gone');
  } finally {
    killIfAlive(pid);
  }
});
