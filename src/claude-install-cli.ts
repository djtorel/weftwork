// story: e07s03, e07s04, e11s01
// Thin shell for the install: run in the root of a project, it registers the
// Stop hook and the guard (a PreToolUse hook) in that project's
// .claude/settings.json. The declared command is
// the one argument after `--`, as claude-hook-cli.ts reads it. Logic lives in
// claude-install.ts and claude-settings-file.ts. Exit 0 on success and 1 on
// any error; this is not a hook, so exit 2 means nothing here.
//
// The entries run `weftwork claude-hook` and `weftwork guard` as the resolver
// finds weftwork, and block when it is missing (launcher.ts); a SessionStart
// entry gives the session's Bash commands the same resolver.
//
// SECURITY: the command is shell code that the hook will run, so it comes from
// the owner at this prompt. The settings file is untrusted input (e10).
import { weftworkOnPath } from './claude/claude-install.ts';
import { installInProject } from './claude/claude-settings-file.ts';

const usage = "usage: weftwork claude-install -- '<declared command>'";

/** What the owner does next, printed after a successful install. */
function nextSteps(path: string, guardChanged: boolean): string {
  return [
    `Stop hook in ${path}`,
    `${guardChanged ? 'added' : 'unchanged'}: PreToolUse guard in ${path}`,
    '',
    'Next:',
    '- The entries run the weftwork command: this clone\'s own install, a dev',
    '  dependency or the one on PATH. Where none is found they block every stop',
    '  and tool call and say how to install it (npx weftwork install).',
    '- If Claude Code shows the workspace trust dialog, accept it. Until you do,',
    '  it does not run the hook.',
    '- Start a new Claude Code session. A session that is already running may not',
    '  see the hook.',
    '- Commit .claude/settings.json to share the hook with the team.',
    '',
  ].join('\n');
}

function main(args: string[]): number {
  const [flag, command] = args;
  if (args.length !== 2 || flag !== '--' || command === undefined || command.trim() === '') {
    process.stderr.write(`${usage}\n`);
    return 1;
  }
  const result = installInProject(process.cwd(), { stop: weftworkOnPath, guard: weftworkOnPath }, command);
  if (!result.ok) {
    process.stderr.write(`weftwork claude-install: ${result.error}\n`);
    return 1;
  }
  process.stdout.write(`${result.action}: ${nextSteps(result.path, result.guardChanged)}`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
