// story: e06s03
// Tests for the gate and the ledger together (e06s03 AC-09 to AC-13). Every
// command runs in a temporary git repository, never in the real one. The
// engine's own notes go to process.stderr, which is the only thing mocked.
import { after, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runGate, type Verdict } from './gate.ts';
import { appendEntry, countsFor, ledgerPath } from './ledger.ts';
import { fingerprintTree } from './tree.ts';
import { cleanupTempDirs, makeTempDir, makeTestRepo, readRepoLedger } from './test-helpers.ts';

after(cleanupTempDirs);

const hex64 = /^[0-9a-f]{64}$/;

/** Run `body` and return the text the engine wrote to stderr meanwhile. */
async function stderrDuring(body: () => Promise<void>): Promise<string> {
  const write = mock.method(process.stderr, 'write', () => true);
  try {
    await body();
    return write.mock.calls.map((call) => String(call.arguments[0])).join('');
  } finally {
    write.mock.restore();
  }
}

async function entriesOf(repo: string) {
  return (await readRepoLedger(repo)).entries;
}

test('AC-e06s03-09 every verdict is logged, done or not', async () => {
  const repo = makeTestRepo();
  const requests = [
    { command: 'true', cwd: repo },
    { command: 'false', cwd: repo },
    { command: 'sleep 30', cwd: repo, timeoutMs: 300 },
  ];
  const verdicts: Verdict[] = [];
  for (const request of requests) {
    verdicts.push(await runGate(request));
  }
  const entries = await entriesOf(repo);
  assert.deepEqual(
    entries.map((entry) => entry.reason),
    ['passed', 'exit-nonzero', 'timeout'],
  );
  entries.forEach((entry, index) => {
    const verdict = verdicts[index];
    assert.equal(entry.command, verdict?.command);
    assert.equal(entry.fingerprint, verdict?.fingerprint);
    assert.equal(entry.done, verdict?.done);
    assert.equal(entry.exitCode, verdict?.exitCode);
  });
});

test('AC-e06s03-09 a tree that changed under the command is logged as such', async () => {
  const repo = makeTestRepo();
  const verdict = await runGate({ command: 'echo more >> tracked.txt', cwd: repo });
  assert.equal(verdict.reason, 'tree-changed');
  assert.deepEqual(
    (await entriesOf(repo)).map((entry) => entry.reason),
    ['tree-changed'],
  );
});

test('AC-e06s03-10 a verdict with no tree is not logged and says so', async () => {
  const dir = makeTempDir();
  let reason = '';
  const text = await stderrDuring(async () => {
    reason = (await runGate({ command: 'true', cwd: dir })).reason;
  });
  assert.equal(reason, 'no-tree');
  assert.match(text, /ledger/);
  assert.equal(text.trim().split('\n').length, 1);
});

const unwritable: ReadonlyArray<{
  command: string;
  done: boolean;
  exitCode: number;
  reason: string;
}> = [
  { command: 'true', done: false, exitCode: 0, reason: 'no-ledger' },
  { command: 'false', done: false, exitCode: 1, reason: 'exit-nonzero' },
];

for (const expected of unwritable) {
  test(`AC-e06s03-11 a ledger that cannot be written: "${expected.command}"`, async () => {
    const repo = makeTestRepo();
    writeFileSync(join(repo, '.git', 'weftwork'), 'a file where the directory should be');
    const held: { verdict?: Verdict } = {};
    const text = await stderrDuring(async () => {
      held.verdict = await runGate({ command: expected.command, cwd: repo });
    });
    const verdict = held.verdict;
    assert.ok(verdict);
    assert.equal(verdict.done, expected.done);
    assert.equal(verdict.exitCode, expected.exitCode);
    assert.equal(verdict.reason, expected.reason);
    assert.match(String(verdict.fingerprint), hex64);
    assert.match(text, /ledger/);
  });
}

test('AC-e06s03-12 the gate never reads done from the ledger', async () => {
  const repo = makeTestRepo();
  const before = await fingerprintTree(repo);
  assert.ok(before.ok);
  const path = await ledgerPath(repo);
  assert.notEqual(path, null);
  const forged = {
    done: true,
    exitCode: 0,
    reason: 'passed' as const,
    command: 'false',
    fingerprint: before.fingerprint,
  };
  assert.ok((await appendEntry(path as string, forged, new Date())).ok);
  const verdict = await runGate({ command: 'false', cwd: repo });
  assert.equal(verdict.done, false);
  assert.equal(verdict.reason, 'exit-nonzero');
});

test('AC-e06s03-13 a done for an earlier tree is not fresh', async () => {
  const repo = makeTestRepo();
  const verdict = await runGate({ command: 'true', cwd: repo });
  assert.equal(verdict.done, true);
  writeFileSync(join(repo, 'tracked.txt'), 'edited\n');
  const now = await fingerprintTree(repo);
  assert.ok(now.ok);
  const counts = countsFor(await entriesOf(repo), 'true', now.fingerprint);
  assert.equal(counts.passes, 1);
  assert.equal(counts.fresh, false);
});

test('AC-e06s03-13 a done for the same tree is fresh', async () => {
  const repo = makeTestRepo();
  const verdict = await runGate({ command: 'true', cwd: repo });
  const counts = countsFor(await entriesOf(repo), 'true', String(verdict.fingerprint));
  assert.equal(counts.fresh, true);
});
