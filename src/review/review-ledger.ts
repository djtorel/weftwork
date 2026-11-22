// story: e11s03
// The review lines of the counts ledger: one per review round, so the engine,
// not the agent, counts the rounds against the ceiling (docs/REVIEW.md). The
// writer and the reader stay in ledger.ts; this file holds the shape and the
// validation, as ledger-state.ts does for state lines.
import { isInteger } from '../shared/json.ts';

export type RoundVerdict = 'pass' | 'block' | 'no-verdict';

/** How a reviewer's run ended: it answered, failed (not installed, no
 * VERDICT line, a non-zero exit), was out of usage, timed out, was stopped
 * as slow or as not needed, or rested and was not asked. */
export const runEnds = ['answered', 'failed', 'usage', 'timeout', 'slow', 'not-needed', 'not-asked'] as const;
export type RunEnd = (typeof runEnds)[number];

/** One reviewer in a round: how long it ran, in seconds, and how it ended.
 * The history sums these, so the owner sees where the time goes
 * (docs/HISTORY.md § Time). */
export type ReviewerRun = { name: string; seconds: number; end: RunEnd };

const isSeconds = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** The reviewer runs in `value`, or null when one is wrong. */
export function toReviewerRuns(value: unknown): ReviewerRun[] | null {
  if (!Array.isArray(value)) return null;
  const runs: ReviewerRun[] = [];
  for (const item of value as unknown[]) {
    const { name, seconds, end } = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    if (typeof name !== 'string' || !isSeconds(seconds) || !(runEnds as readonly unknown[]).includes(end)) return null;
    runs.push({ name, seconds, end: end as RunEnd });
  }
  return runs;
}

/** One review round: its verdict, the branch it ran on (null on a detached
 * HEAD), its number and ceiling, and its findings as `<reviewer>: <text>`.
 * From e13s02 it also holds its follow-up findings, the git tree it
 * reviewed and the lines changed from the base; older lines lack them.
 * `answered` names the reviewers that answered, so the next round on the
 * branch asks them first (docs/REVIEW.md § The panel). `seconds` is how
 * long the round's reviewers took in all, and `reviewers` each one's run. */
export type ReviewEntry = {
  at: string;
  review: RoundVerdict;
  branch: string | null;
  round: number;
  maxRounds: number;
  mustFix: string[];
  shouldFix: string[];
  followUp?: string[];
  failed: string[];
  tree?: string;
  diffLines?: number;
  answered?: string[];
  seconds?: number;
  reviewers?: ReviewerRun[];
};

const verdicts: readonly string[] = ['pass', 'block', 'no-verdict'];

const isTexts = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');

/** The review line in `data`, or null when a field is missing or wrong. */
export function toReview(data: Record<string, unknown>): ReviewEntry | null {
  const { at, review, branch, round, maxRounds, mustFix, shouldFix, followUp, failed, tree, diffLines, answered, seconds } = data;
  if (typeof at !== 'string' || typeof review !== 'string' || !verdicts.includes(review)) return null;
  if (!(branch === null || typeof branch === 'string') || !isInteger(round) || !isInteger(maxRounds)) return null;
  if (!isTexts(mustFix) || !isTexts(shouldFix) || !isTexts(failed)) return null;
  const entry: ReviewEntry = { at, review: review as RoundVerdict, branch, round, maxRounds, mustFix, shouldFix, failed };
  // The e13s02 fields are optional: a wrong one is dropped, not the round.
  if (isTexts(followUp)) entry.followUp = followUp;
  if (typeof tree === 'string' && /^[0-9a-f]{40,64}$/.test(tree)) entry.tree = tree;
  if (isInteger(diffLines) && diffLines >= 0) entry.diffLines = diffLines;
  if (isTexts(answered)) entry.answered = answered;
  if (isSeconds(seconds)) entry.seconds = seconds;
  const reviewers = toReviewerRuns(data['reviewers']);
  if (reviewers !== null) entry.reviewers = reviewers;
  return entry;
}
