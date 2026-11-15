// story: e11s03
// Thin shell for one review round: JSON `{"command": "...", "brief": "...",
// "sensitive": false}` on stdin, the round's report on stdout. It runs the
// council only after the engine's done gate passed for `command` on this
// tree, and counts the round in the ledger. Logic lives in review.ts.
// docs/REVIEW.md.
//
// Exit 0 pass, 1 block (fix the must-fix findings, pass the gate, review
// again), 3 no verdict (every reviewer failed, or the tree changed during the
// review), 4 the done gate has not passed (no reviewer ran), 5 the round
// ceiling (no reviewer ran), 2 when it cannot run, with the reason on stderr
// and nothing on stdout.
import { readJsonObject, terminalSafe } from './cli-io.ts';
import { appendReview, ledgerPath, ledgerReadCap, readLedgerTail, weftworkDir } from './ledger.ts';
import { prProof } from './pr-proof.ts';
import type { RoundVerdict } from './review-ledger.ts';
import { loadReview } from './review-setting.ts';
import { groundResults, roundScope, ruleFiles } from './review-scope.ts';
import { auditPrompt, diffReport, exhaustedReport, laterRoundPrompt, newOnUnchanged, reviewPrompt, roundCeiling, roundReport, roundsDone, roundsOn, roundVerdict, runCouncil, storedFindings } from './review.ts';
import { currentBranch, fingerprintTree } from './tree.ts';
import { baseCommit, imagesValue, readDesign, shotLines, uiForReview, uiPrompt, type Design, type UiForReview } from './ui.ts';
import { loadUi, type UiSetting } from './ui-setting.ts';

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
  const { command, brief, sensitive = false, base } = read.input;
  if (typeof command !== 'string' || command.trim() === '') return fail('"command" must be a non-empty string');
  if (typeof brief !== 'string' || brief.trim() === '') return fail('"brief" must be a non-empty string');
  if (typeof sensitive !== 'boolean') return fail('"sensitive" must be true or false');
  if (base !== undefined && (typeof base !== 'string' || base === '')) return fail('"base" must be a non-empty string');
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
  if (shots.kind === 'missing') return answer(`weftwork review: not run\nwhy: ${terminalSafe(shots.why)}\nnext: echo '{"phase":"after"}' | node src/ui-cli.ts\n`, 4);
  const ready = shots.kind === 'ready' ? shots : null;
  let design: Design | null = null;
  if (ready !== null && ui.ui?.design !== undefined) {
    const read = await readDesign(cwd, ui.ui.design);
    if (!read.ok) return fail(read.error);
    design = read.design;
  }

  const round = roundsDone(rounds) + 1;
  const later = last !== undefined && scope.changedSinceLast !== null ? { round, changed: scope.changedSinceLast, open: last.mustFix } : null;
  const parts = [brief.replace(/\n*$/, ''), auditPrompt({ sensitive: sensitive || scope.sensitiveBy !== null, ruleFiles: await ruleFiles(scope.root) })];
  if (ready !== null) parts.push(uiPrompt(weftwork, ready, design));
  if (later !== null) parts.push(laterRoundPrompt(round, later.changed, later.open));
  const prompt = parts.join('\n\n');
  // Only a UI change sets WEFTWORK_IMAGES; one from the caller is dropped (review round 1).
  const { WEFTWORK_IMAGES: _inherited, ...env } = process.env;
  if (ready !== null) {
    const images = imagesValue(weftwork, ready);
    if (!images.ok) return fail(images.error);
    env['WEFTWORK_IMAGES'] = images.value;
  }
  const replies = await runCouncil(setting.review, cwd, reviewPrompt(prompt), env);
  const after = await fingerprintTree(cwd);
  const changed = !after.ok || after.fingerprint !== tree.fingerprint;
  const grounded = await groundResults(scope.root, replies);
  const results = later === null ? grounded : newOnUnchanged(grounded, later);
  const verdict = changed ? 'no-verdict' : roundVerdict(results);
  const sizes = scope.diffLines === null ? {} : { diffLines: scope.diffLines };
  const stored = await appendReview(path, { review: verdict, branch: branch.branch, round, maxRounds, ...storedFindings(results), tree: scope.tree, ...sizes }, new Date());
  if (!stored.ok) return fail(`the round could not be written to the ledger: ${stored.error}`);
  const why = changed ? 'the tree changed during the review; a reviewer must be read-only' : undefined;
  const screenshots = ready === null ? [] : [...(ready.before === null ? ['before: none were taken'] : shotLines(weftwork, ready.before)), ...shotLines(weftwork, ready.after)];
  const notes = [];
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
