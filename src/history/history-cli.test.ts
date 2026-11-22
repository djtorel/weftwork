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
import { cleanupTempDirs, git, isolatedEnv, makeTempDir, makeTestRepo } from '../test-support/test-helpers.ts';
import { criteria } from '../design/design.ts';
import { encodePng } from '../design/png-mark.ts';

after(cleanupTempDirs);

const cli = join(import.meta.dirname, '..', 'history-cli.ts');
const engine = join(import.meta.dirname, '..', 'cli.ts');
const design = join(import.meta.dirname, '..', 'design-cli.ts');

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

test('a record holds the time of the gate runs, of a run on a tree that had already passed, and of the design rounds of the branch; the report shows it', () => {
  const dir = makeTempDir();
  const answer = join(dir, 'answer.txt');
  writeFileSync(answer, `${criteria.map((c) => `GRADE ${c.key}: 5 ok`).join('\n')}\n`);
  const image = join(dir, 'home.desktop.png');
  writeFileSync(image, encodePng({ width: 20, height: 10, rgba: Buffer.alloc(20 * 10 * 4, 255) }));
  const repo = makeTestRepo({ 'weftwork.yaml': `---\nhistory: local\ndesign:\n  reviewers: [${JSON.stringify(`cat ${JSON.stringify(answer)}`)}]\n` });
  git(repo, 'checkout', '-q', '-b', 'feat/timed');
  // The same command twice on one tree: the second run is a repeat.
  for (const _ of [1, 2]) assert.equal(node(engine, repo, { command: 'sleep 1.2' }).status, 0);
  assert.equal(node(design, repo, { images: [image], brief: 'b' }).status, 0);
  assert.equal(node(cli, repo, { record: true }).status, 0);
  const record = JSON.parse(readFileSync(historyFile(repo), 'utf8').trim()) as Record<string, number> & { reviewers: Record<string, { runs: number; answered: number }> };
  assert.equal(record['history'], 2);
  assert.ok((record['gateSeconds'] ?? 0) >= 2 && (record['gateSeconds'] ?? 0) < 60, JSON.stringify(record));
  assert.equal(record['repeatRuns'], 1);
  assert.ok((record['repeatSeconds'] ?? 0) >= 1, JSON.stringify(record));
  assert.equal(record['designRounds'], 1);
  assert.deepEqual([record.reviewers['cat']?.runs, record.reviewers['cat']?.answered], [1, 1]);
  const report = node(cli, repo, {});
  assert.match(report.stdout, /^Time, the median of the 1 task that recorded it:$/m);
  assert.match(report.stdout, /^- gate runs: \d+ s, \d+ s of it on a tree that had already passed$/m);
  assert.match(report.stdout, /^- cat: 1 run, 1 answered, \d+ s a run$/m);
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
