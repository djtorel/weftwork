// story: e12s02
// `weftwork init`: set up weftwork in a project from the terminal. It is the
// setup of docs/SETUP.md for a person instead of an agent: options instead of
// JSON, the folder is the current one unless named, the questions are asked
// in the terminal, and the plan is shown as text before anything is written.
// init-cli.ts is the thin shell; this file holds what it can test alone.
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { terminalSafe } from './cli-io.ts';
import { messageOf, type Failure } from './errors.ts';
import { checkCommands, type CheckedCommand } from './detect-check.ts';
import { detectProject, type FoundCommand } from './detect.ts';
import type { Plan } from './setup.ts';
import type { Answers, CheckedReport, Question } from './setup-text.ts';

export type InitOptions = { path: string; yes: boolean; stopHook: boolean; run: boolean; overwrite: string[] };

export const initUsage = `Usage: weftwork init [path] [options]

Set up weftwork in a project: detect it, ask a few questions, show every file
it would write, and write them only when you agree.

  path                 The project folder. Default: the current folder.
  -y, --yes            Take the recommended answers and write without asking.
  --stop-hook          Also register the Claude Code Stop hook and guard.
  --no-run             Do not run the project's commands to check them
                       (use it for a project you do not trust).
  --overwrite <path>   Replace this conflicting file; the old one is kept as
                       <path>.weftwork-old. Repeat for more files.
  -h, --help           Show this help.

Undo a setup: echo '{"undo":true}' | weftwork setup (docs/SETUP.md).
`;

/** The options of `weftwork init`, with the path resolved against `cwd`. */
export function parseInitArgs(args: string[], cwd: string): { ok: true; options: InitOptions } | { ok: true; help: true } | Failure {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      allowNegative: true,
      options: {
        yes: { type: 'boolean', short: 'y', default: false },
        'stop-hook': { type: 'boolean', default: false },
        run: { type: 'boolean', default: true },
        overwrite: { type: 'string', multiple: true, default: [] },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
  const { values, positionals } = parsed;
  if (values.help) return { ok: true, help: true };
  if (positionals.length > 1) return { ok: false, error: `one project folder at most, not ${positionals.length}` };
  const [path] = positionals;
  return {
    ok: true,
    options: { path: resolve(cwd, path ?? '.'), yes: values.yes, stopHook: values['stop-hook'], run: values.run, overwrite: values.overwrite },
  };
}

/** The project report with each command checked once, a package's in its own
 * folder, or marked skipped when `run` is false (as setup-cli.ts does it). */
export async function checkedReport(dir: string, run: boolean, timeoutMs: number): Promise<{ ok: true; report: CheckedReport } | Failure> {
  const detected = await detectProject(dir);
  if (!detected.ok) return detected;
  const check = async (commands: FoundCommand[], cwd: string): Promise<CheckedCommand[]> =>
    run ? await checkCommands(commands, cwd, timeoutMs) : commands.map((command) => ({ ...command, check: { status: 'skipped' as const, exitCode: null, why: '"run" is false' } }));
  const commands = await check(detected.report.commands, dir);
  const packages = [];
  for (const found of detected.report.packages) packages.push({ ...found, commands: await check(found.commands, join(dir, found.path)) });
  return { ok: true, report: { ...detected.report, commands, packages } };
}

/** Ask one line and get the reply. */
export type Ask = (prompt: string) => Promise<string>;

/** Each recommended answer as it is. */
export function recommendedAnswers(questions: Question[]): Answers {
  const answers: Answers = { about: '', words: [], never: [], rules: [], tasks: [] };
  for (const { id, recommended } of questions) {
    if (id === 'about') answers.about = typeof recommended === 'string' ? recommended : recommended.join(' ');
    else answers[id] = typeof recommended === 'string' ? [recommended] : [...recommended];
  }
  return answers;
}

/** The recommendation as the prompt shows it. It can come from the project
 * (a README line), so each line is made safe for the terminal. */
function shown(recommended: string | string[]): string {
  if (typeof recommended === 'string') return terminalSafe(recommended);
  return recommended.length === 0 ? '(none)' : recommended.map((line) => `\n    - ${terminalSafe(line)}`).join('');
}

/** The answers, asking each question. An empty first reply keeps the
 * recommended answer. A list takes one item per reply until an empty one;
 * `none` alone makes it empty. */
export async function askAnswers(questions: Question[], ask: Ask): Promise<Answers> {
  const answers = recommendedAnswers(questions);
  for (const { id, question, recommended } of questions) {
    const list = typeof recommended !== 'string';
    const how = list ? 'Press Enter to keep it, or type one per line and end with an empty line; "none" for none.' : 'Press Enter to keep it, or type your own.';
    const first = (await ask(`\n${question}\n  Recommended: ${shown(recommended)}\n  ${how}\n> `)).trim();
    if (first === '') continue;
    if (id === 'about') {
      answers.about = first;
      continue;
    }
    if (first.toLowerCase() === 'none') {
      answers[id] = [];
      continue;
    }
    const lines = [first];
    for (let line = (await ask('> ')).trim(); line !== ''; line = (await ask('> ')).trim()) lines.push(line);
    answers[id] = lines;
  }
  return answers;
}

/** The plan as text: each change that writes, with its diff indented, then
 * the notes. Nothing is written when this is shown. */
export function renderPlan(dir: string, plan: Plan): string {
  const lines = [`Plan for ${dir}:`, ''];
  for (const change of plan.changes) {
    if (change.action === 'unchanged') continue;
    const hint = change.action === 'conflict' ? `  (kept: you changed it; to replace it, add --overwrite ${change.path})` : '';
    lines.push(`  ${change.action.padEnd(9)} ${change.path}${hint}`);
    for (const line of (change.diff ?? '').split('\n').filter((text) => text !== '')) lines.push(`    ${line}`);
  }
  if (plan.notes.length > 0) lines.push('', 'Notes:', ...plan.notes.map((note) => `  - ${note}`));
  return `${lines.join('\n')}\n`;
}

/** What a write did, as text. */
export function renderWritten(written: string[], kept: string[], notes: string[]): string {
  const lines = [...written.map((path) => `  wrote     ${path}`), ...kept.map((path) => `  kept      ${path}`)];
  if (notes.length > 0) lines.push('', 'Notes:', ...notes.map((note) => `  - ${note}`));
  lines.push('', 'Next: commit these files, then open Claude Code here, name a task and add "Full stop."');
  return `${lines.join('\n')}\n`;
}
