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
// SIGTERM and SIGINT stop the declared command and its children, log it, and
// end with exit 6. The command runs in its own process group, so it gets no
// Ctrl-C of its own. Node no longer exits on those signals once a listener is
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

/** Read stdin as text, or null when it holds more than the cap. */
async function readInput(): Promise<string | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > maxInputBytes) {
      return null;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
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

const input = await readInput();
if (input === null) {
  failUnreadable(`input is over ${maxInputBytes} bytes`);
} else {
  const parsed = parseRequest(input, process.cwd());
  if (parsed.ok) {
    const answer = await runEngine(parsed.request, controller.signal);
    print(answer);
    process.exitCode = exitCodes[answer.state];
  } else {
    failUnreadable(parsed.error);
  }
}
