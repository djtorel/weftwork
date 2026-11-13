// story: e07s03, e07s04
// The file half of the install: read .claude/settings.json without blocking and
// only as a regular file, and write it back through a temp file and a rename.
// Split out of claude-install.ts in e07s04 to keep both files under the
// 300-line limit; the pure edit stays there. The check (claude-live-cli.ts)
// reads settings files through readSettings too.
//
// The settings file is untrusted input: it may be anything, and the agent can
// edit it. Text of the wrong shape is refused, never repaired or overwritten.
import {
  chmodSync,
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { installStopHook, type Action, type Failure } from './claude-install.ts';
import { isMissing, messageOf } from './errors.ts';

/** The most readSettings reads. A real settings file is a few KiB; the live
 * check follows symlinks, so the file may be any file the agent links. */
export const maxSettingsBytes = 1024 * 1024;

export type InstallInProject = { ok: true; action: Action; path: string } | Failure;
type Opened = { ok: true; fd: number | null } | Failure;
export type SettingsFile = { text: string; mode: number };
export type Read = { ok: true; file: SettingsFile | null } | Failure;

/** Open the settings file without blocking, and without following a symlink
 * unless `follow` says so. `fd` is null when there is no file. The agent can
 * replace the file, and opening a FIFO blocks (BUG-007). */
function openIfExists(path: string, follow: boolean): Opened {
  const flags = constants.O_RDONLY | constants.O_NONBLOCK | (follow ? 0 : constants.O_NOFOLLOW);
  try {
    return { ok: true, fd: openSync(path, flags) };
  } catch (error) {
    if (isMissing(error)) return { ok: true, fd: null };
    return { ok: false, error: `${path} cannot be opened as a regular file: ${messageOf(error)}` };
  }
}

/** Read the settings file. `file` is null when there is none. Only a regular
 * file is read. The file's mode comes back too, so a rewrite keeps it. The
 * install refuses a symlink, since it writes. The live check only reads, and
 * Claude Code reads a symlinked file (a dotfile manager's), so it passes
 * `follow`; the target must still be a regular file. */
export function readSettings(path: string, follow = false): Read {
  const opened = openIfExists(path, follow);
  if (!opened.ok) return opened;
  const fd = opened.fd;
  if (fd === null) return { ok: true, file: null };
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) return { ok: false, error: `${path} is not a regular file` };
    if (stat.size > maxSettingsBytes) {
      return { ok: false, error: `${path} is larger than ${maxSettingsBytes} bytes` };
    }
    return { ok: true, file: { text: readFileSync(fd, 'utf8'), mode: stat.mode & 0o777 } };
  } catch (error) {
    return { ok: false, error: `${path} could not be read: ${messageOf(error)}` };
  } finally {
    closeSync(fd);
  }
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

/** Remove a leftover temp file. Failing to remove it is not a fault of the install. */
function removeQuietly(path: string): void {
  try {
    rmSync(path, { force: true });
  } catch {
    // The file is ours and harmless; the write's own result is what matters.
  }
}

/** Write `text` to `path` through a random-named temp file and a rename, so a
 * crashed process never leaves half a file (no fsync: a power loss can). A name
 * collision is not worth code. The temp file is created with `mode`, so it is
 * never wider than the file it replaces; chmod undoes the umask. No `mode` (a
 * new file): the umask decides. */
function writeAtomic(path: string, text: string, mode: number | undefined): Failure | null {
  const temp = join(dirname(path), `settings.json.${randomBytes(6).toString('hex')}.tmp`);
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(temp, text, { flag: 'wx', mode: mode ?? 0o666 });
    if (mode !== undefined) chmodSync(temp, mode);
    renameSync(temp, path);
    return null;
  } catch (error) {
    return { ok: false, error: `${path} could not be written: ${messageOf(error)}` };
  } finally {
    removeQuietly(temp);
  }
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
