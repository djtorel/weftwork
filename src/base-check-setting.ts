// story: e13s04
// The base-check setting: the `proof` mapping of the same two setting files
// as the budget (docs/BASE-CHECK.md). `tests` are glob patterns of test
// files, `run` is the command that runs the files it gets as "$@", `share`
// are paths linked from the working tree into the base worktree (such as an
// ignored dependency folder), and `timeout_seconds` bounds one file's run.
// The repository file wins over the user file key by key. No `proof`
// mapping means the check is off.
import { isAbsolute } from 'node:path';
import type { Failure } from './errors.ts';
import { isInteger } from './json.ts';
import { clip, isMapping, readSettingFile, repoSettingPath, userSettingPath, yamlData, type SettingFile } from './budget.ts';

export type ProofSetting = { tests: string[]; run: string; share: string[]; timeoutSeconds: number };
export type ProofSettingResult = { ok: true; proof: ProofSetting | null } | Failure;

const knownKeys = ['tests', 'run', 'share', 'timeout_seconds'];
const maxList = 50;
const defaultTimeoutSeconds = 600;

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '' && !value.includes('\0');

const isList = (value: unknown, each: (item: unknown) => boolean): value is string[] =>
  Array.isArray(value) && value.length >= 1 && value.length <= maxList && value.every(each);

/** A path from the repository root that stays inside it. */
const isInsidePath = (value: unknown): boolean => isText(value) && !isAbsolute(value) && !value.split(/[\\/]/).includes('..');

/** The `proof` keys one file sets, or the first unknown key or bad value. */
function checkProof(proof: Record<string, unknown>): { ok: true; set: Partial<ProofSetting> } | Failure {
  const unknown = Object.keys(proof).find((key) => !knownKeys.includes(key));
  if (unknown !== undefined) return { ok: false, error: `proof.${clip(unknown)} is not a known key (known: ${knownKeys.join(', ')})` };
  const set: Partial<ProofSetting> = {};
  const { tests, run, share, timeout_seconds: timeout } = proof;
  if (tests !== undefined) {
    if (!isList(tests, isText)) return { ok: false, error: `proof.tests must be a list of 1 to ${maxList} patterns` };
    set.tests = tests;
  }
  if (run !== undefined) {
    if (!isText(run)) return { ok: false, error: 'proof.run must be a non-empty command' };
    set.run = run;
  }
  if (share !== undefined) {
    if (!isList(share, isInsidePath)) return { ok: false, error: `proof.share must be a list of paths inside the repository, 1 to ${maxList}` };
    set.share = share;
  }
  if (timeout !== undefined) {
    if (!isInteger(timeout) || timeout < 1 || timeout > 3600) return { ok: false, error: 'proof.timeout_seconds must be an integer from 1 to 3600' };
    set.timeoutSeconds = timeout;
  }
  return { ok: true, set };
}

/** The `proof` keys one file sets (null when it has no `proof`); every error names the file. */
function readProof(file: SettingFile): { ok: true; set: Partial<ProofSetting> | null } | Failure {
  const parsed = yamlData(file);
  if (!parsed.ok) return { ok: false, error: `${file.path}: ${parsed.error}` };
  const data = parsed.data;
  if (data === null || data === undefined) return { ok: true, set: null };
  if (!isMapping(data)) return { ok: false, error: `${file.path}: the top level must be a mapping` };
  if (!('proof' in data)) return { ok: true, set: null };
  if (!isMapping(data['proof'])) return { ok: false, error: `${file.path}: proof must be a mapping` };
  const checked = checkProof(data['proof']);
  return checked.ok ? checked : { ok: false, error: `${file.path}: ${checked.error}` };
}

/** The proof setting from the two files (each null when it does not exist). */
export function resolveProof(files: { user: SettingFile | null; repo: SettingFile | null }): ProofSettingResult {
  let found = false;
  const proof: Partial<ProofSetting> = {};
  for (const file of [files.user, files.repo]) {
    if (file === null) continue;
    const read = readProof(file);
    if (!read.ok) return read;
    if (read.set === null) continue;
    found = true;
    Object.assign(proof, read.set);
  }
  if (!found) return { ok: true, proof: null };
  const { tests, run, share = [], timeoutSeconds = defaultTimeoutSeconds } = proof;
  if (tests === undefined || run === undefined) return { ok: false, error: 'proof needs both tests and run' };
  return { ok: true, proof: { tests, run, share, timeoutSeconds } };
}

/** The proof setting for the repository that holds `cwd`, read under the
 * budget's file rules (the repository file may not be a symlink). */
export async function loadProof(cwd: string, env: NodeJS.ProcessEnv): Promise<ProofSettingResult> {
  const user = readSettingFile(userSettingPath(env), true);
  if (!user.ok) return user;
  const repo = readSettingFile(await repoSettingPath(cwd), false);
  if (!repo.ok) return repo;
  return resolveProof({ user: user.file, repo: repo.file });
}
