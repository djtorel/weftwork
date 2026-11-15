// story: e12s01
// Run each detected command once, with a timeout, to check that it resolves
// (H3: a command written into AGENTS.md must resolve today). A run command can
// start a server that does not exit, and a deploy or publish must never run,
// so both are skipped with the reason. docs/DETECT.md.
import { runCapture } from './process.ts';
import type { FoundCommand } from './detect-stacks.ts';

export type CheckStatus = 'passed' | 'failed' | 'missing' | 'timeout' | 'skipped';
export type Check = { status: CheckStatus; exitCode: number | null; why?: string };
export type CheckedCommand = FoundCommand & { check: Check };

/** A name, command or body that deploys or publishes. Matched loosely on
 * purpose: a false skip costs one unchecked command, a false run can ship. */
const shipping = /deploy|publish/i;

/** Why `found` must not run, or null. */
function skipReason(found: FoundCommand): string | null {
  if (found.kind === 'run') return 'a run command can start a process that does not exit';
  if (shipping.test(`${found.command}\n${found.body ?? ''}`)) return 'it looks like a deploy or publish step';
  return null;
}

async function checkOne(found: FoundCommand, cwd: string, timeoutMs: number): Promise<Check> {
  const skip = skipReason(found);
  if (skip !== null) return { status: 'skipped', exitCode: null, why: skip };
  // CI=1 keeps watch-mode test runners (vitest, jest) from waiting for input.
  const outcome = await runCapture(found.command, cwd, timeoutMs, '', { ...process.env, CI: '1' });
  switch (outcome.reason) {
    case 'passed':
      return { status: 'passed', exitCode: 0 };
    case 'exit-nonzero':
      return outcome.exitCode === 126 || outcome.exitCode === 127 ? { status: 'missing', exitCode: outcome.exitCode } : { status: 'failed', exitCode: outcome.exitCode };
    case 'timeout':
      return { status: 'timeout', exitCode: null, why: `stopped after ${timeoutMs} ms` };
    case 'not-started':
      return { status: 'missing', exitCode: null, why: 'the shell did not start' };
    default:
      return { status: 'failed', exitCode: null, why: `it ended: ${outcome.reason}` };
  }
}

/** Each command with its check, run one at a time in `cwd`. Never rejects. */
export async function checkCommands(commands: FoundCommand[], cwd: string, timeoutMs: number): Promise<CheckedCommand[]> {
  const checked: CheckedCommand[] = [];
  for (const found of commands) checked.push({ ...found, check: await checkOne(found, cwd, timeoutMs) });
  return checked;
}
