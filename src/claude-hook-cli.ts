// story: e07s01, e07s02
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
// throw, and SIGTERM or SIGINT (which kill the command's process group first).
//
// Fail-open residual: the host treats any other exit code, a hook that
// outlives its timeout and a crash before this code runs (a missing file, a
// Node that is too old) as a non-blocking error, and the stop goes ahead.
// SIGKILL cannot be caught either. Nothing in this file can close that gap;
// the live check in e07s04 is the detector.
import {
  blockStop,
  failClosed,
  hookAnswer,
  hookRequest,
  maxHookInputBytes,
  parseHookInput,
  projectDir,
  readHookInput,
  stdinDeadlineMs,
  type HookOutput,
} from './claude-hook.ts';
import { runEngine } from './engine.ts';

const controller = new AbortController();

// The host's timeout kill, or an owner's Ctrl-C. Abort the engine, so the
// command's process group dies with the hook, and release stdin, so a wait for
// input ends at once.
function terminate(): void {
  controller.abort();
  process.stdin.destroy();
}
process.once('SIGTERM', terminate);
process.once('SIGINT', terminate);

function terminated(): HookOutput {
  return blockStop('terminated before it could check');
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
  const text = await readHookInput(process.stdin, maxHookInputBytes, stdinDeadlineMs);
  if (controller.signal.aborted) {
    return terminated();
  }
  if (!text.ok) {
    return blockStop(`unreadable hook input: ${text.error}`);
  }
  const input = parseHookInput(text.text);
  if (!input.ok) {
    return blockStop(`unreadable hook input: ${input.error}`);
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
