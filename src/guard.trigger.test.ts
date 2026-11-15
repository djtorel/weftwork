// story: e11s04
// The mechanical ask triggers in the guard: a file write outside the worktree
// and a push to main are blocked; the owner's backlog and the temp folder stay
// writable.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { guardCall, guardPaths, type Worktree } from './guard.ts';
import { cleanupTempDirs, makeTempDir } from './test-helpers.ts';

after(cleanupTempDirs);

function fixture() {
  const root = makeTempDir();
  const outside = makeTempDir();
  const scratch = makeTempDir();
  const common = join(makeTempDir(), 'weftwork');
  const worktree: Worktree = { root, allowed: [scratch, join(common, 'BACKLOG.md')], branch: 'feat/x' };
  const paths = guardPaths(root, join(root, '.git', 'weftwork'), { HOME: makeTempDir() });
  return { root, outside, scratch, common, worktree, paths };
}

const write = (filePath: string, cwd: string) => ({
  hook_event_name: 'PreToolUse',
  cwd,
  tool_name: 'Write',
  tool_input: { file_path: filePath },
});

const bash = (command: string) => ({ hook_event_name: 'PreToolUse', cwd: '/', tool_name: 'Bash', tool_input: { command } });

test('AC-e11s04-05 a file write outside the worktree is blocked', () => {
  const f = fixture();
  for (const tool of ['Edit', 'Write', 'MultiEdit']) {
    const answer = guardCall({ ...write(join(f.outside, 'a.ts'), f.root), tool_name: tool }, f.paths, f.worktree);
    assert.equal(answer.block, true, tool);
    assert.ok(answer.block && answer.reason.includes('outside the worktree'), answer.block ? answer.reason : '');
  }
  assert.equal(guardCall(write('../escape.ts', f.root), f.paths, f.worktree).block, true);
  assert.equal(guardCall(write(join(f.common, 'state.md'), f.root), f.paths, f.worktree).block, true);
});

test('AC-e11s04-06 a write inside the worktree, to the backlog or to the temp folder is allowed', () => {
  const f = fixture();
  assert.equal(guardCall(write('src/a.ts', f.root), f.paths, f.worktree).block, false);
  assert.equal(guardCall(write(join(f.scratch, 'body.md'), f.root), f.paths, f.worktree).block, false);
  assert.equal(guardCall(write(join(f.common, 'BACKLOG.md'), f.root), f.paths, f.worktree).block, false);
});

test('AC-e11s04-07 a symlink in the worktree that points outside it is resolved first', () => {
  const f = fixture();
  mkdirSync(join(f.root, 'docs'));
  symlinkSync(f.outside, join(f.root, 'docs', 'out'));
  assert.equal(guardCall(write('docs/out/x.md', f.root), f.paths, f.worktree).block, true);
});

test('AC-e11s04-08 a push to main is blocked and a push of the feature branch is not', () => {
  const f = fixture();
  const answer = guardCall(bash('git push origin main'), f.paths, f.worktree);
  assert.equal(answer.block, true);
  assert.ok(answer.block && answer.reason.includes('main'), answer.block ? answer.reason : '');
  assert.equal(guardCall(bash('git push -u origin feat/x'), f.paths, f.worktree).block, false);
  assert.equal(guardCall(bash('git push'), f.paths, { ...f.worktree, branch: 'main' }).block, true);
});

test('AC-e11s04-09 without a worktree the triggers are off', () => {
  const f = fixture();
  assert.equal(guardCall(write(join(f.outside, 'a.ts'), f.root), f.paths).block, false);
  assert.equal(guardCall(bash('git push origin main'), f.paths).block, false);
});
