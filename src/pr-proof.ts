// story: e11s02
// The proof block of a pull request, from the engine's own record. The agent
// does not report its proof: the ledger says whether the last run of the
// verify command was done, and the tree fingerprint says whether that run saw
// the tree as it is now. Ready means the PR may be opened as ready for review;
// anything else means a draft with a handoff (the full-stop skill).
// docs/PR-PROOF.md.
import { loopRuns } from './breaker.ts';
import { terminalSafe } from './cli-io.ts';
import { failingRun, type LedgerEntry, type StateEntry } from './ledger.ts';

export type ProofInput = {
  entries: LedgerEntry[];
  states: StateEntry[];
  command: string;
  /** The fingerprint of the tree now. */
  fingerprint: string;
};

/** `text` is plain lines, one field per line, for the PR template's Proof
 * block. Text from outside the engine goes through terminalSafe. */
export type Proof = { ready: boolean; text: string };

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Why the PR is not ready, or null when it is. */
function whyNot(last: LedgerEntry | undefined, stop: StateEntry | undefined, fingerprint: string): string | null {
  if (last === undefined) return 'the ledger has no run of this command';
  if (!last.done) return 'the last run of this command is not done';
  if (stop !== undefined && stop.state !== 'done') return 'the engine stopped after the last run of this command';
  if (last.fingerprint !== fingerprint) return 'the tree changed after the last run; run the engine again';
  return null;
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
  const { entries, states, command, fingerprint } = input;
  const last = entries.findLast((entry) => entry.command === command);
  // The stop state of the last run, or of a refusal after it.
  const stop = states.findLast((entry) => entry.command === command && (last === undefined || entry.at >= last.at));
  const why = whyNot(last, stop, fingerprint);
  const lines = [`weftwork done gate: ${why === null ? 'ready' : 'draft'}`, `command: ${terminalSafe(command)}`, runLine(last)];
  if (stop !== undefined && stop.state !== 'done') {
    lines.push(`stopped: ${stop.state}, at ${stop.at}`);
    if (stop.detail !== null) lines.push(`detail: ${terminalSafe(stop.detail)}`);
  }
  if (why !== null) lines.push(`why: ${why}`);
  lines.push(budgetLine(entries, last, command, why === null));
  return { ready: why === null, text: `${lines.join('\n')}\n` };
}
