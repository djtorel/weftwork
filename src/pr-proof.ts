// story: e11s02
// The proof block of a pull request, from the engine's own record. The agent
// does not report its proof: the ledger says whether the last run of the
// verify command was done, and the tree fingerprint says whether that run saw
// the tree as it is now. Ready means the PR may be opened as ready for review;
// anything else means a draft with a handoff (the all-ready skill).
// docs/PR-PROOF.md.
import { loopRuns } from './breaker.ts';
import { tokensText } from './budget-report.ts';
import { terminalSafe } from './cli-io.ts';
import { failingRun, type LedgerEntry, type StateEntry } from './ledger.ts';
import type { TokenRead } from './transcript-usage.ts';

export type ProofInput = {
  entries: LedgerEntry[];
  states: StateEntry[];
  command: string;
  /** The fingerprint of the tree now. */
  fingerprint: string;
  /** The session's tokens, or why they are not counted. Shown on the budget
   * line; never part of the verdict. Omitted: no tokens part (the review CLI
   * reads only the verdict). */
  tokens?: TokenRead;
};

/** `text` is plain lines, one field per line, for the PR template's Proof
 * block. Text from outside the engine goes through terminalSafe. `why` says
 * why it is not ready, or is null (the review CLI, e11s03). */
export type Proof = { ready: boolean; text: string; why: string | null };

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Why the PR is not ready, or null when it is. */
function whyNot(last: LedgerEntry | undefined, stop: StateEntry | undefined, fingerprint: string): string | null {
  if (last === undefined) return 'the ledger has no run of this command';
  if (!last.done) return 'the last run of this command is not done';
  if (stop !== undefined && stop.state !== 'done') return 'the engine stopped after the last run of this command';
  if (last.fingerprint !== fingerprint) return 'the tree changed after the last run; run the engine again';
  return null;
}

/** The stop state of `last`, or of a refusal after it. A run with an id is
 * paired by id: its own state line, or a refusal that names it as the run
 * before. An older line has no id, so it is paired by time, which a clock
 * step can get wrong. With no run, any state of the command. */
function stopOf(states: StateEntry[], command: string, last: LedgerEntry | undefined): StateEntry | undefined {
  const mine = states.filter((entry) => entry.command === command);
  const id = last?.runId;
  if (id === undefined) return mine.findLast((entry) => last === undefined || entry.at >= last.at);
  return mine.findLast((entry) => entry.runId === id || entry.after === id);
}

/** The last run of the command as the ledger logged it. A stop state is its
 * own line: a refusal (blocked, or a ceiling before the run) logs a state and
 * no run, so a state is never paired with a run by guess (review round 1). */
function runLine(last: LedgerEntry | undefined): string {
  if (last === undefined) return 'last run: none';
  const state = last.done ? 'done' : 'not done';
  return `last run: ${state}, exit ${last.exitCode ?? 'none'}, ${last.reason}, at ${last.at}`;
}

/** The budget used. Ready: runs of any command in the loop that ended at the
 * pass (since the done before it), and the failed runs of this command before
 * it. Draft: the same counts over the whole ledger as read, so runs and
 * refusals after the last run of this command count too. */
function budgetLine(entries: LedgerEntry[], last: LedgerEntry | undefined, command: string, ready: boolean): string {
  if (ready && last !== undefined) {
    const before = entries.slice(0, entries.lastIndexOf(last));
    const runs = loopRuns(before) + 1;
    const failed = failingRun(before, command).length;
    return `budget: ${plural(runs, 'run')} in this loop, ${plural(failed, 'failed run')} of this command before the pass`;
  }
  const failed = failingRun(entries, command).length;
  return `budget: ${plural(loopRuns(entries), 'run')} in this loop, ${plural(failed, 'failed run')} of this command in a row`;
}

/** The proof for `command` from the ledger and the current tree. */
export function prProof(input: ProofInput): Proof {
  const { entries, states, command, fingerprint, tokens } = input;
  const last = entries.findLast((entry) => entry.command === command);
  const stop = stopOf(states, command, last);
  const why = whyNot(last, stop, fingerprint);
  const lines = [`weftwork done gate: ${why === null ? 'ready' : 'draft'}`, `command: ${terminalSafe(command)}`, runLine(last)];
  if (stop !== undefined && stop.state !== 'done') {
    lines.push(`stopped: ${stop.state}, at ${stop.at}`);
    if (stop.detail !== null) lines.push(`detail: ${terminalSafe(stop.detail)}`);
  }
  if (why !== null) lines.push(`why: ${why}`);
  const budget = budgetLine(entries, last, command, why === null);
  lines.push(tokens === undefined ? budget : `${budget}, ${tokensText(tokens)}`);
  return { ready: why === null, text: `${lines.join('\n')}\n`, why };
}
