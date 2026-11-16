// story: e10s01
// The guard setting: the owner's extra protected paths, from the
// `guard.protected` list of the same two setting files as the budget
// (docs/GUARD.md). Both files add to the built-in list; no key takes a path
// off it, so the agent cannot shrink the list, and both files are protected
// themselves. A file that cannot be used is an error that names the file.
import type { Failure } from './errors.ts';
import { isAbsolute } from 'node:path';
import { clip, isMapping, readSettingFile, repoSettingPath, userSettingPath, yamlData, type SettingFile } from './budget.ts';

export type GuardSettingResult = { ok: true; protected: string[] } | Failure;

const knownKeys = ['protected'];
const maxPatterns = 100;

/** Patterns as the built-in list has them: a relative path, `/` between
 * folders, a trailing `/` for a whole folder, `*` and `?` inside one name. */
function isPatterns(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= maxPatterns &&
    value.every(
      (pattern) =>
        typeof pattern === 'string' &&
        pattern.trim() !== '' &&
        !pattern.includes('\0') &&
        !isAbsolute(pattern) &&
        !pattern.split('/').includes('..'),
    )
  );
}

/** The patterns one file adds; every error names the file. */
function readGuard(file: SettingFile): { ok: true; protected: string[] } | Failure {
  const parsed = yamlData(file);
  if (!parsed.ok) return { ok: false, error: `${file.path}: ${parsed.error}` };
  const data = parsed.data;
  if (data === null || data === undefined) return { ok: true, protected: [] };
  if (!isMapping(data)) return { ok: false, error: `${file.path}: the top level must be a mapping` };
  if (!('guard' in data)) return { ok: true, protected: [] };
  const guard = data['guard'];
  if (!isMapping(guard)) return { ok: false, error: `${file.path}: guard must be a mapping` };
  const unknown = Object.keys(guard).find((key) => !knownKeys.includes(key));
  if (unknown !== undefined) return { ok: false, error: `${file.path}: guard.${clip(unknown)} is not a known key (known: ${knownKeys.join(', ')})` };
  const patterns = guard['protected'];
  if (patterns === undefined) return { ok: true, protected: [] };
  if (!isPatterns(patterns)) return { ok: false, error: `${file.path}: guard.protected must be a list of 1 to ${maxPatterns} patterns, each a relative path` };
  return { ok: true, protected: patterns };
}

/** The extra patterns from the two files (each null when it does not exist). */
export function resolveGuard(files: { user: SettingFile | null; repo: SettingFile | null }): GuardSettingResult {
  const patterns: string[] = [];
  for (const file of [files.user, files.repo]) {
    if (file === null) continue;
    const read = readGuard(file);
    if (!read.ok) return read;
    patterns.push(...read.protected);
  }
  return { ok: true, protected: patterns };
}

/** The guard setting for the repository that holds `cwd`, read under the
 * budget's file rules (the repository file may not be a symlink). */
export async function loadGuard(cwd: string, env: NodeJS.ProcessEnv): Promise<GuardSettingResult> {
  const user = readSettingFile(userSettingPath(env), true);
  if (!user.ok) return user;
  const repo = readSettingFile(await repoSettingPath(cwd), false);
  if (!repo.ok) return repo;
  return resolveGuard({ user: user.file, repo: repo.file });
}
