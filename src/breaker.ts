// story: e06s04
// The two ways the engine stops a run that goes nowhere, as pure functions
// over ledger entries so tests need no process and no repository.
//
// The stall rule keys on evidence that can move: the tree fingerprint, the
// reason and the exit code. It never keys on an identifier that stays
// constant, such as the command's name, which would trip on a run that is
// making progress (R15 [S14]). The thresholds are tunable defaults, not
// findings (R15 [S17]).
import { failingRun, type LedgerEntry } from './ledger.ts';

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
