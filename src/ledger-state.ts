// story: e06s05
// The state lines of the counts ledger (e06s04 and e06s05), moved out of
// ledger.ts to keep that file under the 300-line limit. A state line records
// one terminal state with its counters. The writer and the readers stay in
// ledger.ts; this file holds the shape, the validation and the override counts.
import { isInteger } from './json.ts';
import { terminalStates, type State } from './states.ts';

/** One terminal state, with the counters at the time (e06s04). `threshold` is
 * the number that tripped, or null; `detail` is a short text, or null. */
export type StateEntry = {
  at: string;
  state: State;
  command: string;
  runs: number;
  failStreak: number;
  threshold: number | null;
  detail: string | null;
  /** Only on an `overridden` line (e06s05): why the owner let the run through,
   * and who wrote the record. The author is a claim, not proof (T4). */
  kind?: OverrideKind;
  author?: string;
};

export type OverrideKind = 'override' | 'false-alarm';

const knownStates: readonly string[] = [...terminalStates, 'failed', 'overridden'];

export function isKind(value: unknown): value is OverrideKind {
  return value === 'override' || value === 'false-alarm';
}

const isNullableInt = (value: unknown): value is number | null =>
  value === null || isInteger(value);
const isNullableText = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';
const isOptionalKind = (value: unknown): value is OverrideKind | undefined =>
  value === undefined || isKind(value);
const isOptionalText = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === 'string';

/** `kind` and `author` only when present, so an e06s04 line stays as it was. */
function optionalFields(
  kind: OverrideKind | undefined,
  author: string | undefined,
): Pick<StateEntry, 'kind' | 'author'> {
  return { ...(kind === undefined ? {} : { kind }), ...(author === undefined ? {} : { author }) };
}

/** The state line in `data`, or null when a field is missing or wrong. */
export function toState(data: Record<string, unknown>): StateEntry | null {
  const { at, state, command, runs, failStreak, threshold, detail, kind, author } = data;
  if (typeof at !== 'string' || typeof state !== 'string' || !knownStates.includes(state)) {
    return null;
  }
  if (typeof command !== 'string' || !isInteger(runs) || !isInteger(failStreak)) {
    return null;
  }
  if (!isNullableInt(threshold) || !isNullableText(detail)) {
    return null;
  }
  if (!isOptionalKind(kind) || !isOptionalText(author)) {
    return null;
  }
  const fields = { at, state: state as State, command, runs, failStreak };
  return { ...fields, threshold, detail, ...optionalFields(kind, author) };
}

/** The `overridden` lines for one command, by kind (e06s05). A line with no
 * kind counts in neither. The counts are a log, never an input to `done`. */
export function overrideCounts(
  states: StateEntry[],
  command: string,
): { overrides: number; falseAlarms: number } {
  const mine = states.filter((s) => s.state === 'overridden' && s.command === command);
  return {
    overrides: mine.filter((s) => s.kind === 'override').length,
    falseAlarms: mine.filter((s) => s.kind === 'false-alarm').length,
  };
}
