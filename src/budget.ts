// story: e09s01
// The budget setting: the owner's limits for the engine's stop rules, read
// from a user file and a repository file (docs/BUDGET.md). The built-in
// defaults are overridden by the user file, which is overridden by the
// repository file. A request value is used only when it is lower, so an agent
// that writes the request cannot raise the owner's limit. A file that cannot
// be used is an error value that names the file and the key, never a silent
// fall back to the defaults.
import { isAbsolute, join } from 'node:path';
import { parseDocument, type YAMLError } from 'yaml';
import { defaultMaxFailures, defaultStallAfter } from './breaker.ts';
import type { Failure } from './errors.ts';
import { isLimit, limitKeys, limitRule, type GateRequest, type LimitKey, type ParseResult } from './gate.ts';
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

type BudgetCheck = { ok: true; budget: Partial<Limits> } | Failure;

const maxReasonLength = 200;

/** The first line of a yaml package message, without the file excerpt that
 * follows it and cut to 200 characters: the reason stays one readable line
 * and echoes little file text (an alias name can be as long as the file). */
function firstLine(message: string): string {
  const line = (message.split('\n')[0] ?? '').replace(/:$/, '');
  return line.length <= maxReasonLength ? line : `${line.slice(0, maxReasonLength - 1)}…`;
}

/** Why the YAML in a file is not valid, in the owner's words. The yaml
 * package's text for a second document tells a programmer to call
 * parseAllDocuments(), which the owner cannot act on. */
function yamlError(error: YAMLError): string {
  if (error.code !== 'MULTIPLE_DOCS') return `not valid YAML: ${firstLine(error.message)}`;
  const at = error.linePos?.[0];
  return `holds more than one YAML document${at === undefined ? '' : ` at line ${at.line}, column ${at.col}`}`;
}

/** The YAML in `file` as plain data, or why it is not valid YAML 1.2. The
 * yaml package throws for an alias bomb (security review F1), and its
 * warnings would reach stderr, so they are off. */
function yamlData(file: SettingFile): { ok: true; data: unknown } | Failure {
  const doc = parseDocument(file.text, { logLevel: 'error' });
  const first = doc.errors[0];
  if (first !== undefined) return { ok: false, error: yamlError(first) };
  const version = doc.directives.yaml.version;
  if (version !== '1.2') return { ok: false, error: `YAML ${version} is not supported; use YAML 1.2` };
  try {
    return { ok: true, data: doc.toJS() };
  } catch (error) {
    return { ok: false, error: `not valid YAML: ${firstLine(error instanceof Error ? error.message : String(error))}` };
  }
}

/** A plain YAML mapping. A !!set or !!omap is a Set or Map, which would
 * pass a record check with no own keys and set nothing without a word. */
function isMapping(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Object.getPrototypeOf(value) === Object.prototype;
}

/** The `budget` mapping in `data`, an empty one when the file is empty or has
 * no `budget` key (other top-level keys are left for later stories). */
function budgetMapping(data: unknown): { ok: true; budget: Record<string, unknown> } | Failure {
  if (data === null || data === undefined) return { ok: true, budget: {} };
  if (!isMapping(data)) return { ok: false, error: 'the top level must be a mapping' };
  if (!('budget' in data)) return { ok: true, budget: {} };
  const budget = data['budget'];
  return isMapping(budget) ? { ok: true, budget } : { ok: false, error: 'budget must be a mapping of limits' };
}

/** The limits in `budget`, or the first unknown key or bad value. */
function checkLimits(budget: Record<string, unknown>): BudgetCheck {
  const known: readonly string[] = limitKeys;
  const unknown = Object.keys(budget).find((key) => !known.includes(key));
  if (unknown !== undefined) {
    return { ok: false, error: `budget.${unknown} is not a known key (known: ${limitKeys.join(', ')})` };
  }
  const limits: Partial<Limits> = {};
  for (const key of limitKeys) {
    const value = budget[key];
    if (value === undefined) continue;
    if (!isLimit(key, value)) return { ok: false, error: `budget.${key} ${limitRule(key)}` };
    limits[key] = value;
  }
  return { ok: true, budget: limits };
}

/** The checked `budget` of one file; every error names the file. */
function readBudget(file: SettingFile): BudgetCheck {
  const parsed = yamlData(file);
  const mapping = parsed.ok ? budgetMapping(parsed.data) : parsed;
  const checked = mapping.ok ? checkLimits(mapping.budget) : mapping;
  return checked.ok ? checked : { ok: false, error: `${file.path}: ${checked.error}` };
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
    if (asked !== undefined && asked < limits[key]) limits[key] = asked;
  }
  return { ok: true, limits };
}

/** Neither file may be larger than this. */
const settingMaxBytes = 64 * 1024;

/** The user file: $XDG_CONFIG_HOME/weftwork/config.yaml, or
 * $HOME/.config/weftwork/config.yaml when XDG_CONFIG_HOME is unset, empty or
 * relative (the XDG Base Directory spec says to ignore a relative one). Null
 * when neither gives an absolute directory. */
function userSettingPath(env: NodeJS.ProcessEnv): string | null {
  const xdg = env['XDG_CONFIG_HOME'];
  const home = env['HOME'];
  if (xdg !== undefined && isAbsolute(xdg)) return join(xdg, 'weftwork', 'config.yaml');
  if (home !== undefined && isAbsolute(home)) return join(home, '.config', 'weftwork', 'config.yaml');
  return null;
}

/** weftwork.yaml at the root of the repository that holds `cwd`, or null
 * when git cannot name one. Skipping the file then is safe only because the
 * engine needs the same git call to fingerprint the tree: without it the run
 * answers `no-tree` and the command never runs (request-review round 1). A
 * later story that runs without a tree must refuse here instead. */
async function repoSettingPath(cwd: string): Promise<string | null> {
  try {
    return join((await repositoryRoot(cwd)).toString(), 'weftwork.yaml');
  } catch {
    return null;
  }
}

type BudgetFileRead = { ok: true; file: SettingFile | null } | Failure;

/** One setting file under the file rules: a regular file of at most 64 KiB,
 * valid UTF-8. The repository file may not be a symlink, since the agent can
 * place one; the user file may be, since dotfile managers link it. */
function readBudgetFile(path: string | null, follow: boolean): BudgetFileRead {
  if (path === null) return { ok: true, file: null };
  const read = readRegularFile(path, { follow, maxBytes: settingMaxBytes });
  if (!read.ok) return read;
  return { ok: true, file: read.file === null ? null : { path, text: read.file.text } };
}

/** `request` with both limits set from the setting files, or the first
 * problem with a file. Resolves, never rejects. */
export async function applyBudget(request: GateRequest, env: NodeJS.ProcessEnv): Promise<ParseResult> {
  const user = readBudgetFile(userSettingPath(env), true);
  if (!user.ok) return user;
  const repo = readBudgetFile(await repoSettingPath(request.cwd), false);
  if (!repo.ok) return repo;
  const resolved = resolveLimits({ user: user.file, repo: repo.file, request });
  if (!resolved.ok) return resolved;
  return { ok: true, request: { ...request, ...resolved.limits } };
}
