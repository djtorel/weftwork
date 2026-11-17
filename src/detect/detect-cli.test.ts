// story: e12s01
// The detect CLI as a real process: a Node fixture whose scripts pass, fail and
// name a missing binary gives a report with each check; bad input exits 2.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempDirs, isolatedEnv, makeTempDir } from '../test-support/test-helpers.ts';

after(cleanupTempDirs);

const detectCli = join(import.meta.dirname, '..', 'detect-cli.ts');

function detect(input: string) {
  const out = spawnSync(process.execPath, [detectCli], { cwd: makeTempDir(), input, env: isolatedEnv(), encoding: 'utf8', timeout: 60000 });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

test('AC-e12s01-10 the CLI reports a Node project and runs each script once', () => {
  const dir = makeTempDir();
  const scripts = { test: 'node -e 0', lint: 'node -e "process.exit(1)"', build: 'weftwork-no-such-command-xyz', start: 'node -e 0' };
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts }));
  const out = detect(JSON.stringify({ path: dir }));
  assert.equal(out.status, 0, out.stderr);
  const answer = JSON.parse(out.stdout);
  assert.equal(answer.ok, true);
  assert.deepEqual(answer.report.packageManagers, ['npm']);
  assert.deepEqual(
    answer.report.commands.map((found: { command: string; check: { status: string } }) => [found.command, found.check.status]),
    [
      ['npm run test', 'passed'],
      ['npm run lint', 'failed'],
      ['npm run build', 'missing'],
      ['npm run start', 'skipped'],
    ],
  );
});

test('AC-e12s01-11 "run": false reports without running anything', () => {
  const dir = makeTempDir();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'node -e 0' } }));
  const out = detect(JSON.stringify({ path: dir, run: false }));
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(JSON.parse(out.stdout).report.commands, [{ kind: 'test', command: 'npm run test', source: 'package.json', body: 'node -e 0' }]);
});

test('AC-e12s01-12 bad input or a missing folder exits 2 with the reason', () => {
  assert.equal(detect('[]').status, 2);
  assert.equal(detect(JSON.stringify({ timeoutSeconds: 0 })).status, 2);
  const gone = detect(JSON.stringify({ path: '/weftwork/no/such/folder' }));
  assert.equal(gone.status, 2);
  assert.match(gone.stderr, /^detect: /);
});

test('AC-e12s01-19 the CLI checks each package command in its own folder', () => {
  const dir = makeTempDir();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ workspaces: ['packages/*'] }));
  mkdirSync(join(dir, 'packages', 'a'), { recursive: true });
  const here = 'node -e "process.exit(require(\'fs\').existsSync(\'only-in-a\') ? 0 : 1)"';
  writeFileSync(join(dir, 'packages', 'a', 'package.json'), JSON.stringify({ scripts: { test: here } }));
  writeFileSync(join(dir, 'packages', 'a', 'only-in-a'), '');
  const out = detect(JSON.stringify({ path: dir }));
  assert.equal(out.status, 0, out.stderr);
  const [found] = JSON.parse(out.stdout).report.packages;
  assert.equal(found.path, 'packages/a');
  assert.deepEqual(found.commands.map((each: { command: string; check: { status: string } }) => [each.command, each.check.status]), [['npm run test', 'passed']]);
});
