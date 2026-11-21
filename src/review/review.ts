// story: e11s03
// One review round by the reviewers (docs/REVIEW.md). The engine sends each
// reviewer the brief and a fixed reply format, reads the findings back and
// decides the round: only a must-fix blocks, and a reviewer that fails or
// times out counts as neither a pass nor a block. The engine, not the agent,
// counts the rounds against the ceiling and runs at most 2 reviewers at once.
import { terminalSafe } from '../shared/cli-io.ts';
import type { Failure } from '../shared/errors.ts';
import { maxCaptureBytes, runCapture } from '../engine/process.ts';
import type { ReviewEntry, RoundVerdict } from './review-ledger.ts';
import { anchorOf } from './review-scope.ts';
import type { ReviewSetting } from './review-setting.ts';

/** At most this many reviewers run at once (AGENTS.md: never more than 2
 * subagents at once). */
export const maxParallelReviewers = 2;

export type ReviewerResult =
  | { name: string; ok: true; mustFix: string[]; shouldFix: string[]; followUp: string[]; score?: number }
  | { name: string; ok: false; error: string };

const replyFormat = [
  'Reply in this format. The engine reads only these lines:',
  'VERDICT: APPROVE or CHANGES',
  'MUST-FIX <file>:<line> <claim>. Fix: <suggestion>',
  'SHOULD-FIX <file>:<line> <claim>. Fix: <suggestion>',
  'FOLLOW-UP <file>:<line> <claim>. Fix: <suggestion>',
  'MUST-FIX: the intended case is wrong, or this change causes a bug callers will hit, in any file.',
  'SHOULD-FIX: everything else worth saying about this change.',
  'FOLLOW-UP: a real defect this change did not cause; it goes to the backlog.',
  'Only MUST-FIX blocks the change, and only when its <file>:<line> exists.',
];

/** The text each reviewer reads on stdin: the agent's brief, then the
 * reply format the engine parses. */
export function reviewPrompt(brief: string): string {
  return `${brief.replace(/\n*$/, '')}\n\n${replyFormat.join('\n')}\n`;
}

const scoreLine = /^\s*UI-SCORE:\s*(\d+(?:\.\d+)?)\b/im;

const findingLine = /^\s*(?:[-*]\s*)?(?:R\d+\s*)?\[?(MUST-FIX|SHOULD-FIX|FOLLOW-UP)\]?:?\s+(.+?)\s*$/i;

/** The findings in a reviewer's reply, or why it cannot be read. A reply
 * with no VERDICT line is not an approval: the reviewer failed. */
export function parseReply(reply: string): { ok: true; mustFix: string[]; shouldFix: string[]; followUp: string[]; score?: number } | Failure {
  if (!/^\s*VERDICT:\s*(APPROVE|CHANGES)\b/im.test(reply)) return { ok: false, error: 'the reply has no VERDICT line' };
  const found: Record<string, string[]> = { 'MUST-FIX': [], 'SHOULD-FIX': [], 'FOLLOW-UP': [] };
  for (const line of reply.split('\n')) {
    const match = findingLine.exec(line);
    if (match !== null) found[match[1]?.toUpperCase() ?? '']?.push(match[2] ?? '');
  }
  const findings = { mustFix: found['MUST-FIX'] ?? [], shouldFix: found['SHOULD-FIX'] ?? [], followUp: found['FOLLOW-UP'] ?? [] };
  // A UI score (e11s05) is reported, never a gate: roundVerdict does not read it.
  const score = Number(scoreLine.exec(reply)?.[1] ?? Number.NaN);
  return score >= 0 && score <= 10 ? { ok: true, ...findings, score } : { ok: true, ...findings };
}

/** The audit every round asks for (e13s03, R19): the four things large
 * teams' reviewers check, named by the engine so a thin brief cannot drop
 * one, and a security audit in the same pass for a sensitive change.
 * `ruleFiles` are the project's rule files that exist. */
export function auditPrompt(input: { sensitive: boolean; ruleFiles: string[] }): string {
  const rules =
    input.ruleFiles.length === 0
      ? '3. Rules: the conventions in the surrounding code; a change that breaks one, and a doc the change makes out of date.'
      : `3. Rules: the project rules in ${input.ruleFiles.join(', ')}; a change that breaks one, and a doc or rule the change makes out of date.`;
  const lines = [
    'Audit the change for each of these, in this order:',
    '1. Correctness: the intended case, the callers of what changed, error paths and edge cases the intent names.',
    '2. Proof: for each behaviour change, a test that would fail without it; a test that passes on the old code too proves nothing. Check that the claims in the brief (checks run, results) match the repository.',
    rules,
    '4. Scope: code, tests, options or guards the intent does not need, and changes outside the intent.',
  ];
  if (input.sensitive) {
    lines.push(
      '5. Security: input from outside (files, env, network, model output) reaching a shell, a path or a parser; path traversal and symlinks; secrets in code, logs or errors; a check that fails open; a race between a check and its use.',
    );
  }
  lines.push('You may run read-only commands (git, grep, a focused test) to confirm a finding; do not change files. A finding you could not confirm is SHOULD-FIX.');
  return lines.join('\n');
}

const maxListed = 100;

function listed(items: string[]): string {
  if (items.length === 0) return '- none';
  const shown = items.slice(0, maxListed).map((item) => `- ${item}`);
  if (items.length > maxListed) shown.push(`- and ${items.length - maxListed} more`);
  return shown.join('\n');
}

/** What a later round reviews (e13s02, R19): the files changed since the
 * last round and the must-fix findings still open, from the engine, not the
 * agent's brief. A regression the change causes still blocks wherever it is. */
export function laterRoundPrompt(round: number, changed: string[], open: string[]): string {
  return [
    `This is round ${round}. Review only what changed since round ${round - 1} and the must-fix findings still open; round 1 reviewed the whole change.`,
    `Files changed since round ${round - 1}:`,
    listed(changed),
    `Must-fix findings open after round ${round - 1}:`,
    listed(open),
    'Say for each open finding whether it is resolved. A new MUST-FIX must be a bug this change causes, wherever it is. Report a defect the change did not cause as FOLLOW-UP. Do not repeat a finding the author answered unless you have new evidence.',
  ].join('\n');
}

/** The results with each must-fix on a file that did not change since the
 * last round, and that no open must-fix named, marked as new. The mark is
 * for the author and the PR; the finding still blocks (R19 review round 1). */
export function newOnUnchanged(results: ReviewerResult[], last: { round: number; changed: string[]; open: string[] }): ReviewerResult[] {
  const known = new Set([...last.changed, ...last.open.flatMap((finding) => anchorOf(finding)?.file ?? [])]);
  const mark = (finding: string) => {
    const file = anchorOf(finding)?.file;
    return file === undefined || known.has(file) ? finding : `${finding} [new, on a file unchanged since round ${last.round - 1}]`;
  };
  return results.map((result) => (result.ok ? { ...result, mustFix: result.mustFix.map(mark) } : result));
}

/** The diff line for the report (e13s02): the lines changed from the base
 * and, from round 2, at round 1. Past twice round 1 and 200 lines more, a
 * note says to cut the diff. It is a report, not a gate (CONVENTIONS.md:
 * gates follow an observed failure). */
export function diffReport(lines: number, first: number | undefined): string[] {
  if (first === undefined) return [`diff: ${lines} lines changed from the base`];
  const report = [`diff: ${lines} lines changed from the base, ${first} at round 1`];
  if (lines > Math.max(2 * first, first + 200)) report.push('diff growth: past twice round 1 and 200 lines more; cut the diff before the next round');
  return report;
}

/** Block on any must-fix; pass when no must-fix and one reviewer or more
 * answered; no verdict when every reviewer failed. */
export function roundVerdict(results: ReviewerResult[]): RoundVerdict {
  const answered = results.filter((result) => result.ok);
  if (answered.length === 0) return 'no-verdict';
  return answered.some((result) => result.mustFix.length > 0) ? 'block' : 'pass';
}

/** The rounds already run on `branch`. A detached HEAD (null) has none;
 * review-cli.ts refuses to run a round there, so the ceiling holds. */
export function roundsOn(reviews: ReviewEntry[], branch: string | null): ReviewEntry[] {
  return branch === null ? [] : reviews.filter((review) => review.branch === branch);
}

/** The rounds done on a branch: the highest round number logged, so rounds
 * that fell out of the ledger tail still count (review round 1). */
export function roundsDone(rounds: ReviewEntry[]): number {
  return Math.max(rounds.length, ...rounds.map((review) => review.round));
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
async function runReviewer(command: string, cwd: string, prompt: string, timeoutSeconds: number, env?: NodeJS.ProcessEnv): Promise<ReviewerResult> {
  const name = reviewerName(command);
  const out = await runCapture(command, cwd, timeoutSeconds * 1000, prompt, env);
  if (out.reason !== 'passed') return { name, ok: false, error: why(out, timeoutSeconds, out.stderrTail) };
  // A cut reply could drop a must-fix after the VERDICT line (review round 1).
  if (out.stdoutCut) return { name, ok: false, error: `the reply is larger than ${maxCaptureBytes} bytes` };
  const parsed = parseReply(out.stdout);
  return parsed.ok ? { name, ...parsed } : { name, ok: false, error: parsed.error };
}

/** Run `commands` in order until `panel` of them answered, at most
 * maxParallelReviewers at once: one that fails (not installed, out of quota,
 * timed out, no VERDICT line) is replaced by the next (docs/REVIEW.md § The
 * panel). The results of those that ran, in the order they started. */
export async function runPanel<T extends { ok: boolean }>(commands: readonly string[], panel: number, run: (command: string) => Promise<T>): Promise<T[]> {
  const results: T[] = [];
  let next = 0;
  let answered = 0;
  while (answered < panel && next < commands.length) {
    const wave = commands.slice(next, next + Math.min(maxParallelReviewers, panel - answered));
    next += wave.length;
    const done = await Promise.all(wave.map(run));
    results.push(...done);
    answered += done.filter((result) => result.ok).length;
  }
  return results;
}

/** The order a round tries the reviewers in: those that answered the last
 * round first (by name, as the ledger keeps them), so the reviewer that
 * raised a finding checks it, then the rest in setting order. */
export function panelOrder(commands: readonly string[], answeredLast: readonly string[] = []): string[] {
  // By position, so two entries of one command both stay (review round 3).
  const first: number[] = [];
  for (const name of answeredLast) {
    const index = commands.findIndex((command, at) => !first.includes(at) && reviewerName(command) === name);
    if (index !== -1) first.push(index);
  }
  const rest = commands.map((_, at) => at).filter((at) => !first.includes(at));
  return [...first, ...rest].map((at) => commands[at] ?? '');
}

/** How many reviewers must answer: review.panel, raised to all of them for a
 * sensitive change or by the request ("all" or a number), never lowered by
 * it; at most the number of reviewers. */
export function roundPanel(review: Pick<ReviewSetting, 'reviewers' | 'panel'>, input: { asked: number | 'all' | undefined; sensitive: boolean }): { size: number; why: string } {
  const all = review.reviewers.length;
  const asked = input.asked === 'all' ? all : (input.asked ?? 0);
  const [size, why] = input.sensitive ? [all, 'a sensitive change'] : asked > review.panel ? [asked, 'asked for in the request'] : [review.panel, 'review.panel'];
  return { size: Math.min(size, all), why };
}

/** Run the reviewers on `prompt` as a panel of `panel`, in `order`. `env`
 * is each reviewer's environment (e11s06: WEFTWORK_IMAGES for a UI change). */
export async function runReviewers(order: readonly string[], panel: number, timeoutSeconds: number, cwd: string, prompt: string, env?: NodeJS.ProcessEnv): Promise<ReviewerResult[]> {
  return runPanel(order, panel, (command) => runReviewer(command, cwd, prompt, timeoutSeconds, env));
}

const verdictText: Record<RoundVerdict, string> = { pass: 'pass', block: 'block', 'no-verdict': 'no verdict' };

/** Plain lines for the PR: the verdict, the round, each reviewer, then every
 * finding. Text from a reviewer goes through terminalSafe, so a reply
 * cannot add a line of its own. */
export function roundReport(round: { verdict: RoundVerdict; round: number; maxRounds: number; results: ReviewerResult[]; why?: string; notes?: string[]; screenshots?: string[] }): string {
  const lines = [`weftwork review: ${verdictText[round.verdict]}`, `round: ${round.round} of ${round.maxRounds}`];
  if (round.why !== undefined) lines.push(`why: ${round.why}`);
  lines.push(...(round.notes ?? []));
  round.results.forEach((result, index) => {
    const label = `reviewer ${index + 1}, ${terminalSafe(result.name)}`;
    const followUps = result.ok && result.followUp.length > 0 ? `, ${result.followUp.length} follow-up` : '';
    lines.push(result.ok ? `${label}: ${result.mustFix.length} must-fix, ${result.shouldFix.length} should-fix${followUps}` : `${label}: failed, ${terminalSafe(result.error)}`);
  });
  // Ids count each kind across reviewers in setting order, the order
  // storedFindings logs them in (e13s05, review-outcome.ts); past the 50 it
  // keeps, a finding has no id (review round 1).
  const count = { m: 0, s: 0, f: 0 };
  const line = (word: string, kind: 'm' | 's' | 'f', name: string, finding: string) => {
    const n = ++count[kind];
    const text = terminalSafe(finding);
    lines.push(n <= maxStored ? `${word} r${round.round}${kind}${n} (${name}): ${text}` : `${word} none (${name}): ${text} [not stored: the ledger keeps ${maxStored} of each kind]`);
  };
  for (const result of round.results) {
    if (!result.ok) continue;
    const name = terminalSafe(result.name);
    for (const finding of result.mustFix) line('must-fix', 'm', name, finding);
    for (const finding of result.shouldFix) line('should-fix', 's', name, finding);
    for (const finding of result.followUp) line('follow-up', 'f', name, finding);
  }
  for (const result of round.results) {
    if (result.ok && result.score !== undefined) lines.push(`ui score (${terminalSafe(result.name)}): ${result.score} of 10, reported, not a gate`);
  }
  lines.push(...(round.screenshots ?? []));
  return `${lines.join('\n')}\n`;
}

/** The answer at the ceiling: no reviewer runs, and the last round's
 * findings are shown again, since they are the unresolved ones. */
export function exhaustedReport(rounds: ReviewEntry[], maxRounds: number): string {
  const done = roundsDone(rounds);
  const lines = ['weftwork review: exhausted', `why: ${done} ${done === 1 ? 'round' : 'rounds'} on this branch, the ceiling is ${maxRounds}`];
  const last = rounds.at(-1);
  if (last !== undefined) {
    lines.push(`last round: ${verdictText[last.review]}, at ${last.at}`);
    last.mustFix.forEach((finding, index) => lines.push(`unresolved must-fix r${last.round}m${index + 1} ${terminalSafe(finding)}`));
    last.shouldFix.forEach((finding, index) => lines.push(`unresolved should-fix r${last.round}s${index + 1} ${terminalSafe(finding)}`));
    (last.followUp ?? []).forEach((finding, index) => lines.push(`unresolved follow-up r${last.round}f${index + 1} ${terminalSafe(finding)}`));
  }
  return `${lines.join('\n')}\n`;
}

const maxStored = 50;
const maxStoredLength = 500;

/** The findings of `results` as ledger text, `(<reviewer>): <finding>`,
 * at most 50 of each kind and 500 characters each, so a long reply cannot
 * fill the ledger's 1 MiB tail. */
export function storedFindings(results: ReviewerResult[]): Pick<ReviewEntry, 'mustFix' | 'shouldFix' | 'followUp' | 'failed'> {
  const of = (pick: (result: ReviewerResult & { ok: true }) => string[]) =>
    results
      .flatMap((result) => (result.ok ? pick(result).map((finding) => `(${result.name}): ${finding}`) : []))
      .slice(0, maxStored)
      .map((text) => text.slice(0, maxStoredLength));
  const failed = results.flatMap((result) => (result.ok ? [] : [`${result.name}: ${result.error}`.slice(0, maxStoredLength)]));
  return { mustFix: of((result) => result.mustFix), shouldFix: of((result) => result.shouldFix), followUp: of((result) => result.followUp), failed };
}
