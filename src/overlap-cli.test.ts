// story: B8
// The overlap CLI as a real process: clear exits 0, overlap exits 1 with the
// pairs, bad input exits 2; a task given as a branch uses the files the
// branch changed since its merge base.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempDirs, git, isolatedEnv, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const overlapCli = join(import.meta.dirname, 'overlap-cli.ts');

function check(cwd: string, request: unknown) {
  const input = typeof request === 'string' ? request : JSON.stringify(request);
  const out = spawnSync(process.execPath, [overlapCli], { cwd, input, env: isolatedEnv(), encoding: 'utf8', timeout: 20000 });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

test('B8-08 clear exits 0, overlap exits 1 with the pairs, bad input exits 2', () => {
  const repo = makeTestRepo();
  const clear = check(repo, { tasks: [{ name: 'a', files: ['src/a.ts'] }, { name: 'b', files: ['src/b.ts'] }] });
  assert.deepEqual(clear, { status: 0, stdout: '{"result":"clear","pairs":[]}\n', stderr: '' });
  const overlap = check(repo, { tasks: [{ name: 'a', files: ['src/**'] }, { name: 'b', files: ['src/b.ts'] }] });
  assert.equal(overlap.status, 1, overlap.stderr);
  assert.deepEqual(JSON.parse(overlap.stdout), { result: 'overlap', pairs: [{ tasks: ['a', 'b'], files: [['src/**', 'src/b.ts']] }] });
  const bad = check(repo, 'not json');
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /^overlap: /);
  assert.equal(check(repo, { tasks: [] }).status, 2);
});

test('B8-09 a task given as a branch is checked by the files it changed since the merge base', () => {
  const repo = makeTestRepo({ 'src/a.ts': 'a\n', 'src/b.ts': 'b\n' });
  git(repo, 'checkout', '-q', '-b', 'feat/b');
  writeFileSync(join(repo, 'src', 'b.ts'), 'b2\n');
  git(repo, 'commit', '-q', '-am', 'b');
  git(repo, 'checkout', '-q', 'main');
  writeFileSync(join(repo, 'src', 'a.ts'), 'a2\n');
  git(repo, 'commit', '-q', '-am', 'a on main');
  // main's own change to src/a.ts is after the merge base, so it is not feat/b's.
  const clear = check(repo, { tasks: [{ name: 'a', files: ['src/a.ts'] }, { name: 'b', branch: 'feat/b' }] });
  assert.equal(clear.status, 0, clear.stderr);
  const overlap = check(repo, { tasks: [{ name: 'a', files: ['src/*.ts'] }, { name: 'b', branch: 'feat/b' }] });
  assert.equal(overlap.status, 1, overlap.stderr);
  assert.deepEqual(JSON.parse(overlap.stdout).pairs, [{ tasks: ['a', 'b'], files: [['src/*.ts', 'src/b.ts']] }]);
  const missing = check(repo, { tasks: [{ name: 'a', files: ['x'] }, { name: 'b', branch: 'no-such-branch' }] });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /no-such-branch/);
});
