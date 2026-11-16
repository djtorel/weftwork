// story: e13s05
// Thin shell for finding outcomes: JSON `{"id": "r1m1", "outcome": "fixed",
// "evidence": "..."}` records one, `{"report": true}` prints this branch's
// findings with their outcomes and each reviewer's resolution rate. Logic
// lives in review-outcome.ts. docs/REVIEW.md.
//
// Exit 0 recorded or reported, 2 when it cannot (an id the ledger does not
// have on this branch, a bad outcome or evidence), with the reason on stderr.
import { constants } from 'node:fs';
import { join } from 'node:path';
import { readJsonObject, terminalSafe } from './cli-io.ts';
import { ledgerPath, ledgerReadCap, openRegular, readLedgerTail, tailText, weftworkDir, writeLine } from './ledger.ts';
import { findingById, outcomeReport, outcomes, toOutcome, type OutcomeEntry } from './review-outcome.ts';
import { roundsOn } from './review.ts';
import { currentBranch } from './tree.ts';

function fail(error: string): void {
  process.stderr.write(`review outcome: ${terminalSafe(error)}\n`);
  process.exitCode = 2;
}

/** The outcome lines in the last 1 MiB of `path`; a file that does not exist has none. */
async function readOutcomes(path: string): Promise<OutcomeEntry[]> {
  const handle = await openRegular(path, constants.O_RDONLY).catch(() => null);
  if (handle === null) return [];
  try {
    const { text } = await tailText(handle, ledgerReadCap);
    return text.split('\n').flatMap((line) => {
      try {
        return toOutcome(JSON.parse(line)) ?? [];
      } catch {
        return [];
      }
    });
  } finally {
    await handle.close();
  }
}

async function main(): Promise<void> {
  const read = await readJsonObject();
  if (read.kind === 'refused') return fail(read.error);
  const { id, outcome, evidence, report } = read.input;
  const cwd = process.cwd();
  const path = await ledgerPath(cwd);
  const dir = await weftworkDir(cwd);
  if (path === null || dir === null) return fail('no git dir for the ledger');
  const ledger = await readLedgerTail(path, ledgerReadCap);
  if (!ledger.ok) return fail(`the ledger cannot be read: ${ledger.error}`);
  const branch = await currentBranch(cwd);
  if (!branch.ok) return fail(`the branch cannot be read: ${branch.error}`);
  const reviews = roundsOn(ledger.reviews, branch.branch);
  const file = join(dir, 'review-outcomes.jsonl');

  if (report === true) {
    process.stdout.write(outcomeReport(reviews, await readOutcomes(file)));
    return;
  }
  if (id === undefined && outcome === undefined && evidence === undefined) return fail('give "id", "outcome" and "evidence", or "report": true');
  if (typeof id !== 'string') return fail('"id" must be a finding id such as r1m1');
  if (typeof outcome !== 'string' || !(outcomes as readonly string[]).includes(outcome)) return fail('"outcome" must be fixed, disputed, declined or follow-up');
  if (typeof evidence !== 'string' || evidence.trim() === '' || evidence.length > 500) return fail('"evidence" must be a non-empty string of at most 500 characters');
  const finding = findingById(reviews, id);
  if (finding === null) return fail(`no finding ${id} on this branch`);
  const line = { at: new Date().toISOString(), branch: branch.branch, id, outcome, evidence, finding: finding.text };
  const written = await writeLine(file, line);
  if (!written.ok) return fail(`the outcome could not be written: ${written.error}`);
  process.stdout.write(`recorded: ${id} ${outcome}\n`);
}

await main();
