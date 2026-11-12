// story: e07s02
// Shared by the hook CLI's process tests: start the real CLI as a child, with
// its environment, stdin and time limit under the test's control. Every helper
// uses temporary directories, never this repository's ledger.
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import type { Readable } from 'node:stream';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isAlive, makeTempDir, makeTestRepo, waitForFile } from './test-helpers.ts';

export const cliPath = join(import.meta.dirname, 'claude-hook-cli.ts');

export type CliResult = {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

/** The CLI's environment: only `project` can say where the command runs. */
export function cliEnv(project: string | null): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  if (project !== null) {
    env.CLAUDE_PROJECT_DIR = project;
  }
  return env;
}

/** Everything the stream has emitted so far, as text, read through a getter. */
function textOf(stream: Readable): () => string {
  let text = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk: string) => (text += chunk));
  return () => text;
}

/** Resolve when the child closes. After `limitMs` it is killed and `timedOut`
 * is set, so a hang fails the test instead of stalling the run. */
function waitForClose(child: ChildProcess, limitMs: number) {
  return new Promise<Pick<CliResult, 'status' | 'signal' | 'timedOut'>>((resolve) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, limitMs);
    child.on('error', () => {});
    child.on('close', (status, signal) => {
      clearTimeout(timer);
      resolve({ status, signal, timedOut });
    });
  });
}

/** Start the CLI from a directory that is not the repository, with `env` as its
 * whole environment. The caller owns stdin. */
export function startCli(args: string[], env: NodeJS.ProcessEnv, limitMs: number) {
  const cwd = makeTempDir();
  const child = spawn(process.execPath, [cliPath, ...args], { cwd, env });
  child.stdin.on('error', () => {}); // the child may exit before it reads a large input
  const stdout = textOf(child.stdout);
  const stderr = textOf(child.stderr);
  const result = waitForClose(child, limitMs).then((end) => ({ ...end, stdout: stdout(), stderr: stderr() }));
  return { child, result };
}

/** The Stop input the host sends. */
export function stopInput(cwd: string): string {
  return JSON.stringify({ hook_event_name: 'Stop', cwd, stop_hook_active: false });
}

/** Kill `pid` if it is still there: a test must not leave its command running. */
export function killIfAlive(pid: number): void {
  if (isAlive(pid)) {
    process.kill(pid, 'SIGKILL');
  }
}

/** Start the CLI on a command that records its pid and becomes a 60 s sleep,
 * and wait until it runs. */
export async function startSleeper(env: NodeJS.ProcessEnv) {
  const repo = env.CLAUDE_PROJECT_DIR ?? '';
  const pidFile = join(makeTempDir(), 'pid');
  // `exec` makes the shell's pid the pid of the sleep, so the file names it.
  const started = startCli(['--', `echo $$ > ${pidFile} && exec sleep 60`], env, 30000);
  started.child.stdin.end(stopInput(repo));
  assert.ok(await waitForFile(pidFile, 15000), 'the command started');
  return { ...started, pid: Number(readFileSync(pidFile, 'utf8').trim()) };
}

/** A repository whose ledger path is a FIFO (BUG-007). */
export function makeFifoLedgerRepo(): string {
  const repo = makeTestRepo();
  const dir = join(repo, '.git', 'weftwork');
  mkdirSync(dir, { recursive: true });
  execFileSync('mkfifo', [join(dir, 'ledger.jsonl')]);
  return repo;
}

/** An environment whose `git` hangs: a stub first on PATH that records its pid
 * and becomes a 60 s sleep. The engine's git calls take no abort signal, so
 * this is work the hook cannot abort. `pidFile` names the stub once it runs. */
export function stuckGitEnv(repo: string) {
  const bin = makeTempDir();
  const pidFile = join(bin, 'git.pid');
  writeFileSync(join(bin, 'git'), `#!/bin/sh\necho $$ > ${pidFile}\nexec sleep 60\n`, { mode: 0o755 });
  return { env: { ...cliEnv(repo), PATH: `${bin}:${process.env.PATH}` }, pidFile };
}

/** Kill the stub git, if it started and is still there. */
export function stopStub(pidFile: string): void {
  killIfAlive(existsSync(pidFile) ? Number(readFileSync(pidFile, 'utf8').trim()) : 0);
}
