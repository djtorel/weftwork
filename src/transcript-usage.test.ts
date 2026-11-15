// story: e09s04
// The session's token use, summed from the Claude Code transcript that the
// Stop hook input names (docs/BUDGET.md, The budget report). A report never
// changes a verdict, so every problem is a value with a reason.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempDirs, makeFifo, makeTempDir } from './test-helpers.ts';
import { maxTranscriptBytes, readTranscriptUsage, sumUsage } from './transcript-usage.ts';

after(cleanupTempDirs);

const fixture = join(import.meta.dirname, 'fixtures', 'transcript.jsonl');

test('AC-e09s04-07 the sum counts each assistant message once and skips what is not usage', () => {
  // msg_a is written twice (one message, streamed in two lines); the line with
  // no id counts on its own; bad numbers count 0; a user line never counts;
  // a line that is not JSON, or is cut off, is skipped.
  assert.deepEqual(sumUsage(readFileSync(fixture, 'utf8')), {
    input: 7,
    output: 222,
    cacheRead: 74918,
    cacheWrite: 22705,
  });
});

test('AC-e09s04-08 empty text sums to zero', () => {
  assert.deepEqual(sumUsage(''), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
});

test('AC-e09s04-09 the transcript file is read and summed', () => {
  const read = readTranscriptUsage(fixture);
  assert.ok(read.ok);
  assert.equal(read.tokens.output, 222);
});

test('AC-e09s04-10 a transcript that cannot be used gives a reason, never a throw', () => {
  const dir = makeTempDir();
  const big = join(dir, 'big.jsonl');
  writeFileSync(big, Buffer.alloc(maxTranscriptBytes + 1, 0x20));
  const link = join(dir, 'link.jsonl');
  symlinkSync(fixture, link);
  const folder = join(dir, 'folder');
  mkdirSync(folder);
  const cases: Array<[unknown, RegExp]> = [
    [undefined, /no transcript_path/],
    [42, /no transcript_path/],
    ['relative/t.jsonl', /not an absolute path/],
    [join(dir, 'missing.jsonl'), /no transcript at/],
    [big, /larger than/],
    [link, /cannot be opened/],
    [folder, /not a regular file/],
    [makeFifo(), /not a regular file/],
  ];
  for (const [path, reason] of cases) {
    const read = readTranscriptUsage(path);
    assert.ok(!read.ok, `${String(path)} is refused`);
    assert.match(read.error, reason);
  }
});
