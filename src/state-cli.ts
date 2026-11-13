// story: e08s01
// story: e08s02
// Thin shell over the field table: JSON on stdin, one JSON line on stdout, the
// exit code carries the answer. Logic lives in state-fields.ts.
//
// Input: {"op": "set", "key": string, "value": unknown} or {"op": "get"}.
// It always works on specs/state.yaml under the root of the repository that
// holds the working directory; "key" is a dotted field name from
// docs/STATE.md. Exit 0 when the file was written, already held the value, or
// was read; 1 when the engine refused (a key outside the table, a bad value,
// a file it cannot read or keep); 2 for input it cannot read (not JSON, the
// wrong shape, an unknown op, not in a git repository).
import { isRecord } from './json.ts';
import { messageOf } from './errors.ts';
import { strictUtf8 } from './regular-file.ts';
import { readStateFields, setStateField } from './state-fields.ts';
import { repositoryRoot } from './tree.ts';

const maxInputBytes = 1024 * 1024;

type Request = { op: 'set'; key: string; value: unknown } | { op: 'get' };

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

/** The request in `text`, or why it cannot be read. The value of a set is
 * checked by the field table, so a bad value is a refusal, not bad input. */
function parseRequest(text: string): Request | string {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return `stdin is not JSON: ${messageOf(error)}`;
  }
  if (!isRecord(data)) return 'stdin must be a JSON object';
  const keys = Object.keys(data).sort().join(',');
  if (data.op === 'get') return keys === 'op' ? { op: 'get' } : '"get" takes no other field';
  if (data.op !== 'set') return '"op" must be "set" or "get"';
  if (keys !== 'key,op,value') return '"set" takes exactly "op", "key" and "value"';
  if (typeof data.key !== 'string') return '"key" must be a string';
  return { op: 'set', key: data.key, value: data.value };
}

function printAnswer(result: object, exitCode: number): void {
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = exitCode;
}

async function main(): Promise<void> {
  const bytes = await readStdin();
  if (bytes === null) return printAnswer({ ok: false, error: `stdin is larger than ${maxInputBytes} bytes` }, 2);
  // Strict, as the file read is: a lossy decode would write U+FFFD to disk (review 4, B2).
  const text = strictUtf8(bytes);
  if (text === null) return printAnswer({ ok: false, error: 'stdin is not valid UTF-8' }, 2);
  const request = parseRequest(text);
  if (typeof request === 'string') return printAnswer({ ok: false, error: request }, 2);
  let root: string;
  try {
    root = (await repositoryRoot(process.cwd())).toString();
  } catch (error) {
    return printAnswer({ ok: false, error: `${process.cwd()} is not in a git repository: ${messageOf(error)}` }, 2);
  }
  const result = request.op === 'get' ? readStateFields(root) : setStateField(root, request.key, request.value);
  printAnswer(result, result.ok ? 0 : 1);
}

await main();
