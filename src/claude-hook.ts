// story: e07s01
// The Claude Code adapter: the host's Stop input in, the host's answer out.
// Exit 2 is the only block. Every other state allows the stop, with a
// warning for the user. Only `done` is silent, and no text for any other
// state says the work is done.
import type { Answer } from './engine.ts';
import { isRecord } from './json.ts';

export type HookInput = { ok: true; cwd: string } | { ok: false; error: string };

export type HookOutput = { exitCode: number; stdout: string; stderr: string };

/** Read the Stop input for its `cwd` and nothing else. `stop_hook_active` is
 * ignored: the engine's stop rules and the host's cap end a loop, not this
 * hook. */
export function parseHookInput(text: string): HookInput {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: 'input is not JSON' };
  }
  if (!isRecord(value)) {
    return { ok: false, error: 'input is not a JSON object' };
  }
  if (typeof value.cwd !== 'string' || value.cwd === '') {
    return { ok: false, error: 'input has no cwd string' };
  }
  return { ok: true, cwd: value.cwd };
}

function warn(message: string): HookOutput {
  return { exitCode: 0, stdout: JSON.stringify({ systemMessage: message }), stderr: '' };
}

/** Map an engine answer to the exit code and output the host reads. */
export function hookAnswer(answer: Answer): HookOutput {
  switch (answer.state) {
    case 'done':
      return { exitCode: 0, stdout: '', stderr: '' };
    case 'failed':
      return {
        exitCode: 2,
        stdout: '',
        stderr:
          `weftwork: not done (failed, ${answer.reason}): ${answer.command}\n` +
          'Make that command pass before you stop.\n',
      };
    case 'blocked':
    case 'stalled':
    case 'exhausted':
    case 'killed':
      return warn(`weftwork: not done (${answer.state}): ${answer.detail ?? answer.reason}`);
    case 'overridden':
      return warn(`weftwork: overridden by the owner's record, not done: ${answer.command}`);
  }
}
