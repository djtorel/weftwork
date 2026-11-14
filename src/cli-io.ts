// story: e08s01, e08s03
// Input and output for the thin JSON CLIs (state-cli.ts, handoff-cli.ts): all
// of stdin up to a byte limit, read as strict UTF-8 and parsed as one JSON
// object, and one JSON line on stdout with the exit code. A limit is a
// refusal, not a cut, so a CLI answers with one line instead of writing half a
// file. Shared so the two CLIs read input the same way (request-review round
// 3, B6).
import { messageOf } from './errors.ts';
import { isRecord } from './json.ts';
import { strictUtf8 } from './regular-file.ts';

/** The most a CLI reads from stdin. */
const maxInputBytes = 1024 * 1024;

/** A JSON object read from stdin, or why stdin cannot be read as one. */
type JsonRequest = { kind: 'input'; input: Record<string, unknown> } | { kind: 'refused'; error: string };

/** All of stdin, or null when it is larger than `maxBytes`. */
async function readStdin(maxBytes: number): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    // No encoding is set on stdin, so every chunk is a Buffer; the iterator is typed any.
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > maxBytes) return null;
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

/** Stdin as one JSON object: at most maxInputBytes, strict UTF-8 (a lossy
 * decode would write U+FFFD to disk), and JSON whose top level is an object. */
export async function readJsonObject(): Promise<JsonRequest> {
  const bytes = await readStdin(maxInputBytes);
  if (bytes === null) return { kind: 'refused', error: `stdin is larger than ${maxInputBytes} bytes` };
  const text = strictUtf8(bytes);
  if (text === null) return { kind: 'refused', error: 'stdin is not valid UTF-8' };
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch (error) {
    return { kind: 'refused', error: `stdin is not JSON: ${messageOf(error)}` };
  }
  return isRecord(input) ? { kind: 'input', input } : { kind: 'refused', error: 'stdin must be a JSON object' };
}

/** Print `result` as one JSON line and set the exit code. */
export function printAnswer(result: object, exitCode: number): void {
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = exitCode;
}
