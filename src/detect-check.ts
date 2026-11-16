// story: e12s01
// Run each detected command once, with a timeout, to check that it resolves
// (H3: a command written into AGENTS.md must resolve today). A run command can
// start a server that does not exit, and a deploy or publish must never run,
// so both are skipped with the reason. docs/DETECT.md.
import { realpathSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { runCapture } from './process.ts';
import { readRegularFile } from './regular-file.ts';
import type { FoundCommand } from './detect-stacks.ts';

export type CheckStatus = 'passed' | 'failed' | 'missing' | 'timeout' | 'skipped';
export type Check = { status: CheckStatus; exitCode: number | null; why?: string };
export type CheckedCommand = FoundCommand & { check: Check };

/** A name, command or body that deploys or publishes. Matched loosely on
 * purpose: a false skip costs one unchecked command, a false run can ship. */
const shipping = /deploy|publish/i;

/** The most files read for one command, and the most of each. */
const maxReachedFiles = 50;
const maxFileBytes = 1024 * 1024;

/** `text` with the text of each file in `cwd` it names (a script such as
 * `./scripts/check.sh`), and of each file those name, under a `# path` line.
 * A path outside `cwd`, through a symlink to outside, or not a regular file of
 * at most 1 MiB is not read. */
function withNamedFiles(text: string, cwd: string): string {
  let root: string;
  try {
    root = realpathSync(cwd);
  } catch {
    return text;
  }
  const seen = new Set<string>();
  const parts = [text];
  const queue = [text];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    for (const word of next.split(/[\s;&|()<>'"`=,]+/)) {
      if (seen.size >= maxReachedFiles) return parts.join('\n');
      if (!/[\w-]/.test(word) || isAbsolute(word)) continue;
      let real: string;
      try {
        real = realpathSync(join(cwd, word));
      } catch {
        continue;
      }
      const inside = relative(root, real);
      if (inside === '' || inside.startsWith('..') || isAbsolute(inside) || seen.has(real)) continue;
      seen.add(real);
      const read = readRegularFile(real, { follow: false, maxBytes: maxFileBytes });
      if (!read.ok || read.file === null) continue;
      parts.push(`# ${inside}`, read.file.text);
      queue.push(read.file.text);
    }
  }
  return parts.join('\n');
}

/** Why `found` must not run in `cwd`, or null. */
function skipReason(found: FoundCommand, cwd: string): string | null {
  if (found.kind === 'run') return 'a run command can start a process that does not exit';
  if (found.unread !== undefined) return `not all it runs could be read: ${found.unread}`;
  if (shipping.test(withNamedFiles(`${found.command}\n${found.body ?? ''}`, cwd))) return 'it looks like a deploy or publish step';
  return null;
}

async function checkOne(found: FoundCommand, cwd: string, timeoutMs: number): Promise<Check> {
  const skip = skipReason(found, cwd);
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
