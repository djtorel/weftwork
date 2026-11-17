// story: e06s04, e09s02, e09s03, e09s04
// The stop rules as the engine applies them to the ledger it read: the
// failure ceiling, the loop ceiling, the stall rule and the handover reserve,
// with the text each answer gives. Moved out of engine.ts in e09s04, so the
// engine keeps only the order of the checks and the logging.
import { sibling } from '../shared/sibling.ts';
import {
  defaultMaxFailures,
  defaultStallAfter,
  checkCeiling,
  checkLoopCeiling,
  checkReserve,
  checkStall,
  type Trip,
} from './breaker.ts';
import type { GateRequest } from './gate.ts';
import { ledgerReadCap, readLedgerTail, type LedgerEntry } from './ledger.ts';

export function note(text: string): void {
  process.stderr.write(`weftwork: ${text}\n`);
}

/** The ledger as read for the stop rules. `problem` says why the runs cannot
 * all be seen (null when they can): the ledger cannot be read, or, after a
 * run, the run's line was not written. A missing ledger, or no git working
 * tree, is an empty one. `truncated`: the tail was cut at the read cap. */
export type LedgerForRules = { entries: LedgerEntry[]; problem: string | null; truncated: boolean };

/** The entries in the capped tail of the ledger. A ledger that cannot be read
 * is no entries and a note: the stop rules are off for this call unless
 * maxRuns is set (F5), and done is not affected (a passing run still needs
 * the e06s03 write). */
export async function readEntries(path: string | null, maxRuns: number | undefined): Promise<LedgerForRules> {
  if (path === null) {
    return { entries: [], problem: null, truncated: false };
  }
  const read = await readLedgerTail(path, ledgerReadCap);
  // The notes run before the answer is known, so they say what follows for a
  // run that is not done or killed, which a done or killed run is not.
  const loop = `the loop ceiling of ${maxRuns} answers exhausted unless the run is done or killed`;
  if (!read.ok) {
    note(`ledger not read, ${maxRuns === undefined ? 'stop rules off for this call' : loop}: ${read.error}`);
    return { entries: [], problem: 'the ledger cannot be read', truncated: false };
  }
  if (read.truncated) {
    const hidden = read.entries.some((entry) => entry.done) || maxRuns === undefined;
    const effect = hidden ? '' : `; with no done in it, ${loop}`;
    note(`ledger tail was cut at the read cap, so older runs are not counted${effect}`);
  }
  return { entries: read.entries, problem: null, truncated: read.truncated };
}

/** A tripped rule: its state, its threshold, and the text the answer gives. */
type TrippedRule = Pick<Trip, 'state' | 'threshold'> & { detail: string };

function tripped(trip: Trip, detail: string): TrippedRule {
  return { state: trip.state, threshold: trip.threshold, detail };
}

/** The failure ceiling, then the loop ceiling; null when neither is reached. */
export function ceilingStop(read: LedgerForRules, request: GateRequest): TrippedRule | null {
  return failureStop(read.entries, request) ?? loopStop(read, request.maxRuns);
}

/** The failure ceiling of one command, or null. */
function failureStop(entries: LedgerEntry[], request: GateRequest): TrippedRule | null {
  const trip = checkCeiling(entries, request.command, request.maxFailures ?? defaultMaxFailures);
  if (trip === null) {
    return null;
  }
  return tripped(trip, `${trip.count} failed runs in a row, the ceiling is ${trip.threshold}`);
}

/** The loop ceiling (e09s02), or null. A loop that cannot be counted is
 * reached: the ledger cannot be read (F5), the run line was not written, or
 * the tail was cut with no done in it, so older runs of the loop are hidden. */
function loopStop(read: LedgerForRules, maxRuns: number | undefined): TrippedRule | null {
  if (maxRuns === undefined) {
    return null;
  }
  const trip = checkLoopCeiling(read.entries, maxRuns);
  const problem = uncountedReason(read, trip);
  if (problem !== null) {
    const detail = `${problem}, so the loop ceiling of ${maxRuns} cannot be counted`;
    return { state: 'exhausted', threshold: maxRuns, detail };
  }
  if (trip === null) {
    return null;
  }
  return tripped(trip, `${trip.count} runs since the last done, the loop ceiling is ${trip.threshold}`);
}

/** Why the loop cannot be counted, or null. A tail cut with no done in it
 * hides the start of the loop, but only matters when the runs in the tail do
 * not already reach the ceiling: a `trip` already answers exhausted, with the
 * count. */
function uncountedReason(read: LedgerForRules, trip: Trip | null): string | null {
  if (read.problem !== null) {
    return read.problem;
  }
  const hidden = trip === null && read.truncated && !read.entries.some((entry) => entry.done);
  return hidden ? 'the ledger tail was cut with no done in it' : null;
}

/** The handoff CLI (e08s03) by absolute path, for any repository guarded. */
const handoffCli = sibling('handoff-cli');

/** The detail of a failed run within the handover reserve (e09s03), or none. */
export function reserveDetail(read: LedgerForRules, request: GateRequest): { detail?: string } {
  const reserve = checkReserve(read.entries, request.maxRuns, request.reserveRuns);
  if (reserve === null) {
    return {};
  }
  const detail =
    `${reserve.count} runs since the last done, ${reserve.left} left before the loop ceiling of ${request.maxRuns}: ` +
    `write the handoff now with node ${JSON.stringify(handoffCli)} (JSON on stdin: next_skill, branch, note)`;
  return { detail };
}

/** The stall rule, or null. */
export function stallStop(entries: LedgerEntry[], request: GateRequest): TrippedRule | null {
  const trip = checkStall(entries, request.command, request.stallAfter ?? defaultStallAfter);
  if (trip === null) {
    return null;
  }
  return tripped(trip, `${trip.count} failed runs in a row on the same tree with the same failure`);
}
