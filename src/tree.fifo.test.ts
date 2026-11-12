// story: e07s02
// BUG-007, the fingerprint side: a file that lstat saw as a regular file can be
// swapped for a FIFO before it is opened, by a process the agent left running.
// Opening a FIFO blocks in a thread nothing can abort, so hashFile must open
// without blocking and look again at the open file. The swap cannot be timed
// from a test, so the cases call hashFile on the FIFO directly, in a child that
// is killed after a limit (see inChild).
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempDirs, inChild, makeFifo, makeTempDir } from './test-helpers.ts';
import { hashFile } from './tree.ts';

after(cleanupTempDirs);

const hashOf = (path: string) =>
  inChild(
    'tree.ts',
    'm.hashFile(Buffer.from(path)).then((digest) => ({ ok: true, digest }), (e) => ({ ok: false, error: e.message }))',
    `const path = ${JSON.stringify(path)};`,
  );

test('BUG-007 hashFile on a FIFO is refused and does not hang', () => {
  const out = hashOf(makeFifo());
  assert.equal(out.finished, true, `it hung (killed after 8 s): ${out.stderr}`);
  assert.match(out.stdout, /"ok":false/);
});

test('BUG-007 hashFile on a symlink is refused: a listed file is never a link at hash time', () => {
  const dir = makeTempDir();
  writeFileSync(join(dir, 'target'), 'data');
  symlinkSync(join(dir, 'target'), join(dir, 'link'));
  const out = hashOf(join(dir, 'link'));
  assert.equal(out.finished, true);
  assert.match(out.stdout, /"ok":false/);
});

test('BUG-007 hashFile on a regular file is still its SHA-256', async () => {
  const path = join(makeTempDir(), 'file.txt');
  writeFileSync(path, 'some bytes\n');
  const expected = createHash('sha256').update('some bytes\n').digest('hex');
  assert.equal(await hashFile(Buffer.from(path)), expected);
});

test('BUG-007 hashFile on an empty file is the SHA-256 of nothing', async () => {
  const path = join(makeTempDir(), 'empty');
  writeFileSync(path, '');
  assert.equal(await hashFile(Buffer.from(path)), createHash('sha256').update('').digest('hex'));
});
