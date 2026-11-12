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

type StdinEvent = { kind: 'chunk'; chunk: Buffer } | { kind: 'end' | 'error' | 'abort' };

/** Listen to stdin and the abort, and feed each event to `feed`. Returns the
 * function that stops listening. */
function listenStdin(signal: AbortSignal, feed: (event: StdinEvent) => void): () => void {
  const stdin = process.stdin;
  const onData = (chunk: Buffer) => feed({ kind: 'chunk', chunk });
  const onEnd = () => feed({ kind: 'end' });
  const onError = () => feed({ kind: 'error' });
  const onAbort = () => feed({ kind: 'abort' });
  stdin.on('data', onData).on('end', onEnd).on('error', onError);
  signal.addEventListener('abort', onAbort, { once: true });
  return () => {
    stdin.off('data', onData).off('end', onEnd).off('error', onError);
    signal.removeEventListener('abort', onAbort);
  };
}

/**
 * Feed stdin events and the abort to `step`. `step` returns the final result,
 * or null to keep reading. A signal that has already aborted resolves at once
 * (F4). Resolves, never rejects.
 */
function readEvents(signal: AbortSignal, step: (event: StdinEvent) => Read | null): Promise<Read> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve({ ok: false, reason: 'aborted' });
      return;
    }
    let stop: () => void = () => undefined;
    stop = listenStdin(signal, (event) => {
      const result = step(event);
      if (result !== null) {
        stop();
        if (!result.ok) {
          process.stdin.destroy();
        }
        resolve(result);
      }
    });
  });
}

/** Read stdin as text, or the reason it could not be read. Never rejects. */
function readInput(signal: AbortSignal): Promise<Read> {
  const chunks: Buffer[] = [];
  let size = 0;
  return readEvents(signal, (event) => {
    if (event.kind === 'chunk') {
      size += event.chunk.length;
      if (size > maxInputBytes) {
        return { ok: false, reason: 'too-large' };
      }
      chunks.push(event.chunk);
      return null;
    }
    if (event.kind === 'end') {
      return { ok: true, text: Buffer.concat(chunks).toString('utf8') };
    }
    return { ok: false, reason: event.kind === 'abort' ? 'aborted' : 'unreadable' };
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
if (read.ok) {
  const parsed = parseRequest(read.text, process.cwd());
  if (parsed.ok) {
    const answer = await runEngine(parsed.request, controller.signal);
    print(answer);
    process.exitCode = exitCodes[answer.state];
  } else {
    failUnreadable(parsed.error);
  }
} else if (read.reason === 'aborted') {
  // Nothing ran and no command is known, so nothing is logged.
  print({ done: false, exitCode: null, reason: 'killed', state: 'killed' });
  process.exitCode = exitCodes.killed;
} else {
  failUnreadable(
    read.reason === 'too-large'
      ? `input is over ${maxInputBytes} bytes`
      : 'input could not be read',
  );
}
