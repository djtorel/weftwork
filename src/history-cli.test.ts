// story: e15s01
// The history CLI (history-cli.ts): `{"record":true}` writes one record of
// the current branch to the clone's common git dir when the owner has set
// `history: local`, and is a no-op otherwise; `{}` reports. The record outlives
// the worktree it came from (docs/HISTORY.md).
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempDirs, git, isolatedEnv, makeTempDir, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const cli = join(import.meta.dirname, 'history-cli.ts');
const engine = join(import.meta.dirname, 'cli.ts');

function node(script: string, cwd: string, input: object, env = isolatedEnv()) {
  const out = spawnSync(process.execPath, [script], { cwd, input: JSON.stringify(input), env, encoding: 'utf8', timeout: 30000 });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

const historyFile = (repo: string) => join(repo, '.git', 'weftwork', 'history.jsonl');

test('with no history setting, record writes nothing and says how to turn it on', () => {
  const repo = makeTestRepo();
  git(repo, 'checkout', '-q', '-b', 'feat/a');
  const out = node(cli, repo, { record: true });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^weftwork history: off; set history: local in weftwork\.yaml to record \(docs\/HISTORY\.md\)$/m);
  assert.equal(existsSync(historyFile(repo)), false);
});

test('a record from a linked worktree outlives the worktree, and the report shows it', () => {
  const repo = makeTestRepo({ 'weftwork.yaml': '---\nhistory: local\n' });
  const tree = join(makeTempDir(), 'wt');
  git(repo, 'worktree', 'add', '-q', '-b', 'feat/wt', tree);
  assert.equal(node(engine, tree, { command: 'false' }).status, 1);
  assert.equal(node(engine, tree, { command: 'true' }).status, 0);
  const out = node(cli, tree, { record: true, model: 'opus-5' });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^weftwork history: recorded feat\/wt: gate:failed$/m);
  git(repo, 'worktree', 'remove', '--force', tree);
  const lines = readFileSync(historyFile(repo), 'utf8').split('\n').filter((line) => line !== '');
  assert.equal(lines.length, 1);
  assert.deepEqual(
    (({ branch, runs, failures, model }) => ({ branch, runs, failures, model }))(JSON.parse(lines[0] as string) as Record<string, unknown>),
    { branch: 'feat/wt', runs: 2, failures: 1, model: 'opus-5' },
  );
  const report = node(cli, repo, {});
  assert.equal(report.status, 0, report.stderr);
  assert.match(report.stdout, /^weftwork history: 1 task, /m);
  assert.match(report.stdout, /^No class in 3 or more tasks\.$/m);
});

test('the user setting file turns history on too, and the repository file wins', () => {
  const env = isolatedEnv();
  const config = join(env.XDG_CONFIG_HOME as string, 'weftwork');
  spawnSync('mkdir', ['-p', config]);
  writeFileSync(join(config, 'config.yaml'), '---\nhistory: local\n');
  const repo = makeTestRepo();
  git(repo, 'checkout', '-q', '-b', 'feat/u');
  assert.match(node(cli, repo, { record: true }, env).stdout, /recorded feat\/u: no failure class/);
  const off = makeTestRepo({ 'weftwork.yaml': '---\nhistory: off\n' });
  git(off, 'checkout', '-q', '-b', 'feat/o');
  assert.match(node(cli, off, { record: true }, env).stdout, /history: off/);
});

test('bad input and a bad setting exit 2 with the reason', () => {
  const repo = makeTestRepo({ 'weftwork.yaml': '---\nhistory: maybe\n' });
  git(repo, 'checkout', '-q', '-b', 'feat/b');
  const bad = node(cli, repo, { record: true });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /history must be local or off/);
  const good = makeTestRepo({ 'weftwork.yaml': '---\nhistory: local\n' });
  assert.match(node(cli, good, { min_tasks: 1 }).stderr, /min_tasks must be an integer from 2 to 50/);
  assert.match(node(cli, good, { record: true, model: 'a b' }).stderr, /model must be/);
  git(good, 'checkout', '-q', '--detach');
  assert.match(node(cli, good, { record: true }).stderr, /no branch/);
  writeFileSync(join(good, 'weftwork-improvements.yaml'), '---\nimprovements: 3\n');
  assert.match(node(cli, good, {}).stderr, /weftwork-improvements\.yaml: improvements must be a list/);
});
