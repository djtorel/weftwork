// story: e08s03
// setMapping, the second edit of the state writer (e08s03 AC-01, AC-02): the
// value of one top-level key is replaced by a flat mapping of strings, nulls
// and lists of strings, and every byte outside that value stays. It is the
// edit the handoff writer needs, because setField changes one scalar and never
// adds a key. No test touches this repository's own specs/state.yaml.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { setMapping, writeStateMapping, type MappingValue } from './state-file.ts';
import { cleanupTempDirs, makeStateRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const fixture = readFileSync(join(import.meta.dirname, 'fixtures', 'state.yaml'), 'utf8');

const handoff: MappingValue = {
  next_skill: 'develop-tdd',
  next_epic: null,
  note: 'Two lines: "quoted" and \'single\'.\nThe second # is not a comment.',
  files: ['src/a.ts', 'docs/with space.md'],
  uncommitted: [],
};

function replaced(text: string, key: string, value: MappingValue): string {
  const result = setMapping(text, key, value);
  assert.ok(result.ok, result.ok ? '' : result.error);
  return result.text;
}

/** The text before the line that opens `key`, and the text from the next
 * top-level key on. */
function around(text: string, key: string): { before: string; after: string } {
  const start = text.indexOf(`\n${key}:`) + 1;
  const next = text.slice(start + 1).search(/\n[^\s#]/);
  return { before: text.slice(0, start), after: next === -1 ? '' : text.slice(start + 2 + next) };
}

// AC-e08s03-01
test('setMapping replaces the handoff block and keeps every other byte', () => {
  const text = replaced(fixture, 'handoff', handoff);
  const want = { ...(parse(fixture) as Record<string, unknown>), handoff };
  assert.deepEqual(parse(text), want);
  const kept = around(fixture, 'handoff');
  assert.ok(kept.before.length > 1000 && kept.after.startsWith('metrics:'), 'the fixture has text on both sides');
  assert.deepEqual(around(text, 'handoff'), kept);
  assert.match(text, /\nhandoff:\n {2}next_skill: develop-tdd\n/, 'the new block is in block style');
});

test('setMapping with the value the key holds gives back the same bytes', () => {
  const once = replaced(fixture, 'handoff', handoff);
  assert.equal(replaced(once, 'handoff', handoff), once);
});

for (const [name, text] of [
  ['null', 'a: 1\nhandoff: null\nz: 2\n'],
  ['a flow mapping', 'a: 1\nhandoff: {next_skill: x}\nz: 2\n'],
  ['the last key, with no newline at the end', 'a: 1\nhandoff:\n  next_skill: x'],
]) {
  test(`setMapping replaces a handoff value that is ${name}`, () => {
    const result = replaced(text, 'handoff', handoff);
    assert.deepEqual(parse(result), { a: 1, handoff, ...(text.includes('z: 2') ? { z: 2 } : {}) });
    assert.ok(result.startsWith('a: 1\nhandoff:'));
    if (text.includes('z: 2')) assert.ok(result.endsWith('\nz: 2\n'));
  });
}

// AC-e08s03-02
for (const [name, key, value, says] of [
  ['a top-level key that does not exist', 'no_such_key', handoff, /no_such_key/],
  ['a nested mapping in the value', 'handoff', { next_skill: 'x', inner: { a: 'b' } }, /inner/],
  ['a string that holds NEL', 'handoff', { note: 'one\u0085two' }, /NEL/],
  ['a list item that holds a control character', 'handoff', { files: ['a\u0007b'] }, /PyYAML/],
  ['an empty key path', '', handoff, /key/],
] as [string, string, MappingValue, RegExp][]) {
  test(`setMapping refuses ${name} and gives no text`, () => {
    const result = setMapping(fixture, key, value);
    assert.equal(result.ok, false);
    assert.ok(!result.ok && says.test(result.error), result.ok ? '' : result.error);
    assert.ok(!('text' in result));
  });
}

test('writeStateMapping writes the block under the root and keeps the mode', () => {
  const { repo, state } = makeStateRepo(fixture);
  const mode = statSync(state).mode;
  assert.deepEqual(writeStateMapping(repo, 'specs/state.yaml', 'handoff', handoff), {
    ok: true,
    action: 'written',
    file: 'specs/state.yaml',
  });
  assert.deepEqual((parse(readFileSync(state, 'utf8')) as Record<string, unknown>)['handoff'], handoff);
  assert.equal(statSync(state).mode, mode);
  assert.deepEqual(writeStateMapping(repo, 'specs/state.yaml', 'handoff', handoff), {
    ok: true,
    action: 'unchanged',
    file: 'specs/state.yaml',
  });
});

test('writeStateMapping refuses a missing file and writes nothing', () => {
  const { repo } = makeStateRepo(fixture);
  const result = writeStateMapping(repo, 'specs/none.yaml', 'handoff', handoff);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && /does not exist/.test(result.error));
});
