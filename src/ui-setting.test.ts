// story: e11s05
// The UI setting (ui-setting.ts): the screenshot command and the UI paths from
// the `ui` mapping of the setting files, the repository file over the user
// file, key by key. No `ui` mapping means UI checks are off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveUi } from './ui-setting.ts';

const file = (text: string, path = '/repo/weftwork.yaml') => ({ path, text });

test('no file, or no ui mapping: UI checks are off', () => {
  assert.deepEqual(resolveUi({ user: null, repo: null }), { ok: true, ui: null });
  assert.deepEqual(resolveUi({ user: null, repo: file('---\nreview:\n  max_rounds: 2\n') }), { ok: true, ui: null });
});

test('screenshot and paths turn UI checks on, with a 600 s timeout by default', () => {
  const result = resolveUi({ user: null, repo: file("---\nui:\n  screenshot: node shoot.js\n  paths: ['web/**']\n") });
  assert.deepEqual(result, { ok: true, ui: { screenshot: 'node shoot.js', paths: ['web/**'], timeoutSeconds: 600 } });
});

test('the repository file wins over the user file, key by key', () => {
  const user = file('---\nui:\n  screenshot: a\n  paths: [x]\n  timeout_seconds: 30\n', '/home/u/.config/weftwork/config.yaml');
  const repo = file('---\nui:\n  paths: [y, z]\n');
  assert.deepEqual(resolveUi({ user, repo }), { ok: true, ui: { screenshot: 'a', paths: ['y', 'z'], timeoutSeconds: 30 } });
});

for (const [name, text, error] of [
  ['paths without screenshot', 'paths: [a]', /ui needs both screenshot and paths/],
  ['screenshot without paths', 'screenshot: a', /ui needs both screenshot and paths/],
  ['a blank screenshot', "screenshot: ' '\n  paths: [a]", /ui\.screenshot must be a non-empty command/],
  ['empty paths', 'screenshot: a\n  paths: []', /ui\.paths must be a list of 1 to 50 patterns/],
  ['a path that is not text', 'screenshot: a\n  paths: [1]', /ui\.paths must be a list of 1 to 50 patterns/],
  ['timeout 0', 'screenshot: a\n  paths: [a]\n  timeout_seconds: 0', /ui\.timeout_seconds must be an integer from 1 to 3600/],
  ['an unknown key', 'shots: a', /ui\.shots is not a known key/],
] as [string, string, RegExp][]) {
  test(`${name}: an error that names the file`, () => {
    const result = resolveUi({ user: null, repo: file(`---\nui:\n  ${text}\n`) });
    assert.equal(result.ok, false);
    assert.match(result.ok ? '' : result.error, /^\/repo\/weftwork\.yaml: |ui needs/);
    assert.match(result.ok ? '' : result.error, error);
  });
}

test('a ui that is not a mapping: an error', () => {
  const result = resolveUi({ user: null, repo: file('---\nui: 3\n') });
  assert.equal(result.ok, false);
});
