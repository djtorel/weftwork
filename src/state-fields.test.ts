// story: e08s02
// The field table (e08s02 AC-01 to AC-05): the engine sets only the five
// documented fields of specs/state.yaml, checks each value for type, refuses
// everything else with the file left the same bytes, reads the documented
// fields back, and agrees with docs/STATE.md. Every test runs in a temporary
// repository; none touches this repository's own specs/state.yaml.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { checkStateField, readStateFields, setStateField, stateFields, stateFile } from './state-fields.ts';
import { cleanupTempDirs, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const fixture = readFileSync(join(import.meta.dirname, 'fixtures', 'state.yaml'), 'utf8');

/** A temporary repository whose specs/state.yaml is `text`. */
function repoWithState(text: string = fixture): string {
  const repo = makeTestRepo();
  mkdirSync(join(repo, 'specs'));
  writeFileSync(join(repo, stateFile), text);
  return repo;
}

const stateText = (repo: string): string => readFileSync(join(repo, stateFile), 'utf8');

/** The value at a dotted key of parsed YAML text. */
function valueAt(text: string, key: string): unknown {
  let node: unknown = parse(text);
  for (const part of key.split('.')) node = (node as Record<string, unknown>)[part];
  return node;
}

test('AC-e08s02-01 the table is the five documented fields', () => {
  assert.equal(stateFile, 'specs/state.yaml');
  assert.deepEqual([...stateFields].sort(), ['active_epic', 'active_flow', 'active_story', 'phase', 'vcs.branch']);
});

for (const [key, value] of [
  ['active_flow', 'build_epic'],
  ['active_epic', 'e09'],
  ['active_story', null],
  ['phase', 'initiate'],
  ['vcs.branch', 'e08s02-state-fields'],
] as const) {
  test(`AC-e08s02-01 ${key} is accepted and written`, () => {
    const repo = repoWithState();
    assert.deepEqual(setStateField(repo, key, value), { ok: true, action: 'written', file: stateFile });
    assert.equal(valueAt(stateText(repo), key), value);
  });
}

for (const key of ['workflow_mode', 'test_plan', 'vcs.kind', 'handoff.next_skill', 'waivers', 'metrics', 'no_such_key', '']) {
  test(`AC-e08s02-02 the key ${JSON.stringify(key)} is refused and the file is the same bytes`, () => {
    const repo = repoWithState();
    const result = setStateField(repo, key, 'x');
    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.error.includes(JSON.stringify(key)), JSON.stringify(result));
    assert.equal(stateText(repo), fixture);
  });
}

for (const [name, value] of [
  ['the number 3', 3],
  ['the boolean true', true],
  ['a list', ['e08s02']],
  ['an object', { id: 'e08s02' }],
  ['undefined', undefined],
  ['text with a newline', 'e08s02\nphase: x'],
  ['text with a carriage return', 'e08s02\rx'],
  ['text of 201 code points', 'x'.repeat(201)],
  ['text of 201 astral code points', '😀'.repeat(201)],
] as const) {
  test(`AC-e08s02-03 ${name} is refused and the file is the same bytes`, () => {
    const repo = repoWithState();
    const result = setStateField(repo, 'active_story', value);
    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.error.includes('"active_story"'), JSON.stringify(result));
    assert.equal(stateText(repo), fixture);
  });
}

test('AC-e08s02-03 checkStateField answers without a file', () => {
  assert.equal(checkStateField('phase', 'build'), null);
  assert.equal(checkStateField('phase', null), null);
  assert.equal(checkStateField('metrics', 'x')?.ok, false);
  assert.equal(checkStateField('phase', 3)?.ok, false);
});

for (const [name, value] of [
  ['200 code points', 'x'.repeat(200)],
  ['200 astral code points (400 UTF-16 units)', '😀'.repeat(200)],
  ['empty text', ''],
] as const) {
  test(`AC-e08s02-04 a value of ${name} is accepted`, () => {
    const repo = repoWithState();
    assert.deepEqual(setStateField(repo, 'active_story', value), { ok: true, action: 'written', file: stateFile });
    assert.equal(valueAt(stateText(repo), 'active_story'), value);
  });
}

test('AC-e08s02-04 setting a field to the value it holds is unchanged', () => {
  const repo = repoWithState();
  assert.deepEqual(setStateField(repo, 'phase', 'planning'), { ok: true, action: 'unchanged', file: stateFile });
  assert.equal(stateText(repo), fixture);
});

test('AC-e08s02-05 the engine rows of docs/STATE.md are the keys of stateFields', () => {
  const doc = readFileSync(join(import.meta.dirname, '..', 'docs', 'STATE.md'), 'utf8');
  const rows = doc.split('\n').filter((line) => line.startsWith('| `'));
  assert.ok(rows.length > stateFields.length, 'the table also lists the keys the engine does not write');
  const engineKeys = rows
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .filter((cells) => cells[3] === 'engine')
    .map((cells) => (cells[1] as string).replaceAll('`', ''));
  assert.deepEqual(engineKeys.sort(), [...stateFields].sort());
});

test('readStateFields gives the documented fields and nothing else', () => {
  const repo = repoWithState();
  assert.deepEqual(readStateFields(repo), {
    ok: true,
    fields: {
      active_flow: null,
      active_epic: 'e08',
      active_story: 'e08s01',
      phase: 'planning',
      'vcs.branch': 'e08s01-state-writer',
    },
  });
});

for (const [name, text, key] of [
  ['a missing key', fixture.replace(/^phase: planning\n/m, ''), 'phase'],
  ['a value that is not text', fixture.replace(/^phase: planning$/m, 'phase: 3'), 'phase'],
  ['a mapping in place of text', fixture.replace(/^active_flow: null$/m, 'active_flow:\n  a: b'), 'active_flow'],
] as const) {
  test(`readStateFields refuses ${name} and names the key`, () => {
    const result = readStateFields(repoWithState(text));
    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.error.includes(JSON.stringify(key)), JSON.stringify(result));
  });
}

test('readStateFields refuses a repository with no state file', () => {
  const result = readStateFields(makeTestRepo());
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.error.includes(stateFile), JSON.stringify(result));
});

test('readStateFields refuses invalid YAML', () => {
  const result = readStateFields(repoWithState('active_flow: [\n'));
  assert.equal(result.ok, false);
});
