// story: e08s01
// Thin shell over the state writer: JSON on stdin, one JSON line on stdout, the
// exit code carries the answer. Logic lives in state-file.ts.
//
// Input: {"file": string, "path": string[], "value": string | number | boolean
// | null}. "file" is named from the root of the repository that holds the
// working directory. Exit 0 when the file was written or already held the
// value; 1 when the engine refused (not a regular file, outside the root,
// invalid YAML, a missing key, a value it could not keep); 2 for input it
// cannot read (not JSON, the wrong shape, not in a git repository).
import { isRecord } from './json.ts';
import { messageOf } from './errors.ts';
import { writeStateField, type FieldValue } from './state-file.ts';
import { repositoryRoot } from './tree.ts';

const maxInputBytes = 1024 * 1024;

type Request = { file: string; path: string[]; value: FieldValue };

/** All of stdin as text, or null when it is larger than maxInputBytes. */
async function readStdin(): Promise<string | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > maxInputBytes) return null;
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function isValue(value: unknown): value is FieldValue {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

/** The request in `text`, or why it cannot be read. */
function parseRequest(text: string): Request | string {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return `stdin is not JSON: ${messageOf(error)}`;
  }
  if (!isRecord(data)) return 'stdin must be a JSON object';
  const { file, path, value } = data;
  if (typeof file !== 'string' || file === '') return '"file" must be a non-empty string';
  if (!Array.isArray(path) || !path.every((key) => typeof key === 'string')) {
    return '"path" must be a list of strings';
  }
  if (!('value' in data) || !isValue(value)) return '"value" must be a string, a number, a boolean or null';
  return { file, path: path as string[], value };
}

function answer(result: object, exitCode: number): void {
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = exitCode;
}

async function main(): Promise<void> {
  const text = await readStdin();
  if (text === null) return answer({ ok: false, error: `stdin is larger than ${maxInputBytes} bytes` }, 2);
  const request = parseRequest(text);
  if (typeof request === 'string') return answer({ ok: false, error: request }, 2);
  let root: string;
  try {
    root = (await repositoryRoot(process.cwd())).toString();
  } catch (error) {
    return answer({ ok: false, error: `${process.cwd()} is not in a git repository: ${messageOf(error)}` }, 2);
  }
  const result = writeStateField(root, request.file, request.path, request.value);
  answer(result, result.ok ? 0 : 1);
}

await main();
