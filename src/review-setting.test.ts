// story: e11s03
// The review setting (review-setting.ts): the council and the round ceilings
// from the `review` mapping of the setting files, the repository file over the
// user file, key by key. A bad value is an error that names the file and key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultCouncil, resolveReview } from './review-setting.ts';

const file = (text: string, path = '/repo/weftwork.yaml') => ({ path, text });

test('no file: one reviewer from another family, 3 rounds, 5 when sensitive, 1200 s', () => {
  const result = resolveReview({ user: null, repo: null });
  assert.deepEqual(result, {
    ok: true,
    review: { council: defaultCouncil, maxRounds: 3, maxRoundsSensitive: 5, timeoutSeconds: 1200 },
  });
  assert.equal(defaultCouncil.length, 1);
  assert.match(defaultCouncil[0] ?? '', /^codex exec .*--sandbox read-only/);
});

test('a file without a review mapping sets nothing; the budget key is left to budget.ts', () => {
  const result = resolveReview({ user: null, repo: file('---\nbudget:\n  maxRuns: 3\n') });
  assert.equal(result.ok && result.review.maxRounds, 3);
});

test('the repository file wins over the user file, key by key; the council is replaced whole', () => {
  const user = file('---\nreview:\n  council: [a, b]\n  max_rounds: 2\n', '/home/u/.config/weftwork/config.yaml');
  const repo = file('---\nreview:\n  council: [c]\n  timeout_seconds: 30\n');
  const result = resolveReview({ user, repo });
  assert.deepEqual(result, {
    ok: true,
    review: { council: ['c'], maxRounds: 2, maxRoundsSensitive: 5, timeoutSeconds: 30 },
  });
});

for (const [name, text, error] of [
  ['an empty council', 'council: []', /review\.council must be a list of 1 to 5 commands/],
  ['a council of 6', 'council: [a, b, c, d, e, f]', /review\.council must be a list of 1 to 5 commands/],
  ['a council entry that is not text', 'council: [1]', /review\.council must be a list of 1 to 5 commands/],
  ['a blank council entry', "council: ['  ']", /review\.council must be a list of 1 to 5 commands/],
  ['max_rounds 0', 'max_rounds: 0', /review\.max_rounds must be an integer from 1 to 10/],
  ['max_rounds as text', "max_rounds: '3'", /review\.max_rounds must be an integer from 1 to 10/],
  ['max_rounds_sensitive 11', 'max_rounds_sensitive: 11', /review\.max_rounds_sensitive must be an integer from 1 to 10/],
  ['timeout_seconds 0', 'timeout_seconds: 0', /review\.timeout_seconds must be an integer from 1 to 3600/],
  ['an unknown key', 'rounds: 3', /review\.rounds is not a known key/],
] as [string, string, RegExp][]) {
  test(`${name}: an error that names the file and the key`, () => {
    const result = resolveReview({ user: null, repo: file(`---\nreview:\n  ${text}\n`) });
    assert.equal(result.ok, false);
    assert.match(result.ok ? '' : result.error, /^\/repo\/weftwork\.yaml: /);
    assert.match(result.ok ? '' : result.error, error);
  });
}

test('a review that is not a mapping, and YAML that is not valid: an error', () => {
  for (const text of ['---\nreview: 3\n', '---\nreview:\n', 'a: [\n']) {
    const result = resolveReview({ user: null, repo: file(text) });
    assert.equal(result.ok, false, text);
  }
});
