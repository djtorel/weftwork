// story: e11s03
// Thin shell for one review round: JSON `{"command": "...", "brief": "...",
// "sensitive": false}` on stdin, the round's report on stdout. It runs the
// reviewers only after the engine's done gate passed for `command` on this
// tree, and counts the round in the ledger. Logic lives in review.ts.
// docs/REVIEW.md.
//
// Exit 0 pass, 1 block (fix the must-fix findings, pass the gate, review
// again), 3 no verdict (every reviewer failed, or the tree changed during the
// review), 4 the done gate has not passed (no reviewer ran), 5 the round
// ceiling (no reviewer ran), 2 when it cannot run (a detached HEAD among the
// causes, since rounds are counted per branch), with the reason on stderr and
// nothing on stdout.
import { join } from 'node:path';
import { readJsonObject, terminalSafe } from './shared/cli-io.ts';
import { appendReview, ledgerPath, ledgerReadCap, readLedgerTail, weftworkDir } from './engine/ledger.ts';
import { prProof } from './proof/pr-proof.ts';
import type { RoundVerdict } from './review/review-ledger.ts';
import { loadReview } from './review/review-setting.ts';
import { groundResults, roundScope, ruleFiles, writeChangeDiff } from './review/review-scope.ts';
import { auditPrompt, diffReport, exhaustedReport, laterRoundPrompt, newOnUnchanged, panelOrder, reviewPrompt, roundCeiling, roundPanel, roundReport, roundsDone, roundsOn, roundVerdict, runReviewers, runsOf, shortPanel, storedFindings, timeLine } from './review/review.ts';
import { withRest } from './review/reviewer-rest.ts';
import { isInteger } from './shared/json.ts';
import { currentBranch, fingerprintTree } from './engine/tree.ts';
import { baseCommit, imagesValue, readDesign, shotLines, uiForReview, uiPrompt, type Design, type UiForReview } from './review/ui.ts';
import { loadUi, type UiSetting } from './review/ui-setting.ts';
import { copyImages, removeImages } from './review/reviewer-images.ts';

const exitCodes: Record<RoundVerdict, number> = { pass: 0, block: 1, 'no-verdict': 3 };

function fail(error: string): void {
  process.stderr.write(`review: ${terminalSafe(error)}\n`);
  process.exitCode = 2;
}

function answer(text: string, exitCode: number): void {
  process.stdout.write(text);
  process.exitCode = exitCode;
}

async function main(): Promise<void> {
  const read = await readJsonObject();
  if (read.kind === 'refused') return fail(read.error);
  const { command, brief, sensitive = false, base, panel: asked } = read.input;
  if (typeof command !== 'string' || command.trim() === '') return fail('"command" must be a non-empty string');
  if (typeof brief !== 'string' || brief.trim() === '') return fail('"brief" must be a non-empty string');
  if (typeof sensitive !== 'boolean') return fail('"sensitive" must be true or false');
  if (base !== undefined && (typeof base !== 'string' || base === '')) return fail('"base" must be a non-empty string');
  if (asked !== undefined && asked !== 'all' && !(isInteger(asked) && asked >= 1 && asked <= 5)) return fail('"panel" must be "all" or an integer from 1 to 5');
  const cwd = process.cwd();
  const tree = await fingerprintTree(cwd);
  if (!tree.ok) return fail(`no git working tree: ${tree.error}`);
  const setting = await loadReview(cwd, process.env);
  if (!setting.ok) return fail(setting.error);
  const ui = await loadUi(cwd, process.env);
  if (!ui.ok) return fail(ui.error);
  const path = await ledgerPath(cwd);
  if (path === null) return fail('no git dir for the ledger');
  const ledger = await readLedgerTail(path, ledgerReadCap);
  if (!ledger.ok) return fail(`the ledger cannot be read: ${ledger.error}`);
  const branch = await currentBranch(cwd);
  if (!branch.ok) return fail(`the branch cannot be read: ${branch.error}`);
  if (branch.branch === null) return fail('HEAD is detached; review rounds are counted per branch, so check out a branch first');

  const proof = prProof({ entries: ledger.entries, states: ledger.states, command, fingerprint: tree.fingerprint });
  if (!proof.ready) return answer(`weftwork review: not run\nwhy: the done gate has not passed: ${proof.why}\n`, 4);
  const rounds = roundsOn(ledger.reviews, branch.branch);
  const weftwork = await weftworkDir(cwd);
  if (weftwork === null) return fail('no git dir for the review scratch files');
  const last = rounds.at(-1);
  const scoped = await roundScope({ cwd, scratch: weftwork, base, sensitivePaths: setting.review.sensitivePaths, last });
  if (!scoped.ok) return fail(scoped.error);
  const scope = scoped.scope;
  const maxRounds = roundCeiling(setting.review, sensitive || scope.sensitiveBy !== null);
  if (roundsDone(rounds) >= maxRounds) return answer(exhaustedReport(rounds, maxRounds), 5);
  const shots = await uiCheck(cwd, weftwork, ui.ui, base, branch.branch, tree.fingerprint);
  if (shots.kind === 'error') return fail(shots.error);
  if (shots.kind === 'missing') return answer(`weftwork review: not run\nwhy: ${terminalSafe(shots.why)}\nnext: ${shots.next ?? `echo '{"phase":"after"}' | node src/ui-cli.ts`}\n`, 4);
  const ready = shots.kind === 'ready' ? shots : null;
  let design: Design | null = null;
  if (ready !== null && ui.ui?.design !== undefined) {
    const read = await readDesign(cwd, ui.ui.design);
    if (!read.ok) return fail(read.error);
    design = read.design;
  }

  const round = roundsDone(rounds) + 1;
  const later = last !== undefined && scope.changedSinceLast !== null ? { round, changed: scope.changedSinceLast, open: last.mustFix } : null;
  const diff = scope.base === null ? null : await writeChangeDiff(cwd, weftwork, scope.base, scope.tree);
  if (diff !== null && !diff.ok) return fail(diff.error);
  // Only the engine sets these; values from the caller are dropped (review round 1).
  const { WEFTWORK_IMAGES: _images, WEFTWORK_IMAGES_DIR: _dir, WEFTWORK_DIFF: _diff, ...env } = process.env;
  if (diff !== null) env['WEFTWORK_DIFF'] = diff.path;
  // The reviewers read copies of the screenshots outside the git dir, at the
  // same place under the copies' folder as under the engine's (reviewer-images.ts).
  let copies: string | null = null;
  if (ready !== null) {
    const images = imagesValue(weftwork, ready);
    if (!images.ok) return fail(images.error);
    const copied = await copyImages(weftwork, images.value.split(','));
    if (!copied.ok) return fail(copied.error);
    copies = copied.dir;
    env['WEFTWORK_IMAGES'] = copied.paths.join(',');
    env['WEFTWORK_IMAGES_DIR'] = join(copies, 'ui');
  }
  const parts = [brief.replace(/\n*$/, ''), auditPrompt({ sensitive: sensitive || scope.sensitiveBy !== null, ruleFiles: await ruleFiles(scope.root) })];
  if (diff !== null && scope.base !== null) parts.push(`The change from the base ${scope.base} to the working tree under review, untracked files included, is the git diff in ${diff.path}. Read it there if you cannot run git.`);
  if (ready !== null && copies !== null) parts.push(uiPrompt(copies, ready, design));
  if (later !== null) parts.push(laterRoundPrompt(round, later.changed, later.open));
  const prompt = parts.join('\n\n');
  const panel = roundPanel(setting.review, { asked: asked as number | 'all' | undefined, sensitive: sensitive || scope.sensitiveBy !== null });
  const order = panelOrder(setting.review.reviewers, last?.answered);
  // A resting reviewer (out of usage, or hung in an earlier round) is not asked (reviewer-rest.ts).
  const rested = await withRest(cwd, order, (ask) => runReviewers(ask, panel.size, setting.review, cwd, reviewPrompt(prompt), env)).finally(() => (copies === null ? undefined : removeImages(copies)));
  const replies = rested.results;
  const after = await fingerprintTree(cwd);
  const changed = !after.ok || after.fingerprint !== tree.fingerprint;
  const grounded = await groundResults(scope.root, replies);
  const results = later === null ? grounded : newOnUnchanged(grounded, later);
  const verdict = changed ? 'no-verdict' : roundVerdict(results);
  const sizes = scope.diffLines === null ? {} : { diffLines: scope.diffLines };
  const stored = await appendReview(path, { review: verdict, branch: branch.branch, round, maxRounds, ...storedFindings(results), tree: scope.tree, ...sizes, answered: results.flatMap((result) => (result.ok ? [result.name] : [])), seconds: rested.seconds, reviewers: runsOf(results) }, new Date());
  if (!stored.ok) return fail(`the round could not be written to the ledger: ${stored.error}`);
  const why = changed ? 'the tree changed during the review; a reviewer must be read-only' : undefined;
  const screenshots = ready === null ? [] : [...(ready.before === null ? ['before: none were taken'] : shotLines(weftwork, ready.before)), ...shotLines(weftwork, ready.after)];
  const notes = [];
  notes.push(`panel: ${panel.size} of ${setting.review.reviewers.length} ${setting.review.reviewers.length === 1 ? 'reviewer' : 'reviewers'} (${panel.why})`);
  const again = shortPanel(replies, panel.size);
  if (again !== null) notes.push(terminalSafe(again));
  if (rested.note !== null) notes.push(terminalSafe(rested.note));
  notes.push(terminalSafe(timeLine(rested.seconds, runsOf(results))));
  if (scope.sensitiveBy !== null) notes.push(`sensitive: yes, ${terminalSafe(scope.sensitiveBy)} matches review.sensitive_paths`);
  else if (sensitive) notes.push('sensitive: yes, the brief asked');
  if (scope.diffLines !== null) notes.push(...diffReport(scope.diffLines, rounds.find((entry) => entry.round === 1)?.diffLines));
  answer(roundReport({ verdict, round, maxRounds, results, notes, screenshots, ...(why === undefined ? {} : { why }) }), exitCodes[verdict]);
}

/** The UI part of the round (e11s05): nothing when UI checks are off, else
 * the screenshots the change needs. The base is found only when UI checks
 * are on, so a review without them needs no base. */
async function uiCheck(cwd: string, weftwork: string, ui: UiSetting | null, base: string | undefined, branch: string | null, fingerprint: string): Promise<UiForReview> {
  if (ui === null) return { kind: 'skip' };
  const commit = await baseCommit(cwd, base);
  if (!commit.ok) return { kind: 'error', error: commit.error };
  return uiForReview({ cwd, weftwork, ui, base: commit.sha, branch, fingerprint });
}

await main();
