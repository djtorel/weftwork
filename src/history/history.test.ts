// story: e15s01
// Local history (history.ts): one record per task, counted by the engine from
// its own ledger, kept in the clone's common git dir so it outlives the
// worktree, and a report of the failure classes that recur across tasks
// (docs/HISTORY.md; R20: learn only from outcomes the engine saw).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { LedgerEntry, StateEntry } from '../engine/ledger.ts';
import type { ReviewEntry } from '../review/review-ledger.ts';
import type { GuardLine } from '../engine/ledger.ts';
import { classesOf, parseHistory, recurring, summarize, toDesignRound, type TaskRecord } from './history.ts';
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
    history: 2, ...base, runs: 5, failures: 4, longestFailStreak: 3,
    stops: { exhausted: 1, 'overridden-false-alarm': 1 }, guards: { 'weftwork.yaml': 1, main: 1 },
    rounds: 3, reviewCeiling: true, noVerdictRounds: 1, reviewerFailedRounds: 1,
    taskSeconds: 7200, gateSeconds: 0, repeatRuns: 0, repeatSeconds: 0, reviewSeconds: 0,
    designRounds: 0, designSeconds: 0, designNoVerdictRounds: 0, reviewers: {},
  });
  assert.deepEqual(classesOf(record), [
    'gate:failed', 'gate:streak', 'stop:exhausted', 'stop:overridden-false-alarm', 'guard:weftwork.yaml', 'guard:main',
    'review:second-round', 'review:ceiling', 'review:no-verdict', 'review:reviewer-failed',
  ]);
});

test('a round where one reviewer failed and another answered is not a round with no verdict', () => {
  const stood = { ...round('2026-11-15T10:09:00.000Z', 1, 'pass'), failed: ['agy: out of usage: quota'], seconds: 90, reviewers: [{ name: 'agy', seconds: 2, end: 'usage' as const }, { name: 'claude', seconds: 88, end: 'answered' as const }] };
  // A stand-in that was not needed, and a resting reviewer that was not asked, did not fail.
  const spare = { ...round('2026-11-15T10:10:00.000Z', 2, 'pass'), failed: ['codex: stopped: not needed, the panel had answered', 'agy: resting until 11:00Z'], seconds: 60, reviewers: [{ name: 'claude', seconds: 60, end: 'answered' as const }, { name: 'codex', seconds: 30, end: 'not-needed' as const }, { name: 'agy', seconds: 0, end: 'not-asked' as const }] };
  const made = summarize({ ...base, since: null, entries: [], states: [], reviews: [stood, spare], guards: [] });
  assert.equal(made.noVerdictRounds, 0);
  assert.equal(made.reviewerFailedRounds, 1);
  assert.deepEqual(classesOf(made), ['review:second-round', 'review:reviewer-failed']);
  // A record from before version 2 counted both in one number, so its class says only that a reviewer failed.
  assert.deepEqual(classesOf(record('old', '2026-11-01T00:00:00.000Z', { noVerdictRounds: 2 })), ['review:reviewer-failed']);
});

test('a record holds where the time went: the task, the gate runs, the runs on a tree that had already passed, the rounds, and each reviewer', () => {
  const timed = (at: string, done: boolean, seconds: number, fingerprint: string, command = 'npm test'): LedgerEntry => ({ ...run(at, done, command), fingerprint, seconds });
  const made = summarize({
    ...base,
    since: '2026-11-15T10:00:00.000Z',
    entries: [
      timed('2026-11-15T10:01:00.000Z', false, 30.4, 'f1'),
      timed('2026-11-15T10:02:00.000Z', true, 60.2, 'f2'),
      // The Stop hook ran the same command again on the tree that had just passed.
      timed('2026-11-15T10:03:00.000Z', true, 59.6, 'f2'),
      // Another command on that tree is not a repeat.
      timed('2026-11-15T10:04:00.000Z', true, 10, 'f2', 'other'),
    ],
    states: [],
    reviews: [
      { ...round('2026-11-15T10:09:00.000Z', 1, 'block'), seconds: 402.4, reviewers: [{ name: 'agy', seconds: 402.4, end: 'answered' }, { name: 'codex', seconds: 99.6, end: 'not-needed' }] },
      { ...round('2026-11-15T10:20:00.000Z', 2, 'pass'), seconds: 78, reviewers: [{ name: 'agy', seconds: 78, end: 'answered' }] },
    ],
    guards: [],
    design: [
      { at: '2026-11-15T10:30:00.000Z', outcome: 'changes', seconds: 200, reviewers: [{ name: 'agy', seconds: 200, end: 'timeout' }, { name: 'claude', seconds: 150.4, end: 'answered' }] },
      { at: '2026-11-15T10:40:00.000Z', outcome: 'no-verdict', seconds: 10, reviewers: [{ name: 'claude', seconds: 10, end: 'failed' }] },
      { at: '2026-11-15T09:00:00.000Z', outcome: 'pass', seconds: 999, reviewers: [] },
    ],
  });
  assert.equal(made.taskSeconds, 7200);
  assert.equal(made.gateSeconds, 160);
  assert.deepEqual([made.repeatRuns, made.repeatSeconds], [1, 60]);
  assert.equal(made.reviewSeconds, 480);
  assert.deepEqual([made.designRounds, made.designSeconds, made.designNoVerdictRounds], [2, 210, 1]);
  assert.deepEqual(made.reviewers, { agy: { runs: 3, answered: 2, seconds: 680 }, codex: { runs: 1, answered: 0, seconds: 100 }, claude: { runs: 2, answered: 1, seconds: 160 } });
  assert.deepEqual(parseHistory(`${JSON.stringify(made)}\n`), { records: [made], skipped: 0 });
  // A version 2 record with a field missing or wrong is not a record.
  for (const bad of [{ gateSeconds: -1 }, { reviewers: { agy: { runs: 1 } } }, { taskSeconds: 'long' }]) assert.equal(parseHistory(`${JSON.stringify({ ...made, ...bad })}\n`).skipped, 1, JSON.stringify(bad));
});

test('a design round is read from the loop record with only its right fields', () => {
  const reviewers = [{ name: 'claude', seconds: 150.4, end: 'answered' }];
  assert.deepEqual(toDesignRound({ at: '2026-11-15T10:30:00.000Z', outcome: 'pass', seconds: 150.4, reviewers, grades: {} }), { at: '2026-11-15T10:30:00.000Z', outcome: 'pass', seconds: 150.4, reviewers });
  assert.deepEqual(toDesignRound({ at: 'then', outcome: 'changes', seconds: -3, reviewers: [{ name: 'claude' }] }), { at: 'then', outcome: 'changes' });
  for (const bad of [null, 'round', { outcome: 'pass' }, { at: 5, outcome: 'pass' }]) assert.equal(toDesignRound(bad), null);
});

test('the report says where the time went, as medians of the tasks that recorded it, and how each reviewer did', () => {
  const time = (branch: string, task: number, gate: number, repeat: number, review: number, design: number): TaskRecord =>
    record(branch, '2026-11-20T00:00:00.000Z', {
      history: 2, reviewerFailedRounds: 0, taskSeconds: task, gateSeconds: gate, repeatRuns: repeat === 0 ? 0 : 2, repeatSeconds: repeat,
      reviewSeconds: review, designRounds: design === 0 ? 0 : 3, designSeconds: design, designNoVerdictRounds: 0, reviewers: { agy: { runs: 2, answered: 1, seconds: 800 } },
    });
  const records = [time('a', 3000, 600, 120, 300, 0), time('b', 6000, 900, 300, 480, 1200), time('c', 9000, 300, 0, 600, 600), record('old', '2026-11-01T00:00:00.000Z')];
  const text = historyReport({ records, skipped: 0, minTasks: 3, improvements: [] });
  assert.match(text, /^Time, the median of the 3 tasks that recorded it:$/m);
  assert.match(text, /^- a task, from its branch to its record: 100 min$/m);
  assert.match(text, /^- gate runs: 10 min, 2 min of it on a tree that had already passed$/m);
  assert.match(text, /^- review rounds: 8 min$/m);
  assert.match(text, /^- design rounds: 15 min, in the 2 tasks with a design loop$/m);
  assert.match(text, /^Reviewers, in those tasks:$/m);
  assert.match(text, /^- agy: 6 runs, 3 answered, 400 s a run$/m);
  // A task whose runs were under half a second still counts: its record is version 2.
  const quick = historyReport({ records: [time('quick', 40, 0, 0, 0, 0)], skipped: 0, minTasks: 3, improvements: [] });
  assert.match(quick, /^Time, the median of the 1 task that recorded it:$/m);
  assert.match(quick, /^- gate runs: 0 s, 0 s of it on a tree that had already passed$/m);
  // With no task that recorded time, the report has no time section.
  assert.doesNotMatch(historyReport({ records: [record('old', '2026-11-01T00:00:00.000Z')], skipped: 0, minTasks: 3, improvements: [] }), /^Time/m);
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
