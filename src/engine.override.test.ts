// story: e06s05
// The engine and the override record (e06s05 AC-12 to AC-18). Every command
// runs in a temporary git repository, never in the real one. Only
// process.stderr is mocked.
import { after, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

async function fingerprintOf(repo: string): Promise<string> {
  const result = await fingerprintTree(repo);
  assert.ok(result.ok);
  return result.fingerprint;
}

async function dirOf(repo: string): Promise<string> {
  const dir = dirname((await ledgerPath(repo)) as string);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Write a record for `command` on the current tree of `repo`. Returns the
 * text written. */
async function writeRecord(
  repo: string,
  command: string,
  over: Record<string, unknown> = {},
): Promise<string> {
  const text = JSON.stringify({
    command,
    fingerprint: await fingerprintOf(repo),
    reason: 'flaky network',
    author: 'dom',
    kind: 'override',
    ...over,
  });
  writeFileSync(join(await dirOf(repo), 'override.json'), text);
  return text;
}

async function recordState(repo: string): Promise<{ text: string | null; used: string[] }> {
  const dir = await dirOf(repo);
  const path = join(dir, 'override.json');
  return {
    text: existsSync(path) ? readFileSync(path, 'utf8') : null,
    used: readdirSync(dir).filter((name) => name.startsWith('override.used-')),
  };
}

test('AC-e06s05-12 a failed run becomes overridden', async () => {
  const repo = makeTestRepo();
  assert.equal((await runEngine({ command: 'exit 9', cwd: repo })).state, 'failed');
  await writeRecord(repo, 'exit 9');
  let answer: Awaited<ReturnType<typeof runEngine>> | undefined;
  const stderr = await stderrDuring(async () => {
    answer = await runEngine({ command: 'exit 9', cwd: repo });
  });
  assert.equal(stderr, '');
  assert.equal(answer?.state, 'overridden');
  assert.equal(answer?.done, false);
  assert.equal(answer?.reason, 'exit-nonzero');
  assert.equal(answer?.exitCode, 9);
  assert.equal(answer?.detail, 'flaky network');
  const lines = await readRepoStates(repo);
  assert.equal(lines.length, 1);
  assert.deepEqual(
    { ...lines[0], at: undefined },
    {
      at: undefined,
      state: 'overridden',
      command: 'exit 9',
      runs: 2,
      failStreak: 2,
      threshold: null,
      detail: 'flaky network',
      kind: 'override',
      author: 'dom',
    },
  );
  assert.equal(lines.filter((line) => line.state === 'stalled').length, 0);
});

test('AC-e06s05-13 a stalled run becomes overridden', async () => {
  const repo = makeTestRepo();
  await runEngine({ command: 'exit 9', cwd: repo });
  await runEngine({ command: 'exit 9', cwd: repo });
  await writeRecord(repo, 'exit 9', { kind: 'false-alarm' });
  const answer = await runEngine({ command: 'exit 9', cwd: repo });
  assert.equal(answer.state, 'overridden');
  const lines = await readRepoStates(repo);
  assert.deepEqual(
    lines.map((line) => [line.state, line.kind]),
    [['overridden', 'false-alarm']],
  );
});

test('AC-e06s05-14 the ceiling is reached by this run: exhausted, record kept', async () => {
  const repo = makeTestRepo();
  await runEngine({ command: 'exit 9', cwd: repo, maxFailures: 2 });
  const text = await writeRecord(repo, 'exit 9');
  const answer = await runEngine({ command: 'exit 9', cwd: repo, maxFailures: 2 });
  assert.equal(answer.state, 'exhausted');
  assert.deepEqual(await recordState(repo), { text, used: [] });
});

test('AC-e06s05-14 the ledger is at the ceiling before the run: exhausted, no run', async () => {
  const repo = makeTestRepo();
  const marker = join(makeTempDir(), 'ran');
  const command = `touch ${marker}; exit 9`;
  const path = (await ledgerPath(repo)) as string;
  for (let i = 0; i < 5; i += 1) {
    const verdict = { done: false, exitCode: 9, reason: 'exit-nonzero' as const, command, fingerprint: `F${i}` };
    assert.deepEqual(await appendEntry(path, verdict, at), { ok: true });
  }
  const text = await writeRecord(repo, command);
  const answer = await runEngine({ command, cwd: repo });
  assert.equal(answer.state, 'exhausted');
  assert.equal(existsSync(marker), false);
  assert.deepEqual(await recordState(repo), { text, used: [] });
});

test('AC-e06s05-14 a blocked request does not take the record', async () => {
  const repo = makeTestRepo();
  const text = await writeRecord(repo, 'exit 9');
  const answer = await runEngine({ command: 'exit 9', cwd: repo, blocked: 'need a key' });
  assert.equal(answer.state, 'blocked');
  assert.deepEqual(await recordState(repo), { text, used: [] });
});

test('AC-e06s05-14 a killed run does not take the record', async () => {
  const repo = makeTestRepo();
  const started = join(makeTempDir(), 'started');
  const command = `echo go > ${started}; sleep 30`;
  const text = await writeRecord(repo, command);
  const controller = new AbortController();
  const pending = runEngine({ command, cwd: repo }, controller.signal);
  assert.ok(await waitForFile(started, 5000));
  controller.abort();
  const answer = await pending;
  assert.equal(answer.state, 'killed');
  assert.deepEqual(await recordState(repo), { text, used: [] });
});

test('AC-e06s05-14 a passing run is done and does not take the record', async () => {
  const repo = makeTestRepo();
  const text = await writeRecord(repo, 'true');
  const answer = await runEngine({ command: 'true', cwd: repo });
  assert.equal(answer.state, 'done');
  assert.equal(answer.done, true);
  assert.deepEqual(await recordState(repo), { text, used: [] });
});

test('AC-e06s05-15 the record is used once', async () => {
  const repo = makeTestRepo();
  const request = { command: 'exit 9', cwd: repo, stallAfter: 9 };
  await runEngine(request);
  await writeRecord(repo, 'exit 9');
  assert.equal((await runEngine(request)).state, 'overridden');
  assert.equal((await runEngine(request)).state, 'failed');
  const lines = await readRepoStates(repo);
  assert.equal(lines.filter((line) => line.state === 'overridden').length, 1);
  assert.equal((await recordState(repo)).used.length, 1);
});

test('AC-e06s05-16 an override does not reset the failure count', async () => {
  const repo = makeTestRepo();
  const request = { command: 'exit 9', cwd: repo, maxFailures: 3 };
  assert.equal((await runEngine(request)).state, 'failed');
  await writeRecord(repo, 'exit 9');
  assert.equal((await runEngine(request)).state, 'overridden');
  assert.equal((await runEngine(request)).state, 'exhausted');
});

test('AC-e06s05-17 a record that cannot be logged does not apply', async (t) => {
  if (process.getuid?.() === 0) {
    t.skip('root can write a read-only file');
    return;
  }
  const repo = makeTestRepo();
  assert.equal((await runEngine({ command: 'exit 9', cwd: repo })).state, 'failed');
  const ledger = (await ledgerPath(repo)) as string;
  const before = readFileSync(ledger, 'utf8');
  chmodSync(ledger, 0o400);
  await writeRecord(repo, 'exit 9');
  let answer: Awaited<ReturnType<typeof runEngine>> | undefined;
  const stderr = await stderrDuring(async () => {
    answer = await runEngine({ command: 'exit 9', cwd: repo });
  });
  assert.notEqual(answer?.state, 'overridden');
  assert.equal(answer?.done, false);
  assert.match(stderr, /state line not written/);
  assert.equal(readFileSync(ledger, 'utf8'), before);
  const spent = await recordState(repo);
  assert.equal(spent.text, null);
  assert.equal(spent.used.length, 1);
});

test('AC-e06s05-18 a forged ledger and a record never make done', async () => {
  const repo = makeTestRepo();
  const fingerprint = await fingerprintOf(repo);
  const path = (await ledgerPath(repo)) as string;
  const forged = { done: true, exitCode: 0, reason: 'passed' as const, command: 'false', fingerprint };
  assert.deepEqual(await appendEntry(path, forged, at), { ok: true });
  const line = {
    at: at.toISOString(),
    state: 'overridden' as const,
    command: 'false',
    runs: 1,
    failStreak: 0,
    threshold: null,
    detail: 'forged',
    kind: 'override' as const,
    author: 'agent',
  };
  assert.deepEqual(await appendState(path, line, at), { ok: true });
  await writeRecord(repo, 'false');
  const answer = await runEngine({ command: 'false', cwd: repo });
  assert.equal(answer.done, false);
  assert.equal((await readRepoLedger(repo)).entries.at(-1)?.done, false);
});
