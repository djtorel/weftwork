// story: e09s04
// The budget report: what the loop has used and the limits in force, on every
// engine answer, done or not, even when no stop rule is on. Models guess the
// budget they have left too high, so the engine shows the count (R15 [S13]
// [S15]). A report never changes a verdict. docs/BUDGET.md, The budget report.
import { defaultMaxFailures, loopRuns } from './breaker.ts';
import { terminalSafe } from './cli-io.ts';
import type { LedgerForRules } from './engine-rules.ts';
import type { GateRequest } from './gate.ts';
import { failingRun } from './ledger.ts';
import type { TokenRead } from './transcript-usage.ts';

/**
 * `runs`: runs of any command since the last done (the loop ceiling's count).
 * `failures`: failed runs in a row of this command (the failure ceiling's
 * count). Both are null when the ledger was not read: it cannot be read, or
 * there is no git working tree. `maxRuns` is null when the loop ceiling is off.
 */
export type BudgetUsed = {
  runs: number | null;
  maxRuns: number | null;
  failures: number | null;
  maxFailures: number;
};

/** The budget used, counted from the ledger the engine read for its answer. */
export function budgetUsed(read: LedgerForRules | null, request: GateRequest): BudgetUsed {
  const counted = read !== null && read.problem !== 'the ledger cannot be read';
  return {
    runs: counted ? loopRuns(read.entries) : null,
    maxRuns: request.maxRuns ?? null,
    failures: counted ? failingRun(read.entries, request.command).length : null,
    maxFailures: request.maxFailures ?? defaultMaxFailures,
  };
}

/** One line for the agent and the owner. It never says "done", so no line of
 * a not-done answer reads as done. Text from outside the engine (a transcript
 * error names a path) goes through terminalSafe. */
export function budgetLine(budget: BudgetUsed, tokens: TokenRead): string {
  const ceiling = (limit: number | null) => (limit === null ? 'no ceiling' : `ceiling ${limit}`);
  const runs = budget.runs === null ? 'runs not counted' : `${budget.runs} runs in this loop`;
  const failures = budget.failures === null ? 'failures not counted' : `${budget.failures} failed in a row`;
  const used = tokens.ok
    ? `tokens ${tokens.tokens.input} input, ${tokens.tokens.output} output, ` +
      `${tokens.tokens.cacheRead} cache read, ${tokens.tokens.cacheWrite} cache write`
    : `tokens not counted (${terminalSafe(tokens.error)})`;
  return (
    `budget: ${runs} (${ceiling(budget.maxRuns)}), ` +
    `${failures} (${ceiling(budget.maxFailures)}), ${used}`
  );
}
