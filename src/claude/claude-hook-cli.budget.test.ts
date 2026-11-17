// story: e09s01, e09s02, e09s03
// The Claude Code hook applies the budget setting before the engine runs:
// weftwork.yaml at the project's repository root and the user file under
// XDG_CONFIG_HOME. Before e09s01 every hook run used the built-in limits. A bad
// file runs nothing and allows the stop as not done, with text that names it:
// the agent cannot fix a setting file, so a block would only loop.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { cliEnv, cliPath, stopInput } from './hook-cli-test-helpers.ts';
import { cleanupTempDirs, makeTempDir, makeTestRepo } from '../test-support/test-helpers.ts';

after(cleanupTempDirs);

function runHook(repo: string, command: string, env: NodeJS.ProcessEnv = cliEnv(repo)) {
  const result = spawnSync(process.execPath, [cliPath, '--', command], {
    input: stopInput(repo),
    cwd: makeTempDir(),
    env,
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test('weftwork.yaml with maxFailures 2 makes the second failure exhausted, which the hook reports', () => {
  const repo = makeTestRepo({ 'weftwork.yaml': 'budget:\n  max_failures: 2\n' });
  const first = runHook(repo, 'false');
  assert.equal(first.status, 2, 'the first failure blocks the stop');
  const second = runHook(repo, 'false');
  assert.equal(second.status, 0);
  assert.match(second.stdout, /not done \(exhausted\)/);
});

test('the user file under XDG_CONFIG_HOME is applied to a hook run', () => {
  const home = makeTempDir();
  mkdirSync(join(home, 'weftwork'));
  writeFileSync(join(home, 'weftwork', 'config.yaml'), 'budget:\n  max_failures: 1\n');
  const repo = makeTestRepo();
  const first = runHook(repo, 'false', { ...cliEnv(repo), XDG_CONFIG_HOME: home });
  assert.equal(first.status, 0);
  assert.match(first.stdout, /not done \(exhausted\)/);
});

/** The owner's message of a stop the hook allowed as not done. */
function notDone(out: { status: number | null; stdout: string; stderr: string }): string {
  assert.equal(out.status, 0, 'the stop goes ahead: a block the agent cannot clear only loops');
  assert.equal(out.stderr, '');
  const message = String(JSON.parse(out.stdout).systemMessage);
  assert.match(message, /^weftwork: not done \(blocked\): /);
  return message;
}

test('a bad weftwork.yaml allows the stop as not done, names the file and key, and runs nothing', () => {
  const repo = makeTestRepo({ 'weftwork.yaml': 'budget:\n  max_failures: 0\n' });
  const out = runHook(repo, 'touch ran.txt');
  const message = notDone(out);
  assert.match(message, /weftwork\.yaml/);
  assert.match(message, /budget\.max_failures/);
  assert.match(message, /only the owner can fix/);
  assert.equal(existsSync(join(repo, 'ran.txt')), false, 'the command did not run');
});

test('a user file with two YAML documents allows the stop as not done and runs nothing', () => {
  const home = makeTempDir();
  mkdirSync(join(home, 'weftwork'));
  writeFileSync(join(home, 'weftwork', 'config.yaml'), '---\nhistory: local\n---\nhistory: local\n');
  const repo = makeTestRepo();
  const out = runHook(repo, 'touch ran.txt', { ...cliEnv(repo), XDG_CONFIG_HOME: home });
  const message = notDone(out);
  assert.match(message, /config\.yaml/);
  assert.match(message, /more than one YAML document/);
  assert.equal(existsSync(join(repo, 'ran.txt')), false, 'the command did not run');
});

test('control characters and new lines from weftwork.yaml are escaped in the reason (security review F2)', () => {
  const repo = makeTestRepo({ 'weftwork.yaml': 'budget:\n  "k\\e[31m\\r\\u009b\\nforged line": 1\n' });
  const out = runHook(repo, 'true');
  const message = notDone(out);
  assert.doesNotMatch(message, /[\u001b\r\u009b]/u);
  assert.equal(message.split('\n').length, 1, 'one line, no forged line');
  assert.match(message, /\\u001b/);
});

test('a symlinked weftwork.yaml allows the stop as not done and runs nothing', () => {
  const repo = makeTestRepo();
  const target = join(makeTempDir(), 'good.yaml');
  writeFileSync(target, 'budget:\n  max_failures: 2\n');
  symlinkSync(target, join(repo, 'weftwork.yaml'));
  const out = runHook(repo, 'touch ran.txt');
  assert.match(notDone(out), /weftwork\.yaml/);
  assert.equal(existsSync(join(repo, 'ran.txt')), false, 'the command did not run');
});

test('AC-e09s02-10 weftwork.yaml with maxRuns 2: the second of two different failing commands is exhausted', () => {
  const repo = makeTestRepo({ 'weftwork.yaml': 'budget:\n  max_runs: 2\n' });
  const first = runHook(repo, 'exit 1');
  assert.equal(first.status, 2, 'the first failure blocks the stop');
  const second = runHook(repo, 'exit 2');
  assert.equal(second.status, 0);
  assert.match(second.stdout, /not done \(exhausted\)/);
  assert.match(second.stdout, /loop ceiling is 2/);
});

test('AC-e09s03-10 maxRuns 3: the second failure blocks with the handoff line, the third allows the stop', () => {
  const repo = makeTestRepo({ 'weftwork.yaml': 'budget:\n  max_runs: 3\n' });
  const handoffCli = join(dirname(cliPath), 'handoff-cli.ts');
  const first = runHook(repo, 'exit 1');
  assert.equal(first.status, 2);
  assert.doesNotMatch(first.stderr, /handoff/);
  const second = runHook(repo, 'exit 2');
  assert.equal(second.status, 2, 'the reserve still blocks the stop');
  const last = second.stderr.trimEnd().split('\n').at(-1) ?? '';
  assert.equal(
    last,
    '2 runs since the last done, 1 left before the loop ceiling of 3: write the handoff now with ' +
      `node ${JSON.stringify(handoffCli)} (JSON on stdin: next_skill, branch, note)`,
  );
  const third = runHook(repo, 'exit 3');
  assert.equal(third.status, 0);
  assert.match(third.stdout, /not done \(exhausted\)/);
});
