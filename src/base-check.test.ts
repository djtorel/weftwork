// story: e13s04
// The base check (base-check.ts, base-check-cli.ts): each test file the
// change adds or edits is run against the base commit, where it should fail;
// a test that passes there does not show the change (R19). It reports and
// never gates. The setting is the `proof` mapping of weftwork.yaml.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveProof } from './base-check-setting.ts';
import { cleanupTempDirs, git, isolatedEnv, makeTempDir, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const cli = join(import.meta.dirname, 'base-check-cli.ts');
const file = (text: string) => ({ path: '/repo/weftwork.yaml', text });

function run(cwd: string, input: object = {}, env: NodeJS.ProcessEnv = {}) {
  const out = spawnSync(process.execPath, [cli], { cwd, input: JSON.stringify(input), env: { ...isolatedEnv(), ...env }, encoding: 'utf8', timeout: 30000 });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

/** A repository on a branch off main, whose tests are shell scripts: a test
 * passes when it exits 0. `lib.sh` holds the code under test. */
function repo(): { dir: string; base: string } {
  const dir = makeTestRepo({ 'lib.sh': 'answer() { echo 1; }\n', 'tests/old.test.sh': '. ./lib.sh; [ "$(answer)" = 1 ]\n' });
  writeFileSync(join(dir, 'weftwork.yaml'), "---\nproof:\n  tests: ['tests/*.test.sh']\n  run: 'for t in \"$@\"; do sh \"$t\" || exit 1; done'\n");
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'setting');
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  git(dir, 'checkout', '-q', '-b', 'feat/x');
  return { dir, base };
}

test('the setting: tests and run are required together; share and timeout are optional', () => {
  assert.deepEqual(resolveProof({ user: null, repo: null }), { ok: true, proof: null });
  assert.deepEqual(resolveProof({ user: null, repo: file("---\nproof:\n  tests: ['src/**/*.test.ts']\n  run: node --test \"$@\"\n  share: [node_modules]\n") }), {
    ok: true,
    proof: { tests: ['src/**/*.test.ts'], run: 'node --test "$@"', share: ['node_modules'], timeoutSeconds: 600 },
  });
  for (const [text, error] of [
    ["proof:\n  tests: ['a']\n", /proof needs both tests and run/],
    ['proof:\n  tests: []\n  run: x\n', /proof\.tests must be a list of 1 to 50 patterns/],
    ['proof:\n  tests: [a]\n  run: x\n  share: [../up]\n', /proof\.share must be a list of paths inside the repository/],
    ['proof:\n  tests: [a]\n  run: x\n  timeout_seconds: 0\n', /proof\.timeout_seconds must be an integer from 1 to 3600/],
    ['proof:\n  tests: [a]\n  run: x\n  extra: 1\n', /proof\.extra is not a known key/],
  ] as [string, RegExp][]) {
    const result = resolveProof({ user: null, repo: file(`---\n${text}`) });
    assert.equal(result.ok, false, text);
    assert.match(result.ok ? '' : result.error, error);
  }
});

test('no proof mapping: the check is off, exit 0', () => {
  const out = run(makeTestRepo());
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^weftwork base check: off$/m);
});

test('a change that adds or edits no test: said so, exit 0', () => {
  const { dir } = repo();
  writeFileSync(join(dir, 'lib.sh'), 'answer() { echo 2; }\n');
  const out = run(dir);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^weftwork base check: no changed tests$/m);
  assert.match(out.stdout, /^why: the change adds or edits no file in proof\.tests$/m);
});

test('a test that fails on the base shows the change; one that passes there does not; neither gates (exit 0)', () => {
  const { dir, base } = repo();
  writeFileSync(join(dir, 'lib.sh'), 'answer() { echo 2; }\n');
  mkdirSync(join(dir, 'tests'), { recursive: true });
  writeFileSync(join(dir, 'tests', 'new.test.sh'), '. ./lib.sh; [ "$(answer)" = 2 ]\n');
  writeFileSync(join(dir, 'tests', 'weak.test.sh'), 'true\n');
  writeFileSync(join(dir, 'tests', 'old.test.sh'), '. ./lib.sh; [ "$(answer)" = 2 ]\n');
  git(dir, 'add', 'tests/weak.test.sh');
  git(dir, 'commit', '-q', '-m', 'weak test');
  const out = run(dir);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^weftwork base check: 2 of 3 changed test files fail on the base$/m);
  assert.match(out.stdout, /^fails on base: tests\/old\.test\.sh$/m);
  assert.match(out.stdout, new RegExp(`^base: ${base}$`, 'm'));
  assert.match(out.stdout, /^fails on base: tests\/new\.test\.sh$/m);
  assert.match(out.stdout, /^passes on base: tests\/weak\.test\.sh \(it does not show the change\)$/m);
});

test('the base worktree is removed, the working tree and index are left as they were, and no git hook runs', () => {
  const { dir } = repo();
  const marker = join(makeTempDir(), 'hook-ran');
  mkdirSync(join(dir, '.git', 'hooks'), { recursive: true });
  writeFileSync(join(dir, '.git', 'hooks', 'post-checkout'), `#!/bin/sh\ntouch ${marker}\n`, { mode: 0o755 });
  writeFileSync(join(dir, 'tests', 'new.test.sh'), 'false\n');
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' });
  assert.equal(run(dir).status, 0);
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' }), status);
  assert.equal(execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: dir, encoding: 'utf8' }).match(/^worktree /gm)?.length, 1);
  assert.equal(existsSync(marker), false);
});

test('share: a path from the working tree is linked into the base worktree, so an ignored dependency folder is there', () => {
  const { dir } = repo();
  writeFileSync(join(dir, '.gitignore'), 'deps/\n');
  mkdirSync(join(dir, 'deps'));
  writeFileSync(join(dir, 'deps', 'dep.sh'), 'dep() { echo ok; }\n');
  writeFileSync(join(dir, 'weftwork.yaml'), "---\nproof:\n  tests: ['tests/*.test.sh']\n  run: 'for t in \"$@\"; do sh \"$t\" || exit 1; done'\n  share: [deps]\n");
  writeFileSync(join(dir, 'tests', 'dep.test.sh'), '. ./deps/dep.sh; [ "$(dep)" = ok ] && exit 1; exit 0\n');
  const out = run(dir);
  assert.match(out.stdout, /^fails on base: tests\/dep\.test\.sh$/m);
});

test('a test that times out on the base is reported as such', () => {
  const { dir } = repo();
  writeFileSync(join(dir, 'weftwork.yaml'), "---\nproof:\n  tests: ['tests/*.test.sh']\n  run: 'sleep 5'\n  timeout_seconds: 1\n");
  writeFileSync(join(dir, 'tests', 'new.test.sh'), 'true\n');
  const out = run(dir);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^timed out on base: tests\/new\.test\.sh \(after 1 s\)$/m);
});

test('a base that is not a commit: exit 2, the reason on stderr', () => {
  const { dir } = repo();
  const out = run(dir, { base: 'nope' });
  assert.equal(out.status, 2);
  assert.equal(out.stdout, '');
  assert.match(out.stderr, /^base check: the base is not a commit: nope$/m);
  const worktrees = join(dir, '.git', 'worktrees');
  assert.equal(existsSync(worktrees) ? readdirSync(worktrees).length : 0, 0);
});

test('a temporary folder it cannot make: exit 2, the reason on stderr (review round 1)', () => {
  const { dir } = repo();
  writeFileSync(join(dir, 'tests', 'new.test.sh'), 'false\n');
  const out = run(dir, {}, { TMPDIR: join(makeTempDir(), 'missing') });
  assert.equal(out.status, 2, out.stderr);
  assert.equal(out.stdout, '');
  assert.match(out.stderr, /^base check: the base worktree failed: /m);
});
