// story: e15s01
// Local history (docs/HISTORY.md): one record per task, counted by the engine
// from its own ledger lines, never from the agent's account of the task.
// R20 found that what an agent learns helps only when it comes from outcomes
// something other than the agent checked (gate runs, review rounds, guard
// blocks, stop states), so a record holds only those counts and names that
// the engine chose. history-store.ts reads and writes the file;
// history-report.ts prints the report.
import { basename } from 'node:path';
import type { GuardLine, LedgerEntry, StateEntry } from '../engine/ledger.ts';
import { toReviewerRuns, type ReviewEntry, type ReviewerRun } from '../review/review-ledger.ts';
import { isInteger, isRecord } from '../shared/json.ts';

/** One task, as the engine counted it when the task was filed. `model` is the
 * agent's claim, used only to say when a change should be re-checked. */
/** One reviewer over a task's review and design rounds: how often it ran,
 * how often it answered, and its seconds in all. */
export type ReviewerStats = { runs: number; answered: number; seconds: number };

export type TaskRecord = {
  /** 2 from when the record counts time. In a version 1 record
   * `noVerdictRounds` also counts each round where a reviewer failed. */
  history: 1 | 2;
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
  /** Version 2 only, in whole seconds (docs/HISTORY.md § Time). Review
   * rounds where a reviewer failed, was out of usage, timed out or was
   * stopped as slow, while the round may still have had a verdict. */
  reviewerFailedRounds?: number;
  /** From the branch's start to this record; null with no reflog. */
  taskSeconds?: number | null;
  gateSeconds?: number;
  /** Gate runs on a tree that had already passed the same command. */
  repeatRuns?: number;
  repeatSeconds?: number;
  reviewSeconds?: number;
  designRounds?: number;
  designSeconds?: number;
  designNoVerdictRounds?: number;
  reviewers?: Record<string, ReviewerStats>;
};

/** One design round, as the loop record keeps it (design-record.ts). */
export type DesignRound = { at: string; outcome: string; seconds?: number; reviewers?: ReviewerRun[] };

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
  /** The rounds of the branch's design loops; none when left out. */
  design?: DesignRound[];
};

const stopStates = new Set(['blocked', 'stalled', 'exhausted', 'killed']);

/** A name made of letters, digits, `.`, `_` and `-` only, at most 60
 * characters, so no path, terminal escape or markup reaches a report. */
export function safeName(text: string): string {
  const name = text.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60);
  return name === '' ? 'unknown' : name;
}

/** Counts by name in a Map, then a plain object with each name as an own
 * key: a name such as `constructor` or `__proto__` must not reach
 * Object.prototype (review r1s1). */
function countBy(keys: string[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return Object.fromEntries(counts);
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
  const keys: string[] = [];
  for (const line of states) {
    if (stopStates.has(line.state)) keys.push(line.state);
    if (line.state === 'overridden') keys.push(`overridden-${line.kind ?? 'unknown'}`);
  }
  return countBy(keys);
}

/** The design round in `data`, a round of a loop record, with only the
 * fields that are right: the record is a file the agent can write. Null
 * when it has no time or outcome. */
export function toDesignRound(data: unknown): DesignRound | null {
  if (!isRecord(data) || typeof data['at'] !== 'string' || typeof data['outcome'] !== 'string') return null;
  const round: DesignRound = { at: data['at'], outcome: data['outcome'] };
  const seconds = data['seconds'];
  if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0) round.seconds = seconds;
  const reviewers = toReviewerRuns(data['reviewers']);
  if (reviewers !== null) round.reviewers = reviewers;
  return round;
}

/** The runs on a tree that had already passed the same command: the pass
 * before them was the answer, so their time bought nothing new. */
function repeats(entries: LedgerEntry[]): LedgerEntry[] {
  const passed = new Set<string>();
  const again: LedgerEntry[] = [];
  for (const entry of entries) {
    if (entry.fingerprint === null) continue;
    const key = JSON.stringify([entry.command, entry.fingerprint]);
    if (passed.has(key)) again.push(entry);
    else if (entry.done) passed.add(key);
  }
  return again;
}

const sum = (values: (number | undefined)[]): number => Math.round(values.reduce<number>((total, value) => total + (value ?? 0), 0));

/** A reviewer failed in the round: by its runs when the line has them, else
 * by its `failed` list (a line from before the runs were kept). */
function reviewerFailed(round: ReviewEntry): boolean {
  if (round.reviewers === undefined) return round.failed.length > 0;
  return round.reviewers.some((run) => run.end === 'failed' || run.end === 'usage' || run.end === 'timeout' || run.end === 'slow');
}

function reviewerStats(runs: ReviewerRun[]): Record<string, ReviewerStats> {
  const stats = new Map<string, ReviewerStats>();
  for (const run of runs) {
    if (run.end === 'not-asked') continue;
    const name = safeName(run.name);
    const one = stats.get(name) ?? { runs: 0, answered: 0, seconds: 0 };
    stats.set(name, { runs: one.runs + 1, answered: one.answered + (run.end === 'answered' ? 1 : 0), seconds: one.seconds + run.seconds });
  }
  return Object.fromEntries([...stats].map(([name, one]) => [name, { ...one, seconds: Math.round(one.seconds) }]));
}

/** The record of one task: the ledger lines since the branch began, and the
 * review rounds of this branch only. */
export function summarize(input: SummaryInput): TaskRecord {
  const since = input.since;
  const recent = <T extends { at: string }>(lines: T[]): T[] => (since === null ? lines : lines.filter((line) => line.at >= since));
  const entries = recent(input.entries);
  const rounds = recent(input.reviews).filter((round) => round.branch === input.branch);
  const guards = countBy(recent(input.guards).map((line) => safeName(basename(line.target))));
  const last = rounds.at(-1);
  const design = recent(input.design ?? []);
  const again = repeats(entries);
  const started = since === null ? Number.NaN : Date.parse(since);
  return {
    history: 2,
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
    noVerdictRounds: rounds.filter((round) => round.review === 'no-verdict').length,
    reviewerFailedRounds: rounds.filter(reviewerFailed).length,
    taskSeconds: Number.isNaN(started) ? null : Math.max(0, Math.round((Date.parse(input.at) - started) / 1000)),
    gateSeconds: sum(entries.map((entry) => entry.seconds)),
    repeatRuns: again.length,
    repeatSeconds: sum(again.map((entry) => entry.seconds)),
    reviewSeconds: sum(rounds.map((round) => round.seconds)),
    designRounds: design.length,
    designSeconds: sum(design.map((round) => round.seconds)),
    designNoVerdictRounds: design.filter((round) => round.outcome === 'no-verdict').length,
    reviewers: reviewerStats([...rounds, ...design].flatMap((round) => round.reviewers ?? [])),
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
  // A version 1 record counted a round where a reviewer failed as one with
  // no verdict, so its count can say only that a reviewer failed.
  if (record.history === 2 && record.noVerdictRounds > 0) classes.push('review:no-verdict');
  if ((record.history === 2 ? (record.reviewerFailedRounds ?? 0) : record.noVerdictRounds) > 0) classes.push('review:reviewer-failed');
  return classes;
}

const isCount = (value: unknown): value is number => isInteger(value) && value >= 0;
const isCounts = (value: unknown): value is Record<string, number> =>
  isRecord(value) && Object.entries(value).every(([key, count]) => safeName(key) === key && isCount(count));
const isNullableText = (value: unknown): value is string | null => value === null || typeof value === 'string';
const isReviewers = (value: unknown): value is Record<string, ReviewerStats> =>
  isRecord(value) && Object.entries(value).every(([name, one]) => safeName(name) === name && isRecord(one) && isCount(one['runs']) && isCount(one['answered']) && isCount(one['seconds']));

/** The record in `data`, or null when a field is missing or wrong. The file
 * is in the git dir, where the agent can write, so every field is checked
 * before a report prints it. */
export function toRecord(data: unknown): TaskRecord | null {
  if (!isRecord(data) || (data['history'] !== 1 && data['history'] !== 2)) return null;
  const { at, branch, head, model, runs, failures, longestFailStreak, stops, guards, rounds, reviewCeiling, noVerdictRounds } = data;
  if (typeof at !== 'string' || typeof branch !== 'string' || branch === '' || !isNullableText(head) || !isNullableText(model)) return null;
  if (!isCount(runs) || !isCount(failures) || !isCount(longestFailStreak) || !isCount(rounds) || !isCount(noVerdictRounds)) return null;
  if (!isCounts(stops) || !isCounts(guards) || typeof reviewCeiling !== 'boolean') return null;
  const first = { at, branch, head, model, runs, failures, longestFailStreak, stops, guards, rounds, reviewCeiling, noVerdictRounds };
  if (data['history'] === 1) return { history: 1, ...first };
  const { reviewerFailedRounds, taskSeconds, gateSeconds, repeatRuns, repeatSeconds, reviewSeconds, designRounds, designSeconds, designNoVerdictRounds, reviewers } = data;
  const counts = [reviewerFailedRounds, gateSeconds, repeatRuns, repeatSeconds, reviewSeconds, designRounds, designSeconds, designNoVerdictRounds];
  if (!counts.every(isCount) || !(taskSeconds === null || isCount(taskSeconds)) || !isReviewers(reviewers)) return null;
  const [failed, gate, again, againSeconds, review, design, designTime, designNone] = counts as number[];
  return {
    history: 2, ...first, reviewerFailedRounds: failed ?? 0, taskSeconds, gateSeconds: gate ?? 0, repeatRuns: again ?? 0, repeatSeconds: againSeconds ?? 0,
    reviewSeconds: review ?? 0, designRounds: design ?? 0, designSeconds: designTime ?? 0, designNoVerdictRounds: designNone ?? 0, reviewers,
  };
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
