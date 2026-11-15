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
import { appendReview, ledgerPath, ledgerReadCap, readLedgerTail } from './ledger.ts';
import { prProof } from './pr-proof.ts';
import type { RoundVerdict } from './review-ledger.ts';
import { loadReview } from './review-setting.ts';
import { exhaustedReport, reviewPrompt, roundCeiling, roundReport, roundsOn, roundVerdict, runCouncil, storedFindings } from './review.ts';
import { currentBranch, fingerprintTree } from './tree.ts';

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
  const { command, brief, sensitive = false } = read.input;
  if (typeof command !== 'string' || command.trim() === '') return fail('"command" must be a non-empty string');
  if (typeof brief !== 'string' || brief.trim() === '') return fail('"brief" must be a non-empty string');
  if (typeof sensitive !== 'boolean') return fail('"sensitive" must be true or false');
  const cwd = process.cwd();
  const tree = await fingerprintTree(cwd);
  if (!tree.ok) return fail(`no git working tree: ${tree.error}`);
  const setting = await loadReview(cwd, process.env);
  if (!setting.ok) return fail(setting.error);
  const path = await ledgerPath(cwd);
  if (path === null) return fail('no git dir for the ledger');
  const ledger = await readLedgerTail(path, ledgerReadCap);
  if (!ledger.ok) return fail(`the ledger cannot be read: ${ledger.error}`);
  const branch = await currentBranch(cwd);
  if (!branch.ok) return fail(`the branch cannot be read: ${branch.error}`);

  const proof = prProof({ entries: ledger.entries, states: ledger.states, command, fingerprint: tree.fingerprint });
  if (!proof.ready) return answer(`weftwork review: not run\nwhy: the done gate has not passed: ${proof.why}\n`, 4);
  const rounds = roundsOn(ledger.reviews, branch.branch);
  const maxRounds = roundCeiling(setting.review, sensitive);
  if (rounds.length >= maxRounds) return answer(exhaustedReport(rounds, maxRounds), 5);

  const results = await runCouncil(setting.review, cwd, reviewPrompt(brief));
  const after = await fingerprintTree(cwd);
  const changed = !after.ok || after.fingerprint !== tree.fingerprint;
  const verdict = changed ? 'no-verdict' : roundVerdict(results);
  const round = rounds.length + 1;
  const stored = await appendReview(path, { review: verdict, branch: branch.branch, round, maxRounds, ...storedFindings(results) }, new Date());
  if (!stored.ok) return fail(`the round could not be written to the ledger: ${stored.error}`);
  const why = changed ? 'the tree changed during the review; a reviewer must be read-only' : undefined;
  answer(roundReport({ verdict, round, maxRounds, results, ...(why === undefined ? {} : { why }) }), exitCodes[verdict]);
}

await main();
