// story: e09s01
// The CLI applies the budget setting before the engine runs: weftwork.yaml at
// the repository root and the user file under XDG_CONFIG_HOME. A bad file is
// bad input (exit 2): nothing runs and nothing is logged.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { aliasBomb, cleanupTempDirs, isolatedEnv, makeTempDir, makeTestRepo, readRepoLedger } from './test-helpers.ts';

after(cleanupTempDirs);

const cliPath = join(import.meta.dirname, 'cli.ts');
const failing = '{"command":"exit 9"}';

function runCli(cwd: string, env: NodeJS.ProcessEnv = isolatedEnv(), input: string = failing) {
  const result = spawnSync(process.execPath, [cliPath], { input, cwd, encoding: 'utf8', env });
  const lines = result.stdout.split('\n').filter((line) => line !== '');
  assert.equal(lines.length, 1, `one stdout line, got: ${result.stdout}${result.stderr}`);
  return { status: result.status, line: JSON.parse(lines[0] as string) as Record<string, unknown> };
}

test('with no setting file the built-in limits apply: the third failure on one tree is stalled', () => {
  const repo = makeTestRepo();
  assert.equal(runCli(repo).status, 1);
  assert.equal(runCli(repo).status, 1);
  const third = runCli(repo);
  assert.equal(third.status, 4);
  assert.equal(third.line['state'], 'stalled');
});

test('weftwork.yaml with maxFailures 2 makes the second failure exhausted, and a third call does not run', () => {
  const repo = makeTestRepo({ 'weftwork.yaml': 'budget:\n  maxFailures: 2\n' });
  assert.equal(runCli(repo).status, 1);
  const second = runCli(repo);
  assert.equal(second.status, 5);
  assert.equal(second.line['state'], 'exhausted');
  const third = runCli(repo);
  assert.equal(third.status, 5);
  assert.equal(third.line['reason'], 'not-run');
});

test('the user file under XDG_CONFIG_HOME is applied', () => {
  const home = makeTempDir();
  mkdirSync(join(home, 'weftwork'));
  writeFileSync(join(home, 'weftwork', 'config.yaml'), 'budget:\n  maxFailures: 1\n');
  const repo = makeTestRepo();
  const first = runCli(repo, { ...process.env, XDG_CONFIG_HOME: home });
  assert.equal(first.status, 5);
  assert.equal(first.line['state'], 'exhausted');
});

test('a request cannot raise the limit set by weftwork.yaml', () => {
  const repo = makeTestRepo({ 'weftwork.yaml': 'budget:\n  maxFailures: 1\n' });
  const first = runCli(repo, isolatedEnv(), '{"command":"exit 9","maxFailures":50}');
  assert.equal(first.status, 5);
});

const bad: [string, Record<string, string>, RegExp][] = [
  ['a value out of range', { 'weftwork.yaml': 'budget:\n  maxFailures: 0\n' }, /budget\.maxFailures/],
  ['an unknown key', { 'weftwork.yaml': 'budget:\n  maxFailure: 2\n' }, /budget\.maxFailure/],
  ['text that is not YAML', { 'weftwork.yaml': 'budget: [\n' }, /YAML/],
  ['a file over 64 KiB', { 'weftwork.yaml': `# ${'x'.repeat(64 * 1024)}\n` }, /65536/],
  ['an alias bomb (security review F1)', { 'weftwork.yaml': aliasBomb() }, /YAML/],
];

for (const [name, files, key] of bad) {
  test(`weftwork.yaml with ${name} exits 2 naming the file, and nothing runs or is logged`, async () => {
    const repo = makeTestRepo(files);
    const result = runCli(repo, isolatedEnv(), '{"command":"touch ran.txt"}');
    assert.equal(result.status, 2);
    assert.equal(result.line['done'], false);
    const error = String(result.line['error']);
    assert.match(error, /weftwork\.yaml/);
    assert.match(error, key);
    assert.equal(existsSync(join(repo, 'ran.txt')), false, 'the command did not run');
    assert.deepEqual((await readRepoLedger(repo)).entries, [], 'nothing was logged');
  });
}

test('a symlinked weftwork.yaml exits 2', () => {
  const repo = makeTestRepo();
  const target = join(makeTempDir(), 'good.yaml');
  writeFileSync(target, 'budget:\n  maxFailures: 2\n');
  symlinkSync(target, join(repo, 'weftwork.yaml'));
  const result = runCli(repo);
  assert.equal(result.status, 2);
  assert.match(String(result.line['error']), /weftwork\.yaml/);
});

test('control characters from weftwork.yaml are escaped in the CLI line (security review F2)', () => {
  const repo = makeTestRepo({ 'weftwork.yaml': 'budget:\n  "k\\e[31m\\r\\u009b": 1\n' });
  const result = spawnSync(process.execPath, [cliPath], { input: failing, cwd: repo, encoding: 'utf8', env: isolatedEnv() });
  assert.equal(result.status, 2);
  assert.doesNotMatch(result.stdout, /[\u001b\r\u009b]/u);
  assert.match(result.stdout, /\\u009b/);
});
