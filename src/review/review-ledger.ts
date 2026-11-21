// story: e11s03
// The review lines of the counts ledger: one per review round, so the engine,
// not the agent, counts the rounds against the ceiling (docs/REVIEW.md). The
// writer and the reader stay in ledger.ts; this file holds the shape and the
// validation, as ledger-state.ts does for state lines.
import { isInteger } from '../shared/json.ts';

export type RoundVerdict = 'pass' | 'block' | 'no-verdict';

/** One review round: its verdict, the branch it ran on (null on a detached
 * HEAD), its number and ceiling, and its findings as `<reviewer>: <text>`.
 * From e13s02 it also holds its follow-up findings, the git tree it
 * reviewed and the lines changed from the base; older lines lack them.
 * `answered` names the reviewers that answered, so the next round on the
 * branch asks them first (docs/REVIEW.md § The panel). */
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
};

const verdicts: readonly string[] = ['pass', 'block', 'no-verdict'];

const isTexts = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');

/** The review line in `data`, or null when a field is missing or wrong. */
export function toReview(data: Record<string, unknown>): ReviewEntry | null {
  const { at, review, branch, round, maxRounds, mustFix, shouldFix, followUp, failed, tree, diffLines, answered } = data;
  if (typeof at !== 'string' || typeof review !== 'string' || !verdicts.includes(review)) return null;
  if (!(branch === null || typeof branch === 'string') || !isInteger(round) || !isInteger(maxRounds)) return null;
  if (!isTexts(mustFix) || !isTexts(shouldFix) || !isTexts(failed)) return null;
  const entry: ReviewEntry = { at, review: review as RoundVerdict, branch, round, maxRounds, mustFix, shouldFix, failed };
  // The e13s02 fields are optional: a wrong one is dropped, not the round.
  if (isTexts(followUp)) entry.followUp = followUp;
  if (typeof tree === 'string' && /^[0-9a-f]{40,64}$/.test(tree)) entry.tree = tree;
  if (isInteger(diffLines) && diffLines >= 0) entry.diffLines = diffLines;
  if (isTexts(answered)) entry.answered = answered;
  return entry;
}
