// story: e07s03, e07s04, e08s01
// The file rules that the Stop-hook install and the state writer share: read
// without blocking and only as a regular file under a size cap, and write
// through a temp file and a rename. Moved out of claude-settings-file.ts in
// e08s01 so the two writers cannot drift apart.
//
// The files are untrusted input: the agent can replace them with anything, a
// symlink or a FIFO among them. Every failure is a returned value.
import {
  chmodSync,
  closeSync,
  constants,
  fstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import { isMissing, messageOf, type Failure } from './errors.ts';

export type RegularFile = { text: string; mode: number; mtime: Date };
export type ReadRegular = { ok: true; file: RegularFile | null } | Failure;
type Opened = { ok: true; fd: number | null } | Failure;

/** Open `path` without blocking, and without following a symlink unless
 * `follow` says so. `fd` is null when there is no file. The agent can replace
 * the file, and opening a FIFO blocks (BUG-007). */
function openIfExists(path: string, follow: boolean): Opened {
  const flags = constants.O_RDONLY | constants.O_NONBLOCK | (follow ? 0 : constants.O_NOFOLLOW);
  try {
    return { ok: true, fd: openSync(path, flags) };
  } catch (error) {
    if (isMissing(error)) return { ok: true, fd: null };
    return { ok: false, error: `${path} cannot be opened as a regular file: ${messageOf(error)}` };
  }
}

/** Read `path`. `file` is null when there is none. Only a regular file of at
 * most `maxBytes` is read. The mode comes back too, so a rewrite keeps it. With
 * `follow` a symlink is followed; its target must still be a regular file. */
export function readRegularFile(path: string, options: { follow: boolean; maxBytes: number }): ReadRegular {
  const opened = openIfExists(path, options.follow);
  if (!opened.ok) return opened;
  const fd = opened.fd;
  if (fd === null) return { ok: true, file: null };
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) return { ok: false, error: `${path} is not a regular file` };
    if (stat.size > options.maxBytes) {
      return { ok: false, error: `${path} is larger than ${options.maxBytes} bytes` };
    }
    const text = strictUtf8(readFileSync(fd));
    if (text === null) return { ok: false, error: `${path} is not valid UTF-8` };
    return { ok: true, file: { text, mode: stat.mode & 0o777, mtime: stat.mtime } };
  } catch (error) {
    return { ok: false, error: `${path} could not be read: ${messageOf(error)}` };
  } finally {
    closeQuietly(fd);
  }
}

/** `bytes` as UTF-8 text, or null when they are not valid UTF-8. A lossy
 * decode would turn each bad byte into U+FFFD, and a later write would put
 * those on disk in place of bytes the caller never touched (review round 3,
 * A2, B2). A leading BOM is kept as text, as readFileSync kept it. */
export function strictUtf8(bytes: Buffer): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** Close `fd`. A failed close does not undo a read that worked, and an expected
 * failure is a returned value here, never a throw (review round 3, B-7). */
function closeQuietly(fd: number): void {
  try {
    closeSync(fd);
  } catch {
    // Nothing to do: the read's own result is what the caller gets.
  }
}

/** Remove a leftover temp file. Failing to remove it is not a fault of the write. */
function removeQuietly(path: string): void {
  try {
    rmSync(path, { force: true });
  } catch {
    // The file is ours and harmless; the write's own result is what matters.
  }
}

/** Write `text` to `path` through a random-named temp file beside it and a
 * rename, so a crashed process never leaves half a file (no fsync: a power loss
 * can). A name collision is not worth code. The temp file is created with
 * `mode`, so it is never wider than the file it replaces; chmod undoes the
 * umask. No `mode` (a new file): the umask decides. */
export function writeAtomic(path: string, text: string, mode: number | undefined): Failure | null {
  const temp = join(dirname(path), `${basename(path)}.${randomBytes(6).toString('hex')}.tmp`);
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
