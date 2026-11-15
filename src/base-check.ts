// story: e13s04
// The base check (docs/BASE-CHECK.md, R19): each test file the change adds or
// edits is run against the base commit, in a temporary git worktree, where
// it should fail. A test that passes on the base does not show the change:
// LLM-written tests often encode the old behaviour (R19 S10). It reports and
// never gates. The worktree is made with git hooks off and removed after.
import { lstat, mkdir, mkdtemp, copyFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, matchesGlob } from 'node:path';
import { terminalSafe } from './cli-io.ts';
import { messageOf, type Failure } from './errors.ts';
import { runCommand } from './process.ts';
import type { ProofSetting } from './base-check-setting.ts';
import { gitOutput, repositoryRoot } from './tree.ts';
import { changedPaths } from './ui.ts';

export type FileOutcome = { file: string; outcome: 'fails' | 'passes' | 'timed-out' | 'not-started' };
export type BaseRun = { kind: 'ran'; files: FileOutcome[] };
export type BaseCheck = { kind: 'none' } | BaseRun | Failure;

/** A shell word that holds `text` as it is. */
function quote(text: string): string {
  return `'${text.replaceAll("'", "'\\''")}'`;
}

/** The test files the change adds or edits: changed from the base, still
 * in the working tree, and matching a proof.tests pattern. */
async function changedTests(root: string, base: string, tests: string[]): Promise<{ ok: true; files: string[] } | Failure> {
  const changed = await changedPaths(root, base);
  if (!changed.ok) return changed;
  const files: string[] = [];
  for (const path of changed.paths) {
    if (!tests.some((pattern) => matchesGlob(path, pattern))) continue;
    if ((await lstat(join(root, path)).catch(() => null))?.isFile() === true) files.push(path);
  }
  return { ok: true, files: files.sort() };
}

/** Run `files` on the base: one run of proof.run per file, so each file has
 * its own outcome. */
export async function checkOnBase(input: { cwd: string; proof: ProofSetting; base: string }): Promise<BaseCheck> {
  let root: string;
  try {
    root = (await repositoryRoot(input.cwd)).toString('utf8');
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
  const tests = await changedTests(root, input.base, input.proof.tests);
  if (!tests.ok) return tests;
  if (tests.files.length === 0) return { kind: 'none' };
  const dir = await mkdtemp(join(tmpdir(), 'weftwork-base-'));
  const tree = join(dir, 'tree');
  try {
    // core.hooksPath=/dev/null: a post-checkout hook must not run here.
    await gitOutput(root, ['-c', 'core.hooksPath=/dev/null', 'worktree', 'add', '--quiet', '--detach', tree, input.base]);
    for (const path of input.proof.share) {
      const from = join(root, path);
      if ((await lstat(from).catch(() => null)) === null || (await lstat(join(tree, path)).catch(() => null)) !== null) continue;
      await mkdir(dirname(join(tree, path)), { recursive: true });
      await symlink(from, join(tree, path));
    }
    for (const file of tests.files) {
      await mkdir(dirname(join(tree, file)), { recursive: true });
      await copyFile(join(root, file), join(tree, file));
    }
    const files: FileOutcome[] = [];
    for (const file of tests.files) {
      const out = await runCommand(`set -- ${quote(file)}\n${input.proof.run}`, tree, input.proof.timeoutSeconds * 1000);
      const outcome = out.reason === 'passed' ? 'passes' : out.reason === 'timeout' ? 'timed-out' : out.reason === 'not-started' ? 'not-started' : 'fails';
      files.push({ file, outcome });
    }
    return { kind: 'ran', files };
  } catch (error) {
    return { ok: false, error: `the base worktree failed: ${messageOf(error)}` };
  } finally {
    await gitOutput(root, ['worktree', 'remove', '--force', tree]).catch(() => undefined);
    // No `worktree prune`: it acts on every worktree of the clone.
    await rm(dir, { recursive: true, force: true });
  }
}

/** Plain lines for the PR's Proof block. */
export function baseCheckReport(base: string, check: BaseRun, timeoutSeconds: number): string {
  const failing = check.files.filter((file) => file.outcome === 'fails').length;
  const lines = [`weftwork base check: ${failing} of ${check.files.length} changed test files fail on the base`, `base: ${base}`];
  for (const { file: path, outcome } of check.files) {
    // A file name can hold a control character; it cannot add a line.
    const file = terminalSafe(path);
    if (outcome === 'fails') lines.push(`fails on base: ${file}`);
    else if (outcome === 'passes') lines.push(`passes on base: ${file} (it does not show the change)`);
    else if (outcome === 'timed-out') lines.push(`timed out on base: ${file} (after ${timeoutSeconds} s)`);
    else lines.push(`did not start on base: ${file}`);
  }
  return `${lines.join('\n')}\n`;
}
