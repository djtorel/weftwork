// Tests for the evidence gate library (e06s01, AC-01 to AC-04).
// Only shell built-ins are used (true, false, exit, test), no sleeps.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseRequest, runGate } from './gate.ts';

const repoRoot = process.cwd();
const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'weftwork-gate-'));
  tempDirs.push(dir);
  return dir;
}

after(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC-e06s01-01 exit code 0 is done', async () => {
  const verdict = await runGate({ command: 'true', cwd: repoRoot });
  assert.deepEqual(verdict, { done: true, exitCode: 0 });
});

const notDoneCases: ReadonlyArray<{ command: string; code: number }> = [
  { command: 'false', code: 1 },
  { command: 'exit 3', code: 3 },
  { command: 'no-such-command-xyz', code: 127 },
  { command: 'true && false', code: 1 },
];

for (const { command, code } of notDoneCases) {
  test(`AC-e06s01-02 "${command}" is not done, exit code ${code}`, async () => {
    const verdict = await runGate({ command, cwd: repoRoot });
    assert.deepEqual(verdict, { done: false, exitCode: code });
  });
}

test('AC-e06s01-03 the command runs in the given directory', async () => {
  const dir = makeTempDir();
  writeFileSync(join(dir, 'marker'), '');
  const inDir = await runGate({ command: 'test -f marker', cwd: dir });
  assert.deepEqual(inDir, { done: true, exitCode: 0 });
  const inRoot = await runGate({ command: 'test -f marker', cwd: repoRoot });
  assert.equal(inRoot.done, false);
});

test('AC-e06s01-04 a cwd that does not exist is not done, no throw', async () => {
  const missing = join(makeTempDir(), 'does-not-exist');
  const verdict = await runGate({ command: 'true', cwd: missing });
  assert.deepEqual(verdict, { done: false, exitCode: null });
});

test('AC-e06s01-04 a command killed by a signal is not done, no throw', async () => {
  const verdict = await runGate({ command: 'kill -TERM $$', cwd: repoRoot });
  assert.deepEqual(verdict, { done: false, exitCode: null });
});

// AC-e06s01-05: parseRequest accepts and rejects input.
const okCases: ReadonlyArray<{ text: string; cwd: string }> = [
  { text: '{"command":"true"}', cwd: '/d' },
  { text: '{"command":"true","cwd":"/x"}', cwd: '/x' },
  { text: '{"command":"true","extra":1}', cwd: '/d' },
];

for (const { text, cwd } of okCases) {
  test(`AC-e06s01-05 parseRequest accepts ${text}`, () => {
    const result = parseRequest(text, '/d');
    assert.deepEqual(result, { ok: true, request: { command: 'true', cwd } });
  });
}

const errorCases: ReadonlyArray<string> = [
  'not json',
  '',
  '[]',
  'null',
  '{}',
  '{"command":""}',
  '{"command":"   "}',
  '{"command":5}',
  '{"command":"true","cwd":5}',
];

for (const text of errorCases) {
  test(`AC-e06s01-05 parseRequest rejects ${JSON.stringify(text)}`, () => {
    const result = parseRequest(text, '/d');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(typeof result.error, 'string');
      assert.notEqual(result.error, '');
    }
  });
}

// A NUL byte makes spawn throw at once. runGate must still resolve.
test('AC-e06s01-04 a command with a NUL byte is not done, no throw', async () => {
  const verdict = await runGate({ command: 'true\u0000x', cwd: repoRoot });
  assert.deepEqual(verdict, { done: false, exitCode: null });
});

test('AC-e06s01-04 a cwd with a NUL byte is not done, no throw', async () => {
  const verdict = await runGate({ command: 'true', cwd: '/tmp\u0000x' });
  assert.deepEqual(verdict, { done: false, exitCode: null });
});
