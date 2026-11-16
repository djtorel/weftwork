// story: e07s01, e09s04
// The Stop hook reuses its own last pass on the same tree: a second stop on an
// unchanged tree runs no command (backlog follow-up of PR #95). Any doubt runs
// the command as before: a change to a tracked or an untracked file, a
// different command, a later failure, or a pass the hook did not run itself.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cliEnv, cliPath, stopInput } from './hook-cli-test-helpers.ts';
import { cleanupTempDirs, makeTempDir, makeTestRepo, readRepoLedger } from './test-helpers.ts';

after(cleanupTempDirs);

const engineCli = join(import.meta.dirname, 'cli.ts');

function runHook(repo: string, command: string) {
  const result = spawnSync(process.execPath, [cliPath, '--', command], {
    input: stopInput(repo),
    cwd: makeTempDir(),
    env: cliEnv(repo),
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** Run the engine CLI in `repo`, as the agent does. */
function runEngineCli(repo: string, command: string, env: NodeJS.ProcessEnv = {}, extra: object = {}) {
  return spawnSync(process.execPath, [engineCli], {
    input: JSON.stringify({ command, ...extra }),
    cwd: repo,
    env: { ...cliEnv(repo), ...env },
    encoding: 'utf8',
  }).status;
}

/** A command that adds a line to a file outside the repository each time it
 * runs, so the test counts the runs without changing the tree. It fails when
 * FAIL is set. */
function countingCommand(): { command: string; runs: () => number } {
  const file = join(makeTempDir(), 'runs');
  return {
    command: `[ -z "$FAIL" ] && echo run >> '${file}'`,
    runs: () => (existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).length : 0),
  };
}

test('a second stop on an unchanged tree runs no command and says it reused the pass', async () => {
  const repo = makeTestRepo();
  const { command, runs } = countingCommand();
  const first = runHook(repo, command);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(runs(), 1);
  const lines = (await readRepoLedger(repo)).entries.length;
  const second = runHook(repo, command);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(runs(), 1, 'the command did not run again');
  assert.match(second.stdout, /reused the pass of \d{4}-\d\d-\d\dT[\d:.]+Z on this tree/);
  assert.equal((await readRepoLedger(repo)).entries.length, lines, 'a reused pass adds no run');
});

test('a change to a tracked file runs the command again', () => {
  const repo = makeTestRepo();
  const { command, runs } = countingCommand();
  runHook(repo, command);
  writeFileSync(join(repo, 'tracked.txt'), 'two\n');
  const out = runHook(repo, command);
  assert.equal(out.status, 0, out.stderr);
  assert.equal(runs(), 2);
  assert.doesNotMatch(out.stdout, /reused/);
});

test('a new untracked file runs the command again', () => {
  const repo = makeTestRepo();
  const { command, runs } = countingCommand();
  runHook(repo, command);
  writeFileSync(join(repo, 'new.txt'), 'new\n');
  runHook(repo, command);
  assert.equal(runs(), 2);
});

test('a different command string runs', () => {
  const repo = makeTestRepo();
  const { command, runs } = countingCommand();
  runHook(repo, command);
  runHook(repo, `${command} `);
  assert.equal(runs(), 2);
});

test('a failure of the same command after the pass runs the command again', () => {
  const repo = makeTestRepo();
  const { command, runs } = countingCommand();
  runHook(repo, command);
  assert.equal(runEngineCli(repo, command, { FAIL: '1' }), 1, 'the engine CLI run failed');
  const out = runHook(repo, command);
  assert.equal(out.status, 0, out.stderr);
  assert.equal(runs(), 2);
});

test('a pass the engine CLI ran, not the hook, is not reused', () => {
  const repo = makeTestRepo();
  const { command, runs } = countingCommand();
  assert.equal(runEngineCli(repo, command), 0, 'the engine CLI run passed');
  assert.equal(runs(), 1);
  runHook(repo, command);
  assert.equal(runs(), 2, 'the hook ran the command itself');
});

test('the engine CLI ignores a stopHook key: its pass is not marked and not reused', async () => {
  const repo = makeTestRepo();
  const { command, runs } = countingCommand();
  assert.equal(runEngineCli(repo, command, {}, { stopHook: true }), 0);
  assert.equal((await readRepoLedger(repo)).entries[0]?.hookDir, undefined);
  runHook(repo, command);
  assert.equal(runs(), 2);
});
