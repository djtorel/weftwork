// story: e15s01
// Local history (history.ts): one record per task, counted by the engine from
// its own ledger, kept in the clone's common git dir so it outlives the
// worktree, and a report of the failure classes that recur across tasks
// (docs/HISTORY.md; R20: learn only from outcomes the engine saw).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { LedgerEntry, StateEntry } from './ledger.ts';
import type { ReviewEntry } from './review-ledger.ts';
import type { GuardLine } from './ledger.ts';
import { classesOf, parseHistory, recurring, summarize, type TaskRecord } from './history.ts';
import { historyReport } from './history-report.ts';

const run = (at: string, done: boolean, command = 'npm test'): LedgerEntry => ({
  at, done, exitCode: done ? 0 : 1, reason: done ? 'passed' : 'failed', command, fingerprint: 'f',
});
const state = (at: string, kind: StateEntry['state'], extra: Partial<StateEntry> = {}): StateEntry => ({
  at, state: kind, command: 'npm test', runs: 1, failStreak: 0, threshold: null, detail: null, ...extra,
});
const round = (at: string, n: number, review: ReviewEntry['review'], branch = 'feat/a', failed: string[] = []): ReviewEntry => ({
  at, review, branch, round: n, maxRounds: 3, mustFix: [], shouldFix: [], failed,
});
const guard = (at: string, target: string): GuardLine => ({ at, guard: 'blocked', tool: 'Bash', target });

const base = { at: '2026-11-15T12:00:00.000Z', branch: 'feat/a', head: 'abc123', model: null };

test('a record counts only the lines since the branch began, and only its own review rounds', () => {
  const record = summarize({
    ...base,
    since: '2026-11-15T10:00:00.000Z',
    entries: [run('2026-11-15T09:00:00.000Z', false), run('2026-11-15T10:01:00.000Z', false), run('2026-11-15T10:02:00.000Z', false),
      run('2026-11-15T10:03:00.000Z', false), run('2026-11-15T10:04:00.000Z', true), run('2026-11-15T10:05:00.000Z', false, 'other')],
    states: [state('2026-11-15T09:00:00.000Z', 'killed'), state('2026-11-15T10:06:00.000Z', 'exhausted'),
      state('2026-11-15T10:07:00.000Z', 'overridden', { kind: 'false-alarm' }), state('2026-11-15T10:08:00.000Z', 'done')],
    reviews: [round('2026-11-15T10:09:00.000Z', 1, 'block'), round('2026-11-15T10:10:00.000Z', 2, 'no-verdict', 'feat/a', ['gemini']),
      round('2026-11-15T10:11:00.000Z', 3, 'block'), round('2026-11-15T10:12:00.000Z', 1, 'pass', 'feat/other')],
    guards: [guard('2026-11-15T09:00:00.000Z', 'old'), guard('2026-11-15T10:13:00.000Z', '/repo/weftwork.yaml'), guard('2026-11-15T10:14:00.000Z', 'main')],
  });
  assert.deepEqual(record, {
    history: 1, ...base, runs: 5, failures: 4, longestFailStreak: 3,
    stops: { exhausted: 1, 'overridden-false-alarm': 1 }, guards: { 'weftwork.yaml': 1, main: 1 },
    rounds: 3, reviewCeiling: true, noVerdictRounds: 1,
  });
  assert.deepEqual(classesOf(record), [
    'gate:failed', 'gate:streak', 'stop:exhausted', 'stop:overridden-false-alarm', 'guard:weftwork.yaml', 'guard:main',
    'review:second-round', 'review:ceiling', 'review:no-verdict',
  ]);
});

test('a clean task has no class, and no since counts every line', () => {
  const record = summarize({ ...base, since: null, entries: [run('2020-01-01T00:00:00.000Z', true)], states: [], reviews: [round('2020-01-01T00:00:00.000Z', 1, 'pass')], guards: [] });
  assert.equal(record.runs, 1);
  assert.deepEqual(classesOf(record), []);
});

test('a guard target is cut to a safe name, so no path or control text reaches a class', () => {
  const record = summarize({ ...base, since: null, entries: [], states: [], reviews: [], guards: [guard('2026-11-15T10:00:00.000Z', '/x/\u001b[31mbad name;rm -rf')] });
  assert.deepEqual(Object.keys(record.guards), ['_31mbad_name_rm_-rf']);
});

test('a guard target named like an Object property is counted as a name, and the record reads back (review r1s1)', () => {
  const guards = ['constructor', 'constructor', '__proto__', 'toString'].map((target) => guard('2026-11-15T10:00:00.000Z', target));
  const record = summarize({ ...base, since: null, entries: [], states: [], reviews: [], guards });
  assert.deepEqual(Object.entries(record.guards), [['constructor', 2], ['__proto__', 1], ['toString', 1]]);
  const parsed = parseHistory(`${JSON.stringify(record)}\n`);
  assert.equal(parsed.skipped, 0);
  assert.deepEqual(classesOf(parsed.records[0] as TaskRecord), ['guard:constructor', 'guard:__proto__', 'guard:toString']);
});

const record = (branch: string, at: string, extra: Partial<TaskRecord> = {}): TaskRecord => ({
  history: 1, at, branch, head: null, model: null, runs: 1, failures: 0, longestFailStreak: 0,
  stops: {}, guards: {}, rounds: 1, reviewCeiling: false, noVerdictRounds: 0, ...extra,
});

test('the last record of a branch wins, and a line that is not a record is skipped and counted', () => {
  const lines = [
    JSON.stringify(record('feat/a', '2026-11-01T00:00:00.000Z', { failures: 2 })),
    '{"torn',
    JSON.stringify({ history: 1, at: 'x' }),
    JSON.stringify(record('feat/b', '2026-11-02T00:00:00.000Z')),
    JSON.stringify(record('feat/a', '2026-11-03T00:00:00.000Z')),
  ];
  const parsed = parseHistory(`${lines.join('\n')}\n`);
  assert.equal(parsed.skipped, 2);
  assert.deepEqual(parsed.records.map((r) => [r.branch, r.failures]), [['feat/b', 0], ['feat/a', 0]]);
});

test('a class recurs when it is in at least the minimum number of tasks, most frequent first', () => {
  const records = [
    record('a', '2026-11-01T00:00:00.000Z', { failures: 1, rounds: 2 }),
    record('b', '2026-11-02T00:00:00.000Z', { failures: 1, rounds: 2 }),
    record('c', '2026-11-03T00:00:00.000Z', { failures: 1 }),
    record('d', '2026-11-04T00:00:00.000Z', { reviewCeiling: true }),
  ];
  assert.deepEqual(recurring(records, 2), [
    { cls: 'gate:failed', branches: ['a', 'b', 'c'] },
    { cls: 'review:second-round', branches: ['a', 'b'] },
  ]);
  assert.deepEqual(recurring(records, 4), []);
});

test('the report names each recurring class with its tasks and says it is a signal, not proof', () => {
  const records = ['a', 'b', 'c'].map((b, i) => record(b, `2026-11-0${i + 1}T00:00:00.000Z`, { failures: 1 }));
  const text = historyReport({ records, skipped: 1, minTasks: 3, improvements: [] });
  assert.match(text, /^weftwork history: 3 tasks, 2026-11-01 to 2026-11-03 \(1 line skipped\)$/m);
  assert.match(text, /^Recurring in 3 or more tasks \(a signal to look into, not proof\):$/m);
  assert.match(text, /^- gate:failed in 3 of 3 tasks: a, b, c$/m);
  assert.equal(historyReport({ records: [], skipped: 0, minTasks: 3, improvements: [] }), 'weftwork history: no tasks recorded (docs/HISTORY.md)\n');
  assert.match(historyReport({ records: records.slice(0, 1), skipped: 0, minTasks: 3, improvements: [] }), /^No class in 3 or more tasks\.$/m);
});
