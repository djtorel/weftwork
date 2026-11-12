// story: e06s01
// The evidence gate: done means a declared command, run by the engine,
// exited 0. The agent's own claim is never evidence (e06s01).
import { spawn } from 'node:child_process';

export type GateRequest = { command: string; cwd: string };

export type Verdict = { done: boolean; exitCode: number | null };

export type ParseResult =
  | { ok: true; request: GateRequest }
  | { ok: false; error: string };

/**
 * Read one JSON object with a non-empty string `command` and an optional
 * string `cwd`. Other keys are ignored, since later stories add keys such
 * as the timeout. Returns a value for bad input, never throws.
 */
export function parseRequest(text: string, defaultCwd: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'input is not JSON' };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, error: 'input must be one JSON object' };
  }
  const { command, cwd } = data as Record<string, unknown>;
  if (typeof command !== 'string' || command.trim() === '') {
    return { ok: false, error: '"command" must be a non-empty string' };
  }
  if (cwd !== undefined && typeof cwd !== 'string') {
    return { ok: false, error: '"cwd" must be a string' };
  }
  return { ok: true, request: { command, cwd: cwd ?? defaultCwd } };
}

const notStarted: Verdict = { done: false, exitCode: null };

/**
 * Run `command` as one shell string in `cwd`. Resolves, never rejects,
 * for an expected failure. `done` is true only for exit code 0. A command
 * that cannot start, or that a signal kills, has exit code null.
 * The child's output goes to the engine's stderr, so stdout stays free
 * for the verdict.
 */
export function runGate(request: GateRequest): Promise<Verdict> {
  return new Promise((resolve) => {
    try {
      const child = spawn(request.command, {
        cwd: request.cwd,
        shell: true,
        stdio: ['ignore', 2, 2],
      });
      child.on('error', () => resolve(notStarted));
      child.on('close', (code) => resolve({ done: code === 0, exitCode: code }));
    } catch {
      // spawn throws at once for a NUL byte in the command or the cwd.
      resolve(notStarted);
    }
  });
}
