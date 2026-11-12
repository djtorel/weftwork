// story: e06s04
// Every state through the real CLI, and real signals sent to a real child
// process (e06s04 AC-30 to AC-32). Each case starts the real CLI with the
// current Node binary, in a temporary git repository.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { exitCodes, type State } from './states.ts';
import {
  cleanupTempDirs,
  makeTempDir,
  makeTestRepo,
  readRepoLedger,
  readRepoStates,
  waitForFile,
  waitUntilGone,
} from './test-helpers.ts';

after(cleanupTempDirs);

const cliPath = join(import.meta.dirname, 'cli.ts');

function runCli(input: string, cwd: string) {
  const result = spawnSync(process.execPath, [cliPath], { input, cwd, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout };
}

function oneJsonLine(stdout: string): Record<string, unknown> {
  assert.ok(stdout.endsWith('\n'), 'stdout ends with a newline');
  const lines = stdout.split('\n').filter((line) => line !== '');
  assert.equal(lines.length, 1, 'stdout holds exactly one line');
  return JSON.parse(lines[0] as string) as Record<string, unknown>;
}

const cases: ReadonlyArray<{ name: string; state: State; before: string[]; input: string }> = [
  { name: 'done', state: 'done', before: [], input: '{"command":"true"}' },
  { name: 'failed', state: 'failed', before: [], input: '{"command":"exit 7"}' },
  {
    name: 'blocked',
    state: 'blocked',
    before: [],
    input: '{"command":"true","blocked":"no key"}',
  },
  {
    name: 'stalled',
    state: 'stalled',
    before: ['{"command":"exit 7"}', '{"command":"exit 7"}'],
    input: '{"command":"exit 7"}',
  },
  {
    name: 'exhausted',
    state: 'exhausted',
    before: ['{"command":"exit 7","maxFailures":2}'],
    input: '{"command":"exit 7","maxFailures":2}',
  },
];

for (const { name, state, before, input } of cases) {
  test(`AC-e06s04-30 the real CLI answers ${name} with exit ${exitCodes[state]}`, async () => {
    const repo = makeTestRepo();
    for (const earlier of before) {
      runCli(earlier, repo);
    }
    const result = runCli(input, repo);
    assert.equal(result.status, exitCodes[state]);
    const line = oneJsonLine(result.stdout);
    assert.equal(line.state, state);
    assert.equal(line.done, state === 'done');
    const states = await readRepoStates(repo);
    assert.equal(states.at(-1)?.state, state === 'failed' ? undefined : state);
  });
}

test('AC-e06s04-30 exit 2 stays for input the CLI cannot read', () => {
  const result = runCli('not json', makeTestRepo());
  assert.equal(result.status, 2);
  assert.equal(oneJsonLine(result.stdout).done, false);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  test(`AC-e06s04-31 a real ${signal} kills the run`, { timeout: 20000 }, async () => {
    const repo = makeTestRepo();
    const pidFile = join(makeTempDir(), 'pid');
    const child = spawn(process.execPath, [cliPath], { cwd: repo, stdio: ['pipe', 'pipe', 'ignore'] });
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    const closed = new Promise<number | null>((resolve) => child.on('close', resolve));
    child.stdin.end(JSON.stringify({ command: `sleep 60 & echo $! > "${pidFile}"; wait` }));
    assert.ok(await waitForFile(pidFile, 10000), 'the command started');
    child.kill(signal);
    assert.equal(await closed, 6);
    const line = oneJsonLine(stdout);
    assert.equal(line.state, 'killed');
    assert.equal(line.done, false);
    assert.ok(await waitUntilGone(Number(readFileSync(pidFile, 'utf8')), 3000), 'the sleep is gone');
    assert.deepEqual((await readRepoLedger(repo)).entries.map((entry) => entry.reason), ['killed']);
    assert.deepEqual((await readRepoStates(repo)).map((entry) => entry.state), ['killed']);
  });
}
