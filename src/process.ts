// story: e06s04, e11s03
// Running the declared command as a child process in its own group: the
// timeout, the abort and the kill of the whole group (threat model C7). Split
// out of gate.ts, which keeps the verdict rules. Never reads the ledger.
import { spawn, type ChildProcess } from 'node:child_process';
import type { Reason } from './gate.ts';

export type Outcome = { reason: Reason; exitCode: number | null };

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
/**
 * Kill the group on timeout or on abort. Returns the flags that say which
 * happened, and `disarm`, which cancels both, so a finished child is never
 * killed by a late timer or signal.
 */
function armKill(child: ChildProcess, limits: { timeoutMs: number; signal?: AbortSignal }) {
  const flags = { timedOut: false, aborted: false };
  const kill = () => killGroup(child.pid);
  const onAbort = () => {
    flags.aborted = true;
    kill();
  };
  const timer = setTimeout(() => {
    flags.timedOut = true;
    kill();
  }, limits.timeoutMs);
  limits.signal?.addEventListener('abort', onAbort, { once: true });
  const disarm = () => {
    clearTimeout(timer);
    limits.signal?.removeEventListener('abort', onAbort);
  };
  return { flags, disarm };
}

function watchChild(child: ChildProcess, timeoutMs: number, signal?: AbortSignal): Promise<Outcome> {
  return new Promise((resolve) => {
    const { flags, disarm } = armKill(child, { timeoutMs, signal });
    child.on('error', () => {
      disarm();
      resolve(notStarted);
    });
    child.on('close', (code) => {
      disarm();
      killGroup(child.pid);
      resolve(outcomeOf(code, flags.timedOut, flags.aborted));
    });
  });
}

/**
 * Run `command` as one shell string in `cwd`, in its own process group.
 * Resolves, never rejects. Output goes to the engine's stderr, so stdout
 * stays free for the verdict. A signal that is already aborted means the
 * command does not run.
 */
export async function runCommand(
  command: string,
  cwd: string,
  timeoutMs: number,
  signal?: AbortSignal,
  env?: NodeJS.ProcessEnv,
): Promise<Outcome> {
  if (signal?.aborted) {
    return killed;
  }
  try {
    const child = spawn(command, { cwd, env: env ?? process.env, shell: true, detached: true, stdio: ['ignore', 2, 2] });
    return await watchChild(child, timeoutMs, signal);
  } catch {
    // spawn throws at once for a NUL byte in the command or the cwd.
    return notStarted;
  }
}

/** What a captured command printed, and how it ended. */
export type Captured = Outcome & { stdout: string; stdoutCut: boolean; stderrTail: string };

/** The most a captured command's stdout may hold; more is cut. */
export const maxCaptureBytes = 1024 * 1024;

/** Collect a stream: the first `max` bytes, or with `tail` the last ones.
 * `cut` says whether bytes were dropped. */
function collect(stream: NodeJS.ReadableStream | null, max: number, tail: boolean) {
  let kept = Buffer.alloc(0);
  let cut = false;
  stream?.on('data', (chunk: Buffer) => {
    const all = Buffer.concat([kept, chunk]);
    cut ||= all.length > max;
    kept = tail ? all.subarray(Math.max(0, all.length - max)) : all.subarray(0, max);
  });
  return () => ({ text: kept.toString('utf8'), cut });
}

/**
 * Run `command` like runCommand, with `input` on its stdin, and keep its
 * stdout (the first 1 MiB; `stdoutCut` when there was more) and the end of its stderr (e11s03: a reviewer's
 * reply and why it failed). Resolves, never rejects.
 */
export async function runCapture(command: string, cwd: string, timeoutMs: number, input: string): Promise<Captured> {
  try {
    const child = spawn(command, { cwd, shell: true, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout = collect(child.stdout, maxCaptureBytes, false);
    const stderr = collect(child.stderr, 400, true);
    // A command that does not read its stdin closes the pipe: EPIPE is not a failure.
    child.stdin?.on('error', () => {});
    child.stdin?.end(input);
    const outcome = await watchChild(child, timeoutMs);
    const out = stdout();
    return { ...outcome, stdout: out.text, stdoutCut: out.cut, stderrTail: stderr().text };
  } catch {
    return { ...notStarted, stdout: '', stdoutCut: false, stderrTail: '' };
  }
}
