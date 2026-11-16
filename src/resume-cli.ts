// story: e08s04
// Thin shell for the resume check: run anywhere in a repository, it checks
// the handoff block of the state file in <git dir>/weftwork against the
// current branch, the named files and git status. A worktree with no state
// file has no handoff: the answer is missing. One JSON line on stdout
// (the report, or {ok: false, error}), a short text on stderr that names the
// next step. Logic lives in resume.ts. It never writes (owner decision 3).
//
// Exit 0 for ready; 1 for stale, unverifiable and missing; 2 when it takes
// an argument, the working directory is not in a git repository, git fails,
// or the state file cannot be read or parsed (owner decision 6).
import { lstatSync } from 'node:fs';
import { join } from 'node:path';
import { printAnswer, terminalSafe } from './cli-io.ts';
import { messageOf, type Failure } from './errors.ts';
import { isRecord } from './json.ts';
import { resumeReport, type ResumeReport } from './resume.ts';
import { weftworkDir } from './ledger.ts';
import { readStateData, stateExists, stateFile } from './state-fields.ts';
import { insideRoot } from './state-write.ts';
import { currentBranch, repositoryRoot, uncommittedPaths } from './tree.ts';
import { sibling } from './sibling.ts';

/** The handoff CLI by absolute path: src/*.ts in a checkout, dist/*.js installed. */
const handoffCli = terminalSafe(JSON.stringify(sibling('handoff-cli')));

type Checked = { ok: true; report: ResumeReport; statePath: string } | Failure;
type HandoffRead = { ok: true; handoff: unknown } | Failure;

/** True when `file` names a path inside `root` that exists. A symlink is a
 * name, not followed, as the handoff writer checks it. */
function existsIn(root: string, file: string): boolean {
  const inside = insideRoot(root, file);
  if (!inside.ok) return false;
  try {
    lstatSync(inside.path);
    return true;
  } catch {
    return false;
  }
}

/** The value of the `handoff` key of the state file in `dir`, undefined when
 * the file or the key is absent, read with the writer's checks. */
function readHandoff(dir: string): HandoffRead {
  if (!stateExists(dir)) return { ok: true, handoff: undefined };
  const read = readStateData(dir, stateFile);
  // Only ok and error: insideRoot's cause is not part of the CLI answer
  // (request-review round 3).
  if (!read.ok) return { ok: false, error: read.error };
  if (!isRecord(read.data)) return { ok: false, error: `${stateFile} is not a mapping` };
  return { ok: true, handoff: Object.hasOwn(read.data, 'handoff') ? read.data['handoff'] : undefined };
}

/** The report for the repository that holds `cwd`, or why it cannot be made. */
async function checkRepository(cwd: string): Promise<Checked> {
  let root: string;
  try {
    root = (await repositoryRoot(cwd)).toString();
  } catch (error) {
    return { ok: false, error: `${cwd} is not in a git repository: ${messageOf(error)}` };
  }
  const dir = await weftworkDir(root);
  if (dir === null) return { ok: false, error: `${root} has no git dir for the state file` };
  const read = readHandoff(dir);
  if (!read.ok) return read;
  const branch = await currentBranch(root);
  if (!branch.ok) return { ok: false, error: `git symbolic-ref failed: ${branch.error}` };
  const status = await uncommittedPaths(root);
  if (!status.ok) return { ok: false, error: `git status failed: ${status.error}` };
  const report = resumeReport(read.handoff, {
    branch: branch.branch,
    uncommitted: status.paths,
    exists: (file) => existsIn(root, file),
  });
  return { ok: true, report, statePath: join(dir, stateFile) };
}

/** The next step for an answer; `statePath` is where the note is. */
function nextStep(report: ResumeReport, statePath: string): string {
  switch (report.answer) {
    case 'ready':
      return report.next_skill === null
        ? 'Next: the handoff names no next skill; read its note.'
        : `Next: read the note in ${terminalSafe(statePath)}, then run ${terminalSafe(report.next_skill)}.`;
    case 'stale':
      return `Next: fix the repository so it matches the handoff, or write a new handoff with node ${handoffCli}.`;
    default:
      return `Next: write a handoff with node ${handoffCli}.`;
  }
}

/** The report for a person: the answer, each reason and note, the next step. */
function stderrText(report: ResumeReport, statePath: string): string {
  const reasons = report.reasons.map((reason) => `- ${terminalSafe(reason)}\n`).join('');
  const notes = report.notes.length === 0 ? '' : `Notes:\n${report.notes.map((note) => `- ${terminalSafe(note)}\n`).join('')}`;
  return `weftwork resume check: ${report.answer}\n${reasons}${notes}${nextStep(report, statePath)}\n`;
}

/** The working directory, or a failure when it was deleted under the
 * process: process.cwd() throws then (request-review round 2). */
function workingDirectory(): string | Failure {
  try {
    return process.cwd();
  } catch (error) {
    return { ok: false, error: `the working directory cannot be read: ${messageOf(error)}` };
  }
}

async function main(args: string[]): Promise<void> {
  if (args.length !== 0) {
    process.stderr.write('usage: node resume-cli.ts (no arguments)\n');
    return printAnswer({ ok: false, error: 'the resume check takes no arguments' }, 2);
  }
  const cwd = workingDirectory();
  const checked = typeof cwd === 'string' ? await checkRepository(cwd) : cwd;
  if (!checked.ok) {
    process.stderr.write(`weftwork resume check: ${terminalSafe(checked.error)}\n`);
    return printAnswer(checked, 2);
  }
  process.stderr.write(stderrText(checked.report, checked.statePath));
  printAnswer(checked.report, checked.report.answer === 'ready' ? 0 : 1);
}

await main(process.argv.slice(2));
