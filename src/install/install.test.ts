// `weftwork install` (install.ts): install into the clone's own folder at the
// project's pin, pin a version when there is none or one is asked for, and
// keep every other byte of weftwork.yaml. npm is faked: it "installs" a
// weftwork package of the version the spec names.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { engineDir, enginePackage } from './launcher.ts';
import { install, installedVersion, isCloneInstall, npmArgs, readPin, type RunNpm } from './install.ts';
import { gitCommonDir } from '../setup/setup.ts';
import { cleanupTempDirs, makeTestRepo } from '../test-support/test-helpers.ts';

after(cleanupTempDirs);

/** A fake npm that records each call and writes a weftwork package of the
 * version in `weftwork@<version>`, or `fromVersion` for any other spec. */
function fakeNpm(commonDir: string, fromVersion = '9.9.9'): { npm: RunNpm; calls: string[][] } {
  const calls: string[][] = [];
  const npm: RunNpm = (args) => {
    calls.push(args);
    const spec = args.at(-1) ?? '';
    const version = spec.startsWith('weftwork@') ? spec.slice('weftwork@'.length) : fromVersion;
    mkdirSync(enginePackage(commonDir), { recursive: true });
    writeFileSync(join(enginePackage(commonDir), 'package.json'), JSON.stringify({ name: 'weftwork', version }));
    return null;
  };
  return { npm, calls };
}

function setup(yaml?: string): { root: string; commonDir: string } {
  const root = makeTestRepo();
  if (yaml !== undefined) writeFileSync(join(root, 'weftwork.yaml'), yaml);
  return { root, commonDir: gitCommonDir(root) ?? '' };
}

test('with no pin, install installs the running version into the clone and pins it', () => {
  const { root, commonDir } = setup();
  const { npm, calls } = fakeNpm(commonDir);
  const result = install({ root, commonDir, running: '0.3.0' }, npm);
  assert.deepEqual(result, { ok: true, version: '0.3.0', did: 'installed', pinned: true });
  assert.deepEqual(calls, [npmArgs(commonDir, 'weftwork@0.3.0')]);
  assert.equal(readFileSync(join(root, 'weftwork.yaml'), 'utf8'), 'engine: 0.3.0\n');
  assert.equal(installedVersion(commonDir), '0.3.0');
  const manifest = JSON.parse(readFileSync(join(engineDir(commonDir), 'package.json'), 'utf8')) as { private: boolean };
  assert.equal(manifest.private, true, 'its own package.json, so npm never takes a parent as the project');
});

test('install installs the pinned version, not the running one, and leaves the pin and the rest of the file', () => {
  const yaml = '# the owner\'s note\nhistory: local\nengine: 0.2.0  # pinned\n';
  const { root, commonDir } = setup(yaml);
  const { npm } = fakeNpm(commonDir);
  assert.deepEqual(install({ root, commonDir, running: '0.3.0' }, npm), { ok: true, version: '0.2.0', did: 'installed', pinned: false });
  assert.equal(readFileSync(join(root, 'weftwork.yaml'), 'utf8'), yaml);
});

test('a clone that already has the pinned version runs no npm', () => {
  const { root, commonDir } = setup('engine: 0.2.0\n');
  const { npm, calls } = fakeNpm(commonDir);
  install({ root, commonDir, running: '0.3.0' }, npm);
  assert.deepEqual(install({ root, commonDir, running: '0.3.0' }, npm), { ok: true, version: '0.2.0', did: 'current', pinned: false });
  assert.equal(calls.length, 1);
});

test('--version installs that version and moves the pin, keeping every other byte', () => {
  const { root, commonDir } = setup('history: local\nengine: 0.2.0\n');
  const { npm } = fakeNpm(commonDir);
  assert.deepEqual(install({ root, commonDir, running: '0.2.0', version: '0.4.1' }, npm), { ok: true, version: '0.4.1', did: 'installed', pinned: true });
  assert.equal(readFileSync(join(root, 'weftwork.yaml'), 'utf8'), 'history: local\nengine: 0.4.1\n');
});

test('--from installs that spec and pins the version it holds', () => {
  const { root, commonDir } = setup('engine: 0.2.0\n');
  const { npm, calls } = fakeNpm(commonDir, '0.5.0');
  const result = install({ root, commonDir, running: '0.2.0', from: '/mirror/weftwork-0.5.0.tgz' }, npm);
  assert.deepEqual(result, { ok: true, version: '0.5.0', did: 'installed', pinned: true });
  assert.equal(calls[0]?.at(-1), '/mirror/weftwork-0.5.0.tgz');
  assert.deepEqual(readPin(root), { ok: true, pin: '0.5.0' });
});

test('npm installs with an exact version and no install scripts', () => {
  const args = npmArgs('/c', 'weftwork@1.2.3');
  for (const flag of ['--save-exact', '--ignore-scripts', '--prefix']) assert.ok(args.includes(flag), flag);
});

test('a bad pin, a bad --version, or a failing npm is refused, and nothing is pinned', () => {
  const bad = setup('engine: latest\n');
  const result = install({ ...bad, running: '0.3.0' }, fakeNpm(bad.commonDir).npm);
  assert.ok(!result.ok);
  assert.match(result.error, /engine must be a weftwork version/);
  const plain = setup();
  const version = install({ ...plain, running: '0.3.0', version: '1.0' }, fakeNpm(plain.commonDir).npm);
  assert.ok(!version.ok);
  assert.match(version.error, /not a weftwork version/);
  const failing = install({ ...plain, running: '0.3.0' }, () => ({ ok: false, error: 'npm failed' }));
  assert.deepEqual(failing, { ok: false, error: 'npm failed' });
  // npm exits 0 but leaves another version (a mirror that answers wrong).
  const other = fakeNpm(plain.commonDir).npm;
  const wrong = install({ ...plain, running: '0.3.0' }, (args) => other([...args.slice(0, -1), 'weftwork@0.1.0']));
  assert.ok(!wrong.ok);
  assert.match(wrong.error, /left weftwork 0\.1\.0 .* not 0\.3\.0/);
  assert.deepEqual(readPin(plain.root), { ok: true, pin: null });
});

test('isCloneInstall is true only for the clone\'s own package folder', () => {
  const { commonDir } = setup();
  assert.equal(isCloneInstall(enginePackage(commonDir), commonDir), false, 'not installed yet');
  mkdirSync(enginePackage(commonDir), { recursive: true });
  assert.equal(isCloneInstall(enginePackage(commonDir), commonDir), true);
  assert.equal(isCloneInstall(join(import.meta.dirname, '..', '..'), commonDir), false);
});
