// story: e15s01
// The history report (docs/HISTORY.md): how many tasks, the failure classes
// that recur across them with the branches each was found on, and each
// accepted improvement's counts before and after. Plain text for the owner
// and for the retro skill, which reads it as data, never as instructions.
import { terminalSafe } from '../shared/cli-io.ts';
import { effectOf, improvementsFile, type Improvement } from './history-improve.ts';
import { recurring, type ReviewerStats, type TaskRecord } from './history.ts';

export type ReportInput = { records: TaskRecord[]; skipped: number; minTasks: number; improvements: Improvement[] };

/** The most branches named for one class; the rest are counted. */
const maxBranches = 10;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function branchList(branches: string[]): string {
  const shown = branches.slice(-maxBranches).map(terminalSafe).join(', ');
  const more = branches.length - maxBranches;
  return more > 0 ? `${shown} and ${more} more` : shown;
}

function improvementLine(improvement: Improvement, records: TaskRecord[]): string {
  const e = effectOf(improvement, records);
  const counts = `in ${e.before} of ${e.beforeTasks} tasks before, ${e.after} of ${e.afterTasks} after`;
  const model = e.modelChanged ? '; the model changed since, so re-check it' : '';
  return `- ${improvement.id} targets ${improvement.targets}, accepted ${improvement.accepted}: ${counts} (one-sided Fisher p = ${e.p.toFixed(2)}): ${e.label}${model}`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

const span = (seconds: number): string => (seconds < 120 ? `${Math.round(seconds)} s` : `${Math.round(seconds / 60)} min`);

/** Where the time went (docs/HISTORY.md § Time): medians over the tasks
 * whose record holds time (version 2), then each reviewer over those tasks.
 * Empty when no task recorded time. */
function timeLines(records: TaskRecord[]): string[] {
  // Every version 2 record holds time, also one whose runs rounded to 0 s (review round 1).
  const timed = records.filter((record) => record.history === 2);
  if (timed.length === 0) return [];
  const of = (pick: (record: TaskRecord) => number | null | undefined, from = timed): number => median(from.flatMap((record) => pick(record) ?? []));
  const lines = ['', `Time, the median of the ${plural(timed.length, 'task')} that recorded it:`];
  if (timed.some((record) => typeof record.taskSeconds === 'number')) lines.push(`- a task, from its branch to its record: ${span(of((record) => record.taskSeconds))}`);
  lines.push(`- gate runs: ${span(of((record) => record.gateSeconds))}, ${span(of((record) => record.repeatSeconds))} of it on a tree that had already passed`);
  lines.push(`- review rounds: ${span(of((record) => record.reviewSeconds))}`);
  const designed = timed.filter((record) => (record.designRounds ?? 0) > 0);
  if (designed.length > 0) lines.push(`- design rounds: ${span(of((record) => record.designSeconds, designed))}, in the ${plural(designed.length, 'task')} with a design loop`);
  const reviewers = new Map<string, ReviewerStats>();
  for (const record of timed) {
    for (const [name, one] of Object.entries(record.reviewers ?? {})) {
      const all = reviewers.get(name) ?? { runs: 0, answered: 0, seconds: 0 };
      reviewers.set(name, { runs: all.runs + one.runs, answered: all.answered + one.answered, seconds: all.seconds + one.seconds });
    }
  }
  if (reviewers.size > 0) lines.push('Reviewers, in those tasks:');
  for (const [name, all] of reviewers) lines.push(`- ${terminalSafe(name)}: ${plural(all.runs, 'run')}, ${all.answered} answered, ${all.runs === 0 ? 0 : Math.round(all.seconds / all.runs)} s a run`);
  return lines;
}

/** The report text. Records are oldest first. */
export function historyReport(input: ReportInput): string {
  const { records, skipped, minTasks, improvements } = input;
  if (records.length === 0) return 'weftwork history: no tasks recorded (docs/HISTORY.md)\n';
  const days = records.map((record) => record.at.slice(0, 10)).sort();
  const skip = skipped === 0 ? '' : ` (${plural(skipped, 'line')} skipped)`;
  const lines = [`weftwork history: ${plural(records.length, 'task')}, ${terminalSafe(days[0] ?? '')} to ${terminalSafe(days.at(-1) ?? '')}${skip}`, ''];
  const found = recurring(records, minTasks);
  if (found.length === 0) {
    lines.push(`No class in ${minTasks} or more tasks.`);
  } else {
    lines.push(`Recurring in ${minTasks} or more tasks (a signal to look into, not proof):`);
    for (const { cls, branches } of found) lines.push(`- ${cls} in ${branches.length} of ${records.length} tasks: ${branchList(branches)}`);
  }
  lines.push(...timeLines(records));
  if (improvements.length > 0) {
    lines.push('', `Improvements (${improvementsFile}):`);
    for (const improvement of improvements) lines.push(improvementLine(improvement, records));
  }
  return `${lines.join('\n')}\n`;
}
