// story: e11s03
// The resting record (reviewer-rest.ts): a reviewer that ran out of usage,
// timed out or was stopped as slow is not asked again for an hour, so a
// later round does not wait on it.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempDirs, makeTempDir } from '../test-support/test-helpers.ts';
import { askOrder, keepResting, readResting } from './reviewer-rest.ts';

after(cleanupTempDirs);

const noon = new Date('2026-11-21T12:00:00.000Z');
const later = (minutes: number) => new Date(noon.getTime() + minutes * 60000);

test('a reviewer that must rest is kept for an hour, then asked again', () => {
  const path = join(makeTempDir(), 'weftwork', 'reviewers-resting.json');
  assert.deepEqual(readResting(path, noon), {});
  // A round that changes nothing writes no file.
  assert.equal(keepResting(path, [{ name: 'claude', ok: true }], noon), null);
  assert.equal(existsSync(path), false);
  const results = [
    { name: 'agy', ok: false, error: 'out of usage: quota', rest: true },
    { name: 'codex', ok: false, error: 'exit 7' },
    { name: 'claude', ok: true },
  ] as const;
  assert.equal(keepResting(path, results, noon), null);
  assert.deepEqual(readResting(path, later(59)), { agy: { until: '2026-11-21T13:00:00.000Z', why: 'out of usage: quota' } });
  assert.deepEqual(readResting(path, later(60)), {});
});

test('a reviewer that answers rests no more, and a record that cannot be read rests no one', () => {
  const path = join(makeTempDir(), 'reviewers-resting.json');
  keepResting(path, [{ name: 'agy', ok: false, error: 'timed out after 1200 s', rest: true }], noon);
  assert.equal(keepResting(path, [{ name: 'agy', ok: true }], later(1)), null);
  assert.equal(readFileSync(path, 'utf8'), '{}\n');
  for (const text of ['not json', '[]', '{"agy":{"until":5,"why":"x"}}', '{"agy":{"until":"never","why":"x"}}']) {
    writeFileSync(path, text);
    assert.deepEqual(readResting(path, noon), {}, text);
  }
});

test('a resting reviewer is not asked, and the report says until when and why', () => {
  const resting = { agy: { until: '2026-11-21T13:00:00.000Z', why: 'out of usage: quota' } };
  assert.deepEqual(askOrder(['agy -p x', 'codex exec -', 'claude -p'], resting), {
    ask: ['codex exec -', 'claude -p'],
    skipped: [{ name: 'agy', ok: false, error: 'resting until 2026-11-21T13:00Z (out of usage: quota)', skipped: true, seconds: 0, end: 'not-asked' }],
  });
  // With every reviewer resting there would be no verdict, so each is asked.
  const all = { a: resting.agy, b: resting.agy };
  assert.deepEqual(askOrder(['a -', 'b -'], all), { ask: ['a -', 'b -'], skipped: [] });
});
