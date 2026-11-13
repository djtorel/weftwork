// story: e08s01
// readRegularFile and writeAtomic, the file rules the Stop-hook install and the
// state writer share: open without blocking (BUG-007), read only a regular file
// under a size cap, follow a symlink only when told, and write through a temp
// file and a rename that keeps the mode and leaves nothing behind.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readRegularFile, writeAtomic } from './regular-file.ts';
import { cleanupTempDirs, inChild, makeFifo, makeTempDir } from './test-helpers.ts';

after(cleanupTempDirs);

test('a missing file reads as no file', () => {
  const read = readRegularFile(join(makeTempDir(), 'state.yaml'), { follow: false, maxBytes: 100 });
  assert.deepEqual(read, { ok: true, file: null });
});

test('a regular file comes back with its text, mode and change time', () => {
  const path = join(makeTempDir(), 'state.yaml');
  writeFileSync(path, 'a: 1\n');
  chmodSync(path, 0o640);
  const read = readRegularFile(path, { follow: false, maxBytes: 100 });
  assert.ok(read.ok && read.file !== null);
  assert.equal(read.file.text, 'a: 1\n');
  assert.equal(read.file.mode, 0o640);
  assert.equal(read.file.mtime.getTime(), statSync(path).mtime.getTime());
});

test('the size cap: at the cap is read, one byte past it is refused', () => {
  const dir = makeTempDir();
  writeFileSync(join(dir, 'at'), 'x'.repeat(10));
  writeFileSync(join(dir, 'past'), 'x'.repeat(11));
  assert.ok(readRegularFile(join(dir, 'at'), { follow: false, maxBytes: 10 }).ok);
  const past = readRegularFile(join(dir, 'past'), { follow: false, maxBytes: 10 });
  assert.ok(!past.ok);
  assert.match(past.error, /larger than 10 bytes/);
});

test('a symlink is refused unless follow is set', () => {
  const dir = makeTempDir();
  writeFileSync(join(dir, 'target'), 'a: 1\n');
  symlinkSync(join(dir, 'target'), join(dir, 'link'));
  const refused = readRegularFile(join(dir, 'link'), { follow: false, maxBytes: 100 });
  assert.ok(!refused.ok);
  assert.match(refused.error, /cannot be opened as a regular file/);
  const followed = readRegularFile(join(dir, 'link'), { follow: true, maxBytes: 100 });
  assert.ok(followed.ok && followed.file !== null);
  assert.equal(followed.file.text, 'a: 1\n');
});

test('a directory is refused as not a regular file', () => {
  const read = readRegularFile(makeTempDir(), { follow: false, maxBytes: 100 });
  assert.ok(!read.ok);
  assert.match(read.error, /not a regular file/);
});

test('a FIFO is refused and the read does not block (BUG-007)', () => {
  const call = 'm.readRegularFile(fifo, { follow: false, maxBytes: 100 })';
  const out = inChild('regular-file.ts', call, `const fifo = ${JSON.stringify(makeFifo())};`);
  assert.ok(out.finished, `the read blocked or failed: ${out.stderr}`);
  const read = JSON.parse(out.stdout) as { ok: boolean; error?: string };
  assert.equal(read.ok, false);
  assert.match(read.error ?? '', /not a regular file/);
});

test('writeAtomic replaces the text, keeps the mode and leaves no temp file', () => {
  const dir = makeTempDir();
  const path = join(dir, 'state.yaml');
  writeFileSync(path, 'old\n');
  chmodSync(path, 0o600);
  assert.equal(writeAtomic(path, 'new\n', 0o600), null);
  assert.equal(readFileSync(path, 'utf8'), 'new\n');
  assert.equal(statSync(path).mode & 0o777, 0o600);
  assert.deepEqual(readdirSync(dir), ['state.yaml']);
});

test('a failed writeAtomic is an error value and leaves no temp file', () => {
  const dir = makeTempDir();
  const path = join(dir, 'state.yaml');
  mkdirSync(join(path, 'inside'), { recursive: true });
  const failed = writeAtomic(path, 'new\n', 0o600);
  assert.ok(failed !== null && !failed.ok);
  assert.match(failed.error, /could not be written/);
  assert.deepEqual(readdirSync(dir), ['state.yaml']);
});
