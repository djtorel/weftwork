// story: e06s01
// Tests for the CLI at the process boundary (e06s01, AC-06 to AC-08).
// Each case starts the real CLI with the current Node binary.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cliPath = join(import.meta.dirname, 'cli.ts');
const tempDirs: string[] = [];

after(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function runCli(input: string) {
  const result = spawnSync(process.execPath, [cliPath], {
    input,
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function oneJsonLine(stdout: string): Record<string, unknown> {
  assert.ok(stdout.endsWith('\n'), 'stdout ends with a newline');
  const lines = stdout.split('\n').filter((line) => line !== '');
  assert.equal(lines.length, 1, 'stdout holds exactly one line');
  return JSON.parse(lines[0] as string) as Record<string, unknown>;
}

const cases: ReadonlyArray<{ stdin: string; exit: number; done: boolean }> = [
  { stdin: '{"command":"true"}', exit: 0, done: true },
  { stdin: '{"command":"false"}', exit: 1, done: false },
  { stdin: '{"command":"exit 7"}', exit: 1, done: false },
  { stdin: 'not json', exit: 2, done: false },
  { stdin: '{}', exit: 2, done: false },
  { stdin: ' '.repeat(1024 * 1024 + 1), exit: 2, done: false },
];

for (const { stdin, exit, done } of cases) {
  const label = stdin.length > 40 ? `${stdin.length} bytes of input` : stdin;
  test(`AC-e06s01-06 the CLI reads ${label}`, () => {
    const result = runCli(stdin);
    assert.equal(result.status, exit);
    assert.equal(oneJsonLine(result.stdout).done, done);
  });
}

test('AC-e06s01-06 the CLI reports the exit code of a failed command', () => {
  const line = oneJsonLine(runCli('{"command":"exit 7"}').stdout);
  assert.deepEqual(line, { done: false, exitCode: 7 });
});

test('AC-e06s01-06 the CLI gives an error text for unreadable input', () => {
  const line = oneJsonLine(runCli('not json').stdout);
  assert.equal(typeof line.error, 'string');
});

test('AC-e06s01-07 command output never reaches stdout', () => {
  const result = runCli('{"command":"echo noise"}');
  oneJsonLine(result.stdout);
  assert.ok(!result.stdout.includes('noise'));
  assert.ok(result.stderr.includes('noise'));
});

test('AC-e06s01-08 the CLI honours cwd', () => {
  const dir = mkdtempSync(join(tmpdir(), 'weftwork-cli-'));
  tempDirs.push(dir);
  writeFileSync(join(dir, 'marker'), '');
  const result = runCli(JSON.stringify({ command: 'test -f marker', cwd: dir }));
  assert.equal(result.status, 0);
  assert.equal(oneJsonLine(result.stdout).done, true);
});

test('AC-e06s01-06 the CLI answers one JSON line for a NUL byte', () => {
  for (const input of [
    JSON.stringify({ command: 'true\u0000x' }),
    JSON.stringify({ command: 'true', cwd: '/tmp\u0000x' }),
  ]) {
    const result = runCli(input);
    assert.equal(result.status, 1);
    assert.deepEqual(oneJsonLine(result.stdout), { done: false, exitCode: null });
  }
});
