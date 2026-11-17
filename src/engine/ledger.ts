// story: e06s03, e07s02, e07s04, e11s01, e11s03
// e07s02 (BUG-007): the ledger opens without blocking and only as a regular file.
// e11s01 adds guard lines, one per blocked tool call; e11s03 review lines,
// one per review round (review-ledger.ts).
// e06s04 adds state lines (one per terminal state), the capped tail reader
// the stop rules use (security review F3) and failingRun.
// ledger-file.ts holds the file half: the regular-file open, the line
// writer and the tail reader.
// The counts ledger: a plain file, one JSON object per line, that only the
// engine writes. It lives in the git dir, which git never lists, so a write
// never changes the tree fingerprint. It is a log for counts and the
// breaker. The gate never takes `done` from it (threat model C4).
//
// The agent can edit this file, so it is not tamper proof (T3). It stores
// each command string, so a secret in a declared command is stored on disk
// (T8). Git runs by argument array and never through a shell (C5); each
// entry is `JSON.stringify` output, so a newline in a command cannot start
// a second entry (C3).
import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Verdict } from './gate.ts';
import { isMissing, messageOf } from '../shared/errors.ts';
import { isRecord } from '../shared/json.ts';
import { openRegular, tailText, writeLine, type AppendResult } from './ledger-file.ts';
import { toState, type StateEntry } from './ledger-state.ts';
import { toReview, type ReviewEntry } from '../review/review-ledger.ts';

export { overrideCounts, type OverrideKind, type StateEntry } from './ledger-state.ts';
export { ignoreCloseError, openRegular, tailText, writeLine, type AppendResult } from './ledger-file.ts';

const run = promisify(execFile);

export type LedgerEntry = {
  at: string;
  done: boolean;
  exitCode: number | null;
  reason: string;
  command: string;
  fingerprint: string | null;
  /** The engine call that wrote the line; absent on a line from before run
   * ids, or from runGate outside the engine. */
  runId?: string;
  /** Set only on a run by the Stop hook: the key of the directory and the
   * environment it ran in. The hook reuses only such a pass (reuse.ts). */
  hookKey?: string;
};

export type LedgerRead =
  | { ok: true; entries: LedgerEntry[]; skipped: number }
  | { ok: false; error: string };

export type LedgerTail =
  | {
      ok: true;
      entries: LedgerEntry[];
      states: StateEntry[];
      reviews: ReviewEntry[];
      /** Guard lines (e11s01); only the history record reads them (e15s01). */
      guards: GuardLine[];
      skipped: number;
      truncated: boolean;
    }
  | { ok: false; error: string };

/** The most the stop rules read from the ledger: the last 1 MiB (F3). */
export const ledgerReadCap = 1024 * 1024;

export type Counts = {
  runs: number;
  passes: number;
  failures: number;
  failStreak: number;
  fresh: boolean;
};

/**
 * `<absolute git dir>/weftwork` for the working tree that holds `cwd`, or null
 * when there is none: the engine's own folder, untracked and one per worktree,
 * since a linked worktree has its own git dir. It holds the ledger, the last
 * call and the state file. core.fsmonitor=false stops a repository's own
 * config from naming a program for git to run. Never throws.
 */
export async function weftworkDir(cwd: string): Promise<string | null> {
  try {
    const args = ['-c', 'core.fsmonitor=false', 'rev-parse', '--absolute-git-dir'];
    const { stdout } = await run('git', args, { cwd, encoding: 'utf8' });
    return join(stdout.replace(/\n$/, ''), 'weftwork');
  } catch {
    return null;
  }
}

/** `<absolute git dir>/weftwork/ledger.jsonl` for the working tree that holds
 * `cwd`, or null when there is none. Never throws. */
export async function ledgerPath(cwd: string): Promise<string | null> {
  const dir = await weftworkDir(cwd);
  return dir === null ? null : join(dir, 'ledger.jsonl');
}

/** Append one entry for `verdict`, with the engine call's `runId` when
 * given, and `hookKey` for a run by the Stop hook. Never throws. */
export async function appendEntry(
  path: string,
  verdict: Verdict,
  at: Date,
  runId?: string,
  hookKey?: string,
): Promise<AppendResult> {
  const entry: LedgerEntry = {
    at: at.toISOString(),
    done: verdict.done,
    exitCode: verdict.exitCode,
    reason: verdict.reason,
    command: verdict.command,
    fingerprint: verdict.fingerprint,
    ...(runId === undefined ? {} : { runId }),
    ...(hookKey === undefined ? {} : { hookKey }),
  };
  return writeLine(path, entry);
}

/** One block by the guard (e11s01): which tool, and the path or name it
 * would have changed. A log for the owner, never an input to a count. */
export type GuardEntry = { guard: 'blocked'; tool: string; target: string };

/** A guard line as read back, with its time. */
export type GuardLine = GuardEntry & { at: string };

/** Append one guard line, the same way as an entry. Never throws. */
export async function appendGuard(path: string, entry: GuardEntry, at: Date): Promise<AppendResult> {
  return writeLine(path, { at: at.toISOString(), ...entry });
}

/** Append one review line (e11s03), the same way as an entry. Never throws. */
export async function appendReview(path: string, entry: Omit<ReviewEntry, 'at'>, at: Date): Promise<AppendResult> {
  return writeLine(path, { at: at.toISOString(), ...entry });
}

/** Append one state line, the same way as an entry. Never throws. */
export async function appendState(
  path: string,
  entry: StateEntry,
  at: Date,
): Promise<AppendResult> {
  return writeLine(path, { ...entry, at: at.toISOString() });
}

function isExitCode(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isInteger(value));
}

function isFingerprint(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/** The entry in `data`, or null when a field is missing or has the wrong type. */
function toEntry(data: unknown): LedgerEntry | null {
  if (!isRecord(data)) {
    return null;
  }
  const { at, done, exitCode, reason, command, fingerprint, runId } = data;
  if (typeof at !== 'string' || typeof done !== 'boolean' || !isExitCode(exitCode)) {
    return null;
  }
  if (typeof reason !== 'string' || typeof command !== 'string' || !isFingerprint(fingerprint)) {
    return null;
  }
  if (runId !== undefined && typeof runId !== 'string') {
    return null;
  }
  const hook = typeof data.hookKey === 'string' ? { hookKey: data.hookKey } : {};
  return { at, done, exitCode, reason, command, fingerprint, ...(runId === undefined ? {} : { runId }), ...hook };
}

type Parsed = { entry: LedgerEntry } | { state: StateEntry } | { review: ReviewEntry } | { guard: GuardLine } | 'guard' | null;

/** A guard line with every field, or null (it is then ignored, not skipped). */
function toGuard(data: Record<string, unknown>): GuardLine | null {
  const { at, guard, tool, target } = data;
  if (typeof at !== 'string' || guard !== 'blocked' || typeof tool !== 'string' || typeof target !== 'string') return null;
  return { at, guard, tool, target };
}

/** A line with a string `state` key is a state line, one with a string
 * `guard` key a guard line, which only the history record reads, one with a string `review`
 * key a review round; anything else a run. */
function parseLine(line: string): Parsed {
  try {
    const data: unknown = JSON.parse(line);
    if (isRecord(data) && typeof data.guard === 'string') {
      const guard = toGuard(data);
      return guard === null ? 'guard' : { guard };
    }
    if (isRecord(data) && typeof data.state === 'string') {
      const state = toState(data);
      return state === null ? null : { state };
    }
    if (isRecord(data) && typeof data.review === 'string') {
      const review = toReview(data);
      return review === null ? null : { review };
    }
    const entry = toEntry(data);
    return entry === null ? null : { entry };
  } catch {
    return null;
  }
}

function parseLines(text: string) {
  const entries: LedgerEntry[] = [];
  const states: StateEntry[] = [];
  const reviews: ReviewEntry[] = [];
  const guards: GuardLine[] = [];
  let skipped = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') {
      continue;
    }
    const parsed = parseLine(line);
    if (parsed === null) {
      skipped += 1;
    } else if (parsed === 'guard') {
      continue;
    } else if ('guard' in parsed) {
      guards.push(parsed.guard);
    } else if ('entry' in parsed) {
      entries.push(parsed.entry);
    } else if ('review' in parsed) {
      reviews.push(parsed.review);
    } else {
      states.push(parsed.state);
    }
  }
  return { entries, states, reviews, guards, skipped };
}

/**
 * Read every entry. A line that cannot be used, such as a torn last line, is
 * skipped and counted, and never throws. A state line is neither an entry nor
 * skipped. A file that does not exist is an empty ledger. Any other read
 * error is not ok.
 */
export async function readLedger(path: string): Promise<LedgerRead> {
  let handle: FileHandle | undefined;
  try {
    handle = await openRegular(path, constants.O_RDONLY);
    const { entries, skipped } = parseLines(await handle.readFile('utf8'));
    return { ok: true, entries, skipped };
  } catch (error) {
    return isMissing(error)
      ? { ok: true, entries: [], skipped: 0 }
      : { ok: false, error: messageOf(error) };
  } finally {
    await handle?.close();
  }
}

/**
 * Like `readLedger`, but reads at most the last `maxBytes` bytes, so a large
 * ledger costs bounded memory (F3, CWE-400). When the file is larger the
 * fragment before the first newline is dropped, not counted, and `truncated`
 * is true. Also returns the state lines. Never throws.
 */
export async function readLedgerTail(path: string, maxBytes: number): Promise<LedgerTail> {
  let handle: FileHandle | undefined;
  try {
    handle = await openRegular(path, constants.O_RDONLY);
    const { text, truncated } = await tailText(handle, maxBytes);
    return { ok: true, ...parseLines(text), truncated };
  } catch (error) {
    return isMissing(error)
      ? { ok: true, entries: [], states: [], reviews: [], guards: [], skipped: 0, truncated: false }
      : { ok: false, error: messageOf(error) };
  } finally {
    await handle?.close();
  }
}

/** The not-done entries after the last done one, for one command, oldest
 * first. A pass ends the run of failures. */
export function failingRun(entries: LedgerEntry[], command: string): LedgerEntry[] {
  const mine = entries.filter((entry) => entry.command === command);
  return mine.slice(mine.findLastIndex((entry) => entry.done) + 1);
}

/**
 * Counts over the entries for one command, matched by exact string.
 * `failStreak` is the not-done entries after the last done one. `fresh` is
 * true only when the last entry is done at the current fingerprint; an older
 * done is stale. The gate never feeds these counts into its own verdict.
 */
export function countsFor(entries: LedgerEntry[], command: string, fingerprint: string): Counts {
  const mine = entries.filter((entry) => entry.command === command);
  const passes = mine.filter((entry) => entry.done).length;
  const last = mine.at(-1);
  return {
    runs: mine.length,
    passes,
    failures: mine.length - passes,
    failStreak: failingRun(entries, command).length,
    fresh: last !== undefined && last.done && last.fingerprint === fingerprint,
  };
}
