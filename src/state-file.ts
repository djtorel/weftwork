// story: e08s01
// The format-preserving writer for state files: set one scalar field and keep
// every other byte, where a YAML dump dropped the ---, comments and folded
// scalars (BUG-001, BUG-004, BUG-005). It edits the yaml package's concrete
// syntax tree, then parses the result: it is kept only when the data equals the
// old data with that one field set, no new warning appears, and PyYAML (which
// this repository's tools use) would read the value the same way.
import { realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { CST, isMap, isScalar, Parser, parseAllDocuments, parseDocument, type Document, type Scalar } from 'yaml';
import { messageOf, type Failure } from './errors.ts';
import { isRecord } from './json.ts';
import { readRegularFile, writeAtomic } from './regular-file.ts';

/** The most writeStateField reads. A state file is a few tens of KiB. */
export const maxStateBytes = 1024 * 1024;

export type FieldValue = string | number | boolean | null;
export type SetField = { ok: true; text: string } | Failure;
export type WriteField = { ok: true; action: 'written' | 'unchanged'; file: string } | Failure;
type Reading = { data: unknown; warnings: number };
type Parsed = ({ ok: true; doc: Document } & Reading) | Failure;
type Found = { ok: true; token: CST.FlowScalar | CST.BlockScalar } | Failure;

/** True for a value the writer can put in a scalar: a string, a finite number,
 * a boolean or null. The CLI checks its input with the same rule. */
export function isFieldValue(value: unknown): value is FieldValue {
  if (typeof value === 'number') return Number.isFinite(value);
  return value === null || typeof value === 'string' || typeof value === 'boolean';
}

/** Parse `text` as exactly one YAML document with no errors, with its data and
 * warning count. yaml refuses to expand too many aliases by throwing from toJS
 * (a billion-laughs guard); that is a refusal here, not a crash (security
 * review F1). */
function parseOne(text: string): Parsed {
  const docs = parseAllDocuments(text);
  const doc = Array.isArray(docs) && docs.length === 1 ? docs[0] : undefined;
  if (doc === undefined) return { ok: false, error: 'the text must be exactly one YAML document' };
  const first = doc.errors[0];
  if (first !== undefined) return { ok: false, error: `the text is not valid YAML: ${first.message}` };
  let data: unknown;
  try {
    data = doc.toJS();
  } catch (error) {
    return { ok: false, error: `the text cannot be read as data: ${messageOf(error)}` };
  }
  if (!isPlainData(data)) {
    return { ok: false, error: 'the file holds data other than mappings, sequences and scalars (a %YAML 1.1 directive or a tag such as !!binary)' };
  }
  return { ok: true, doc, data, warnings: doc.warnings.length };
}

/** True when `data` is only plain objects, arrays, strings, numbers, booleans
 * and null. A %YAML 1.1 directive or a tag such as !!binary gives Dates, bytes,
 * Maps or Sets, which the data check cannot copy or compare, so every edit
 * would fail with the wrong reason (review round 3, A4). */
function isPlainData(data: unknown): boolean {
  if (Array.isArray(data)) return data.every(isPlainData);
  if (typeof data !== 'object' || data === null) return true;
  return Object.getPrototypeOf(data) === Object.prototype && Object.values(data).every(isPlainData);
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
  if (node === undefined) return { ok: false, error: `${path.join('.')} has no value to replace` };
  if (!CST.isScalar(node)) return { ok: false, error: `${path.join('.')} is not a scalar` };
  return { ok: true, token: node };
}

/** The property name a key gets in the data: toJS turns a key's value into a
 * string, so `"1"` and `1.0` both become "1", and `""` and null both "". */
function dataKeyOf(key: unknown): string | null {
  if (!isScalar(key)) return null;
  return key.value === null ? '' : String(key.value);
}

/** A refusal when a mapping on `path` has two keys that become one property in
 * the data: the syntax tree finds the first, the data keeps the last, and the
 * writer could answer "unchanged" without writing (review round 5, A1). */
function keysCollide(doc: Document, path: readonly string[]): Failure | null {
  let node: unknown = doc.contents;
  for (const [index, key] of path.entries()) {
    if (!isMap(node)) return null;
    const matches = node.items.filter((pair) => dataKeyOf(pair.key) === key);
    if (matches.length > 1) {
      return { ok: false, error: `${path.slice(0, index + 1).join('.')}: more than one key reads as "${key}"` };
    }
    node = matches[0]?.value;
  }
  return null;
}

/** `value` as YAML source for setScalarValue. A number in exponent form gets a
 * dot (`1.0e+21`): PyYAML's float needs one and reads `1e+21` as a string
 * (review 2, A5). */
function sourceOf(value: FieldValue): string {
  if (value === null) return 'null';
  const text = String(value);
  return typeof value === 'number' && text.includes('e') && !text.includes('.') ? text.replace('e', '.0e') : text;
}

/** Printable ASCII with no space at either end: the strings a plain scalar can
 * hold for every reader. PyYAML refuses a plain tab and reads NEL, LS and PS as
 * line breaks (review 2, B1). */
const plainSafe = /^[\x21-\x7E](?:[\x20-\x7E]*[\x21-\x7E])?$/;

/** False when `token` is a plain scalar holding a string that PyYAML would
 * refuse or read as something else: characters outside plainSafe, `=` and `<<`
 * (review 2, A4, B1), or text YAML 1.1 reads as another type, such as `yes` or
 * `1_000` (review B2). yaml's 1.1 schema over-reads a few (`e01`): extra quotes. */
function plainStringIsSafe(token: CST.FlowScalar | CST.BlockScalar, value: FieldValue): boolean {
  if (typeof value !== 'string' || token.type !== 'scalar') return true;
  if (!plainSafe.test(value) || value === '=' || value === '<<') return false;
  const doc = parseDocument(CST.stringify(token).trim(), { version: '1.1' });
  try {
    return doc.errors.length === 0 && doc.toJS() === value;
  } catch {
    return false;
  }
}

/** Set `path` to `value` in a fresh tree of `text` and return the new text.
 * `type` undefined keeps the scalar's old style. The new text must be the old
 * text with only the value token's span replaced, which proves that no byte
 * outside the value changed (review A4). */
function editScalar(text: string, path: readonly string[], value: FieldValue, type?: Scalar.Type): SetField {
  const tokens = [...new Parser().parse(text)];
  const found = findScalar(tokens, path);
  if (!found.ok) return found;
  const { offset } = found.token;
  const oldLength = CST.stringify(found.token).length;
  CST.setScalarValue(found.token, sourceOf(value), type === undefined ? { afterKey: true } : { afterKey: true, type });
  if (!plainStringIsSafe(found.token, value)) return { ok: false, error: `${path.join('.')}: PyYAML would not read it back` };
  const written = CST.stringify(found.token);
  if (text.includes('\r\n') && /(^|[^\r])\n/.test(written)) {
    return { ok: false, error: `${path.join('.')}: the edit would mix line endings in a CRLF file` };
  }
  const edited = text.slice(0, offset) + written + text.slice(offset + oldLength);
  const joined = tokens.map((token) => CST.stringify(token)).join('');
  if (joined !== edited) return { ok: false, error: `${path.join('.')}: the edit changed text outside its value` };
  return { ok: true, text: edited };
}

/** A deep copy of YAML data that shares no object. An alias reads the same
 * object as its anchor, and structuredClone keeps that sharing, so setting a
 * field on the copy would set the alias too and hide its change (review 2, A3,
 * B3). The core schema gives only objects, arrays and scalars. */
function unsharedCopy(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(unsharedCopy);
  if (isRecord(data)) return Object.fromEntries(Object.entries(data).map(([key, item]) => [key, unsharedCopy(item)]));
  return data;
}

/** The reading the edited text must give: `old` with the field at `path` set
 * to `value`, on an unshared copy of its data, so an alias of the edited value
 * or of a mapping above it shows up as a change (review A1, B1). The path is
 * found by key text in the syntax tree but by key value in the data, so a key
 * that YAML reads as something else (`null:`, `~:`, `1.0:`) is refused here
 * with that reason (review 4, A3, B5). */
function expectedReading(old: Reading, path: readonly string[], value: FieldValue): ({ ok: true } & Reading) | Failure {
  const copy = unsharedCopy(old.data);
  let node: unknown = copy;
  for (const key of path.slice(0, -1)) node = isRecord(node) && Object.hasOwn(node, key) ? node[key] : undefined;
  const last = path[path.length - 1];
  if (!isRecord(node) || last === undefined || !Object.hasOwn(node, last)) {
    return { ok: false, error: `${path.join('.')} does not read back as written: YAML reads a key on the path as another value` };
  }
  node[last] = value;
  return { ok: true, data: copy, warnings: old.warnings };
}

/** True when `text` reads as `want`, with no more warnings than the old text
 * had: a tag that no longer fits its value only warns (review A2, B3). */
function holdsData(text: string, want: Reading): boolean {
  const read = parseOne(text);
  return read.ok && read.warnings <= want.warnings && isDeepStrictEqual(read.data, want.data);
}

/** The first edit of `text` that holds `want`. A string tries the scalar's old
 * style first, then double quotes, because setScalarValue does not check what
 * a plain scalar will read back as. When no style can even be written, the
 * last reason comes back; otherwise the edit would change other data. */
function firstEditThatHolds(text: string, path: readonly string[], value: FieldValue, want: Reading): SetField {
  const styles: (Scalar.Type | undefined)[] = typeof value === 'string' ? [undefined, 'QUOTE_DOUBLE'] : ['PLAIN'];
  let reason = '';
  let anyStyleWrote = false;
  for (const type of styles) {
    const result = editScalar(text, path, value, type);
    if (!result.ok) reason = result.error;
    else if (holdsData(result.text, want)) return result;
    else anyStyleWrote = true;
  }
  if (!anyStyleWrote && reason !== '') return { ok: false, error: reason };
  const also = reason === '' ? '' : `; another style failed: ${reason}`;
  const goal = 'so that the file reads back as the old data with this field set';
  return { ok: false, error: `${path.join('.')} could not be set to ${JSON.stringify(value)} ${goal}${also}` };
}

/** The characters PyYAML's reader accepts, less NEL, which YAML 1.1 reads as a
 * line break. yaml writes the others (DEL, C1 controls, U+FFFE, U+FFFF) raw in
 * every style, and PyYAML then refuses the whole file (review round 3, A1, B1);
 * with the u flag a lone surrogate falls outside too (B5). */
const notPyYamlPrintable = /[^\t\n\r\x20-\x7E\xA0-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u;

/** Why `value` cannot be written at `path` at all, or null. setScalarValue
 * writes NEL, LS and PS unescaped, and YAML 1.1 reads them as line breaks, so
 * PyYAML would read another string (review 2, B1). */
function refusalForValue(path: readonly string[], value: unknown): string | null {
  if (path.length === 0) return 'the key path is empty';
  if (!isFieldValue(value)) return 'the value must be a string, a finite number, a boolean or null';
  if (typeof value !== 'string') return null;
  if (/[\u0085\u2028\u2029]/.test(value)) return 'the value holds NEL, LS or PS, which YAML 1.1 reads as a line break';
  if (notPyYamlPrintable.test(value)) {
    return 'the value holds a character PyYAML cannot read (a control character, U+FFFE, U+FFFF or a lone surrogate)';
  }
  return null;
}

/** Set the scalar at `path` in the YAML `text` to `value`, and keep every
 * other byte. The key must exist and hold a scalar; the writer never adds a
 * key. A string keeps the scalar's old style, or is double-quoted when that
 * style would read back as another type. Any text that cannot be checked to
 * hold exactly the old data with that one field set is an error, and no text
 * comes back. */
export function setField(text: string, path: readonly string[], value: FieldValue): SetField {
  const refusal = refusalForValue(path, value);
  if (refusal !== null) return { ok: false, error: refusal };
  const normalised = value === 0 ? 0 : value; // -0 is written as 0, so it must be checked as 0 (review 2, A8)
  const parsed = parseOne(text);
  if (!parsed.ok) return parsed;
  const found = findScalar([...new Parser().parse(text)], path);
  if (!found.ok) return found;
  const collision = keysCollide(parsed.doc, path);
  if (collision !== null) return collision;
  const want = expectedReading(parsed, path, normalised);
  if (!want.ok) return want;
  // Unchanged is decided on the data, not on doc.getIn, which cannot find a
  // key that YAML reads as a number or a boolean (review 4, B1).
  if (isDeepStrictEqual(want.data, parsed.data)) return { ok: true, text };
  return firstEditThatHolds(text, path, normalised, want);
}

/** The real path `file` names, when it lies inside `root` and outside `.git`:
 * `file` is resolved against `root`, and its directory after resolving
 * symlinks must be `root` or below it. The file name itself is not resolved:
 * readRegularFile refuses a symlink there. */
function insideRoot(root: string, file: string): { ok: true; path: string } | Failure {
  try {
    const realRoot = realpathSync(root);
    const target = resolve(realRoot, file);
    if (target === realRoot) return { ok: false, error: `${file} names the repository root, not a file` };
    const parent = realpathSync(dirname(target));
    const rel = relative(realRoot, parent);
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
      return { ok: false, error: `${file} is outside the repository root ${realRoot}` };
    }
    const path = join(parent, basename(target));
    // A case-insensitive disk (macOS by default) reads .GIT as .git (review 4, A2).
    if (relative(realRoot, path).split(sep).some((segment) => segment.toLowerCase() === '.git')) {
      return { ok: false, error: `${file} is inside .git, which the engine does not edit` };
    }
    return { ok: true, path };
  } catch (error) {
    return { ok: false, error: `${file} cannot be resolved: ${messageOf(error)}` };
  }
}

/** Set the scalar at `path` in the state file `file` (named from `root`) to
 * `value`, keeping every other byte. The file must be a regular file inside
 * the repository root and outside `.git`, not a symlink, of at most
 * maxStateBytes. It is written through a temp file and a rename with its old
 * mode, and only when the text changes. A file that cannot be read, parsed or
 * checked is never written. */
export function writeStateField(root: string, file: string, path: readonly string[], value: FieldValue): WriteField {
  const inside = insideRoot(root, file);
  if (!inside.ok) return inside;
  const read = readRegularFile(inside.path, { follow: false, maxBytes: maxStateBytes });
  if (!read.ok) return read;
  if (read.file === null) return { ok: false, error: `${file} does not exist` };
  const result = setField(read.file.text, path, value);
  if (!result.ok) return { ok: false, error: `${file}: ${result.error}` };
  if (result.text === read.file.text) return { ok: true, action: 'unchanged', file };
  if (Buffer.byteLength(result.text) > maxStateBytes) {
    return { ok: false, error: `${file}: the new text would be larger than ${maxStateBytes} bytes, which the writer could not read again` };
  }
  const failed = writeAtomic(inside.path, result.text, read.file.mode);
  return failed ?? { ok: true, action: 'written', file };
}
