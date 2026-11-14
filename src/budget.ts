// story: e09s01
// The budget setting: the owner's limits for the engine's stop rules, read
// from a user file and a repository file (docs/BUDGET.md). The built-in
// defaults are overridden by the user file, which is overridden by the
// repository file. A request value is used only when it is lower, so an agent
// that writes the request cannot raise the owner's limit. A file that cannot
// be used is an error value that names the file and the key, never a silent
// fall back to the defaults.
import { isAbsolute, join } from 'node:path';
import { parseDocument } from 'yaml';
import { defaultMaxFailures, defaultStallAfter } from './breaker.ts';
import type { Failure } from './errors.ts';
import { limitKeys, limitProblem, type GateRequest, type LimitKey, type ParseResult } from './gate.ts';
import { isRecord } from './json.ts';
import { readRegularFile } from './regular-file.ts';
import { repositoryRoot } from './tree.ts';

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
  let data: unknown;
  try {
    data = doc.toJS();
  } catch (error) {
    // The yaml package throws for an alias bomb (security review F1).
    return fail(`not valid YAML: ${error instanceof Error ? error.message : String(error)}`);
  }
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

/** Neither file may be larger than this. */
export const settingMaxBytes = 64 * 1024;

/** The user file: $XDG_CONFIG_HOME/weftwork/config.yaml, or
 * $HOME/.config/weftwork/config.yaml when XDG_CONFIG_HOME is unset, empty or
 * relative (the XDG Base Directory spec says to ignore a relative one). Null
 * when neither gives an absolute directory. */
export function userSettingPath(env: NodeJS.ProcessEnv): string | null {
  const xdg = env['XDG_CONFIG_HOME'];
  const home = env['HOME'];
  if (xdg !== undefined && isAbsolute(xdg)) return join(xdg, 'weftwork', 'config.yaml');
  if (home !== undefined && isAbsolute(home)) return join(home, '.config', 'weftwork', 'config.yaml');
  return null;
}

/** weftwork.yaml at the root of the repository that holds `cwd`, or null
 * outside a repository. */
async function repoSettingPath(cwd: string): Promise<string | null> {
  try {
    return join((await repositoryRoot(cwd)).toString(), 'weftwork.yaml');
  } catch {
    return null;
  }
}

type Read = { ok: true; file: SettingFile | null } | Failure;

/** One setting file under the file rules: a regular file of at most 64 KiB,
 * valid UTF-8. The repository file may not be a symlink, since the agent can
 * place one; the user file may be, since dotfile managers link it. */
function readSetting(path: string | null, follow: boolean): Read {
  if (path === null) return { ok: true, file: null };
  const read = readRegularFile(path, { follow, maxBytes: settingMaxBytes });
  if (!read.ok) return read;
  return { ok: true, file: read.file === null ? null : { path, text: read.file.text } };
}

/** `request` with both limits set from the setting files, or the first
 * problem with a file. Resolves, never rejects. */
export async function applyBudget(request: GateRequest, env: NodeJS.ProcessEnv): Promise<ParseResult> {
  const user = readSetting(userSettingPath(env), true);
  if (!user.ok) return user;
  const repo = readSetting(await repoSettingPath(request.cwd), false);
  if (!repo.ok) return repo;
  const asked: Partial<Limits> = {};
  for (const key of limitKeys) {
    const value = request[key];
    if (value !== undefined) asked[key] = value;
  }
  const resolved = resolveLimits({ user: user.file, repo: repo.file, request: asked });
  if (!resolved.ok) return resolved;
  return { ok: true, request: { ...request, ...resolved.limits } };
}
