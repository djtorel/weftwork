// story: e12s02
// Undo a setup. Apply's writes (setup.ts `Written`) go into a record in the
// engine's folder, `<absolute git dir>/weftwork/setup-record.json`; undo
// reverses each one, newest first, that is still as setup left it: a file
// it created is removed, an appended file gets its old text back (or, when
// the owner edited it since, loses only the lines setup added), and an
// overwritten file comes back from `<path>.weftwork-old`. Anything else is
// kept and stays in the record. docs/SETUP.md.
import { lstatSync, readdirSync, readlinkSync, renameSync, rmdirSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { isMissing, messageOf, type Failure } from '../shared/errors.ts';
import { isRecord } from '../shared/json.ts';
import { weftworkDir } from '../engine/ledger.ts';
import { readRegularFile, writeAtomic } from '../shared/regular-file.ts';
import { gitCommonDir, pathRefusal, type Written } from './setup.ts';

export type Undone = { ok: true; undone: string[]; kept: string[] } | Failure;

const maxFileBytes = 16 * 1024 * 1024;
const oldSuffix = '.weftwork-old';

async function recordFile(dir: string): Promise<string | null> {
  const folder = await weftworkDir(dir);
  return folder === null ? null : join(folder, 'setup-record.json');
}

function isWritten(value: unknown): value is Written {
  return (
    isRecord(value) &&
    typeof value.path === 'string' &&
    ['create', 'append', 'overwrite'].includes(value.made as string) &&
    typeof value.link === 'boolean' &&
    (value.before === null || typeof value.before === 'string') &&
    typeof value.after === 'string'
  );
}

/** The record: the folder setup wrote into, and its writes. */
type SetupRecord = { root: string; entries: Written[] };

function readRecord(path: string): { ok: true; record: SetupRecord | null } | Failure {
  const read = readRegularFile(path, { follow: false, maxBytes: maxFileBytes });
  if (!read.ok) return read;
  if (read.file === null) return { ok: true, record: null };
  try {
    const parsed: unknown = JSON.parse(read.file.text);
    if (isRecord(parsed) && typeof parsed.root === 'string' && Array.isArray(parsed.entries) && parsed.entries.every(isWritten)) {
      return { ok: true, record: { root: parsed.root, entries: parsed.entries } };
    }
  } catch {
    // reported below
  }
  return { ok: false, error: `${path} is not a setup record` };
}

function writeRecord(path: string, root: string, entries: Written[]): Failure | null {
  if (entries.length > 0) return writeAtomic(path, `${JSON.stringify({ root, entries }, null, 2)}\n`, undefined);
  try {
    rmSync(path, { force: true });
    return null;
  } catch (error) {
    return { ok: false, error: `${path} could not be removed: ${messageOf(error)}` };
  }
}

/** Add `entries` to the record of the repository at `dir`. Null when done. */
export async function recordSetup(dir: string, entries: Written[]): Promise<Failure | null> {
  if (entries.length === 0) return null;
  const path = await recordFile(dir);
  if (path === null) return { ok: false, error: `${dir} is not in a git repository; setup cannot be recorded for undo` };
  const old = readRecord(path);
  if (!old.ok) return old;
  const root = resolve(dir);
  if (old.record !== null && old.record.root !== root) return { ok: false, error: `${path} records a setup of ${old.record.root}; undo it first` };
  return writeRecord(path, root, [...(old.record?.entries ?? []), ...entries]);
}

/** The text at `path` now: a symlink's target when `link`, else the regular
 * file's text; null when it is something else or missing. */
function current(path: string, link: boolean): string | null {
  if (link) {
    try {
      return readlinkSync(path);
    } catch {
      return null;
    }
  }
  const read = readRegularFile(path, { follow: false, maxBytes: maxFileBytes });
  return read.ok && read.file !== null ? read.file.text : null;
}

/** Remove each empty folder from `path`'s up to, not including, `dir`. */
function removeEmptyFolders(dir: string, path: string): void {
  for (let folder = dirname(path); relative(dir, folder) !== '' && !relative(dir, folder).startsWith('..'); folder = dirname(folder)) {
    try {
      if (readdirSync(folder).length > 0) return;
      rmdirSync(folder);
    } catch {
      return;
    }
  }
}

/** Why undo must not touch `entry`: a relative path that leaves `dir` or
 * goes through a symlinked folder, or an absolute one outside the engine's
 * folder in the git common dir (where the backlog is). Null when it may. */
function entryRefusal(dir: string, entry: Written, common: string | null): string | null {
  if (isAbsolute(entry.path)) {
    const inside = common === null ? '..' : relative(join(common, 'weftwork'), entry.path);
    return inside === '' || inside.startsWith('..') || isAbsolute(inside) ? `${entry.path} is outside the engine folder` : null;
  }
  if (normalize(entry.path).startsWith('..')) return `${entry.path} leaves the project`;
  return pathRefusal(dir, entry.path);
}

/** Undo one entry; true when undone, false when kept. */
function undoOne(dir: string, entry: Written, common: string | null): boolean | Failure {
  if (entryRefusal(dir, entry, common) !== null) return false;
  const path = isAbsolute(entry.path) ? entry.path : join(dir, entry.path);
  const now = current(path, entry.link);
  try {
    if (entry.made === 'append') {
      if (now === null || entry.before === null || !entry.after.startsWith(entry.before)) return false;
      const added = entry.after.slice(entry.before.length);
      if (now !== entry.after && !now.endsWith(added)) return false;
      const mode = lstatSync(path).mode & 0o7777;
      const failed = writeAtomic(path, now.slice(0, now.length - added.length), mode);
      return failed ?? true;
    }
    if (now !== entry.after) return false;
    if (entry.made === 'overwrite') {
      try {
        lstatSync(path + oldSuffix);
      } catch (error) {
        if (isMissing(error)) return false;
        throw error;
      }
      rmSync(path);
      renameSync(path + oldSuffix, path);
      return true;
    }
    rmSync(path);
    if (!isAbsolute(entry.path)) removeEmptyFolders(dir, path);
    return true;
  } catch (error) {
    return { ok: false, error: `${entry.path} could not be undone: ${messageOf(error)}` };
  }
}

/** Undo the recorded setup of the repository at `dir`, newest write first. */
export async function undoSetup(dir: string): Promise<Undone> {
  const path = await recordFile(dir);
  if (path === null) return { ok: false, error: `${dir} is not in a git repository` };
  const read = readRecord(path);
  if (!read.ok) return read;
  if (read.record === null || read.record.entries.length === 0) return { ok: false, error: 'there is no setup to undo' };
  const { root, entries } = read.record;
  if (resolve(dir) !== root) return { ok: false, error: `the setup was of ${root}; undo it with that "path"` };
  const common = gitCommonDir(root);
  const undone: string[] = [];
  const keep: Written[] = [];
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index];
    const result = undoOne(root, entry, common);
    if (typeof result !== 'boolean') {
      // What is not undone stays recorded, so undo can run again.
      writeRecord(path, root, [...entries.slice(0, index + 1), ...keep.reverse()]);
      return result;
    }
    if (result) undone.push(entry.path);
    else keep.push(entry);
  }
  const failed = writeRecord(path, root, keep.reverse());
  if (failed !== null) return failed;
  return { ok: true, undone, kept: [...new Set(keep.map((entry) => entry.path))] };
}
