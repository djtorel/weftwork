// story: e06s04
// The terminal states of a run and the exit code of each. One table, so the
// CLI, the engine and the ledger agree on the names and the codes.

/** How a run can end. `done` is the only one that means the work is verified. */
export const terminalStates = ['done', 'blocked', 'stalled', 'exhausted', 'killed'] as const;

export type TerminalState = (typeof terminalStates)[number];

/** A terminal state, or `failed`: the run failed and no stop rule tripped, so
 * a retry is allowed. Or `overridden` (e06s05): a failed or stalled run that the
 * owner let through once. It is not a terminal state and never means done. */
export type State = TerminalState | 'failed' | 'overridden';

/** One code per state, and only `done` is 0. 0, 1 and 2 keep the meaning they
 * had before e06s04; 3 to 6 stay clear of the shell's 126 and 127. */
export const exitCodes: Record<State, number> = {
  done: 0,
  failed: 1,
  blocked: 3,
  stalled: 4,
  exhausted: 5,
  killed: 6,
  overridden: 7,
};

/** Input the engine cannot read. Not a state: no run happened. */
export const badInputExitCode = 2;
