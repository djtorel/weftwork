// story: e06s04, e09s02, e09s03
// The ways the engine stops a run that goes nowhere, as pure functions
// over ledger entries so tests need no process and no repository.
//
// The stall rule keys on evidence that can move: the tree fingerprint, the
// reason and the exit code. It never keys on an identifier that stays
// constant, such as the command's name, which would trip on a run that is
// making progress (R15 [S14]). The thresholds are tunable defaults, not
// findings (R15 [S17]).
import { failingRun, type LedgerEntry } from './ledger.ts';

/** Start values, tunable and unmeasured (R15 [S17]; R10 measures them). */
export const defaultStallAfter = 3;
export const defaultMaxFailures = 5;

/** A stop rule that tripped: which state, the threshold, and the count. */
export type Trip = { state: 'stalled' | 'exhausted'; threshold: number; count: number };

/**
 * `stalled` when the last `stallAfter` failed runs of `command` all share one
 * tree fingerprint, one reason and one exit code, so another run proves
 * nothing. A null fingerprint means the tree was not read, so it is never "the
 * same tree". A pass ends the count. Counts only this exact command string.
 */
export function checkStall(entries: LedgerEntry[], command: string, stallAfter: number): Trip | null {
  const recent = failingRun(entries, command).slice(-stallAfter);
  const first = recent[0];
  if (first === undefined || recent.length < stallAfter || first.fingerprint === null) {
    return null;
  }
  const same = recent.every(
    (entry) =>
      entry.fingerprint === first.fingerprint &&
      entry.reason === first.reason &&
      entry.exitCode === first.exitCode,
  );
  return same ? { state: 'stalled', threshold: stallAfter, count: recent.length } : null;
}

/**
 * `exhausted` when `command` has failed `maxFailures` runs in a row or more.
 * A pass ends the count, as in `countsFor`. The engine checks this before a
 * run too, and does not run at the ceiling, so a later pass cannot undo it.
 */
export function checkCeiling(
  entries: LedgerEntry[],
  command: string,
  maxFailures: number,
): Trip | null {
  const count = failingRun(entries, command).length;
  return count >= maxFailures ? { state: 'exhausted', threshold: maxFailures, count } : null;
}

/**
 * `exhausted` when the loop has used `maxRuns` runs or more: every run of any
 * command since the last done of any command (e09s02). Changing the command
 * does not reset it; only a done opens a new loop. Off when `maxRuns` is
 * undefined, the default (docs/BUDGET.md).
 */
export function checkLoopCeiling(entries: LedgerEntry[], maxRuns: number | undefined): Trip | null {
  if (maxRuns === undefined) {
    return null;
  }
  const count = loopRuns(entries);
  return count >= maxRuns ? { state: 'exhausted', threshold: maxRuns, count } : null;
}

/** The runs of the loop: every run of any command since the last done. */
function loopRuns(entries: LedgerEntry[]): number {
  return entries.length - (entries.findLastIndex((entry) => entry.done) + 1);
}

/** The default handover reserve when the loop ceiling is on (e09s03). */
export const defaultReserveRuns = 1;

/** Runs used in the loop and runs left before the loop ceiling. */
export type Reserve = { count: number; left: number };

/**
 * The handover reserve (e09s03): the runs used and left when the runs left
 * under `maxRuns` are within the reserve, so the agent writes the handoff
 * before the ceiling stops the loop. The reserve is `reserveRuns` (1 when
 * undefined), clamped to `maxRuns - 1`. Null when the ceiling is off, the
 * reserve is 0, or the ceiling is reached (it answers exhausted instead).
 */
export function checkReserve(
  entries: LedgerEntry[],
  maxRuns: number | undefined,
  reserveRuns: number | undefined,
): Reserve | null {
  if (maxRuns === undefined) {
    return null;
  }
  const reserve = Math.min(reserveRuns ?? defaultReserveRuns, maxRuns - 1);
  const count = loopRuns(entries);
  const left = maxRuns - count;
  return left > 0 && left <= reserve ? { count, left } : null;
}
