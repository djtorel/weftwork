// story: e06s05
// The one-shot, owner-authored escape hatch: the record and how to read it.
//
// The owner writes `<git dir>/weftwork/override.json` by hand. It names one
// exact command and one exact tree fingerprint, never a pattern, and says why
// and who. The engine cannot tell who wrote the file, so authorship is a
// claim and not proof (threat model T4). An agent that can write files can
// forge a record; the design limits that to one run on one tree and a log
// line. Matching is exact string equality only.
//
// This file never reads the ledger and never prints. Its callers decide what
// to say, and the engine says nothing about a record unless it is taken, so a
// refusal never names the hatch (R13 [S56]).
import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { open, rename, type FileHandle } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { isMissing, messageOf } from './errors.ts';
import { isRecord } from './json.ts';
import { isKind, type OverrideKind } from './ledger-state.ts';

/** One record. All fields are strings. */
export type Override = {
  command: string;
  fingerprint: string;
  reason: string;
  author: string;
  kind: OverrideKind;
};

export type ParsedOverride = { ok: true; override: Override } | { ok: false; error: string };

export type ReadOverride =
  | { ok: true; override: Override | null }
  | { ok: false; error: string };

/** The most of the file the reader accepts (CWE-400). */
export const overrideFileCap = 64 * 1024;

const maxReason = 1000;
const maxAuthor = 200;
const recordKeys = ['command', 'fingerprint', 'reason', 'author', 'kind'];

const rejected = (error: string): ParsedOverride => ({ ok: false, error });
const notRegularFile: ReadOverride = { ok: false, error: 'record is not a regular file' };
const tooLarge: ReadOverride = { ok: false, error: `record is over ${overrideFileCap} bytes` };

function isText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.length <= max;
}

/** A command that is only glob or regex characters can only be a pattern. */
function isPattern(command: string): boolean {
  return /^[*?.+[\]()^$|\s]+$/.test(command);
}

function isTreeFingerprint(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

/** True when the five fields of `data` each have the type and limits the rules
 * set. A command must be exact, not a pattern. */
function isOverrideFields(data: Record<string, unknown>): data is Override {
  const { command, fingerprint, reason, author, kind } = data;
  return (
    isText(command, Infinity) &&
    !isPattern(command) &&
    isTreeFingerprint(fingerprint) &&
    isText(reason, maxReason) &&
    isText(author, maxAuthor) &&
    isKind(kind)
  );
}

/**
 * Read one record from `text`. A leading UTF-8 byte order mark is ignored,
 * since some editors add one. Exactly the five keys, and the fields as
 * `isOverrideFields` describes them. Returns a value for a bad record and
 * never throws.
 */
export function parseOverride(text: string): ParsedOverride {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return rejected('record is not JSON');
  }
  if (!isRecord(data)) {
    return rejected('record must be one JSON object');
  }
  if (Object.keys(data).some((key) => !recordKeys.includes(key))) {
    return rejected('record has a key that is not allowed');
  }
  return isOverrideFields(data) ? { ok: true, override: data } : rejected('record fields are not valid');
}

/**
 * Read the record at `path`. A file that does not exist is no record. A file
 * over 64 KiB, a symlink and anything that is not a regular file is not ok.
 * The open refuses a symlink and does not block, so a FIFO swapped in at any
 * moment cannot hang the engine; `fstat` on the open handle then checks the
 * type, with no gap between the check and the read. Never throws.
 */
export async function readOverride(path: string): Promise<ReadOverride> {
  let handle: FileHandle | undefined;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const info = await handle.stat();
    if (!info.isFile()) {
      return notRegularFile;
    }
    if (info.size > overrideFileCap) {
      return tooLarge;
    }
    return await readRecord(handle);
  } catch (error) {
    return isMissing(error) ? { ok: true, override: null } : { ok: false, error: messageOf(error) };
  } finally {
    await handle?.close();
  }
}

/** The record in an open file. The read stops one byte past the cap, so a file
 * that grew after the size check is still refused. */
async function readRecord(handle: FileHandle): Promise<ReadOverride> {
  const buffer = Buffer.alloc(overrideFileCap + 1);
  const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
  if (bytesRead > overrideFileCap) {
    return tooLarge;
  }
  const parsed = parseOverride(buffer.toString('utf8', 0, bytesRead));
  return parsed.ok ? { ok: true, override: parsed.override } : parsed;
}

/** A name no earlier spent record has, so a rename cannot overwrite one. */
function usedName(now: Date): string {
  return `override.used-${now.getTime()}-${randomBytes(4).toString('hex')}.json`;
}

/** The run a record must name: its exact command and its tree fingerprint. */
type RunKey = { command: string; fingerprint: string | null };

/** True only for a record that names this exact command and this exact tree. A
 * null fingerprint, a missing record and a mismatch are all false. */
function isForRun(override: Override | null, run: RunKey): override is Override {
  return (
    override !== null &&
    run.fingerprint !== null &&
    override.command === run.command &&
    override.fingerprint === run.fingerprint
  );
}

/**
 * Take the record at `path` for one run: the exact `command` on the exact
 * `fingerprint` (null never matches). The record is taken by renaming it to
 * `override.used-<epoch ms>-<random>.json` in the same directory. Rename is atomic, so
 * two engines that race get one winner, and the record stays for the owner.
 * Returns the record only when the rename worked; a missing or bad record, a
 * record for another run, a lost race and a rename error all give null, and a
 * record that does not match stays where it is. Never throws, never prints.
 */
export async function takeOverride(path: string, run: RunKey, now: Date): Promise<Override | null> {
  const read = await readOverride(path);
  const override = read.ok ? read.override : null;
  if (!isForRun(override, run)) {
    return null;
  }
  try {
    await rename(path, join(dirname(path), usedName(now)));
    return override;
  } catch {
    return null;
  }
}
