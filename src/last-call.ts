// story: e07s04
// The call record: the adapter (claude-hook-cli.ts) writes one small JSON file
// each time the host calls it, and the live check (claude-live.ts) reads it to
// tell a hook that runs from one that is only registered. Only the last call
// is kept. It lives beside the ledger in the git dir, which git never lists, so
// a write never changes the tree fingerprint.
//
// The agent can write this file (T3), so a record is evidence, not proof. It
// can also replace the file: only a regular file is opened, never a FIFO
// (BUG-007) and never through a symlink, since the write truncates. The record
// holds the command string, so the file is 0600 in a 0700 directory (T8).
import { constants } from 'node:fs';
import { mkdir, type FileHandle } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { isMissing, messageOf } from './errors.ts';
import { isRecord } from './json.ts';
import { ledgerPath, openRegular } from './ledger.ts';

/** One call: when, which adapter file ran, and the declared command. */
export type LastCall = { at: string; cliPath: string; command: string };

export type LastCallWrite = { ok: true } | { ok: false; error: string };
export type LastCallRead = { ok: true; call: LastCall | null } | { ok: false; error: string };

/** A failed close must not reach the hook: the record is a side note, and a
 * rejection would turn into a block (review A-F3, B-F9). */
function ignoreCloseError(): void {}

/** The most the check reads. A real record is a few hundred bytes. */
const maxRecordBytes = 64 * 1024;

/** `last-call.json` beside the ledger of the working tree that holds `cwd`, or
 * null when there is no git dir. Never throws. */
export async function lastCallPath(cwd: string): Promise<string | null> {
  const ledger = await ledgerPath(cwd);
  return ledger === null ? null : join(dirname(ledger), 'last-call.json');
}

/** Replace the record with `call`. Truncates only after the open has proved
 * the path is a regular file with one link, not a symlink. Never throws. */
export async function writeLastCall(path: string, call: LastCall): Promise<LastCallWrite> {
  let handle: FileHandle | undefined;
  try {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW;
    handle = await openRegular(path, flags, 0o600);
    // A hard link is a regular file too: the truncate would empty the file it
    // shares an inode with (security review F1).
    if ((await handle.stat()).nlink !== 1) {
      throw new Error('the record has more than one hard link');
    }
    await handle.truncate(0);
    await handle.write(`${JSON.stringify(call)}\n`, 0);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  } finally {
    await handle?.close().catch(ignoreCloseError);
  }
}

/** The record in `data`, or null when a field is missing or has the wrong type. */
function toCall(data: unknown): LastCall | null {
  if (!isRecord(data)) {
    return null;
  }
  const { at, cliPath, command } = data;
  if (typeof at !== 'string' || typeof cliPath !== 'string' || typeof command !== 'string') {
    return null;
  }
  return { at, cliPath, command };
}

/** The text of an open record, refused past `maxRecordBytes`. */
async function recordText(handle: FileHandle): Promise<string> {
  if ((await handle.stat()).size > maxRecordBytes) {
    throw new Error(`the record is larger than ${maxRecordBytes} bytes`);
  }
  return handle.readFile('utf8');
}

/** Read the record. No file is no call; anything else that is not a valid
 * record is an error. Never throws. */
export async function readLastCall(path: string): Promise<LastCallRead> {
  let handle: FileHandle | undefined;
  try {
    handle = await openRegular(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const call = toCall(JSON.parse(await recordText(handle)));
    return call === null
      ? { ok: false, error: `${path} is not a call record` }
      : { ok: true, call };
  } catch (error) {
    return isMissing(error) ? { ok: true, call: null } : { ok: false, error: messageOf(error) };
  } finally {
    await handle?.close().catch(ignoreCloseError);
  }
}
