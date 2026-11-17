// story: e08s02, e08s04
// The fields of the engine's state file that the engine owns (docs/STATE.md).
// The file is state.yaml in the engine's folder, <git dir>/weftwork (see
// weftworkDir in ledger.ts): untracked and one per worktree. The engine sets
// only these fields, each one text or null on one line, and refuses every
// other key, so anything else in the file stays byte for byte.
// setStateField is the one write function the CLIs call; writeStateField of
// state-file.ts does the format-preserving edit.
import { lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMissing, messageOf, type Failure } from '../shared/errors.ts';
import { isRecord } from '../shared/json.ts';
import { readRegularFile } from '../shared/regular-file.ts';
import { maxStateBytes, parseOne, type WriteField } from './state-file.ts';
import { insideRoot, writeStateField } from './state-write.ts';

/** The state file, named from the engine's folder (`dir` below). */
export const stateFile = 'state.yaml';

/** The keys the engine owns, by dotted name. Keep in step with docs/STATE.md. */
export const stateFields: readonly string[] = ['active_flow', 'active_epic', 'active_story', 'phase', 'vcs.branch'];

/** The longest value, in code points. */
const maxValueLength = 200;

export type StateFields = { ok: true; fields: Record<string, string | null> } | Failure;

/** Why the value cannot be set, or null when it can. A value is null or text
 * of one line, at most maxValueLength code points. Only the type is checked:
 * id patterns and phase names are workflow naming, not engine rules. */
export function valueProblem(value: unknown): string | null {
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

/** The text of a new state file: every documented field null, and a null
 * handoff, since the handoff writer replaces the value of an existing key. */
export function emptyStateText(): string {
  const top = stateFields.filter((key) => !key.includes('.')).map((key) => `${key}: null`);
  const nested = new Map<string, string[]>();
  for (const key of stateFields.filter((name) => name.includes('.'))) {
    const [parent, child] = key.split('.') as [string, string];
    nested.set(parent, [...(nested.get(parent) ?? []), `  ${child}: null`]);
  }
  const blocks = [...nested].flatMap(([parent, children]) => [`${parent}:`, ...children]);
  return ['---', ...top, ...blocks, 'handoff: null', ''].join('\n');
}

/** False only when the state file is not there (ENOENT). A symlink there, or
 * a path that cannot be checked (the folder is a file, no permission), counts
 * as there, so the writer's checks refuse it with a reason instead of this
 * reading it as absent. */
export function stateExists(dir: string): boolean {
  try {
    lstatSync(join(dir, stateFile));
    return true;
  } catch (error) {
    return !isMissing(error);
  }
}

/** Create `dir` (mode 0700) and an empty state file in it (mode 0600) when the
 * file is missing; a fresh worktree has none. Never replaces a file: the
 * create is exclusive, so a file made at the same moment is kept. Null, or a
 * failure that names what could not be made. */
export function ensureStateFile(dir: string): Failure | null {
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(join(dir, stateFile), emptyStateText(), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
      return { ok: false, error: `${stateFile} cannot be created in ${dir}: ${messageOf(error)}` };
    }
  }
  return null;
}

/** Set one documented field of the state file in `dir`, keeping every other
 * byte; the file is created first when it is missing. A refused field writes
 * nothing. */
export function setStateField(dir: string, key: string, value: unknown): WriteField {
  const refused = checkStateField(key, value);
  if (refused !== null) return refused;
  const made = ensureStateFile(dir);
  if (made !== null) return made;
  // checkStateField let only null and strings through.
  return writeStateField(dir, stateFile, key.split('.'), value as string | null);
}

/** The data of the state file `file` under `root`, read with the writer's
 * checks: a regular file inside the root and outside .git, not a symlink, of at
 * most maxStateBytes, one YAML document of plain data. An alias bomb is a
 * refusal, not a throw (e08s02 security review F1, F2). */
export function readStateData(root: string, file: string): { ok: true; data: unknown } | Failure {
  const inside = insideRoot(root, file);
  if (!inside.ok) return inside;
  const read = readRegularFile(inside.path, { follow: false, maxBytes: maxStateBytes });
  if (!read.ok) return read;
  if (read.file === null) return { ok: false, error: `${file} does not exist` };
  const parsed = parseOne(read.file.text);
  return parsed.ok ? { ok: true, data: parsed.data } : { ok: false, error: `${file}: ${parsed.error}` };
}

/** The documented fields of the state file in `dir`, and nothing else, read
 * with the writer's checks (readStateData). A missing file reads as every
 * field null and is not created. A missing field, or one that is not text or
 * null, is a failure that names it. */
export function readStateFields(dir: string): StateFields {
  if (!stateExists(dir)) return { ok: true, fields: Object.fromEntries(stateFields.map((key) => [key, null])) };
  const read = readStateData(dir, stateFile);
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
