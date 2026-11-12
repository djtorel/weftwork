// story: e06s05
// The override record: what the reader accepts and rejects (e06s05 AC-05 to
// AC-08). Files live in temporary directories.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseOverride, readOverride } from './override.ts';
import { setTimeout as delay } from 'node:timers/promises';
import { cleanupTempDirs, makeTempDir } from './test-helpers.ts';

after(cleanupTempDirs);

const hex = 'b'.repeat(64);

function record(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    command: 'exit 9',
    fingerprint: hex,
    reason: 'flaky network',
    author: 'dom',
    kind: 'override',
    ...over,
  };
}

function without(key: string): Record<string, unknown> {
  const { [key]: _gone, ...rest } = record();
  return rest;
}

for (const kind of ['override', 'false-alarm'] as const) {
  test(`AC-e06s05-05 a good record, kind ${kind}`, () => {
    const result = parseOverride(JSON.stringify(record({ kind })));
    assert.ok(result.ok);
    assert.deepEqual(result.override, record({ kind }));
  });
}

const bad: ReadonlyArray<[string, string]> = [
  ['text that is not JSON', 'not json'],
  ['a JSON array', '[]'],
  ['a record with no reason', JSON.stringify(without('reason'))],
  ['a record with a reason of only spaces', JSON.stringify(record({ reason: '   ' }))],
  ['a record with an empty command', JSON.stringify(record({ command: '' }))],
  ['a record with an empty author', JSON.stringify(record({ author: '' }))],
  ['a record with a reason of 1001 characters', JSON.stringify(record({ reason: 'x'.repeat(1001) }))],
  ['a record with an author of 201 characters', JSON.stringify(record({ author: 'x'.repeat(201) }))],
  ['a record whose command is the number 5', JSON.stringify(record({ command: 5 }))],
  ['a record with an extra key "pattern"', JSON.stringify(record({ pattern: 'exit *' }))],
  ['a record with an extra key "glob"', JSON.stringify(record({ glob: '*' }))],
  ['a record with kind "always"', JSON.stringify(record({ kind: 'always' }))],
  ['a record with fingerprint "*"', JSON.stringify(record({ fingerprint: '*' }))],
  ['a record with a 63-character fingerprint', JSON.stringify(record({ fingerprint: 'b'.repeat(63) }))],
  ['a record with an upper-case fingerprint', JSON.stringify(record({ fingerprint: 'B'.repeat(64) }))],
  ['a record whose command is "*"', JSON.stringify(record({ command: '*' }))],
  ['a record whose command is ".*"', JSON.stringify(record({ command: '.*' }))],
];

for (const [name, text] of bad) {
  test(`AC-e06s05-06 a bad record is a value, not a throw: ${name}`, () => {
    const result = parseOverride(text);
    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.error.length > 0);
  });
}

test('AC-e06s05-05 a record saved with a UTF-8 byte order mark is read', () => {
  const result = parseOverride(`\uFEFF${JSON.stringify(record())}`);
  assert.ok(result.ok);
  assert.deepEqual(result.override, record());
});

test('AC-e06s05-07 a star inside a real command is kept', () => {
  const result = parseOverride(JSON.stringify(record({ command: 'ls *.ts' })));
  assert.ok(result.ok);
  assert.equal(result.override.command, 'ls *.ts');
});

function dirWith(): string {
  const dir = makeTempDir();
  mkdirSync(dir, { recursive: true });
  return dir;
}

test('AC-e06s05-08 a missing file is no record', async () => {
  const result = await readOverride(join(dirWith(), 'override.json'));
  assert.deepEqual(result, { ok: true, override: null });
});

test('AC-e06s05-08 a good file is read', async () => {
  const path = join(dirWith(), 'override.json');
  writeFileSync(path, JSON.stringify(record()));
  const result = await readOverride(path);
  assert.ok(result.ok);
  assert.deepEqual(result.override, record());
});

test('AC-e06s05-08 a directory is not ok', async () => {
  const dir = dirWith();
  const path = join(dir, 'override.json');
  mkdirSync(path);
  assert.equal((await readOverride(path)).ok, false);
});

test('AC-e06s05-08 a symlink to a good record is not ok', async () => {
  const dir = dirWith();
  writeFileSync(join(dir, 'real.json'), JSON.stringify(record()));
  symlinkSync(join(dir, 'real.json'), join(dir, 'override.json'));
  assert.equal((await readOverride(join(dir, 'override.json'))).ok, false);
});

test('AC-e06s05-08 a FIFO is not ok and does not block', async () => {
  const dir = dirWith();
  const path = join(dir, 'override.json');
  execFileSync('mkfifo', [path]);
  const timer = new AbortController();
  const hung = delay(2000, 'hung', { signal: timer.signal }).catch(() => 'cleared');
  const result = await Promise.race([readOverride(path), hung]);
  timer.abort();
  assert.notEqual(result, 'hung');
  assert.ok(typeof result === 'object' && !result.ok);
});

test('AC-e06s05-08 a file of 65537 bytes is not ok', async () => {
  const path = join(dirWith(), 'override.json');
  writeFileSync(path, ' '.repeat(65537));
  assert.equal((await readOverride(path)).ok, false);
});
