// story: e13s02
// What a review round is of (docs/REVIEW.md, R19). The engine snapshots the
// working tree as a git tree, so a later round can name the files that
// changed since the last one; measures the change from the base, so the
// report shows how much review grew it; finds the changed files that make a
// change sensitive; and checks that a must-fix names a file and line that
// exist, since a finding the reviewer cannot point at does not block.
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile, realpath, rm, stat } from 'node:fs/promises';
import { isAbsolute, join, matchesGlob, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { messageOf, type Failure } from './errors.ts';
import { strictUtf8 } from './regular-file.ts';
import type { ReviewEntry } from './review-ledger.ts';
import type { ReviewerResult } from './review.ts';
import { gitOutput, repositoryRoot } from './tree.ts';
import { baseCommit } from './ui.ts';

/** The working tree as a git tree object: tracked and untracked files that
 * are not ignored, as they are on disk. It uses its own index file in
 * `scratch`, so the repository's index and files are not touched; git
 * writes the blobs to the object store. */
export async function snapshotTree(cwd: string, scratch: string): Promise<{ ok: true; tree: string } | Failure> {
  const index = join(scratch, `review-index-${process.pid}-${randomBytes(4).toString('hex')}`);
  try {
    const root = (await repositoryRoot(cwd)).toString('utf8');
    const env = { ...process.env, GIT_INDEX_FILE: index };
    await gitIn(root, ['add', '--all', '--', ':(top)'], env);
    return { ok: true, tree: (await gitIn(root, ['write-tree'], env)).trim() };
  } catch (error) {
    return { ok: false, error: `the tree could not be snapshotted: ${messageOf(error)}` };
  } finally {
    await rm(index, { force: true });
  }
}

const run = promisify(execFile);

/** Run git in `cwd` with `env` (gitOutput takes no environment). */
async function gitIn(cwd: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return (await run('git', ['-c', 'core.fsmonitor=false', ...args], { cwd, env, maxBuffer: 64 * 1024 * 1024 })).stdout;
}

/** The paths that differ between two commits or trees. */
export async function changedBetween(cwd: string, from: string, to: string): Promise<{ ok: true; paths: string[] } | Failure> {
  try {
    const text = strictUtf8(await gitOutput(cwd, ['diff', '--name-only', '-z', '--no-renames', from, to, '--']));
    if (text === null) return { ok: false, error: 'a changed path is not UTF-8' };
    return { ok: true, paths: text.split('\0').filter((path) => path !== '') };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
}

/** The lines added and deleted between two commits or trees; a binary file
 * counts none. */
export async function diffLines(cwd: string, from: string, to: string): Promise<{ ok: true; lines: number } | Failure> {
  try {
    const records = (await gitOutput(cwd, ['diff', '--numstat', '-z', '--no-renames', from, to, '--'])).toString('latin1').split('\0');
    let lines = 0;
    for (const record of records) {
      const [added, deleted] = record.split('\t');
      lines += (Number(added) || 0) + (Number(deleted) || 0);
    }
    return { ok: true, lines };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
}

/** The paths that match a review.sensitive_paths pattern. */
export function sensitiveFiles(paths: string[], patterns: string[]): string[] {
  return paths.filter((path) => patterns.some((pattern) => matchesGlob(path, pattern)));
}

const anchor = /^(?:\([^)]*\):\s*)?`?([^\s`:]+):(\d+)(?:[-:,]\d+)?`?(?=[\s.,;:]|$)/;

/** The file and line a finding starts with, after the `(<reviewer>): `
 * prefix the ledger stores, or null when it names none. */
export function anchorOf(finding: string): { file: string; line: number } | null {
  const match = anchor.exec(finding.trim());
  return match === null ? null : { file: match[1] ?? '', line: Number(match[2]) };
}

/** Why a finding is not grounded in the repository at `root`, or null when
 * its file is a file in the repository with at least that many lines. */
async function notGrounded(root: string, finding: string): Promise<string | null> {
  const at = anchorOf(finding);
  if (at === null) return 'no <file>:<line>';
  const path = resolve(root, at.file);
  if (isOutside(root, path)) return `${at.file} is outside the repository`;
  let real: string;
  try {
    real = await realpath(path);
    if (!(await stat(real)).isFile()) return `${at.file} is not a file in the repository`;
  } catch {
    return `${at.file} is not a file in the repository`;
  }
  if (isOutside(await realpath(root), real)) return `${at.file} is outside the repository`;
  const text = await readFile(real, 'utf8').catch(() => null);
  if (text === null) return `${at.file} cannot be read`;
  const lines = text === '' ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  if (at.line < 1 || at.line > lines) return `line ${at.line} is past the end of ${at.file}, ${lines} ${lines === 1 ? 'line' : 'lines'}`;
  return null;
}

function isOutside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);
}

/** The results with each must-fix that is not grounded moved to the
 * should-fix findings, with the reason after it (R19: a finding needs a file
 * and line as evidence). */
export async function groundResults(root: string, results: ReviewerResult[]): Promise<ReviewerResult[]> {
  return Promise.all(
    results.map(async (result) => {
      if (!result.ok) return result;
      const mustFix: string[] = [];
      const shouldFix = [...result.shouldFix];
      for (const finding of result.mustFix) {
        const why = await notGrounded(root, finding);
        if (why === null) mustFix.push(finding);
        else shouldFix.push(`${finding} [not grounded: ${why}]`);
      }
      return { ...result, mustFix, shouldFix };
    }),
  );
}

/** What one round is of: the repository root, the tree it reviews, the
 * lines changed from the base and the first changed file that makes the
 * change sensitive (both null when there is no base and nothing needs one),
 * and the files changed since the last round (null in round 1, or when the
 * last round's tree is not known). */
export type RoundScope = { root: string; tree: string; diffLines: number | null; sensitiveBy: string | null; changedSinceLast: string[] | null };

export async function roundScope(input: { cwd: string; scratch: string; base: string | undefined; sensitivePaths: string[]; last: ReviewEntry | undefined }): Promise<{ ok: true; scope: RoundScope } | Failure> {
  const snapshot = await snapshotTree(input.cwd, input.scratch);
  if (!snapshot.ok) return snapshot;
  const root = (await repositoryRoot(input.cwd)).toString('utf8');
  const scope: RoundScope = { root, tree: snapshot.tree, diffLines: null, sensitiveBy: null, changedSinceLast: null };
  if (input.last?.tree !== undefined) {
    const since = await changedBetween(input.cwd, input.last.tree, snapshot.tree);
    if (since.ok) scope.changedSinceLast = since.paths;
  }
  const base = await baseCommit(input.cwd, input.base);
  if (!base.ok) {
    // A review without a base still runs, unless something needs the base.
    if (input.base !== undefined || input.sensitivePaths.length > 0) return base;
    return { ok: true, scope };
  }
  const changed = await changedBetween(input.cwd, base.sha, snapshot.tree);
  if (!changed.ok) return changed;
  scope.sensitiveBy = sensitiveFiles(changed.paths, input.sensitivePaths)[0] ?? null;
  const size = await diffLines(input.cwd, base.sha, snapshot.tree);
  if (!size.ok) return size;
  scope.diffLines = size.lines;
  return { ok: true, scope };
}
