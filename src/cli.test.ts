// story: e06s01
// Tests for the CLI at the process boundary (e06s01 AC-06 to AC-08, e06s02
// AC-12). Each case starts the real CLI with the current Node binary, in a
// temporary git repository.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { cleanupTempDirs, makeTempDir, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const cliPath = join(import.meta.dirname, 'cli.ts');
const repo = makeTestRepo();

function runCli(input: string, cwd: string = repo) {
  const result = spawnSync(process.execPath, [cliPath], { input, cwd, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function oneJsonLine(stdout: string): Record<string, unknown> {
  assert.ok(stdout.endsWith('\n'), 'stdout ends with a newline');
  const lines = stdout.split('\n').filter((line) => line !== '');
  assert.equal(lines.length, 1, 'stdout holds exactly one line');
  return JSON.parse(lines[0] as string) as Record<string, unknown>;
}

const verdictCases: ReadonlyArray<{
  name: string;
  request: Record<string, unknown>;
  exit: number;
  reason: string;
  exitCode: number | null;
}> = [
  { name: 'true', request: { command: 'true' }, exit: 0, reason: 'passed', exitCode: 0 },
  { name: 'exit 7', request: { command: 'exit 7' }, exit: 1, reason: 'exit-nonzero', exitCode: 7 },
  {
    name: 'sleep 30 with timeoutMs 300',
    request: { command: 'sleep 30', timeoutMs: 300 },
    exit: 1,
    reason: 'timeout',
    exitCode: null,
  },
  {
    name: 'a directory with no repository',
    request: { command: 'true', cwd: makeTempDir() },
    exit: 1,
    reason: 'no-tree',
    exitCode: null,
  },
  {
    name: 'a NUL byte in the command',
    request: { command: 'true\u0000x' },
    exit: 1,
    reason: 'not-started',
    exitCode: null,
  },
  {
    name: 'a NUL byte in the cwd',
    request: { command: 'true', cwd: '/tmp\u0000x' },
    exit: 1,
    reason: 'no-tree',
    exitCode: null,
  },
];

for (const { name, request, exit, reason, exitCode } of verdictCases) {
  test(`AC-e06s02-12 the CLI answers ${name} with reason ${reason}`, { timeout: 10000 }, () => {
    const result = runCli(JSON.stringify(request));
    assert.equal(result.status, exit);
    const line = oneJsonLine(result.stdout);
    assert.equal(line.done, reason === 'passed');
    assert.equal(line.exitCode, exitCode);
    assert.equal(line.reason, reason);
    assert.equal(line.command, request.command);
    assert.ok('fingerprint' in line, 'the line holds a fingerprint');
  });
}

const unreadableCases: ReadonlyArray<string> = [
  'not json',
  '{}',
  '{"command":"true","timeoutMs":0}',
  ' '.repeat(1024 * 1024 + 1),
];

for (const stdin of unreadableCases) {
  const label = stdin.length > 40 ? `${stdin.length} bytes of input` : stdin;
  test(`AC-e06s01-06 the CLI answers exit 2 for ${label}`, () => {
    const result = runCli(stdin);
    assert.equal(result.status, 2);
    const line = oneJsonLine(result.stdout);
    assert.equal(line.done, false);
    assert.equal(typeof line.error, 'string');
  });
}

// The verdict carries the command text, so the command must not spell its
// own output: the shell joins no''ise into noise.
test('AC-e06s01-07 command output never reaches stdout', () => {
  const result = runCli(JSON.stringify({ command: "echo no''ise" }));
  oneJsonLine(result.stdout);
  assert.ok(!result.stdout.includes('noise'));
  assert.ok(result.stderr.includes('noise'));
});

test('AC-e06s01-08 the CLI honours cwd', () => {
  const dir = makeTestRepo({ 'tracked.txt': 'one\n', marker: '' });
  const result = runCli(JSON.stringify({ command: 'test -f marker', cwd: dir }));
  assert.equal(result.status, 0);
  assert.equal(oneJsonLine(result.stdout).done, true);
});
