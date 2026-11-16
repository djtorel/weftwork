// story: e12s02
// Thin shell for setting up a project: JSON on stdin, every key optional,
// `{"path", "answers", "apply", "overwrite", "stopHook", "run",
// "timeoutSeconds"}`, and one JSON line on stdout. It detects the project and
// checks its commands (detect-cli.ts), then:
// - no "answers": prints the questions, each with a recommended answer;
// - "answers": prints the plan, a dry run that writes nothing;
// - "answers" and "apply": true: writes the plan, keeping every conflict not
//   named in "overwrite", and records each write for undo;
// - "undo": true alone: reverses the recorded writes (setup-undo.ts), without
//   detecting anything.
// Logic lives in setup.ts and setup-text.ts. docs/SETUP.md.
//
// Exit 0 with an answer, 1 when the plan or the write is refused, 2 for bad
// input; the reason is on stderr.
import { basename, join, resolve } from 'node:path';
import { printAnswer, readJsonObject, terminalSafe } from './cli-io.ts';
import { checkedReport } from './init.ts';
import { isInteger } from './json.ts';
import { applySetup, planSetup } from './setup.ts';
import { projectDescription } from './setup-about.ts';
import { recordSetup, undoSetup } from './setup-undo.ts';
import { parseAnswers, setupQuestions } from './setup-text.ts';

const defaultTimeoutSeconds = 120;
const engineDir = join(import.meta.dirname, '..');

function fail(error: string, code = 2): void {
  process.stderr.write(`setup: ${terminalSafe(error)}\n`);
  process.exitCode = code;
}

/** Why the request is bad, or null. */
function badRequest(input: Record<string, unknown>): string | null {
  const { path, apply, overwrite, stopHook, run, timeoutSeconds, answers, undo } = input;
  if (path !== undefined && (typeof path !== 'string' || path === '' || path.includes('\0'))) return '"path" must be a non-empty string';
  if (undo !== undefined && undo !== true) return '"undo" must be true';
  if (undo === true && Object.keys(input).some((key) => key !== 'undo' && key !== 'path')) return '"undo" takes only "path"';
  for (const [key, value] of Object.entries({ apply, stopHook, run })) {
    if (value !== undefined && typeof value !== 'boolean') return `"${key}" must be true or false`;
  }
  if (overwrite !== undefined && (!Array.isArray(overwrite) || !overwrite.every((item) => typeof item === 'string'))) return '"overwrite" must be a list of paths';
  if (timeoutSeconds !== undefined && (!isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 3600)) return '"timeoutSeconds" must be an integer from 1 to 3600';
  if (apply === true && answers === undefined) return '"apply" needs "answers"';
  return null;
}

async function main(): Promise<void> {
  const read = await readJsonObject();
  if (read.kind === 'refused') return fail(read.error);
  const input = read.input;
  const bad = badRequest(input);
  if (bad !== null) return fail(bad);
  const parsed = input.answers === undefined ? null : parseAnswers(input.answers);
  if (parsed !== null && !parsed.ok) return fail(parsed.error);
  const dir = resolve(typeof input.path === 'string' ? input.path : process.cwd());
  if (input.undo === true) {
    const undone = await undoSetup(dir);
    if (!undone.ok) return fail(undone.error, 1);
    return printAnswer({ ok: true, undone: undone.undone, kept: undone.kept }, 0);
  }
  const timeout = (typeof input.timeoutSeconds === 'number' ? input.timeoutSeconds : defaultTimeoutSeconds) * 1000;
  const checked = await checkedReport(dir, input.run !== false, timeout);
  if (!checked.ok) return fail(checked.error);
  const report = checked.report;
  if (parsed === null) return printAnswer({ ok: true, report, questions: setupQuestions(basename(dir), report, projectDescription(dir)) }, 0);
  const planned = planSetup(dir, report, parsed.answers, { engineDir, stopHook: input.stopHook === true });
  if (!planned.ok) return fail(planned.error, 1);
  const { changes, notes } = planned.plan;
  if (input.apply !== true) {
    return printAnswer({ ok: true, plan: { changes: changes.map(({ path, action, diff }) => ({ path, action, diff })), notes } }, 0);
  }
  const applied = applySetup(dir, planned.plan, { overwrite: (input.overwrite as string[] | undefined) ?? [] });
  if (!applied.ok) return fail(applied.error, 1);
  const recorded = await recordSetup(dir, applied.record);
  const all = recorded === null ? notes : [...notes, `Undo is not available for these writes: ${recorded.error}`];
  printAnswer({ ok: true, written: applied.written, kept: applied.kept, notes: all }, 0);
}

await main();
