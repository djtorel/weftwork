// story: e13s04
// Thin shell for the base check: JSON `{"base": "<commit>"}` on stdin (base
// optional: the merge base with origin/HEAD, origin/main or main), the report
// on stdout. Logic lives in base-check.ts. docs/BASE-CHECK.md.
//
// Exit 0 when it ran, found no changed tests, or is off: it reports and never
// gates. Exit 2 when it cannot run, with the reason on stderr.
import { readJsonObject, terminalSafe } from './cli-io.ts';
import { baseCheckReport, checkOnBase } from './base-check.ts';
import { loadProof } from './base-check-setting.ts';
import { baseCommit } from './ui.ts';

function fail(error: string): void {
  process.stderr.write(`base check: ${terminalSafe(error)}\n`);
  process.exitCode = 2;
}

async function main(): Promise<void> {
  const read = await readJsonObject();
  if (read.kind === 'refused') return fail(read.error);
  const { base } = read.input;
  if (base !== undefined && (typeof base !== 'string' || base === '')) return fail('"base" must be a non-empty string');
  const cwd = process.cwd();
  const setting = await loadProof(cwd, process.env);
  if (!setting.ok) return fail(setting.error);
  if (setting.proof === null) {
    process.stdout.write('weftwork base check: off\nwhy: no proof mapping in weftwork.yaml\n');
    return;
  }
  const commit = await baseCommit(cwd, base);
  if (!commit.ok) return fail(commit.error);
  const check = await checkOnBase({ cwd, proof: setting.proof, base: commit.sha });
  if ('ok' in check) return fail(check.error);
  if (check.kind === 'none') {
    process.stdout.write('weftwork base check: no changed tests\nwhy: the change adds or edits no file in proof.tests\n');
    return;
  }
  process.stdout.write(baseCheckReport(commit.sha, check, setting.proof.timeoutSeconds));
}

await main();
