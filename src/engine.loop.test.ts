// story: e09s02
// The loop ceiling in the engine (e09s02 AC-04, AC-05, AC-08, R1, R4, R5):
// checked before a run and after it, after the failure ceiling, and closed
// when maxRuns is set and the ledger cannot be read (residual F5). Every
// command runs in a temporary git repository. Only process.stderr is mocked.
import { after, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { runEngine } from './engine.ts';
import { appendEntry, ledgerPath } from './ledger.ts';
import { cleanupTempDirs, makeTestRepo, readRepoLedger, readRepoStates } from './test-helpers.ts';

after(cleanupTempDirs);

const at = new Date('2026-11-14T03:00:00.000Z');

async function quietly<T>(body: () => Promise<T>): Promise<T> {
  const write = mock.method(process.stderr, 'write', () => true);
  try {
    return await body();
  } finally {
    write.mock.restore();
  }
}

/** One run entry per command, written straight into the ledger; a command
 * named `pass` is a done run. */
async function seed(repo: string, commands: string[]): Promise<void> {
  const path = (await ledgerPath(repo)) as string;
  for (const command of commands) {
    const done = command === 'pass';
    const verdict = {
      done,
      exitCode: done ? 0 : 1,
      reason: done ? ('passed' as const) : ('exit-nonzero' as const),
      command,
      fingerprint: 'F',
    };
    assert.deepEqual(await appendEntry(path, verdict, at), { ok: true });
  }
}

test('AC-e09s02-04 the run that reaches maxRuns answers exhausted, with the loop ceiling as threshold', async () => {
  const repo = makeTestRepo();
  await seed(repo, ['a', 'b']);
  const answer = await runEngine({ command: 'exit 3', cwd: repo, maxRuns: 3 });
  assert.equal(answer.state, 'exhausted');
  assert.equal(answer.reason, 'exit-nonzero', 'the run did happen');
  assert.match(answer.detail ?? '', /3 runs since the last done, the loop ceiling is 3/);
  const states = await readRepoStates(repo);
  assert.deepEqual(states.map((line) => [line.state, line.threshold]), [['exhausted', 3]]);
});

test('AC-e09s02-04 at maxRuns a new command is refused without running, even one that would pass', async () => {
  const repo = makeTestRepo();
  await seed(repo, ['a', 'b', 'c']);
  const answer = await runEngine({ command: 'touch ran.txt', cwd: repo, maxRuns: 3 });
  assert.equal(answer.state, 'exhausted');
  assert.equal(answer.reason, 'not-run');
  assert.equal(answer.done, false);
  assert.equal(existsSync(join(repo, 'ran.txt')), false, 'the command did not run');
  assert.equal((await readRepoLedger(repo)).entries.length, 3, 'no run entry was added');
  assert.deepEqual((await readRepoStates(repo)).map((line) => line.threshold), [3]);
});

test('AC-e09s02-05 a done opens a new loop', async () => {
  const repo = makeTestRepo();
  await seed(repo, ['a', 'b', 'c', 'pass']);
  assert.equal((await runEngine({ command: 'exit 1', cwd: repo, maxRuns: 2 })).state, 'failed');
  assert.equal((await runEngine({ command: 'exit 2', cwd: repo, maxRuns: 2 })).state, 'exhausted');
});

test('AC-e09s02-05 the run that reaches maxRuns and passes is done', async () => {
  const repo = makeTestRepo();
  await seed(repo, ['a']);
  assert.equal((await runEngine({ command: 'true', cwd: repo, maxRuns: 2 })).state, 'done');
});

test('R5 the failure ceiling is checked before the loop ceiling', async () => {
  const repo = makeTestRepo();
  await seed(repo, ['exit 7', 'exit 7']);
  const answer = await runEngine({ command: 'exit 7', cwd: repo, maxFailures: 2, maxRuns: 2 });
  assert.equal(answer.reason, 'not-run');
  assert.match(answer.detail ?? '', /2 failed runs in a row, the ceiling is 2/);
});

test('R2 with no maxRuns, runs of new commands never meet a loop ceiling', async () => {
  const repo = makeTestRepo();
  await seed(repo, Array.from({ length: 20 }, (_, index) => `c${index}`));
  assert.equal((await runEngine({ command: 'exit 1', cwd: repo })).state, 'failed');
});

test('AC-e09s02-08 with maxRuns set, an unreadable ledger answers exhausted and nothing runs (F5)', async () => {
  const repo = makeTestRepo();
  mkdirSync((await ledgerPath(repo)) as string, { recursive: true });
  const answer = await quietly(() => runEngine({ command: 'touch ran.txt', cwd: repo, maxRuns: 5 }));
  assert.equal(answer.state, 'exhausted');
  assert.equal(answer.reason, 'not-run');
  assert.match(answer.detail ?? '', /ledger cannot be read.*loop ceiling of 5/);
  assert.equal(existsSync(join(repo, 'ran.txt')), false, 'the command did not run');
});

test('R4 with maxRuns set, a ledger that becomes unreadable during a failed run answers exhausted (F5)', async () => {
  const repo = makeTestRepo();
  const path = (await ledgerPath(repo)) as string;
  const command = `rm -f "${path}" && mkdir -p "${path}" && exit 1`;
  const answer = await quietly(() => runEngine({ command, cwd: repo, maxRuns: 5 }));
  assert.equal(answer.state, 'exhausted');
  assert.equal(answer.reason, 'exit-nonzero', 'the run did happen');
  assert.match(answer.detail ?? '', /ledger cannot be read/);
});

test('AC-e09s02-09 with no maxRuns, an unreadable ledger still turns the rules off (AC-e06s04-28)', async () => {
  const repo = makeTestRepo();
  mkdirSync((await ledgerPath(repo)) as string, { recursive: true });
  const answer = await quietly(() => runEngine({ command: 'exit 7', cwd: repo }));
  assert.equal(answer.state, 'failed');
});
