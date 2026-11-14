// story: e08s03
// The handoff writer (e08s03 AC-03 to AC-06): the caller gives next_skill,
// note, branch and optionally next_epic, next_story and files; the engine adds
// written_at and uncommitted itself and writes the block into
// specs/state.yaml with every other byte kept. A refused input writes nothing.
// Every test runs in a temporary repository; none touches this repository's
// own specs/state.yaml.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { checkHandoff, maxNoteLength, writeHandoff } from './handoff.ts';
import { cleanupTempDirs, makeStateRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const fixture = readFileSync(join(import.meta.dirname, 'fixtures', 'state.yaml'), 'utf8');
const now = new Date('2026-11-13T22:07:30.123Z');

const input = {
  next_skill: 'verify-work',
  next_story: 'e08s03',
  branch: 'e08s03-handoff-note',
  files: ['tracked.txt'],
  note: 'Task 2 is done. Run verify-work next.',
};

const handoffOf = (state: string): unknown => (parse(readFileSync(state, 'utf8')) as Record<string, unknown>)['handoff'];

// AC-e08s03-03
test('a complete input writes the block with the engine facts', async () => {
  const { repo, state } = makeStateRepo(fixture);
  writeFileSync(join(repo, 'tracked.txt'), 'changed\n');
  writeFileSync(join(repo, 'new.txt'), 'new\n');
  assert.deepEqual(await writeHandoff(repo, input, now), { ok: true, action: 'written', file: 'specs/state.yaml' });
  assert.deepEqual(handoffOf(state), {
    next_skill: 'verify-work',
    next_story: 'e08s03',
    next_epic: null,
    branch: 'e08s03-handoff-note',
    written_at: '2026-11-13T22:07:30Z',
    files: ['tracked.txt'],
    uncommitted: ['new.txt', 'tracked.txt'],
    note: 'Task 2 is done. Run verify-work next.',
  });
  const before = fixture.slice(0, fixture.indexOf('\nhandoff:'));
  assert.ok(readFileSync(state, 'utf8').startsWith(before), 'the text above the block is kept');
});

test('the state file itself is never listed as uncommitted', async () => {
  // makeStateRepo leaves specs/state.yaml untracked, so git status lists it.
  const { repo, state } = makeStateRepo(fixture);
  assert.ok((await writeHandoff(repo, input, now)).ok);
  assert.deepEqual((handoffOf(state) as Record<string, unknown>)['uncommitted'], []);
});

// AC-e08s03-04
for (const [name, change, says] of [
  ['no next_skill', { next_skill: undefined }, /next_skill/],
  ['an empty next_skill', { next_skill: '' }, /next_skill/],
  ['no note', { note: undefined }, /note/],
  ['no branch', { branch: undefined }, /branch/],
  ['a branch of two lines', { branch: 'a\nb' }, /branch/],
  ['a next_story that is a number', { next_story: 3 }, /next_story/],
  // An astral character is one code point and two UTF-16 units, so a cap on
  // .length would fail these (review round 1, A6, B10).
  ['a note of 4001 code points', { note: '😀'.repeat(maxNoteLength + 1) }, /note.*4000/],
  ['a file path that does not exist', { files: ['no-such-file.txt'] }, /no-such-file\.txt/],
  ['a file path outside the repository', { files: ['../outside.txt'] }, /outside/],
  ['an absolute file path outside the repository', { files: ['/etc/hosts'] }, /\/etc\/hosts/],
  ['a path with ./', { files: ['./tracked.txt'] }, /written as tracked\.txt/],
  ['a path with ..', { files: ['specs/../tracked.txt'] }, /written as tracked\.txt/],
  ['a path with //', { files: ['specs//state.yaml'] }, /written as specs\/state\.yaml/],
  ['a path with a trailing /', { files: ['specs/'] }, /written as specs/],
  ['a path named twice', { files: ['tracked.txt', 'tracked.txt'] }, /"tracked\.txt" is named more than once/],
  // Review round 4, A13: only whitespace is empty.
  ['a next_skill of only spaces', { next_skill: '   ' }, /next_skill must not be empty or only whitespace/],
  ['a branch of only a tab', { branch: '\t' }, /branch must not be empty or only whitespace/],
  ['a note of only whitespace', { note: ' \n\t\n' }, /note must be text that is not empty or only whitespace/],
  // Review round 3, A3: the old text match read this as a missing file.
  ['a path outside whose name says it cannot be resolved', { files: ['../cannot be resolved'] }, /is outside the repository$/],
  // Review round 5, B5: a type error comes before the duplicate check.
  ['a list of numbers named twice', { files: [1, 1] }, /files must hold only non-empty text/],
  ['a file path with a newline', { files: ['tracked\n.txt'] }, /line/],
  ['files that is not a list', { files: 'tracked.txt' }, /files/],
  ['a key the block does not have', { next_stroy: 'e08s04' }, /next_stroy/],
] as [string, Record<string, unknown>, RegExp][]) {
  test(`${name} is refused and the file is unchanged`, async () => {
    const { repo, state } = makeStateRepo(fixture);
    const result = await writeHandoff(repo, { ...input, ...change }, now);
    assert.equal(result.ok, false);
    assert.ok(!result.ok && says.test(result.error), result.ok ? '' : result.error);
    assert.equal(readFileSync(state, 'utf8'), fixture);
  });
}

test('an absolute path inside the repository is refused, not stored as given', async () => {
  // Spec section 3: a path is refused when it is absolute (review round 1, A3, B3, B4).
  const { repo, state } = makeStateRepo(fixture);
  const result = await writeHandoff(repo, { ...input, files: [join(repo, 'tracked.txt')] }, now);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && /relative to the repository root/.test(result.error), result.ok ? '' : result.error);
  assert.equal(readFileSync(state, 'utf8'), fixture);
});

test('a symlink is a name: one that points outside or nowhere is accepted, never followed', async () => {
  const { repo, state } = makeStateRepo(fixture);
  symlinkSync('/etc/passwd', join(repo, 'out-link'));
  symlinkSync(join(repo, 'no-such-target'), join(repo, 'dangling'));
  assert.ok((await writeHandoff(repo, { ...input, files: ['out-link', 'dangling'] }, now)).ok);
  assert.deepEqual((handoffOf(state) as Record<string, unknown>)['files'], ['out-link', 'dangling']);
});

test('a path in a folder that does not exist is a missing file, not a realpath error', async () => {
  // Review round 2, A6.
  const { repo } = makeStateRepo(fixture);
  const result = await writeHandoff(repo, { ...input, files: ['no-dir/x.txt'] }, now);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && /no-dir\/x\.txt does not exist in the repository/.test(result.error), result.ok ? '' : result.error);
  assert.ok(!result.ok && !result.error.includes(repo), 'the error does not show the absolute path');
});

test('a path through a symlink loop is named without the OS text or absolute path', async () => {
  // Review round 4, A14: ELOOP came back with the realpath message and the full path.
  const { repo, state } = makeStateRepo(fixture);
  symlinkSync('loop2', join(repo, 'loop1'));
  symlinkSync('loop1', join(repo, 'loop2'));
  const result = await writeHandoff(repo, { ...input, files: ['loop1/x'] }, now);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.error === 'files: loop1/x cannot be resolved', result.ok ? '' : result.error);
  assert.equal(readFileSync(state, 'utf8'), fixture);
});

test('a path outside the repository is refused without the absolute root', async () => {
  // Review round 5, A3, B4: the outside message held the real root path.
  const { repo } = makeStateRepo(fixture);
  symlinkSync('/etc', join(repo, 'link'));
  const result = await writeHandoff(repo, { ...input, files: ['link/passwd'] }, now);
  assert.ok(!result.ok && result.error === 'files: link/passwd is outside the repository', result.ok ? '' : result.error);
});

test('files: null is refused, not read as an empty list', async () => {
  // Review round 2, B7.
  const { repo, state } = makeStateRepo(fixture);
  const result = await writeHandoff(repo, { ...input, files: null }, now);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && /files must be a list/.test(result.error), result.ok ? '' : result.error);
  assert.equal(readFileSync(state, 'utf8'), fixture);
});

test('an uncommitted file whose name PyYAML cannot hold is named in the refusal', async () => {
  // Review round 2, B5: the caller cannot fix it through the input, so the error must name it.
  const { repo, state } = makeStateRepo(fixture);
  writeFileSync(join(repo, 'bad\u0001name'), 'x\n');
  const result = await writeHandoff(repo, input, now);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.error.includes(JSON.stringify('bad\u0001name')), result.ok ? '' : result.error);
  assert.equal(readFileSync(state, 'utf8'), fixture);
});

test('an input that is not an object is refused', () => {
  const { repo } = makeStateRepo(fixture);
  for (const value of [null, [], 'text', 3]) assert.equal(checkHandoff(repo, value).ok, false);
});

// AC-e08s03-05
test('a note of exactly 4000 code points is accepted', async () => {
  const { repo, state } = makeStateRepo(fixture);
  const note = '😀'.repeat(maxNoteLength);
  assert.ok((await writeHandoff(repo, { ...input, note }, now)).ok);
  assert.equal((handoffOf(state) as Record<string, unknown>)['note'], note);
});

// AC-e08s03-06
test('written_at and uncommitted from the caller are ignored', async () => {
  const { repo, state } = makeStateRepo(fixture);
  const sent = { ...input, written_at: '1999-01-01T00:00:00Z', uncommitted: ['made-up.txt'] };
  assert.ok((await writeHandoff(repo, sent, now)).ok);
  const block = handoffOf(state) as Record<string, unknown>;
  assert.equal(block['written_at'], '2026-11-13T22:07:30Z');
  assert.deepEqual(block['uncommitted'], []);
});

test('writing the same handoff twice at the same time leaves the file unchanged', async () => {
  const { repo } = makeStateRepo(fixture);
  assert.ok((await writeHandoff(repo, input, now)).ok);
  assert.deepEqual(await writeHandoff(repo, input, now), { ok: true, action: 'unchanged', file: 'specs/state.yaml' });
});
