// story: e11s03
// Review lines in the counts ledger (review-ledger.ts, ledger.ts): one per
// round, read back as reviews, never as a run, a state or a skipped line.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';
import { appendEntry, appendReview, ledgerPath, readLedgerTail } from '../engine/ledger.ts';
import { cleanupTempDirs, makeTestRepo } from '../test-support/test-helpers.ts';

after(cleanupTempDirs);

const at = new Date('2026-11-15T12:00:00.000Z');
const round = { review: 'block' as const, branch: 'feat/x', round: 1, maxRounds: 3, mustFix: ['(codex): a.ts:1 bad'], shouldFix: [], failed: ['claude: exit 1'] };

test('a review line is read back as a review, not as a run or a skipped line', async () => {
  const path = (await ledgerPath(makeTestRepo())) as string;
  const verdict = { done: true, exitCode: 0, reason: 'passed' as const, command: 'true', fingerprint: 'F' };
  assert.deepEqual(await appendEntry(path, verdict, at), { ok: true });
  assert.deepEqual(await appendReview(path, round, at), { ok: true });
  const tail = await readLedgerTail(path, 1024 * 1024);
  assert.ok(tail.ok);
  assert.equal(tail.entries.length, 1);
  assert.equal(tail.skipped, 0);
  assert.deepEqual(tail.reviews, [{ at: at.toISOString(), ...round }]);
});

test('a review line with a bad field is skipped, not counted as a round', async () => {
  const path = (await ledgerPath(makeTestRepo())) as string;
  assert.deepEqual(await appendReview(path, round, at), { ok: true });
  appendFileSync(path, `${JSON.stringify({ ...round, at: at.toISOString(), round: '2' })}\n`);
  appendFileSync(path, `${JSON.stringify({ ...round, at: at.toISOString(), review: 'maybe' })}\n`);
  const tail = await readLedgerTail(path, 1024 * 1024);
  assert.ok(tail.ok);
  assert.equal(tail.reviews.length, 1);
  assert.equal(tail.skipped, 2);
});

test('a review line keeps the reviewers that answered, so the next round asks them first (docs/REVIEW.md § The panel)', async () => {
  const path = (await ledgerPath(makeTestRepo())) as string;
  assert.deepEqual(await appendReview(path, { ...round, answered: ['agy'] }, at), { ok: true });
  appendFileSync(path, `${JSON.stringify({ ...round, at: at.toISOString(), round: 2, answered: 'agy' })}\n`);
  const tail = await readLedgerTail(path, 1024 * 1024);
  assert.ok(tail.ok);
  assert.deepEqual(tail.reviews[0]?.answered, ['agy']);
  assert.equal(tail.reviews[1]?.answered, undefined, 'a bad answered field is dropped, not the round');
  assert.equal(tail.reviews.length, 2);
});
