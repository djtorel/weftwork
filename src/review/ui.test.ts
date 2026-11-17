// story: e11s06
// The value of WEFTWORK_IMAGES (ui.ts): the screenshot paths, before then
// after, joined by commas, and an error when a path holds a comma of its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imagesValue, type Shots } from './ui.ts';

const shots = (phase: 'before' | 'after', ...names: string[]): Shots => ({
  phase,
  at: '',
  branch: 'b',
  base: 'x',
  fingerprint: 'f',
  files: names.map((name) => ({ name, bytes: 8, sha256: '0' })),
});

test('the paths, before then after, joined by commas', () => {
  assert.deepEqual(imagesValue('/g/weftwork', { before: shots('before', 'a.png'), after: shots('after', 'a.png', 'b.png') }), {
    ok: true,
    value: '/g/weftwork/ui/before/a.png,/g/weftwork/ui/after/a.png,/g/weftwork/ui/after/b.png',
  });
});

test('a comma in the folder: an error, since the list would split there (review round 1)', () => {
  const result = imagesValue('/g,h/weftwork', { before: null, after: shots('after', 'a.png') });
  assert.equal(result.ok, false);
  assert.match(result.ok ? '' : result.error, /has a comma/);
});
