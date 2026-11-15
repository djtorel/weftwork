// story: e11s05
// Thin shell for one phase of UI screenshots: JSON `{"phase": "before" |
// "after", "base": "<commit>"}` on stdin (base optional), the result on
// stdout. Logic lives in ui.ts. docs/UI.md.
//
// Exit 0 taken, or UI checks off; 1 refused (before screenshots once the tree
// changes ui.paths) or failed (the command failed, wrote no PNG, or changed
// the tree); 2 when it cannot run, with the reason on stderr.
import { readJsonObject, terminalSafe } from './cli-io.ts';
import { weftworkDir } from './ledger.ts';
import { currentBranch } from './tree.ts';
import { baseCommit, shotLines, takeShots } from './ui.ts';
import { loadUi } from './ui-setting.ts';

function fail(error: string): void {
  process.stderr.write(`ui: ${terminalSafe(error)}\n`);
  process.exitCode = 2;
}

async function main(): Promise<void> {
  const read = await readJsonObject();
  if (read.kind === 'refused') return fail(read.error);
  const { phase, base } = read.input;
  if (phase !== 'before' && phase !== 'after') return fail('"phase" must be "before" or "after"');
  if (base !== undefined && (typeof base !== 'string' || base === '')) return fail('"base" must be a non-empty string');
  const cwd = process.cwd();
  const setting = await loadUi(cwd, process.env);
  if (!setting.ok) return fail(setting.error);
  if (setting.ui === null) {
    process.stdout.write('weftwork ui: off\nwhy: no ui mapping in weftwork.yaml\n');
    return;
  }
  const weftwork = await weftworkDir(cwd);
  if (weftwork === null) return fail('no git dir for the screenshots');
  const commit = await baseCommit(cwd, base);
  if (!commit.ok) return fail(commit.error);
  const branch = await currentBranch(cwd);
  if (!branch.ok) return fail(`the branch cannot be read: ${branch.error}`);
  const result = await takeShots({ cwd, weftwork, ui: setting.ui, phase, base: commit.sha, branch: branch.branch });
  if (result.kind === 'error') return fail(result.error);
  if (result.kind === 'taken') {
    process.stdout.write(`weftwork ui: taken\n${shotLines(weftwork, result.shots).join('\n')}\n`);
    return;
  }
  process.stdout.write(`weftwork ui: ${result.kind}\nwhy: ${terminalSafe(result.why)}\n`);
  process.exitCode = 1;
}

await main();
