// story: e11s05, e11s06
// The UI setting: the command that writes screenshots and the paths that make
// a change a UI change, from the `ui` mapping of the same two setting files as
// the budget (docs/UI.md), and the design reference the council reviews
// against (e11s06). The repository file wins over the user file key by
// key. No `ui` mapping in either file means UI checks are off.
import type { Failure } from './errors.ts';
import { isAbsolute } from 'node:path';
import { isInteger } from './json.ts';
import { clip, isMapping, readSettingFile, repoSettingPath, userSettingPath, yamlData, type SettingFile } from './budget.ts';

export type UiSetting = { screenshot: string; paths: string[]; timeoutSeconds: number; design?: string };
export type UiSettingResult = { ok: true; ui: UiSetting | null } | Failure;

const knownKeys = ['screenshot', 'paths', 'timeout_seconds', 'design'];
const maxPaths = 50;
const defaultTimeoutSeconds = 600;

function isPaths(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= maxPaths &&
    value.every((path) => typeof path === 'string' && path.trim() !== '' && !path.includes('\0'))
  );
}

/** A path from the repository root that stays inside it. */
function isInsidePath(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && !value.includes('\0') && !isAbsolute(value) && !value.split(/[\\/]/).includes('..');
}

/** The `ui` keys one file sets, or the first unknown key or bad value. */
function checkUi(ui: Record<string, unknown>): { ok: true; set: Partial<UiSetting> } | Failure {
  const unknown = Object.keys(ui).find((key) => !knownKeys.includes(key));
  if (unknown !== undefined) return { ok: false, error: `ui.${clip(unknown)} is not a known key (known: ${knownKeys.join(', ')})` };
  const set: Partial<UiSetting> = {};
  const { screenshot, paths, timeout_seconds: timeout, design } = ui;
  if (screenshot !== undefined) {
    if (typeof screenshot !== 'string' || screenshot.trim() === '' || screenshot.includes('\0')) return { ok: false, error: 'ui.screenshot must be a non-empty command' };
    set.screenshot = screenshot;
  }
  if (paths !== undefined) {
    if (!isPaths(paths)) return { ok: false, error: `ui.paths must be a list of 1 to ${maxPaths} patterns` };
    set.paths = paths;
  }
  if (timeout !== undefined) {
    if (!isInteger(timeout) || timeout < 1 || timeout > 3600) return { ok: false, error: 'ui.timeout_seconds must be an integer from 1 to 3600' };
    set.timeoutSeconds = timeout;
  }
  if (design !== undefined) {
    if (!isInsidePath(design)) return { ok: false, error: 'ui.design must be a path inside the repository, from its root' };
    set.design = design;
  }
  return { ok: true, set };
}

/** The `ui` keys one file sets (null when it has no `ui`); every error names the file. */
function readUi(file: SettingFile): { ok: true; set: Partial<UiSetting> | null } | Failure {
  const parsed = yamlData(file);
  if (!parsed.ok) return { ok: false, error: `${file.path}: ${parsed.error}` };
  const data = parsed.data;
  if (data === null || data === undefined) return { ok: true, set: null };
  if (!isMapping(data)) return { ok: false, error: `${file.path}: the top level must be a mapping` };
  if (!('ui' in data)) return { ok: true, set: null };
  const ui = data['ui'];
  if (!isMapping(ui)) return { ok: false, error: `${file.path}: ui must be a mapping` };
  const checked = checkUi(ui);
  return checked.ok ? checked : { ok: false, error: `${file.path}: ${checked.error}` };
}

/** The UI setting from the two files (each null when it does not exist). */
export function resolveUi(files: { user: SettingFile | null; repo: SettingFile | null }): UiSettingResult {
  let found = false;
  const ui: Partial<UiSetting> = { timeoutSeconds: defaultTimeoutSeconds };
  for (const file of [files.user, files.repo]) {
    if (file === null) continue;
    const read = readUi(file);
    if (!read.ok) return read;
    if (read.set === null) continue;
    found = true;
    Object.assign(ui, read.set);
  }
  if (!found) return { ok: true, ui: null };
  const { screenshot, paths, timeoutSeconds = defaultTimeoutSeconds, design } = ui;
  if (screenshot === undefined || paths === undefined) return { ok: false, error: 'ui needs both screenshot and paths' };
  return { ok: true, ui: { screenshot, paths, timeoutSeconds, ...(design === undefined ? {} : { design }) } };
}

/** The UI setting for the repository that holds `cwd`, read under the
 * budget's file rules (the repository file may not be a symlink). */
export async function loadUi(cwd: string, env: NodeJS.ProcessEnv): Promise<UiSettingResult> {
  const user = readSettingFile(userSettingPath(env), true);
  if (!user.ok) return user;
  const repo = readSettingFile(await repoSettingPath(cwd), false);
  if (!repo.ok) return repo;
  return resolveUi({ user: user.file, repo: repo.file });
}
