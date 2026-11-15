// story: e11s03
// The review lines of the counts ledger: one per review round, so the engine,
// not the agent, counts the rounds against the ceiling (docs/REVIEW.md). The
// writer and the reader stay in ledger.ts; this file holds the shape and the
// validation, as ledger-state.ts does for state lines.
import { isInteger } from './json.ts';

export type RoundVerdict = 'pass' | 'block' | 'no-verdict';

/** One review round: its verdict, the branch it ran on (null on a detached
 * HEAD), its number and ceiling, and its findings as `<reviewer>: <text>`. */
export type ReviewEntry = {
  at: string;
  review: RoundVerdict;
  branch: string | null;
  round: number;
  maxRounds: number;
  mustFix: string[];
  shouldFix: string[];
  failed: string[];
};

const verdicts: readonly string[] = ['pass', 'block', 'no-verdict'];

const isTexts = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');

/** The review line in `data`, or null when a field is missing or wrong. */
export function toReview(data: Record<string, unknown>): ReviewEntry | null {
  const { at, review, branch, round, maxRounds, mustFix, shouldFix, failed } = data;
  if (typeof at !== 'string' || typeof review !== 'string' || !verdicts.includes(review)) return null;
  if (!(branch === null || typeof branch === 'string') || !isInteger(round) || !isInteger(maxRounds)) return null;
  if (!isTexts(mustFix) || !isTexts(shouldFix) || !isTexts(failed)) return null;
  return { at, review: review as RoundVerdict, branch, round, maxRounds, mustFix, shouldFix, failed };
}
