// story: e06s03, e07s02, e07s04
// e07s02 (BUG-007): the ledger opens without blocking and only as a regular file.
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
import { constants } from 'node:fs';
import { mkdir, open, type FileHandle } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type { Verdict } from './gate.ts';
import { isMissing, messageOf } from './errors.ts';
import { isRecord } from './json.ts';
import { toState, type StateEntry } from './ledger-state.ts';

export { overrideCounts, type OverrideKind, type StateEntry } from './ledger-state.ts';

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
 * Open the ledger without blocking, and only if it is a regular file. The agent
 * can replace the file (T3), and opening a FIFO blocks until the other end is
 * opened, in a thread nothing can abort. A process stuck there cannot even
 * leave with process.exit, so the Stop hook would hang until the host cuts it
 * off and lets the stop go ahead (BUG-007). With O_NONBLOCK the open returns
 * at once, and a FIFO, a device or a directory is refused. override.ts does the
 * same for override.json.
 */
export async function openRegular(path: string, flags: number, mode?: number): Promise<FileHandle> {
  const handle = await open(path, flags | constants.O_NONBLOCK, mode);
  try {
    if (!(await handle.stat()).isFile()) {
      throw new Error(`${path} is not a regular file`);
    }
    return handle;
  } catch (error) {
    await handle.close();
    throw error;
  }
}

/**
 * Append one line in a single write. The leading newline ends any torn line
 * a crashed writer left, so the line starts on its own line. The directory is
 * made 0700 and the file 0600, since a line may hold a command string that
 * holds a secret (T8). Never throws.
 */
async function writeLine(path: string, line: object): Promise<AppendResult> {
  let handle: FileHandle | undefined;
  try {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const flags = constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT;
    handle = await openRegular(path, flags, 0o600);
    await handle.appendFile(`\n${JSON.stringify(line)}\n`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  } finally {
    await handle?.close();
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
/** The last `maxBytes` bytes of an open file, cut to whole lines. */
async function tailText(
  handle: FileHandle,
  maxBytes: number,
): Promise<{ text: string; truncated: boolean }> {
  const { size } = await handle.stat();
  const length = Math.min(size, maxBytes);
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, size - length);
  const text = buffer.toString('utf8', 0, bytesRead);
  if (size <= maxBytes) {
    return { text, truncated: false };
  }
  const cut = text.indexOf('\n');
  return { text: cut === -1 ? '' : text.slice(cut + 1), truncated: true };
}

export async function readLedgerTail(path: string, maxBytes: number): Promise<LedgerTail> {
  let handle: FileHandle | undefined;
  try {
    handle = await openRegular(path, constants.O_RDONLY);
    const { text, truncated } = await tailText(handle, maxBytes);
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
