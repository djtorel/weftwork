// story: e07s01
// The real Claude Code hook CLI, started as a child process against
// temporary git repositories (e07s01 AC-06 to AC-09). No case touches this
// repository's own ledger: a `false` run there would trip its stop rules.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { cleanupTempDirs, makeTempDir, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const cliPath = join(import.meta.dirname, 'claude-hook-cli.ts');

/** Run the CLI from a directory that is not the repository, so only the
 * hook's `cwd` field can say where the command runs. */
function runHook(input: string, args: string[]) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    input,
    cwd: makeTempDir(),
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function stopInput(repo: string): string {
  return JSON.stringify({ hook_event_name: 'Stop', cwd: repo, stop_hook_active: false });
}

test('AC-e07s01-06 a failing command blocks the stop', () => {
  const repo = makeTestRepo();
  const out = runHook(stopInput(repo), ['--', 'false']);
  assert.equal(out.status, 2);
  assert.match(out.stderr, /not done \(failed/);
  assert.equal(out.stdout, '');
});

test('AC-e07s01-07 a passing command allows the stop', () => {
  const repo = makeTestRepo();
  const out = runHook(stopInput(repo), ['--', 'true']);
  assert.equal(out.status, 0);
  assert.equal(out.stdout, '');
});

test("AC-e07s01-07 the command runs in the hook's cwd", () => {
  const repo = makeTestRepo({ 'marker.txt': 'here\n' });
  assert.equal(runHook(stopInput(repo), ['--', 'test -f marker.txt']).status, 0);
  assert.equal(runHook(stopInput(repo), ['--', 'test -f nothing.txt']).status, 2);
});

test("AC-e07s01-08 the command's output does not reach stdout", () => {
  const repo = makeTestRepo();
  const out = runHook(stopInput(repo), ['--', 'echo hello; exit 1']);
  assert.equal(out.status, 2);
  assert.equal(out.stdout, '');
  assert.match(out.stderr, /hello/);
});

test('AC-e07s01-09 input that is not JSON blocks the stop', () => {
  const out = runHook('not json', ['--', 'true']);
  assert.equal(out.status, 2);
  assert.match(out.stderr, /unreadable hook input/);
  assert.equal(out.stdout, '');
});

test('AC-e07s01-09 no command argument blocks the stop', () => {
  const repo = makeTestRepo();
  const out = runHook(stopInput(repo), []);
  assert.equal(out.status, 2);
  assert.match(out.stderr, /usage/);
  assert.equal(out.stdout, '');
});

test('AC-e07s01-09 more than one command argument blocks the stop', () => {
  const repo = makeTestRepo();
  const out = runHook(stopInput(repo), ['--', 'true', 'extra']);
  assert.equal(out.status, 2);
  assert.match(out.stderr, /usage/);
});
