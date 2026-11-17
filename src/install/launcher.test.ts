// The resolver every hook and the session's Bash commands use to find the
// weftwork command (launcher.ts): WEFTWORK_BIN, this clone's own install, the
// project's dev dependency, PATH, else exit 2 with the fix. Run in each shell
// Claude Code may use.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { devDependencyBin, engineBin, missingWeftwork, resolved } from './launcher.ts';
import { cleanupTempDirs, makeTempDir, makeTestRepo } from '../test-support/test-helpers.ts';

after(cleanupTempDirs);

const shells = ['/bin/sh', '/usr/bin/bash', '/usr/bin/zsh', '/bin/dash'].filter((shell) => existsSync(shell));
const git = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();

/** A fake weftwork at `path` that prints `<name>:` and its arguments. */
function fake(path: string, name: string): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `#!/bin/sh\necho "${name}:$*"\n`, { mode: 0o755 });
  return path;
}

/** A folder with only git in it (and a fake global weftwork when asked), for PATH. */
function pathDir(global: boolean): string {
  const dir = makeTempDir();
  writeFileSync(join(dir, 'git'), `#!/bin/sh\nexec ${git} "$@"\n`, { mode: 0o755 });
  if (global) fake(join(dir, 'weftwork'), 'global');
  return dir;
}

function run(shell: string, cwd: string, path: string, env: Record<string, string> = {}) {
  return spawnSync(shell, ['-c', resolved("guard 'a b'")], { cwd, env: { PATH: path, ...env }, encoding: 'utf8', timeout: 20000 });
}

for (const shell of shells) {
  test(`${shell}: the resolver takes WEFTWORK_BIN, then the clone's install, then a dev dependency, then PATH`, () => {
    const repo = makeTestRepo();
    const onPath = pathDir(true);
    assert.equal(run(shell, repo, onPath).stdout, 'global:guard a b\n');
    fake(devDependencyBin(repo), 'dev');
    assert.equal(run(shell, repo, onPath).stdout, 'dev:guard a b\n');
    fake(engineBin(join(repo, '.git')), 'local');
    assert.equal(run(shell, repo, onPath).stdout, 'local:guard a b\n');
    const own = fake(join(makeTempDir(), 'mine'), 'own');
    assert.equal(run(shell, repo, onPath, { WEFTWORK_BIN: own }).stdout, 'own:guard a b\n');
  });

  test(`${shell}: the resolver finds the clone's install from a subfolder, a worktree, and CLAUDE_PROJECT_DIR`, () => {
    const repo = makeTestRepo();
    fake(engineBin(join(repo, '.git')), 'local');
    const sub = join(repo, 'sub');
    mkdirSync(sub);
    const onPath = pathDir(false);
    assert.equal(run(shell, sub, onPath).stdout, 'local:guard a b\n');
    const tree = join(makeTempDir(), 'tree');
    spawnSync('git', ['-C', repo, 'worktree', 'add', '-q', '-b', 'other', tree]);
    assert.equal(run(shell, tree, onPath).stdout, 'local:guard a b\n', 'a worktree shares the common dir');
    assert.equal(run(shell, makeTempDir(), onPath, { CLAUDE_PROJECT_DIR: repo }).stdout, 'local:guard a b\n');
  });

  test(`${shell}: with no weftwork anywhere the resolver exits 2 and says how to install it`, () => {
    const ran = run(shell, makeTestRepo(), pathDir(false));
    assert.equal(ran.status, 2);
    assert.equal(ran.stdout, '');
    assert.equal(ran.stderr, `${missingWeftwork}\n`);
  });

  test(`${shell}: a candidate that is not executable is passed over, and the exit status is weftwork's`, () => {
    const repo = makeTestRepo();
    mkdirSync(dirname(devDependencyBin(repo)), { recursive: true });
    writeFileSync(devDependencyBin(repo), 'not a program', { mode: 0o644 });
    const onPath = pathDir(false);
    writeFileSync(join(onPath, 'weftwork'), '#!/bin/sh\nexit 7\n', { mode: 0o755 });
    assert.equal(run(shell, repo, onPath).status, 7);
  });

  test(`${shell}: a folder at a candidate path is passed over, so a hook still blocks (review r1s1)`, () => {
    const repo = makeTestRepo();
    mkdirSync(devDependencyBin(repo), { recursive: true });
    const ran = run(shell, repo, pathDir(false), { WEFTWORK_BIN: repo });
    assert.equal(ran.status, 2, ran.stderr);
    assert.equal(ran.stderr, `${missingWeftwork}\n`);
  });
}
