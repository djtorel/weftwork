// story: e12s01
// Thin shell for detecting a project: JSON `{"path": "<folder>", "run": true,
// "timeoutSeconds": 120}` on stdin, every key optional (the folder defaults to
// the current one), and one JSON line `{"ok": true, "report": ...}` on stdout.
// With "run" (the default) each test, lint, typecheck and build command runs
// once in that folder. Logic lives in detect.ts and detect-check.ts.
// docs/DETECT.md.
//
// Exit 0 with a report, 2 when it cannot run, with the reason on stderr.
import { resolve } from 'node:path';
import { printAnswer, readJsonObject, terminalSafe } from './cli-io.ts';
import { checkCommands } from './detect-check.ts';
import { detectProject } from './detect.ts';
import { isInteger } from './json.ts';

const defaultTimeoutSeconds = 120;

function fail(error: string): void {
  process.stderr.write(`detect: ${terminalSafe(error)}\n`);
  process.exitCode = 2;
}

async function main(): Promise<void> {
  const read = await readJsonObject();
  if (read.kind === 'refused') return fail(read.error);
  const { path, run, timeoutSeconds } = read.input;
  if (path !== undefined && (typeof path !== 'string' || path === '' || path.includes('\0'))) return fail('"path" must be a non-empty string');
  if (run !== undefined && typeof run !== 'boolean') return fail('"run" must be true or false');
  if (timeoutSeconds !== undefined && (!isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 3600)) {
    return fail('"timeoutSeconds" must be an integer from 1 to 3600');
  }
  const dir = resolve(path ?? process.cwd());
  const detected = await detectProject(dir);
  if (!detected.ok) return fail(detected.error);
  if (run === false) return printAnswer({ ok: true, report: detected.report }, 0);
  const commands = await checkCommands(detected.report.commands, dir, (timeoutSeconds ?? defaultTimeoutSeconds) * 1000);
  printAnswer({ ok: true, report: { ...detected.report, commands } }, 0);
}

await main();
