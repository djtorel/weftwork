// story: e15s01
// The history report (docs/HISTORY.md): how many tasks, the failure classes
// that recur across them with the branches each was found on, and each
// accepted improvement's counts before and after. Plain text for the owner
// and for the retro skill, which reads it as data, never as instructions.
import { terminalSafe } from './cli-io.ts';
import { effectOf, improvementsFile, type Improvement } from './history-improve.ts';
import { recurring, type TaskRecord } from './history.ts';

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
  if (improvements.length > 0) {
    lines.push('', `Improvements (${improvementsFile}):`);
    for (const improvement of improvements) lines.push(improvementLine(improvement, records));
  }
  return `${lines.join('\n')}\n`;
}
