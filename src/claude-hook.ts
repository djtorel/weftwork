// story: e07s01, e07s02
// The Claude Code adapter: the host's Stop input in, the host's answer out.
// Exit 2 is the only block. Every other state allows the stop, with a
// warning for the user. Only `done` is silent, and no text for any other
// state says the work is done.
//
// The agent must not choose where the owner's command runs. The Stop input's
// `cwd` follows the agent's `cd` (Claude Code hooks docs, read 2026-11-12),
// so it is never used. The directory is CLAUDE_PROJECT_DIR, which the host
// sets and the agent cannot change.
import type { Answer } from './engine.ts';
import { messageOf } from './errors.ts';
import { parseRequest, type GateRequest, type Reason } from './gate.ts';
import { isRecord } from './json.ts';
import { isAbsolute } from 'node:path';
import type { Readable } from 'node:stream';

/** The one exit code the host reads as "block the stop". Any other code is a
 * non-blocking error and the stop goes ahead. */
export const hostBlockExitCode = 2;

/** How long the engine lets the declared command run. It has the same value as
 * `defaultTimeoutMs` in gate.ts on purpose: the hook timeout below is written
 * against this number, so a change to the engine's default must not move it. */
export const engineTimeoutMs = 600000;

/** The `timeout` for the hook entry in the host's settings, in seconds. A hook
 * that reaches the host's timeout is cancelled, its output is dropped and the
 * stop goes ahead. The host's clock starts when the hook starts, but the
 * engine's 600 s starts only when the command is spawned, after Node's start,
 * the input (up to `stdinDeadlineMs`) and the first fingerprint. So the 60 s
 * above the engine's timeout is not a promise on its own: `hookDeadlineMs`
 * enforces it. e07s03 writes this value into the settings. */
export const hookTimeoutSeconds = 660;

/** The CLI blocks by itself this long before the host's timeout, so a hang it
 * cannot see (a ledger read stuck on a FIFO, a slow fingerprint) ends in our
 * block, not in the host's silent cut-off. */
export const hookDeadlineReserveMs = 15000;

/** When the CLI gives up, counted from its own start, as the host counts. */
export const hookDeadlineMs = hookTimeoutSeconds * 1000 - hookDeadlineReserveMs;

/** How long a signalled CLI waits for work that cannot be aborted before it
 * leaves with exit 2 anyway. */
export const signalGraceMs = 2000;

/** The deadline in force: the built-in one, or a shorter one from
 * WEFTWORK_HOOK_DEADLINE_MS (for tests). A longer or unusable value is ignored,
 * so the variable can only make the hook block sooner, never later. */
export function hookDeadline(env: Record<string, string | undefined>): number {
  const asked = Number(env.WEFTWORK_HOOK_DEADLINE_MS);
  return Number.isInteger(asked) && asked > 0 && asked < hookDeadlineMs ? asked : hookDeadlineMs;
}

export type HookOutput = { exitCode: number; stdout: string; stderr: string };

export type HookInput = { ok: true } | { ok: false; error: string };

export type HookText = { ok: true; text: string } | { ok: false; error: string };

/** The Stop input is a few hundred bytes. Same cap as the engine CLI's stdin. */
export const maxHookInputBytes = 1024 * 1024;

/** How long the host may take to end its input. The Stop input is written at
 * once, so a longer wait means a host that never closes stdin. */
export const stdinDeadlineMs = 10000;

export type ProjectDir = { ok: true; dir: string } | { ok: false; error: string };

export type HookRequest = { ok: true; request: GateRequest } | { ok: false; error: string };

/** Block the stop. Claude reads stderr as the reason to keep working. */
export function blockStop(message: string): HookOutput {
  return { exitCode: hostBlockExitCode, stdout: '', stderr: `weftwork: ${message}\n` };
}

/** Collect the stream's bytes and refuse more than `maxBytes`. Bytes are
 * counted and decoded once, so a character split across two chunks is read
 * whole. Returning from the loop destroys the stream. Node's async iterator
 * also leaves an error listener on the stream, so an error after the result is
 * not uncaught (that would be exit 1, which the host reads as "go ahead"); a
 * test pins this, because nothing here adds a listener of its own. */
async function collect(stream: Readable, maxBytes: number): Promise<HookText> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.from(chunk); // the stream library types `chunk` as any
    size += bytes.length;
    if (size > maxBytes) {
      return { ok: false, error: `input is too large (over ${maxBytes} bytes)` };
    }
    chunks.push(bytes);
  }
  return { ok: true, text: Buffer.concat(chunks).toString('utf8') };
}

/** A refusal that arrives after `ms`, and a way to cancel its timer. */
function deadlineAfter(ms: number): { late: Promise<HookText>; cancel: () => void } {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<HookText>((resolve) => {
    const error = `input did not end within ${ms} ms`;
    timer = setTimeout(() => resolve({ ok: false, error }), ms);
  });
  return { late, cancel: () => clearTimeout(timer) };
}

/** Read the host's input: at most `maxBytes`, ended within `deadlineMs`. It
 * never rejects, and it always releases the stream, so an open stdin cannot
 * keep the process alive. */
export async function readHookInput(
  stream: Readable,
  maxBytes: number,
  deadlineMs: number,
): Promise<HookText> {
  const { late, cancel } = deadlineAfter(deadlineMs);
  try {
    return await Promise.race([collect(stream, maxBytes), late]);
  } catch (error) {
    return { ok: false, error: `input could not be read: ${messageOf(error)}` };
  } finally {
    cancel();
    stream.destroy();
  }
}

/** Run `work`. A throw or a rejection becomes a block, so no path of the
 * adapter ends in an exit code the host reads as "go ahead": only exit 2
 * blocks, and an uncaught error exits 1. */
export async function failClosed(work: () => Promise<HookOutput>): Promise<HookOutput> {
  try {
    return await work();
  } catch (error) {
    return faultOutput(error);
  }
}

/** The block for a fault of the adapter itself. */
export function faultOutput(error: unknown): HookOutput {
  return blockStop(`adapter fault: ${messageOf(error)}`);
}

/** Check that the Stop input is a JSON object. No field is read from it:
 * `cwd` follows the agent and `last_assistant_message` is the agent's own
 * text, so neither may steer the gate. */
export function parseHookInput(text: string): HookInput {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: 'input is not JSON' };
  }
  return isRecord(value) ? { ok: true } : { ok: false, error: 'input is not a JSON object' };
}

/** The directory the declared command runs in: CLAUDE_PROJECT_DIR. */
export function projectDir(env: Record<string, string | undefined>): ProjectDir {
  const dir = env.CLAUDE_PROJECT_DIR;
  if (dir === undefined || !isAbsolute(dir)) {
    return { ok: false, error: 'CLAUDE_PROJECT_DIR is not set to an absolute path' };
  }
  return { ok: true, dir };
}

/** The request for the one command after `--`, checked by the same rules as
 * the engine CLI (a blank command is refused). */
export function hookRequest(args: string[], dir: string): HookRequest {
  const command = args.length === 2 && args[0] === '--' ? args[1] : undefined;
  if (command === undefined) {
    return { ok: false, error: "usage: claude-hook-cli.ts -- '<declared command>'" };
  }
  // parseRequest takes the engine CLI's JSON text, so one rule refuses a blank
  // command on both paths and the two cannot drift.
  return parseRequest(JSON.stringify({ command, timeoutMs: engineTimeoutMs }), dir);
}

function warn(message: string): HookOutput {
  return { exitCode: 0, stdout: JSON.stringify({ systemMessage: message }), stderr: '' };
}

function couldNotCheck(what: string): string {
  return `weftwork could not check: ${what}. You cannot fix this; tell the owner.`;
}

const makeItPass = 'Make that command pass before you stop.';

/** What to tell the agent, by why the run failed. Every line blocks the stop:
 * a fault weftwork cannot fix is still not done, and the host's cap on
 * consecutive blocks ends the loop. A reason missing from this table is a type
 * error. `killed` and `passed` are not reasons for a `failed` state; if one
 * ever arrives, it still blocks. */
const failedLines: Record<Reason, string> = {
  'exit-nonzero': makeItPass,
  signal: makeItPass,
  timeout:
    `The command ran past the ${engineTimeoutMs / 1000} s limit. ` +
    'Make it finish sooner, or tell the owner.',
  'tree-changed':
    'The command passed but changed the working tree, so the result is not trusted. ' +
    'Make it leave the tree as it found it.',
  'no-tree': couldNotCheck('the working tree could not be fingerprinted'),
  'no-ledger': couldNotCheck('the passing run could not be recorded in the ledger'),
  'not-started': couldNotCheck('the command could not be started'),
  'not-run': couldNotCheck('the command was not run'),
  killed: couldNotCheck('the run ended with reason killed'),
  passed: couldNotCheck('the run ended with reason passed'),
};

/** The one answer that blocks a run the engine reported: the command failed. */
function blockFailed(answer: Answer): HookOutput {
  return blockStop(
    `not done (failed, ${answer.reason}): ${answer.command}\n${failedLines[answer.reason]}`,
  );
}

/** Map an engine answer to the exit code and output the host reads. */
export function hookAnswer(answer: Answer): HookOutput {
  switch (answer.state) {
    case 'done':
      return { exitCode: 0, stdout: '', stderr: '' };
    case 'failed':
      return blockFailed(answer);
    case 'blocked':
    case 'stalled':
    case 'exhausted':
    case 'killed':
      return warn(`weftwork: not done (${answer.state}): ${answer.detail ?? answer.reason}`);
    case 'overridden':
      return warn(`weftwork: overridden by the owner's record, not done: ${answer.command}`);
  }
}
