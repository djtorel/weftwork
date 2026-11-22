// story: e15s01
// The history file and its inputs (docs/HISTORY.md). The file is
// `<common git dir>/weftwork/history.jsonl`, next to the clone's backlog: a
// linked worktree's own git dir goes when the worktree is removed, the
// common one stays. One JSON line per filing, written like a ledger line
// (ledger.ts writeLine: 0600, one write); the reader keeps the last 1 MiB.
import { constants } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import { join } from 'node:path';
import type { Failure } from '../shared/errors.ts';
import { isMissing, messageOf } from '../shared/errors.ts';
import { commonDir } from '../guard/guard-worktree.ts';
import { improvementsFile, parseImprovements, type ImprovementsResult } from './history-improve.ts';
import { parseHistory, summarize, toDesignRound, type TaskRecord } from './history.ts';
import { branchRounds, designRoot } from '../design/design-store.ts';
import { ledgerPath, ledgerReadCap, openRegular, readLedgerTail, tailText, writeLine } from '../engine/ledger.ts';
import { readRegularFile } from '../shared/regular-file.ts';
import { currentBranch, gitOutput, repositoryRoot } from '../engine/tree.ts';

export type HistoryRead = { ok: true; records: TaskRecord[]; skipped: number } | Failure;

/** `<common git dir>/weftwork/history.jsonl` for the clone that holds `cwd`. */
export async function historyPath(cwd: string): Promise<string | null> {
  const common = await commonDir(cwd);
  return common === null ? null : join(common, 'weftwork', 'history.jsonl');
}

/** Every record in the last 1 MiB of the file; a missing file has none. */
export async function readHistory(path: string): Promise<HistoryRead> {
  let handle: FileHandle | undefined;
  try {
    handle = await openRegular(path, constants.O_RDONLY);
    const { text } = await tailText(handle, ledgerReadCap);
    return { ok: true, ...parseHistory(text) };
  } catch (error) {
    return isMissing(error) ? { ok: true, records: [], skipped: 0 } : { ok: false, error: messageOf(error) };
  } finally {
    await handle?.close();
  }
}

/** When `branch` began in this clone: its oldest reflog entry, or null when
 * git keeps no reflog for it (the record then counts the whole ledger). */
export async function branchStart(cwd: string, branch: string): Promise<string | null> {
  try {
    const out = await gitOutput(cwd, ['reflog', 'show', '--date=unix', '--format=%gd', `refs/heads/${branch}`, '--']);
    const lines = out.toString('utf8').trim().split('\n');
    const seconds = /@\{(\d+)\}$/.exec(lines.at(-1) ?? '')?.[1];
    return seconds === undefined ? null : new Date(Number(seconds) * 1000).toISOString();
  } catch {
    return null;
  }
}

async function headCommit(cwd: string): Promise<string | null> {
  try {
    return (await gitOutput(cwd, ['rev-parse', '--verify', '--quiet', 'HEAD'])).toString('utf8').trim() || null;
  } catch {
    return null;
  }
}

export type RecordResult = { ok: true; record: TaskRecord; path: string } | Failure;

/** Count the current branch's task from this worktree's ledger and the
 * branch's design loops, and append its record. `model` is the agent's claim (docs/HISTORY.md). */
export async function recordTask(cwd: string, model: string | null, now: Date): Promise<RecordResult> {
  const branch = await currentBranch(cwd);
  if (!branch.ok) return branch;
  if (branch.branch === null) return { ok: false, error: 'no branch: HEAD is detached, so there is no task to record' };
  const ledger = await ledgerPath(cwd);
  const path = await historyPath(cwd);
  if (ledger === null || path === null) return { ok: false, error: 'no git dir for the ledger' };
  const read = await readLedgerTail(ledger, ledgerReadCap);
  if (!read.ok) return { ok: false, error: `the ledger cannot be read: ${read.error}` };
  const root = await designRoot(cwd);
  const design = root === null ? [] : branchRounds(root, branch.branch).flatMap((round) => toDesignRound(round) ?? []);
  const record = summarize({
    at: now.toISOString(),
    branch: branch.branch,
    head: await headCommit(cwd),
    model,
    since: await branchStart(cwd, branch.branch),
    entries: read.entries,
    states: read.states,
    reviews: read.reviews,
    guards: read.guards,
    design,
  });
  const written = await writeLine(path, record);
  return written.ok ? { ok: true, record, path } : { ok: false, error: `the history cannot be written: ${written.error}` };
}

/** The register at the repository root, read like a setting file (a regular
 * file of at most 64 KiB, not a symlink); none is an empty register. */
export async function readImprovements(cwd: string): Promise<ImprovementsResult> {
  let root: string;
  try {
    root = (await repositoryRoot(cwd)).toString('utf8');
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
  const read = readRegularFile(join(root, improvementsFile), { follow: false, maxBytes: 64 * 1024 });
  if (!read.ok) return read;
  if (read.file === null) return { ok: true, improvements: [] };
  const parsed = parseImprovements(read.file.text);
  return parsed.ok ? parsed : { ok: false, error: `${improvementsFile}: ${parsed.error}` };
}
