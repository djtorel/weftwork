// story: e08s03
// setMapping (state-mapping.ts), the second edit of the state writer (e08s03 AC-01, AC-02): the
// value of one top-level key is replaced by a flat mapping of strings, nulls
// and lists of strings, and every byte outside that value stays. It is the
// edit the handoff writer needs, because setField changes one scalar and never
// adds a key. No test touches this repository's own specs/state.yaml.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { setMapping, writeStateMapping, type MappingValue } from './state-mapping.ts';
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
  const next = text.slice(start + 1).search(/\n\S/);
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

// Review round 1 (A1, B1, A12, B6): the yaml package writes these plain, and
// PyYAML refuses the file (a tab), cannot build them (`=`, `<<`), or YAML 1.2
// reads a number (`0o17`). They must be double-quoted.
for (const value of ['a\tb', '=', '<<', '0o17']) {
  test(`setMapping double-quotes ${JSON.stringify(value)}, which no reader can take plain`, () => {
    const text = replaced(fixture, 'handoff', { next_skill: value, files: [value], note: value });
    assert.ok(text.includes(`\n  next_skill: ${JSON.stringify(value)}\n`), text.slice(text.indexOf('\nhandoff:'), text.indexOf('\nmetrics:')));
    assert.ok(text.includes(`\n    - ${JSON.stringify(value)}\n`));
    const block = (parse(text, { version: '1.1' }) as Record<string, MappingValue>)['handoff'];
    assert.deepEqual(block, { next_skill: value, files: [value], note: value });
  });
}

test('a note that a block scalar cannot hold is double-quoted, not refused', () => {
  const text = replaced(fixture, 'handoff', { note: ' \n' });
  assert.deepEqual((parse(text, { version: '1.1' }) as Record<string, MappingValue>)['handoff'], { note: ' \n' });
});

test('a long astral note is well-formed at every fold position and reads back', () => {
  // Folding can split a surrogate pair; the UTF-8 file would then hold U+FFFD.
  for (const pad of ['', 'x', 'xx', 'xxx']) {
    const value = { next_skill: pad || 'v', note: '😀'.repeat(300) };
    const text = replaced(fixture, 'handoff', value);
    assert.ok(text.isWellFormed(), `pad ${JSON.stringify(pad)}`);
    assert.deepEqual((parse(Buffer.from(text, 'utf8').toString('utf8')) as Record<string, unknown>)['handoff'], value);
  }
});

test('a blank line and a comment after the block are kept byte for byte', () => {
  const text = 'a: 1\nhandoff:\n  next_skill: x\n\n# about z\nz: 2\n';
  const result = replaced(text, 'handoff', { next_skill: 'develop-tdd' });
  assert.equal(result, 'a: 1\nhandoff:\n  next_skill: develop-tdd\n\n# about z\nz: 2\n');
});

test('a comment the parser counts as part of the block is replaced with it', () => {
  // An indented comment line continues the block, so the YAML parser puts it,
  // and the lines before it, in the handoff entry. The entry is replaced whole.
  const text = 'a: 1\nhandoff:\n  next_skill: x\n  # about the block\nz: 2\n';
  assert.equal(replaced(text, 'handoff', { next_skill: 'develop-tdd' }), 'a: 1\nhandoff:\n  next_skill: develop-tdd\nz: 2\n');
});

test('in a CRLF file the new block is CRLF and the rest is kept', () => {
  const text = 'a: 1\r\nhandoff: null\r\n# about z\r\nz: 2\r\n';
  const result = replaced(text, 'handoff', handoff);
  assert.ok(result.startsWith('a: 1\r\nhandoff:\r\n'), JSON.stringify(result));
  assert.ok(result.endsWith('\r\n# about z\r\nz: 2\r\n'), JSON.stringify(result));
  assert.equal(/(^|[^\r])\n/.test(result), false, 'no bare LF');
  assert.deepEqual((parse(result) as Record<string, unknown>)['handoff'], handoff);
});

test('in a file with mixed line endings the block keeps the line ending of the old entry', () => {
  const lf = replaced('a: 1\r\nhandoff: null\nz: 2\r\n', 'handoff', { next_skill: 'v' });
  assert.equal(lf, 'a: 1\r\nhandoff:\n  next_skill: v\nz: 2\r\n');
  const crlf = replaced('a: 1\nhandoff: null\r\nz: 2\n', 'handoff', { next_skill: 'v' });
  assert.equal(crlf, 'a: 1\nhandoff:\r\n  next_skill: v\r\nz: 2\n');
});

/** True when no line of `text` ends in a space or tab and no three blank
 * lines follow each other: the yamllint rules that still apply to
 * specs/state.yaml (trailing-spaces, empty-lines). */
const lintClean = (text: string): boolean => !/[ \t]\r?$/m.test(text) && !/(\r?\n){4}/.test(text);

// Review round 2: notes that made the writer throw (B1), break yamllint (A1),
// or be refused although they can be written (A2, B6).
for (const note of [
  ' \n\t\n',
  '\n \n\t\n',
  'Line  \n\n\n\nend',
  'two trailing spaces  \nnext line',
  'xxxxxxxxxxxxxxxxxxxxxxxxx      \n \n  ',
  '\n \nxxxxxxxxxxxxxxxxxxxxxx     "\n  ',
  '😀\n \n😀',
  '\r#😀:\t\t😀a\n \n#\\\ra "\n#"\t\t\n',
]) {
  test(`setMapping writes the note ${JSON.stringify(note)} lint-clean, and it reads back`, () => {
    const text = replaced(fixture, 'handoff', { next_skill: 'v', note });
    const block = text.slice(text.indexOf('\nhandoff:'), text.indexOf('\nmetrics:'));
    assert.ok(lintClean(block), JSON.stringify(block));
    assert.deepEqual((parse(text, { version: '1.1' }) as Record<string, MappingValue>)['handoff'], { next_skill: 'v', note });
  });
}

test('a file with a collection key is refused without a process warning', () => {
  // Review round 2, A5: toJS warned on stderr for `? [a]` before the refusal.
  const warnings: string[] = [];
  const listen = (warning: Error): void => {
    warnings.push(warning.message);
  };
  process.on('warning', listen);
  try {
    const result = setMapping('? [a]\n: 1\nhandoff: null\n', 'handoff', { next_skill: 'v' });
    assert.equal(result.ok, false);
    assert.ok(!result.ok && /mapping or a list/.test(result.error), result.ok ? '' : result.error);
  } finally {
    process.off('warning', listen);
  }
  assert.deepEqual(warnings, []);
});

// Review round 3, B1: after an indented comment the parser puts the
// column-0 comments and blank lines that follow in the entry; they belong to
// the next key and must stay.
for (const [name, text, kept] of [
  ['after an indented comment', 'a: 1\nhandoff:\n  x: 1\n  # inner\n# top comment\nb: 2\n', '\n# top comment\nb: 2\n'],
  ['after a comment-only block', 'a: 1\nhandoff:\n  # only comment\n# top\nb: 2\n', '\n# top\nb: 2\n'],
  ['with a blank line before it', 'a: 1\nhandoff:\n  x: 1\n  # inner\n\n# top comment\nb: 2\n', '\n\n# top comment\nb: 2\n'],
  // Review round 5, B3: a line of only spaces is blank too.
  ['with a line of only spaces after it', 'a: 1\nhandoff:\n  x: y\n  # ind\n# top\n   \nb: 2\n', '\n# top\n   \nb: 2\n'],
]) {
  test(`a column-0 comment for the next key ${name} is kept`, () => {
    const result = replaced(text, 'handoff', { note: 'abc' });
    assert.ok(result.endsWith(`note: abc${kept}`), JSON.stringify(result));
  });
}

// Review round 3, A1, A2, B2: a candidate is checked in place. A note that
// ends in a blank line must not end the file with one (yamllint max-end), and
// the blank lines after the entry must not be taken into the note.
for (const note of ['x\n\n', 'x\n\n\n']) {
  test(`with handoff as the last key, the note ${JSON.stringify(note)} leaves no blank line at the end`, () => {
    const result = replaced('x: 1\nhandoff:\n  a: c\n', 'handoff', { note });
    assert.ok(lintClean(result) && !/\n\n$/.test(result), JSON.stringify(result));
    assert.deepEqual((parse(result, { version: '1.1' }) as Record<string, MappingValue>)['handoff'], { note });
  });
  test(`with blank lines after the entry, the note ${JSON.stringify(note)} is written, not refused`, () => {
    for (const gap of ['\n', '\n\n']) {
      const result = replaced(`x: 1\nhandoff:\n  a: c\n${gap}metrics: 2\n`, 'handoff', { note });
      assert.ok(result.endsWith(`${gap}metrics: 2\n`), JSON.stringify(result));
      assert.deepEqual(parse(result, { version: '1.1' }), { x: 1, handoff: { note }, metrics: 2 });
    }
  });
}

// Review round 4, B1: at the end of a file with no final newline, a block
// scalar with no line break after it reads differently in PyYAML. The entry
// keeps its final newline there.
test('a note ending in a line break at the end of a file with no final newline keeps it', () => {
  assert.equal(replaced('a: 1\nhandoff:\n  a: c', 'handoff', { note: 'x\n' }), 'a: 1\nhandoff:\n  note: |\n    x\n');
  assert.equal(replaced('a: 1\nhandoff: {a: c}', 'handoff', { note: 'x\n' }), 'a: 1\nhandoff:\n  note: |\n    x\n');
});

// Review round 4, B4: every read-back above uses the yaml package, so a case
// where PyYAML reads the file differently could not fail. This one asks
// PyYAML itself, which the repository's Python tools use. It is skipped only
// where python3 with PyYAML is missing (CI runs validate-specs-yaml.sh, which
// needs it).
test('PyYAML reads every written layout as the same data', (t) => {
  if (spawnSync('python3', ['-I', '-c', 'import yaml']).status !== 0) {
    t.skip('python3 with PyYAML is not installed');
    return;
  }
  const notes = ['x\n', 'x\n\n', 'a\tb', '<<', '=', '0o17', 'yes', ' \n\t\n', 'Line  \n\n\n\nend', '😀'.repeat(60), '"q" #c: d'];
  const layouts = ['a: 1\nhandoff:\n  a: c\nz: 2\n', 'a: 1\nhandoff:\n  a: c\n', 'a: 1\nhandoff:\n  a: c', 'a: 1\r\nhandoff: null\r\nz: 2\r\n', 'a: 1\nhandoff:\n  a: c\n\nz: 2\n'];
  const cases = layouts.flatMap((text) => notes.map((note) => {
    const value = { next_skill: 'v', files: [note], note };
    return { text: replaced(text, 'handoff', value), want: { ...(parse(text) as Record<string, unknown>), handoff: value } };
  }));
  const script = 'import json,sys,yaml\nc=json.load(sys.stdin)\nprint(json.dumps([i for i,x in enumerate(c) if yaml.safe_load(x["text"])!=x["want"]]))';
  const run = spawnSync('python3', ['-I', '-c', script], { input: JSON.stringify(cases), encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), [], 'cases PyYAML reads differently');
});

test('the JSON form keeps plain-safe values plain', () => {
  // Review round 4, B5: the yaml package writes no form of this note that
  // reads back lint-clean (round 2, A2), so the JSON form is used, and it used
  // to quote every value.
  const note = 'xxxxxxxxxxxxxxxxxxxxxxxxx      \n \n  ';
  const text = replaced(fixture, 'handoff', { next_skill: 'develop-tdd', files: ['src/a.ts'], note });
  const block = text.slice(text.indexOf('\nhandoff:'), text.indexOf('\nmetrics:'));
  assert.ok(block.includes(`\n  note: ${JSON.stringify(note)}`), block);
  assert.ok(block.includes('\n  next_skill: develop-tdd') && block.includes('\n    - src/a.ts'), block);
});

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
