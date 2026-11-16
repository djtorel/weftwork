// story: e13s02
// What a review round is of (review-scope.ts): a git tree of the working
// tree as the round saw it, the files changed between two such trees, the
// size of the change from the base, the files that make a change sensitive,
// and whether a must-fix names a file and line that exist (R19).
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { anchorOf, changedBetween, diffLines, groundResults, sensitiveFiles, snapshotTree } from './review-scope.ts';
import type { ReviewerResult } from './review.ts';
import { cleanupTempDirs, makeTempDir, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const scratch = () => makeTempDir();
const gitOut = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' });

test('a snapshot is a git tree of the working tree: untracked files in, ignored files out, the index untouched', async () => {
  const repo = makeTestRepo({ 'tracked.txt': 'one\n', '.gitignore': 'ignored.txt\n' });
  writeFileSync(join(repo, 'new.txt'), 'new\n');
  writeFileSync(join(repo, 'ignored.txt'), 'x\n');
  const status = gitOut(repo, 'status', '--porcelain');
  const first = await snapshotTree(repo, scratch());
  assert.ok(first.ok, first.ok ? '' : first.error);
  assert.match(first.tree, /^[0-9a-f]{40,64}$/);
  const names = gitOut(repo, 'ls-tree', '-r', '--name-only', first.tree).trim().split('\n');
  assert.deepEqual(names.sort(), ['.gitignore', 'new.txt', 'tracked.txt']);
  assert.equal(gitOut(repo, 'status', '--porcelain'), status);
  const same = await snapshotTree(repo, scratch());
  assert.equal(same.ok && same.tree, first.tree);
  writeFileSync(join(repo, 'tracked.txt'), 'two\n');
  const changed = await snapshotTree(repo, scratch());
  assert.notEqual(changed.ok && changed.tree, first.tree);
});

test('a tracked file that matches an ignore rule is still in the snapshot (review round 1)', async () => {
  const repo = makeTestRepo({ 'kept.log': 'one\n', 'a.txt': 'a\n' });
  writeFileSync(join(repo, '.gitignore'), '*.log\n');
  const one = await snapshotTree(repo, scratch());
  assert.ok(one.ok);
  writeFileSync(join(repo, 'kept.log'), 'two\n');
  const two = await snapshotTree(repo, scratch());
  assert.ok(two.ok);
  assert.deepEqual(await changedBetween(repo, one.tree, two.tree), { ok: true, paths: ['kept.log'] });
});

test('the files changed between two snapshots, and the lines changed from the base', async () => {
  const repo = makeTestRepo({ 'a.txt': 'a\n', 'b.txt': 'b\n' });
  const base = gitOut(repo, 'rev-parse', 'HEAD').trim();
  writeFileSync(join(repo, 'a.txt'), 'a\na2\n');
  const one = await snapshotTree(repo, scratch());
  assert.ok(one.ok);
  writeFileSync(join(repo, 'b.txt'), 'b2\n');
  writeFileSync(join(repo, 'c.txt'), 'c\nc\nc\n');
  const two = await snapshotTree(repo, scratch());
  assert.ok(two.ok);
  assert.deepEqual(await changedBetween(repo, one.tree, two.tree), { ok: true, paths: ['b.txt', 'c.txt'] });
  assert.deepEqual(await changedBetween(repo, base, one.tree), { ok: true, paths: ['a.txt'] });
  // a.txt +1, b.txt +1 -1, c.txt +3 (an untracked file counts).
  assert.deepEqual(await diffLines(repo, base, two.tree), { ok: true, lines: 6 });
});

test('sensitive files: the changed paths that match a review.sensitive_paths pattern', () => {
  assert.deepEqual(sensitiveFiles(['src/guard.ts', 'docs/a.md', 'src/x/auth.ts'], ['src/guard*.ts', '**/auth.ts']), ['src/guard.ts', 'src/x/auth.ts']);
  assert.deepEqual(sensitiveFiles(['src/a.ts'], []), []);
});

test('a finding\'s anchor: the file and line it starts with', () => {
  assert.deepEqual(anchorOf('src/a.ts:12 wrong exit code'), { file: 'src/a.ts', line: 12 });
  assert.deepEqual(anchorOf('`src/a.ts:12-20` a range'), { file: 'src/a.ts', line: 12 });
  assert.deepEqual(anchorOf('src/a.ts:12:4 a column'), { file: 'src/a.ts', line: 12 });
  assert.deepEqual(anchorOf('`docs/a b.md:3` a quoted path with a space'), { file: 'docs/a b.md', line: 3 });
  assert.deepEqual(anchorOf('(codex): src/a.ts:3 stored in the ledger'), { file: 'src/a.ts', line: 3 });
  assert.equal(anchorOf('the whole design is wrong'), null);
});

test('a must-fix that names no file and line, a missing file, a line past the end or a path outside the repository becomes a should-fix', async () => {
  const repo = makeTestRepo({ 'src/a.ts': 'one\ntwo\nthree\n' });
  mkdirSync(join(repo, 'dir'));
  const outside = makeTempDir();
  writeFileSync(join(outside, 'x'), 'x\n');
  symlinkSync(outside, join(repo, 'out'));
  const result: ReviewerResult = {
    name: 'codex',
    ok: true,
    mustFix: ['src/a.ts:3 real', 'src/a.ts:4 past the end', 'src/b.ts:1 no file', 'no anchor at all', '../outside.txt:1 outside', 'dir:1 a folder', 'out/x:1 through a symlink'],
    shouldFix: ['src/z.ts:9 kept as it is'],
    followUp: [],
  };
  const [grounded] = await groundResults(repo, [result, { name: 'x', ok: false, error: 'e' }]);
  assert.ok(grounded?.ok);
  assert.deepEqual(grounded.mustFix, ['src/a.ts:3 real']);
  assert.deepEqual(grounded.shouldFix, [
    'src/z.ts:9 kept as it is',
    'src/a.ts:4 past the end [not grounded: line 4 is past the end of src/a.ts, 3 lines]',
    'src/b.ts:1 no file [not grounded: src/b.ts is not a file in the repository]',
    'no anchor at all [not grounded: no <file>:<line>]',
    '../outside.txt:1 outside [not grounded: ../outside.txt is outside the repository]',
    'dir:1 a folder [not grounded: dir is not a file in the repository]',
    'out/x:1 through a symlink [not grounded: out/x is outside the repository]',
  ]);
});
