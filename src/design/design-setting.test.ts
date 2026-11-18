// story: e16s02
// The design loop setting: built-in values with no mapping, the review's
// reviewers by default, the repository file over the user file, and an error
// that names the file and the key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDesign } from './design-setting.ts';

const review = { reviewers: ['codex exec -'], timeoutSeconds: 1200 };

test('no design mapping: 5 rounds, pass mark 4, stall after 2, and the review reviewers', () => {
  const resolved = resolveDesign({ user: null, repo: null }, review);
  assert.ok(resolved.ok);
  assert.deepEqual(resolved.design, { reviewers: ['codex exec -'], maxRounds: 5, pass: 4, stallAfter: 2, timeoutSeconds: 1200 });
});

test('the repository file wins over the user file key by key', () => {
  const user = { path: 'user.yaml', text: 'design:\n  max_rounds: 8\n  pass: 3\n' };
  const repo = { path: 'weftwork.yaml', text: 'design:\n  pass: 5\n  reviewers: [claude -p]\n' };
  const resolved = resolveDesign({ user, repo }, review);
  assert.ok(resolved.ok);
  assert.deepEqual(resolved.design, { reviewers: ['claude -p'], maxRounds: 8, pass: 5, stallAfter: 2, timeoutSeconds: 1200 });
});

test('a bad value or an unknown key is an error that names the file and the key', () => {
  const bad = resolveDesign({ user: null, repo: { path: 'weftwork.yaml', text: 'design:\n  pass: 6\n' } }, review);
  assert.equal(bad.ok, false);
  assert.match(bad.ok ? '' : bad.error, /weftwork\.yaml: design\.pass must be an integer from 1 to 5/);
  const unknown = resolveDesign({ user: null, repo: { path: 'weftwork.yaml', text: 'design:\n  colour: red\n' } }, review);
  assert.match(unknown.ok ? '' : unknown.error, /design\.colour is not a known key/);
});
