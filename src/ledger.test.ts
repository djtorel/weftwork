// story: e06s03
// Tests for the counts ledger (e06s03 AC-01 to AC-08). Every ledger lives in
// a temporary git repository, never in the real one.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Verdict } from './gate.ts';
import { appendEntry, countsFor, ledgerPath, readLedger, type LedgerEntry } from './ledger.ts';
import { fingerprintTree } from './tree.ts';
import { cleanupTempDirs, git, makeTempDir, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const at = new Date('2026-11-12T03:00:00.000Z');
const hex = 'a'.repeat(64);

function verdict(over: Partial<Verdict> = {}): Verdict {
  return { done: true, exitCode: 0, reason: 'passed', command: 'true', fingerprint: hex, ...over };
}

async function pathIn(cwd: string): Promise<string> {
  const path = await ledgerPath(cwd);
  assert.notEqual(path, null);
  return path as string;
}

function assertOk(result: { ok: boolean }): void {
  assert.equal(result.ok, true);
}

function goodLine(command = 'true'): string {
  return JSON.stringify({
    at: at.toISOString(),
    done: true,
    exitCode: 0,
    reason: 'passed',
    command,
    fingerprint: hex,
  });
}

/** A ledger file with `content` written as it is. */
async function ledgerWith(content: string): Promise<string> {
  const path = await pathIn(makeTestRepo());
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
  return path;
}

test('AC-e06s03-01 the ledger path is inside the git dir of a repository', async () => {
  const repo = makeTestRepo();
  const path = await pathIn(repo);
  assert.equal(path, join(repo, '.git', 'weftwork', 'ledger.jsonl'));
});

test('AC-e06s03-01 a subdirectory gives the path of the root', async () => {
  const repo = makeTestRepo();
  mkdirSync(join(repo, 'sub'));
  assert.equal(await ledgerPath(join(repo, 'sub')), await ledgerPath(repo));
});

test('AC-e06s03-01 a linked worktree gets its own path', async () => {
  const repo = makeTestRepo();
  const worktree = join(makeTempDir(), 'wt');
  git(repo, 'worktree', 'add', '-q', worktree);
  const own = await pathIn(worktree);
  assert.notEqual(own, await ledgerPath(repo));
  assert.ok(own.endsWith(join('weftwork', 'ledger.jsonl')));
});

test('AC-e06s03-01 where there is no git working tree the path is null', async () => {
  assert.equal(await ledgerPath(makeTempDir()), null);
  assert.equal(await ledgerPath(join(makeTempDir(), 'missing')), null);
  assert.equal(await ledgerPath('bad\0path'), null);
});

test('AC-e06s03-02 writing an entry does not change the tree fingerprint', async () => {
  const repo = makeTestRepo();
  const before = await fingerprintTree(repo);
  assertOk(await appendEntry(await pathIn(repo), verdict(), at));
  assert.deepEqual(await fingerprintTree(repo), before);
});

test('AC-e06s03-02 the ledger file and directory are private to the owner', async () => {
  const path = await pathIn(makeTestRepo());
  assertOk(await appendEntry(path, verdict(), at));
  assert.equal(statSync(path).mode & 0o077, 0);
  assert.equal(statSync(join(path, '..')).mode & 0o077, 0);
});

test('AC-e06s03-03 two entries are written and read back in order', async () => {
  const path = await pathIn(makeTestRepo());
  assertOk(await appendEntry(path, verdict(), at));
  const failed = verdict({ done: false, exitCode: 1, reason: 'exit-nonzero', command: 'false' });
  assertOk(await appendEntry(path, failed, at));
  const read = await readLedger(path);
  assert.ok(read.ok);
  assert.equal(read.skipped, 0);
  assert.deepEqual(read.entries, [
    { at: at.toISOString(), ...verdict() },
    { at: at.toISOString(), ...failed },
  ]);
});

test('AC-e06s03-03 a verdict with no fingerprint and no exit code is kept', async () => {
  const path = await pathIn(makeTestRepo());
  const odd = verdict({ done: false, exitCode: null, reason: 'no-tree', fingerprint: null });
  assertOk(await appendEntry(path, odd, at));
  const read = await readLedger(path);
  assert.ok(read.ok);
  assert.equal(read.entries[0]?.fingerprint, null);
  assert.equal(read.entries[0]?.exitCode, null);
});

test('AC-e06s03-04 a command with a newline is one entry', async () => {
  const path = await pathIn(makeTestRepo());
  const command = `echo hi\n${goodLine('fake')}`;
  assertOk(await appendEntry(path, verdict({ command }), at));
  const lines = readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line !== '');
  assert.equal(lines.length, 1);
  const read = await readLedger(path);
  assert.ok(read.ok);
  assert.equal(read.entries.length, 1);
  assert.equal(read.entries[0]?.command, command);
});

const badLines: ReadonlyArray<{ name: string; bad: string; skipped: number }> = [
  { name: 'a torn last line with no newline', bad: '{"at":"2026-11', skipped: 1 },
  { name: 'a line that is not JSON', bad: 'not json\n', skipped: 1 },
  { name: 'a JSON array', bad: '[1,2]\n', skipped: 1 },
  {
    name: 'an object with done as a string',
    bad: `${goodLine().replace('"done":true', '"done":"true"')}\n`,
    skipped: 1,
  },
  {
    name: 'an object with no command',
    bad: `${goodLine().replace(/"command":"true",/, '')}\n`,
    skipped: 1,
  },
  { name: 'a blank line', bad: '\n\n', skipped: 0 },
  { name: 'an object with one extra key', bad: `${goodLine().replace('{', '{"extra":1,')}\n`, skipped: 0 },
];

for (const { name, bad, skipped } of badLines) {
  test(`AC-e06s03-05 the reader skips ${name}`, async () => {
    const path = await ledgerWith(`${goodLine('good')}\n${bad}`);
    const read = await readLedger(path);
    assert.ok(read.ok);
    assert.equal(read.skipped, skipped);
    const commands = read.entries.map((entry) => entry.command);
    assert.ok(commands.includes('good'));
  });
}

test('AC-e06s03-05 an extra key is dropped from the entry', async () => {
  const path = await ledgerWith(`${goodLine().replace('{', '{"extra":1,')}\n`);
  const read = await readLedger(path);
  assert.ok(read.ok);
  assert.equal('extra' in (read.entries[0] as object), false);
});

test('AC-e06s03-06 a torn line does not spoil the next entry', async () => {
  const path = await ledgerWith('{"at":"2026-11');
  assertOk(await appendEntry(path, verdict({ command: 'next' }), at));
  const read = await readLedger(path);
  assert.ok(read.ok);
  assert.equal(read.skipped, 1);
  assert.equal(read.entries.length, 1);
  assert.equal(read.entries[0]?.command, 'next');
});

test('AC-e06s03-07 a ledger that does not exist reads as empty', async () => {
  const path = await pathIn(makeTestRepo());
  assert.deepEqual(await readLedger(path), { ok: true, entries: [], skipped: 0 });
});

test('AC-e06s03-07 a path that is a directory is not ok and does not throw', async () => {
  const read = await readLedger(makeTempDir());
  assert.equal(read.ok, false);
});

test('AC-e06s03-07 appending where the directory cannot be made is not ok', async () => {
  const path = await pathIn(makeTestRepo());
  mkdirSync(join(path, '..', '..'), { recursive: true });
  writeFileSync(join(path, '..'), 'a file where the directory should be');
  const result = await appendEntry(path, verdict(), at);
  assert.equal(result.ok, false);
});

function entry(done: boolean, command = 'a', fingerprint = 'F'): LedgerEntry {
  const exitCode = done ? 0 : 1;
  const reason = done ? 'passed' : 'exit-nonzero';
  return { at: at.toISOString(), done, exitCode, reason, command, fingerprint };
}

const countCases: ReadonlyArray<{
  name: string;
  entries: LedgerEntry[];
  expected: ReturnType<typeof countsFor>;
}> = [
  {
    name: 'none',
    entries: [],
    expected: { runs: 0, passes: 0, failures: 0, failStreak: 0, fresh: false },
  },
  {
    name: 'fail',
    entries: [entry(false)],
    expected: { runs: 1, passes: 0, failures: 1, failStreak: 1, fresh: false },
  },
  {
    name: 'fail, fail, pass',
    entries: [entry(false), entry(false), entry(true)],
    expected: { runs: 3, passes: 1, failures: 2, failStreak: 0, fresh: true },
  },
  {
    name: 'pass, fail, fail',
    entries: [entry(true), entry(false), entry(false)],
    expected: { runs: 3, passes: 1, failures: 2, failStreak: 2, fresh: false },
  },
  {
    name: 'pass at F, fail, pass at G',
    entries: [entry(true), entry(false), entry(true, 'a', 'G')],
    expected: { runs: 3, passes: 2, failures: 1, failStreak: 0, fresh: false },
  },
];

for (const { name, entries, expected } of countCases) {
  test(`AC-e06s03-08 counts for ${name}`, () => {
    const others = [entry(false, 'b'), entry(true, 'b')];
    assert.deepEqual(countsFor([...others, ...entries], 'a', 'F'), expected);
  });
}

test('AC-e06s03-08 a command is matched by its exact string', () => {
  const counts = countsFor([entry(true, 'a b'), entry(true, 'a')], 'a', 'F');
  assert.equal(counts.runs, 1);
});
