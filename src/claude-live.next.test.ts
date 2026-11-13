// story: e07s04
// What the live check tells the owner to do next (review round 5, A-F1,
// A-F2, B-3), and a record older than the settings it is matched against
// (B-1). Each answer carries the one step that can change it: the install
// only edits the project file and refuses a file it cannot read, and a new
// session stop only helps when the settings are already right.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveReport, type LiveInput, type NextStep } from './claude-live.ts';
import { call, entry, input, settings, source } from './claude-live-test-helpers.ts';

const project = (hooks: unknown[], extra: Record<string, unknown> = {}) =>
  source('.claude/settings.json', settings(hooks, extra));
const changedAt = (iso: string) =>
  ({ name: '.claude/settings.json', read: { ok: true, text: settings([entry()]), changedAt: new Date(iso) } }) as const;

const cases: [string, Partial<LiveInput>, NextStep | null][] = [
  ['live', {}, null],
  ['no entry', { project: project([]) }, 'run-install'],
  ['adapter gone', { exists: () => false }, 'run-install'],
  ['project not JSON', { project: source('.claude/settings.json', '{') }, 'fix-settings'],
  ['hooks off', { project: project([entry()], { disableAllHooks: true }) }, 'turn-hooks-on'],
  ['disableAllHooks not a boolean', { project: project([entry()], { disableAllHooks: 1 }) }, 'fix-settings'],
  ['local not JSON', { local: source('.claude/settings.local.json', '{') }, 'fix-settings'],
  ['local Stop not a list', { local: source('.claude/settings.local.json', '{"hooks":{"Stop":1}}') }, 'fix-settings'],
  ['project entry changed', { project: project([{ ...entry(), async: true }]) }, 'run-install'],
  ['user copy changed', { user: source('/home/u/.claude/settings.json', settings([{ ...entry(), async: true }])) }, 'remove-copy'],
  ['no call', { lastCall: { ok: true, call: null } }, 'stop-once'],
  ['record unreadable', { lastCall: { ok: false, error: 'not a call record' } }, 'stop-once'],
  ['another command', { lastCall: { ok: true, call: { ...call, command: 'other' } } }, 'stop-once'],
];

test('each answer carries the one step that can change it (review round 5)', () => {
  for (const [name, change, next] of cases) {
    assert.equal(liveReport(input(change)).next, next, name);
  }
});

test('a record from before the last settings change is not live (review round 5, B-1)', () => {
  const report = liveReport(input({ project: changedAt('2026-11-12T11:59:00.000Z') }));
  assert.equal(report.answer, 'not-seen');
  assert.match(report.reason, /changed after the last call/);
  assert.equal(report.next, 'stop-once');
});

test('a record from after the last settings change is live (review round 5, B-1)', () => {
  assert.equal(liveReport(input({ project: changedAt('2026-11-12T11:57:00.000Z') })).answer, 'live');
});

test('a change to the local or user settings after the last call counts too (review round 5, B-1)', () => {
  const after = new Date('2026-11-12T11:59:00.000Z');
  for (const change of [
    { local: { name: '.claude/settings.local.json', read: { ok: true, text: '{}', changedAt: after } } },
    { user: { name: '/home/u/.claude/settings.json', read: { ok: true, text: '{}', changedAt: after } } },
  ] as const) {
    assert.equal(liveReport(input(change)).answer, 'not-seen', JSON.stringify(change));
  }
});
