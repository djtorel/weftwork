// story: e12s02
// Thin shell for `weftwork init [path]`: set up weftwork in a project from the
// terminal, the current folder by default. In a terminal it asks the setup
// questions and asks before it writes; with --yes it takes the recommended
// answers and writes; with neither (no terminal to ask in) it prints the plan
// and writes nothing. Logic lives in init.ts and setup.ts. docs/SETUP.md.
//
// Exit 0 done (or nothing written by choice), 1 when detection, the plan or
// the write is refused, 2 for bad options; the reason is on stderr.
import { basename, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { terminalSafe } from './cli-io.ts';
import { askAnswers, checkedReport, initUsage, parseInitArgs, recommendedAnswers, renderPlan, renderWritten } from './init.ts';
import { applySetup, planSetup } from './setup.ts';
import { projectDescription } from './setup-about.ts';
import { setupQuestions } from './setup-text.ts';
import { recordSetup } from './setup-undo.ts';

const timeoutMs = 120_000;
const engineDir = join(import.meta.dirname, '..');

/** `text` with each line made safe for the terminal: a project's own text
 * (a README line, an old .gitignore) is in the plan. */
function print(text: string): void {
  process.stdout.write(text.split('\n').map(terminalSafe).join('\n'));
}

function fail(error: string, code: number): number {
  process.stderr.write(`weftwork init: ${terminalSafe(error)}\n`);
  return code;
}

async function main(args: string[]): Promise<number> {
  const parsed = parseInitArgs(args, process.cwd());
  if (!parsed.ok) {
    process.stderr.write(`weftwork init: ${terminalSafe(parsed.error)}\n\n${initUsage}`);
    return 2;
  }
  if ('help' in parsed) {
    process.stdout.write(initUsage);
    return 0;
  }
  const { path: dir, yes, stopHook, run, overwrite } = parsed.options;
  const interactive = !yes && process.stdin.isTTY === true && process.stdout.isTTY === true;
  if (run) process.stderr.write(`Checking the commands of ${terminalSafe(dir)} (each runs once; --no-run skips this)...\n`);
  const checked = await checkedReport(dir, run, timeoutMs);
  if (!checked.ok) return fail(checked.error, 1);
  const questions = setupQuestions(basename(dir), checked.report, projectDescription(dir));
  const prompt = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null;
  try {
    const answers = prompt === null ? recommendedAnswers(questions) : await askAnswers(questions, (text) => prompt.question(text));
    const planned = planSetup(dir, checked.report, answers, { engineDir, stopHook });
    if (!planned.ok) return fail(planned.error, 1);
    print(`\n${renderPlan(dir, planned.plan)}`);
    if (!yes) {
      if (prompt === null) {
        print('\nDry run: nothing was written. With no terminal to ask in, init took the recommended answers.\nRun weftwork init --yes to write this plan.\n');
        return 0;
      }
      const reply = (await prompt.question('\nWrite these files? [y/N] ')).trim().toLowerCase();
      if (reply !== 'y' && reply !== 'yes') {
        print('Nothing was written.\n');
        return 0;
      }
    }
    const applied = applySetup(dir, planned.plan, { overwrite });
    if (!applied.ok) return fail(applied.error, 1);
    const recorded = await recordSetup(dir, applied.record);
    const notes = recorded === null ? [] : [`Undo is not available for these writes: ${recorded.error}`];
    print(`\n${renderWritten(applied.written, applied.kept, notes)}`);
    return 0;
  } finally {
    prompt?.close();
  }
}

process.exitCode = await main(process.argv.slice(2));
