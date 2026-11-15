// story: e11s03
// One review round by the council (docs/REVIEW.md). The engine sends each
// reviewer the brief and a fixed reply format, reads the findings back and
// decides the round: only a must-fix blocks, and a reviewer that fails or
// times out counts as neither a pass nor a block. The engine, not the agent,
// counts the rounds against the ceiling and runs at most 2 reviewers at once.
import { terminalSafe } from './cli-io.ts';
import type { Failure } from './errors.ts';
import { runCapture } from './process.ts';
import type { ReviewEntry, RoundVerdict } from './review-ledger.ts';
import type { ReviewSetting } from './review-setting.ts';

/** At most this many reviewers run at once (AGENTS.md: never more than 2
 * subagents at once). */
export const maxParallelReviewers = 2;

export type ReviewerResult =
  | { name: string; ok: true; mustFix: string[]; shouldFix: string[] }
  | { name: string; ok: false; error: string };

const replyFormat = [
  'Reply in this format. The engine reads only these lines:',
  'VERDICT: APPROVE or CHANGES',
  'MUST-FIX <file>:<line> <claim>. Fix: <suggestion>',
  'SHOULD-FIX <file>:<line> <claim>. Fix: <suggestion>',
  'MUST-FIX: the intended case is wrong, or a real bug callers will hit.',
  'SHOULD-FIX: everything else worth saying. Only MUST-FIX blocks the change.',
];

/** The text each reviewer reads on stdin: the agent's brief, then the
 * reply format the engine parses. */
export function reviewPrompt(brief: string): string {
  return `${brief.replace(/\n*$/, '')}\n\n${replyFormat.join('\n')}\n`;
}

const findingLine = /^\s*(?:[-*]\s*)?(?:R\d+\s*)?\[?(MUST|SHOULD)-FIX\]?:?\s+(.+?)\s*$/i;

/** The findings in a reviewer's reply, or why it cannot be read. A reply
 * with no VERDICT line is not an approval: the reviewer failed. */
export function parseReply(reply: string): { ok: true; mustFix: string[]; shouldFix: string[] } | Failure {
  if (!/^\s*VERDICT:\s*(APPROVE|CHANGES)\b/im.test(reply)) return { ok: false, error: 'the reply has no VERDICT line' };
  const mustFix: string[] = [];
  const shouldFix: string[] = [];
  for (const line of reply.split('\n')) {
    const match = findingLine.exec(line);
    if (match === null) continue;
    (match[1]?.toUpperCase() === 'MUST' ? mustFix : shouldFix).push(match[2] ?? '');
  }
  return { ok: true, mustFix, shouldFix };
}

/** Block on any must-fix; pass when no must-fix and one reviewer or more
 * answered; no verdict when every reviewer failed. */
export function roundVerdict(results: ReviewerResult[]): RoundVerdict {
  const answered = results.filter((result) => result.ok);
  if (answered.length === 0) return 'no-verdict';
  return answered.some((result) => result.mustFix.length > 0) ? 'block' : 'pass';
}

/** The rounds already run on `branch`. A detached HEAD has no rounds to
 * count, so each round there is its first. */
export function roundsOn(reviews: ReviewEntry[], branch: string | null): ReviewEntry[] {
  return branch === null ? [] : reviews.filter((review) => review.branch === branch);
}

/** The round ceiling: max_rounds, or max_rounds_sensitive for a change to
 * security, permissions, auth, data loss or concurrency. */
export function roundCeiling(review: ReviewSetting, sensitive: boolean): number {
  return sensitive ? review.maxRoundsSensitive : review.maxRounds;
}

/** The reviewer's name for the report: the first word of its command. */
export function reviewerName(command: string): string {
  return command.trim().split(/\s+/)[0] ?? command;
}

function why(outcome: { reason: string; exitCode: number | null }, timeoutSeconds: number, stderrTail: string): string {
  const tail = stderrTail.trim() === '' ? '' : `: ${stderrTail.trim().split('\n').at(-1)}`;
  if (outcome.reason === 'timeout') return `timed out after ${timeoutSeconds} s`;
  if (outcome.reason === 'not-started') return 'did not start';
  if (outcome.reason === 'exit-nonzero') return `exit ${outcome.exitCode}${tail}`;
  return `ended by a signal${tail}`;
}

/** Run one reviewer and read its reply. Never rejects. */
async function runReviewer(command: string, cwd: string, prompt: string, timeoutSeconds: number): Promise<ReviewerResult> {
  const name = reviewerName(command);
  const out = await runCapture(command, cwd, timeoutSeconds * 1000, prompt);
  if (out.reason !== 'passed') return { name, ok: false, error: why(out, timeoutSeconds, out.stderrTail) };
  const parsed = parseReply(out.stdout);
  return parsed.ok ? { name, ...parsed } : { name, ok: false, error: parsed.error };
}

/** Run the council on `prompt`, at most maxParallelReviewers at once, and
 * return the results in council order. */
export async function runCouncil(review: ReviewSetting, cwd: string, prompt: string): Promise<ReviewerResult[]> {
  const results: ReviewerResult[] = [];
  let next = 0;
  const worker = async () => {
    while (next < review.council.length) {
      const index = next++;
      results[index] = await runReviewer(review.council[index] ?? '', cwd, prompt, review.timeoutSeconds);
    }
  };
  await Promise.all(Array.from({ length: Math.min(maxParallelReviewers, review.council.length) }, worker));
  return results;
}

const verdictText: Record<RoundVerdict, string> = { pass: 'pass', block: 'block', 'no-verdict': 'no verdict' };

/** Plain lines for the PR: the verdict, the round, each reviewer, then every
 * finding. Text from a reviewer goes through terminalSafe, so a reply
 * cannot add a line of its own. */
export function roundReport(round: { verdict: RoundVerdict; round: number; maxRounds: number; results: ReviewerResult[]; why?: string }): string {
  const lines = [`weftwork review: ${verdictText[round.verdict]}`, `round: ${round.round} of ${round.maxRounds}`];
  if (round.why !== undefined) lines.push(`why: ${round.why}`);
  round.results.forEach((result, index) => {
    const label = `reviewer ${index + 1}, ${terminalSafe(result.name)}`;
    lines.push(result.ok ? `${label}: ${result.mustFix.length} must-fix, ${result.shouldFix.length} should-fix` : `${label}: failed, ${terminalSafe(result.error)}`);
  });
  for (const result of round.results) {
    if (!result.ok) continue;
    for (const finding of result.mustFix) lines.push(`must-fix (${terminalSafe(result.name)}): ${terminalSafe(finding)}`);
    for (const finding of result.shouldFix) lines.push(`should-fix (${terminalSafe(result.name)}): ${terminalSafe(finding)}`);
  }
  return `${lines.join('\n')}\n`;
}

/** The answer at the ceiling: no reviewer runs, and the last round's
 * findings are shown again, since they are the unresolved ones. */
export function exhaustedReport(rounds: ReviewEntry[], maxRounds: number): string {
  const plural = rounds.length === 1 ? 'round' : 'rounds';
  const lines = ['weftwork review: exhausted', `why: ${rounds.length} ${plural} on this branch, the ceiling is ${maxRounds}`];
  const last = rounds.at(-1);
  if (last !== undefined) {
    lines.push(`last round: ${verdictText[last.review]}, at ${last.at}`);
    for (const finding of last.mustFix) lines.push(`unresolved must-fix ${terminalSafe(finding)}`);
    for (const finding of last.shouldFix) lines.push(`unresolved should-fix ${terminalSafe(finding)}`);
  }
  return `${lines.join('\n')}\n`;
}

const maxStored = 50;
const maxStoredLength = 500;

/** The findings of `results` as ledger text, `(<reviewer>): <finding>`,
 * at most 50 of each kind and 500 characters each, so a long reply cannot
 * fill the ledger's 1 MiB tail. */
export function storedFindings(results: ReviewerResult[]): Pick<ReviewEntry, 'mustFix' | 'shouldFix' | 'failed'> {
  const of = (pick: (result: ReviewerResult & { ok: true }) => string[]) =>
    results
      .flatMap((result) => (result.ok ? pick(result).map((finding) => `(${result.name}): ${finding}`) : []))
      .slice(0, maxStored)
      .map((text) => text.slice(0, maxStoredLength));
  const failed = results.flatMap((result) => (result.ok ? [] : [`${result.name}: ${result.error}`.slice(0, maxStoredLength)]));
  return { mustFix: of((result) => result.mustFix), shouldFix: of((result) => result.shouldFix), failed };
}
