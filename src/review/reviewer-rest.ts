// story: e11s03
// Which reviewers rest (docs/REVIEW.md § A reviewer with no usage). A
// reviewer that ran out of usage, timed out or was stopped as slow is not
// asked again for an hour: the rounds after it start with the reviewers that
// can answer, and do not wait on it again. The record is one file in the
// common git dir, so every worktree of the clone shares it. It only saves
// time: a record that is missing or cannot be read rests no one.
import { join } from 'node:path';
import type { Failure } from '../shared/errors.ts';
import { readRegularFile, writeAtomic } from '../shared/regular-file.ts';
import { commonDir } from '../guard/guard-worktree.ts';
import { reviewerName } from './review.ts';

/** How long a reviewer rests after it could not answer. */
export const restMinutes = 60;

/** Each resting reviewer, by name: until when (ISO), and why. */
export type Resting = Record<string, { until: string; why: string }>;

export type Skipped = { name: string; ok: false; error: string; skipped: true; seconds: 0; end: 'not-asked' };

const maxBytes = 64 * 1024;

/** `<common git dir>/weftwork/reviewers-resting.json` for the clone that holds `cwd`. */
export async function restingPath(cwd: string): Promise<string | null> {
  const common = await commonDir(cwd);
  return common === null ? null : join(common, 'weftwork', 'reviewers-resting.json');
}

/** The reviewers that still rest at `now`. */
export function readResting(path: string, now: Date): Resting {
  const read = readRegularFile(path, { follow: false, maxBytes });
  if (!read.ok || read.file === null) return {};
  let data: unknown;
  try {
    data = JSON.parse(read.file.text);
  } catch {
    return {};
  }
  const resting: Resting = {};
  if (typeof data !== 'object' || data === null) return resting;
  for (const [name, entry] of Object.entries(data)) {
    const { until, why } = (entry ?? {}) as Record<string, unknown>;
    if (typeof until === 'string' && typeof why === 'string' && Date.parse(until) > now.getTime()) resting[name] = { until, why };
  }
  return resting;
}

/** The commands to ask, without the resting ones, which are reported as not
 * asked. When every reviewer rests each is asked, since a round with no
 * reviewer has no verdict. */
export function askOrder(commands: readonly string[], resting: Resting): { ask: string[]; skipped: Skipped[] } {
  const ask = commands.filter((command) => resting[reviewerName(command)] === undefined);
  if (ask.length === 0) return { ask: [...commands], skipped: [] };
  const names = [...new Set(commands.map(reviewerName))].filter((name) => resting[name] !== undefined);
  const skipped = names.map((name): Skipped => ({ name, ok: false, error: `resting until ${resting[name]?.until.slice(0, 16)}Z (${resting[name]?.why})`, skipped: true, seconds: 0, end: 'not-asked' }));
  return { ask, skipped };
}

/** After a round: a reviewer that must rest does, from `now`, and one that
 * answered rests no more. */
export function keepResting(path: string, results: readonly { name: string; ok: boolean; error?: string; rest?: boolean }[], now: Date): Failure | null {
  const resting = readResting(path, now);
  const until = new Date(now.getTime() + restMinutes * 60000).toISOString();
  let changed = false;
  for (const result of results) {
    if (result.rest === true) resting[result.name] = { until, why: (result.error ?? '').slice(0, 300) };
    else if (!result.ok || resting[result.name] === undefined) continue;
    else delete resting[result.name];
    changed = true;
  }
  // A round that rests no one and wakes no one writes no file.
  return changed ? writeAtomic(path, `${JSON.stringify(resting)}\n`, undefined) : null;
}

/** Run a round's reviewers without the resting ones, and keep who must rest
 * after it. `note` is set when the record could not be written; `seconds`
 * is how long the reviewers took in all. */
export async function withRest<T extends { name: string; ok: boolean; error?: string; rest?: boolean }>(cwd: string, order: readonly string[], run: (ask: string[]) => Promise<T[]>, now: () => Date = () => new Date()): Promise<{ results: (T | Skipped)[]; note: string | null; seconds: number }> {
  const path = await restingPath(cwd);
  const { ask, skipped } = askOrder(order, path === null ? {} : readResting(path, now()));
  const started = now().getTime();
  const results = await run(ask);
  const seconds = Math.round((now().getTime() - started) / 100) / 10;
  const kept = path === null ? null : keepResting(path, results, now());
  return { results: [...results, ...skipped], note: kept === null ? null : `resting record: not written, ${kept.error}`, seconds };
}
