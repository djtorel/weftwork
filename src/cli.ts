// story: e06s01
// Thin shell over the engine library: JSON on stdin, one JSON line on
// stdout, the exit code carries the state. Logic lives in engine.ts.
//
// SECURITY: "command" is run as shell code. It must come from the
// owner's plan, never from the agent whose work it checks. The engine
// cannot tell a real check from `true` (threat model T1, C1).
//
// One exit code per state (src/states.ts): 0 done, 1 failed (not done, no stop
// rule tripped, a retry is allowed), 2 input it cannot read, 3 blocked, 4
// stalled, 5 exhausted, 6 killed. Only 0 means done. The JSON line holds the
// "state", the verdict ("done", "exitCode", "reason", "command" and the
// "fingerprint" of the tree taken before the run) and, for blocked, stalled
// and exhausted, a "detail".
//
// SIGTERM and SIGINT end the run with exit 6 at any point after the CLI starts.
// While the CLI reads stdin, it answers killed at once and nothing is logged,
// since no command is known. While a declared command runs, the command and its
// children are killed, the run is logged, and the CLI exits 6. The command runs
// in its own process group, so it gets no Ctrl-C of its own. Node no longer exits on those signals once a listener is
// installed, so this file ends by its own exit code. Other signals are not
// handled.
//
// Every verdict is also logged in the git dir (e06s03, src/ledger.ts). The
// ledger stores the command string, so a secret in a declared command is
// stored on disk. Do not put secrets in a command. A passing run that
// cannot be logged is not done, with the reason "no-ledger".
import { runEngine } from './engine.ts';
import { parseRequest } from './gate.ts';
import { badInputExitCode, exitCodes } from './states.ts';

const maxInputBytes = 1024 * 1024;

type Read =
  | { ok: true; text: string }
  | { ok: false; reason: 'too-large' | 'aborted' | 'unreadable' };

/**
 * Read stdin as text. Resolves at once when `signal` aborts (F4), so a signal
 * is not held up by a caller that keeps stdin open. Resolves, never rejects.
 */
function readInput(signal: AbortSignal): Promise<Read> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const stop = (result: Read) => {
      process.stdin.off('data', onData);
      process.stdin.off('end', onEnd);
      process.stdin.off('error', onError);
      signal.removeEventListener('abort', onAbort);
      if (!result.ok) {
        process.stdin.destroy();
      }
      resolve(result);
    };
    const onData = (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxInputBytes) {
        stop({ ok: false, reason: 'too-large' });
      } else {
        chunks.push(chunk);
      }
    };
    const onEnd = () => stop({ ok: true, text: Buffer.concat(chunks).toString('utf8') });
    const onError = () => stop({ ok: false, reason: 'unreadable' });
    const onAbort = () => stop({ ok: false, reason: 'aborted' });
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
    process.stdin.on('data', onData);
    process.stdin.on('end', onEnd);
    process.stdin.on('error', onError);
  });
}

function print(line: object): void {
  process.stdout.write(`${JSON.stringify(line)}\n`);
}

/** Unreadable input: one JSON line with the reason, exit 2. */
function failUnreadable(error: string): void {
  print({ done: false, error });
  process.exitCode = badInputExitCode;
}

const controller = new AbortController();
for (const name of ['SIGTERM', 'SIGINT'] as const) {
  process.on(name, () => controller.abort());
}

const read = await readInput(controller.signal);
if (!read.ok && read.reason === 'aborted') {
  // Nothing ran and no command is known, so nothing is logged.
  print({ done: false, exitCode: null, reason: 'killed', state: 'killed' });
  process.exitCode = exitCodes.killed;
} else if (!read.ok) {
  failUnreadable(
    read.reason === 'too-large'
      ? `input is over ${maxInputBytes} bytes`
      : 'input could not be read',
  );
} else {
  const parsed = parseRequest(read.text, process.cwd());
  if (parsed.ok) {
    const answer = await runEngine(parsed.request, controller.signal);
    print(answer);
    process.exitCode = exitCodes[answer.state];
  } else {
    failUnreadable(parsed.error);
  }
}
