// story: e11s04
// Thin shell for the decision log (docs/ASK.md). With no argument: JSON
// `{"question": "...", "choice": "...", "reason": "..."}` on stdin, logged for
// the current branch. With `list`: the current branch's decisions on stdout,
// as the PR's Decisions section. Logic lives in decision.ts.
//
// Exit 0 done, 2 when it cannot run (bad input, no git working tree, a
// detached HEAD, a file it cannot read or write), with the reason on stderr.
import { join } from 'node:path';
import { readJsonObject, terminalSafe } from './shared/cli-io.ts';
import { appendDecision, decisionsText, readDecisions, toDecision } from './state/decision.ts';
import { weftworkDir } from './engine/ledger.ts';
import { currentBranch } from './engine/tree.ts';

function fail(error: string): void {
  process.stderr.write(`decision: ${terminalSafe(error)}\n`);
  process.exitCode = 2;
}

async function main(args: string[]): Promise<void> {
  if (args.length > 1 || (args.length === 1 && args[0] !== 'list')) return fail('usage: decision-cli.ts [list]');
  const cwd = process.cwd();
  const dir = await weftworkDir(cwd);
  if (dir === null) return fail('no git dir for the decision log');
  const branch = await currentBranch(cwd);
  if (!branch.ok) return fail(branch.error);
  if (branch.branch === null) return fail('HEAD is detached; a decision belongs to a branch');
  const path = join(dir, 'decisions.jsonl');
  if (args[0] === 'list') {
    const read = await readDecisions(path);
    if (!read.ok) return fail(`the decision log cannot be read: ${read.error}`);
    process.stdout.write(decisionsText(read.decisions.filter((entry) => entry.branch === branch.branch), read.truncated));
    return;
  }
  const request = await readJsonObject();
  if (request.kind === 'refused') return fail(request.error);
  const decision = toDecision(request.input);
  if (!decision.ok) return fail(decision.error);
  const written = await appendDecision(path, { ...decision.decision, branch: branch.branch }, new Date());
  if (!written.ok) return fail(`the decision log cannot be written: ${written.error}`);
  process.stdout.write(`decision logged on ${terminalSafe(branch.branch)}\n`);
}

await main(process.argv.slice(2));
