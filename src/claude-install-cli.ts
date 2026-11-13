// story: e07s03
// Thin shell for the install: run in the root of a project, it registers the
// Stop hook in that project's .claude/settings.json. The declared command is
// the one argument after `--`, as claude-hook-cli.ts reads it. Logic lives in
// claude-install.ts and claude-settings-file.ts. Exit 0 on success and 1 on any error; this is not a hook,
// so exit 2 means nothing here.
//
// SECURITY: the command is shell code that the hook will run, so it comes from
// the owner at this prompt. The settings file is untrusted input (e10).
import { join } from 'node:path';
import { installInProject } from './claude-settings-file.ts';

const usage = "usage: node claude-install-cli.ts -- '<declared command>'";
const adapter = join(import.meta.dirname, 'claude-hook-cli.ts');

/** What the owner does next, printed after a successful install. */
function nextSteps(path: string): string {
  return [
    `Stop hook in ${path}`,
    '',
    'Next:',
    `- The entry names ${adapter}, so it works on this machine only.`,
    '- If Claude Code shows the workspace trust dialog, accept it. Until you do,',
    '  it does not run the hook.',
    '- Start a new Claude Code session. A session that is already running may not',
    '  see the hook.',
    '- Commit .claude/settings.json to share the hook with the team.',
    '- If you move this checkout, run the install again and delete the old entry by hand.',
    '',
  ].join('\n');
}

function main(args: string[]): number {
  const [flag, command] = args;
  if (args.length !== 2 || flag !== '--' || command === undefined || command.trim() === '') {
    process.stderr.write(`${usage}\n`);
    return 1;
  }
  const result = installInProject(process.cwd(), adapter, command);
  if (!result.ok) {
    process.stderr.write(`weftwork install: ${result.error}\n`);
    return 1;
  }
  process.stdout.write(`${result.action}: ${nextSteps(result.path)}`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
