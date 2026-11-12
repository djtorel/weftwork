// story: e07s02
// The real Claude Code hook CLI under faults of its own (e07s02 AC-03 to
// AC-05 and AC-07 to AC-10): input that is too large, never ends or is empty,
// a project directory with no git tree, a command that cannot run, a signal,
// and a bad argument list with stdin left open. Each must end in exit 2. The
// CLI runs as an async child so stdin can stay open and signals can be sent.
// Every case uses a temporary directory, never this repository's ledger.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cleanupTempDirs,
  isAlive,
  makeTempDir,
  makeTestRepo,
  waitForFile,
  waitUntilGone,
} from './test-helpers.ts';

after(cleanupTempDirs);

const cliPath = join(import.meta.dirname, 'claude-hook-cli.ts');

type CliResult = {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

/** Start the CLI from a directory that is not the repository. The caller owns
 * stdin. After `limitMs` the child is killed and `timedOut` is set, so a hang
 * fails the test instead of stalling the run. */
function startCli(args: string[], project: string | null, limitMs: number) {
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  if (project !== null) {
    env.CLAUDE_PROJECT_DIR = project;
  }
  const child = spawn(process.execPath, [cliPath, ...args], { cwd: makeTempDir(), env });
  // The child may exit before it reads all of a large input.
  child.stdin.on('error', () => {});
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
  const result = new Promise<CliResult>((resolve) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, limitMs);
    child.on('error', () => {});
    child.on('close', (status, signal) => {
      clearTimeout(timer);
      resolve({ status, signal, stdout, stderr, timedOut });
    });
  });
  return { child, result };
}

/** The Stop input the host sends. */
function stopInput(cwd: string): string {
  return JSON.stringify({ hook_event_name: 'Stop', cwd, stop_hook_active: false });
}

test('AC-e07s02-03 input over 1 MiB blocks, and the command never runs', async () => {
  const repo = makeTestRepo();
  const { child, result } = startCli(['--', 'touch ran.txt'], repo, 20000);
  child.stdin.end(Buffer.alloc(2 * 1024 * 1024, 'x'));
  const out = await result;
  assert.equal(out.timedOut, false);
  assert.equal(out.status, 2);
  assert.equal(out.stdout, '');
  assert.match(out.stderr, /too large/);
  assert.equal(existsSync(join(repo, 'ran.txt')), false);
});

test('AC-e07s02-04 a host that never closes stdin blocks at the deadline', { timeout: 40000 }, async () => {
  const repo = makeTestRepo();
  const { child, result } = startCli(['--', 'touch ran.txt'], repo, 25000);
  child.stdin.write('{"hook_event_name":"Stop"');
  const out = await result;
  assert.equal(out.timedOut, false);
  assert.equal(out.status, 2);
  assert.equal(out.stdout, '');
  assert.match(out.stderr, /did not end/);
  assert.equal(existsSync(join(repo, 'ran.txt')), false);
});

test('AC-e07s02-05 empty input blocks', async () => {
  const repo = makeTestRepo();
  const { child, result } = startCli(['--', 'true'], repo, 20000);
  child.stdin.end();
  const out = await result;
  assert.equal(out.status, 2);
  assert.equal(out.stdout, '');
  assert.match(out.stderr, /unreadable hook input/);
});

test('AC-e07s02-07 a project directory that is not a git tree blocks and says weftwork could not check', async () => {
  const dir = makeTempDir();
  const { child, result } = startCli(['--', 'true'], dir, 20000);
  child.stdin.end(stopInput(dir));
  const out = await result;
  assert.equal(out.status, 2);
  assert.equal(out.stdout, '');
  assert.match(out.stderr, /could not check/);
});

test('AC-e07s02-08 a declared command that cannot run blocks', async () => {
  const repo = makeTestRepo();
  const { child, result } = startCli(['--', 'no-such-command-e07s02'], repo, 20000);
  child.stdin.end(stopInput(repo));
  const out = await result;
  assert.equal(out.status, 2);
  assert.equal(out.stdout, '');
  assert.match(out.stderr, /not done \(failed/);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  test(`AC-e07s02-09 ${signal} kills the command and blocks`, async () => {
    const repo = makeTestRepo();
    const pidFile = join(makeTempDir(), 'pid');
    // `exec` makes the shell's pid the pid of the sleep, so the file names it.
    const { child, result } = startCli(['--', `echo $$ > ${pidFile} && exec sleep 60`], repo, 30000);
    child.stdin.end(stopInput(repo));
    assert.ok(await waitForFile(pidFile, 15000), 'the command started');
    const pid = Number(readFileSync(pidFile, 'utf8').trim());
    try {
      child.kill(signal);
      const out = await result;
      assert.equal(out.timedOut, false);
      assert.equal(out.status, 2);
      assert.equal(out.stdout, '');
      assert.match(out.stderr, /terminated before it could check/);
      assert.ok(await waitUntilGone(pid, 5000), 'the command is gone');
    } finally {
      if (isAlive(pid)) {
        process.kill(pid, 'SIGKILL');
      }
    }
  });
}

test('AC-e07s02-09 SIGTERM while the CLI waits for input blocks at once', async () => {
  const repo = makeTestRepo();
  const { child, result } = startCli(['--', 'touch ran.txt'], repo, 15000);
  child.stdin.write('{"hook_event_name":"Stop"');
  await new Promise((resolve) => setTimeout(resolve, 1000)); // let the CLI start
  child.kill('SIGTERM');
  const out = await result;
  assert.equal(out.timedOut, false);
  assert.equal(out.status, 2);
  assert.match(out.stderr, /terminated before it could check/);
  assert.equal(existsSync(join(repo, 'ran.txt')), false);
});

test('AC-e07s02-10 a bad argument list blocks without reading stdin', async () => {
  const repo = makeTestRepo();
  for (const args of [[], ['--'], ['--', 'true', 'extra']]) {
    const started = Date.now();
    const { child, result } = startCli(args, repo, 8000);
    child.stdin.write('{"hook_event_name":"Stop"'); // stdin stays open
    const out = await result;
    assert.equal(out.timedOut, false, args.join(' '));
    assert.equal(out.status, 2, args.join(' '));
    assert.match(out.stderr, /usage/);
    assert.ok(Date.now() - started < 5000, 'it did not wait for stdin');
  }
});
