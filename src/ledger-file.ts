// story: e07s02, e11s03
// The file half of the ledger (ledger.ts): open a file without blocking and
// only as a regular file (BUG-007), append one JSON line, and read the last
// bytes of a file cut to whole lines (F3). decision.ts and the review outcome
// log use the same helpers for their own files.
import { constants } from 'node:fs';
import { mkdir, open, type FileHandle } from 'node:fs/promises';
import { dirname } from 'node:path';
import { messageOf } from './errors.ts';

export type AppendResult = { ok: true } | { ok: false; error: string };

/** A failed close must not reach a caller that promises never to throw: on the
 * hook path a rejection would turn into a block (review A-F3, B-F9; round 5,
 * B-6). The file's own result is what the caller gets. */
export function ignoreCloseError(): void {}

/**
 * Open the ledger without blocking, and only if it is a regular file. The agent
 * can replace the file (T3), and opening a FIFO blocks until the other end is
 * opened, in a thread nothing can abort. A process stuck there cannot even
 * leave with process.exit, so the Stop hook would hang until the host cuts it
 * off and lets the stop go ahead (BUG-007). With O_NONBLOCK the open returns
 * at once, and a FIFO, a device or a directory is refused. override.ts does the
 * same for override.json.
 */
export async function openRegular(path: string, flags: number, mode?: number): Promise<FileHandle> {
  const handle = await open(path, flags | constants.O_NONBLOCK, mode);
  try {
    if (!(await handle.stat()).isFile()) {
      throw new Error(`${path} is not a regular file`);
    }
    return handle;
  } catch (error) {
    await handle.close().catch(ignoreCloseError);
    throw error;
  }
}

/**
 * Append one line in a single write. The leading newline ends any torn line
 * a crashed writer left, so the line starts on its own line. The directory is
 * made 0700 and the file 0600, since a line may hold a command string that
 * holds a secret (T8). Never throws.
 */
export async function writeLine(path: string, line: object): Promise<AppendResult> {
  let handle: FileHandle | undefined;
  try {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const flags = constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT;
    handle = await openRegular(path, flags, 0o600);
    await handle.appendFile(`\n${JSON.stringify(line)}\n`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  } finally {
    await handle?.close().catch(ignoreCloseError);
  }
}

/** The last `maxBytes` bytes of an open file, cut to whole lines. */
export async function tailText(
  handle: FileHandle,
  maxBytes: number,
): Promise<{ text: string; truncated: boolean }> {
  const { size } = await handle.stat();
  const length = Math.min(size, maxBytes);
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, size - length);
  const text = buffer.toString('utf8', 0, bytesRead);
  if (size <= maxBytes) {
    return { text, truncated: false };
  }
  const cut = text.indexOf('\n');
  return { text: cut === -1 ? '' : text.slice(cut + 1), truncated: true };
}
