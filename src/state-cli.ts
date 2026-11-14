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
import { printAnswer, readJsonObject } from './cli-io.ts';
import { messageOf } from './errors.ts';
import { readStateFields, setStateField } from './state-fields.ts';
import { repositoryRoot } from './tree.ts';

type Request = { op: 'set'; key: string; value: unknown } | { op: 'get' };

/** The request in the JSON object `data`, or why it is not one. The value of
 * a set is checked by the field table, so a bad value is a refusal, not bad
 * input. */
function parseRequest(data: Record<string, unknown>): Request | string {
  const keys = Object.keys(data).sort().join(',');
  if (data.op === 'get') return keys === 'op' ? { op: 'get' } : '"get" takes no other field';
  if (data.op !== 'set') return '"op" must be "set" or "get"';
  if (keys !== 'key,op,value') return '"set" takes exactly "op", "key" and "value"';
  if (typeof data.key !== 'string') return '"key" must be a string';
  return { op: 'set', key: data.key, value: data.value };
}

async function main(): Promise<void> {
  // readJsonObject decodes strictly, as the file read does (review 4, B2).
  const json = await readJsonObject();
  if (json.kind === 'refused') return printAnswer({ ok: false, error: json.error }, 2);
  const request = parseRequest(json.input);
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
