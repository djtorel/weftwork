// story: e08s04
// The resume CLI, run as a real process in temporary repositories (e08s04
// AC-07, AC-08). Each case writes the handoff with the real handoff CLI of
// e08s03, changes the repository, then runs the check. It exits 0 only for
// ready, 1 for any other answer and 2 when it cannot read the state file or
// the repository, and it never writes the state file. The rules themselves
// are tested on resumeReport (resume.test.ts). No test touches this
// repository's own specs/state.yaml.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempDirs, git, makeStateRepo, makeTempDir, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const handoffCli = join(import.meta.dirname, 'handoff-cli.ts');
const resumeCli = join(import.meta.dirname, 'resume-cli.ts');
const fixture = readFileSync(join(import.meta.dirname, 'fixtures', 'state.yaml'), 'utf8');

type Run = { status: number | null; result: Record<string, unknown>; stderr: string };

/** Run the resume CLI in `cwd`. Its stdout must be one JSON line. */
function runResume(cwd: string, args: string[] = []): Run {
  const out = spawnSync('node', [resumeCli, ...args], { cwd, encoding: 'utf8', timeout: 20000 });
  const lines = out.stdout.split('\n').filter((line) => line !== '');
  assert.equal(lines.length, 1, `stdout: ${out.stdout} stderr: ${out.stderr}`);
  return { status: out.status, result: JSON.parse(lines[0] as string) as Record<string, unknown>, stderr: out.stderr };
}

/** A repository whose handoff the real handoff CLI wrote, on branch main,
 * naming tracked.txt. Returns the repository and its state file. */
function handedOff(): { repo: string; specs: string; state: string } {
  const made = makeStateRepo(fixture);
  const input = JSON.stringify({ next_skill: 'develop-tdd', branch: 'main', files: ['tracked.txt'], note: 'Task 1.' });
  const out = spawnSync('node', [handoffCli], { cwd: made.repo, input, encoding: 'utf8', timeout: 20000 });
  assert.equal(out.status, 0, `handoff write: ${out.stdout} ${out.stderr}`);
  return made;
}

// AC-e08s04-07
for (const [name, change, code, answer] of [
  ['nothing changed', () => {}, 0, 'ready'],
  ['another branch is checked out', (repo: string) => git(repo, 'checkout', '-q', '-b', 'other'), 1, 'stale'],
  ['a named file is deleted', (repo: string) => rmSync(join(repo, 'tracked.txt')), 1, 'stale'],
  ['an untracked file is added', (repo: string) => writeFileSync(join(repo, 'new.txt'), 'x\n'), 1, 'stale'],
] as [string, (repo: string) => void, number, string][]) {
  test(`after a real handoff write, ${name}: exit ${code}, ${answer}, the state file untouched`, () => {
    const { repo, state } = handedOff();
    const before = readFileSync(state);
    change(repo);
    const run = runResume(repo);
    assert.equal(run.status, code, JSON.stringify(run.result));
    assert.equal(run.result['answer'], answer);
    assert.deepEqual(readFileSync(state), before);
  });
}

test('a ready answer names the next skill on stderr', () => {
  const { repo } = handedOff();
  const run = runResume(repo);
  assert.equal(run.result['next_skill'], 'develop-tdd');
  assert.match(run.stderr, /ready/);
  assert.match(run.stderr, /develop-tdd/);
});

test('a stale answer lists its reasons on stderr', () => {
  const { repo } = handedOff();
  git(repo, 'checkout', '-q', '-b', 'other');
  const run = runResume(repo);
  assert.match(run.stderr, /stale/);
  assert.match(run.stderr, /other/);
});

test('the check runs from a subdirectory against the repository root', () => {
  const { repo } = handedOff();
  mkdirSync(join(repo, 'sub'));
  writeFileSync(join(repo, 'sub', 'kept.txt'), 'x\n');
  git(repo, 'add', 'sub/kept.txt');
  git(repo, 'commit', '-q', '-m', 'sub');
  assert.equal(runResume(join(repo, 'sub')).result['answer'], 'ready');
});

// AC-e08s04-08
test('a state file with no handoff key is missing, exit 1', () => {
  const { repo } = makeStateRepo('phase: planning\n');
  const run = runResume(repo);
  assert.equal(run.status, 1);
  assert.equal(run.result['answer'], 'missing');
  assert.match(run.stderr, /handoff-cli/);
});

for (const [name, dir, args] of [
  ['a state file that is not YAML', () => makeStateRepo('phase: [\n').repo, []],
  ['no state file', () => makeTestRepo(), []],
  ['a directory that is not a git repository', () => makeTempDir(), []],
  ['an argument on the command line', () => handedOff().repo, ['now']],
] as [string, () => string, string[]][]) {
  test(`${name} exits 2 and is never ready`, () => {
    const run = runResume(dir(), args);
    assert.equal(run.status, 2, JSON.stringify(run.result));
    assert.equal(run.result['ok'], false);
    assert.equal(typeof run.result['error'], 'string');
  });
}

// Security review F1 (CWE-150): a file name must not drive the terminal.
test('control characters in a path are escaped on stderr', () => {
  const { repo } = handedOff();
  writeFileSync(join(repo, 'esc\u001b[2K\rfake ready\u009b.txt'), 'x\n');
  const run = runResume(repo);
  assert.equal(run.status, 1);
  assert.doesNotMatch(run.stderr, /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/);
  assert.match(run.stderr, /esc\\u001b\[2K\\u000dfake ready\\u009b\.txt/);
  // stdout keeps the true path, JSON-escaped.
  assert.deepEqual(run.result['reasons'], [
    'esc\u001b[2K\rfake ready\u009b.txt is uncommitted now and was not when the handoff was written',
  ]);
});
