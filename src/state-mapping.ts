// story: e08s03
// The mapping edit of the state writer: setMapping replaces the value of one
// top-level key with a flat mapping, and writeStateMapping writes the result.
// It keeps the checks of setField (state-file.ts): the new text is kept only
// when it reads back as the old data with that one key replaced, read by the
// yaml package with the YAML 1.1 rules that PyYAML follows (and the 1.2 core
// rules for the whole file). setField changes one scalar and never adds a key,
// and the handoff block needs new keys and lists.
import { isDeepStrictEqual } from 'node:util';
import { CST, Document, isScalar, Parser, parseDocument, visit } from 'yaml';
import type { Failure } from './errors.ts';
import { isRecord } from './json.ts';
import { holdsData, isPlainData, keysCollide, parseOne, plainSafe, refusalForValue, unsharedCopy, type Reading, type SetField, type WriteField } from './state-file.ts';
import { writeStateEdit } from './state-write.ts';

/** The value setMapping writes: a flat mapping of text, null and lists of text. */
export type MappingValue = Readonly<Record<string, string | null | readonly string[]>>;

/** Where one top-level entry of the text starts and ends, in code units. */
type Span = { start: number; end: number };

/** Why `value` cannot be written as the mapping at `key`, or null. Each entry
 * is text, null or a list of text, and every string passes refusalForValue. */
function refusalForMapping(key: string, value: unknown): string | null {
  if (key === '') return 'the key path is empty';
  if (!isRecord(value) || !isPlainData(value)) return `${key}: the value must be a mapping of plain data`;
  for (const [field, item] of Object.entries(value)) {
    const items: unknown[] = Array.isArray(item) ? item : [item];
    if (Array.isArray(item) && item.some((entry) => typeof entry !== 'string')) return `${key}.${field}: a list must hold only text`;
    if (!Array.isArray(item) && item !== null && typeof item !== 'string') return `${key}.${field}: must be text, null or a list of text`;
    for (const entry of items) {
      const refusal = entry === null ? null : refusalForValue([key, field], entry);
      // A list item is named, so a file name nobody typed (in uncommitted) can be found.
      const which = Array.isArray(item) ? ` ${JSON.stringify(entry)}` : '';
      if (refusal !== null) return `${key}.${field}${which}: ${refusal}`;
    }
  }
  return null;
}

/** The start and end offsets of the entry for top-level `key` in `text`: from
 * its key to the end of its value. Comments before the next key are outside. */
function entrySpan(text: string, key: string): ({ ok: true } & Span) | Failure {
  const doc = [...new Parser().parse(text)].find((token) => token.type === 'document');
  const map = doc?.type === 'document' ? doc.value : undefined;
  if (map?.type !== 'block-map') return { ok: false, error: 'the document is not a block mapping' };
  const item = map.items.find((entry) => CST.isScalar(entry.key) && CST.resolveAsScalar(entry.key)?.value === key);
  if (item === undefined || item.key === null || item.key === undefined) return { ok: false, error: `there is no key ${key}` };
  const last = item.value ?? item.sep?.at(-1) ?? item.key;
  const start = item.key.offset;
  return { ok: true, start, end: endBeforeNextKeyComments(text, start, last.offset + CST.stringify(last).length) };
}

/** `end` moved back over the blank lines and column-0 comments that close the
 * span from `start`. The YAML parser puts them in the entry when an indented
 * comment comes before them, but they belong to the next key, so they stay in
 * the file (request-review round 3, B1); a line of only spaces or tabs is
 * blank here too (round 5, B3). The key line is never cut. A block
 * scalar's lines are indented, so only its trailing empty lines move out, and
 * those are blank lines in the file. */
function endBeforeNextKeyComments(text: string, start: number, end: number): number {
  let cut = end;
  for (;;) {
    const body = text.slice(start, cut);
    const lineStart = body.lastIndexOf('\n', body.length - 2) + 1;
    if (lineStart === 0 || !/^([ \t]*|#[^\n]*)\r?\n?$/.test(body.slice(lineStart))) return cut;
    cut = start + lineStart;
  }
}

/** True when the top-level `key` is a key of the data the text reads as. */
function hasKey(data: unknown, key: string): data is Record<string, unknown> {
  return isRecord(data) && Object.hasOwn(data, key);
}

/** True when `value` can be written as a plain scalar for every reader: the
 * characters of plainSafe, not `=` or `<<`, and read back as the same string
 * under YAML 1.1 and 1.2. The yaml package writes a tab, `=` and `<<` plain,
 * and PyYAML refuses or misreads them (review round 1, A1, B1); it writes
 * `0o17` plain, which 1.2 reads as a number (A12, B6). */
function staysPlain(value: string): boolean {
  if (!plainSafe.test(value) || value === '=' || value === '<<') return false;
  return readsAsItself(value, '1.1') && readsAsItself(value, '1.2');
}

/** True when `value`, read as a YAML document of the given version, is the
 * same string, with no error and no warning. parseDocument keeps a warning on
 * the document, where parse would print it (a tag such as `!t`, or `%x`). */
function readsAsItself(value: string, version: '1.1' | '1.2'): boolean {
  const doc = parseDocument(value, { version });
  if (doc.errors.length > 0 || doc.warnings.length > 0) return false;
  // A collection is not the string; toJS on one with a collection key prints a
  // process warning (`? {a}`), so it is never converted.
  if (!isScalar(doc.contents)) return false;
  try {
    return doc.toJS() === value;
  } catch {
    return false;
  }
}

/** How render writes the strings it cannot write plain. */
type Form = { quoteAll: boolean; fold: boolean };

/** The YAML of `{ key: value }` in block style. Each string is written plain
 * only when staysPlain allows it; otherwise a one-line string is double-quoted
 * and a string of several lines is a block scalar, or double-quoted when
 * `quoteAll` is set. Long one-line strings are folded at 80 columns unless
 * `fold` is false. The 1.2 core schema is used: the 1.1 schema prints the
 * string `<<` bare as a merge key whatever its style. */
function render(key: string, value: MappingValue, { quoteAll, fold }: Form): string {
  const doc = new Document({ [key]: value });
  visit(doc, {
    Scalar(_, node) {
      if (typeof node.value !== 'string' || staysPlain(node.value)) return;
      if (quoteAll || !node.value.includes('\n')) node.type = 'QUOTE_DOUBLE';
    },
  });
  return doc.toString(fold ? {} : { lineWidth: 0 });
}

/** `{ key: value }` with every string plain where safe, else a one-line JSON
 * string. A JSON string is a YAML 1.1 and 1.2 double-quoted scalar, and this
 * form is never folded, has no trailing space and no blank line. It is the last form: the yaml
 * package writes a few multi-line strings that do not read back (review round
 * 2, A2, B6). */
function jsonForm(key: string, value: MappingValue): string {
  // A key or value stays plain where staysPlain allows it (round 4, B5).
  const plainOrJson = (text: string): string => (staysPlain(text) ? text : JSON.stringify(text));
  const lines = [`${plainOrJson(key)}:`];
  for (const [field, item] of Object.entries(value)) {
    if (item === null || typeof item === 'string') lines.push(`  ${plainOrJson(field)}: ${item === null ? 'null' : plainOrJson(item)}`);
    else if (item.length === 0) lines.push(`  ${plainOrJson(field)}: []`);
    else lines.push(`  ${plainOrJson(field)}:`, ...item.map((entry: string) => `    - ${plainOrJson(entry)}`));
  }
  return `${lines.join('\n')}\n`;
}

/** True when `candidate` is well-formed and reads back under YAML 1.1 as
 * `want`. A candidate that does not parse is a no, never a throw (review round
 * 2, B1). Lint and the whole-file read-back are checked in place, by
 * firstThatFits. */
function fits(candidate: string, want: unknown): boolean {
  if (!candidate.isWellFormed()) return false;
  const doc = parseDocument(candidate, { version: '1.1' });
  if (doc.errors.length > 0) return false;
  try {
    return isDeepStrictEqual(doc.toJS(), want);
  } catch {
    return false;
  }
}

/** The forms of the entry, best first: folded, then not folded (folding can
 * split a surrogate pair, so the UTF-8 file would hold U+FFFD), each with block
 * scalars and then with double quotes (a block scalar cannot hold a line of
 * only spaces), and last the JSON form. */
function candidates(key: string, value: MappingValue): string[] {
  const forms: Form[] = [
    { quoteAll: false, fold: true },
    { quoteAll: true, fold: true },
    { quoteAll: false, fold: false },
    { quoteAll: true, fold: false },
  ];
  return [...forms.map((form) => render(key, value, form)), jsonForm(key, value)];
}

/** The texts of the new entry for `key` that replaces the entry at `span` in
 * `text`, best first: each candidate that fits, with the line ending of that
 * entry (review round 1, A7, B11), or the file's when the entry has no line
 * break. Each keeps its final line break: the span of a value in the middle of
 * the file ends with its own (request-review round 5, B2), and at the end of a
 * file a block scalar with no line break reads differently in PyYAML (round 4,
 * B1). */
function entryTexts(text: string, span: Span, key: string, value: MappingValue): string[] {
  const old = text.slice(span.start, span.end);
  const crlf = old.includes('\n') ? old.includes('\r\n') : text.includes('\r\n');
  return candidates(key, value)
    .filter((candidate) => fits(candidate, { [key]: value }))
    .map((entry) => (crlf ? entry.replaceAll('\n', '\r\n') : entry));
}

/** The number of places in `text` that break the yamllint rules this
 * repository applies to specs/state.yaml and that an entry can break: a line
 * that ends in a space or tab, a third blank line in a row, and a blank line
 * at the end of the file (review round 2, A1; round 3, A1, B2). */
function lintFaults(text: string): number {
  let faults = /\r?\n\r?\n$/.test(text) ? 1 : 0;
  let blank = 0;
  for (const line of text.split(/\r?\n/)) {
    if (/[ \t]$/.test(line)) faults++;
    blank = line === '' ? blank + 1 : 0;
    if (blank === 3) faults++;
  }
  return faults;
}

/** The first of `entries`, spliced in at `span`, that reads back as `want`
 * and adds no lint fault to `text`. Checked in place, so a block scalar that
 * takes in the blank lines after the entry, or ends the file with one, gives
 * way to the next form (request-review round 3, A1, A2, B2). */
function firstThatFits(text: string, span: Span, entries: string[], want: Reading, key: string): SetField {
  const faults = lintFaults(text);
  for (const entry of entries) {
    const edited = text.slice(0, span.start) + entry + text.slice(span.end);
    if (lintFaults(edited) <= faults && holdsData(edited, want)) return { ok: true, text: edited };
  }
  return { ok: false, error: `${key} could not be replaced so that the file reads back as the old data with this key replaced` };
}

/** Replace the value of the top-level `key` in the YAML `text` with the flat
 * mapping `value`, in block style, and keep every byte outside that entry. The
 * key must exist; the writer never adds a top-level key. The new entry is
 * rendered with the YAML 1.2 core schema (or the JSON form) and kept only when
 * it reads back alone under YAML 1.1, the rules PyYAML follows, and the whole
 * text reads as the old data with that one key replaced (request-review round
 * 5, A1, B1). Otherwise no text comes back. */
export function setMapping(text: string, key: string, value: MappingValue): SetField {
  const refusal = refusalForMapping(key, value);
  if (refusal !== null) return { ok: false, error: refusal };
  const parsed = parseOne(text);
  if (!parsed.ok) return parsed;
  const span = entrySpan(text, key);
  if (!span.ok) return span;
  const collision = keysCollide(parsed.doc, [key]);
  if (collision !== null) return collision;
  if (!hasKey(parsed.data, key)) {
    return { ok: false, error: `${key} does not read back as written: YAML reads the key as another value` };
  }
  const data = { ...parsed.data, [key]: unsharedCopy(value) };
  if (isDeepStrictEqual(data, parsed.data)) return { ok: true, text };
  const entries = entryTexts(text, span, key, value);
  if (entries.length === 0) return { ok: false, error: `${key}: no YAML form of the value reads back as the same data` };
  return firstThatFits(text, span, entries, { data, warnings: parsed.warnings }, key);
}

/** Replace the value of the top-level `key` of the state file `file` with the
 * mapping `value` (setMapping), with the same checks and atomic write as
 * writeStateField. */
export function writeStateMapping(root: string, file: string, key: string, value: MappingValue): WriteField {
  return writeStateEdit(root, file, (text) => setMapping(text, key, value));
}
