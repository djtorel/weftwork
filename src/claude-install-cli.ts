// story: e07s03
// Thin shell for the install: run in the root of a project, it registers the
// Stop hook in that project's .claude/settings.json. The declared command is
// the one argument after `--`, as claude-hook-cli.ts reads it. Logic lives in
// claude-install.ts. Exit 0 on success and 1 on any error; this is not a hook,
// so exit 2 means nothing here.
//
// SECURITY: the command is shell code that the hook will run, so it comes from
// the owner at this prompt. The settings file is untrusted input (e10).
import { join } from 'node:path';
import { installInProject } from './claude-install.ts';

const usage = "usage: node claude-install-cli.ts -- '<declared command>'";
const adapter = join(import.meta.dirname, 'claude-hook-cli.ts');

function main(args: string[]): number {
  if (args.length !== 2 || args[0] !== '--' || (args[1] ?? '').trim() === '') {
    process.stderr.write(`${usage}\n`);
    return 1;
  }
  const result = installInProject(process.cwd(), adapter, args[1] ?? '');
  if (!result.ok) {
    process.stderr.write(`weftwork install: ${result.error}\n`);
    return 1;
  }
  process.stdout.write(
    [
      `${result.action}: Stop hook in ${result.path}`,
      '',
      'Next:',
      `- The entry names ${adapter}, so it works on this machine only.`,
      '- If Claude Code shows the workspace trust dialog, accept it. Until you do,',
      '  it does not run the hook.',
      '- Start a new Claude Code session. A session that is already running may not',
      '  see the hook.',
      '- Commit .claude/settings.json to share the hook with the team.',
      '',
    ].join('\n'),
  );
  return 0;
}

process.exitCode = main(process.argv.slice(2));
