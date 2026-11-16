// story: e14s01
// Local history (docs/HISTORY.md): one record per task, counted by the engine
// from its own ledger lines, never from the agent's account of the task.
// R20 found that what an agent learns helps only when it comes from outcomes
// something other than the agent checked (gate runs, review rounds, guard
// blocks, stop states), so a record holds only those counts and names that
// the engine chose. history-store.ts reads and writes the file;
// history-report.ts prints the report.
import { basename } from 'node:path';
import type { GuardLine, LedgerEntry, StateEntry } from './ledger.ts';
import type { ReviewEntry } from './review-ledger.ts';
import { isInteger, isRecord } from './json.ts';

/** One task, as the engine counted it when the task was filed. `model` is the
 * agent's claim, used only to say when a change should be re-checked. */
export type TaskRecord = {
  history: 1;
  at: string;
  branch: string;
  head: string | null;
  model: string | null;
  runs: number;
  failures: number;
  longestFailStreak: number;
  /** Stop states other than done, and overrides by kind, with their counts. */
  stops: Record<string, number>;
  /** Guard blocks by the safe name of what they protected. */
  guards: Record<string, number>;
  rounds: number;
  reviewCeiling: boolean;
  noVerdictRounds: number;
};

export type SummaryInput = {
  at: string;
  branch: string;
  head: string | null;
  model: string | null;
  /** When the branch began, or null to count every line. */
  since: string | null;
  entries: LedgerEntry[];
  states: StateEntry[];
  reviews: ReviewEntry[];
  guards: GuardLine[];
};

const stopStates = new Set(['blocked', 'stalled', 'exhausted', 'killed']);

/** A name made of letters, digits, `.`, `_` and `-` only, at most 60
 * characters, so no path, terminal escape or markup reaches a report. */
export function safeName(text: string): string {
  const name = text.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60);
  return name === '' ? 'unknown' : name;
}

function bump(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

/** The longest run of failed entries in a row for one command. */
function longestStreak(entries: LedgerEntry[]): number {
  const streaks = new Map<string, number>();
  let longest = 0;
  for (const entry of entries) {
    const streak = entry.done ? 0 : (streaks.get(entry.command) ?? 0) + 1;
    streaks.set(entry.command, streak);
    longest = Math.max(longest, streak);
  }
  return longest;
}

function stopCounts(states: StateEntry[]): Record<string, number> {
  const stops: Record<string, number> = {};
  for (const line of states) {
    if (stopStates.has(line.state)) bump(stops, line.state);
    if (line.state === 'overridden') bump(stops, `overridden-${line.kind ?? 'unknown'}`);
  }
  return stops;
}

/** The record of one task: the ledger lines since the branch began, and the
 * review rounds of this branch only. */
export function summarize(input: SummaryInput): TaskRecord {
  const since = input.since;
  const recent = <T extends { at: string }>(lines: T[]): T[] => (since === null ? lines : lines.filter((line) => line.at >= since));
  const entries = recent(input.entries);
  const rounds = recent(input.reviews).filter((round) => round.branch === input.branch);
  const guards: Record<string, number> = {};
  for (const line of recent(input.guards)) bump(guards, safeName(basename(line.target)));
  const last = rounds.at(-1);
  return {
    history: 1,
    at: input.at,
    branch: input.branch,
    head: input.head,
    model: input.model,
    runs: entries.length,
    failures: entries.filter((entry) => !entry.done).length,
    longestFailStreak: longestStreak(entries),
    stops: stopCounts(recent(input.states)),
    guards,
    rounds: rounds.length,
    reviewCeiling: last !== undefined && last.review !== 'pass' && last.round >= last.maxRounds,
    noVerdictRounds: rounds.filter((round) => round.review === 'no-verdict' || round.failed.length > 0).length,
  };
}

/** A gate that failed three times in a row on one command. */
const streakClass = 3;

/** The failure classes of one task, in a fixed order (docs/HISTORY.md). */
export function classesOf(record: TaskRecord): string[] {
  const classes: string[] = [];
  if (record.failures > 0) classes.push('gate:failed');
  if (record.longestFailStreak >= streakClass) classes.push('gate:streak');
  for (const stop of Object.keys(record.stops)) classes.push(`stop:${stop}`);
  for (const target of Object.keys(record.guards)) classes.push(`guard:${target}`);
  if (record.rounds >= 2) classes.push('review:second-round');
  if (record.reviewCeiling) classes.push('review:ceiling');
  if (record.noVerdictRounds > 0) classes.push('review:no-verdict');
  return classes;
}

const isCount = (value: unknown): value is number => isInteger(value) && value >= 0;
const isCounts = (value: unknown): value is Record<string, number> =>
  isRecord(value) && Object.entries(value).every(([key, count]) => safeName(key) === key && isCount(count));
const isNullableText = (value: unknown): value is string | null => value === null || typeof value === 'string';

/** The record in `data`, or null when a field is missing or wrong. The file
 * is in the git dir, where the agent can write, so every field is checked
 * before a report prints it. */
export function toRecord(data: unknown): TaskRecord | null {
  if (!isRecord(data) || data['history'] !== 1) return null;
  const { at, branch, head, model, runs, failures, longestFailStreak, stops, guards, rounds, reviewCeiling, noVerdictRounds } = data;
  if (typeof at !== 'string' || typeof branch !== 'string' || branch === '' || !isNullableText(head) || !isNullableText(model)) return null;
  if (!isCount(runs) || !isCount(failures) || !isCount(longestFailStreak) || !isCount(rounds) || !isCount(noVerdictRounds)) return null;
  if (!isCounts(stops) || !isCounts(guards) || typeof reviewCeiling !== 'boolean') return null;
  return { history: 1, at, branch, head, model, runs, failures, longestFailStreak, stops, guards, rounds, reviewCeiling, noVerdictRounds };
}

/** The records in the file's text, the last one of each branch only (a task
 * filed again replaces its record), oldest first; lines that are not records
 * are skipped and counted. */
export function parseHistory(text: string): { records: TaskRecord[]; skipped: number } {
  const byBranch = new Map<string, TaskRecord>();
  let skipped = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    let record: TaskRecord | null = null;
    try {
      record = toRecord(JSON.parse(line));
    } catch {
      record = null;
    }
    if (record === null) {
      skipped += 1;
      continue;
    }
    byBranch.delete(record.branch);
    byBranch.set(record.branch, record);
  }
  return { records: [...byBranch.values()], skipped };
}

export type Recurring = { cls: string; branches: string[] };

/** Each class found in at least `minTasks` tasks, the most frequent first
 * (ties in class order), with the branches it was found on. */
export function recurring(records: TaskRecord[], minTasks: number): Recurring[] {
  const found = new Map<string, string[]>();
  for (const record of records) {
    for (const cls of classesOf(record)) found.set(cls, [...(found.get(cls) ?? []), record.branch]);
  }
  return [...found.entries()]
    .filter(([, branches]) => branches.length >= minTasks)
    .map(([cls, branches]) => ({ cls, branches }))
    .sort((a, b) => b.branches.length - a.branches.length);
}
