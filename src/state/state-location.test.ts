// The engine's state file lives in <git dir>/weftwork/state.yaml, next to the
// ledger: untracked, one per worktree, and created when it is missing (owner
// decision 2026-11-15, decoupling from bigpowers). Each CLI runs as a real
// process in a fresh temporary repository that has no state file yet.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { stateFields } from './state-fields.ts';
import { cleanupTempDirs, git, makeTempDir, makeTestRepo } from '../test-support/test-helpers.ts';

after(cleanupTempDirs);

const cli = (name: string): string => join(import.meta.dirname, '..', name);

/** Run a CLI in `cwd` with `input`; its stdout must be one JSON line. */
function run(name: string, cwd: string, input = ''): { status: number | null; result: Record<string, unknown> } {
  const out = spawnSync('node', [cli(name)], { cwd, input, encoding: 'utf8', timeout: 20000 });
  const lines = out.stdout.split('\n').filter((line) => line !== '');
  assert.equal(lines.length, 1, `stdout: ${out.stdout} stderr: ${out.stderr}`);
  return { status: out.status, result: JSON.parse(lines[0] as string) as Record<string, unknown> };
}

const statePath = (gitDir: string): string => join(gitDir, 'weftwork', 'state.yaml');
const gitOut = (dir: string, ...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
const status = (repo: string): string => gitOut(repo, 'status', '--porcelain');
const handoff = (branch: string): string =>
  JSON.stringify({ next_skill: 'all-ready', branch, files: ['tracked.txt'], note: 'Next: e09s04.' });

test('state-cli set in a fresh repository creates the state file in the git dir', () => {
  const repo = makeTestRepo();
  const set = run('state-cli.ts', repo, JSON.stringify({ op: 'set', key: 'active_story', value: 'e09s04' }));
  assert.equal(set.status, 0, JSON.stringify(set.result));
  const data = parse(readFileSync(statePath(join(repo, '.git')), 'utf8')) as Record<string, unknown>;
  assert.equal(data['active_story'], 'e09s04');
  assert.equal(status(repo), '');
  assert.equal(existsSync(join(repo, 'specs')), false);
});

test('state-cli get in a fresh repository reads every field as null and writes nothing', () => {
  const repo = makeTestRepo();
  const get = run('state-cli.ts', repo, JSON.stringify({ op: 'get' }));
  assert.equal(get.status, 0, JSON.stringify(get.result));
  assert.deepEqual(get.result['fields'], Object.fromEntries(stateFields.map((key) => [key, null])));
  assert.equal(existsSync(statePath(join(repo, '.git'))), false);
});

test('handoff-cli in a fresh repository writes the block to the git dir and leaves the tree clean', () => {
  const repo = makeTestRepo();
  const write = run('handoff-cli.ts', repo, handoff('main'));
  assert.equal(write.status, 0, JSON.stringify(write.result));
  const data = parse(readFileSync(statePath(join(repo, '.git')), 'utf8')) as Record<string, Record<string, unknown>>;
  assert.equal(data['handoff']?.['note'], 'Next: e09s04.');
  assert.equal(status(repo), '');
});

test('resume-cli answers missing, exit 1, in a fresh repository', () => {
  const repo = makeTestRepo();
  const check = run('resume-cli.ts', repo);
  assert.equal(check.status, 1, JSON.stringify(check.result));
  assert.equal(check.result['answer'], 'missing');
});

test('resume-cli reads the handoff from the git dir', () => {
  const repo = makeTestRepo();
  assert.equal(run('handoff-cli.ts', repo, handoff('main')).status, 0);
  const check = run('resume-cli.ts', repo);
  assert.equal(check.status, 0, JSON.stringify(check.result));
  assert.equal(check.result['answer'], 'ready');
});

test('a linked worktree keeps its own state file', () => {
  const repo = makeTestRepo();
  const linked = join(makeTempDir(), 'linked');
  git(repo, 'worktree', 'add', '-q', '-b', 'side', linked);
  assert.equal(run('handoff-cli.ts', linked, handoff('side')).status, 0);
  const linkedGitDir = gitOut(linked, 'rev-parse', '--absolute-git-dir').trim();
  assert.ok(existsSync(statePath(linkedGitDir)));
  assert.equal(existsSync(statePath(join(repo, '.git'))), false);
  assert.equal(run('resume-cli.ts', linked).result['answer'], 'ready');
  assert.equal(run('resume-cli.ts', repo).result['answer'], 'missing');
});
