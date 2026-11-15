// story: e06s01, e09s02, e09s03
// The evidence gate: done means a declared command, run by the engine,
// exited 0 and left the working tree as it found it. The agent's own claim
// is never evidence (e06s01, e06s02). Every verdict is logged (e06s03). An
// optional AbortSignal stops the command and its children (e06s04). The
// process control lives in process.ts.
import { appendEntry, ledgerPath } from './ledger.ts';
import { isInteger, isRecord } from './json.ts';
import { runCommand, type Outcome } from './process.ts';
import { fingerprintTree, type FingerprintResult } from './tree.ts';

/** `blocked`, `stallAfter` and `maxFailures` (e06s04), `maxRuns` (e09s02)
 * and `reserveRuns` (e09s03) are read for the engine; `runGate` ignores them.
 * `reserveRuns` is never parsed from the request: only the budget setting
 * files set it (applyBudget). */
export type GateRequest = {
  command: string;
  cwd: string;
  timeoutMs?: number;
  blocked?: string;
  stallAfter?: number;
  maxFailures?: number;
  maxRuns?: number;
  reserveRuns?: number;
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

/** The engine's stop-rule limits. The request and the budget setting files
 * (e09s01) check them by the same rule. `maxRuns`, the loop ceiling, has no
 * default: it is off unless set (e09s02). */
export const limitKeys = ['stallAfter', 'maxFailures', 'maxRuns'] as const;
export type LimitKey = (typeof limitKeys)[number];
const limitMin: Record<LimitKey, number> = { stallAfter: 2, maxFailures: 1, maxRuns: 1 };

/** True when `value` is a valid `key` limit: an integer in its range. */
export function isLimit(key: LimitKey, value: unknown): value is number {
  return isInteger(value) && value >= limitMin[key] && value <= maxThreshold;
}

/** The rule a `key` limit must meet ("must be ..."), for error text. Each
 * caller names the key its own way. */
export function limitRule(key: LimitKey): string {
  return `must be an integer from ${limitMin[key]} to ${maxThreshold}`;
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

/** The first problem with an optional engine key, or null when all are fine. */
function optionalError(data: Record<string, unknown>): string | null {
  const { timeoutMs, blocked } = data;
  if (timeoutMs !== undefined && !isTimeout(timeoutMs)) {
    return `"timeoutMs" must be an integer from 1 to ${maxTimeoutMs}`;
  }
  if (blocked !== undefined && !isBlocked(blocked)) {
    return `"blocked" must be text of 1 to ${maxBlockedLength} characters`;
  }
  for (const key of limitKeys) {
    const value = data[key];
    if (value !== undefined && !isLimit(key, value)) return `"${key}" ${limitRule(key)}`;
  }
  return null;
}

const optionalKeys = ['timeoutMs', 'blocked', ...limitKeys] as const;

/** The optional keys that are present in `data`. */
function pickOptional(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    optionalKeys.filter((key) => data[key] !== undefined).map((key) => [key, data[key]]),
  );
}

/**
 * Read one JSON object with a non-empty string `command`, an optional
 * string `cwd`, an optional integer `timeoutMs` from 1 to 2147483647, and the
 * engine's optional keys: a `blocked` text (1 to 1000 characters, not only
 * spaces), an integer `stallAfter` from 2 to 1000, an integer
 * `maxFailures` from 1 to 1000 and an integer `maxRuns` from 1 to 1000.
 * The budget setting files (docs/BUDGET.md) then set the limits, and a
 * request value is used only when it is lower (e09s01). Other keys are
 * ignored, since later stories add keys. Returns a value for bad input,
 * never throws.
 */
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

/** A verdict, and why its ledger line was not written (null when it was).
 * With no git working tree there is no ledger, which is not a failed write. */
export type LoggedVerdict = { verdict: Verdict; writeProblem: string | null };

/**
 * Log the verdict, whatever it is. A `passed` verdict that cannot be logged
 * is `no-ledger` and not done; any other verdict is kept as it is. The
 * ledger is only written here, never read: done comes from the run (C4).
 */
async function record(cwd: string, verdict: Verdict): Promise<LoggedVerdict> {
  const path = await ledgerPath(cwd);
  const result = path === null ? null : await appendEntry(path, verdict, new Date());
  if (result?.ok) {
    return { verdict, writeProblem: null };
  }
  note(`ledger not written: ${result === null ? 'no git working tree' : result.error}`);
  const kept = verdict.reason === 'passed' ? { ...verdict, done: false, reason: 'no-ledger' as const } : verdict;
  const writeProblem = result === null ? null : 'the run could not be written to the ledger';
  return { verdict: kept, writeProblem };
}

/** `runGate`, and why the ledger line could not be written: the run is then
 * missing from the ledger, so the engine cannot count the loop (e09s02). */
export async function runLoggedGate(request: GateRequest, signal?: AbortSignal): Promise<LoggedVerdict> {
  return record(request.cwd, await decide(request, signal));
}

/**
 * Decide the verdict and log it in the ledger (e06s03). Resolves, never
 * rejects, for an expected failure. When `signal` aborts while the command
 * runs, the whole process group is killed and the reason is `killed`.
 */
export async function runGate(request: GateRequest, signal?: AbortSignal): Promise<Verdict> {
  return (await runLoggedGate(request, signal)).verdict;
}
