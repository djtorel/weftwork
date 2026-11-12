// story: e06s03
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
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type { Verdict } from './gate.ts';

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
 * Append one entry for `verdict` in a single write. The leading newline ends
 * any torn line a crashed writer left, so the entry starts on its own line.
 * Never throws.
 */
export async function appendEntry(path: string, verdict: Verdict, at: Date): Promise<AppendResult> {
  const entry: LedgerEntry = {
    at: at.toISOString(),
    done: verdict.done,
    exitCode: verdict.exitCode,
    reason: verdict.reason,
    command: verdict.command,
    fingerprint: verdict.fingerprint,
  };
  try {
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `\n${JSON.stringify(entry)}\n`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
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

function parseEntry(line: string): LedgerEntry | null {
  try {
    return toEntry(JSON.parse(line));
  } catch {
    return null;
  }
}

function parseLines(text: string): LedgerRead {
  const entries: LedgerEntry[] = [];
  let skipped = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') {
      continue;
    }
    const entry = parseEntry(line);
    if (entry === null) {
      skipped += 1;
    } else {
      entries.push(entry);
    }
  }
  return { ok: true, entries, skipped };
}

/**
 * Read every entry. A line that cannot be used, such as a torn last line, is
 * skipped and counted, and never throws. A file that does not exist is an
 * empty ledger. Any other read error is not ok.
 */
export async function readLedger(path: string): Promise<LedgerRead> {
  try {
    return parseLines(await readFile(path, 'utf8'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { ok: true, entries: [], skipped: 0 };
    }
    return { ok: false, error: messageOf(error) };
  }
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
    failStreak: mine.length - mine.findLastIndex((entry) => entry.done) - 1,
    fresh: last !== undefined && last.done && last.fingerprint === fingerprint,
  };
}
