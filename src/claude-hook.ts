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
import { parseRequest, type GateRequest, type Reason } from './gate.ts';
import { isRecord } from './json.ts';
import { isAbsolute } from 'node:path';

/** The one exit code the host reads as "block the stop". Any other code is a
 * non-blocking error and the stop goes ahead. */
export const hostBlockExitCode = 2;

/** How long the engine lets the declared command run. */
export const engineTimeoutMs = 600000;

/** The `timeout` for the hook entry in the host's settings, in seconds. A hook
 * that reaches the host's timeout is cancelled and the stop goes ahead, so this
 * must stay above the engine's: the engine answers first, and the 60 s margin
 * covers the fingerprint, the ledger write and the kill. e07s03 writes it. */
export const hookTimeoutSeconds = 660;

export type HookOutput = { exitCode: number; stdout: string; stderr: string };

export type HookInput = { ok: true } | { ok: false; error: string };

export type ProjectDir = { ok: true; dir: string } | { ok: false; error: string };

export type HookRequest = { ok: true; request: GateRequest } | { ok: false; error: string };

/** Block the stop. Claude reads stderr as the reason to keep working. */
export function blockStop(message: string): HookOutput {
  return { exitCode: hostBlockExitCode, stdout: '', stderr: `weftwork: ${message}\n` };
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

/** What to tell the agent, by why the run failed. Every line blocks the stop:
 * a fault weftwork cannot fix is still not done, and the host's cap on
 * consecutive blocks ends the loop. */
function failedLine(reason: Reason): string {
  switch (reason) {
    case 'exit-nonzero':
    case 'signal':
      return 'Make that command pass before you stop.';
    case 'timeout':
      return 'The command ran past the time limit. Make it finish sooner, or tell the owner.';
    case 'tree-changed':
      return (
        'The command passed but changed the working tree, so the result is not trusted. ' +
        'Make it leave the tree as it found it.'
      );
    case 'no-tree':
      return couldNotCheck('the working tree could not be fingerprinted');
    case 'no-ledger':
      return couldNotCheck('the ledger could not be read or written');
    case 'not-started':
      return couldNotCheck('the command could not be started');
    case 'not-run':
      return couldNotCheck('the command was not run');
    case 'killed':
    case 'passed':
      // Not reasons for a `failed` state; if one ever arrives, still block.
      return couldNotCheck(`the run ended with reason ${reason}`);
  }
}

/** The one answer that blocks a run the engine reported: the command failed. */
function blockFailed(answer: Answer): HookOutput {
  return blockStop(
    `not done (failed, ${answer.reason}): ${answer.command}\n${failedLine(answer.reason)}`,
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
