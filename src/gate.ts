// story: e06s01
// The evidence gate: done means a declared command, run by the engine,
// exited 0 and left the working tree as it found it. The agent's own claim
// is never evidence (e06s01, e06s02). Every verdict is logged (e06s03). An
// optional AbortSignal stops the command and its children (e06s04).
import { spawn, type ChildProcess } from 'node:child_process';
import { appendEntry, ledgerPath } from './ledger.ts';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
export function parseRequest(text: string, defaultCwd: string): ParseResult {
  const data = readObject(text);
  if (typeof data === 'string') {
    return bad(data);
  }
  const { command, cwd, timeoutMs, blocked, stallAfter, maxFailures } = data;
  if (typeof command !== 'string' || command.trim() === '') {
    return bad('"command" must be a non-empty string');
  }
  if (cwd !== undefined && typeof cwd !== 'string') {
    return bad('"cwd" must be a string');
  }
  if (timeoutMs !== undefined && !isTimeout(timeoutMs)) {
    return bad(`"timeoutMs" must be an integer from 1 to ${maxTimeoutMs}`);
  }
  if (blocked !== undefined && !isBlocked(blocked)) {
    return bad(`"blocked" must be text of 1 to ${maxBlockedLength} characters`);
  }
  if (stallAfter !== undefined && !isCount(stallAfter, 2)) {
    return bad(`"stallAfter" must be an integer from 2 to ${maxThreshold}`);
  }
  if (maxFailures !== undefined && !isCount(maxFailures, 1)) {
    return bad(`"maxFailures" must be an integer from 1 to ${maxThreshold}`);
  }
  const optional = Object.fromEntries(
    Object.entries({ timeoutMs, blocked, stallAfter, maxFailures }).filter(
      ([, value]) => value !== undefined,
    ),
  );
  return { ok: true, request: { command, cwd: cwd ?? defaultCwd, ...optional } };
}

type Outcome = { reason: Reason; exitCode: number | null };

const notStarted: Outcome = { reason: 'not-started', exitCode: null };
const killed: Outcome = { reason: 'killed', exitCode: null };

/** SIGKILL every process in the group the command started. */
function killGroup(pid: number | undefined): void {
  if (pid === undefined) {
    return;
  }
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // The group is already gone, which is the goal.
  }
}

function outcomeOf(code: number | null, timedOut: boolean, aborted: boolean): Outcome {
  if (aborted) {
    return killed;
  }
  if (timedOut) {
    return { reason: 'timeout', exitCode: null };
  }
  if (code === null) {
    return { reason: 'signal', exitCode: null };
  }
  return { reason: code === 0 ? 'passed' : 'exit-nonzero', exitCode: code };
}

/**
 * Wait for the child to end. On timeout the whole group gets SIGKILL, and it
 * gets SIGKILL again after the shell exits, so a background process still in
 * the group cannot keep writing after the second fingerprint (threat model
 * C7). Node's own timeout signals only the shell, so it is not used. An
 * abort of `signal` ends the group the same way, at once, with SIGKILL.
 */
function watchChild(child: ChildProcess, timeoutMs: number, signal?: AbortSignal): Promise<Outcome> {
  return new Promise((resolve) => {
    let timedOut = false;
    let aborted = false;
    const onAbort = () => {
      aborted = true;
      killGroup(child.pid);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup(child.pid);
    }, timeoutMs);
    signal?.addEventListener('abort', onAbort, { once: true });
    const finish = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    child.on('error', () => {
      finish();
      resolve(notStarted);
    });
    child.on('close', (code) => {
      finish();
      killGroup(child.pid);
      resolve(outcomeOf(code, timedOut, aborted));
    });
  });
}

/**
 * Run `command` as one shell string in `cwd`, in its own process group.
 * Resolves, never rejects. Output goes to the engine's stderr, so stdout
 * stays free for the verdict. A signal that is already aborted means the
 * command does not run.
 */
async function runCommand(
  command: string,
  cwd: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Outcome> {
  if (signal?.aborted) {
    return killed;
  }
  try {
    const child = spawn(command, { cwd, shell: true, detached: true, stdio: ['ignore', 2, 2] });
    return await watchChild(child, timeoutMs, signal);
  } catch {
    // spawn throws at once for a NUL byte in the command or the cwd.
    return notStarted;
  }
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
