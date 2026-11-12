// story: e06s04
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
