// story: e07s04
// The live check command through the real CLIs (e07s04 AC-08, AC-09): the
// install, the adapter as the host calls it, and the check, in a temporary
// repository. HOME and CLAUDE_CONFIG_DIR point at temporary directories, so no
// test reads this machine's own Claude Code settings.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempDirs, makeTempDir, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const checkCli = join(import.meta.dirname, 'claude-live-cli.ts');
const installCli = join(import.meta.dirname, 'claude-install-cli.ts');
const hookCli = join(import.meta.dirname, 'claude-hook-cli.ts');

/** An environment with a fresh, empty home and no CLAUDE_CONFIG_DIR, unless
 * `configDir` names one. */
function cleanEnv(configDir: string | null = null): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: makeTempDir() };
  delete env.CLAUDE_CONFIG_DIR;
  delete env.CLAUDE_PROJECT_DIR;
  if (configDir !== null) {
    env.CLAUDE_CONFIG_DIR = configDir;
  }
  return env;
}

/** Where and how a CLI runs: its directory, its whole environment, its stdin. */
type At = { cwd: string; env: NodeJS.ProcessEnv; input?: string };

/** Run `argv` (a script and its arguments) with node. */
function run(argv: string[], at: At) {
  const out = spawnSync(process.execPath, argv, { ...at, input: at.input ?? '', encoding: 'utf8' });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

/** Call the adapter the way Claude Code does at a stop. */
function callHook(repo: string, env: NodeJS.ProcessEnv, command: string) {
  const input = JSON.stringify({ hook_event_name: 'Stop', cwd: repo, stop_hook_active: false });
  return run([hookCli, '--', command], { cwd: makeTempDir(), env: { ...env, CLAUDE_PROJECT_DIR: repo }, input });
}

test('AC-e07s04-08 not registered, then registered but not seen, then live', () => {
  const repo = makeTestRepo();
  const env = cleanEnv();
  const none = run([checkCli], { cwd: repo, env });
  assert.equal(none.status, 1, none.stderr);
  assert.match(none.stdout, /not registered/);
  assert.match(none.stdout, /claude-install-cli\.ts/);

  assert.equal(run([installCli, '--', 'true'], { cwd: repo, env }).status, 0);
  const unseen = run([checkCli], { cwd: repo, env });
  assert.equal(unseen.status, 1, unseen.stderr);
  assert.match(unseen.stdout, /registered, not seen/);

  assert.equal(callHook(repo, env, 'true').status, 0);
  const live = run([checkCli], { cwd: repo, env });
  assert.equal(live.status, 0, live.stdout + live.stderr);
  assert.match(live.stdout, /^weftwork live check: live$/m);
});

test('AC-e07s04-08 disableAllHooks in settings.local.json: not seen, the file named', () => {
  const repo = makeTestRepo();
  const env = cleanEnv();
  run([installCli, '--', 'true'], { cwd: repo, env });
  callHook(repo, env, 'true');
  writeFileSync(join(repo, '.claude', 'settings.local.json'), '{"disableAllHooks": true}\n');
  const out = run([checkCli], { cwd: repo, env });
  assert.equal(out.status, 1);
  assert.match(out.stdout, /registered, not seen/);
  assert.match(out.stdout, /disableAllHooks is true in .*settings\.local\.json/);
});

test('AC-e07s04-08 CLAUDE_CONFIG_DIR, not HOME, holds the user settings', () => {
  const repo = makeTestRepo();
  const config = makeTempDir();
  writeFileSync(join(config, 'settings.json'), '{"disableAllHooks": true}\n');
  const env = cleanEnv(config);
  run([installCli, '--', 'true'], { cwd: repo, env });
  callHook(repo, env, 'true');
  const out = run([checkCli], { cwd: repo, env });
  assert.equal(out.status, 1);
  assert.ok(out.stdout.includes(join(config, 'settings.json')), out.stdout);
});

test('AC-e07s04-08 a symlinked user settings file is read, as Claude Code reads it', () => {
  const repo = makeTestRepo();
  const config = makeTempDir();
  const real = join(makeTempDir(), 'dotfiles-settings.json');
  writeFileSync(real, '{}\n');
  symlinkSync(real, join(config, 'settings.json'));
  const env = cleanEnv(config);
  run([installCli, '--', 'true'], { cwd: repo, env });
  callHook(repo, env, 'true');
  const out = run([checkCli], { cwd: repo, env });
  assert.equal(out.status, 0, out.stdout);
  writeFileSync(real, '{"disableAllHooks": true}\n');
  assert.match(run([checkCli], { cwd: repo, env }).stdout, /disableAllHooks is true/);
});

test('an empty CLAUDE_CONFIG_DIR is unset, so HOME holds the user settings (review A-F7)', () => {
  const repo = makeTestRepo();
  const env = cleanEnv('');
  const home = env.HOME ?? '';
  mkdirSync(join(home, '.claude'));
  writeFileSync(join(home, '.claude', 'settings.json'), '{"disableAllHooks": true}\n');
  run([installCli, '--', 'true'], { cwd: repo, env });
  callHook(repo, env, 'true');
  const out = run([checkCli], { cwd: repo, env });
  assert.equal(out.status, 1);
  assert.ok(out.stdout.includes(join(home, '.claude', 'settings.json')), out.stdout);
});

test('an empty HOME with no CLAUDE_CONFIG_DIR: the user settings are not read (review round 3, A2, B-5)', () => {
  const repo = makeTestRepo();
  const env = { ...cleanEnv(), HOME: '' };
  run([installCli, '--', 'true'], { cwd: repo, env });
  callHook(repo, env, 'true');
  const out = run([checkCli], { cwd: repo, env });
  assert.equal(out.status, 1);
  assert.match(out.stdout, /cannot tell whether hooks are on/);
});

test('AC-e07s04-08 a changed entry is not seen until the host calls it again', () => {
  const repo = makeTestRepo();
  const env = cleanEnv();
  run([installCli, '--', 'true'], { cwd: repo, env });
  callHook(repo, env, 'true');
  run([installCli, '--', 'test -d .git'], { cwd: repo, env });
  assert.equal(run([checkCli], { cwd: repo, env }).status, 1);
  callHook(repo, env, 'test -d .git');
  assert.equal(run([checkCli], { cwd: repo, env }).status, 0);
});

test('AC-e07s04-09 a directory that is not a repository: exit 1, nothing written', () => {
  const dir = makeTempDir();
  const out = run([checkCli], { cwd: dir, env: cleanEnv() });
  assert.equal(out.status, 1);
  assert.match(out.stderr, /not the root of a git repository/);
  assert.equal(existsSync(join(dir, '.claude')), false);
});

test('AC-e07s04-09 arguments are refused with the usage', () => {
  const repo = makeTestRepo();
  mkdirSync(join(repo, '.claude'));
  const out = run([checkCli, '--', 'true'], { cwd: repo, env: cleanEnv() });
  assert.equal(out.status, 1);
  assert.match(out.stderr, /usage/);
});
