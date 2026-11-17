// story: dogfood
// This repository's own .claude/settings.json: the Stop hook declares the
// Preflight in AGENTS.md, and both hooks name the engine through
// $CLAUDE_PROJECT_DIR, so they run in every worktree. Each command runs through
// sh as Claude Code runs it, in a temporary project whose src/ is this one.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { cliEnv } from '../claude/hook-cli-test-helpers.ts';
import { cleanupTempDirs, makeTempDir, makeTestRepo } from '../test-support/test-helpers.ts';

after(cleanupTempDirs);

const root = join(import.meta.dirname, '..', '..');
const settings = JSON.parse(readFileSync(join(root, '.claude', 'settings.json'), 'utf8'));
const stopPrefix = `node "$CLAUDE_PROJECT_DIR/src/claude-hook-cli.ts" -- `;
const guardCommand = `node "$CLAUDE_PROJECT_DIR/src/guard-cli.ts"`;

/** The Preflight: the one line of the bash block under `## Preflight`. */
function preflight(): string {
  const text = readFileSync(join(root, 'AGENTS.md'), 'utf8');
  const match = /## Preflight\n\n```bash\n(.+)\n```/.exec(text);
  assert.ok(match?.[1], 'AGENTS.md has a Preflight block');
  return match[1];
}

/** A test repository with this checkout's src/ linked in, as a worktree would have it. */
function project(): string {
  const repo = makeTestRepo();
  symlinkSync(join(root, 'src'), join(repo, 'src'));
  return repo;
}

function run(command: string, repo: string, input: object) {
  const result = spawnSync('sh', ['-c', command], {
    cwd: makeTempDir(),
    env: { ...cliEnv(repo), HOME: makeTempDir() },
    input: JSON.stringify(input),
    encoding: 'utf8',
    timeout: 60000,
  });
  return { status: result.status, stderr: result.stderr };
}

test('the Stop hook declares the Preflight in AGENTS.md, through $CLAUDE_PROJECT_DIR', () => {
  const hooks = settings.hooks.Stop.flatMap((group: { hooks: unknown[] }) => group.hooks);
  assert.deepEqual(hooks, [{ type: 'command', command: `${stopPrefix}'${preflight()}'`, timeout: 660 }]);
});

test('the Stop hook command runs from the project dir: a passing command allows, a failing one blocks', () => {
  const stop = { hook_event_name: 'Stop', stop_hook_active: false };
  const repo = project();
  assert.equal(run(`${stopPrefix}'true'`, repo, { ...stop, cwd: repo }).status, 0);
  const blocked = run(`${stopPrefix}'false'`, repo, { ...stop, cwd: repo });
  assert.equal(blocked.status, 2, blocked.stderr);
});

test('the guard is the last PreToolUse group and blocks a write to weftwork.yaml', () => {
  const group = settings.hooks.PreToolUse.at(-1);
  assert.deepEqual(group, {
    matcher: 'Edit|Write|MultiEdit|NotebookEdit|Bash',
    hooks: [{ type: 'command', command: guardCommand, timeout: 30 }],
  });
  const repo = project();
  const write = { hook_event_name: 'PreToolUse', cwd: repo, tool_name: 'Write' };
  const blocked = run(guardCommand, repo, { ...write, tool_input: { file_path: join(repo, 'weftwork.yaml'), content: 'x' } });
  assert.equal(blocked.status, 2, blocked.stderr);
  assert.equal(run(guardCommand, repo, { ...write, tool_input: { file_path: join(repo, 'a.txt'), content: 'x' } }).status, 0);
});
