// story: e08s01
// The file half of the state writer, state-write.ts (e08s01 AC-07, AC-08), called directly in
// temporary repositories: writeStateField writes one field, keeps the mode,
// leaves no temp file, and refuses a symlink, a FIFO, a file outside the
// repository or inside .git, invalid YAML, a missing key and an oversized file,
// leaving every file as it was. These ran through the state CLI until e08s02
// fixed the CLI to specs/state.yaml. No test touches this repository's own
// specs/state.yaml.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { setField } from './state-file.ts';
import { writeStateField } from './state-write.ts';
import { cleanupTempDirs, git, makeStateRepo, makeTempDir, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const fixture = readFileSync(join(import.meta.dirname, 'fixtures', 'state.yaml'), 'utf8');

/** Each entry of `dir` with its text, or 'not a file', to compare before and after a run. */
function snapshot(dir: string): string[][] {
  return readdirSync(dir).map((name) => {
    const path = join(dir, name);
    return [name, statSync(path).isFile() ? readFileSync(path).toString('hex') : 'not a file'];
  });
}

// AC-e08s01-07
test('writeStateField writes one field, keeps the mode and leaves no temp file', () => {
  const { repo, specs, state } = makeStateRepo(fixture);
  const result = writeStateField(repo, 'specs/state.yaml', ['handoff', 'next_skill'], 'verify-work');
  assert.deepEqual(result, { ok: true, action: 'written', file: 'specs/state.yaml' });
  const expected = setField(fixture, ['handoff', 'next_skill'], 'verify-work');
  assert.ok(expected.ok);
  assert.equal(readFileSync(state, 'utf8'), expected.text);
  assert.equal(statSync(state).mode & 0o777, 0o640);
  assert.deepEqual(readdirSync(specs), ['state.yaml']);
});

test('writeStateField leaves a field that already holds the value as it was', () => {
  const { repo, state } = makeStateRepo(fixture);
  const before = statSync(state).mtimeMs;
  const result = writeStateField(repo, 'specs/state.yaml', ['handoff', 'next_skill'], 'develop-tdd');
  assert.deepEqual(result, { ok: true, action: 'unchanged', file: 'specs/state.yaml' });
  assert.equal(readFileSync(state, 'utf8'), fixture);
  assert.equal(statSync(state).mtimeMs, before);
});

// AC-e08s01-08
test('writeStateField refuses and leaves the files as they were', () => {
  const cases: [string, (repo: string, specs: string) => string, unknown[], RegExp][] = [
    ['a symlink', (_repo, specs) => {
      writeFileSync(join(specs, 'real.yaml'), fixture);
      symlinkSync(join(specs, 'real.yaml'), join(specs, 'link.yaml'));
      return 'specs/link.yaml';
    }, ['active_story'], /cannot be opened as a regular file/],
    ['an absolute path outside the root', () => {
      const outside = join(makeTempDir(), 'state.yaml');
      writeFileSync(outside, fixture);
      return outside;
    }, ['active_story'], /outside the repository/],
    ['a symlinked directory that leads outside', (repo) => {
      const outside = makeTempDir();
      writeFileSync(join(outside, 'state.yaml'), fixture);
      symlinkSync(outside, join(repo, 'elsewhere'));
      return 'elsewhere/state.yaml';
    }, ['active_story'], /outside the repository/],
    ['a FIFO', (_repo, specs) => {
      spawnSync('mkfifo', [join(specs, 'fifo.yaml')]);
      return 'specs/fifo.yaml';
    }, ['active_story'], /not a regular file/],
    ['invalid YAML', (_repo, specs) => {
      writeFileSync(join(specs, 'bad.yaml'), 'a: [1, 2\nb: c\n');
      return 'specs/bad.yaml';
    }, ['b'], /not valid YAML/],
    ['a missing key', () => 'specs/state.yaml', ['handoff', 'no_such_key'], /no_such_key/],
    ['an alias bomb (security review F1)', (_repo, specs) => {
      const lines = ['a: &a [x, x, x, x, x, x, x, x, x, x]', 'b: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a, *a]'];
      lines.push('c: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b, *b]', 'k: v', '');
      writeFileSync(join(specs, 'bomb.yaml'), lines.join('\n'));
      return 'specs/bomb.yaml';
    }, ['k'], /alias/i],
    ['a missing file', () => 'specs/none.yaml', ['active_story'], /does not exist/],
    ['a file under .git (review B9)', (repo) => {
      writeFileSync(join(repo, '.git', 'state.yaml'), 'a: 1\n');
      return '.git/state.yaml';
    }, ['a'], /inside \.git/],
    ['the repository root itself (review B9)', () => '.', ['a'], /names the repository root/],
    ['a symlinked folder that leads into .git (review 4, A1)', (repo) => {
      writeFileSync(join(repo, '.git', 'state.yaml'), 'a: 1\n');
      symlinkSync('.git', join(repo, 'g'));
      return 'g/state.yaml';
    }, ['a'], /inside \.git/],
    ['a .GIT folder, which a case-insensitive disk reads as .git (review 4, A2)', (repo) => {
      mkdirSync(join(repo, '.GIT'));
      writeFileSync(join(repo, '.GIT', 'state.yaml'), 'a: 1\n');
      return '.GIT/state.yaml';
    }, ['a'], /inside \.git/],
    ['invalid UTF-8 in another field (review 3, A2, B2)', (_repo, specs) => {
      writeFileSync(join(specs, 'latin1.yaml'), Buffer.from('a: 1\n# caf\xe9\nb: 2\n', 'latin1'));
      return 'specs/latin1.yaml';
    }, ['a'], /not valid UTF-8/],
    ['a .git file in a nested folder (review 2, A11, B8)', (repo) => {
      mkdirSync(join(repo, 'sub'));
      writeFileSync(join(repo, 'sub', '.git'), 'gitdir: /elsewhere\n');
      return 'sub/.git';
    }, ['gitdir'], /inside \.git/],
    ['a state file over 1 MiB', (_repo, specs) => {
      writeFileSync(join(specs, 'big.yaml'), `a: ${'x'.repeat(1024 * 1024)}\n`);
      return 'specs/big.yaml';
    }, ['a'], /larger than 1048576 bytes/],
  ];
  for (const [label, arrange, path, message] of cases) {
    const { repo, specs } = makeStateRepo(fixture);
    const file = arrange(repo, specs);
    const before = snapshot(specs);
    const target = isAbsolute(file) ? file : join(repo, file);
    const targetBefore = existsSync(target) && statSync(target).isFile() ? readFileSync(target).toString('hex') : null;
    const result = writeStateField(repo, file, path as string[], 'x');
    assert.equal(result.ok, false, `${label}: ${JSON.stringify(result)}`);
    assert.match(result.ok ? '' : result.error, message, label);
    const after = snapshot(specs);
    assert.deepEqual(after, before, label);
    if (targetBefore !== null) assert.equal(readFileSync(target).toString('hex'), targetBefore, `${label}: the target changed`);
  }
});

// AC-e08s01-08, review 2 (A9): a write must not make a file the writer cannot read
test('writeStateField refuses an edit that would push the file past 1 MiB', () => {
  const { repo, specs } = makeStateRepo(fixture);
  const near = `a: x\nb: ${'x'.repeat(1024 * 1024 - 20)}\n`;
  writeFileSync(join(specs, 'near.yaml'), near);
  const result = writeStateField(repo, 'specs/near.yaml', ['a'], 'y'.repeat(100));
  assert.equal(result.ok, false, JSON.stringify(result).slice(0, 200));
  assert.match(result.ok ? '' : result.error, /larger than 1048576 bytes/);
  assert.equal(readFileSync(join(specs, 'near.yaml'), 'utf8'), near);
});

// AC-e08s01-08, review 2 (A1, B2): in a worktree .git is a YAML-shaped file
test('writeStateField refuses to edit the .git file of a worktree', () => {
  const { repo } = makeStateRepo(fixture);
  const worktree = join(makeTempDir(), 'wt');
  git(repo, 'worktree', 'add', '-q', worktree);
  const before = readFileSync(join(worktree, '.git'), 'utf8');
  const result = writeStateField(worktree, '.git', ['gitdir'], '/elsewhere');
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.match(result.ok ? '' : result.error, /inside \.git/);
  assert.equal(readFileSync(join(worktree, '.git'), 'utf8'), before);
});
