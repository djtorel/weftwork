// story: e08s01
// The format-preserving writer for state files: set one scalar field and keep
// every other byte. Global scripts rewrote these files through a YAML dump,
// which dropped the leading ---, the comments and the folded scalars (BUG-001,
// BUG-004, BUG-005). This writer edits the concrete syntax tree of the yaml
// package instead: CST.stringify joins the source text back in order, so only
// the edited value's text changes.
//
// CST.setScalarValue checks no types: the string "true" written plain would
// read back as a boolean. So every edit is parsed again and accepted only when
// the data equals the old data with that one field set.
import { realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { CST, Parser, parseAllDocuments, type Document, type Scalar } from 'yaml';
import { messageOf } from './errors.ts';
import { readRegularFile, writeAtomic } from './regular-file.ts';

/** The most writeStateField reads. A state file is a few tens of KiB. */
export const maxStateBytes = 1024 * 1024;

export type FieldValue = string | number | boolean | null;
export type SetField = { ok: true; text: string } | { ok: false; error: string };
export type WriteField = { ok: true; action: 'written' | 'unchanged'; file: string } | { ok: false; error: string };
type Parsed = { ok: true; doc: Document; data: unknown } | { ok: false; error: string };
type Data = { ok: true; data: unknown } | { ok: false; error: string };
type Found = { ok: true; token: CST.FlowScalar | CST.BlockScalar } | { ok: false; error: string };

function isFieldValue(value: unknown): value is FieldValue {
  if (typeof value === 'number') return Number.isFinite(value);
  return value === null || typeof value === 'string' || typeof value === 'boolean';
}

/** The data of `doc`. yaml refuses to expand too many aliases by throwing from
 * toJS (a billion-laughs guard); that is a refusal here, not a crash (security
 * review F1). */
function toData(doc: Document): Data {
  try {
    return { ok: true, data: doc.toJS() };
  } catch (error) {
    return { ok: false, error: `the text cannot be read as data: ${messageOf(error)}` };
  }
}

/** Parse `text` as exactly one YAML document with no errors, and its data. */
function parseOne(text: string): Parsed {
  const docs = parseAllDocuments(text);
  if (!Array.isArray(docs) || docs.length !== 1) {
    return { ok: false, error: 'the text must be exactly one YAML document' };
  }
  const doc = docs[0];
  if (doc === undefined) return { ok: false, error: 'the text must be exactly one YAML document' };
  const first = doc.errors[0];
  if (first !== undefined) return { ok: false, error: `the text is not valid YAML: ${first.message}` };
  const data = toData(doc);
  return data.ok ? { ok: true, doc, data: data.data } : data;
}

/** The scalar token at `path` in the one document of `tokens`. Each key must
 * be an entry of a block mapping, matched by its resolved text. */
function findScalar(tokens: CST.Token[], path: readonly string[]): Found {
  let node: CST.Token | undefined = tokens.find((token) => token.type === 'document')?.value;
  for (const [index, key] of path.entries()) {
    const where = index === 0 ? 'the document' : path.slice(0, index).join('.');
    if (node?.type !== 'block-map') return { ok: false, error: `${where} is not a block mapping` };
    const item = node.items.find((entry) => CST.isScalar(entry.key) && CST.resolveAsScalar(entry.key)?.value === key);
    if (item === undefined) return { ok: false, error: `there is no key ${path.slice(0, index + 1).join('.')}` };
    node = item.value;
  }
  if (!CST.isScalar(node)) return { ok: false, error: `${path.join('.')} is not a scalar` };
  return { ok: true, token: node };
}

/** `value` as YAML source for setScalarValue. */
function sourceOf(value: FieldValue): string {
  return value === null ? 'null' : String(value);
}

/** Set `path` to `value` in a fresh tree of `text` and return the new text.
 * `type` undefined keeps the scalar's old style. */
function editScalar(text: string, path: readonly string[], value: FieldValue, type?: Scalar.Type): SetField {
  const tokens = [...new Parser().parse(text)];
  const found = findScalar(tokens, path);
  if (!found.ok) return found;
  CST.setScalarValue(found.token, sourceOf(value), type === undefined ? { afterKey: true } : { afterKey: true, type });
  return { ok: true, text: tokens.map((token) => CST.stringify(token)).join('') };
}

/** True when `text` is one valid document whose data is `expected`. */
function holdsData(text: string, expected: unknown): boolean {
  const parsed = parseOne(text);
  return parsed.ok && isDeepStrictEqual(parsed.data, expected);
}

/** The first edit of `text` whose parsed data is `want`. A string tries the
 * scalar's old style first, then double quotes, because setScalarValue does
 * not check what a plain scalar will read back as. */
function firstEditThatHolds(text: string, path: readonly string[], value: FieldValue, want: unknown): SetField {
  const styles: (Scalar.Type | undefined)[] = typeof value === 'string' ? [undefined, 'QUOTE_DOUBLE'] : ['PLAIN'];
  for (const type of styles) {
    const result = editScalar(text, path, value, type);
    if (result.ok && holdsData(result.text, want)) return result;
  }
  return { ok: false, error: `${path.join('.')} could not be set to ${JSON.stringify(value)} without changing other data` };
}

/** Set the scalar at `path` in the YAML `text` to `value`, and keep every
 * other byte. The key must exist and hold a scalar; the writer never adds a
 * key. A string keeps the scalar's old style, or is double-quoted when that
 * style would read back as another type. Any text that cannot be checked to
 * hold exactly the old data with that one field set is an error, and no text
 * comes back. */
export function setField(text: string, path: readonly string[], value: FieldValue): SetField {
  if (path.length === 0) return { ok: false, error: 'the key path is empty' };
  if (!isFieldValue(value)) {
    return { ok: false, error: 'the value must be a string, a finite number, a boolean or null' };
  }
  const parsed = parseOne(text);
  if (!parsed.ok) return parsed;
  const found = findScalar([...new Parser().parse(text)], path);
  if (!found.ok) return found;
  if (isDeepStrictEqual(parsed.doc.getIn(path), value)) return { ok: true, text };
  const expected = parsed.doc.clone();
  expected.setIn(path, value);
  const want = toData(expected);
  return want.ok ? firstEditThatHolds(text, path, value, want.data) : want;
}

/** The real path `file` names, when it lies inside `root`: `file` is resolved
 * against `root`, and its directory after resolving symlinks must be `root` or
 * below it. The file name itself is not resolved: readRegularFile refuses a
 * symlink there. */
function insideRoot(root: string, file: string): { ok: true; path: string } | { ok: false; error: string } {
  try {
    const realRoot = realpathSync(root);
    const target = resolve(realRoot, file);
    const parent = realpathSync(dirname(target));
    const rel = relative(realRoot, parent);
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
      return { ok: false, error: `${file} is outside the repository root ${realRoot}` };
    }
    return { ok: true, path: join(parent, basename(target)) };
  } catch (error) {
    return { ok: false, error: `${file} cannot be resolved: ${messageOf(error)}` };
  }
}

/** Set the scalar at `path` in the state file `file` (named from `root`) to
 * `value`, keeping every other byte. The file must be a regular file inside
 * the repository root, not a symlink, of at most maxStateBytes. It is written
 * through a temp file and a rename with its old mode, and only when the text
 * changes. A file that cannot be read, parsed or checked is never written. */
export function writeStateField(root: string, file: string, path: readonly string[], value: FieldValue): WriteField {
  const inside = insideRoot(root, file);
  if (!inside.ok) return inside;
  const read = readRegularFile(inside.path, { follow: false, maxBytes: maxStateBytes });
  if (!read.ok) return read;
  if (read.file === null) return { ok: false, error: `${file} does not exist` };
  const result = setField(read.file.text, path, value);
  if (!result.ok) return { ok: false, error: `${file}: ${result.error}` };
  if (result.text === read.file.text) return { ok: true, action: 'unchanged', file };
  const failed = writeAtomic(inside.path, result.text, read.file.mode);
  return failed ?? { ok: true, action: 'written', file };
}
