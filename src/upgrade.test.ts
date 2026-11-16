// `weftwork upgrade`: install the latest weftwork from npm when it is newer
// than the one running. The npm calls are passed in, so no test reaches the
// network; tools/test-package.sh runs the installed command with a fake npm.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { compareVersions, upgrade, type Npm } from './upgrade.ts';
import { cleanupTempDirs, isolatedEnv, makeTempDir } from './test-helpers.ts';

after(cleanupTempDirs);

/** An npm whose latest weftwork is `latest`, recording each install. */
function fakeNpm(latest: string, installFails = false): Npm & { installed: string[] } {
  const installed: string[] = [];
  return {
    installed,
    latest: () => ({ ok: true, version: latest }),
    install: (version) => {
      installed.push(version);
      return installFails ? { ok: false, error: 'EACCES: permission denied' } : null;
    },
  };
}

test('a newer version on npm is installed, by its exact version', () => {
  const npm = fakeNpm('0.3.0');
  assert.deepEqual(upgrade('0.2.0', npm, false), { ok: true, from: '0.2.0', to: '0.3.0', did: 'installed' });
  assert.deepEqual(npm.installed, ['0.3.0']);
});

test('the latest version already running installs nothing', () => {
  const npm = fakeNpm('0.2.0');
  assert.deepEqual(upgrade('0.2.0', npm, false), { ok: true, from: '0.2.0', to: '0.2.0', did: 'current' });
  assert.deepEqual(npm.installed, []);
});

test('--check reports a newer version and installs nothing', () => {
  const npm = fakeNpm('0.3.0');
  assert.deepEqual(upgrade('0.2.0', npm, true), { ok: true, from: '0.2.0', to: '0.3.0', did: 'checked' });
  assert.deepEqual(npm.installed, []);
});

test('a version newer than npm\'s latest is never downgraded', () => {
  const npm = fakeNpm('0.2.0');
  assert.deepEqual(upgrade('0.10.0', npm, false), { ok: true, from: '0.10.0', to: '0.2.0', did: 'newer' });
  assert.deepEqual(npm.installed, []);
});

test('a failed npm call is an error that keeps npm\'s reason, and a version npm gives that is not a version is refused', () => {
  const failed = upgrade('0.2.0', fakeNpm('0.3.0', true), false);
  assert.equal(failed.ok, false);
  assert.match(failed.ok ? '' : failed.error, /EACCES/);
  const odd = upgrade('0.2.0', { latest: () => ({ ok: true, version: 'git+https://example.com/x' }), install: () => null }, false);
  assert.equal(odd.ok, false);
  assert.match(odd.ok ? '' : odd.error, /not a version/);
  const offline = upgrade('0.2.0', { latest: () => ({ ok: false, error: 'npm view failed: ENOTFOUND' }), install: () => null }, false);
  assert.equal(offline.ok, false);
});

test('versions compare by number, and a pre-release is older than its release', () => {
  assert.ok(compareVersions('0.10.0', '0.9.9') > 0);
  assert.ok(compareVersions('1.0.0', '1.0.0') === 0);
  assert.ok(compareVersions('1.0.0-rc.1', '1.0.0') < 0);
  assert.ok(compareVersions('0.2.0', '0.2.1') < 0);
  assert.ok(compareVersions('1.0.0-rc.9', '1.0.0-rc.10') < 0, 'numeric pre-release parts compare as numbers (review r1s2)');
  assert.ok(compareVersions('1.0.0-alpha', '1.0.0-alpha.1') < 0, 'fewer parts is older');
  assert.ok(compareVersions('1.0.0-1', '1.0.0-alpha') < 0, 'a numeric part is older than text');
});

test('a version with a leading zero or an empty pre-release part is not a version (review r1s2)', () => {
  for (const bad of ['01.2.3', '1.02.3', '1.1.0-..', '1.1.0-', '1.0.0-01']) {
    const out = upgrade('0.2.0', { latest: () => ({ ok: true, version: bad }), install: () => null }, false);
    assert.equal(out.ok, false, bad);
  }
});

test('weftwork upgrade in a checkout refuses and says to git pull there; --help prints the usage', () => {
  const bin = join(import.meta.dirname, 'weftwork-cli.ts');
  const run = (args: string[]) => spawnSync(process.execPath, [bin, 'upgrade', ...args], { cwd: makeTempDir(), env: isolatedEnv(), encoding: 'utf8', timeout: 60000 });
  const out = run([]);
  assert.equal(out.status, 1);
  assert.match(out.stderr, /runs from a checkout at .*git pull/);
  const help = run(['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /^Usage: weftwork upgrade/);
});
