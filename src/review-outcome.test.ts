// story: e13s05
// Finding outcomes (review-outcome.ts, review-outcome-cli.ts): each finding
// of a review round has an id (r<round><m|s|f><n>), the agent records what
// became of it (fixed, disputed, declined, follow-up) with its evidence, and
// the report gives each reviewer's resolution rate, the share of its
// findings that were fixed (R19: how Cursor and OpenAI score a reviewer).
// A report, never a gate.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findingById, outcomeReport, type OutcomeEntry } from './review-outcome.ts';
import type { ReviewEntry } from './review-ledger.ts';
import { cleanupTempDirs, isolatedEnv, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const round = (n: number, mustFix: string[], shouldFix: string[] = [], followUp: string[] = [], branch = 'feat/a'): ReviewEntry => ({
  at: '2026-11-15T10:00:00.000Z', review: mustFix.length > 0 ? 'block' : 'pass', branch, round: n, maxRounds: 3, mustFix, shouldFix, followUp, failed: [],
});

const outcome = (id: string, kind: OutcomeEntry['outcome'], branch = 'feat/a'): OutcomeEntry => ({ at: '2026-11-15T11:00:00.000Z', branch, id, outcome: kind, evidence: 'e', finding: 'f' });

test('an id names one stored finding: its round, its kind and its place among that kind', () => {
  const reviews = [round(1, ['(codex): a.ts:1 x', '(claude): b.ts:2 y'], ['(codex): c.ts:3 z']), round(2, [], [], ['(codex): d.ts:4 old'])];
  assert.deepEqual(findingById(reviews, 'r1m2'), { round: 1, kind: 'must-fix', text: '(claude): b.ts:2 y' });
  assert.deepEqual(findingById(reviews, 'r1s1'), { round: 1, kind: 'should-fix', text: '(codex): c.ts:3 z' });
  assert.deepEqual(findingById(reviews, 'r2f1'), { round: 2, kind: 'follow-up', text: '(codex): d.ts:4 old' });
  for (const id of ['r1m3', 'r3m1', 'r1x1', 'm1', 'r0m1', 'r1m0']) assert.equal(findingById(reviews, id), null, id);
});

test('the report: each finding with its last outcome or open, then each reviewer\'s counts and resolution rate', () => {
  const reviews = [round(1, ['(codex): a.ts:1 x', '(claude): b.ts:2 y'], ['(codex): c.ts:3 z']), round(2, [], [], ['(codex): d.ts:4 old'])];
  const outcomes = [outcome('r1m1', 'disputed'), outcome('r1m1', 'fixed'), outcome('r1s1', 'declined'), outcome('r2f1', 'follow-up'), outcome('r1m1', 'declined', 'feat/other')];
  const text = outcomeReport(reviews, outcomes);
  assert.match(text, /^weftwork review outcomes: 4 findings in 2 rounds$/m);
  assert.match(text, /^r1m1 must-fix fixed: \(codex\): a\.ts:1 x$/m);
  assert.match(text, /^r1m2 must-fix open: \(claude\): b\.ts:2 y$/m);
  assert.match(text, /^r1s1 should-fix declined: \(codex\): c\.ts:3 z$/m);
  assert.match(text, /^r2f1 follow-up follow-up: \(codex\): d\.ts:4 old$/m);
  assert.match(text, /^reviewer claude: 1 must-fix or should-fix, 0 fixed, 0 disputed, 0 declined, 1 open; 0 follow-up; resolution rate 0%$/m);
  assert.match(text, /^reviewer codex: 2 must-fix or should-fix, 1 fixed, 0 disputed, 1 declined, 0 open; 1 follow-up; resolution rate 50%$/m);
});

test('no rounds: the report says so', () => {
  assert.equal(outcomeReport([], []), 'weftwork review outcomes: no review rounds on this branch\n');
});

const cli = join(import.meta.dirname, 'review-outcome-cli.ts');
const engineCli = join(import.meta.dirname, 'cli.ts');
const reviewCli = join(import.meta.dirname, 'review-cli.ts');

function node(script: string, cwd: string, input: object) {
  const out = spawnSync(process.execPath, [script], { cwd, input: JSON.stringify(input), env: isolatedEnv(), encoding: 'utf8', timeout: 30000 });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

test('the CLI records an outcome for an id the ledger has, refuses one it does not, and reports them', () => {
  const repo = makeTestRepo();
  writeFileSync(join(repo, 'weftwork.yaml'), `---\nreview:\n  reviewers:\n    - "printf 'VERDICT: CHANGES\\\\nMUST-FIX tracked.txt:1 bad\\\\n'"\n`);
  assert.equal(node(engineCli, repo, { command: 'true' }).status, 0);
  const round1 = node(reviewCli, repo, { command: 'true', brief: 'Review.' });
  assert.equal(round1.status, 1, round1.stderr);
  assert.match(round1.stdout, /^must-fix r1m1 \(printf\): tracked\.txt:1 bad$/m);

  const recorded = node(cli, repo, { id: 'r1m1', outcome: 'fixed', evidence: 'src/a.test.ts fails without the fix' });
  assert.equal(recorded.status, 0, recorded.stderr);
  assert.match(recorded.stdout, /^recorded: r1m1 fixed$/m);
  const report = node(cli, repo, { report: true });
  assert.equal(report.status, 0, report.stderr);
  assert.match(report.stdout, /^r1m1 must-fix fixed: \(printf\): tracked\.txt:1 bad$/m);
  assert.match(report.stdout, /^reviewer printf: 1 must-fix or should-fix, 1 fixed, 0 disputed, 0 declined, 0 open; 0 follow-up; resolution rate 100%$/m);

  for (const [input, error] of [
    [{ id: 'r1m2', outcome: 'fixed', evidence: 'x' }, /no finding r1m2 on this branch/],
    [{ id: 'r1m1', outcome: 'done', evidence: 'x' }, /"outcome" must be fixed, disputed, declined or follow-up/],
    [{ id: 'r1m1', outcome: 'fixed' }, /"evidence" must be a non-empty string of at most 500 characters/],
    [{}, /give "id", "outcome" and "evidence", or "report": true/],
  ] as [object, RegExp][]) {
    const out = node(cli, repo, input);
    assert.equal(out.status, 2, JSON.stringify(input));
    assert.equal(out.stdout, '');
    assert.match(out.stderr, error);
  }
});
