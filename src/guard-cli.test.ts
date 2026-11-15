// story: e11s01
// The PreToolUse hook as a real process: exit 2 with the reason on stderr
// blocks the tool call, exit 0 lets it go, every block is a ledger line, and
// every fault of the hook blocks.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cliEnv } from './hook-cli-test-helpers.ts';
import { ledgerPath, readLedger } from './ledger.ts';
import { cleanupTempDirs, makeTempDir, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const guardCli = join(import.meta.dirname, 'guard-cli.ts');

function runGuard(input: string, project: string | null) {
  const result = spawnSync(process.execPath, [guardCli], {
    cwd: makeTempDir(),
    env: { ...cliEnv(project), HOME: makeTempDir() },
    input,
    encoding: 'utf8',
    timeout: 20000,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function toolInput(repo: string, tool: string, input: object): string {
  return JSON.stringify({ hook_event_name: 'PreToolUse', cwd: repo, tool_name: tool, tool_input: input });
}

async function ledgerLines(repo: string): Promise<unknown[]> {
  const path = (await ledgerPath(repo)) as string;
  try {
    return readFileSync(path, 'utf8').split('\n').filter((line) => line !== '').map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

test('AC-e11s01-08 a Write to weftwork.yaml exits 2 with the reason and logs one ledger line', async () => {
  const repo = makeTestRepo();
  const target = join(repo, 'weftwork.yaml');
  const run = runGuard(toolInput(repo, 'Write', { file_path: target, content: 'x' }), repo);
  assert.equal(run.status, 2, run.stderr);
  assert.match(run.stderr, /^weftwork: /);
  assert.ok(run.stderr.includes(target), run.stderr);
  const lines = await ledgerLines(repo);
  assert.equal(lines.length, 1);
  assert.deepEqual({ ...(lines[0] as object), at: 'x' }, { at: 'x', guard: 'blocked', tool: 'Write', target });
  const read = await readLedger((await ledgerPath(repo)) as string);
  assert.deepEqual(read, { ok: true, entries: [], skipped: 0 }, 'a guard line is not a skipped line');
});

test('AC-e11s01-09 an allowed call exits 0 with no output and logs nothing', async () => {
  const repo = makeTestRepo();
  const run = runGuard(toolInput(repo, 'Bash', { command: 'npm test' }), repo);
  assert.deepEqual(run, { status: 0, stdout: '', stderr: '' });
  assert.deepEqual(await ledgerLines(repo), []);
});

test('AC-e11s01-10 a fault blocks: no project dir, input that is not JSON', () => {
  const repo = makeTestRepo();
  const noProject = runGuard(toolInput(repo, 'Bash', { command: 'npm test' }), null);
  assert.equal(noProject.status, 2);
  assert.match(noProject.stderr, /CLAUDE_PROJECT_DIR/);
  const notJson = runGuard('{', repo);
  assert.equal(notJson.status, 2);
  assert.match(notJson.stderr, /not JSON/);
});
