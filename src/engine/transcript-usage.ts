// story: e09s04
// The session's token use, summed from the Claude Code transcript that the
// Stop hook input names in `transcript_path`. Tokens only: dollars need a
// price table per model that goes stale (e09s04 choice 1).
//
// The transcript is JSONL. Each assistant line carries `message.usage`, and
// one message streamed in parts is written as several lines with the same
// `message.id` and the same usage, so each id counts once (the last line
// wins). The host writes the file while it runs, so the last line can be cut
// off, even inside a multi-byte character; a line that is not JSON is
// skipped. The sum is a report, never a verdict: every problem is a returned
// reason (e09s04 choice 2).
import { isAbsolute } from 'node:path';
import { isRecord } from '../shared/json.ts';
import { readRegularFile } from '../shared/regular-file.ts';

export type TokenUsage = { input: number; output: number; cacheRead: number; cacheWrite: number };

export type TokenRead = { ok: true; tokens: TokenUsage } | { ok: false; error: string };

/** The largest transcript read. A long session's transcript runs to tens of
 * MiB; a larger one gives no count rather than a slow stop. */
export const maxTranscriptBytes = 64 * 1024 * 1024;

/** A usage field as a count: a non-negative integer, or 0. */
function count(value: unknown): number {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : 0;
}

function usageOf(usage: Record<string, unknown>): TokenUsage {
  return {
    input: count(usage.input_tokens),
    output: count(usage.output_tokens),
    cacheRead: count(usage.cache_read_input_tokens),
    cacheWrite: count(usage.cache_creation_input_tokens),
  };
}

/** The message of an assistant line that has usage, or null. */
function assistantMessage(line: string): Record<string, unknown> | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.type !== 'assistant' || !isRecord(value.message)) {
    return null;
  }
  return isRecord(value.message.usage) ? value.message : null;
}

/** The token use in transcript JSONL `text`, each assistant message once. */
export function sumUsage(text: string): TokenUsage {
  const byId = new Map<string, TokenUsage>();
  const unnamed: TokenUsage[] = [];
  for (const line of text.split('\n')) {
    const message = assistantMessage(line);
    if (message === null) continue;
    const usage = usageOf(message.usage as Record<string, unknown>);
    if (typeof message.id === 'string') byId.set(message.id, usage);
    else unnamed.push(usage);
  }
  const total: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  for (const usage of [...byId.values(), ...unnamed]) {
    total.input += usage.input;
    total.output += usage.output;
    total.cacheRead += usage.cacheRead;
    total.cacheWrite += usage.cacheWrite;
  }
  return total;
}

/** Read the transcript at `path` (the raw `transcript_path` value) and sum it.
 * Only an absolute path to a regular file of at most maxTranscriptBytes is
 * read, without following a symlink and without blocking on a FIFO. Its end
 * may be cut inside a character: the host can be writing the last line. */
export function readTranscriptUsage(path: unknown): TokenRead {
  if (typeof path !== 'string' || path === '') {
    return { ok: false, error: 'the hook input has no transcript_path' };
  }
  if (!isAbsolute(path)) {
    return { ok: false, error: 'transcript_path is not an absolute path' };
  }
  const read = readRegularFile(path, { follow: false, maxBytes: maxTranscriptBytes, cutEnd: true });
  if (!read.ok) return read;
  if (read.file === null) return { ok: false, error: `no transcript at ${path}` };
  return { ok: true, tokens: sumUsage(read.file.text) };
}
