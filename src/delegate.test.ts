// The hand-off (delegate.ts, weftwork-cli.ts): a weftwork that is not the
// project's own runs the project's, with the same arguments, stdin and exit
// code, and never hands off twice.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { delegateTarget, repoOf } from './delegate.ts';
import { devDependencyBin, engineBin } from './launcher.ts';
import { gitCommonDir } from './setup.ts';
import { cleanupTempDirs, makeTempDir, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const cli = join(import.meta.dirname, 'weftwork-cli.ts');
const ownBin = join(import.meta.dirname, '..', 'bin', 'weftwork.js');

/** A fake weftwork at `path` that prints its name, arguments and stdin, and
 * exits 3. */
function fake(path: string, name: string): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `#!/bin/sh\necho "${name}:$*:$(cat)"\nexit 3\n`, { mode: 0o755 });
  return path;
}

function run(cwd: string, args: string[], env: Record<string, string> = {}) {
  const base = { ...process.env };
  delete base.WEFTWORK_BIN;
  delete base.WEFTWORK_DELEGATED;
  return spawnSync(process.execPath, [cli, ...args], { cwd, input: 'in', env: { ...base, ...env }, encoding: 'utf8', timeout: 20000 });
}

test('a weftwork run in a project with its own install hands the command to it, with stdin and the exit code', () => {
  const repo = makeTestRepo();
  fake(engineBin(gitCommonDir(repo) ?? ''), 'local');
  const sub = join(repo, 'sub');
  mkdirSync(sub);
  const ran = run(sub, ['review', '--x']);
  assert.equal(ran.stdout, 'local:review --x:in\n');
  assert.equal(ran.status, 3);
});

test('a dev dependency is handed the command when the clone has no install of its own', () => {
  const repo = makeTestRepo();
  fake(devDependencyBin(repo), 'dev');
  assert.equal(run(repo, ['path']).stdout, 'dev:path:in\n');
});

test('a run already handed off, or with no project weftwork, runs here', () => {
  const repo = makeTestRepo();
  const root = realpathSync(join(import.meta.dirname, '..'));
  assert.equal(realpathSync(run(repo, ['path']).stdout.trim()), root);
  fake(engineBin(gitCommonDir(repo) ?? ''), 'local');
  assert.equal(realpathSync(run(repo, ['path'], { WEFTWORK_DELEGATED: '1' }).stdout.trim()), root);
});

test('WEFTWORK_BIN comes first, and naming this weftwork itself hands off to nothing', () => {
  const repo = makeTestRepo();
  fake(engineBin(gitCommonDir(repo) ?? ''), 'local');
  const own = fake(join(makeTempDir(), 'mine'), 'own');
  assert.equal(run(repo, ['path'], { WEFTWORK_BIN: own }).stdout, 'own:path:in\n');
  const repoInfo = repoOf(repo);
  assert.equal(delegateTarget({ WEFTWORK_BIN: ownBin }, repoInfo, ownBin), null);
});

test('the first executable candidate decides: when it is this weftwork, a later one is not tried', () => {
  const repo = makeTestRepo();
  const info = repoOf(repo);
  assert.ok(info !== null);
  const local = engineBin(info.commonDir);
  mkdirSync(dirname(local), { recursive: true });
  // The clone's install is a link to this very weftwork, as npm makes it.
  symlinkSync(ownBin, local);
  fake(devDependencyBin(repo), 'dev');
  assert.equal(delegateTarget({}, info, ownBin), null);
});

test('outside a git repository there is no repo, and only WEFTWORK_BIN can be handed the command', () => {
  const dir = makeTempDir();
  assert.equal(repoOf(dir), null);
  assert.equal(delegateTarget({}, null, ownBin), null);
});
