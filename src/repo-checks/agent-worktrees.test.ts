// Claude Code puts an agent's worktree in .claude/worktrees/ of the checkout
// it started in. That copy of the repository must not change this one's
// Preflight or its tree: yamllint skips it, as it skips
// src/test-support/fixtures/ at the root only, and git ignores it, so it is
// not in git status or the engine's fingerprint. Found when a leftover agent worktree failed Preflight in the
// main checkout (2026-11-16).
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempDirs, makeTestRepo } from '../test-support/test-helpers.ts';

after(cleanupTempDirs);

const root = join(import.meta.dirname, '..', '..');

/** A repository with this one's lint and ignore settings, a good YAML file,
 * and an agent worktree that holds a fixture yamllint would refuse. */
function repoWithAgentWorktree(): string {
  const dir = makeTestRepo({ 'good.yaml': '---\na: 1\n' });
  copyFileSync(join(root, '.yamllint'), join(dir, '.yamllint'));
  copyFileSync(join(root, '.gitignore'), join(dir, '.gitignore'));
  // Not committed, as an agent's worktree is not: git ignores no tracked file.
  const fixtures = join(dir, '.claude', 'worktrees', 'agent-1', 'src', 'test-support', 'fixtures');
  mkdirSync(fixtures, { recursive: true });
  writeFileSync(join(fixtures, 'state.yaml'), 'no_document_start: true\n');
  return dir;
}

test('yamllint . skips an agent worktree in .claude/worktrees/', () => {
  const out = spawnSync('yamllint', ['.'], { cwd: repoWithAgentWorktree(), encoding: 'utf8' });
  assert.equal(out.error, undefined, 'yamllint must be installed: bash tools/setup.sh');
  assert.equal(out.status, 0, out.stdout);
});

test('git ignores an agent worktree in .claude/worktrees/, so it is not in the tree', () => {
  const dir = repoWithAgentWorktree();
  const ignored = spawnSync('git', ['check-ignore', '-q', '.claude/worktrees/agent-1/src/test-support/fixtures/state.yaml'], { cwd: dir });
  assert.equal(ignored.status, 0, 'git check-ignore exits 0 for an ignored path');
  const status = spawnSync('git', ['status', '--short', '--untracked-files=all'], { cwd: dir, encoding: 'utf8' });
  assert.doesNotMatch(status.stdout, /worktrees/);
});
