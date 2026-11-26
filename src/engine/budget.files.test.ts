// story: e09s01, e09s03
// applyBudget: find weftwork.yaml at the repository root and the user file
// under XDG_CONFIG_HOME (or ~/.config), read both under the file rules, and
// set both limits on the request. Every test passes its own env, so none reads
// the real user file (spec R6).
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyBudget } from './budget.ts';
import type { GateRequest } from './gate.ts';
import { cleanupTempDirs, makeTempDir, makeTestRepo } from '../test-support/test-helpers.ts';

after(cleanupTempDirs);

function request(cwd: string, over: Partial<GateRequest> = {}): GateRequest {
  return { command: 'true', cwd, timeoutMs: 1234, ...over };
}

/** A config home with weftwork/config.yaml holding `text`. */
function configHome(text: string): string {
  const home = makeTempDir();
  mkdirSync(join(home, 'weftwork'));
  writeFileSync(join(home, 'weftwork', 'config.yaml'), text);
  return home;
}

async function limitsOf(req: GateRequest, env: NodeJS.ProcessEnv) {
  const result = await applyBudget(req, env);
  assert.ok(result.ok, result.ok ? '' : result.error);
  return result.request;
}

async function errorOf(req: GateRequest, env: NodeJS.ProcessEnv): Promise<string> {
  const result = await applyBudget(req, env);
  assert.equal(result.ok, false, 'expected an error');
  return result.ok ? '' : result.error;
}

const noUser = (): NodeJS.ProcessEnv => ({ XDG_CONFIG_HOME: makeTempDir() });

test('with no files both limits are set to the built-in defaults, and the rest is kept', async () => {
  const repo = makeTestRepo();
  const got = await limitsOf(request(repo), noUser());
  assert.deepEqual(got, { command: 'true', cwd: repo, timeoutMs: 1234, maxFailures: 5, stallAfter: 3 });
});

test('weftwork.yaml at the repository root is read from a subdirectory', async () => {
  const repo = makeTestRepo({ 'weftwork.yaml': 'budget:\n  max_failures: 2\n' });
  mkdirSync(join(repo, 'sub'));
  const got = await limitsOf(request(join(repo, 'sub')), noUser());
  assert.equal(got.maxFailures, 2);
});

test('the user file under XDG_CONFIG_HOME is read, and the repository file overrides it', async () => {
  const home = configHome('budget:\n  max_failures: 2\n  stall_after: 4\n');
  const repo = makeTestRepo({ 'weftwork.yaml': 'budget:\n  max_failures: 7\n' });
  const got = await limitsOf(request(repo), { XDG_CONFIG_HOME: home });
  assert.equal(got.maxFailures, 7);
  assert.equal(got.stallAfter, 4);
});

test('without XDG_CONFIG_HOME the user file is under HOME/.config', async () => {
  const home = makeTempDir();
  mkdirSync(join(home, '.config', 'weftwork'), { recursive: true });
  writeFileSync(join(home, '.config', 'weftwork', 'config.yaml'), 'budget:\n  stall_after: 6\n');
  const repo = makeTestRepo();
  assert.equal((await limitsOf(request(repo), { HOME: home })).stallAfter, 6);
  assert.equal((await limitsOf(request(repo), { HOME: home, XDG_CONFIG_HOME: '' })).stallAfter, 6);
  assert.equal((await limitsOf(request(repo), { HOME: home, XDG_CONFIG_HOME: 'rel/dir' })).stallAfter, 6);
});

test('with neither HOME nor XDG_CONFIG_HOME only the repository file applies', async () => {
  const repo = makeTestRepo({ 'weftwork.yaml': 'budget:\n  stall_after: 2\n' });
  assert.equal((await limitsOf(request(repo), {})).stallAfter, 2);
});

test('outside a repository only the user file applies', async () => {
  const home = configHome('budget:\n  max_failures: 3\n');
  const dir = makeTempDir();
  writeFileSync(join(dir, 'weftwork.yaml'), 'budget:\n  max_failures: 1\n');
  assert.equal((await limitsOf(request(dir), { XDG_CONFIG_HOME: home })).maxFailures, 3);
});

test('a lower request value is kept, a higher one is lowered', async () => {
  const repo = makeTestRepo({ 'weftwork.yaml': 'budget:\n  max_failures: 4\n' });
  assert.equal((await limitsOf(request(repo, { maxFailures: 2 }), noUser())).maxFailures, 2);
  assert.equal((await limitsOf(request(repo, { maxFailures: 9 }), noUser())).maxFailures, 4);
});

test('a symlinked weftwork.yaml is refused', async () => {
  const repo = makeTestRepo();
  const target = join(makeTempDir(), 'good.yaml');
  writeFileSync(target, 'budget:\n  max_failures: 2\n');
  symlinkSync(target, join(repo, 'weftwork.yaml'));
  assert.match(await errorOf(request(repo), noUser()), /weftwork\.yaml/);
});

test('a symlinked user file is followed', async () => {
  const home = makeTempDir();
  mkdirSync(join(home, 'weftwork'));
  const target = join(makeTempDir(), 'dotfile.yaml');
  writeFileSync(target, 'budget:\n  max_failures: 2\n');
  symlinkSync(target, join(home, 'weftwork', 'config.yaml'));
  const repo = makeTestRepo();
  assert.equal((await limitsOf(request(repo), { XDG_CONFIG_HOME: home })).maxFailures, 2);
});

test('a weftwork.yaml that is a directory is refused', async () => {
  const repo = makeTestRepo();
  mkdirSync(join(repo, 'weftwork.yaml'));
  assert.match(await errorOf(request(repo), noUser()), /weftwork\.yaml/);
});

test('a weftwork.yaml over 64 KiB is refused, naming the cap', async () => {
  const repo = makeTestRepo({ 'weftwork.yaml': `# ${'x'.repeat(64 * 1024)}\n` });
  const error = await errorOf(request(repo), noUser());
  assert.match(error, /weftwork\.yaml/);
  assert.match(error, /65536/);
});

test('a weftwork.yaml of exactly 64 KiB is read', async () => {
  const body = 'budget:\n  max_failures: 2\n# ';
  const repo = makeTestRepo({ 'weftwork.yaml': `${body}${'x'.repeat(64 * 1024 - body.length - 1)}\n` });
  assert.equal((await limitsOf(request(repo), noUser())).maxFailures, 2);
});

test('a bad value in weftwork.yaml is refused with the full path and key', async () => {
  const repo = makeTestRepo({ 'weftwork.yaml': 'budget:\n  max_failures: 0\n' });
  const error = await errorOf(request(repo), noUser());
  assert.ok(error.includes(join(repo, 'weftwork.yaml')), error);
  assert.ok(error.includes('budget.max_failures'), error);
});

test('AC-e09s03-07 a reserveRuns on the request is replaced by the files, or dropped', async () => {
  const set = makeTestRepo({ 'weftwork.yaml': 'budget:\n  reserve_runs: 2\n' });
  assert.equal((await limitsOf(request(set, { reserveRuns: 0 }), noUser())).reserveRuns, 2);
  const unset = makeTestRepo();
  assert.equal('reserveRuns' in (await limitsOf(request(unset, { reserveRuns: 0 }), noUser())), false);
});

test('a Stop hook request takes its command limit from budget.stop_hook_timeout_seconds', async () => {
  const repo = makeTestRepo({ 'weftwork.yaml': 'budget:\n  stop_hook_timeout_seconds: 2400\n' });
  const got = await limitsOf(request(repo, { stopHook: 'key' }), noUser());
  assert.equal(got.timeoutMs, 2400000);
});

test('a Stop hook request with no setting gets the 1800 s default', async () => {
  const got = await limitsOf(request(makeTestRepo(), { stopHook: 'key' }), noUser());
  assert.equal(got.timeoutMs, 1800000);
});

test('an engine CLI request keeps its own timeoutMs whatever budget.stop_hook_timeout_seconds says', async () => {
  const repo = makeTestRepo({ 'weftwork.yaml': 'budget:\n  stop_hook_timeout_seconds: 2400\n' });
  const got = await limitsOf(request(repo), noUser());
  assert.equal(got.timeoutMs, 1234);
});
