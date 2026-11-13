// story: e07s04
// The live check against hand-edited entries and copies (review rounds 1 and
// 3). An entry changed by hand, or a changed copy of the same handler in the
// local, project or user file, may be the one Claude Code runs, and an async,
// if or short-timeout entry cannot block a stop, so none of them reads as live.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveReport, type LiveInput } from './claude-live.ts';
import { entry, input, settings, source } from './claude-live-test-helpers.ts';

test('an entry changed by hand so it may not block is not live (review B-F1)', () => {
  const changed = [{ ...entry(), async: true }, { ...entry(), if: 'Bash(git *)' }, { ...entry(), timeout: 1 }];
  for (const hook of changed) {
    const report = liveReport(input({ project: source('.claude/settings.json', settings([hook])) }));
    assert.equal(report.answer, 'not-seen', JSON.stringify(hook));
    assert.match(report.reason, /install again/);
  }
});

/** One Stop group per file, so a copy can sit in local or user settings. */
const local = (hooks: unknown[]) => source('.claude/settings.local.json', settings(hooks));
const user = (hooks: unknown[]) => source('/home/u/.claude/settings.json', settings(hooks));

test('a changed copy of the handler in another file is not live, the file named (review round 3, A1, B-1)', () => {
  const cases: [Partial<LiveInput>, RegExp][] = [
    [{ local: local([{ ...entry(), async: true }]) }, /settings\.local\.json/],
    [{ user: user([{ ...entry(), timeout: 1 }]) }, /\/home\/u/],
    [{ project: source('.claude/settings.json', settings([entry(), { ...entry(), if: 'x' }])) }, /\.claude\/settings\.json/],
  ];
  for (const [change, file] of cases) {
    const report = liveReport(input(change));
    assert.equal(report.answer, 'not-seen', JSON.stringify(change));
    assert.match(report.reason, /remove the copy or run the install again/);
    assert.match(report.reason, file);
  }
});

test('an exact copy, or a changed entry for another command, leaves the hook live (review round 3)', () => {
  assert.equal(liveReport(input({ local: local([entry()]) })).answer, 'live');
  assert.equal(liveReport(input({ user: user([{ ...entry('npm run other'), async: true }]) })).answer, 'live');
});

test('a Stop list in local settings that is not a list: cannot tell (review round 3)', () => {
  const report = liveReport(input({ local: source('.claude/settings.local.json', '{"hooks":{"Stop":{}}}') }));
  assert.equal(report.answer, 'not-seen');
  assert.match(report.reason, /settings\.local\.json/);
});
