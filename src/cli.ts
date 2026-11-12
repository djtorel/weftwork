// story: e06s01
// Thin shell over the gate library: JSON on stdin, one JSON line on
// stdout, the exit code carries the verdict. Logic lives in gate.ts.
//
// SECURITY: "command" is run as shell code. It must come from the
// owner's plan, never from the agent whose work it checks. The engine
// cannot tell a real check from `true` (threat model T1, C1).
//
// Exit 0: done. Exit 1: not done. Exit 2: input it cannot read.
// e06s04 replaces these codes with one code per terminal state, so
// callers must read the JSON line: "done", the "reason" it names, the
// "command" and the "fingerprint" of the tree taken before the run.
//
// Every verdict is also logged in the git dir (e06s03, src/ledger.ts). The
// ledger stores the command string, so a secret in a declared command is
// stored on disk. Do not put secrets in a command. A passing run that
// cannot be logged is not done, with the reason "no-ledger".
import { parseRequest, runGate } from './gate.ts';

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
  process.exitCode = 2;
}

const input = await readInput();
if (input === null) {
  failUnreadable(`input is over ${maxInputBytes} bytes`);
} else {
  const parsed = parseRequest(input, process.cwd());
  if (parsed.ok) {
    const verdict = await runGate(parsed.request);
    print(verdict);
    process.exitCode = verdict.done ? 0 : 1;
  } else {
    failUnreadable(parsed.error);
  }
}
