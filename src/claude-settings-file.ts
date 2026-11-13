// story: e07s03, e07s04, e08s01
// The file half of the install: read .claude/settings.json without blocking and
// only as a regular file, and write it back through a temp file and a rename.
// Split out of claude-install.ts in e07s04 to keep both files under the
// 300-line limit; the pure edit stays there. The check (claude-live-cli.ts)
// reads settings files through readSettings too. The generic read and write
// live in regular-file.ts since e08s01, shared with the state writer.
//
// The settings file is untrusted input: it may be anything, and the agent can
// edit it. Text of the wrong shape is refused, never repaired or overwritten.
import { lstatSync } from 'node:fs';
import { join } from 'node:path';
import { installStopHook, type Action } from './claude-install.ts';
import { isMissing } from './errors.ts';
import { readRegularFile, writeAtomic, type Failure, type ReadRegular, type RegularFile } from './regular-file.ts';

/** The most readSettings reads. A real settings file is a few KiB; the live
 * check follows symlinks, so the file may be any file the agent links. */
export const maxSettingsBytes = 1024 * 1024;

export type InstallInProject = { ok: true; action: Action; path: string } | Failure;
export type SettingsFile = RegularFile;
export type Read = ReadRegular;

/** Read the settings file. `file` is null when there is none. Only a regular
 * file is read. The file's mode comes back too, so a rewrite keeps it. The
 * install refuses a symlink, since it writes. The live check only reads, and
 * Claude Code reads a symlinked file (a dotfile manager's), so it passes
 * `follow`; the target must still be a regular file. */
export function readSettings(path: string, follow = false): Read {
  return readRegularFile(path, { follow, maxBytes: maxSettingsBytes });
}

/** The user settings file Claude Code reads: $CLAUDE_CONFIG_DIR/settings.json,
 * else ~/.claude/settings.json, or null when neither is set. An empty value
 * counts as unset: join('', ...) would name a file in the project (review
 * round 3, A-F7; moved here from the CLI in round 5, B-4). */
export function userSettingsPath(env: Record<string, string | undefined>): string | null {
  const configDir = env.CLAUDE_CONFIG_DIR === '' ? undefined : env.CLAUDE_CONFIG_DIR;
  const home = env.HOME === '' ? undefined : env.HOME;
  const dir = configDir ?? (home === undefined ? undefined : join(home, '.claude'));
  return dir === undefined ? null : join(dir, 'settings.json');
}

/** True when `dir` holds a `.git` entry, a directory or a worktree file. */
export function isGitRoot(dir: string): boolean {
  try {
    lstatSync(join(dir, '.git'));
    return true;
  } catch {
    return false;
  }
}

/** True when `claudeDir` is missing or a plain directory. A symlink is refused,
 * so the write cannot be sent to another place. */
function isPlainDirOrMissing(claudeDir: string): boolean {
  try {
    return lstatSync(claudeDir).isDirectory();
  } catch (error) {
    return isMissing(error);
  }
}

/** Why `dir` cannot take the hook, or null when it can. */
function refusalFor(dir: string, claudeDir: string): string | null {
  if (!isGitRoot(dir)) {
    return `${dir} is not the root of a git repository`;
  }
  if (!isPlainDirOrMissing(claudeDir)) {
    return `${claudeDir} is not a directory (a symlink is refused)`;
  }
  return null;
}

/** Register the Stop hook in `dir`'s .claude/settings.json. `dir` must be the
 * root of a git repository. Writes only when the text changes. Returns an
 * error value, and writes nothing, for anything it will not edit. */
export function installInProject(dir: string, cliPath: string, command: string): InstallInProject {
  const claudeDir = join(dir, '.claude');
  const path = join(claudeDir, 'settings.json');
  const refusal = refusalFor(dir, claudeDir);
  if (refusal !== null) return { ok: false, error: refusal };
  const read = readSettings(path);
  if (!read.ok) return read;
  const result = installStopHook(read.file?.text ?? null, cliPath, command);
  if (!result.ok) return { ok: false, error: `${path}: ${result.error}` };
  const failed = result.changed ? writeAtomic(path, result.text, read.file?.mode) : null;
  return failed ?? { ok: true, action: result.action, path };
}
