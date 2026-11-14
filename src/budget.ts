// story: e09s01
// The budget setting: the owner's limits for the engine's stop rules, read
// from a user file and a repository file (docs/BUDGET.md). The built-in
// defaults are overridden by the user file, which is overridden by the
// repository file. A request value is used only when it is lower, so an agent
// that writes the request cannot raise the owner's limit. A file that cannot
// be used is an error value that names the file and the key, never a silent
// fall back to the defaults.
import { parseDocument } from 'yaml';
import { defaultMaxFailures, defaultStallAfter } from './breaker.ts';
import { limitKeys, limitProblem, type LimitKey } from './gate.ts';
import { isRecord } from './json.ts';

export type Limits = Record<LimitKey, number>;

/** One setting file's path, for the error text, and its contents. */
export type SettingFile = { path: string; text: string };

/** Each file is null when it does not exist. */
export type BudgetSources = {
  user: SettingFile | null;
  repo: SettingFile | null;
  request: Partial<Limits>;
};

export type LimitsResult = { ok: true; limits: Limits } | { ok: false; error: string };

const builtIn: Limits = { maxFailures: defaultMaxFailures, stallAfter: defaultStallAfter };

type Parsed = { ok: true; budget: Partial<Limits> } | { ok: false; error: string };

/** The `budget` mapping of one file, checked. An empty file, or one with no
 * `budget` key, sets nothing; other top-level keys are left for later stories. */
function readBudget(file: SettingFile): Parsed {
  const fail = (problem: string): Parsed => ({ ok: false, error: `${file.path}: ${problem}` });
  const doc = parseDocument(file.text);
  const first = doc.errors[0];
  if (first !== undefined) {
    return fail(`not valid YAML: ${first.message}`);
  }
  const data: unknown = doc.toJS();
  if (data === null || data === undefined) {
    return { ok: true, budget: {} };
  }
  if (!isRecord(data)) {
    return fail('the top level must be a mapping');
  }
  if (!('budget' in data)) {
    return { ok: true, budget: {} };
  }
  const budget = data['budget'];
  if (!isRecord(budget)) {
    return fail('budget must be a mapping of limits');
  }
  const known: readonly string[] = limitKeys;
  const unknown = Object.keys(budget).find((key) => !known.includes(key));
  if (unknown !== undefined) {
    return fail(`budget.${unknown} is not a known key (known: ${limitKeys.join(', ')})`);
  }
  const result: Partial<Limits> = {};
  for (const key of limitKeys) {
    const value = budget[key];
    if (value === undefined) continue;
    const problem = limitProblem(key, value);
    if (problem !== null) {
      return fail(`budget.${key}: ${problem}`);
    }
    result[key] = value as number; // limitProblem accepted it: an integer in range
  }
  return { ok: true, budget: result };
}

/** The limits for one run, or the first problem with a setting file. */
export function resolveLimits(sources: BudgetSources): LimitsResult {
  const limits: Limits = { ...builtIn };
  for (const file of [sources.user, sources.repo]) {
    if (file === null) continue;
    const parsed = readBudget(file);
    if (!parsed.ok) return parsed;
    Object.assign(limits, parsed.budget);
  }
  for (const key of limitKeys) {
    const asked = sources.request[key];
    if (asked !== undefined && asked < limits[key]) {
      limits[key] = asked;
    }
  }
  return { ok: true, limits };
}
