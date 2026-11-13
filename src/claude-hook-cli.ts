// story: e07s01, e07s02, e07s04
// Thin shell for the Claude Code Stop hook: the host's JSON on stdin, the
// declared command as the one argument after `--`, the host's answer on
// stdout and stderr and in the exit code. Logic lives in claude-hook.ts.
//
// SECURITY: the command is shell code from the owner's hook entry, never
// from the agent whose work it checks (threat model T1). It runs in
// CLAUDE_PROJECT_DIR, not in the Stop input's `cwd`, which follows the
// agent's `cd`. Exit 2 is the only block.
//
// Every fault of this adapter ends in exit 2: bad arguments, a bad project
// directory, input that is too large, empty, unreadable or never ends, a
// throw, an error nobody handles, SIGTERM or SIGINT (which kill the command's
// process group first), and a run that has not finished by `hookDeadlineMs`
// after the start. The last two leave through `leave`, because work that
// cannot be aborted (a ledger read stuck on a FIFO) would otherwise keep the
// process alive until the host's own timeout, which lets the stop go ahead.
//
// Fail-open residual: the host treats any exit code but 2 (an uncaught error
// before the handlers are installed is exit 1) as a non-blocking error, and
// the stop goes ahead. So does a crash before this code runs (a missing file,
// a Node that is too old), and so does a signal that arrives before the
// handlers are installed, in the first moments of start-up. Only SIGTERM and
// SIGINT are handled: SIGHUP and SIGQUIT take Node's default action. SIGKILL
// cannot be caught either. Nothing in this file can close that gap; the live
// check in e07s04 is the detector.
//
// Each call that gets past the arguments writes the call record
// (last-call.ts) before it reads the input, so the live check can tell a hook
// that runs from one that is only registered. A failed write changes nothing.
import { writeSync } from 'node:fs';
import {
  blockStop,
  failClosed,
  faultOutput,
  hookAnswer,
  hookDeadline,
  hookRequest,
  maxHookInputBytes,
  parseHookInput,
  projectDir,
  readHookInput,
  signalGraceMs,
  stdinDeadlineMs,
  type HookOutput,
} from './claude-hook.ts';
import { runEngine } from './engine.ts';
import { lastCallPath, writeLastCall } from './last-call.ts';

const controller = new AbortController();

/** Write the block and leave now. `process.exit` does not wait for work that
 * cannot be aborted, and `writeSync` is not cut off by it. If the host has
 * closed the pipe there is nobody to tell, so only the exit code is left. */
function leave(output: HookOutput): never {
  try {
    writeSync(1, output.stdout);
    writeSync(2, output.stderr);
  } catch {
    // The host closed the pipe.
  }
  process.exit(output.exitCode);
}

function terminated(): HookOutput {
  return blockStop('terminated before it could check');
}

// The host's timeout kill, or an owner's Ctrl-C. Abort the engine, so the
// command's process group dies with the hook, and release stdin, so a wait for
// input ends at once. If the work cannot be aborted, leave after the grace
// period. The handlers use `on`, not `once`: with `once` a second signal would
// reach Node's default action and end the process by signal, not by exit 2.
function terminate(): void {
  controller.abort();
  process.stdin.destroy();
  setTimeout(() => leave(terminated()), signalGraceMs).unref();
}

// The deadline of the whole hook, counted from the start as the host counts.
function expire(): void {
  controller.abort();
  leave(blockStop('ran out of time before it could check'));
}

// A fault outside the awaited chain: an event with no listener, a throw in a
// timer or a callback, a rejection nobody handles.
function fault(error: unknown): never {
  controller.abort();
  return leave(faultOutput(error));
}

process.on('SIGTERM', terminate);
process.on('SIGINT', terminate);
process.on('uncaughtException', fault);
process.on('unhandledRejection', fault);
setTimeout(expire, hookDeadline(process.env)).unref();

/** The block to answer when the host's input cannot be used, or null when it
 * can. A signal that arrived while waiting wins over the input's fault. */
async function refusedInput(): Promise<HookOutput | null> {
  const text = await readHookInput(process.stdin, maxHookInputBytes, stdinDeadlineMs);
  if (controller.signal.aborted) {
    return terminated();
  }
  const input = text.ok ? parseHookInput(text.text) : text;
  return input.ok ? null : blockStop(`unreadable hook input: ${input.error}`);
}

/** Record that the host called this hook, for the live check. Both calls never
 * throw, and the result is ignored: the record must not change the answer. */
async function recordCall(dir: string, command: string): Promise<void> {
  const path = await lastCallPath(dir);
  if (path !== null) {
    await writeLastCall(path, { at: new Date().toISOString(), cliPath: import.meta.filename, command });
  }
}

async function run(args: string[]): Promise<HookOutput> {
  const dir = projectDir(process.env);
  if (!dir.ok) {
    return blockStop(dir.error);
  }
  const request = hookRequest(args, dir.dir);
  if (!request.ok) {
    return blockStop(request.error);
  }
  await recordCall(dir.dir, request.request.command);
  const refused = await refusedInput();
  if (refused !== null) {
    return refused;
  }
  const answer = await runEngine(request.request, controller.signal);
  // An aborted run answers `killed`, which allows the stop. A signal is not a
  // result, so block.
  return controller.signal.aborted ? terminated() : hookAnswer(answer);
}

const output = await failClosed(() => run(process.argv.slice(2)));
process.stdout.write(output.stdout);
process.stderr.write(output.stderr);
process.exitCode = output.exitCode;
