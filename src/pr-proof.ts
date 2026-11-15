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
  if (!last.done || (stop !== undefined && stop.state !== 'done')) return 'the last run of this command is not done';
  if (last.fingerprint !== fingerprint) return 'the tree changed after the last run; run the engine again';
  return null;
}

/** The answer line: the state the engine logged, the exit code and reason of
 * the run, and when. A refusal before the run has a state and no run. */
function answerLine(last: LedgerEntry | undefined, stop: StateEntry | undefined): string | null {
  // Blocked is always a refusal: the engine never runs the command (e06s04).
  if (last === undefined || stop?.state === 'blocked') {
    return stop === undefined ? null : `answer: ${stop.state}, not run, at ${stop.at}`;
  }
  const state = stop?.state ?? (last.done ? 'done' : 'failed');
  return `answer: ${state}, exit ${last.exitCode ?? 'none'}, ${last.reason}, at ${last.at}`;
}

/** The budget used: runs of any command in the loop that ends at the last run
 * (since the done before it), and the failed runs of this command. */
function budgetLine(entries: LedgerEntry[], last: LedgerEntry | undefined, command: string): string {
  const upTo = last === undefined ? entries.length : entries.lastIndexOf(last) + 1;
  const before = entries.slice(0, upTo);
  if (last?.done === true) {
    const runs = loopRuns(before.slice(0, -1)) + 1;
    const failed = failingRun(before.slice(0, -1), command).length;
    return `budget: ${plural(runs, 'run')} in this loop, ${plural(failed, 'failed run')} of this command before the pass`;
  }
  const failed = failingRun(before, command).length;
  return `budget: ${plural(loopRuns(before), 'run')} in this loop, ${plural(failed, 'failed run')} of this command in a row`;
}

/** The proof for `command` from the ledger and the current tree. */
export function prProof(input: ProofInput): Proof {
  const { entries, states, command, fingerprint } = input;
  const last = entries.findLast((entry) => entry.command === command);
  // The stop state of the last run, or of a refusal after it.
  const stop = states.findLast((entry) => entry.command === command && (last === undefined || entry.at >= last.at));
  const why = whyNot(last, stop, fingerprint);
  const lines = [`weftwork done gate: ${why === null ? 'ready' : 'draft'}`, `command: ${terminalSafe(command)}`];
  const answer = answerLine(last, stop);
  if (answer !== null) lines.push(answer);
  if (stop?.detail != null) lines.push(`detail: ${terminalSafe(stop.detail)}`);
  if (why !== null) lines.push(`why: ${why}`);
  lines.push(budgetLine(entries, last, command));
  return { ready: why === null, text: `${lines.join('\n')}\n` };
}
