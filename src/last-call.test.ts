// story: e07s04
// The call record the adapter writes on each call and the live check reads
// (e07s04 task 2). It lives beside the ledger in the git dir. The agent can
// replace the file, so only a regular file is read or written: a FIFO must
// not hang (BUG-007) and a symlink must not send the truncate to another file.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { linkSync, mkdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { lastCallPath, readLastCall, writeLastCall } from './last-call.ts';
import { cleanupTempDirs, inChild, makeFifo, makeTempDir, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const call = { at: '2026-11-12T10:00:00.000Z', cliPath: '/opt/w/src/claude-hook-cli.ts', command: 'npm test' };

/** A path for the record in a fresh directory that does not exist yet. */
function freshPath(): string {
  return join(makeTempDir(), 'weftwork', 'last-call.json');
}

test('the record sits beside the ledger in the git dir', async () => {
  const repo = makeTestRepo();
  assert.equal(await lastCallPath(repo), join(repo, '.git', 'weftwork', 'last-call.json'));
});

test('a directory outside any git repository has no record path', async () => {
  assert.equal(await lastCallPath(makeTempDir()), null);
});

test('a written record is read back', async () => {
  const path = freshPath();
  assert.deepEqual(await writeLastCall(path, call), { ok: true });
  assert.deepEqual(await readLastCall(path), { ok: true, call });
});

test('a second write replaces the first, with no tail of the longer text left', async () => {
  const path = freshPath();
  await writeLastCall(path, { ...call, command: 'npm run a-much-longer-command-name' });
  await writeLastCall(path, call);
  assert.deepEqual(await readLastCall(path), { ok: true, call });
});

test('the directory is 0700 and the file 0600, since the command may hold a secret', async () => {
  const path = freshPath();
  await writeLastCall(path, call);
  assert.equal(statSync(dirname(path)).mode & 0o777, 0o700);
  assert.equal(statSync(path).mode & 0o777, 0o600);
});

test('no file reads as no call', async () => {
  assert.deepEqual(await readLastCall(freshPath()), { ok: true, call: null });
});

test('a file that is not JSON, or has a field of the wrong type, is an error', async () => {
  const path = freshPath();
  mkdirSync(dirname(path), { recursive: true });
  for (const text of ['{"at":', '[]', JSON.stringify({ ...call, command: 7 }), JSON.stringify({ ...call, cliPath: 5 }), JSON.stringify({ at: call.at })]) {
    writeFileSync(path, text);
    const read = await readLastCall(path);
    assert.equal(read.ok, false, text);
  }
});

test('a symlink is refused and the file it points to is not touched', async () => {
  const dir = makeTempDir();
  const target = join(dir, 'source.ts');
  writeFileSync(target, 'keep me\n');
  const path = join(dir, 'last-call.json');
  symlinkSync(target, path);
  assert.equal((await writeLastCall(path, call)).ok, false);
  assert.equal(readFileSync(target, 'utf8'), 'keep me\n');
  assert.equal((await readLastCall(path)).ok, false);
});

test('a hard link is refused and the file it shares is not touched (security F1)', async () => {
  const dir = makeTempDir();
  const victim = join(dir, 'source.ts');
  writeFileSync(victim, 'keep me\n');
  const path = join(dir, 'last-call.json');
  linkSync(victim, path);
  const write = await writeLastCall(path, call);
  assert.equal(write.ok, false);
  assert.equal(readFileSync(victim, 'utf8'), 'keep me\n');
});

test('a directory in place of the file is an error, never a throw', async () => {
  const path = freshPath();
  mkdirSync(path, { recursive: true });
  assert.equal((await writeLastCall(path, call)).ok, false);
  assert.equal((await readLastCall(path)).ok, false);
});

test('an error names the call record, not the ledger (review A-F1)', async () => {
  const path = freshPath();
  mkdirSync(path, { recursive: true });
  const read = await readLastCall(path);
  assert.ok(!read.ok);
  assert.match(read.error, /last-call\.json/);
  assert.doesNotMatch(read.error, /ledger/);
});

test('a record past 64 KiB is refused on read (review B-F3)', async () => {
  const path = freshPath();
  await writeLastCall(path, { ...call, command: 'x'.repeat(64 * 1024) });
  assert.equal((await readLastCall(path)).ok, false);
});

test('a symlink to a valid record is refused on read (review B-F3)', async () => {
  const dir = makeTempDir();
  const real = join(dir, 'real.json');
  await writeLastCall(real, call);
  const path = join(dir, 'last-call.json');
  symlinkSync(real, path);
  assert.equal((await readLastCall(path)).ok, false);
});

test('a record whose time is missing, not a time, or too long is not a call record (review round 3, A4, B-3)', async () => {
  const path = freshPath();
  mkdirSync(dirname(path), { recursive: true });
  const { at: _at, ...noTime } = call;
  for (const record of [noTime, { ...call, at: 7 }, { ...call, at: 'not a time' }, { ...call, at: `${' '.repeat(300)}2026-11-12` }]) {
    writeFileSync(path, JSON.stringify(record));
    const read = await readLastCall(path);
    assert.ok(!read.ok, JSON.stringify(record).slice(0, 60));
    assert.match(read.error, /not a call record/);
  }
});

test('a time of exactly 40 characters and a record of exactly 64 KiB are read (review round 5, B-5)', async () => {
  const path = freshPath();
  mkdirSync(dirname(path), { recursive: true });
  const at = '2026-11-12T10:00:00.00000000000000+00:00';
  assert.equal(at.length, 40);
  writeFileSync(path, JSON.stringify({ ...call, at }));
  assert.ok((await readLastCall(path)).ok, 'a 40-character time');
  writeFileSync(path, JSON.stringify({ ...call, at: `${at.slice(0, 20)}0${at.slice(20)}` }));
  assert.ok(!(await readLastCall(path)).ok, 'a 41-character time');
  const base = JSON.stringify({ ...call, command: '' });
  writeFileSync(path, JSON.stringify({ ...call, command: 'x'.repeat(64 * 1024 - base.length) }));
  assert.equal(statSync(path).size, 64 * 1024);
  assert.ok((await readLastCall(path)).ok, 'a record of exactly 64 KiB');
});

test('a FIFO in place of the file returns at once for a write and a read (BUG-007)', () => {
  const fifo = JSON.stringify(makeFifo());
  const out = inChild(
    'last-call.ts',
    '[w.ok, r.ok]',
    `const w = await m.writeLastCall(${fifo}, ${JSON.stringify(call)});
     const r = await m.readLastCall(${fifo});`,
  );
  assert.ok(out.finished, 'the calls returned');
  assert.equal(out.stdout.trim(), '[false,false]');
});
