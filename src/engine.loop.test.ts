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
import { ledgerPath } from './ledger.ts';
import { fingerprintTree } from './tree.ts';
import {
  cleanupTempDirs,
  makeTempDir,
  makeTestRepo,
  readRepoLedger,
  readRepoStates,
  seedLedger,
  waitForFile,
} from './test-helpers.ts';

after(cleanupTempDirs);

async function quietly<T>(body: () => Promise<T>): Promise<T> {
  const write = mock.method(process.stderr, 'write', () => true);
  try {
    return await body();
  } finally {
    write.mock.restore();
  }
}

test('AC-e09s02-04 the run that reaches maxRuns answers exhausted, with the loop ceiling as threshold', async () => {
  const repo = makeTestRepo();
  await seedLedger(repo, ['a', 'b']);
  const answer = await runEngine({ command: 'exit 3', cwd: repo, maxRuns: 3 });
  assert.equal(answer.state, 'exhausted');
  assert.equal(answer.reason, 'exit-nonzero', 'the run did happen');
  assert.match(answer.detail ?? '', /3 runs since the last done, the loop ceiling is 3/);
  const states = await readRepoStates(repo);
  assert.deepEqual(states.map((line) => [line.state, line.threshold]), [['exhausted', 3]]);
});

test('AC-e09s02-04 at maxRuns a new command is refused without running, even one that would pass', async () => {
  const repo = makeTestRepo();
  await seedLedger(repo, ['a', 'b', 'c']);
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
  await seedLedger(repo, ['a', 'b', 'c', 'pass']);
  assert.equal((await runEngine({ command: 'exit 1', cwd: repo, maxRuns: 2 })).state, 'failed');
  assert.equal((await runEngine({ command: 'exit 2', cwd: repo, maxRuns: 2 })).state, 'exhausted');
});

test('AC-e09s02-05 the run that reaches maxRuns and passes is done', async () => {
  const repo = makeTestRepo();
  await seedLedger(repo, ['a']);
  assert.equal((await runEngine({ command: 'true', cwd: repo, maxRuns: 2 })).state, 'done');
});

test('R5 the failure ceiling is checked before the loop ceiling', async () => {
  const repo = makeTestRepo();
  await seedLedger(repo, ['exit 7', 'exit 7']);
  const answer = await runEngine({ command: 'exit 7', cwd: repo, maxFailures: 2, maxRuns: 2 });
  assert.equal(answer.reason, 'not-run');
  assert.match(answer.detail ?? '', /2 failed runs in a row, the ceiling is 2/);
});

test('R2 with no maxRuns, runs of new commands never meet a loop ceiling', async () => {
  const repo = makeTestRepo();
  await seedLedger(repo, Array.from({ length: 20 }, (_, index) => `c${index}`));
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
  await seedLedger(repo, ['a']);
  chmodSync((await ledgerPath(repo)) as string, 0o400);
  const answer = await quietly(() => runEngine({ command: 'exit 1', cwd: repo, maxRuns: 5 }));
  assert.equal(answer.state, 'exhausted');
  assert.equal(answer.reason, 'exit-nonzero', 'the run did happen');
  assert.match(answer.detail ?? '', /could not be written to the ledger, so the loop ceiling of 5 cannot be counted/);
});

test('AC-e09s02-11 with no maxRuns, a failed run that cannot be written stays failed', async () => {
  const repo = makeTestRepo();
  await seedLedger(repo, ['a']);
  chmodSync((await ledgerPath(repo)) as string, 0o400);
  const answer = await quietly(() => runEngine({ command: 'exit 1', cwd: repo }));
  assert.equal(answer.state, 'failed');
});

/** `count` run lines of about 120 KB each: long commands that the request
 * allows, so the 1 MiB tail holds only a few of them. */
async function seedLong(repo: string, count: number): Promise<void> {
  await seedLedger(repo, Array.from({ length: count }, (_, index) => `false # ${String(index).repeat(120_000)}`));
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
  await seedLedger(repo, ['a']);
  appendFileSync((await ledgerPath(repo)) as string, `${'x'.repeat(100)}\n`.repeat(11_000));
  const answer = await quietly(() => runEngine({ command: 'exit 1', cwd: repo, maxRuns: 3 }));
  assert.equal(answer.state, 'exhausted');
  assert.equal(answer.reason, 'not-run');
});

test('AC-e09s02-12 a cut tail with a done in it is counted as usual', async () => {
  const repo = makeTestRepo();
  await seedLong(repo, 12);
  await seedLedger(repo, ['pass']);
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
  await seedLedger(repo, ['a', 'b']);
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
  await seedLedger(repo, ['a', 'b']);
  const answer = await runEngine({ command: 'exit 1', cwd: repo, maxRuns: 2, blocked: 'need a key' });
  assert.equal(answer.state, 'exhausted');
});

test('AC-e09s02-13 a blocked refusal is not counted as a run', async () => {
  const repo = makeTestRepo();
  await seedLedger(repo, ['a']);
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

// Review round 2 (2026-11-14).

async function stderrOf(body: () => Promise<unknown>): Promise<string> {
  const write = mock.method(process.stderr, 'write', () => true);
  try {
    await body();
    return write.mock.calls.map((call) => String(call.arguments[0])).join('');
  } finally {
    write.mock.restore();
  }
}

test('AC-e09s02-11 with maxRuns set, a passing run that cannot be written answers exhausted, not done', async () => {
  const repo = makeTestRepo();
  await seedLedger(repo, ['a']);
  chmodSync((await ledgerPath(repo)) as string, 0o400);
  const answer = await quietly(() => runEngine({ command: 'true', cwd: repo, maxRuns: 5 }));
  assert.equal(answer.state, 'exhausted');
  assert.equal(answer.reason, 'no-ledger');
  assert.equal(answer.done, false);
});

test('AC-e09s02-04 a refusal at the loop ceiling writes one state line with the loop threshold', async () => {
  const repo = makeTestRepo();
  await seedLedger(repo, ['a', 'b', 'c']);
  await runEngine({ command: 'exit 4', cwd: repo, maxRuns: 3 });
  const lines = await readRepoStates(repo);
  assert.equal(lines.length, 1);
  const [line] = lines;
  assert.deepEqual(
    [line?.state, line?.command, line?.threshold, line?.runs, line?.failStreak],
    ['exhausted', 'exit 4', 3, 0, 0],
  );
  assert.match(line?.detail ?? '', /3 runs since the last done, the loop ceiling is 3/);
});

test('AC-e09s02-12 a cut tail whose runs already reach maxRuns gives the count, not the cut', async () => {
  const repo = makeTestRepo();
  await seedLong(repo, 12);
  const answer = await quietly(() => runEngine({ command: 'exit 1', cwd: repo, maxRuns: 3 }));
  assert.equal(answer.state, 'exhausted');
  assert.match(answer.detail ?? '', /runs since the last done, the loop ceiling is 3/);
});

test('the note for an unreadable ledger says what happens, with and without maxRuns', async () => {
  const repo = makeTestRepo();
  mkdirSync((await ledgerPath(repo)) as string, { recursive: true });
  const off = await stderrOf(() => runEngine({ command: 'exit 1', cwd: repo }));
  assert.match(off, /ledger not read, stop rules off for this call/);
  const on = await stderrOf(() => runEngine({ command: 'exit 1', cwd: repo, maxRuns: 4 }));
  assert.match(on, /ledger not read, the loop ceiling of 4 answers exhausted/);
  assert.doesNotMatch(on, /stop rules off/);
});

// Review round 3 (2026-11-14), items the code handles that no test pinned.

test('R1 the loop ceiling comes before the stall rule', async () => {
  const repo = makeTestRepo();
  const request = { command: 'exit 7', cwd: repo, stallAfter: 2, maxRuns: 2 };
  assert.equal((await runEngine(request)).state, 'failed');
  const second = await runEngine(request);
  assert.equal(second.state, 'exhausted');
  assert.match(second.detail ?? '', /loop ceiling is 2/);
});

test('R1 a run at the loop ceiling does not spend the override record', async () => {
  const repo = makeTestRepo();
  await seedLedger(repo, ['a', 'b']);
  const before = await fingerprintTree(repo);
  assert.ok(before.ok);
  const file = join(dirname((await ledgerPath(repo)) as string), 'override.json');
  const record = { command: 'exit 9', fingerprint: before.fingerprint, reason: 'flaky', author: 'dom', kind: 'override' };
  writeFileSync(file, JSON.stringify(record));
  assert.equal((await runEngine({ command: 'exit 9', cwd: repo, maxRuns: 3 })).state, 'exhausted');
  assert.equal(existsSync(file), true, 'the record is still there');
});

test('R4 a passing run stays done when the ledger read after it fails, and the note says so', async () => {
  const repo = makeTestRepo();
  await seedLedger(repo, ['a']);
  const ledger = (await ledgerPath(repo)) as string;
  let answer: Awaited<ReturnType<typeof runEngine>> | undefined;
  const text = await stderrOf(async () => {
    answer = await runEngine({ command: `chmod 200 "${ledger}"`, cwd: repo, maxRuns: 3 });
  });
  chmodSync(ledger, 0o600);
  assert.equal(answer?.state, 'done');
  assert.equal(answer?.done, true);
  assert.match(text, /unless the run is done or killed/);
});
