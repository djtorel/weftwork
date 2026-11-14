// story: e09s02
// The loop ceiling in the engine (e09s02 AC-04, AC-05, AC-08, R1, R4, R5):
// checked before a run and after it, after the failure ceiling, and closed
// when maxRuns is set and the ledger cannot be read (residual F5). Every
// command runs in a temporary git repository. Only process.stderr is mocked.
import { after, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { runEngine } from './engine.ts';
import { appendEntry, ledgerPath } from './ledger.ts';
import { fingerprintTree } from './tree.ts';
import {
  cleanupTempDirs,
  makeTempDir,
  makeTestRepo,
  readRepoLedger,
  readRepoStates,
  waitForFile,
} from './test-helpers.ts';

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

// Review round 1 (2026-11-14).

test('AC-e09s02-11 with maxRuns set, a failed run that cannot be written to the ledger answers exhausted', async () => {
  const repo = makeTestRepo();
  await seed(repo, ['a']);
  chmodSync((await ledgerPath(repo)) as string, 0o400);
  const answer = await quietly(() => runEngine({ command: 'exit 1', cwd: repo, maxRuns: 5 }));
  assert.equal(answer.state, 'exhausted');
  assert.equal(answer.reason, 'exit-nonzero', 'the run did happen');
  assert.match(answer.detail ?? '', /could not be written to the ledger, so the loop ceiling of 5 cannot be counted/);
});

test('AC-e09s02-11 with no maxRuns, a failed run that cannot be written stays failed', async () => {
  const repo = makeTestRepo();
  await seed(repo, ['a']);
  chmodSync((await ledgerPath(repo)) as string, 0o400);
  const answer = await quietly(() => runEngine({ command: 'exit 1', cwd: repo }));
  assert.equal(answer.state, 'failed');
});

/** `count` run lines of about 120 KB each: long commands that the request
 * allows, so the 1 MiB tail holds only a few of them. */
async function seedLong(repo: string, count: number): Promise<void> {
  await seed(repo, Array.from({ length: count }, (_, index) => `false # ${String(index).repeat(120_000)}`));
}

test('AC-e09s02-12 with maxRuns set, a cut tail with no done answers exhausted without running', async () => {
  const repo = makeTestRepo();
  await seedLong(repo, 12);
  const answer = await quietly(() => runEngine({ command: 'touch ran.txt', cwd: repo, maxRuns: 20 }));
  assert.equal(answer.state, 'exhausted');
  assert.equal(answer.reason, 'not-run');
  assert.match(answer.detail ?? '', /ledger tail was cut with no done in it, so the loop ceiling of 20 cannot be counted/);
  assert.equal(existsSync(join(repo, 'ran.txt')), false, 'the command did not run');
});

test('AC-e09s02-12 junk lines that cut the tail answer exhausted as well (F1)', async () => {
  const repo = makeTestRepo();
  await seed(repo, ['a']);
  appendFileSync((await ledgerPath(repo)) as string, `${'x'.repeat(100)}\n`.repeat(11_000));
  const answer = await quietly(() => runEngine({ command: 'exit 1', cwd: repo, maxRuns: 3 }));
  assert.equal(answer.state, 'exhausted');
  assert.equal(answer.reason, 'not-run');
});

test('AC-e09s02-12 a cut tail with a done in it is counted as usual', async () => {
  const repo = makeTestRepo();
  await seedLong(repo, 12);
  await seed(repo, ['pass']);
  const answer = await quietly(() => runEngine({ command: 'exit 1', cwd: repo, maxRuns: 3 }));
  assert.equal(answer.state, 'failed');
});

test('AC-e09s02-12 with no maxRuns, a cut tail with no done changes nothing', async () => {
  const repo = makeTestRepo();
  await seedLong(repo, 12);
  const answer = await quietly(() => runEngine({ command: 'exit 1', cwd: repo }));
  assert.equal(answer.state, 'failed');
});

test('AC-e09s02-13 a run killed at the ceiling answers killed, not exhausted', { timeout: 15000 }, async () => {
  const repo = makeTestRepo();
  await seed(repo, ['a', 'b']);
  const pidFile = join(makeTempDir(), 'pid');
  const controller = new AbortController();
  const running = runEngine(
    { command: `sleep 30 & echo $! > "${pidFile}"; wait`, cwd: repo, maxRuns: 3 },
    controller.signal,
  );
  assert.ok(await waitForFile(pidFile, 5000));
  controller.abort();
  assert.equal((await running).state, 'killed');
});

test('AC-e09s02-13 at the ceiling, exhausted comes before blocked', async () => {
  const repo = makeTestRepo();
  await seed(repo, ['a', 'b']);
  const answer = await runEngine({ command: 'exit 1', cwd: repo, maxRuns: 2, blocked: 'need a key' });
  assert.equal(answer.state, 'exhausted');
});

test('AC-e09s02-13 a blocked refusal is not counted as a run', async () => {
  const repo = makeTestRepo();
  await seed(repo, ['a']);
  assert.equal((await runEngine({ command: 'exit 1', cwd: repo, maxRuns: 3, blocked: 'need a key' })).state, 'blocked');
  assert.equal((await runEngine({ command: 'exit 2', cwd: repo, maxRuns: 3 })).state, 'failed');
});

test('AC-e09s02-13 an overridden run counts once, as the failed run it is', async () => {
  const repo = makeTestRepo();
  const ledger = (await ledgerPath(repo)) as string;
  mkdirSync(dirname(ledger), { recursive: true });
  const before = await fingerprintTree(repo);
  assert.ok(before.ok);
  const record = { command: 'exit 9', fingerprint: before.fingerprint, reason: 'flaky', author: 'dom', kind: 'override' };
  writeFileSync(join(dirname(ledger), 'override.json'), JSON.stringify(record));
  assert.equal((await runEngine({ command: 'exit 9', cwd: repo, maxRuns: 3 })).state, 'overridden');
  assert.equal((await runEngine({ command: 'exit 1', cwd: repo, maxRuns: 3 })).state, 'failed');
  assert.equal((await runEngine({ command: 'exit 2', cwd: repo, maxRuns: 3 })).state, 'exhausted');
});
