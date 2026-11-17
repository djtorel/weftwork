// story: e11s03
// The review setting (review-setting.ts): the reviewers and the round ceilings
// from the `review` mapping of the setting files, the repository file over the
// user file, key by key. A bad value is an error that names the file and key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { defaultReviewers, resolveReview } from './review-setting.ts';

const file = (text: string, path = '/repo/weftwork.yaml') => ({ path, text });

test('no file: one reviewer from another family, 3 rounds, 5 when sensitive, 1200 s', () => {
  const result = resolveReview({ user: null, repo: null });
  assert.deepEqual(result, {
    ok: true,
    review: { reviewers: defaultReviewers, maxRounds: 3, maxRoundsSensitive: 5, timeoutSeconds: 1200, sensitivePaths: [] },
  });
  assert.equal(defaultReviewers.length, 1);
  assert.match(defaultReviewers[0] ?? '', /^codex exec .*--sandbox read-only/);
});

test('the built-in reviewer attaches the screenshots with --image only when WEFTWORK_IMAGES is set (e11s06)', () => {
  // The same shell text, with codex exec swapped for printf, shows the argv codex would get.
  const argv = (env: NodeJS.ProcessEnv) => spawnSync((defaultReviewers[0] ?? '').replace(/^codex exec/, "printf '[%s]'"), { shell: true, env, encoding: 'utf8' }).stdout;
  assert.equal(argv({ PATH: process.env['PATH'], WEFTWORK_IMAGES: '/a b/x.png,/y.png' }), '[--ignore-user-config][--sandbox][read-only][--ephemeral][--image][/a b/x.png,/y.png][-]');
  assert.equal(argv({ PATH: process.env['PATH'] }), '[--ignore-user-config][--sandbox][read-only][--ephemeral][-]');
});

test('a file without a review mapping sets nothing; the budget key is left to budget.ts', () => {
  const result = resolveReview({ user: null, repo: file('---\nbudget:\n  max_runs: 3\n') });
  assert.equal(result.ok && result.review.maxRounds, 3);
});

test('the repository file wins over the user file, key by key; the reviewers are replaced whole', () => {
  const user = file('---\nreview:\n  reviewers: [a, b]\n  max_rounds: 2\n', '/home/u/.config/weftwork/config.yaml');
  const repo = file('---\nreview:\n  reviewers: [c]\n  timeout_seconds: 30\n');
  const result = resolveReview({ user, repo });
  assert.deepEqual(result, {
    ok: true,
    review: { reviewers: ['c'], maxRounds: 2, maxRoundsSensitive: 5, timeoutSeconds: 30, sensitivePaths: [] },
  });
});

for (const [name, text, error] of [
  ['an empty reviewers list', 'reviewers: []', /review\.reviewers must be a list of 1 to 5 commands/],
  ['6 reviewers', 'reviewers: [a, b, c, d, e, f]', /review\.reviewers must be a list of 1 to 5 commands/],
  ['a reviewer that is not text', 'reviewers: [1]', /review\.reviewers must be a list of 1 to 5 commands/],
  ['a blank reviewer', "reviewers: ['  ']", /review\.reviewers must be a list of 1 to 5 commands/],
  ['max_rounds 0', 'max_rounds: 0', /review\.max_rounds must be an integer from 1 to 10/],
  ['max_rounds as text', "max_rounds: '3'", /review\.max_rounds must be an integer from 1 to 10/],
  ['max_rounds_sensitive 11', 'max_rounds_sensitive: 11', /review\.max_rounds_sensitive must be an integer from 1 to 10/],
  ['timeout_seconds 0', 'timeout_seconds: 0', /review\.timeout_seconds must be an integer from 1 to 3600/],
  ['an unknown key', 'rounds: 3', /review\.rounds is not a known key/],
  ['the old council key', 'council: [a]', /review\.council was renamed to review\.reviewers/],
  ['sensitive_paths that is not a list', 'sensitive_paths: src/guard.ts', /review\.sensitive_paths must be a list of 1 to 100 glob patterns/],
  ['an empty sensitive_paths', 'sensitive_paths: []', /review\.sensitive_paths must be a list of 1 to 100 glob patterns/],
  ['a blank sensitive path', "sensitive_paths: ['']", /review\.sensitive_paths must be a list of 1 to 100 glob patterns/],
] as [string, string, RegExp][]) {
  test(`${name}: an error that names the file and the key`, () => {
    const result = resolveReview({ user: null, repo: file(`---\nreview:\n  ${text}\n`) });
    assert.equal(result.ok, false);
    assert.match(result.ok ? '' : result.error, /^\/repo\/weftwork\.yaml: /);
    assert.match(result.ok ? '' : result.error, error);
  });
}

test('sensitive_paths: the glob patterns whose files make a change sensitive (e13s02)', () => {
  const result = resolveReview({ user: null, repo: file("---\nreview:\n  sensitive_paths: ['src/guard*.ts', '**/auth/**']\n") });
  assert.deepEqual(result.ok && result.review.sensitivePaths, ['src/guard*.ts', '**/auth/**']);
});

test('a review that is not a mapping, and YAML that is not valid: an error', () => {
  for (const text of ['---\nreview: 3\n', '---\nreview:\n', 'a: [\n']) {
    const result = resolveReview({ user: null, repo: file(text) });
    assert.equal(result.ok, false, text);
  }
});
