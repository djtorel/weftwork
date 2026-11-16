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
//
// Every answer carries `budget` (e09s04), counted from the same ledger read
// that decided it. The stop rules themselves are in engine-rules.ts.
//
// One exception to C4, for the Stop hook only (`stopHook`): after the
// refusals, a pass the hook itself ran on the same tree, in the same
// directory and environment, is reused and the command does not run again
// (reuse.ts). It writes no line, so it is not a
// run in the budget. The engine CLI never reuses a pass.
import { dirname, join } from 'node:path';
import { budgetUsed, type BudgetUsed } from './budget-report.ts';
import { terminalSafe } from './cli-io.ts';
import {
  ceilingStop,
  note,
  readEntries,
  reserveDetail,
  stallStop,
  type LedgerForRules,
} from './engine-rules.ts';
import { runLoggedGate, type GateRequest, type Verdict } from './gate.ts';
import { appendState, failingRun, ledgerPath, type LedgerEntry, type StateEntry } from './ledger.ts';
import { takeOverride, type Override } from './override.ts';
import { reusablePass } from './reuse.ts';
import type { State } from './states.ts';

/** A verdict, the state the run ended in, and a short text for some states. */
type Decided = Verdict & { state: State; detail?: string };

/** The engine's answer: what it decided, and the budget used (e09s04). */
export type Answer = Decided & { budget: BudgetUsed };

/** One state line to write: the answer, the ledger as read, and the number
 * that tripped (or null). `overrideFields` is only set for an override. */
type StateWrite = {
  path: string | null;
  entries: LedgerEntry[];
  answer: Decided;
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
function refused(request: GateRequest, state: State, detail: string): Decided {
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
function classify(verdict: Verdict, read: LedgerForRules, request: GateRequest): [Decided, number | null] {
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
async function refusedBeforeRun(
  path: string | null,
  before: LedgerForRules,
  request: GateRequest,
): Promise<Decided | null> {
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
 * The budget is counted from the ledger read that decided the answer: before
 * the run for a refusal, after it otherwise. With no git working tree there
 * is no ledger, so its counts are null.
 */
export async function runEngine(request: GateRequest, signal?: AbortSignal): Promise<Answer> {
  const path = await ledgerPath(request.cwd);
  const { answer, read } = await decide(path, request, signal);
  return { ...answer, budget: budgetUsed(path === null ? null : read, request) };
}

async function decide(
  path: string | null,
  request: GateRequest,
  signal: AbortSignal | undefined,
): Promise<{ answer: Decided; read: LedgerForRules }> {
  const before = await readEntries(path, request.maxRuns);
  const refusal = await refusedBeforeRun(path, before, request);
  if (refusal !== null) {
    return { answer: refusal, read: before };
  }
  const reused = request.stopHook === undefined ? null : await reusedAnswer(path, request, request.stopHook);
  if (reused !== null) {
    return { answer: reused, read: before };
  }
  const { verdict, writeProblem } = await runLoggedGate(request, signal);
  const read = await readEntries(path, request.maxRuns);
  // A run whose line was not written is missing from the ledger (e09s02).
  const after = { ...read, problem: read.problem ?? writeProblem };
  const [answer, threshold] = classify(verdict, after, request);
  const overridden = await overrideAnswer({ path, entries: after.entries, answer, threshold }, verdict);
  if (overridden !== null) {
    return { answer: overridden, read: after };
  }
  if (answer.state !== 'failed') {
    await logState({ path, entries: after.entries, answer, threshold });
  }
  return { answer, read: after };
}

/** A done answer from the Stop hook's own pass on this tree, or null. The
 * detail names the pass's time. */
async function reusedAnswer(path: string | null, request: GateRequest, key: string): Promise<Decided | null> {
  const pass = await reusablePass(path, request, key);
  if (pass === null) {
    return null;
  }
  return {
    done: true,
    exitCode: pass.exitCode,
    reason: 'passed',
    command: request.command,
    fingerprint: pass.fingerprint,
    state: 'done',
    detail: `reused the pass of ${terminalSafe(pass.at)} on this tree`,
  };
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
async function overrideAnswer(write: StateWrite, verdict: Verdict): Promise<Decided | null> {
  const failedOrStalled = write.answer.state === 'failed' || write.answer.state === 'stalled';
  if (write.path === null || !failedOrStalled) {
    return null;
  }
  const record = await takeRecord(write.path, verdict);
  if (record === null) {
    return null;
  }
  const result: Decided = { ...verdict, state: 'overridden', detail: record.reason };
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
