// `weftwork init` from the terminal: the current folder by default, a dry run
// when it cannot ask, and a write with --yes.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempDirs, isolatedEnv, makeTempDir, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const bin = join(import.meta.dirname, 'weftwork-cli.ts');

function weftwork(args: string[], cwd: string) {
  const out = spawnSync(process.execPath, [bin, ...args], { cwd, input: '', env: isolatedEnv(), encoding: 'utf8', timeout: 60000 });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

test('weftwork init with no path plans the current folder and, with no terminal to ask in, writes nothing', () => {
  const repo = realpathSync(makeTestRepo());
  const out = weftwork(['init', '--no-run'], repo);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, new RegExp(`Plan for ${repo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(out.stdout, /create +AGENTS\.md/);
  assert.match(out.stdout, /--yes/, 'it says how to write');
  assert.equal(existsSync(join(repo, 'AGENTS.md')), false, 'a dry run writes nothing');
});

test('weftwork init <path> --yes takes the recommended answers and writes the plan', () => {
  const repo = realpathSync(makeTestRepo());
  const out = weftwork(['init', repo, '--yes', '--no-run'], makeTempDir());
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /wrote +AGENTS\.md/);
  assert.equal(existsSync(join(repo, 'AGENTS.md')), true);
});

test('weftwork init with a bad option exits 2 with the usage on stderr', () => {
  const out = weftwork(['init', '--nope'], makeTempDir());
  assert.equal(out.status, 2);
  assert.match(out.stderr, /Usage: weftwork init \[path\]/);
});
