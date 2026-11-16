// story: e14s01
// Accepted improvements (history-improve.ts): the owner merges a change with
// an entry in weftwork-improvements.yaml naming the failure class it targets,
// and the history report counts that class in the tasks before and after,
// with a one-sided Fisher exact test, and says when the model has changed
// since (R20: an edit's effect is model-specific and small samples prove
// little).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectOf, fisherFewer, parseImprovements } from './history-improve.ts';
import type { TaskRecord } from './history.ts';
import { historyReport } from './history-report.ts';

const record = (day: string, failed: boolean, model: string | null = null): TaskRecord => ({
  history: 1, at: `2026-11-${day}T12:00:00.000Z`, branch: `b${day}`, head: null, model, runs: 1, failures: failed ? 1 : 0,
  longestFailStreak: 0, stops: {}, guards: {}, rounds: 1, reviewCeiling: false, noVerdictRounds: 0,
});

const register = `---
improvements:
  - id: typecheck-hook
    targets: gate:failed
    accepted: 2026-11-10
    change: Run the typecheck before the tests
    model: opus-5
`;

test('the register parses each entry, and a bad entry is an error that names it', () => {
  assert.deepEqual(parseImprovements(register), { ok: true, improvements: [
    { id: 'typecheck-hook', targets: 'gate:failed', accepted: '2026-11-10', change: 'Run the typecheck before the tests', model: 'opus-5' },
  ] });
  assert.deepEqual(parseImprovements('---\n'), { ok: true, improvements: [] });
  const bad = (text: string) => { const parsed = parseImprovements(text); return parsed.ok ? '' : parsed.error; };
  assert.match(bad('---\nimprovements:\n  - id: Bad Id\n    targets: gate:failed\n    accepted: 2026-11-10\n    change: x\n'), /improvements\[0\]\.id/);
  assert.match(bad('---\nimprovements:\n  - id: a\n    targets: gate:failed\n    accepted: 10/11/2026\n    change: x\n'), /improvements\[0\]\.accepted/);
  assert.match(bad('---\nimprovements:\n  - id: a\n    targets: gate:failed\n    accepted: 2026-11-10\n    change: x\n    extra: 1\n'), /improvements\[0\]\.extra is not a known key/);
  assert.match(bad('---\nimprovements: 3\n'), /improvements must be a list/);
  assert.match(bad('---\nimprovements:\n  - id: a\n    targets: gate:failed\n    accepted: 2026-11-10\n    change: x\n  - id: a\n    targets: gate:failed\n    accepted: 2026-11-11\n    change: y\n'), /improvements\[1\]\.id a is listed twice/);
});

test('the one-sided Fisher test gives the chance of so few occurrences after if the change did nothing', () => {
  // 6 of 8 before, 0 of 8 after: C(8,0)C(8,6)... over C(16,8); known value 0.00350.
  assert.equal(fisherFewer({ before: 6, beforeTasks: 8, after: 0, afterTasks: 8 }).toFixed(5), '0.00350');
  assert.equal(fisherFewer({ before: 1, beforeTasks: 4, after: 1, afterTasks: 4 }).toFixed(4), '0.7857');
  assert.equal(fisherFewer({ before: 0, beforeTasks: 5, after: 0, afterTasks: 5 }), 1);
});

test('the effect counts the class before and after the date, and labels it only with enough tasks', () => {
  const improvement = { id: 'typecheck-hook', targets: 'gate:failed', accepted: '2026-11-10', change: 'c', model: 'opus-5' };
  const before = ['01', '02', '03', '04', '05', '06', '07', '08'].map((d, i) => record(d, i < 6, 'opus-5'));
  const after = ['10', '11', '12', '13', '14', '15', '16', '17'].map((d) => record(d, false, 'opus-5'));
  const effect = effectOf(improvement, [...before, ...after]);
  assert.deepEqual({ ...effect, p: effect.p.toFixed(4) }, { before: 6, beforeTasks: 8, after: 0, afterTasks: 8, p: '0.0035', label: 'fewer', modelChanged: false });
  assert.equal(effectOf(improvement, [...before, ...after.slice(0, 4)]).label, 'too few tasks since');
  assert.equal(effectOf(improvement, [...before.slice(3), ...after.slice(0, 5).map((r) => ({ ...r, failures: 1 }))]).label, 'more');
  assert.equal(effectOf(improvement, [...before.slice(4), ...after]).label, 'too few tasks before');
  assert.equal(effectOf(improvement, [...before, ...after.slice(0, 5).map((r, i) => ({ ...r, failures: i < 3 ? 1 : 0 }))]).label, 'no clear change');
  assert.equal(effectOf(improvement, [...before, record('18', false, 'sonnet-5')]).modelChanged, true);
});

test('the report gives each improvement its counts, its p and a re-check note when the model changed', () => {
  const improvement = { id: 'typecheck-hook', targets: 'gate:failed', accepted: '2026-11-10', change: 'c', model: 'opus-5' };
  const records = [record('01', true), record('02', true), record('11', false, 'sonnet-5')];
  const text = historyReport({ records, skipped: 0, minTasks: 3, improvements: [improvement] });
  assert.match(text, /^Improvements \(weftwork-improvements\.yaml\):$/m);
  assert.match(text, /^- typecheck-hook targets gate:failed, accepted 2026-11-10: in 2 of 2 tasks before, 0 of 1 after \(one-sided Fisher p = 0\.33\): too few tasks since; the model changed since, so re-check it$/m);
});
