// story: e10s01
// The guard setting (guard-setting.ts): the owner's extra protected paths from
// the `guard.protected` list of the setting files. Both files add to the list;
// neither can take a path off it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveGuard } from './guard-setting.ts';

const file = (text: string, path = '/repo/weftwork.yaml') => ({ path, text });

test('AC-e10s01-05 no file, or no guard mapping: no extra paths', () => {
  assert.deepEqual(resolveGuard({ user: null, repo: null }), { ok: true, protected: [] });
  assert.deepEqual(resolveGuard({ user: null, repo: file('---\nreview:\n  max_rounds: 2\n') }), { ok: true, protected: [] });
});

test('AC-e10s01-06 the user file and the repository file both add paths', () => {
  const user = file("---\nguard:\n  protected: ['.claude/skills/']\n", '/home/u/.config/weftwork/config.yaml');
  const repo = file("---\nguard:\n  protected: ['docs/security/', '*.sqlite']\n");
  assert.deepEqual(resolveGuard({ user, repo }), { ok: true, protected: ['.claude/skills/', 'docs/security/', '*.sqlite'] });
});

for (const [name, text, error] of [
  ['an unknown key', 'allow: [a]', /guard\.allow is not a known key \(known: protected\)/],
  ['an empty list', 'protected: []', /guard\.protected must be a list of 1 to 100 patterns/],
  ['a pattern that is not text', 'protected: [1]', /guard\.protected must be a list of 1 to 100 patterns/],
  ['a blank pattern', "protected: [' ']", /guard\.protected must be a list of 1 to 100 patterns/],
  ['a pattern that leaves the folder', "protected: ['../x']", /guard\.protected must be a list of 1 to 100 patterns/],
] as const) {
  test(`AC-e10s01-07 ${name} is an error that names the file`, () => {
    const result = resolveGuard({ user: null, repo: file(`---\nguard:\n  ${text}\n`) });
    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.error.startsWith('/repo/weftwork.yaml: '), !result.ok ? result.error : '');
    assert.match(!result.ok ? result.error : '', error);
  });
}

test('AC-e10s01-07 a guard that is not a mapping is an error', () => {
  const result = resolveGuard({ user: null, repo: file('---\nguard: [a]\n') });
  assert.deepEqual(result, { ok: false, error: '/repo/weftwork.yaml: guard must be a mapping' });
});
