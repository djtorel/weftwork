// story: e07s03
// The install command, run as a real process in temporary repositories
// (e07s03 AC-07 to AC-10): it adds the entry, keeps an existing file, is
// idempotent, and refuses a bad, symlinked or non-regular settings file and a
// directory that is not a repository. No test touches this repository's own
// settings.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { hookTimeoutSeconds } from './claude-hook.ts';
import { isRecord } from './json.ts';
import { cleanupTempDirs, makeTempDir, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const installCli = join(import.meta.dirname, 'claude-install-cli.ts');
const adapterCli = join(import.meta.dirname, 'claude-hook-cli.ts');

type Run = { status: number | null; stdout: string; stderr: string };

/** Run the install command in `cwd`, with the arguments the owner would type. */
function install(cwd: string, ...args: string[]): Run {
  const result = spawnSync('node', [installCli, ...args], { cwd, encoding: 'utf8', timeout: 20000 });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function settingsPath(repo: string): string {
  return join(repo, '.claude', 'settings.json');
}

function readSettings(repo: string): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(settingsPath(repo), 'utf8'));
  assert.ok(isRecord(value));
  return value;
}

/** The first group of hooks.Stop, with its hooks list. */
function firstStopGroup(settings: Record<string, unknown>): { hooks: unknown[] } {
  assert.ok(isRecord(settings.hooks));
  assert.ok(Array.isArray(settings.hooks.Stop));
  const group: unknown = settings.hooks.Stop[0];
  assert.ok(isRecord(group) && Array.isArray(group.hooks));
  return { hooks: group.hooks };
}

test('AC-e07s03-07 a repository with no .claude directory gets the entry', () => {
  const repo = makeTestRepo();
  const run = install(repo, '--', 'npm test');
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^added/);
  assert.match(run.stdout, /trust/i);
  assert.match(run.stdout, /new Claude Code session/);
  assert.match(run.stdout, /this machine/);
  const group = firstStopGroup(readSettings(repo));
  assert.deepEqual(group.hooks, [
    { type: 'command', command: `node '${adapterCli}' -- 'npm test'`, timeout: hookTimeoutSeconds },
  ]);
});

test('AC-e07s03-07 the written entry runs the real adapter and blocks a failing command', () => {
  const repo = makeTestRepo();
  assert.equal(install(repo, '--', 'false').status, 0);
  const hooks = readSettings(repo).hooks;
  assert.ok(isRecord(hooks) && Array.isArray(hooks.Stop));
  const group: unknown = hooks.Stop[0];
  assert.ok(isRecord(group) && Array.isArray(group.hooks));
  const entry: unknown = group.hooks[0];
  assert.ok(isRecord(entry) && typeof entry.command === 'string');
  const run = spawnSync('sh', ['-c', entry.command], {
    cwd: repo,
    input: '{}',
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
    timeout: 30000,
  });
  assert.equal(run.status, 2, run.stderr);
});

test('AC-e07s03-08 an existing file keeps its other hooks and a second run changes nothing', () => {
  const repo = makeTestRepo();
  mkdirSync(join(repo, '.claude'));
  const before = { env: { A: '1' }, hooks: { PreToolUse: [{ matcher: 'Bash' }] } };
  writeFileSync(settingsPath(repo), JSON.stringify(before));
  assert.equal(install(repo, '--', 'npm test').status, 0);
  const kept = readSettings(repo);
  assert.deepEqual(kept.env, before.env);
  assert.ok(isRecord(kept.hooks));
  assert.deepEqual(kept.hooks.PreToolUse, before.hooks.PreToolUse);

  const bytes = readFileSync(settingsPath(repo));
  const old = new Date('2020-01-01T00:00:00Z');
  utimesSync(settingsPath(repo), old, old);
  const again = install(repo, '--', 'npm test');
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /^unchanged/);
  assert.deepEqual(readFileSync(settingsPath(repo)), bytes);
  assert.equal(statSync(settingsPath(repo)).mtimeMs, old.getTime());
});

test('AC-e07s03-08 a new command replaces the entry and says so', () => {
  const repo = makeTestRepo();
  assert.equal(install(repo, '--', 'npm test').status, 0);
  const run = install(repo, '--', 'npm run check');
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /replaced/);
  const text = readFileSync(settingsPath(repo), 'utf8');
  assert.match(text, /npm run check/);
  assert.doesNotMatch(text, /npm test/);
});

test('AC-e07s03-08 a leftover temporary file is not left behind', () => {
  const repo = makeTestRepo();
  assert.equal(install(repo, '--', 'npm test').status, 0);
  const files = execFileSync('ls', ['-A', join(repo, '.claude')], { encoding: 'utf8' });
  assert.equal(files.trim(), 'settings.json');
});

test('AC-e07s03-09 a settings file that is not JSON is refused and left alone', () => {
  const repo = makeTestRepo();
  mkdirSync(join(repo, '.claude'));
  writeFileSync(settingsPath(repo), '{ not json');
  const run = install(repo, '--', 'npm test');
  assert.equal(run.status, 1);
  assert.match(run.stderr, /not valid JSON/);
  assert.equal(readFileSync(settingsPath(repo), 'utf8'), '{ not json');
});

test('AC-e07s03-09 a settings file that is a symlink is refused and its target is untouched', () => {
  const repo = makeTestRepo();
  const target = join(makeTempDir(), 'real.json');
  writeFileSync(target, '{}\n');
  mkdirSync(join(repo, '.claude'));
  symlinkSync(target, settingsPath(repo));
  const run = install(repo, '--', 'npm test');
  assert.equal(run.status, 1);
  assert.match(run.stderr, /regular file/);
  assert.equal(readFileSync(target, 'utf8'), '{}\n');
});

test('AC-e07s03-09 a settings file that is a directory is refused', () => {
  const repo = makeTestRepo();
  mkdirSync(settingsPath(repo), { recursive: true });
  const run = install(repo, '--', 'npm test');
  assert.equal(run.status, 1);
  assert.match(run.stderr, /regular file/);
});

test('AC-e07s03-09 a .claude directory that is a symlink is refused', () => {
  const repo = makeTestRepo();
  const elsewhere = makeTempDir();
  symlinkSync(elsewhere, join(repo, '.claude'));
  const run = install(repo, '--', 'npm test');
  assert.equal(run.status, 1);
  assert.match(run.stderr, /\.claude/);
  assert.equal(existsSync(join(elsewhere, 'settings.json')), false);
});

test('AC-e07s03-09 a settings file that is a FIFO is refused at once', () => {
  const repo = makeTestRepo();
  mkdirSync(join(repo, '.claude'));
  execFileSync('mkfifo', [settingsPath(repo)]);
  const run = install(repo, '--', 'npm test');
  assert.equal(run.status, 1);
  assert.match(run.stderr, /regular file/);
});

test('AC-e07s03-10 a directory that is not a repository is refused', () => {
  const dir = makeTempDir();
  const run = install(dir, '--', 'npm test');
  assert.equal(run.status, 1);
  assert.match(run.stderr, /git repository/);
  assert.equal(existsSync(join(dir, '.claude')), false);
});

test('AC-e07s03 a bad argument list prints usage and writes nothing', () => {
  const repo = makeTestRepo();
  for (const args of [[], ['npm test'], ['--'], ['--', 'a', 'b'], ['--', '  ']]) {
    const run = install(repo, ...args);
    assert.equal(run.status, 1, JSON.stringify(args));
    assert.match(run.stderr, /usage/i, JSON.stringify(args));
  }
  assert.equal(existsSync(join(repo, '.claude')), false);
});
