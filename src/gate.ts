// story: e06s01
// The evidence gate: done means a declared command, run by the engine,
// exited 0 and left the working tree as it found it. The agent's own claim
// is never evidence (e06s01, e06s02).
import { spawn } from 'node:child_process';
import { fingerprintTree } from './tree.ts';

export type GateRequest = { command: string; cwd: string; timeoutMs?: number };

export type Reason =
  | 'passed'
  | 'exit-nonzero'
  | 'not-started'
  | 'signal'
  | 'timeout'
  | 'no-tree'
  | 'tree-changed';

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

function isTimeout(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= maxTimeoutMs;
}

/** The JSON object in `text`, or the reason it is not one. */
function readObject(text: string): Record<string, unknown> | string {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return 'input is not JSON';
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return 'input must be one JSON object';
  }
  return data as Record<string, unknown>;
}

/**
 * Read one JSON object with a non-empty string `command`, an optional
 * string `cwd` and an optional integer `timeoutMs` from 1 to 2147483647.
 * Other keys are ignored, since later stories add keys. Returns a value for
 * bad input, never throws.
 */
export function parseRequest(text: string, defaultCwd: string): ParseResult {
  const data = readObject(text);
  if (typeof data === 'string') {
    return { ok: false, error: data };
  }
  const { command, cwd, timeoutMs } = data;
  if (typeof command !== 'string' || command.trim() === '') {
    return { ok: false, error: '"command" must be a non-empty string' };
  }
  if (cwd !== undefined && typeof cwd !== 'string') {
    return { ok: false, error: '"cwd" must be a string' };
  }
  if (timeoutMs !== undefined && !isTimeout(timeoutMs)) {
    return { ok: false, error: `"timeoutMs" must be an integer from 1 to ${maxTimeoutMs}` };
  }
  const request: GateRequest = { command, cwd: cwd ?? defaultCwd };
  if (timeoutMs !== undefined) {
    request.timeoutMs = timeoutMs;
  }
  return { ok: true, request };
}

type Outcome = { reason: Reason; exitCode: number | null };

const notStarted: Outcome = { reason: 'not-started', exitCode: null };

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

function outcomeOf(code: number | null, timedOut: boolean): Outcome {
  if (timedOut) {
    return { reason: 'timeout', exitCode: null };
  }
  if (code === null) {
    return { reason: 'signal', exitCode: null };
  }
  return { reason: code === 0 ? 'passed' : 'exit-nonzero', exitCode: code };
}

/**
 * Run `command` as one shell string in `cwd`, in its own process group.
 * Node's own timeout signals only the shell, so the group gets SIGKILL on
 * timeout, and again after the shell exits, so a background process cannot
 * keep writing after the second fingerprint (threat model C7). Resolves,
 * never rejects. Output goes to the engine's stderr, so stdout stays free
 * for the verdict.
 */
function runCommand(command: string, cwd: string, timeoutMs: number): Promise<Outcome> {
  return new Promise((resolve) => {
    try {
      const child = spawn(command, { cwd, shell: true, detached: true, stdio: ['ignore', 2, 2] });
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        killGroup(child.pid);
      }, timeoutMs);
      child.on('error', () => {
        clearTimeout(timer);
        resolve(notStarted);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        killGroup(child.pid);
        resolve(outcomeOf(code, timedOut));
      });
    } catch {
      // spawn throws at once for a NUL byte in the command or the cwd.
      resolve(notStarted);
    }
  });
}

function verdictOf(
  request: GateRequest,
  outcome: Outcome,
  fingerprint: string | null,
): Verdict {
  return {
    done: outcome.reason === 'passed',
    exitCode: outcome.exitCode,
    reason: outcome.reason,
    command: request.command,
    fingerprint,
  };
}

/**
 * Fingerprint the tree, run the command, and name the verdict. A tree that
 * cannot be fingerprinted is `no-tree` and the command does not run. A run
 * that exits 0 is `passed` only when the tree is the same afterwards.
 * Resolves, never rejects, for an expected failure.
 */
export async function runGate(request: GateRequest): Promise<Verdict> {
  const before = await fingerprintTree(request.cwd);
  if (!before.ok) {
    return verdictOf(request, { reason: 'no-tree', exitCode: null }, null);
  }
  const outcome = await runCommand(request.command, request.cwd, request.timeoutMs ?? defaultTimeoutMs);
  if (outcome.reason !== 'passed') {
    return verdictOf(request, outcome, before.fingerprint);
  }
  const after = await fingerprintTree(request.cwd);
  const reason: Reason = !after.ok ? 'no-tree' : after.fingerprint === before.fingerprint ? 'passed' : 'tree-changed';
  return verdictOf(request, { reason, exitCode: outcome.exitCode }, before.fingerprint);
}
