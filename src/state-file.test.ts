// story: e08s01
// setField, the format-preserving writer: one field of a state file changes
// and every other byte stays (BUG-001, BUG-004, BUG-005). Fixtures are copies
// of this repository's own state files: state.yaml in the PyYAML style with
// long quoted scalars that wrap, execution-status.yaml with its leading ---,
// and the e08 epic.yaml with ---, comments and a folded (>-) scalar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CST, Parser, parseDocument } from 'yaml';
import { setField, type FieldValue } from './state-file.ts';

const fixture = (name: string): string => readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8');
const liveState = join(import.meta.dirname, '..', 'specs', 'state.yaml');

/** The data of `text`, with `path` set to `value` when one is given. */
function dataWithField(text: string, path?: string[], value?: FieldValue): unknown {
  const doc = parseDocument(text);
  if (path !== undefined) doc.setIn(path, value);
  return doc.toJS();
}

/** The lines that differ between `before` and `after`, once the lines they
 * share at the start and at the end are taken away, and the last shared line
 * before them. */
function changedLines(before: string, after: string): { removed: string[]; added: string[]; above: string } {
  const a = before.split('\n');
  const b = after.split('\n');
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let end = 0;
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++;
  return { removed: a.slice(start, a.length - end), added: b.slice(start, b.length - end), above: a[start - 1] ?? '' };
}

/** True when `lines` lie inside one key's value: they start with the key line,
 * or the key line is just above them (a block scalar whose header stayed), and
 * every other line is indented deeper than the key. */
function isOneValue(lines: string[], key: string, above: string): boolean {
  const startsAtKey = (lines[0] ?? '').trimStart().startsWith(`${key}:`);
  const keyLine = startsAtKey ? (lines[0] as string) : above;
  if (!keyLine.trimStart().startsWith(`${key}:`)) return false;
  const indent = keyLine.length - keyLine.trimStart().length;
  const rest = startsAtKey ? lines.slice(1) : lines;
  return rest.every((line) => line.length - line.trimStart().length > indent);
}

function set(text: string, path: string[], value: FieldValue): string {
  const result = setField(text, path, value);
  assert.ok(result.ok, result.ok ? '' : result.error);
  return result.text;
}

// AC-e08s01-02
test('setting a field to the value it holds gives back the same bytes', () => {
  for (const [name, path] of [
    ['state.yaml', ['handoff', 'next_skill']],
    ['execution-status.yaml', ['development_status', 'e08s01']],
    ['epic.yaml', ['done_when']],
  ] as const) {
    const text = fixture(name);
    const held = parseDocument(text).getIn([...path]) as FieldValue;
    assert.equal(set(text, [...path], held), text, name);
  }
});

// AC-e08s01-03
test('one field changes, only its lines differ, and every other field keeps its value', () => {
  const cases: [string, string[], FieldValue, string[]][] = [
    ['state.yaml', ['active_story'], 'next-story', ['active_story: next-story']],
    ['state.yaml', ['handoff', 'next_skill'], 'verify-work', ['  next_skill: verify-work']],
    ['state.yaml', ['vcs', 'branch'], 'main', ['  branch: main']],
    ['state.yaml', ['active_story'], null, ['active_story: null']],
    ['state.yaml', ['handoff', 'note'], 'Short note.', ["  note: 'Short note.'"]],
    ['execution-status.yaml', ['development_status', 'e08s01'], 'done', ['  e08s01: done']],
    ['epic.yaml', ['wsjf'], 4.2, ['wsjf: 4.2']],
    ['epic.yaml', ['done_when'], 'Plain files, written by the engine.', []],
  ];
  for (const [name, path, value, expected] of cases) {
    const before = fixture(name);
    const after = set(before, path, value);
    const label = `${name} ${path.join('.')}`;
    const key = path[path.length - 1] as string;
    const { removed, added, above } = changedLines(before, after);
    assert.ok(removed.length > 0 || added.length > 0, `${label}: nothing changed`);
    assert.ok(isOneValue(removed, key, above), `${label}: removed ${JSON.stringify(removed)}`);
    assert.ok(isOneValue(added, key, above), `${label}: added ${JSON.stringify(added)}`);
    if (expected.length > 0) assert.deepEqual(added, expected, label);
    assert.deepEqual(dataWithField(after), dataWithField(before, path, value), label);
  }
});

// AC-e08s01-03: the constructs the global scripts lost are still there
test('the leading ---, the comments and the folded scalars survive an edit', () => {
  const before = fixture('epic.yaml');
  const after = set(before, ['status'], 'done');
  assert.ok(after.startsWith('---\n'));
  const comments = (text: string) => text.split('\n').filter((line) => line.startsWith('#'));
  assert.deepEqual(comments(after), comments(before));
  assert.ok(comments(before).length > 5);
  assert.match(after, /^done_when: >-$/m);
  const status = set(fixture('execution-status.yaml'), ['epics', 'e08', 'status'], 'done');
  assert.ok(status.startsWith('---\n'));
});

// AC-e08s01-04
test('a string that would read as another type is quoted', () => {
  const before = fixture('state.yaml');
  for (const value of ['true', '123', 'null', 'needs: quotes # yes', '']) {
    const after = set(before, ['active_story'], value);
    const { added } = changedLines(before, after);
    assert.deepEqual(added, [`active_story: ${JSON.stringify(value)}`], JSON.stringify(value));
    assert.equal(parseDocument(after).get('active_story'), value, JSON.stringify(value));
    assert.deepEqual(dataWithField(after), dataWithField(before, ['active_story'], value));
  }
});

// AC-e08s01-05
test('what the writer refuses: an error that names the problem, and no text', () => {
  const state = fixture('state.yaml');
  const cases: [string, string, string[], unknown, RegExp][] = [
    ['invalid YAML', 'a: [1, 2\nb: c\n', ['b'], 'x', /not valid YAML/],
    ['two documents', 'a: 1\n---\na: 2\n', ['a'], 3, /one YAML document/],
    ['a missing key', state, ['handoff', 'no_such_key'], 'x', /no_such_key/],
    ['a mapping as the last value', state, ['handoff'], 'x', /not a scalar/],
    ['a path through a sequence', state, ['waivers', 'what'], 'x', /not a block mapping/],
    ['a flow mapping', 'a: {b: 1}\n', ['a', 'b'], 2, /not a block mapping/],
    ['an alias', 'a: &x 1\nb: *x\n', ['b'], 2, /not a scalar/],
    ['an empty path', state, [], 'x', /empty/],
    ['a value that is not finite', state, ['active_story'], Number.NaN, /value/],
    ['a value that is an object', state, ['active_story'], { a: 1 }, /value/],
    ['an anchored value that an alias reads (review A1, B1)', 'a: &x old\nb: *x\n', ['a'], 'new', /could not be set/],
    ['a tag that cannot hold the value (review A2, B3)', 'a: !!bool true\n', ['a'], 'x', /could not be set/],
    ['an int tag and a string (review B3)', 'a: !!int 3\n', ['a'], 'x', /could not be set/],
    ['a multi-line value in a CRLF file (review A3, B4)', 'a: x\r\nb: 1\r\n', ['a'], 'p\nq', /CRLF/],
    ['a key with no value (review A7)', 'a:\nb: 1\n', ['a'], 'y', /a has no value to replace/],
  ];
  for (const [label, text, path, value, message] of cases) {
    const result = setField(text, path, value as FieldValue);
    assert.ok(!result.ok, label);
    assert.match(result.error, message, label);
    assert.equal('text' in result, false, label);
  }
});

// AC-e08s01-05, security review F1: yaml's alias guard throws from toJS
test('an alias bomb is refused as a value, not thrown', () => {
  const bomb = [
    'a: &a [x, x, x, x, x, x, x, x, x, x]',
    'b: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a, *a]',
    'c: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b, *b]',
    'k: v',
    '',
  ].join('\n');
  const result = setField(bomb, ['k'], 'x');
  assert.ok(!result.ok);
  assert.match(result.error, /alias/i);
});

// AC-e08s01-06
test("this repository's own specs/state.yaml round-trips", () => {
  const text = readFileSync(liveState, 'utf8');
  const held = parseDocument(text).getIn(['handoff', 'next_skill']) as string;
  assert.equal(set(text, ['handoff', 'next_skill'], held), text);
  const after = set(text, ['handoff', 'next_skill'], `${held}-x`);
  const { removed, added, above } = changedLines(text, after);
  assert.ok(isOneValue(removed, 'next_skill', above), JSON.stringify(removed));
  assert.ok(isOneValue(added, 'next_skill', above), JSON.stringify(added));
  assert.deepEqual(dataWithField(after), dataWithField(text, ['handoff', 'next_skill'], `${held}-x`));
});

// AC-e08s01-04, review B2: this repository's tools read state files with
// PyYAML, which is YAML 1.1, where these strings are booleans or numbers.
test('a string that YAML 1.1 reads as another type is quoted', () => {
  for (const value of ['yes', 'no', 'on', 'off', 'Y', '1_000']) {
    const after = set('a: x\n', ['a'], value);
    assert.equal(after, `a: ${JSON.stringify(value)}\n`, value);
    assert.equal(parseDocument(after, { version: '1.1' }).get('a'), value, value);
  }
});

// AC-e08s01-03: constructs next to the edited value that must keep working
test('anchors, fitting tags, CRLF and same-line comments are kept', () => {
  const cases: [string, string[], FieldValue, string][] = [
    ['a: &x old\nb: 2\n', ['a'], 'new', 'a: &x new\nb: 2\n'],
    ['a: !!str x\nb: 2\n', ['a'], 'z', 'a: !!str z\nb: 2\n'],
    ['a: x\r\nb: 1\r\n', ['a'], 'z', 'a: z\r\nb: 1\r\n'],
    ['a: x # keep\nb: 1\n', ['a'], 'z', 'a: z # keep\nb: 1\n'],
  ];
  for (const [text, path, value, expected] of cases) assert.equal(set(text, path, value), expected, JSON.stringify(text));
});

/** Every block-mapping scalar of `text` with its key path, offset and source. */
function scalarsOf(text: string): { path: string[]; start: number; length: number }[] {
  const found: { path: string[]; start: number; length: number }[] = [];
  const walk = (node: CST.Token | undefined, path: string[]): void => {
    if (node?.type !== 'block-map') return;
    for (const item of node.items) {
      const key = CST.isScalar(item.key) ? CST.resolveAsScalar(item.key)?.value : undefined;
      if (key === undefined) continue;
      if (CST.isScalar(item.value)) {
        found.push({ path: [...path, key], start: item.value.offset, length: CST.stringify(item.value).length });
      } else walk(item.value, [...path, key]);
    }
  };
  for (const token of new Parser().parse(text)) if (token.type === 'document') walk(token.value, []);
  return found;
}

// AC-e08s01-03, review A4: only the bytes of the edited value's token change
test('for every scalar of every fixture, an edit changes no byte outside its value', () => {
  for (const name of ['state.yaml', 'execution-status.yaml', 'epic.yaml']) {
    const text = fixture(name);
    const scalars = scalarsOf(text);
    assert.ok(scalars.length > 5, name);
    for (const { path, start, length } of scalars) {
      const result = setField(text, path, 'edited value');
      if (!result.ok) continue;
      const tail = text.length - start - length;
      const label = `${name} ${path.join('.')}`;
      assert.equal(result.text.slice(0, start), text.slice(0, start), label);
      assert.equal(result.text.slice(result.text.length - tail), text.slice(start + length), label);
      assert.equal(parseDocument(result.text).getIn(path), 'edited value', label);
    }
  }
});
