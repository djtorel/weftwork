// story: e06s05
// The override record through the real CLI (e06s05 AC-19 to AC-21). Each case
// starts the real CLI with the current Node binary, in a temporary git
// repository.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { countsFor, ledgerPath, overrideCounts } from './ledger.ts';
import { exitCodes } from './states.ts';
import { cleanupTempDirs, makeTestRepo, readRepoLedger, readRepoStates } from './test-helpers.ts';

after(cleanupTempDirs);

const cliPath = join(import.meta.dirname, 'cli.ts');
const input = '{"command":"exit 9","stallAfter":9,"maxFailures":20}';

function runCli(cwd: string, text: string = input) {
  const result = spawnSync(process.execPath, [cliPath], { input: text, cwd, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function lineOf(stdout: string): Record<string, unknown> {
  const lines = stdout.split('\n').filter((line) => line !== '');
  assert.equal(lines.length, 1, 'stdout holds exactly one line');
  return JSON.parse(lines[0] as string) as Record<string, unknown>;
}

async function writeRecord(repo: string, text: string): Promise<void> {
  const dir = dirname((await ledgerPath(repo)) as string);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'override.json'), text);
}

function record(fingerprint: string, over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    command: 'exit 9',
    fingerprint,
    reason: 'flaky network',
    author: 'dom',
    kind: 'override',
    ...over,
  });
}

test('AC-e06s05-19 a failed run never names the hatch', async () => {
  const repo = makeTestRepo();
  const baseline = runCli(repo);
  assert.equal(baseline.status, exitCodes.failed);
  const fingerprint = lineOf(baseline.stdout).fingerprint as string;
  const cases: ReadonlyArray<[string, string]> = [
    ['the record is not JSON', 'not json'],
    ['the record is for another command', record(fingerprint, { command: 'exit 8' })],
    ['the record is for another tree', record('f'.repeat(64))],
    ['the record has no reason', record(fingerprint, { reason: '' })],
  ];
  for (const [name, text] of cases) {
    await writeRecord(repo, text);
    const result = runCli(repo);
    assert.equal(result.status, baseline.status, name);
    assert.equal(result.stdout, baseline.stdout, name);
    assert.equal(result.stderr, baseline.stderr, name);
  }
  for (const text of [baseline.stdout, baseline.stderr]) {
    assert.doesNotMatch(text, /overrid|hatch/i);
  }
});

test('AC-e06s05-20 the real CLI overrides once', async () => {
  const repo = makeTestRepo();
  const first = runCli(repo);
  assert.equal(first.status, 1);
  const fingerprint = lineOf(first.stdout).fingerprint as string;
  await writeRecord(repo, record(fingerprint));

  const second = runCli(repo);
  assert.equal(second.status, exitCodes.overridden);
  assert.equal(second.status, 7);
  const line = lineOf(second.stdout);
  assert.equal(line.state, 'overridden');
  assert.equal(line.done, false);
  assert.equal(line.detail, 'flaky network');
  const states = await readRepoStates(repo);
  assert.deepEqual(
    states.map((state) => state.state),
    ['overridden'],
  );

  const third = runCli(repo);
  assert.equal(third.status, 1);
  assert.equal(lineOf(third.stdout).state, 'failed');
});

test('AC-e06s05-21 the counts through the real CLI', async () => {
  const repo = makeTestRepo();
  const first = runCli(repo);
  const fingerprint = lineOf(first.stdout).fingerprint as string;
  await writeRecord(repo, record(fingerprint));
  const second = runCli(repo);
  const third = runCli(repo);
  await writeRecord(repo, record(fingerprint, { kind: 'false-alarm' }));
  const fourth = runCli(repo);
  assert.deepEqual(
    [first, second, third, fourth].map((run) => run.status),
    [1, 7, 1, 7],
  );
  const { entries } = await readRepoLedger(repo);
  assert.deepEqual(
    { ...countsFor(entries, 'exit 9', fingerprint), fresh: undefined },
    { runs: 4, passes: 0, failures: 4, failStreak: 4, fresh: undefined },
  );
  assert.deepEqual(overrideCounts(await readRepoStates(repo), 'exit 9'), {
    overrides: 1,
    falseAlarms: 1,
  });
});

async function recordPath(repo: string): Promise<string> {
  const dir = dirname((await ledgerPath(repo)) as string);
  mkdirSync(dir, { recursive: true });
  return join(dir, 'override.json');
}

const notRegular: ReadonlyArray<[string, (path: string) => void]> = [
  ['a directory', (path) => mkdirSync(path)],
  ['a symlink to the ledger', (path) => symlinkSync(join(path, '..', 'ledger.jsonl'), path)],
  ['a file of 65537 bytes', (path) => writeFileSync(path, ' '.repeat(65537))],
];

test('AC-e06s05-19 a record that is not a regular file never names the hatch', async () => {
  const repo = makeTestRepo();
  const baseline = runCli(repo);
  for (const [name, make] of notRegular) {
    const path = await recordPath(repo);
    make(path);
    const result = runCli(repo);
    rmSync(path, { recursive: true, force: true });
    assert.equal(result.status, baseline.status, name);
    assert.equal(result.stdout, baseline.stdout, name);
    assert.equal(result.stderr, baseline.stderr, name);
  }
});

test('AC-e06s05-19 a matching record on an exhausted run is kept and never named', async () => {
  const limited = '{"command":"exit 9","maxFailures":2}';
  const plain = makeTestRepo();
  runCli(plain, limited);
  const baseline = runCli(plain, limited);
  assert.equal(baseline.status, exitCodes.exhausted);
  const repo = makeTestRepo();
  const first = runCli(repo, limited);
  await writeRecord(repo, record(lineOf(first.stdout).fingerprint as string));
  const result = runCli(repo, limited);
  assert.equal(result.status, baseline.status);
  assert.equal(result.stdout, baseline.stdout);
  assert.equal(result.stderr, baseline.stderr);
  assert.ok(existsSync(await recordPath(repo)), 'the record is still there');
});
