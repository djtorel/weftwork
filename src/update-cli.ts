// Thin shell for `weftwork update [path]`: bring a project's skills to this
// version, the current folder by default. In a terminal it shows the plan and
// asks before it writes; with --yes it writes; with neither (no terminal to
// ask in) it shows the plan and writes nothing. Logic lives in update.ts.
// docs/SETUP.md § Update.
//
// Exit 0 done, up to date or nothing written by choice; 1 when the plan or the
// write is refused; 2 for bad options. The reason is on stderr.
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { terminalSafe } from './shared/cli-io.ts';
import { messageOf } from './shared/errors.ts';
import { applyUpdate, behind, planUpdate, renderUpdate } from './setup/update.ts';

const engineDir = join(import.meta.dirname, '..');

const usage = `Usage: weftwork update [path] [options]

Bring the weftwork skills of a project to this version of weftwork. A skill
file you never changed is replaced; one you changed is kept; a skill this
version adds is created; a folder of an old skill name is deleted when you
never changed it. A weftwork Stop hook entry in .claude/settings.json whose
timeout is too short for budget.stop_hook_timeout_seconds is raised to fit it.
AGENTS.md and the backlog are yours and never touched.
Run weftwork upgrade first to get the latest version.

  path         The project folder. Default: the current folder.
  -y, --yes    Write without asking.
  -h, --help   Show this help.
`;

/** `text` with each line made safe for the terminal: a project's own text is
 * in the plan's diffs. */
function print(text: string): void {
  process.stdout.write(text.split('\n').map(terminalSafe).join('\n'));
}

function fail(error: string): number {
  process.stderr.write(`weftwork update: ${terminalSafe(error)}\n`);
  return 1;
}

async function main(args: string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({ args, allowPositionals: true, options: { yes: { type: 'boolean', short: 'y', default: false }, help: { type: 'boolean', short: 'h', default: false } } });
  } catch (error) {
    process.stderr.write(`weftwork update: ${terminalSafe(messageOf(error))}\n\n${usage}`);
    return 2;
  }
  if (parsed.values.help) {
    process.stdout.write(usage);
    return 0;
  }
  if (parsed.positionals.length > 1) {
    process.stderr.write(`weftwork update: one project folder at most\n\n${usage}`);
    return 2;
  }
  const dir = resolve(process.cwd(), parsed.positionals[0] ?? '.');
  const planned = planUpdate(dir, engineDir);
  if (!planned.ok) return fail(planned.error);
  if (behind(planned.plan) === 0) {
    print(`${renderUpdate(dir, planned.plan)}\nThe skills are up to date: nothing to write.\n`);
    return 0;
  }
  print(renderUpdate(dir, planned.plan));
  if (!parsed.values.yes) {
    if (process.stdin.isTTY !== true || process.stdout.isTTY !== true) {
      print('\nDry run: nothing was written. Run weftwork update --yes to write this plan.\n');
      return 0;
    }
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const reply = (await prompt.question('\nWrite these changes? [y/N] ')).trim().toLowerCase();
      if (reply !== 'y' && reply !== 'yes') {
        print('Nothing was written.\n');
        return 0;
      }
    } finally {
      prompt.close();
    }
  }
  const applied = applyUpdate(dir, planned.plan);
  if (!applied.ok) return fail(applied.error);
  const lines = [
    ...applied.written.map((path) => `  wrote     ${path}`),
    ...applied.deleted.map((path) => `  deleted   ${path}`),
    ...applied.kept.map((path) => `  kept      ${path}  (it changed since the plan)`),
  ];
  print(`\n${lines.join('\n')}\n\nNext: review the changes with git diff, then commit them.\n`);
  return 0;
}

process.exitCode = await main(process.argv.slice(2));
