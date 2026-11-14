// story: e08s04
// Thin shell for the resume check: run anywhere in a repository, it checks
// the handoff block of specs/state.yaml at the repository root against the
// current branch, the named files and git status. One JSON line on stdout
// (the report, or {ok: false, error}), a short text on stderr that names the
// next step. Logic lives in resume.ts. It never writes (owner decision 3).
//
// Exit 0 for ready; 1 for stale, unverifiable and missing; 2 when it takes
// an argument, the working directory is not in a git repository, git fails,
// or the state file cannot be read or parsed (owner decision 6).
import { lstatSync } from 'node:fs';
import { printAnswer } from './cli-io.ts';
import { messageOf } from './errors.ts';
import { isRecord } from './json.ts';
import { resumeReport, type ResumeReport } from './resume.ts';
import { readStateData, stateFile } from './state-fields.ts';
import { insideRoot } from './state-write.ts';
import { currentBranch, repositoryRoot, uncommittedPaths } from './tree.ts';

type Checked = { ok: true; report: ResumeReport } | { ok: false; error: string };

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

/** The report for the repository that holds `cwd`, or why it cannot be made. */
async function check(cwd: string): Promise<Checked> {
  let root: string;
  try {
    root = (await repositoryRoot(cwd)).toString();
  } catch (error) {
    return { ok: false, error: `${cwd} is not in a git repository: ${messageOf(error)}` };
  }
  const read = readStateData(root, stateFile);
  if (!read.ok) return read;
  if (!isRecord(read.data)) return { ok: false, error: `${stateFile} is not a mapping` };
  const handoff = Object.hasOwn(read.data, 'handoff') ? read.data['handoff'] : undefined;
  const branch = await currentBranch(root);
  if (!branch.ok) return { ok: false, error: `git symbolic-ref failed: ${branch.error}` };
  const status = await uncommittedPaths(root, [stateFile]);
  if (!status.ok) return { ok: false, error: `git status failed: ${status.error}` };
  const report = resumeReport(handoff, {
    branch: branch.branch,
    uncommitted: status.paths,
    exists: (file) => existsIn(root, file),
  });
  return { ok: true, report };
}

/** `text` with each C0, DEL and C1 control character written as `\uXXXX`, so
 * a file name or a block value cannot drive the terminal (security review
 * F1, CWE-150). Only the stderr text needs it: JSON already escapes C0. */
function shown(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f-\u009f]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/** The next step for an answer. */
function nextStep(report: ResumeReport): string {
  switch (report.answer) {
    case 'ready':
      return report.next_skill === null
        ? 'Next: the handoff names no next skill; read its note.'
        : `Next: read the note in ${stateFile}, then run ${shown(report.next_skill)}.`;
    case 'stale':
      return 'Next: fix the repository so it matches the handoff, or write a new handoff with node src/handoff-cli.ts.';
    default:
      return 'Next: write a handoff with node src/handoff-cli.ts.';
  }
}

function describe(report: ResumeReport): string {
  const reasons = report.reasons.map((reason) => `- ${shown(reason)}\n`).join('');
  const notes = report.notes.length === 0 ? '' : `Notes:\n${report.notes.map((note) => `- ${shown(note)}\n`).join('')}`;
  return `weftwork resume check: ${report.answer}\n${reasons}${notes}${nextStep(report)}\n`;
}

async function main(args: string[]): Promise<void> {
  if (args.length !== 0) {
    process.stderr.write('usage: node resume-cli.ts (no arguments)\n');
    return printAnswer({ ok: false, error: 'the resume check takes no arguments' }, 2);
  }
  const checked = await check(process.cwd());
  if (!checked.ok) {
    process.stderr.write(`weftwork resume check: ${shown(checked.error)}\n`);
    return printAnswer(checked, 2);
  }
  process.stderr.write(describe(checked.report));
  printAnswer(checked.report, checked.report.answer === 'ready' ? 0 : 1);
}

await main(process.argv.slice(2));
