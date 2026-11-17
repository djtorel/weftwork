// story: e13s05
// Finding outcomes (docs/REVIEW.md, R19): every finding of a review round has
// an id, r<round><m|s|f><n>, from the order the ledger stores the findings.
// The agent records what became of each one, with evidence, in
// `<git dir>/weftwork/review-outcomes.jsonl`, and the report gives each
// reviewer's resolution rate: the share of its must-fix and should-fix
// findings that were fixed, as Cursor and OpenAI score their reviewers. The
// outcomes are the agent's own record: a report, never a gate.
import { terminalSafe } from '../shared/cli-io.ts';
import { isRecord } from '../shared/json.ts';
import type { ReviewEntry } from './review-ledger.ts';

export const outcomes = ['fixed', 'disputed', 'declined', 'follow-up'] as const;
export type Outcome = (typeof outcomes)[number];
export type OutcomeEntry = { at: string; branch: string | null; id: string; outcome: Outcome; evidence: string; finding: string };

type Kind = 'must-fix' | 'should-fix' | 'follow-up';
const kinds: Record<string, Kind> = { m: 'must-fix', s: 'should-fix', f: 'follow-up' };

/** The findings of a review line, by kind. */
function findingsOf(review: ReviewEntry, kind: Kind): string[] {
  return kind === 'must-fix' ? review.mustFix : kind === 'should-fix' ? review.shouldFix : (review.followUp ?? []);
}

/** The finding `id` names among `reviews` (one branch's rounds), or null.
 * A round logged twice is read from its last line. */
export function findingById(reviews: ReviewEntry[], id: string): { round: number; kind: Kind; text: string } | null {
  const match = /^r([1-9]\d*)([msf])([1-9]\d*)$/.exec(id);
  if (match === null) return null;
  const round = Number(match[1]);
  const kind = kinds[match[2] ?? ''] ?? 'must-fix';
  const review = reviews.findLast((entry) => entry.round === round);
  const text = review === undefined ? undefined : findingsOf(review, kind)[Number(match[3]) - 1];
  return text === undefined ? null : { round, kind, text };
}

/** The outcome line in `data`, or null when a field is missing or wrong. */
export function toOutcome(data: unknown): OutcomeEntry | null {
  if (!isRecord(data)) return null;
  const { at, branch, id, outcome, evidence, finding } = data;
  if (typeof at !== 'string' || !(branch === null || typeof branch === 'string') || typeof id !== 'string') return null;
  if (typeof outcome !== 'string' || !(outcomes as readonly string[]).includes(outcome)) return null;
  if (typeof evidence !== 'string' || typeof finding !== 'string') return null;
  return { at, branch, id, outcome: outcome as Outcome, evidence, finding };
}

/** The reviewer a stored finding came from: its `(<name>): ` prefix. */
const reviewerOf = (text: string) => /^\(([^)]*)\):/.exec(text)?.[1] ?? 'unknown';

type Tally = { scored: number; fixed: number; disputed: number; declined: number; open: number; followUp: number };

/** Plain lines for the PR: each finding with its last outcome or `open`,
 * then each reviewer's counts and resolution rate. `reviews` and `outcomes`
 * are one branch's. */
export function outcomeReport(reviews: ReviewEntry[], recorded: OutcomeEntry[]): string {
  if (reviews.length === 0) return 'weftwork review outcomes: no review rounds on this branch\n';
  const last = new Map(recorded.filter((entry) => entry.branch === reviews[0]?.branch).map((entry) => [entry.id, entry.outcome]));
  const rounds = [...new Set(reviews.map((review) => review.round))].sort((a, b) => a - b);
  const lines: string[] = [];
  const tallies = new Map<string, Tally>();
  for (const round of rounds) {
    const review = reviews.findLast((entry) => entry.round === round);
    if (review === undefined) continue;
    for (const [letter, kind] of Object.entries(kinds)) {
      findingsOf(review, kind).forEach((text, index) => {
        const id = `r${round}${letter}${index + 1}`;
        const outcome = last.get(id) ?? 'open';
        lines.push(`${id} ${kind} ${outcome}: ${terminalSafe(text)}`);
        const name = reviewerOf(text);
        const tally = tallies.get(name) ?? { scored: 0, fixed: 0, disputed: 0, declined: 0, open: 0, followUp: 0 };
        if (kind === 'follow-up' || outcome === 'follow-up') tally.followUp += 1;
        if (kind !== 'follow-up') {
          tally.scored += 1;
          if (outcome === 'fixed') tally.fixed += 1;
          else if (outcome === 'disputed') tally.disputed += 1;
          else if (outcome === 'declined') tally.declined += 1;
          else if (outcome === 'open') tally.open += 1;
        }
        tallies.set(name, tally);
      });
    }
  }
  const head = `weftwork review outcomes: ${lines.length} ${lines.length === 1 ? 'finding' : 'findings'} in ${rounds.length} ${rounds.length === 1 ? 'round' : 'rounds'}`;
  for (const [name, t] of [...tallies].sort(([a], [b]) => a.localeCompare(b))) {
    const rate = t.scored === 0 ? 'none' : `${Math.round((100 * t.fixed) / t.scored)}%`;
    lines.push(`reviewer ${terminalSafe(name)}: ${t.scored} must-fix or should-fix, ${t.fixed} fixed, ${t.disputed} disputed, ${t.declined} declined, ${t.open} open; ${t.followUp} follow-up; resolution rate ${rate}`);
  }
  return `${[head, ...lines].join('\n')}\n`;
}
