// story: e06s05
// The one shot: a record is taken once, by an atomic rename, and only by the
// exact command on the exact tree (e06s05 AC-09 to AC-11).
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { takeOverride } from './override.ts';
import { cleanupTempDirs, makeTempDir } from './test-helpers.ts';

after(cleanupTempDirs);

const F = 'c'.repeat(64);
const now = new Date('2026-11-12T04:00:00.000Z');

const good = {
  command: 'c',
  fingerprint: F,
  reason: 'flaky network',
  author: 'dom',
  kind: 'override',
};

function setup(): { dir: string; path: string; text: string } {
  const dir = makeTempDir();
  const path = join(dir, 'override.json');
  const text = JSON.stringify(good);
  writeFileSync(path, text);
  return { dir, path, text };
}

const usedFiles = (dir: string) => readdirSync(dir).filter((n) => n.startsWith('override.used-'));

test('AC-e06s05-09 a matching record is taken once', async () => {
  const { dir, path, text } = setup();
  assert.deepEqual(await takeOverride(path, { command: 'c', fingerprint: F }, now), good);
  assert.equal(existsSync(path), false);
  const used = usedFiles(dir);
  assert.equal(used.length, 1);
  assert.match(used[0] as string, /^override\.used-\d+-[0-9a-f]{8}\.json$/);
  assert.equal(readFileSync(join(dir, used[0] as string), 'utf8'), text);
  assert.equal(await takeOverride(path, { command: 'c', fingerprint: F }, now), null);
});

const others: ReadonlyArray<[string, string, string | null]> = [
  ['another command', 'd', F],
  ['the command with a trailing space', 'c ', F],
  ['another fingerprint', 'c', 'd'.repeat(64)],
  ['a null fingerprint', 'c', null],
];

for (const [name, command, fingerprint] of others) {
  test(`AC-e06s05-10 a record for another run does nothing: ${name}`, async () => {
    const { dir, path, text } = setup();
    assert.equal(await takeOverride(path, { command: command, fingerprint: fingerprint }, now), null);
    assert.equal(readFileSync(path, 'utf8'), text);
    assert.equal(usedFiles(dir).length, 0);
  });
}

test('AC-e06s05-10 a bad record or a missing record gives null', async () => {
  const dir = makeTempDir();
  const path = join(dir, 'override.json');
  assert.equal(await takeOverride(path, { command: 'c', fingerprint: F }, now), null);
  writeFileSync(path, 'not json');
  assert.equal(await takeOverride(path, { command: 'c', fingerprint: F }, now), null);
  assert.equal(usedFiles(dir).length, 0);
});

test('AC-e06s05-11 two takers, one record', async () => {
  const { path } = setup();
  const results = await Promise.all([
    takeOverride(path, { command: 'c', fingerprint: F }, now),
    takeOverride(path, { command: 'c', fingerprint: F }, now),
  ]);
  assert.equal(results.filter((r) => r !== null).length, 1);
});
