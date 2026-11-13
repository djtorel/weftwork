// story: e07s04
// The live check against hand-edited entries and copies (review rounds 1 and
// 3). An entry changed by hand, or a changed copy of the same handler in the
// local, project or user file, may be the one Claude Code runs, and an async,
// if or short-timeout entry cannot block a stop, so none of them reads as live.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveReport, type LiveInput } from './claude-live.ts';
import { call, entry, input, settings, source } from './claude-live-test-helpers.ts';

test('an entry changed by hand so it may not block is not live (review B-F1)', () => {
  const changed = [{ ...entry(), async: true }, { ...entry(), if: 'Bash(git *)' }, { ...entry(), timeout: 1 }];
  for (const hook of changed) {
    const report = liveReport(input({ project: source('.claude/settings.json', settings([hook])) }));
    assert.equal(report.answer, 'not-seen', JSON.stringify(hook));
    assert.equal(report.next, 'run-install');
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
    assert.match(report.reason, /changed by hand/);
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
  assert.match(report.reason, /cannot tell whether a changed copy of the entry exists/);
  assert.match(report.reason, /settings\.local\.json/);
});

test('an intact entry only in user settings does not rescue a changed project entry (review round 4, B-1)', () => {
  const report = liveReport(input({
    project: source('.claude/settings.json', settings([{ ...entry(), async: true }])),
    user: user([entry('npm run other')]),
    lastCall: { ok: true, call: { ...call, command: 'npm run other' } },
  }));
  assert.equal(report.answer, 'not-seen');
});

test('a changed copy for another adapter with the same command leaves the hook live (review round 4, A-1)', () => {
  const other = '/other/checkout/src/claude-hook-cli.ts';
  assert.equal(liveReport(input({ user: user([{ ...entry('npm test', other), async: true }]) })).answer, 'live');
});

test('the reason names only files whose changed entry is the project\'s handler (review round 4, A-5)', () => {
  const report = liveReport(input({
    project: source('.claude/settings.json', settings([{ ...entry(), async: true }])),
    user: user([{ ...entry('npm run other'), async: true }]),
  }));
  assert.match(report.reason, /\.claude\/settings\.json/);
  assert.doesNotMatch(report.reason, /\/home\/u/);
});

test('identical entries are one handler, so the notes do not count them twice (review round 4, A-2, B-3)', () => {
  const project = source('.claude/settings.json', settings([entry(), entry()]));
  const report = liveReport(input({ project }));
  assert.equal(report.answer, 'live');
  assert.ok(!report.notes.some((note) => /weftwork Stop hooks are registered/.test(note)), report.notes.join('\n'));
});
