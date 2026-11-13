// story: e08s03
// The handoff writer (e08s03 AC-03 to AC-06): the caller gives next_skill,
// note, branch and optionally next_epic, next_story and files; the engine adds
// written_at and uncommitted itself and writes the block into
// specs/state.yaml with every other byte kept. A refused input writes nothing.
// Every test runs in a temporary repository; none touches this repository's
// own specs/state.yaml.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
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
  ['a note of 4001 code points', { note: 'é'.repeat(maxNoteLength + 1) }, /note.*4000/],
  ['a file path that does not exist', { files: ['no-such-file.txt'] }, /no-such-file\.txt/],
  ['a file path outside the repository', { files: ['../outside.txt'] }, /outside/],
  ['an absolute file path', { files: ['/etc/hosts'] }, /\/etc\/hosts/],
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

test('an input that is not an object is refused', () => {
  const { repo } = makeStateRepo(fixture);
  for (const value of [null, [], 'text', 3]) assert.equal(checkHandoff(repo, value).ok, false);
});

// AC-e08s03-05
test('a note of exactly 4000 code points is accepted', async () => {
  const { repo, state } = makeStateRepo(fixture);
  const note = 'é'.repeat(maxNoteLength);
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
