// story: e06s04
// The engine: the order of the checks and the logging, so cli.ts stays a thin
// shell and tests call the whole flow without a process.
//
// Order, first match wins: exhausted (counted from the ledger, before the
// run, so no later pass can undo it), blocked (the worker's own word), then
// the run. After a run: done, killed, exhausted, stalled, failed.
//
// `done` comes only from runGate, which never reads the ledger (C4). The
// ledger only decides which not-done state a run ends in. The agent can edit
// the ledger, so it can erase failures to defeat a stop rule, or add failures
// to force one; it cannot make `done` (threat model T3).
import { defaultMaxFailures, defaultStallAfter, checkCeiling, checkStall, type Trip } from './breaker.ts';
import { runGate, type GateRequest, type Verdict } from './gate.ts';
import {
  appendState,
  failingRun,
  ledgerPath,
  ledgerReadCap,
  readLedgerTail,
  type LedgerEntry,
} from './ledger.ts';
import type { State } from './states.ts';

/** A verdict, the state the run ended in, and a short text for some states. */
export type Answer = Verdict & { state: State; detail?: string };

function note(text: string): void {
  process.stderr.write(`weftwork: ${text}\n`);
}

/** The entries in the capped tail of the ledger. A ledger that cannot be read
 * is no entries and a note: the stop rules are off for this call, and done is
 * not affected (a passing run still needs the e06s03 write). */
async function readEntries(path: string | null): Promise<LedgerEntry[]> {
  if (path === null) {
    return [];
  }
  const read = await readLedgerTail(path, ledgerReadCap);
  if (!read.ok) {
    note(`ledger not read, stop rules off for this call: ${read.error}`);
    return [];
  }
  if (read.truncated) {
    note('ledger tail was cut at the read cap, so older runs are not counted');
  }
  return read.entries;
}

function describe(trip: Trip): string {
  return trip.state === 'stalled'
    ? `${trip.count} failed runs in a row on the same tree with the same failure`
    : `${trip.count} failed runs in a row, the ceiling is ${trip.threshold}`;
}

/** Write one state line with its counters. A failed write is a note and does
 * not change the answer. */
async function logState(
  path: string | null,
  entries: LedgerEntry[],
  answer: Answer,
  threshold: number | null,
): Promise<void> {
  const now = new Date();
  const mine = entries.filter((entry) => entry.command === answer.command);
  const line = {
    at: now.toISOString(),
    state: answer.state,
    command: answer.command,
    runs: mine.length,
    failStreak: failingRun(entries, answer.command).length,
    threshold,
    detail: answer.detail ?? null,
  };
  const result = path === null ? null : await appendState(path, line, now);
  if (!result?.ok) {
    note(`state line not written: ${result === null ? 'no git working tree' : result.error}`);
  }
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
function classify(verdict: Verdict, entries: LedgerEntry[], request: GateRequest): [Answer, number | null] {
  if (verdict.done) {
    return [{ ...verdict, state: 'done' }, null];
  }
  if (verdict.reason === 'killed') {
    return [{ ...verdict, state: 'killed' }, null];
  }
  const trip =
    checkCeiling(entries, request.command, request.maxFailures ?? defaultMaxFailures) ??
    checkStall(entries, request.command, request.stallAfter ?? defaultStallAfter);
  if (trip === null) {
    return [{ ...verdict, state: 'failed' }, null];
  }
  return [{ ...verdict, state: trip.state, detail: describe(trip) }, trip.threshold];
}

/**
 * Decide how a run ends, and log every terminal state. Resolves, never
 * rejects, for an expected failure. `signal` aborts the command (killed).
 */
export async function runEngine(request: GateRequest, signal?: AbortSignal): Promise<Answer> {
  const path = await ledgerPath(request.cwd);
  const before = await readEntries(path);
  const ceiling = checkCeiling(before, request.command, request.maxFailures ?? defaultMaxFailures);
  if (ceiling !== null) {
    const answer = refused(request, 'exhausted', describe(ceiling));
    await logState(path, before, answer, ceiling.threshold);
    return answer;
  }
  if (request.blocked !== undefined) {
    const answer = refused(request, 'blocked', request.blocked);
    await logState(path, before, answer, null);
    return answer;
  }
  const verdict = await runGate(request, signal);
  const after = await readEntries(path);
  const [answer, threshold] = classify(verdict, after, request);
  if (answer.state !== 'failed') {
    await logState(path, after, answer, threshold);
  }
  return answer;
}
