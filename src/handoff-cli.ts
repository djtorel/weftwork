// story: e08s03
// Thin shell over the handoff writer: JSON on stdin, one JSON line on stdout,
// the exit code carries the answer. Logic lives in handoff.ts.
//
// Input: {"next_skill": string, "branch": string, "note": string,
// "next_epic"?: string | null, "next_story"?: string | null,
// "files"?: string[]}. It always writes the handoff block of specs/state.yaml
// under the root of the repository that holds the working directory; the
// engine adds written_at and uncommitted. Exit 0 when the block was written or
// already held the value; 1 when the engine refused (a missing or bad field, a
// file that does not exist, a state file it cannot read or keep); 2 for input
// it cannot read (too large, not UTF-8, not a JSON object, not in a git
// repository).
import { messageOf } from './errors.ts';
import { writeHandoff } from './handoff.ts';
import { isRecord } from './json.ts';
import { strictUtf8 } from './regular-file.ts';
import { repositoryRoot } from './tree.ts';

const maxInputBytes = 1024 * 1024;

/** All of stdin, or null when it is larger than maxInputBytes. */
async function readStdin(): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    // No encoding is set on stdin, so every chunk is a Buffer; the iterator is typed any.
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > maxInputBytes) return null;
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function printAnswer(result: object, exitCode: number): void {
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = exitCode;
}

async function main(): Promise<void> {
  const bytes = await readStdin();
  if (bytes === null) return printAnswer({ ok: false, error: `stdin is larger than ${maxInputBytes} bytes` }, 2);
  const text = strictUtf8(bytes);
  if (text === null) return printAnswer({ ok: false, error: 'stdin is not valid UTF-8' }, 2);
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch (error) {
    return printAnswer({ ok: false, error: `stdin is not JSON: ${messageOf(error)}` }, 2);
  }
  if (!isRecord(input)) return printAnswer({ ok: false, error: 'stdin must be a JSON object' }, 2);
  let root: string;
  try {
    root = (await repositoryRoot(process.cwd())).toString();
  } catch (error) {
    return printAnswer({ ok: false, error: `${process.cwd()} is not in a git repository: ${messageOf(error)}` }, 2);
  }
  const result = await writeHandoff(root, input);
  printAnswer(result, result.ok ? 0 : 1);
}

await main();
