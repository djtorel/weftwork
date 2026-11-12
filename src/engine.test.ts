// story: e06s04
// The engine's order of checks and its state lines (e06s04 AC-18 to AC-23,
// AC-27 to AC-29). Every command runs in a temporary git repository, never
// in the real one. Only process.stderr is mocked.
import { after, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runEngine } from './engine.ts';
import { appendEntry, appendState, ledgerPath } from './ledger.ts';
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

const at = new Date('2026-11-12T03:00:00.000Z');

async function stderrDuring(body: () => Promise<void>): Promise<string> {
  const write = mock.method(process.stderr, 'write', () => true);
  try {
    await body();
    return write.mock.calls.map((call) => String(call.arguments[0])).join('');
  } finally {
    write.mock.restore();
  }
}

/** `count` failed runs of `command`, written straight into the ledger. */
async function seedFailures(repo: string, command: string, count: number): Promise<void> {
  const path = (await ledgerPath(repo)) as string;
  for (let i = 0; i < count; i += 1) {
    const verdict = { done: false, exitCode: 1, reason: 'exit-nonzero' as const, command, fingerprint: `F${i}` };
    assert.deepEqual(await appendEntry(path, verdict, at), { ok: true });
  }
}

test('AC-e06s04-18 a passing run is done, with a done state line', async () => {
  const repo = makeTestRepo();
  const answer = await runEngine({ command: 'true', cwd: repo });
  assert.equal(answer.state, 'done');
  assert.equal(answer.done, true);
  assert.equal((await readRepoLedger(repo)).entries.length, 1);
  const [line, ...rest] = await readRepoStates(repo);
  assert.equal(rest.length, 0);
  assert.deepEqual(
    { ...line, at: undefined },
    {
      at: undefined,
      state: 'done',
      command: 'true',
      runs: 1,
      failStreak: 0,
      threshold: null,
      detail: null,
    },
  );
});

test('AC-e06s04-19 a plain failure is failed and writes no state line', async () => {
  const repo = makeTestRepo();
  const answer = await runEngine({ command: 'exit 7', cwd: repo });
  assert.equal(answer.state, 'failed');
  assert.equal(answer.done, false);
  assert.equal(answer.reason, 'exit-nonzero');
  assert.equal(answer.exitCode, 7);
  assert.deepEqual(await readRepoStates(repo), []);
  assert.equal((await readRepoLedger(repo)).entries.length, 1);
});

test('AC-e06s04-20 three identical failed runs on one tree are stalled', async () => {
  const repo = makeTestRepo();
  const states: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    states.push((await runEngine({ command: 'exit 7', cwd: repo })).state);
  }
  assert.deepEqual(states, ['failed', 'failed', 'stalled']);
  const [line] = await readRepoStates(repo);
  assert.equal(line?.state, 'stalled');
  assert.equal(line?.runs, 3);
  assert.equal(line?.failStreak, 3);
  assert.equal(line?.threshold, 3);
  assert.equal(typeof line?.detail, 'string');
});

test('AC-e06s04-20 the stalled answer keeps the run verdict', async () => {
  const repo = makeTestRepo();
  await runEngine({ command: 'exit 7', cwd: repo });
  await runEngine({ command: 'exit 7', cwd: repo });
  const answer = await runEngine({ command: 'exit 7', cwd: repo });
  assert.equal(answer.state, 'stalled');
  assert.equal(answer.reason, 'exit-nonzero');
  assert.equal(answer.exitCode, 7);
  assert.equal(answer.done, false);
});

test('AC-e06s04-20 a change to the tree starts a new count', async () => {
  const repo = makeTestRepo();
  for (let i = 0; i < 3; i += 1) {
    await runEngine({ command: 'exit 7', cwd: repo });
  }
  writeFileSync(join(repo, 'tracked.txt'), 'edited\n');
  assert.equal((await runEngine({ command: 'exit 7', cwd: repo })).state, 'failed');
});

test('AC-e06s04-20 the stall threshold is read from the request', async () => {
  const repo = makeTestRepo();
  await runEngine({ command: 'exit 7', cwd: repo, stallAfter: 2 });
  const answer = await runEngine({ command: 'exit 7', cwd: repo, stallAfter: 2 });
  assert.equal(answer.state, 'stalled');
});

test('AC-e06s04-21 the third failed run at a ceiling of 3 is exhausted', async () => {
  const repo = makeTestRepo();
  const command = 'echo x >> tracked.txt; exit 7';
  const states: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    states.push((await runEngine({ command, cwd: repo, maxFailures: 3 })).state);
  }
  assert.deepEqual(states, ['failed', 'failed', 'exhausted']);
  const [line] = await readRepoStates(repo);
  assert.equal(line?.state, 'exhausted');
  assert.equal(line?.threshold, 3);
  assert.equal(line?.failStreak, 3);
});

test('AC-e06s04-22 at the ceiling the command is not run, and never gives done', async () => {
  const repo = makeTestRepo();
  const marker = join(makeTempDir(), 'ran');
  const command = `touch "${marker}"`;
  await seedFailures(repo, command, 5);
  const answer = await runEngine({ command, cwd: repo });
  assert.equal(answer.state, 'exhausted');
  assert.equal(answer.done, false);
  assert.equal(answer.reason, 'not-run');
  assert.equal(answer.exitCode, null);
  assert.equal(answer.fingerprint, null);
  assert.equal(existsSync(marker), false);
  const lines = await readRepoStates(repo);
  assert.equal(lines.at(-1)?.state, 'exhausted');
  assert.equal(lines.at(-1)?.runs, 5);
  // The owner restarts by deleting the ledger file.
  rmSync((await ledgerPath(repo)) as string);
  assert.equal((await runEngine({ command, cwd: repo })).state, 'done');
  assert.equal(existsSync(marker), true);
});

test('AC-e06s04-22 the ceiling is read from the request', async () => {
  const repo = makeTestRepo();
  await seedFailures(repo, 'check', 2);
  assert.equal((await runEngine({ command: 'true', cwd: repo })).state, 'done');
  await seedFailures(repo, 'other', 2);
  assert.equal((await runEngine({ command: 'other', cwd: repo, maxFailures: 2 })).state, 'exhausted');
});

test('AC-e06s04-23 exhausted outranks stalled', async () => {
  const repo = makeTestRepo();
  const request = { command: 'exit 7', cwd: repo, stallAfter: 3, maxFailures: 3 };
  await runEngine(request);
  await runEngine(request);
  assert.equal((await runEngine(request)).state, 'exhausted');
});

test('AC-e06s04-27 the ledger never gives done', async () => {
  const repo = makeTestRepo();
  const tree = await fingerprintTree(repo);
  assert.ok(tree.ok);
  const path = (await ledgerPath(repo)) as string;
  const forged = { done: true, exitCode: 0, reason: 'passed' as const, command: 'false', fingerprint: tree.fingerprint };
  await appendEntry(path, forged, at);
  await appendState(
    path,
    { at: at.toISOString(), state: 'done', command: 'false', runs: 1, failStreak: 0, threshold: null, detail: null },
    at,
  );
  const answer = await runEngine({ command: 'false', cwd: repo });
  assert.equal(answer.state, 'failed');
  assert.equal(answer.done, false);
  assert.equal(answer.reason, 'exit-nonzero');
});

test('AC-e06s04-28 an unreadable ledger turns the rules off, not the gate', async () => {
  const repo = makeTestRepo();
  mkdirSync(join((await ledgerPath(repo)) as string), { recursive: true });
  const held: string[] = [];
  const text = await stderrDuring(async () => {
    held.push((await runEngine({ command: 'exit 7', cwd: repo })).state);
    const second = await runEngine({ command: 'true', cwd: repo });
    held.push(second.state, String(second.done));
  });
  assert.deepEqual(held, ['failed', 'failed', 'false']);
  assert.match(text, /ledger/);
});

test('AC-e06s04-29 an abort gives killed, a run entry and a killed state line', { timeout: 15000 }, async () => {
  const repo = makeTestRepo();
  const pidFile = join(makeTempDir(), 'pid');
  const controller = new AbortController();
  const running = runEngine(
    { command: `sleep 30 & echo $! > "${pidFile}"; wait`, cwd: repo },
    controller.signal,
  );
  assert.ok(await waitForFile(pidFile, 5000));
  controller.abort();
  const answer = await running;
  assert.equal(answer.state, 'killed');
  assert.equal(answer.reason, 'killed');
  assert.equal(answer.done, false);
  assert.deepEqual((await readRepoLedger(repo)).entries.map((entry) => entry.reason), ['killed']);
  const lines = await readRepoStates(repo);
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.state, 'killed');
  assert.equal(lines[0]?.runs, 1);
});
