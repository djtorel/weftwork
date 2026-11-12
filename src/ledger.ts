// story: e06s03
// e06s04 adds state lines (one per terminal state), the capped tail reader
// the stop rules use (security review F3) and failingRun.
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
import { appendFile, mkdir, open, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type { Verdict } from './gate.ts';
import { terminalStates, type State } from './states.ts';

const run = promisify(execFile);

export type LedgerEntry = {
  at: string;
  done: boolean;
  exitCode: number | null;
  reason: string;
  command: string;
  fingerprint: string | null;
};

export type AppendResult = { ok: true } | { ok: false; error: string };

export type LedgerRead =
  | { ok: true; entries: LedgerEntry[]; skipped: number }
  | { ok: false; error: string };

/** One terminal state, with the counters at the time (e06s04). `threshold` is
 * the number that tripped, or null; `detail` is a short text, or null. */
export type StateEntry = {
  at: string;
  state: State;
  command: string;
  runs: number;
  failStreak: number;
  threshold: number | null;
  detail: string | null;
};

export type LedgerTail =
  | {
      ok: true;
      entries: LedgerEntry[];
      states: StateEntry[];
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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * `<absolute git dir>/weftwork/ledger.jsonl` for the working tree that holds
 * `cwd`, or null when there is none. A linked worktree has its own git dir.
 * core.fsmonitor=false stops a repository's own config from naming a program
 * for git to run. Never throws.
 */
export async function ledgerPath(cwd: string): Promise<string | null> {
  try {
    const args = ['-c', 'core.fsmonitor=false', 'rev-parse', '--absolute-git-dir'];
    const { stdout } = await run('git', args, { cwd, encoding: 'utf8' });
    return join(stdout.replace(/\n$/, ''), 'weftwork', 'ledger.jsonl');
  } catch {
    return null;
  }
}

/**
 * Append one line in a single write. The leading newline ends any torn line
 * a crashed writer left, so the line starts on its own line. The directory is
 * made 0700 and the file 0600, since a line may hold a command string that
 * holds a secret (T8). Never throws.
 */
async function writeLine(path: string, line: object): Promise<AppendResult> {
  try {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await appendFile(path, `\n${JSON.stringify(line)}\n`, { mode: 0o600 });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
}

/** Append one entry for `verdict`. Never throws. */
export async function appendEntry(path: string, verdict: Verdict, at: Date): Promise<AppendResult> {
  const entry: LedgerEntry = {
    at: at.toISOString(),
    done: verdict.done,
    exitCode: verdict.exitCode,
    reason: verdict.reason,
    command: verdict.command,
    fingerprint: verdict.fingerprint,
  };
  return writeLine(path, entry);
}

/** Append one state line, the same way as an entry. Never throws. */
export async function appendState(
  path: string,
  entry: StateEntry,
  at: Date,
): Promise<AppendResult> {
  return writeLine(path, { ...entry, at: at.toISOString() });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
  const { at, done, exitCode, reason, command, fingerprint } = data;
  if (typeof at !== 'string' || typeof done !== 'boolean' || !isExitCode(exitCode)) {
    return null;
  }
  if (typeof reason !== 'string' || typeof command !== 'string' || !isFingerprint(fingerprint)) {
    return null;
  }
  return { at, done, exitCode, reason, command, fingerprint };
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

const knownStates: readonly string[] = [...terminalStates, 'failed'];

/** The state line in `data`, or null when a field is missing or wrong. */
function toState(data: Record<string, unknown>): StateEntry | null {
  const { at, state, command, runs, failStreak, threshold, detail } = data;
  if (typeof at !== 'string' || typeof state !== 'string' || !knownStates.includes(state)) {
    return null;
  }
  if (typeof command !== 'string' || !isCount(runs) || !isCount(failStreak)) {
    return null;
  }
  if (threshold !== null && !isCount(threshold)) {
    return null;
  }
  if (detail !== null && typeof detail !== 'string') {
    return null;
  }
  return { at, state: state as State, command, runs, failStreak, threshold, detail };
}

type Parsed = { entry: LedgerEntry } | { state: StateEntry } | null;

/** A line with a string `state` key is a state line, anything else a run. */
function parseLine(line: string): Parsed {
  try {
    const data: unknown = JSON.parse(line);
    if (isRecord(data) && typeof data.state === 'string') {
      const state = toState(data);
      return state === null ? null : { state };
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
  let skipped = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') {
      continue;
    }
    const parsed = parseLine(line);
    if (parsed === null) {
      skipped += 1;
    } else if ('entry' in parsed) {
      entries.push(parsed.entry);
    } else {
      states.push(parsed.state);
    }
  }
  return { entries, states, skipped };
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

/**
 * Read every entry. A line that cannot be used, such as a torn last line, is
 * skipped and counted, and never throws. A state line is neither an entry nor
 * skipped. A file that does not exist is an empty ledger. Any other read
 * error is not ok.
 */
export async function readLedger(path: string): Promise<LedgerRead> {
  try {
    const { entries, skipped } = parseLines(await readFile(path, 'utf8'));
    return { ok: true, entries, skipped };
  } catch (error) {
    return isMissing(error)
      ? { ok: true, entries: [], skipped: 0 }
      : { ok: false, error: messageOf(error) };
  }
}

/**
 * Like `readLedger`, but reads at most the last `maxBytes` bytes, so a large
 * ledger costs bounded memory (F3, CWE-400). When the file is larger the
 * fragment before the first newline is dropped, not counted, and `truncated`
 * is true. Also returns the state lines. Never throws.
 */
export async function readLedgerTail(path: string, maxBytes: number): Promise<LedgerTail> {
  let handle;
  try {
    handle = await open(path, 'r');
    const { size } = await handle.stat();
    const length = Math.min(size, maxBytes);
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, size - length);
    let text = buffer.toString('utf8', 0, bytesRead);
    const truncated = size > maxBytes;
    if (truncated) {
      const cut = text.indexOf('\n');
      text = cut === -1 ? '' : text.slice(cut + 1);
    }
    return { ok: true, ...parseLines(text), truncated };
  } catch (error) {
    return isMissing(error)
      ? { ok: true, entries: [], states: [], skipped: 0, truncated: false }
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
