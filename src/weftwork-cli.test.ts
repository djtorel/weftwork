// story: e12s02
// The `weftwork` command: one entry for every CLI, so a project's skills can
// call `weftwork <command>` from any folder instead of naming this checkout.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempDirs, isolatedEnv, makeTempDir, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const bin = join(import.meta.dirname, 'weftwork-cli.ts');

function weftwork(args: string[], input = '', cwd = makeTempDir()) {
  const out = spawnSync(process.execPath, [bin, ...args], { cwd, input, env: isolatedEnv(), encoding: 'utf8', timeout: 60000 });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

test('AC-e12s02-24 weftwork <command> runs src/<command>-cli.ts with its stdin and arguments; engine runs src/cli.ts', () => {
  const dir = makeTempDir();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'node -e 0' } }));
  const detected = weftwork(['detect'], JSON.stringify({ path: dir, run: false }));
  assert.equal(detected.status, 0, detected.stderr);
  assert.deepEqual(JSON.parse(detected.stdout).report.packageManagers, ['npm']);
  const repo = makeTestRepo();
  const listed = weftwork(['decision', 'list'], '', repo);
  assert.equal(listed.status, 0, listed.stderr);
  const engine = weftwork(['engine'], JSON.stringify({ command: 'true' }), repo);
  assert.equal(JSON.parse(engine.stdout.trim().split('\n').at(-1) ?? '{}').done, true, engine.stderr);
});

test('AC-e12s02-25 weftwork path prints this checkout; no command or an unknown one exits 2 with the usage', () => {
  const where = weftwork(['path']);
  assert.equal(where.status, 0);
  assert.equal(where.stdout, `${join(import.meta.dirname, '..')}\n`);
  for (const args of [[], ['nope'], ['../cli'], ['weftwork'], ['--nope']]) {
    const out = weftwork(args);
    assert.equal(out.status, 2, args.join(' '));
    assert.equal(out.stdout, '', args.join(' '));
    assert.match(out.stderr, /^weftwork: .*\n\nUsage: weftwork <command>.*\bdetect\b.*\bengine\b/s);
  }
});

test('weftwork --version, -v and version print the version in package.json', () => {
  const { version } = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')) as { version: string };
  for (const flag of ['--version', '-v', 'version']) {
    const out = weftwork([flag]);
    assert.equal(out.status, 0, flag);
    assert.equal(out.stdout, `${version}\n`, flag);
  }
});

test('weftwork --help, -h and help print every command, each with what it does', () => {
  const commands = readdirSync(import.meta.dirname)
    .flatMap((name) => /^([a-z][a-z0-9-]*)-cli\.ts$/.exec(name)?.[1] ?? [])
    .filter((name) => name !== 'weftwork');
  assert.ok(commands.includes('init'), 'init is a command');
  for (const flag of ['--help', '-h', 'help']) {
    const out = weftwork([flag]);
    assert.equal(out.status, 0, flag);
    assert.match(out.stdout, /^Usage: weftwork <command>/);
    for (const command of [...commands, 'engine', 'path', 'help', 'version']) {
      assert.match(out.stdout, new RegExp(`^  ${command} +\\S`, 'm'), `${flag} describes ${command}`);
    }
  }
});
