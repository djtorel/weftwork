// story: e06s01
// Tests for the evidence gate library (e06s01 AC-01 to AC-05, e06s02 AC-06
// to AC-11). Every command runs in a temporary git repository, never in
// the real one. Only shell built-ins are used, except the two timeout
// cases, which start "sleep 30" and are ended by timeoutMs.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Verdict } from './gate.ts';
import { defaultTimeoutMs, parseRequest, runGate } from './gate.ts';
import { fingerprintTree } from './tree.ts';
import { cleanupTempDirs, makeTempDir, makeTestRepo, waitUntilGone } from './test-helpers.ts';

after(cleanupTempDirs);

const hex64 = /^[0-9a-f]{64}$/;

type Expected = { done: boolean; exitCode: number | null; reason: string; command: string };

function assertVerdict(verdict: Verdict, expected: Expected): void {
  assert.equal(verdict.done, expected.done);
  assert.equal(verdict.exitCode, expected.exitCode);
  assert.equal(verdict.reason, expected.reason);
  assert.equal(verdict.command, expected.command);
}

test('AC-e06s01-01 exit code 0 is done', async () => {
  const verdict = await runGate({ command: 'true', cwd: makeTestRepo() });
  assertVerdict(verdict, { done: true, exitCode: 0, reason: 'passed', command: 'true' });
});

const notDoneCases: ReadonlyArray<{ command: string; code: number }> = [
  { command: 'false', code: 1 },
  { command: 'exit 3', code: 3 },
  { command: 'no-such-command-xyz', code: 127 },
  { command: 'true && false', code: 1 },
];

for (const { command, code } of notDoneCases) {
  test(`AC-e06s01-02 "${command}" is not done, exit code ${code}`, async () => {
    const verdict = await runGate({ command, cwd: makeTestRepo() });
    assertVerdict(verdict, { done: false, exitCode: code, reason: 'exit-nonzero', command });
    assert.match(verdict.fingerprint ?? '', hex64);
  });
}

test('AC-e06s01-03 the command runs in the given directory', async () => {
  const withMarker = makeTestRepo({ 'tracked.txt': 'one\n', marker: '' });
  const withoutMarker = makeTestRepo();
  const found = await runGate({ command: 'test -f marker', cwd: withMarker });
  assert.equal(found.done, true);
  const missing = await runGate({ command: 'test -f marker', cwd: withoutMarker });
  assert.equal(missing.done, false);
});

test('AC-e06s01-04 a command killed by a signal is signal, no throw', async () => {
  const command = 'kill -TERM $$';
  const verdict = await runGate({ command, cwd: makeTestRepo() });
  assertVerdict(verdict, { done: false, exitCode: null, reason: 'signal', command });
});

test('AC-e06s01-04 a command with a NUL byte is not-started, no throw', async () => {
  const command = 'true\u0000x';
  const verdict = await runGate({ command, cwd: makeTestRepo() });
  assertVerdict(verdict, { done: false, exitCode: null, reason: 'not-started', command });
  assert.match(verdict.fingerprint ?? '', hex64);
});

// AC-e06s02-06: the reasons that need a closer look.
test('AC-e06s02-06 a passing command carries the fingerprint taken before it', async () => {
  const dir = makeTestRepo();
  const before = await fingerprintTree(dir);
  assert.ok(before.ok);
  const verdict = await runGate({ command: 'true', cwd: dir });
  assert.equal(verdict.fingerprint, before.fingerprint);
});

test('AC-e06s02-06 sleep past timeoutMs is timeout', { timeout: 10000 }, async () => {
  const command = 'sleep 30';
  const started = Date.now();
  const verdict = await runGate({ command, cwd: makeTestRepo(), timeoutMs: 300 });
  assertVerdict(verdict, { done: false, exitCode: null, reason: 'timeout', command });
  assert.ok(Date.now() - started < 5000, 'the gate returned well before sleep ended');
});

test('AC-e06s02-06 a command that edits the tracked file is tree-changed', async () => {
  const dir = makeTestRepo();
  const before = await fingerprintTree(dir);
  assert.ok(before.ok);
  const command = 'echo more >> tracked.txt';
  const verdict = await runGate({ command, cwd: dir });
  assertVerdict(verdict, { done: false, exitCode: 0, reason: 'tree-changed', command });
  assert.equal(verdict.fingerprint, before.fingerprint);
});

test('AC-e06s02-06 a command that writes an ignored file is passed', async () => {
  const dir = makeTestRepo({ 'tracked.txt': 'one\n', '.gitignore': 'out/\n' });
  const command = 'mkdir -p out && echo x > out/a.txt';
  const verdict = await runGate({ command, cwd: dir });
  assertVerdict(verdict, { done: true, exitCode: 0, reason: 'passed', command });
});

const noTreePlaces: ReadonlyArray<{ name: string; cwd: () => string }> = [
  { name: 'that is not in a git repository', cwd: () => makeTempDir() },
  { name: 'that does not exist', cwd: () => join(makeTempDir(), 'does-not-exist') },
  { name: 'whose path holds a NUL byte', cwd: () => '/tmp\u0000x' },
];

for (const { name, cwd } of noTreePlaces) {
  test(`AC-e06s02-07 a directory ${name} is no-tree and the command does not run`, async () => {
    const dir = cwd();
    const command = 'touch ran';
    const verdict = await runGate({ command, cwd: dir });
    assertVerdict(verdict, { done: false, exitCode: null, reason: 'no-tree', command });
    assert.equal(verdict.fingerprint, null);
    assert.equal(existsSync(join(dir, 'ran')), false);
  });
}

test('AC-e06s02-08 a timeout ends the whole process group', { timeout: 10000 }, async () => {
  const pidFile = join(makeTempDir(), 'pid');
  // 1000 ms leaves the shell time to write the pid file on a slow runner.
  const command = `sleep 30 & echo $! > "${pidFile}"; wait`;
  const verdict = await runGate({ command, cwd: makeTestRepo(), timeoutMs: 1000 });
  assert.equal(verdict.reason, 'timeout');
  const pid = Number(readFileSync(pidFile, 'utf8'));
  assert.ok(await waitUntilGone(pid, 2000), 'the background process is gone');
});

test('AC-e06s02-09 a leftover background process is ended after exit', { timeout: 10000 }, async () => {
  const pidFile = join(makeTempDir(), 'pid');
  const command = `sleep 30 & echo $! > "${pidFile}"`;
  const verdict = await runGate({ command, cwd: makeTestRepo() });
  assert.equal(verdict.reason, 'passed');
  const pid = Number(readFileSync(pidFile, 'utf8'));
  assert.ok(await waitUntilGone(pid, 2000), 'the background process is gone');
});

// AC-e06s01-05 and AC-e06s02-10: parseRequest accepts and rejects input.
const okCases: ReadonlyArray<{ text: string; request: Record<string, unknown> }> = [
  { text: '{"command":"true"}', request: { command: 'true', cwd: '/d' } },
  { text: '{"command":"true","cwd":"/x"}', request: { command: 'true', cwd: '/x' } },
  { text: '{"command":"true","extra":1}', request: { command: 'true', cwd: '/d' } },
  { text: '{"command":"true","timeoutMs":1}', request: { command: 'true', cwd: '/d', timeoutMs: 1 } },
  {
    text: '{"command":"true","timeoutMs":2147483647}',
    request: { command: 'true', cwd: '/d', timeoutMs: 2147483647 },
  },
];

for (const { text, request } of okCases) {
  test(`AC-e06s01-05 parseRequest accepts ${text}`, () => {
    assert.deepEqual(parseRequest(text, '/d'), { ok: true, request });
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
  '{"command":"true","timeoutMs":0}',
  '{"command":"true","timeoutMs":-1}',
  '{"command":"true","timeoutMs":1.5}',
  '{"command":"true","timeoutMs":"5"}',
  '{"command":"true","timeoutMs":2147483648}',
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

test('AC-e06s02-11 the default timeout is 10 minutes and is not set by parseRequest', () => {
  assert.equal(defaultTimeoutMs, 600000);
  const result = parseRequest('{"command":"true"}', '/d');
  assert.ok(result.ok);
  assert.equal('timeoutMs' in result.request, false);
});
