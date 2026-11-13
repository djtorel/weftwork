// story: e07s01, e07s04
// The real Claude Code hook CLI, started as a child process against
// temporary git repositories (e07s01 AC-06 to AC-09, AC-11, AC-12). No case
// touches this repository's own ledger: a `false` run there would trip its
// stop rules.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isRecord } from './json.ts';
import { lastCallPath, readLastCall } from './last-call.ts';
import { cleanupTempDirs, makeTempDir, makeTestRepo, readRepoLedger } from './test-helpers.ts';

after(cleanupTempDirs);

const cliPath = join(import.meta.dirname, 'claude-hook-cli.ts');

/** Run the CLI from a directory that is not the repository, so only
 * CLAUDE_PROJECT_DIR (`project`, or unset when null) can say where the
 * command runs. */
function runHook(input: string, args: string[], project: string | null) {
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  if (project !== null) {
    env.CLAUDE_PROJECT_DIR = project;
  }
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    input,
    cwd: makeTempDir(),
    env,
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** The Stop input the host sends, with the agent's current directory. */
function stopInput(cwd: string): string {
  return JSON.stringify({ hook_event_name: 'Stop', cwd, stop_hook_active: false });
}

test('AC-e07s01-06 a failing command blocks the stop', () => {
  const repo = makeTestRepo();
  const out = runHook(stopInput(repo), ['--', 'false'], repo);
  assert.equal(out.status, 2);
  assert.match(out.stderr, /not done \(failed/);
  assert.equal(out.stdout, '');
});

test('AC-e07s01-07 a passing command allows the stop', () => {
  const repo = makeTestRepo();
  const out = runHook(stopInput(repo), ['--', 'true'], repo);
  assert.equal(out.status, 0);
  assert.equal(out.stdout, '');
});

test('AC-e07s01-07 the command runs in CLAUDE_PROJECT_DIR', () => {
  const repo = makeTestRepo({ 'marker.txt': 'here\n' });
  assert.equal(runHook(stopInput(repo), ['--', 'test -f marker.txt'], repo).status, 0);
  assert.equal(runHook(stopInput(repo), ['--', 'test -f nothing.txt'], repo).status, 2);
});

test("AC-e07s01-11 the agent's cd does not move the command", () => {
  const repo = makeTestRepo({ 'check.sh': 'exit 1\n' });
  mkdirSync(join(repo, 'sub'));
  writeFileSync(join(repo, 'sub', 'check.sh'), 'exit 0\n');
  const fromSub = runHook(stopInput(join(repo, 'sub')), ['--', 'sh ./check.sh'], repo);
  assert.equal(fromSub.status, 2, 'the root check ran, not the one in sub');
  assert.match(fromSub.stderr, /not done \(failed, exit-nonzero\)/);
});

test('AC-e07s01-11 no CLAUDE_PROJECT_DIR blocks the stop', () => {
  const repo = makeTestRepo();
  const out = runHook(stopInput(repo), ['--', 'true'], null);
  assert.equal(out.status, 2);
  assert.match(out.stderr, /CLAUDE_PROJECT_DIR/);
  assert.equal(out.stdout, '');
});

test('AC-e07s01-11 an empty or relative CLAUDE_PROJECT_DIR blocks the stop', () => {
  const repo = makeTestRepo();
  for (const project of ['', 'relative/dir']) {
    const out = runHook(stopInput(repo), ['--', 'true'], project);
    assert.equal(out.status, 2, project);
    assert.match(out.stderr, /CLAUDE_PROJECT_DIR/);
    assert.equal(out.stdout, '');
  }
});

test("AC-e07s01-08 the command's output does not reach stdout", () => {
  const repo = makeTestRepo();
  const out = runHook(stopInput(repo), ['--', 'echo hello; exit 1'], repo);
  assert.equal(out.status, 2);
  assert.equal(out.stdout, '');
  assert.match(out.stderr, /hello/);
});

test('AC-e07s01-08 the command output comes first and the reason last', () => {
  const repo = makeTestRepo();
  const out = runHook(stopInput(repo), ['--', 'echo hello; exit 1'], repo);
  const reason = out.stderr.indexOf('weftwork: not done (failed');
  const hello = out.stderr.indexOf('hello');
  assert.ok(hello >= 0 && reason >= 0, 'both the output and the reason are there');
  assert.ok(hello < reason, 'hello comes before the reason line');
  assert.ok(out.stderr.endsWith('Make that command pass before you stop.\n'));
});

test('AC-e07s01-08 a stalled run allows the stop with one JSON object on stdout', () => {
  const repo = makeTestRepo();
  const runs = [1, 2, 3].map(() => runHook(stopInput(repo), ['--', 'echo noise; false'], repo));
  assert.deepEqual(runs.map((run) => run.status), [2, 2, 0]);
  const last = runs[2];
  assert.ok(last !== undefined);
  const parsed: unknown = JSON.parse(last.stdout);
  assert.ok(isRecord(parsed));
  assert.deepEqual(Object.keys(parsed), ['systemMessage']);
  assert.match(String(parsed.systemMessage), /not done \(stalled\)/);
  assert.ok(!last.stdout.includes('noise'), "the command's output is not on stdout");
});

test('AC-e07s01-09 input that is not JSON blocks the stop', () => {
  const repo = makeTestRepo();
  const out = runHook('not json', ['--', 'true'], repo);
  assert.equal(out.status, 2);
  assert.match(out.stderr, /unreadable hook input/);
  assert.equal(out.stdout, '');
});

test('AC-e07s01-09 a bad argument list blocks the stop with a usage line', () => {
  const repo = makeTestRepo();
  for (const args of [[], ['true'], ['--'], ['--', 'true', 'extra']]) {
    const out = runHook(stopInput(repo), args, repo);
    assert.equal(out.status, 2, args.join(' '));
    assert.match(out.stderr, /usage/);
    assert.equal(out.stdout, '');
  }
});

test('AC-e07s01-12 a blank command blocks the stop and never answers done', () => {
  const repo = makeTestRepo();
  for (const command of ['', '   ']) {
    const out = runHook(stopInput(repo), ['--', command], repo);
    assert.equal(out.status, 2, JSON.stringify(command));
    assert.equal(out.stdout, '');
  }
});

/** The record path of `repo`, which must have a git dir. */
async function recordPath(repo: string): Promise<string> {
  const path = await lastCallPath(repo);
  assert.notEqual(path, null);
  return path as string;
}

test('AC-e07s04-06 a call leaves a record of the adapter, the command and the time', async () => {
  const repo = makeTestRepo();
  const before = Date.now();
  assert.equal(runHook(stopInput(repo), ['--', 'true'], repo).status, 0);
  const read = await readLastCall(await recordPath(repo));
  assert.ok(read.ok && read.call !== null, 'a record was written');
  assert.equal(read.call.cliPath, cliPath);
  assert.equal(read.call.command, 'true');
  const at = Date.parse(read.call.at);
  assert.ok(at >= before - 1000 && at <= Date.now(), read.call.at);
  assert.equal((await readRepoLedger(repo)).entries.length, 1);
});

test('AC-e07s04-06 a record that cannot be written changes neither the answer nor the ledger', async () => {
  const repo = makeTestRepo();
  const path = await recordPath(repo);
  mkdirSync(path, { recursive: true });
  assert.equal(runHook(stopInput(repo), ['--', 'true'], repo).status, 0);
  const failed = runHook(stopInput(repo), ['--', 'false'], repo);
  assert.equal(failed.status, 2);
  assert.match(failed.stderr, /not done \(failed/);
  assert.equal((await readRepoLedger(repo)).entries.length, 2);
  assert.ok(statSync(path).isDirectory());
});

test('AC-e07s04-07 a call refused for bad arguments writes no record', async () => {
  const repo = makeTestRepo();
  assert.equal(runHook(stopInput(repo), [], repo).status, 2);
  assert.equal(existsSync(await recordPath(repo)), false);
});
