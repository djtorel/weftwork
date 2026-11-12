// story: e06s04
// The three new input keys of parseRequest (e06s04 AC-15): blocked,
// stallAfter and maxFailures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRequest } from './gate.ts';

function parse(extra: Record<string, unknown>) {
  return parseRequest(JSON.stringify({ command: 'true', ...extra }), '/d');
}

const okCases: ReadonlyArray<[string, Record<string, unknown>]> = [
  ['blocked text', { blocked: 'need a key' }],
  ['blocked of 1000 characters', { blocked: 'x'.repeat(1000) }],
  ['stallAfter 2', { stallAfter: 2 }],
  ['stallAfter 1000', { stallAfter: 1000 }],
  ['maxFailures 1', { maxFailures: 1 }],
  ['maxFailures 1000', { maxFailures: 1000 }],
];

for (const [name, extra] of okCases) {
  test(`AC-e06s04-15 parseRequest accepts ${name}`, () => {
    assert.deepEqual(parse(extra), {
      ok: true,
      request: { command: 'true', cwd: '/d', ...extra },
    });
  });
}

const badCases: ReadonlyArray<[string, Record<string, unknown>]> = [
  ['blocked empty', { blocked: '' }],
  ['blocked only spaces', { blocked: '  ' }],
  ['blocked a number', { blocked: 5 }],
  ['blocked of 1001 characters', { blocked: 'x'.repeat(1001) }],
  ['stallAfter 1', { stallAfter: 1 }],
  ['stallAfter a string', { stallAfter: '3' }],
  ['stallAfter 1001', { stallAfter: 1001 }],
  ['stallAfter 2.5', { stallAfter: 2.5 }],
  ['maxFailures 0', { maxFailures: 0 }],
  ['maxFailures 2.5', { maxFailures: 2.5 }],
  ['maxFailures 1001', { maxFailures: 1001 }],
  ['maxFailures null', { maxFailures: null }],
];

for (const [name, extra] of badCases) {
  test(`AC-e06s04-15 parseRequest rejects ${name}`, () => {
    const result = parse(extra);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.notEqual(result.error, '');
    }
  });
}

test('AC-e06s04-15 a request without the new keys has none of them', () => {
  const result = parse({});
  assert.ok(result.ok);
  for (const key of ['blocked', 'stallAfter', 'maxFailures']) {
    assert.equal(key in result.request, false);
  }
});
