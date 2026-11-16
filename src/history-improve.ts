// story: e15s01
// Accepted improvements (docs/HISTORY.md): weftwork-improvements.yaml, a
// tracked file, lists each change the owner merged to fix a failure class,
// with the day it was accepted. The report counts that class in the tasks
// before and after the day. One-sided Fisher exact test: the chance of seeing
// so few occurrences after if the change did nothing. R20: at one owner's
// volume only large effects can show, an edit's effect may not carry over to
// another model, and a higher mean can hide new failures, so this is a
// count to watch, never a gate.
import type { Failure } from './errors.ts';
import { clip, isMapping, yamlData } from './budget.ts';
import { classesOf, type TaskRecord } from './history.ts';

export type Improvement = { id: string; targets: string; accepted: string; change: string; model?: string };
export type ImprovementsResult = { ok: true; improvements: Improvement[] } | Failure;

/** The register's file name, at the repository root. */
export const improvementsFile = 'weftwork-improvements.yaml';

const knownKeys = ['id', 'targets', 'accepted', 'change', 'model'];
const maxEntries = 200;
const idPattern = /^[a-z0-9][a-z0-9-]{0,59}$/;
const classPattern = /^[a-z]+:[A-Za-z0-9._-]{1,60}$/;
const modelPattern = /^[A-Za-z0-9._:/-]{1,80}$/;

const isDay = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** One entry, or what is wrong with it. YAML 1.2's core schema reads an
 * unquoted date as a string (yamlData), so `accepted` is checked as text. */
function checkEntry(entry: unknown, at: string): { ok: true; improvement: Improvement } | Failure {
  if (!isMapping(entry)) return { ok: false, error: `${at} must be a mapping` };
  const unknown = Object.keys(entry).find((key) => !knownKeys.includes(key));
  if (unknown !== undefined) return { ok: false, error: `${at}.${clip(unknown)} is not a known key (known: ${knownKeys.join(', ')})` };
  const { id, targets, accepted, change, model } = entry;
  if (typeof id !== 'string' || !idPattern.test(id)) return { ok: false, error: `${at}.id must be lower-case letters, digits and -, at most 60` };
  if (typeof targets !== 'string' || !classPattern.test(targets)) return { ok: false, error: `${at}.targets must be a class from the history report, such as gate:failed` };
  if (!isDay(accepted)) return { ok: false, error: `${at}.accepted must be a day as YYYY-MM-DD` };
  if (typeof change !== 'string' || change.trim() === '' || change.length > 200) return { ok: false, error: `${at}.change must be one line of at most 200 characters` };
  if (model !== undefined && (typeof model !== 'string' || !modelPattern.test(model))) return { ok: false, error: `${at}.model must be a model id` };
  const improvement: Improvement = { id, targets, accepted, change: change.replace(/\s+/g, ' ').trim() };
  if (typeof model === 'string') improvement.model = model;
  return { ok: true, improvement };
}

/** The entries of the register's text, or the first problem. */
export function parseImprovements(text: string): ImprovementsResult {
  const parsed = yamlData({ path: improvementsFile, text });
  if (!parsed.ok) return parsed;
  const data = parsed.data;
  if (data === null || data === undefined) return { ok: true, improvements: [] };
  if (!isMapping(data)) return { ok: false, error: 'the top level must be a mapping' };
  const list = data['improvements'];
  if (list === undefined || list === null) return { ok: true, improvements: [] };
  if (!Array.isArray(list) || list.length > maxEntries) return { ok: false, error: `improvements must be a list of at most ${maxEntries}` };
  const improvements: Improvement[] = [];
  for (const [index, entry] of list.entries()) {
    const checked = checkEntry(entry, `improvements[${index}]`);
    if (!checked.ok) return checked;
    if (improvements.some((known) => known.id === checked.improvement.id)) {
      return { ok: false, error: `improvements[${index}].id ${checked.improvement.id} is listed twice` };
    }
    improvements.push(checked.improvement);
  }
  return { ok: true, improvements };
}

export type Counts = { before: number; beforeTasks: number; after: number; afterTasks: number };

function logFactorials(n: number): number[] {
  const table = [0];
  for (let i = 1; i <= n; i++) table.push((table[i - 1] as number) + Math.log(i));
  return table;
}

/** One-sided Fisher exact test: the chance, if the change did nothing, that
 * the tasks after hold as few of the class as they do or fewer. */
export function fisherFewer(counts: Counts): number {
  const { before, beforeTasks, after, afterTasks } = counts;
  const total = beforeTasks + afterTasks;
  const found = before + after;
  const log = logFactorials(total);
  const choose = (n: number, k: number) => (log[n] as number) - (log[k] as number) - (log[n - k] as number);
  let p = 0;
  for (let x = Math.max(0, afterTasks - (total - found)); x <= after; x++) {
    p += Math.exp(choose(found, x) + choose(total - found, afterTasks - x) - choose(total, afterTasks));
  }
  return Math.min(1, p);
}

/** The fewest tasks on each side before a label other than "too few". */
export const minSideTasks = 5;

export type Effect = Counts & {
  p: number;
  label: 'too few tasks since' | 'too few tasks before' | 'more' | 'fewer' | 'no clear change';
  modelChanged: boolean;
};

/** The class an improvement targets, counted before and after its day. */
export function effectOf(improvement: Improvement, records: TaskRecord[]): Effect {
  const has = (record: TaskRecord) => classesOf(record).includes(improvement.targets);
  const isAfter = (record: TaskRecord) => record.at.slice(0, 10) >= improvement.accepted;
  const before = records.filter((record) => !isAfter(record));
  const after = records.filter(isAfter);
  const counts = { before: before.filter(has).length, beforeTasks: before.length, after: after.filter(has).length, afterTasks: after.length };
  const p = fisherFewer(counts);
  const model = improvement.model;
  const modelChanged = model !== undefined && after.some((record) => record.model !== null && record.model !== model);
  return { ...counts, p, label: labelOf(counts, p), modelChanged };
}

function labelOf(counts: Counts, p: number): Effect['label'] {
  if (counts.afterTasks < minSideTasks) return 'too few tasks since';
  if (counts.beforeTasks < minSideTasks) return 'too few tasks before';
  if (counts.after / counts.afterTasks > counts.before / counts.beforeTasks) return 'more';
  return p < 0.05 ? 'fewer' : 'no clear change';
}
