// story: e11s03
// One review round (review.ts): the reply format the engine asks for, the
// findings it reads back, the round's verdict (only must-fix blocks; a
// reviewer that fails is neither pass nor block) and the round ceiling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditPrompt, diffReport, exhaustedReport, storedFindings, laterRoundPrompt, newOnUnchanged, panelOrder, parseReply, reviewPrompt, roundCeiling, roundPanel, roundReport, roundVerdict, roundsDone, roundsOn, runPanel, runReply, shortPanel, usageLimit, type ReviewerResult, type Stop } from './review.ts';
import type { ReviewEntry } from './review-ledger.ts';

test('the prompt is the brief, then the reply format the engine reads', () => {
  const prompt = reviewPrompt('Review the diff.');
  assert.match(prompt, /^Review the diff\.\n/);
  assert.match(prompt, /^VERDICT: APPROVE or CHANGES$/m);
  assert.match(prompt, /^MUST-FIX <file>:<line>/m);
  assert.match(prompt, /^SHOULD-FIX <file>:<line>/m);
  assert.match(prompt, /^FOLLOW-UP <file>:<line>/m);
  assert.match(prompt, /^FOLLOW-UP: a real defect this change did not cause/m);
  assert.match(prompt, /^MUST-FIX: the intended case is wrong, or this change causes a bug callers will hit, in any file\.$/m);
});

test('every round audits the same four things, named by the engine, not the brief (e13s03, R19)', () => {
  const text = auditPrompt({ sensitive: false, ruleFiles: ['AGENTS.md', 'CONVENTIONS.md'] });
  for (const line of [
    /^Audit the change for each of these, in this order:$/m,
    /^1\. Correctness: the intended case, the callers of what changed, error paths and edge cases the intent names\.$/m,
    /^2\. Proof: for each behaviour change, a test that would fail without it/m,
    /claims in the brief \(checks run, results\) match the repository/m,
    /^3\. Rules: the project rules in AGENTS\.md, CONVENTIONS\.md; a change that breaks one, and a doc or rule the change makes out of date\.$/m,
    /^4\. Scope: code, tests, options or guards the intent does not need/m,
    /^You may run read-only commands \(git, grep, a focused test\) to confirm a finding/m,
  ]) assert.match(text, line);
  assert.doesNotMatch(text, /Security:/);
  assert.match(auditPrompt({ sensitive: false, ruleFiles: [] }), /^3\. Rules: the conventions in the surrounding code; a change that breaks one, and a doc the change makes out of date\.$/m);
});

test('a sensitive change adds a security audit to the same pass (e13s03, R19)', () => {
  const text = auditPrompt({ sensitive: true, ruleFiles: [] });
  assert.match(text, /^5\. Security: input from outside \(files, env, network, model output\) reaching a shell, a path or a parser/m);
  assert.match(text, /secrets in code, logs or errors/m);
  assert.match(text, /a check that fails open/m);
});

test('a FOLLOW-UP is read on its own and never blocks (e13s02)', () => {
  const parsed = parseReply('VERDICT: APPROVE\nFOLLOW-UP src/old.ts:4 an old bug. Fix: later\n');
  assert.deepEqual(parsed, { ok: true, mustFix: [], shouldFix: [], followUp: ['src/old.ts:4 an old bug. Fix: later'] });
  const result = passed('codex', [], [], ['src/old.ts:4 an old bug']);
  assert.equal(roundVerdict([result]), 'pass');
  const text = roundReport({ verdict: 'pass', round: 1, maxRounds: 3, results: [result] });
  assert.match(text, /^reviewer 1, codex: 0 must-fix, 0 should-fix, 1 follow-up$/m);
  assert.match(text, /^follow-up r1f1 \(codex\): src\/old\.ts:4 an old bug$/m);
});

test('a later round is told what changed since the last round and which must-fix findings are open (e13s02)', () => {
  const text = laterRoundPrompt(2, ['src/a.ts', 'src/b.ts'], ['(codex): src/a.ts:1 bad']);
  assert.match(text, /^This is round 2\. Review only what changed since round 1 and the must-fix findings still open/m);
  assert.match(text, /^Files changed since round 1:\n- src\/a\.ts\n- src\/b\.ts$/m);
  assert.match(text, /^Must-fix findings open after round 1:\n- \(codex\): src\/a\.ts:1 bad$/m);
  assert.match(text, /A new MUST-FIX must be a bug this change causes, wherever it is\./);
  const none = laterRoundPrompt(3, [], []);
  assert.match(none, /^Files changed since round 2:\n- none$/m);
  assert.match(none, /^Must-fix findings open after round 2:\n- none$/m);
  const many = laterRoundPrompt(2, Array.from({ length: 105 }, (_, i) => `f${i}.ts`), []);
  assert.match(many, /^- and 5 more$/m);
});

test('a new must-fix on a file that did not change since the last round, and that no open finding named, is marked; it still blocks (e13s02)', () => {
  const results = [passed('codex', ['src/old.ts:3 new here', 'src/a.ts:9 on a changed file', 'src/open.ts:1 named before', 'no anchor'])];
  const marked = newOnUnchanged(results, { round: 2, changed: ['src/a.ts'], open: ['(codex): src/open.ts:5 x'] });
  assert.ok(marked[0]?.ok);
  assert.deepEqual(marked[0].mustFix, ['src/old.ts:3 new here [new, on a file unchanged since round 1]', 'src/a.ts:9 on a changed file', 'src/open.ts:1 named before', 'no anchor']);
  assert.equal(roundVerdict(marked), 'block');
});

test('the diff line: its size, its size at round 1, and a note past twice round 1 and 200 lines more (e13s02)', () => {
  assert.deepEqual(diffReport(120, undefined), ['diff: 120 lines changed from the base']);
  assert.deepEqual(diffReport(150, 120), ['diff: 150 lines changed from the base, 120 at round 1']);
  assert.deepEqual(diffReport(320, 120), ['diff: 320 lines changed from the base, 120 at round 1']);
  assert.deepEqual(diffReport(321, 120), ['diff: 321 lines changed from the base, 120 at round 1', 'diff growth: past twice round 1 and 200 lines more; cut the diff before the next round']);
  assert.deepEqual(diffReport(800, 400), ['diff: 800 lines changed from the base, 400 at round 1']);
  assert.equal(diffReport(801, 400).length, 2);
});

test('a reply with findings: each MUST-FIX and SHOULD-FIX line, prefix and list marks taken off', () => {
  const reply = [
    'Some thinking first.',
    'VERDICT: CHANGES',
    '- MUST-FIX src/a.ts:3 wrong exit code. Fix: return 1',
    'R2 [SHOULD-FIX] src/b.ts:9 a name. Fix: rename',
    'must-fix: src/c.ts:1 lower case too',
  ].join('\n');
  assert.deepEqual(parseReply(reply), {
    ok: true,
    mustFix: ['src/a.ts:3 wrong exit code. Fix: return 1', 'src/c.ts:1 lower case too'],
    shouldFix: ['src/b.ts:9 a name. Fix: rename'],
    followUp: [],
  });
});

test('an approval with no findings', () => {
  assert.deepEqual(parseReply('VERDICT: APPROVE\n'), { ok: true, mustFix: [], shouldFix: [], followUp: [] });
});

test('a UI-SCORE line is read as a number from 0 to 10; it never blocks (e11s05)', () => {
  assert.deepEqual(parseReply('VERDICT: APPROVE\nUI-SCORE: 2\n'), { ok: true, mustFix: [], shouldFix: [], followUp: [], score: 2 });
  assert.deepEqual(parseReply('VERDICT: APPROVE\nUI-SCORE: 7.5/10\n'), { ok: true, mustFix: [], shouldFix: [], followUp: [], score: 7.5 });
  assert.deepEqual(parseReply('VERDICT: APPROVE\nUI-SCORE: 11\n'), { ok: true, mustFix: [], shouldFix: [], followUp: [] });
  const low: ReviewerResult = { name: 'a', ok: true, mustFix: [], shouldFix: [], followUp: [], score: 0 };
  assert.equal(roundVerdict([low]), 'pass');
  assert.match(roundReport({ verdict: 'pass', round: 1, maxRounds: 3, results: [low] }), /^ui score \(a\): 0 of 10, reported, not a gate$/m);
});

test('a reply with no VERDICT line cannot be read: the reviewer failed', () => {
  const parsed = parseReply('MUST-FIX a.ts:1 x');
  assert.equal(parsed.ok, false);
  assert.match(parsed.ok ? '' : parsed.error, /no VERDICT line/);
});

const passed = (name: string, mustFix: string[] = [], shouldFix: string[] = [], followUp: string[] = []): ReviewerResult => ({ name, ok: true, mustFix, shouldFix, followUp });
const failed = (name: string): ReviewerResult => ({ name, ok: false, error: 'timed out after 1200 s' });

test('only a must-fix blocks; a should-fix passes; a failed reviewer is neither', () => {
  assert.equal(roundVerdict([passed('codex', ['x'])]), 'block');
  assert.equal(roundVerdict([passed('codex', [], ['y'])]), 'pass');
  assert.equal(roundVerdict([passed('codex'), failed('claude')]), 'pass');
  assert.equal(roundVerdict([passed('codex', ['x']), failed('claude')]), 'block');
  assert.equal(roundVerdict([failed('codex'), failed('claude')]), 'no-verdict');
});

const entry = (branch: string | null, round: number): ReviewEntry => ({
  at: '2026-11-15T10:00:00.000Z', review: 'block', branch, round, maxRounds: 3, mustFix: ['codex: a.ts:1 x'], shouldFix: [], failed: [],
});

test('rounds are counted on the current branch only', () => {
  const reviews = [entry('feat/a', 1), entry('feat/b', 1), entry('feat/a', 2)];
  assert.equal(roundsDone(roundsOn(reviews, 'feat/a')), 2);
  assert.equal(roundsDone(roundsOn(reviews, null)), 0);
});

test('the rounds done are the highest round number, so rounds cut from the ledger tail still count', () => {
  assert.equal(roundsDone([entry('feat/a', 3)]), 3);
});

test('the ceiling is max_rounds, or max_rounds_sensitive for a sensitive change', () => {
  const review = { reviewers: ['c'], panel: 1, maxRounds: 3, maxRoundsSensitive: 5, timeoutSeconds: 1, slowSeconds: 1, sensitivePaths: [] };
  assert.equal(roundCeiling(review, false), 3);
  assert.equal(roundCeiling(review, true), 5);
});

test('the report: verdict, round, each reviewer and every finding, for the PR', () => {
  const text = roundReport({
    verdict: 'block',
    round: 2,
    maxRounds: 3,
    results: [passed('codex', ['a.ts:1 x'], ['b.ts:2 y']), failed('claude')],
  });
  assert.match(text, /^weftwork review: block$/m);
  assert.match(text, /^round: 2 of 3$/m);
  assert.match(text, /^reviewer 1, codex: 1 must-fix, 1 should-fix$/m);
  assert.match(text, /^reviewer 2, claude: failed, timed out after 1200 s$/m);
  assert.match(text, /^must-fix r2m1 \(codex\): a\.ts:1 x$/m);
  assert.match(text, /^should-fix r2s1 \(codex\): b\.ts:2 y$/m);
});

test('the exhausted report lists the last round\'s follow-ups too (review round 1)', () => {
  const last = { ...entry('feat/a', 3), followUp: ['(codex): old.ts:1 old'] };
  assert.match(exhaustedReport([last], 3), /^unresolved follow-up r3f1 \(codex\): old\.ts:1 old$/m);
  assert.doesNotMatch(exhaustedReport([entry('feat/a', 3)], 3), /follow-up/);
});

test('ids count each kind across reviewers in setting order, as the ledger stores them (e13s05)', () => {
  const text = roundReport({ verdict: 'block', round: 1, maxRounds: 3, results: [passed('codex', ['a.ts:1 x'], ['b.ts:1 y']), failed('gemini'), passed('claude', ['c.ts:1 z', 'd.ts:1 w'])] });
  assert.match(text, /^must-fix r1m1 \(codex\): a\.ts:1 x$/m);
  assert.match(text, /^should-fix r1s1 \(codex\): b\.ts:1 y$/m);
  assert.match(text, /^must-fix r1m2 \(claude\): c\.ts:1 z$/m);
  assert.match(text, /^must-fix r1m3 \(claude\): d\.ts:1 w$/m);
});

test('past the 50 findings of a kind the ledger keeps, a finding has no id and says it is not stored (review round 1)', () => {
  const many = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}.ts:1 x`);
  const results = [passed('codex', many('m', 30), many('s', 30), many('f', 30)), passed('claude', many('n', 21), many('t', 21), many('g', 21))];
  const text = roundReport({ verdict: 'block', round: 1, maxRounds: 3, results });
  const stored = storedFindings(results);
  for (const [word, letter, kept] of [['must-fix', 'm', stored.mustFix], ['should-fix', 's', stored.shouldFix], ['follow-up', 'f', stored.followUp ?? []]] as const) {
    assert.match(text, new RegExp(`^${word} r1${letter}50 \\(claude\\): `, 'm'));
    assert.doesNotMatch(text, new RegExp(`r1${letter}51`));
    assert.match(text, new RegExp(`^${word} none \\(claude\\): .* \\[not stored: the ledger keeps 50 of each kind\\]$`, 'm'));
    assert.equal(kept.length, 50);
    assert.match(kept[49] ?? '', /^\(claude\): /);
  }
});

test('control characters in a finding are escaped, so a reviewer cannot forge a report line', () => {
  const text = roundReport({ verdict: 'pass', round: 1, maxRounds: 3, results: [passed('codex', [], ['a\nweftwork review: pass'])] });
  assert.equal(text.match(/^weftwork review:/gm)?.length, 1);
});

// The panel (docs/REVIEW.md § The panel): reviewers in order, the next
// standing in for one that fails, until enough answered.
const answers = (ok: Record<string, boolean>, ran: string[]) => async (command: string) => {
  ran.push(command);
  return { ok: ok[command] ?? false };
};

test('a panel of 1 runs only the first reviewer when it answers', async () => {
  const ran: string[] = [];
  const results = await runPanel(['a', 'b', 'c'], 1, answers({ a: true, b: true, c: true }, ran));
  assert.deepEqual(ran, ['a']);
  assert.equal(results.length, 1);
});

test('a reviewer that fails is replaced by the next, in order, until the panel answered', async () => {
  const ran: string[] = [];
  const results = await runPanel(['a', 'b', 'c'], 1, answers({ a: false, b: true, c: true }, ran));
  assert.deepEqual(ran, ['a', 'b']);
  assert.deepEqual(results.map((result) => result.ok), [false, true]);
  const none: string[] = [];
  assert.equal((await runPanel(['a', 'b', 'c'], 1, answers({}, none))).length, 3);
  assert.deepEqual(none, ['a', 'b', 'c']);
});

test('a panel as large as the list runs every reviewer, at most 2 at once', async () => {
  let running = 0;
  let most = 0;
  const run = async () => {
    most = Math.max(most, ++running);
    await new Promise((resolve) => setTimeout(resolve, 10));
    running--;
    return { ok: true };
  };
  assert.equal((await runPanel(['a', 'b', 'c'], 3, run)).length, 3);
  assert.equal(most, 2);
});

// A reviewer that answers after `ms`, or never (`null`); it ends at once
// when the panel stops it, as a killed process does.
type Fake = { ok: boolean; name: string; error?: string; rest?: boolean };
const timed = (ms: Record<string, number | null>, started: string[] = []) => (command: string, stop: AbortSignal) =>
  new Promise<Fake>((resolve) => {
    started.push(command);
    const wait = ms[command];
    const timer = wait === null || wait === undefined ? undefined : setTimeout(() => resolve({ ok: true, name: command }), wait);
    stop.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve({ ok: false, name: command, ...(stop.reason as Stop) });
    });
  });

test('a stand-in starts as soon as a reviewer fails, not when the other one running ends', async () => {
  const events: string[] = [];
  const run = async (command: string) => {
    events.push(`start ${command}`);
    if (command === 'b') await new Promise((resolve) => setTimeout(resolve, 60));
    events.push(`end ${command}`);
    return { ok: command !== 'a' };
  };
  const results = await runPanel(['a', 'b', 'c'], 2, run);
  assert.deepEqual(results.map((result) => result.ok), [false, true, true]);
  assert.ok(events.indexOf('start c') < events.indexOf('end b'), events.join(', '));
});

test('a reviewer with no reply after the slow time gets a stand-in, and is stopped when the stand-in answers', async () => {
  const started: string[] = [];
  const results = await runPanel(['a', 'b', 'c'], 1, timed({ a: null, b: 5, c: 5 }, started), 20);
  assert.deepEqual(started, ['a', 'b']);
  assert.deepEqual(results, [
    { ok: false, name: 'a', error: 'stopped as slow: no reply after 0.02 s', rest: true },
    { ok: true, name: 'b' },
  ]);
});

test('a slow reviewer that answers before its stand-in keeps the round; the stand-in is stopped and does not rest', async () => {
  const results = await runPanel(['a', 'b'], 1, timed({ a: 80, b: null }), 50);
  assert.deepEqual(results, [
    { ok: true, name: 'a' },
    { ok: false, name: 'b', error: 'stopped: not needed, the panel had answered', rest: false },
  ]);
});

test('with no stand-in left, a slow reviewer is stopped once the others answered and it ran twice as long as the slowest of them', async () => {
  const before = Date.now();
  const results = await runPanel(['a', 'b', 'c'], 3, timed({ a: null, b: 5, c: 5 }), 20);
  assert.deepEqual(results.map((result) => result.ok), [false, true, true]);
  assert.equal(results[0]?.error, 'stopped as slow: no reply after 0.02 s');
  assert.ok(Date.now() - before < 500);
  // One that is slow but answers within twice the slowest answer is kept.
  const kept = await runPanel(['a', 'b'], 2, timed({ a: 90, b: 60 }), 40);
  assert.deepEqual(kept.map((result) => result.ok), [true, true]);
});

test('a slow reviewer is not stopped while no reviewer has answered: it is the only verdict there can be', async () => {
  const results = await runPanel(['a'], 1, timed({ a: 50 }), 10);
  assert.deepEqual(results, [{ ok: true, name: 'a' }]);
});

test('a usage limit in what a failed reviewer printed is found, with its line', () => {
  assert.equal(usageLimit("thinking\nERROR: You've hit your usage limit. Upgrade to Pro, or try again at Nov 22nd, 2026 9:44 AM.\n"), "ERROR: You've hit your usage limit. Upgrade to Pro, or try again at Nov 22nd, 2026 9:44 AM.");
  for (const line of ['Error 429: Too Many Requests', 'RESOURCE_EXHAUSTED: Quota exceeded for model', 'Claude usage limit reached', "You've hit your limit, resets 3pm", 'rate limit exceeded']) assert.equal(usageLimit(line), line);
  for (const line of ['', 'sh: 1: agy: not found', 'exit 7', 'the 4290 lines changed']) assert.equal(usageLimit(line), null);
});

test('a stand-in stopped as not needed is not out of usage, whatever it had printed, and does not rest', async () => {
  const stop = new AbortController();
  const reply = runReply("echo 'the brief: review the usage limit code' >&2; sleep 20", process.cwd(), '', 30, undefined, stop.signal);
  setTimeout(() => stop.abort({ error: 'stopped: not needed, the panel had answered', rest: false } satisfies Stop), 300);
  assert.deepEqual(await reply, { ok: false, error: 'stopped: not needed, the panel had answered' });
  // One that ends by itself on its limit is out of usage, and rests.
  assert.deepEqual(await runReply("echo 'ERROR: usage limit' >&2; exit 1", process.cwd(), '', 30), { ok: false, error: 'out of usage: ERROR: usage limit', rest: true });
});

test('a round with fewer answers than its panel says which reviewers to ask again', () => {
  const ok: ReviewerResult = { name: 'codex', ok: true, mustFix: [], shouldFix: [], followUp: [] };
  const out: ReviewerResult = { name: 'agy', ok: false, error: 'out of usage: quota', rest: true };
  assert.equal(shortPanel([ok, out], 3), 'review again: 1 of 3 reviewers answered; agy did not (out of usage: quota). Go on with this round; list it in the pull request and the backlog');
  assert.equal(shortPanel([ok, out], 1), null);
  assert.equal(shortPanel([ok], 1), null);
  // With no answer there is no round to go on with: the no-verdict steps apply.
  assert.equal(shortPanel([out], 1), 'review again: 0 of 1 reviewers answered; agy did not (out of usage: quota). List it in the pull request and the backlog');
});

test('a later round tries first the reviewers that answered the last one', () => {
  const commands = ['agy -p x', 'claude -p', 'codex exec -'];
  assert.deepEqual(panelOrder(commands, ['claude']), ['claude -p', 'agy -p x', 'codex exec -']);
  assert.deepEqual(panelOrder(commands, ['codex', 'agy']), ['codex exec -', 'agy -p x', 'claude -p']);
  assert.deepEqual(panelOrder(commands, ['gone']), commands);
  assert.deepEqual(panelOrder(commands), commands);
  // Two entries of one command are both kept (review round 3).
  assert.deepEqual(panelOrder(['b -', 'a -', 'a -'], ['a']), ['a -', 'b -', 'a -']);
});

test('the panel: review.panel, all of them for a sensitive change or when asked; a request never lowers it', () => {
  const review = { reviewers: ['a', 'b', 'c'], panel: 1 };
  assert.deepEqual(roundPanel(review, { asked: undefined, sensitive: false }), { size: 1, why: 'review.panel' });
  assert.deepEqual(roundPanel(review, { asked: undefined, sensitive: true }), { size: 3, why: 'a sensitive change' });
  assert.deepEqual(roundPanel(review, { asked: 'all', sensitive: false }), { size: 3, why: 'asked for in the request' });
  assert.deepEqual(roundPanel(review, { asked: 2, sensitive: false }), { size: 2, why: 'asked for in the request' });
  assert.deepEqual(roundPanel({ reviewers: ['a', 'b', 'c'], panel: 2 }, { asked: 1, sensitive: false }), { size: 2, why: 'review.panel' });
  assert.deepEqual(roundPanel({ reviewers: ['a'], panel: 3 }, { asked: undefined, sensitive: false }), { size: 1, why: 'review.panel' });
});
