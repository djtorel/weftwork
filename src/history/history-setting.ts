// story: e15s01
// The history setting (docs/HISTORY.md): the top-level `history` key of the
// same two setting files as the budget, `local` or `off`. Off unless the
// owner sets it: an agent cannot turn on its own record, since the guard
// keeps it out of both files. The repository file wins over the user file.
// `local` is the only way on: nothing is ever sent anywhere (R20: the Go
// toolchain and the Rust metrics goal keep usage data on the machine).
import type { Failure } from '../shared/errors.ts';
import { isMapping, readSettingFile, repoSettingPath, userSettingPath, yamlData, type SettingFile } from '../engine/budget.ts';

export type HistoryMode = 'local' | 'off';
export type HistorySettingResult = { ok: true; mode: HistoryMode } | Failure;

/** The mode one file sets, or null when it does not set one. */
function readMode(file: SettingFile): { ok: true; mode: HistoryMode | null } | Failure {
  const parsed = yamlData(file);
  if (!parsed.ok) return { ok: false, error: `${file.path}: ${parsed.error}` };
  const data = parsed.data;
  if (data === null || data === undefined) return { ok: true, mode: null };
  if (!isMapping(data)) return { ok: false, error: `${file.path}: the top level must be a mapping` };
  if (!('history' in data)) return { ok: true, mode: null };
  const mode = data['history'];
  if (mode !== 'local' && mode !== 'off') return { ok: false, error: `${file.path}: history must be local or off` };
  return { ok: true, mode };
}

/** The mode from the two files (each null when it does not exist). */
export function resolveHistory(files: { user: SettingFile | null; repo: SettingFile | null }): HistorySettingResult {
  let mode: HistoryMode = 'off';
  for (const file of [files.user, files.repo]) {
    if (file === null) continue;
    const read = readMode(file);
    if (!read.ok) return read;
    if (read.mode !== null) mode = read.mode;
  }
  return { ok: true, mode };
}

/** The history mode for the repository that holds `cwd`, read under the
 * budget's file rules (the repository file may not be a symlink). */
export async function loadHistory(cwd: string, env: NodeJS.ProcessEnv): Promise<HistorySettingResult> {
  const user = readSettingFile(userSettingPath(env), true);
  if (!user.ok) return user;
  const repo = readSettingFile(await repoSettingPath(cwd), false);
  if (!repo.ok) return repo;
  return resolveHistory({ user: user.file, repo: repo.file });
}
