// story: e11s04
// The decision log: every choice the agent makes without the owner is one
// line in the engine's folder, and the PR's Decisions section lists the lines
// of the branch.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { appendDecision, decisionsText, maxDecisionChars, readDecisions, toDecision } from './decision.ts';
import { cleanupTempDirs, makeTempDir } from './test-helpers.ts';

after(cleanupTempDirs);

const input = { question: 'Which file holds the log?', choice: 'A new decisions.jsonl', reason: 'The ledger is near its size limit.' };

test('AC-e11s04-11 a decision needs a question, a choice and a reason, each short text', () => {
  assert.deepEqual(toDecision(input), { ok: true, decision: input });
  for (const key of ['question', 'choice', 'reason'] as const) {
    assert.equal(toDecision({ ...input, [key]: '' }).ok, false, key);
    assert.equal(toDecision({ ...input, [key]: 3 }).ok, false, key);
    assert.equal(toDecision({ ...input, [key]: 'x'.repeat(maxDecisionChars + 1) }).ok, false, key);
  }
});

test('AC-e11s04-12 decisions are written and read back per branch, oldest first', async () => {
  const path = join(makeTempDir(), 'weftwork', 'decisions.jsonl');
  assert.deepEqual(await readDecisions(path), { ok: true, decisions: [], truncated: false });
  assert.deepEqual(await appendDecision(path, { ...input, branch: 'feat/a' }, new Date(0)), { ok: true });
  assert.deepEqual(await appendDecision(path, { ...input, choice: 'two', branch: 'feat/b' }, new Date(1)), { ok: true });
  assert.deepEqual(await appendDecision(path, { ...input, choice: 'three', branch: 'feat/a' }, new Date(2)), { ok: true });
  const read = await readDecisions(path);
  assert.ok(read.ok);
  assert.deepEqual(read.decisions.filter((d) => d.branch === 'feat/a').map((d) => d.choice), [input.choice, 'three']);
});

test('AC-e11s04-13 a line that is not a decision is skipped', async () => {
  const path = join(makeTempDir(), 'decisions.jsonl');
  writeFileSync(path, `{"torn\n${JSON.stringify({ at: 'x', branch: 'b', question: 'q', choice: 'c', reason: 'r' })}\n{"at":"y"}\n`);
  const read = await readDecisions(path);
  assert.ok(read.ok);
  assert.equal(read.decisions.length, 1);
});

test('AC-e11s04-14 the Decisions text is one line each, or None', () => {
  assert.equal(decisionsText([]), 'None\n');
  const text = decisionsText([{ at: 'x', branch: 'b', ...input, reason: 'two\nlines \u001b[31m' }]);
  assert.equal(text, '- Which file holds the log? Choice: A new decisions.jsonl. Reason: two lines \\u001b[31m\n');
});

test('AC-e11s04-19 a log cut to its last 1 MiB says older decisions were left out', () => {
  assert.equal(decisionsText([], true), 'None\n(older decisions were left out: the log is over 1 MiB)\n');
});
