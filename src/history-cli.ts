// story: e15s01
// Thin shell for local history (docs/HISTORY.md). JSON on stdin:
//   {"record": true, "model": "<id>"}  record this branch's task, when the
//                                      owner set `history: local`
//   {} or {"min_tasks": <2-50>}         print the report
// Exit 0 recorded, off or reported; 2 when it cannot (bad input, a bad
// setting or register, no branch, a file it cannot read or write), with the
// reason on stderr. Logic lives in history-store.ts and history-report.ts.
import { readJsonObject, terminalSafe } from './shared/cli-io.ts';
import { isInteger } from './shared/json.ts';
import { historyReport } from './history/history-report.ts';
import { loadHistory } from './history/history-setting.ts';
import { historyPath, readHistory, readImprovements, recordTask } from './history/history-store.ts';
import { classesOf } from './history/history.ts';

const modelPattern = /^[A-Za-z0-9._:/-]{1,80}$/;

function fail(error: string): void {
  process.stderr.write(`history: ${terminalSafe(error)}\n`);
  process.exitCode = 2;
}

async function record(input: Record<string, unknown>): Promise<void> {
  const model = input['model'] ?? null;
  if (model !== null && (typeof model !== 'string' || !modelPattern.test(model))) return fail('model must be a model id: letters, digits and . _ : / -, at most 80');
  const setting = await loadHistory(process.cwd(), process.env);
  if (!setting.ok) return fail(setting.error);
  if (setting.mode === 'off') {
    process.stdout.write('weftwork history: off; set history: local in weftwork.yaml to record (docs/HISTORY.md)\n');
    return;
  }
  const done = await recordTask(process.cwd(), model, new Date());
  if (!done.ok) return fail(done.error);
  const classes = classesOf(done.record);
  process.stdout.write(`weftwork history: recorded ${terminalSafe(done.record.branch)}: ${classes.length === 0 ? 'no failure class' : classes.join(', ')}\n`);
}

async function report(input: Record<string, unknown>): Promise<void> {
  const minTasks = input['min_tasks'] ?? 3;
  if (!isInteger(minTasks) || minTasks < 2 || minTasks > 50) return fail('min_tasks must be an integer from 2 to 50');
  const path = await historyPath(process.cwd());
  if (path === null) return fail('no git dir for the history');
  const read = await readHistory(path);
  if (!read.ok) return fail(`the history cannot be read: ${read.error}`);
  const improvements = await readImprovements(process.cwd());
  if (!improvements.ok) return fail(improvements.error);
  process.stdout.write(historyReport({ records: read.records, skipped: read.skipped, minTasks, improvements: improvements.improvements }));
}

async function main(): Promise<void> {
  const read = await readJsonObject();
  if (read.kind === 'refused') return fail(read.error);
  const known = ['record', 'model', 'min_tasks'];
  const unknown = Object.keys(read.input).find((key) => !known.includes(key));
  if (unknown !== undefined) return fail(`${unknown.slice(0, 40)} is not a known key (known: ${known.join(', ')})`);
  if (read.input['record'] === true) return record(read.input);
  if (read.input['record'] !== undefined && read.input['record'] !== false) return fail('record must be true or false');
  return report(read.input);
}

await main();
