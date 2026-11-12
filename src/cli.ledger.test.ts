// story: e06s03
// The ledger at the process boundary (e06s03 AC-14): the real CLI runs twice
// in a temporary git repository and the ledger is read back. The repository
// is made in a temporary directory and removed on exit.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { countsFor } from './ledger.ts';
import { fingerprintTree } from './tree.ts';
import { cleanupTempDirs, makeTestRepo, readRepoLedger } from './test-helpers.ts';

after(cleanupTempDirs);

const cliPath = join(import.meta.dirname, 'cli.ts');

function runCli(input: string, cwd: string) {
  const result = spawnSync(process.execPath, [cliPath], { input, cwd, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout };
}

function assertOneLine(stdout: string): void {
  assert.ok(stdout.endsWith('\n'));
  assert.equal(stdout.split('\n').filter((line) => line !== '').length, 1);
}

test('AC-e06s03-14 the real CLI logs each run, one line per run', async () => {
  const repo = makeTestRepo();
  const pass = runCli('{"command":"true"}', repo);
  const fail = runCli('{"command":"exit 7"}', repo);
  assert.equal(pass.status, 0);
  assert.equal(fail.status, 1);
  assertOneLine(pass.stdout);
  assertOneLine(fail.stdout);
  const read = await readRepoLedger(repo);
  assert.equal(read.entries.length, 2);
  assert.equal(read.skipped, 0);
});

test('AC-e06s03-14 the counts read back and the tree is untouched', async () => {
  const repo = makeTestRepo();
  runCli('{"command":"true"}', repo);
  runCli('{"command":"exit 7"}', repo);
  const read = await readRepoLedger(repo);
  const tree = await fingerprintTree(repo);
  assert.ok(tree.ok);
  assert.deepEqual(countsFor(read.entries, 'true', tree.fingerprint), {
    runs: 1,
    passes: 1,
    failures: 0,
    failStreak: 0,
    fresh: true,
  });
  assert.equal(countsFor(read.entries, 'exit 7', tree.fingerprint).failStreak, 1);
  const status = execFileSync('git', ['status', '--short'], { cwd: repo, encoding: 'utf8' });
  assert.equal(status, '');
});

test('AC-e06s03-14 a ledger that cannot be written reads as no-ledger at the CLI', () => {
  const repo = makeTestRepo();
  execFileSync('touch', [join(repo, '.git', 'weftwork')]);
  const result = runCli('{"command":"true"}', repo);
  assert.equal(result.status, 1);
  assertOneLine(result.stdout);
  assert.match(result.stdout, /"reason":"no-ledger"/);
  assert.match(result.stdout, /"done":false/);
});
