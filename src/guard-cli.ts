// story: e11s01
// Thin shell for the Claude Code PreToolUse hook that runs the guard: the
// host's JSON on stdin, exit 2 and the reason on stderr to block the tool
// call, exit 0 and no output to let it go. Logic lives in guard.ts.
//
// A PreToolUse exit 2 blocks in every permission mode, bypassPermissions too
// (Claude Code hooks docs, read 2026-11-15). Any other exit code is a
// non-blocking error and the call goes ahead, so every fault of this hook
// (no project dir, bad input, a throw, the deadline) ends in exit 2. A crash
// before this code runs still fails open; the guard is one layer, not a wall.
//
// e11s04: with a git worktree, the guard also blocks the mechanical ask
// triggers, a file write outside the worktree and a push to main (docs/ASK.md).
//
// Each block is a guard line in the ledger. A failed log write does not turn a
// block into an allow; the reason says the log failed.
import { writeSync } from 'node:fs';
import { join } from 'node:path';
import {
  blockStop,
  failClosed,
  faultOutput,
  maxHookInputBytes,
  projectDir,
  readHookInput,
  stdinDeadlineMs,
  type HookOutput,
} from './claude-hook.ts';
import { guardCall, guardPaths } from './guard.ts';
import { guardWorktree } from './guard-worktree.ts';
import { appendGuard, weftworkDir } from './ledger.ts';

/** The guard gives up and blocks this long after its start. The host's
 * timeout for the entry (guardTimeoutSeconds, 30 s) is longer, so the guard's
 * own block comes first. */
const guardDeadlineMs = 20000;

const allow: HookOutput = { exitCode: 0, stdout: '', stderr: '' };

function leave(output: HookOutput): never {
  try {
    writeSync(1, output.stdout);
    writeSync(2, output.stderr);
  } catch {
    // The host closed the pipe.
  }
  process.exit(output.exitCode);
}

process.on('uncaughtException', (error) => leave(faultOutput(error)));
process.on('unhandledRejection', (error) => leave(faultOutput(error)));
setTimeout(() => leave(blockStop('the guard ran out of time')), guardDeadlineMs).unref();

function parse(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

async function run(): Promise<HookOutput> {
  const dir = projectDir(process.env);
  if (!dir.ok) return blockStop(dir.error);
  const text = await readHookInput(process.stdin, maxHookInputBytes, stdinDeadlineMs);
  if (!text.ok) return blockStop(`unreadable hook input: ${text.error}`);
  const input = parse(text.text);
  if (!input.ok) return blockStop('unreadable hook input: input is not JSON');
  const engineDir = await weftworkDir(dir.dir);
  const worktree = await guardWorktree(dir.dir, process.env);
  const answer = guardCall(input.value, guardPaths(dir.dir, engineDir, process.env), worktree);
  if (!answer.block) return allow;
  const entry = { guard: 'blocked' as const, tool: answer.tool, target: answer.target };
  const logged = engineDir === null ? null : await appendGuard(join(engineDir, 'ledger.jsonl'), entry, new Date());
  const note = logged !== null && !logged.ok ? `\n(the block could not be logged: ${logged.error})` : '';
  return blockStop(answer.reason + note);
}

leave(await failClosed(run));
