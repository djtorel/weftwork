// story: e08s02
// The fields of specs/state.yaml that the engine owns (docs/STATE.md). The
// engine sets only these, each one text or null on one line, and refuses every
// other key, so waivers, metrics and the owner's settings stay byte for byte.
// setStateField is the one write function the CLIs call; writeStateField of
// state-file.ts does the format-preserving edit.
import type { Failure } from './errors.ts';
import { isRecord } from './json.ts';
import { readRegularFile } from './regular-file.ts';
import { insideRoot, maxStateBytes, parseOne, writeStateField, type WriteField } from './state-file.ts';

/** The state file, named from the repository root. */
export const stateFile = 'specs/state.yaml';

/** The keys the engine owns, by dotted name. Keep in step with docs/STATE.md. */
export const stateFields: readonly string[] = ['active_flow', 'active_epic', 'active_story', 'phase', 'vcs.branch'];

/** The longest value, in code points. */
const maxValueLength = 200;

export type StateFields = { ok: true; fields: Record<string, string | null> } | Failure;

/** Why the value cannot be set, or null when it can. A value is null or text
 * of one line, at most maxValueLength code points. Only the type is checked:
 * id patterns and phase names are workflow naming, not engine rules. */
function valueProblem(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') return 'must be text or null';
  if (/[\n\r]/.test(value)) return 'must be one line';
  if ([...value].length > maxValueLength) return `must be ${maxValueLength} characters or fewer`;
  return null;
}

/** Null when the engine may set `key` to `value`; otherwise a failure that
 * names the key. */
export function checkStateField(key: string, value: unknown): Failure | null {
  if (!stateFields.includes(key)) {
    return { ok: false, error: `${JSON.stringify(key)} is not a field the engine writes (it writes ${stateFields.join(', ')})` };
  }
  const problem = valueProblem(value);
  return problem === null ? null : { ok: false, error: `${JSON.stringify(key)} ${problem}` };
}

/** Set one documented field of specs/state.yaml under `root`, keeping every
 * other byte. A refused field writes nothing. */
export function setStateField(root: string, key: string, value: unknown): WriteField {
  const refused = checkStateField(key, value);
  if (refused !== null) return refused;
  // checkStateField let only null and strings through.
  return writeStateField(root, stateFile, key.split('.'), value as string | null);
}

/** The data of the state file `file` under `root`, read with the writer's
 * checks: a regular file inside the root and outside .git, not a symlink, of at
 * most maxStateBytes, one YAML document of plain data. An alias bomb is a
 * refusal, not a throw (e08s02 security review F1, F2). */
function readStateData(root: string, file: string): { ok: true; data: unknown } | Failure {
  const inside = insideRoot(root, file);
  if (!inside.ok) return inside;
  const read = readRegularFile(inside.path, { follow: false, maxBytes: maxStateBytes });
  if (!read.ok) return read;
  if (read.file === null) return { ok: false, error: `${file} does not exist` };
  const parsed = parseOne(read.file.text);
  return parsed.ok ? { ok: true, data: parsed.data } : { ok: false, error: `${file}: ${parsed.error}` };
}

/** The documented fields of specs/state.yaml under `root`, and nothing else,
 * read with the writer's checks (readStateData). A missing field, or one that
 * is not text or null, is a failure that names it. */
export function readStateFields(root: string): StateFields {
  const read = readStateData(root, stateFile);
  if (!read.ok) return read;
  const data = read.data;
  const fields: Record<string, string | null> = {};
  for (const key of stateFields) {
    let node: unknown = data;
    for (const part of key.split('.')) node = isRecord(node) && Object.hasOwn(node, part) ? node[part] : undefined;
    if (node === undefined) return { ok: false, error: `${stateFile} has no ${JSON.stringify(key)}` };
    if (node !== null && typeof node !== 'string') return { ok: false, error: `${stateFile}: ${JSON.stringify(key)} is not text or null` };
    fields[key] = node;
  }
  return { ok: true, fields };
}
