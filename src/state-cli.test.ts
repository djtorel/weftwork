// story: e08s01
// The state CLI, run as a real process in temporary repositories (e08s01
// AC-07, AC-08): it writes one field through writeStateField, keeps the mode,
// leaves no temp file, and refuses a symlink, a FIFO, a file outside the
// repository, invalid YAML and a missing key, leaving every file as it was. No
// test touches this repository's own specs/state.yaml.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setField } from './state-file.ts';
import { cleanupTempDirs, makeTempDir, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const stateCli = join(import.meta.dirname, 'state-cli.ts');
const fixture = readFileSync(join(import.meta.dirname, 'fixtures', 'state.yaml'), 'utf8');

type Run = { status: number | null; result: { ok: boolean; action?: string; file?: string; error?: string } };

/** Run the state CLI in `cwd` with `input` on stdin. Its stdout must be one
 * JSON line. */
function runCli(cwd: string, input: string): Run {
  const out = spawnSync('node', [stateCli], { cwd, input, encoding: 'utf8', timeout: 20000 });
  const lines = out.stdout.split('\n').filter((line) => line !== '');
  assert.equal(lines.length, 1, `stdout: ${out.stdout} stderr: ${out.stderr}`);
  return { status: out.status, result: JSON.parse(lines[0] as string) as Run['result'] };
}

const request = (file: string, path: unknown, value: unknown): string => JSON.stringify({ file, path, value });

/** Each entry of `dir` with its text, or 'not a file', to compare before and after a run. */
function snapshot(dir: string): string[][] {
  return readdirSync(dir).map((name) => {
    const path = join(dir, name);
    return [name, statSync(path).isFile() ? readFileSync(path, 'utf8') : 'not a file'];
  });
}

/** A temporary repository with the state fixture at specs/state.yaml, mode 0640. */
function repoWithState(): { repo: string; specs: string; state: string } {
  const repo = makeTestRepo();
  const specs = join(repo, 'specs');
  mkdirSync(specs);
  const state = join(specs, 'state.yaml');
  writeFileSync(state, fixture);
  chmodSync(state, 0o640);
  return { repo, specs, state };
}

// AC-e08s01-07
test('the CLI writes one field, keeps the mode and leaves no temp file', () => {
  const { repo, specs, state } = repoWithState();
  const run = runCli(repo, request('specs/state.yaml', ['handoff', 'next_skill'], 'verify-work'));
  assert.equal(run.status, 0);
  assert.deepEqual(run.result, { ok: true, action: 'written', file: 'specs/state.yaml' });
  const expected = setField(fixture, ['handoff', 'next_skill'], 'verify-work');
  assert.ok(expected.ok);
  assert.equal(readFileSync(state, 'utf8'), expected.text);
  assert.equal(statSync(state).mode & 0o777, 0o640);
  assert.deepEqual(readdirSync(specs), ['state.yaml']);
});

test('the CLI leaves a field that already holds the value as it was', () => {
  const { repo, state } = repoWithState();
  const before = statSync(state).mtimeMs;
  const run = runCli(repo, request('specs/state.yaml', ['handoff', 'next_skill'], 'develop-tdd'));
  assert.equal(run.status, 0);
  assert.deepEqual(run.result, { ok: true, action: 'unchanged', file: 'specs/state.yaml' });
  assert.equal(readFileSync(state, 'utf8'), fixture);
  assert.equal(statSync(state).mtimeMs, before);
});

test('the file is named from the repository root, whatever the working directory', () => {
  const { specs, state } = repoWithState();
  const run = runCli(specs, request('specs/state.yaml', ['active_story'], null));
  assert.equal(run.status, 0, run.result.error ?? '');
  assert.match(readFileSync(state, 'utf8'), /^active_story: null$/m);
});

// AC-e08s01-08
test('the CLI refuses with exit 1 and leaves the files as they were', () => {
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
    ['a state file over 1 MiB', (_repo, specs) => {
      writeFileSync(join(specs, 'big.yaml'), `a: ${'x'.repeat(1024 * 1024)}\n`);
      return 'specs/big.yaml';
    }, ['a'], /larger than 1048576 bytes/],
  ];
  for (const [label, arrange, path, message] of cases) {
    const { repo, specs } = repoWithState();
    const file = arrange(repo, specs);
    const before = snapshot(specs);
    const run = runCli(repo, request(file, path, 'x'));
    assert.equal(run.status, 1, `${label}: ${JSON.stringify(run.result)}`);
    assert.equal(run.result.ok, false, label);
    assert.match(run.result.error ?? '', message, label);
    const after = snapshot(specs);
    assert.deepEqual(after, before, label);
  }
});

test('the CLI answers exit 2 for input it cannot read', () => {
  const { repo } = repoWithState();
  const cases: [string, string, string][] = [
    ['stdin that is not JSON', repo, '{"file":'],
    ['a path that is not a list of strings', repo, request('specs/state.yaml', 'handoff.next_skill', 'x')],
    ['a path with a number in it', repo, request('specs/state.yaml', ['handoff', 1], 'x')],
    ['a value that is an object', repo, request('specs/state.yaml', ['active_story'], { a: 1 })],
    ['no file', repo, JSON.stringify({ path: ['active_story'], value: 'x' })],
    ['an empty path (review A6, B5)', repo, request('specs/state.yaml', [], 'x')],
    ['a value that is not finite (review B5)', repo, '{"file":"specs/state.yaml","path":["active_story"],"value":1e999}'],
    ['stdin over 1 MiB', repo, request('specs/state.yaml', ['active_story'], 'x'.repeat(1024 * 1024))],
    ['a working directory that is not in a git repository', makeTempDir(), request('state.yaml', ['a'], 'x')],
  ];
  for (const [label, cwd, input] of cases) {
    const run = runCli(cwd, input);
    assert.equal(run.status, 2, `${label}: ${JSON.stringify(run.result)}`);
    assert.equal(run.result.ok, false, label);
    assert.ok((run.result.error ?? '').length > 0, label);
  }
  assert.equal(readFileSync(join(repo, 'specs', 'state.yaml'), 'utf8'), fixture);
});
