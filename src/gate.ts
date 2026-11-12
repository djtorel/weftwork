// story: e06s01
// The evidence gate: done means a declared command, run by the engine,
// exited 0 and left the working tree as it found it. The agent's own claim
// is never evidence (e06s01, e06s02). Every verdict is logged (e06s03). An
// optional AbortSignal stops the command and its children (e06s04). The
// process control lives in process.ts.
import { appendEntry, ledgerPath } from './ledger.ts';
import { isRecord } from './json.ts';
import { runCommand, type Outcome } from './process.ts';
import { fingerprintTree, type FingerprintResult } from './tree.ts';

/** `blocked`, `stallAfter` and `maxFailures` are read for the engine
 * (e06s04); `runGate` ignores them. */
export type GateRequest = {
  command: string;
  cwd: string;
  timeoutMs?: number;
  blocked?: string;
  stallAfter?: number;
  maxFailures?: number;
};

export type Reason =
  | 'passed'
  | 'exit-nonzero'
  | 'not-started'
  | 'signal'
  | 'timeout'
  | 'no-tree'
  | 'tree-changed'
  | 'no-ledger'
  | 'killed'
  | 'not-run';

/** `done` is true only with reason `passed`. `fingerprint` is the one taken
 * before the run, or null when the tree could not be fingerprinted. */
export type Verdict = {
  done: boolean;
  exitCode: number | null;
  reason: Reason;
  command: string;
  fingerprint: string | null;
};

export type ParseResult =
  | { ok: true; request: GateRequest }
  | { ok: false; error: string };

export const defaultTimeoutMs = 600000;

// Node's timer limit. A larger value would fire at once.
const maxTimeoutMs = 2147483647;

const bad = (error: string): ParseResult => ({ ok: false, error });

function isTimeout(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= maxTimeoutMs
  );
}

const maxBlockedLength = 1000;
const maxThreshold = 1000;

function isCount(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= maxThreshold;
}

function isBlocked(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.length <= maxBlockedLength;
}

/** The JSON object in `text`, or the reason it is not one. */
function readObject(text: string): Record<string, unknown> | string {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return 'input is not JSON';
  }
  return isRecord(data) ? data : 'input must be one JSON object';
}

/**
 * Read one JSON object with a non-empty string `command`, an optional
 * string `cwd`, an optional integer `timeoutMs` from 1 to 2147483647, and the
 * engine's optional keys: a `blocked` text (1 to 1000 characters, not only
 * spaces), an integer `stallAfter` from 2 to 1000 and an integer
 * `maxFailures` from 1 to 1000. Other keys are ignored, since later stories
 * add keys. Returns a value for bad input, never throws.
 */
/** The first problem with an optional engine key, or null when all are fine. */
function optionalError(data: Record<string, unknown>): string | null {
  const { timeoutMs, blocked, stallAfter, maxFailures } = data;
  if (timeoutMs !== undefined && !isTimeout(timeoutMs)) {
    return `"timeoutMs" must be an integer from 1 to ${maxTimeoutMs}`;
  }
  if (blocked !== undefined && !isBlocked(blocked)) {
    return `"blocked" must be text of 1 to ${maxBlockedLength} characters`;
  }
  if (stallAfter !== undefined && !isCount(stallAfter, 2)) {
    return `"stallAfter" must be an integer from 2 to ${maxThreshold}`;
  }
  if (maxFailures !== undefined && !isCount(maxFailures, 1)) {
    return `"maxFailures" must be an integer from 1 to ${maxThreshold}`;
  }
  return null;
}

const optionalKeys = ['timeoutMs', 'blocked', 'stallAfter', 'maxFailures'] as const;

/** The optional keys that are present in `data`. */
function pickOptional(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    optionalKeys.filter((key) => data[key] !== undefined).map((key) => [key, data[key]]),
  );
}

export function parseRequest(text: string, defaultCwd: string): ParseResult {
  const data = readObject(text);
  if (typeof data === 'string') {
    return bad(data);
  }
  const { command, cwd } = data;
  if (typeof command !== 'string' || command.trim() === '') {
    return bad('"command" must be a non-empty string');
  }
  if (cwd !== undefined && typeof cwd !== 'string') {
    return bad('"cwd" must be a string');
  }
  const problem = optionalError(data);
  if (problem !== null) {
    return bad(problem);
  }
  return { ok: true, request: { command, cwd: cwd ?? defaultCwd, ...pickOptional(data) } };
}

function verdictOf(request: GateRequest, outcome: Outcome, fingerprint: string | null): Verdict {
  return {
    done: outcome.reason === 'passed',
    exitCode: outcome.exitCode,
    reason: outcome.reason,
    command: request.command,
    fingerprint,
  };
}

/** `passed` only when the tree is the same after the run as before it. */
function settle(before: string, after: FingerprintResult): Reason {
  if (after.ok) {
    return after.fingerprint === before ? 'passed' : 'tree-changed';
  }
  return 'no-tree';
}

async function runAndCompare(
  request: GateRequest,
  before: string,
  signal?: AbortSignal,
): Promise<Verdict> {
  const timeoutMs = request.timeoutMs ?? defaultTimeoutMs;
  const outcome = await runCommand(request.command, request.cwd, timeoutMs, signal);
  if (outcome.reason === 'passed') {
    const reason = settle(before, await fingerprintTree(request.cwd));
    return verdictOf(request, { reason, exitCode: outcome.exitCode }, before);
  }
  return verdictOf(request, outcome, before);
}

/**
 * Fingerprint the tree, run the command, and name the verdict. A tree that
 * cannot be fingerprinted is `no-tree` and the command does not run. A run
 * that exits 0 is `passed` only when the tree is the same afterwards.
 */
async function decide(request: GateRequest, signal?: AbortSignal): Promise<Verdict> {
  const before = await fingerprintTree(request.cwd);
  if (before.ok) {
    return runAndCompare(request, before.fingerprint, signal);
  }
  return verdictOf(request, { reason: 'no-tree', exitCode: null }, null);
}

function note(text: string): void {
  process.stderr.write(`weftwork: ${text}\n`);
}

/**
 * Log the verdict, whatever it is. A `passed` verdict that cannot be logged
 * is `no-ledger` and not done; any other verdict is kept as it is. The
 * ledger is only written here, never read: done comes from the run (C4).
 */
async function record(cwd: string, verdict: Verdict): Promise<Verdict> {
  const path = await ledgerPath(cwd);
  const result = path === null ? null : await appendEntry(path, verdict, new Date());
  if (result?.ok) {
    return verdict;
  }
  note(`ledger not written: ${result === null ? 'no git working tree' : result.error}`);
  return verdict.reason === 'passed' ? { ...verdict, done: false, reason: 'no-ledger' } : verdict;
}

/**
 * Decide the verdict and log it in the ledger (e06s03). Resolves, never
 * rejects, for an expected failure. When `signal` aborts while the command
 * runs, the whole process group is killed and the reason is `killed`.
 */
export async function runGate(request: GateRequest, signal?: AbortSignal): Promise<Verdict> {
  return record(request.cwd, await decide(request, signal));
}
