// story: e09s01
// The Claude Code hook applies the budget setting before the engine runs:
// weftwork.yaml at the project's repository root and the user file under
// XDG_CONFIG_HOME. Before e09s01 every hook run used the built-in limits. A bad
// file blocks the stop with text that names it, and nothing runs.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cliEnv, cliPath, stopInput } from './hook-cli-test-helpers.ts';
import { cleanupTempDirs, makeTempDir, makeTestRepo } from './test-helpers.ts';

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
  const repo = makeTestRepo({ 'weftwork.yaml': 'budget:\n  maxFailures: 2\n' });
  const first = runHook(repo, 'false');
  assert.equal(first.status, 2, 'the first failure blocks the stop');
  const second = runHook(repo, 'false');
  assert.equal(second.status, 0);
  assert.match(second.stdout, /not done \(exhausted\)/);
});

test('the user file under XDG_CONFIG_HOME is applied to a hook run', () => {
  const home = makeTempDir();
  mkdirSync(join(home, 'weftwork'));
  writeFileSync(join(home, 'weftwork', 'config.yaml'), 'budget:\n  maxFailures: 1\n');
  const repo = makeTestRepo();
  const first = runHook(repo, 'false', { ...cliEnv(repo), XDG_CONFIG_HOME: home });
  assert.equal(first.status, 0);
  assert.match(first.stdout, /not done \(exhausted\)/);
});

test('a bad weftwork.yaml blocks the stop, names the file and key, and runs nothing', () => {
  const repo = makeTestRepo({ 'weftwork.yaml': 'budget:\n  maxFailures: 0\n' });
  const out = runHook(repo, 'touch ran.txt');
  assert.equal(out.status, 2);
  assert.match(out.stderr, /weftwork\.yaml/);
  assert.match(out.stderr, /budget\.maxFailures/);
  assert.equal(existsSync(join(repo, 'ran.txt')), false, 'the command did not run');
});

test('control characters and new lines from weftwork.yaml are escaped in the reason (security review F2)', () => {
  const repo = makeTestRepo({ 'weftwork.yaml': 'budget:\n  "k\\e[31m\\r\\u009b\\nforged line": 1\n' });
  const out = runHook(repo, 'true');
  assert.equal(out.status, 2);
  assert.doesNotMatch(out.stderr, /[\u001b\r\u009b]/u);
  assert.equal(out.stderr.split('\n').filter((line) => line !== '').length, 1, 'one line, no forged line');
  assert.match(out.stderr, /\\u001b/);
});

test('a symlinked weftwork.yaml blocks the stop and runs nothing', () => {
  const repo = makeTestRepo();
  const target = join(makeTempDir(), 'good.yaml');
  writeFileSync(target, 'budget:\n  maxFailures: 2\n');
  symlinkSync(target, join(repo, 'weftwork.yaml'));
  const out = runHook(repo, 'touch ran.txt');
  assert.equal(out.status, 2);
  assert.match(out.stderr, /weftwork\.yaml/);
  assert.equal(existsSync(join(repo, 'ran.txt')), false, 'the command did not run');
});
