// story: e11s01
// The settings edit that registers the guard as a PreToolUse hook.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardEntry, guardMatcher, installGuardHook } from './claude-guard-install.ts';

const cli = '/opt/weftwork/src/guard-cli.ts';

function preToolUse(text: string): unknown {
  return (JSON.parse(text) as { hooks: { PreToolUse: unknown } }).hooks.PreToolUse;
}

test('AC-e11s01-11 no settings: one PreToolUse group with the guard entry', () => {
  const result = installGuardHook(null, cli);
  assert.ok(result.ok);
  assert.equal(result.changed, true);
  assert.deepEqual(preToolUse(result.text), [{ matcher: guardMatcher, hooks: [guardEntry(cli)] }]);
  assert.deepEqual(guardEntry(cli), { type: 'command', command: `node '${cli}'`, timeout: 30 });
  assert.equal(guardMatcher, 'Edit|Write|MultiEdit|NotebookEdit|Bash');
});

test('AC-e11s01-12 a second install changes nothing; other hooks and keys stay', () => {
  const owner = { matcher: 'Bash', hooks: [{ type: 'command', command: 'audit.sh' }] };
  const start = JSON.stringify({ model: 'x', hooks: { Stop: [], PreToolUse: [owner] } });
  const first = installGuardHook(start, cli);
  assert.ok(first.ok);
  const second = installGuardHook(first.text, cli);
  assert.ok(second.ok);
  assert.equal(second.changed, false);
  const parsed = JSON.parse(second.text) as Record<string, unknown>;
  assert.equal(parsed.model, 'x');
  assert.deepEqual(preToolUse(second.text), [owner, { matcher: guardMatcher, hooks: [guardEntry(cli)] }]);
});

test('AC-e11s01-12 an edited guard entry is replaced, and a group it emptied is dropped', () => {
  const old = { type: 'command', command: `node '${cli}'`, timeout: 1, async: true };
  const start = JSON.stringify({ hooks: { PreToolUse: [{ matcher: 'Edit', hooks: [old] }] } });
  const result = installGuardHook(start, cli);
  assert.ok(result.ok);
  assert.deepEqual(preToolUse(result.text), [{ matcher: guardMatcher, hooks: [guardEntry(cli)] }]);
});

test('AC-e11s01-12 a PreToolUse value that is not a list is refused; an odd item is kept', () => {
  for (const bad of ['{"hooks":{"PreToolUse":{}}}', '{"hooks":{"PreToolUse":null}}', '[]', '{']) {
    assert.equal(installGuardHook(bad, cli).ok, false, bad);
  }
  const odd = installGuardHook('{"hooks":{"PreToolUse":[1,{"matcher":"Bash"}]}}', cli);
  assert.ok(odd.ok);
  assert.deepEqual(preToolUse(odd.text), [1, { matcher: 'Bash' }, { matcher: guardMatcher, hooks: [guardEntry(cli)] }]);
});
