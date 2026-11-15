// story: e06s04, e09s02, e09s03
// The engine: the order of the checks and the logging, so cli.ts stays a thin
// shell and tests call the whole flow without a process.
//
// Order, first match wins: exhausted (counted from the ledger, before the
// run, so no later pass can undo it: the failure ceiling, then the loop
// ceiling of e09s02), blocked (the worker's own word), then the run. After a
// run: done, killed, exhausted, stalled, failed. With maxRuns set, a loop
// that cannot be counted is exhausted: a ledger that cannot be read (F5), a
// run line that cannot be written, or a cut tail with no done. A failed or
// stalled run may then take the owner's override record and answer
// overridden (e06s05); no other state looks at the record. A failed run
// within the handover reserve (e09s03) carries a detail that tells the agent
// to write the handoff before the loop ceiling stops the loop.
//
// `done` comes only from the gate, which never reads the ledger (C4). The
// ledger only decides which not-done state a run ends in. The agent can edit
// the ledger, so it can erase failures to defeat a stop rule, or add failures
// to force one; it cannot make `done` (threat model T3).
import { dirname, join } from 'node:path';
import {
  defaultMaxFailures,
  defaultStallAfter,
  checkCeiling,
  checkLoopCeiling,
  checkReserve,
  checkStall,
  type Trip,
} from './breaker.ts';
import { runLoggedGate, type GateRequest, type Verdict } from './gate.ts';
import {
  appendState,
  failingRun,
  ledgerPath,
  ledgerReadCap,
  readLedgerTail,
  type LedgerEntry,
  type StateEntry,
} from './ledger.ts';
import { takeOverride, type Override } from './override.ts';
import type { State } from './states.ts';

/** A verdict, the state the run ended in, and a short text for some states. */
export type Answer = Verdict & { state: State; detail?: string };

function note(text: string): void {
  process.stderr.write(`weftwork: ${text}\n`);
}

/** The ledger as read for the stop rules. `problem` says why the runs cannot
 * all be seen (null when they can): the ledger cannot be read, or, after a
 * run, the run's line was not written. A missing ledger, or no git working
 * tree, is an empty one. `truncated`: the tail was cut at the read cap. */
type LedgerForRules = { entries: LedgerEntry[]; problem: string | null; truncated: boolean };

/** The entries in the capped tail of the ledger. A ledger that cannot be read
 * is no entries and a note: the stop rules are off for this call unless
 * maxRuns is set (F5), and done is not affected (a passing run still needs
 * the e06s03 write). */
async function readEntries(path: string | null, maxRuns: number | undefined): Promise<LedgerForRules> {
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
function ceilingStop(read: LedgerForRules, request: GateRequest): TrippedRule | null {
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
const handoffCli = join(import.meta.dirname, 'handoff-cli.ts');

/** The detail of a failed run within the handover reserve (e09s03), or none. */
function reserveDetail(read: LedgerForRules, request: GateRequest): { detail?: string } {
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
function stallStop(entries: LedgerEntry[], request: GateRequest): TrippedRule | null {
  const trip = checkStall(entries, request.command, request.stallAfter ?? defaultStallAfter);
  if (trip === null) {
    return null;
  }
  return tripped(trip, `${trip.count} failed runs in a row on the same tree with the same failure`);
}

/** One state line to write: the answer, the ledger as read, and the number
 * that tripped (or null). `overrideFields` is only set for an override. */
type StateWrite = {
  path: string | null;
  entries: LedgerEntry[];
  answer: Answer;
  threshold: number | null;
  overrideFields?: Pick<StateEntry, 'kind' | 'author'>;
};

/** The state line for `write`, with its counters as read from the ledger. */
function stateLine(write: StateWrite): Omit<StateEntry, 'at'> {
  const { entries, answer, threshold, overrideFields = {} } = write;
  const mine = entries.filter((entry) => entry.command === answer.command);
  return {
    state: answer.state,
    command: answer.command,
    runs: mine.length,
    failStreak: failingRun(entries, answer.command).length,
    threshold,
    detail: answer.detail ?? null,
    ...overrideFields,
  };
}

/** Write one state line with its counters. A failed write is a note and does
 * not change the answer. Returns whether the line was written. */
async function logState(write: StateWrite): Promise<boolean> {
  const now = new Date();
  const line = { at: now.toISOString(), ...stateLine(write) };
  const result = write.path === null ? null : await appendState(write.path, line, now);
  if (result?.ok) {
    return true;
  }
  note(`state line not written: ${result === null ? 'no git working tree' : result.error}`);
  return false;
}

/** The answer for a run that did not start. */
function refused(request: GateRequest, state: State, detail: string): Answer {
  return {
    done: false,
    exitCode: null,
    reason: 'not-run',
    command: request.command,
    fingerprint: null,
    state,
    detail,
  };
}

/** Which state a finished run ends in, and the rule that tripped, if any. */
function classify(verdict: Verdict, read: LedgerForRules, request: GateRequest): [Answer, number | null] {
  if (verdict.done) {
    return [{ ...verdict, state: 'done' }, null];
  }
  if (verdict.reason === 'killed') {
    return [{ ...verdict, state: 'killed' }, null];
  }
  const stop = ceilingStop(read, request) ?? stallStop(read.entries, request);
  if (stop === null) {
    return [{ ...verdict, state: 'failed', ...reserveDetail(read, request) }, null];
  }
  return [{ ...verdict, state: stop.state, detail: stop.detail }, stop.threshold];
}

/** The answer for a run that must not start: a ceiling is reached or the
 * worker is blocked. Null when the run may go ahead. */
async function refusedBeforeRun(path: string | null, request: GateRequest): Promise<Answer | null> {
  const before = await readEntries(path, request.maxRuns);
  const stop = ceilingStop(before, request);
  if (stop !== null) {
    const answer = refused(request, 'exhausted', stop.detail);
    await logState({ path, entries: before.entries, answer, threshold: stop.threshold });
    return answer;
  }
  if (request.blocked !== undefined) {
    const answer = refused(request, 'blocked', request.blocked);
    await logState({ path, entries: before.entries, answer, threshold: null });
    return answer;
  }
  return null;
}

/**
 * Decide how a run ends, and log every terminal state. Resolves, never
 * rejects, for an expected failure. `signal` aborts the command (killed).
 */
export async function runEngine(request: GateRequest, signal?: AbortSignal): Promise<Answer> {
  const path = await ledgerPath(request.cwd);
  const refusal = await refusedBeforeRun(path, request);
  if (refusal !== null) {
    return refusal;
  }
  const { verdict, writeProblem } = await runLoggedGate(request, signal);
  const read = await readEntries(path, request.maxRuns);
  // A run whose line was not written is missing from the ledger (e09s02).
  const after = { ...read, problem: read.problem ?? writeProblem };
  const [answer, threshold] = classify(verdict, after, request);
  const overridden = await overrideAnswer({ path, entries: after.entries, answer, threshold }, verdict);
  if (overridden !== null) {
    return overridden;
  }
  if (answer.state !== 'failed') {
    await logState({ path, entries: after.entries, answer, threshold });
  }
  return answer;
}

/**
 * Offer the owner's record to a run that ended `failed` or `stalled` (e06s05).
 * Any other state never looks at it. The record is taken by an atomic rename
 * first, so it is used once; if the state line then cannot be written, the
 * answer stays as it was and the record is spent. A stalled run then goes on
 * to its own state line, so it may note the failed write twice. Says nothing
 * about a record unless it is taken, so a refusal never names the hatch. The
 * overridden run is still a failed run in the ledger, so the ceiling counts
 * it.
 */
async function overrideAnswer(write: StateWrite, verdict: Verdict): Promise<Answer | null> {
  const failedOrStalled = write.answer.state === 'failed' || write.answer.state === 'stalled';
  if (write.path === null || !failedOrStalled) {
    return null;
  }
  const record = await takeRecord(write.path, verdict);
  if (record === null) {
    return null;
  }
  const result: Answer = { ...verdict, state: 'overridden', detail: record.reason };
  const logged = await logState({
    ...write,
    answer: result,
    threshold: null,
    overrideFields: { kind: record.kind, author: record.author },
  });
  return logged ? result : null;
}

/** The owner's record for this run, taken by rename, or null (e06s05). The
 * record lives next to the ledger. */
function takeRecord(path: string, verdict: Verdict): Promise<Override | null> {
  const file = join(dirname(path), 'override.json');
  return takeOverride(file, verdict, new Date());
}
