// story: e07s01
// Thin shell for the Claude Code Stop hook: the host's JSON on stdin, the
// declared command as the one argument after `--`, the host's answer on
// stdout and stderr and in the exit code. Logic lives in claude-hook.ts.
//
// SECURITY: the command is shell code from the owner's hook entry, never
// from the agent whose work it checks (threat model T1). Exit 2 is the only
// block. A crash before the exit code is set is fail-open: the host treats
// any other failure as a non-blocking error and the stop goes ahead. e07s02
// records that residual and e07s04 checks for it.
import { hookAnswer, parseHookInput, type HookOutput } from './claude-hook.ts';
import { runEngine } from './engine.ts';
import { badInputExitCode } from './states.ts';

function blockStop(stderr: string): HookOutput {
  return { exitCode: badInputExitCode, stdout: '', stderr: `weftwork: ${stderr}\n` };
}

async function readStdin(): Promise<string> {
  process.stdin.setEncoding('utf8');
  let text = '';
  for await (const chunk of process.stdin) {
    text += chunk;
  }
  return text;
}

async function run(args: string[]): Promise<HookOutput> {
  const command = args.length === 2 && args[0] === '--' ? args[1] : undefined;
  if (command === undefined) {
    return blockStop("usage: claude-hook-cli.ts -- '<declared command>'");
  }
  const input = parseHookInput(await readStdin());
  if (!input.ok) {
    return blockStop(`unreadable hook input: ${input.error}`);
  }
  return hookAnswer(await runEngine({ command, cwd: input.cwd }));
}

const output = await run(process.argv.slice(2));
process.stdout.write(output.stdout);
process.stderr.write(output.stderr);
process.exitCode = output.exitCode;
