// story: e09s02
// The loop ceiling through the CLI and weftwork.yaml (e09s02 AC-04 to AC-06,
// AC-08). Every CLI run has XDG_CONFIG_HOME set to an empty directory, so the
// owner's real user file is never read.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ledgerPath } from './ledger.ts';
import { cleanupTempDirs, isolatedEnv, makeTestRepo, readRepoLedger } from './test-helpers.ts';

after(cleanupTempDirs);

const cliPath = join(import.meta.dirname, 'cli.ts');

function runCli(cwd: string, request: Record<string, unknown>) {
  const input = JSON.stringify(request);
  const result = spawnSync(process.execPath, [cliPath], { input, cwd, encoding: 'utf8', env: isolatedEnv() });
  const lines = result.stdout.split('\n').filter((line) => line !== '');
  assert.equal(lines.length, 1, `one stdout line, got: ${result.stdout}${result.stderr}`);
  return { status: result.status, line: JSON.parse(lines[0] as string) as Record<string, unknown> };
}

const maxRuns = (value: number | string) => ({ 'weftwork.yaml': `budget:\n  maxRuns: ${value}\n` });

test('AC-e09s02-04 a new command each call still meets exhausted at maxRuns 3', async () => {
  const repo = makeTestRepo(maxRuns(3));
  assert.equal(runCli(repo, { command: 'exit 1' }).status, 1);
  assert.equal(runCli(repo, { command: 'exit 2' }).status, 1);
  const third = runCli(repo, { command: 'exit 3' });
  assert.equal(third.status, 5);
  assert.equal(third.line['state'], 'exhausted');
  const fourth = runCli(repo, { command: 'touch ran.txt' });
  assert.equal(fourth.status, 5);
  assert.equal(fourth.line['reason'], 'not-run');
  assert.equal(existsSync(join(repo, 'ran.txt')), false, 'the fourth command did not run');
  assert.equal((await readRepoLedger(repo)).entries.length, 3);
});

test('AC-e09s02-05 failed, done, failed with maxRuns 2: a done opens a new loop', () => {
  const repo = makeTestRepo(maxRuns(2));
  const states = ['exit 1', 'true', 'exit 2'].map((command) => runCli(repo, { command }).line['state']);
  assert.deepEqual(states, ['failed', 'done', 'failed']);
});

for (const value of [0, 1001]) {
  test(`AC-e09s02-06 weftwork.yaml with maxRuns ${value} exits 2 naming the file and the key`, () => {
    const result = runCli(makeTestRepo(maxRuns(value)), { command: 'exit 1' });
    assert.equal(result.status, 2);
    assert.match(String(result.line['error']), /weftwork\.yaml: budget\.maxRuns/);
  });
}

test('AC-e09s02-06 a request with maxRuns 0 exits 2', () => {
  const result = runCli(makeTestRepo(), { command: 'exit 1', maxRuns: 0 });
  assert.equal(result.status, 2);
  assert.match(String(result.line['error']), /maxRuns/);
});

test('AC-e09s02-07 a request cannot raise maxRuns from weftwork.yaml', () => {
  const repo = makeTestRepo(maxRuns(1));
  assert.equal(runCli(repo, { command: 'exit 1', maxRuns: 50 }).status, 5);
});

test('AC-e09s02-08 maxRuns 5 and a ledger that is a directory: exhausted, and nothing runs', async () => {
  const repo = makeTestRepo(maxRuns(5));
  mkdirSync((await ledgerPath(repo)) as string, { recursive: true });
  const result = runCli(repo, { command: 'touch ran.txt' });
  assert.equal(result.status, 5);
  assert.equal(result.line['state'], 'exhausted');
  assert.equal(existsSync(join(repo, 'ran.txt')), false, 'the command did not run');
});
