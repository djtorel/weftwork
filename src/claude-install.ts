// story: e07s03
// The settings edit that registers the Stop hook in Claude Code's
// .claude/settings.json. installStopHook is pure: the file's text in, the new
// text out. installInProject does the reading and the atomic write; the install
// command (claude-install-cli.ts) only parses arguments and prints.
//
// The settings file is untrusted input: it may be anything, and the agent can
// edit it. Text of the wrong shape is refused, never repaired or overwritten.
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { hookTimeoutSeconds } from './claude-hook.ts';
import { isMissing, messageOf } from './errors.ts';
import { isRecord } from './json.ts';

export type InstallResult =
  | { ok: true; text: string; changed: boolean; action: 'added' | 'replaced' | 'unchanged' }
  | { ok: false; error: string };

/** Wrap `text` in single quotes for a POSIX shell: each `'` becomes `'\''`. */
export function shellQuote(text: string): string {
  return `'${text.replaceAll("'", `'\\''`)}'`;
}

/** The command of the hook entry: node runs the adapter, and `command` is the
 * one argument after `--`, as claude-hook-cli.ts reads it. */
export function stopHookCommand(cliPath: string, command: string): string {
  return `node ${shellQuote(cliPath)} -- ${shellQuote(command)}`;
}

function refuse(error: string): InstallResult {
  return { ok: false, error };
}

/** True when `hook` is a weftwork entry: a command that runs this checkout's
 * adapter. The match is the whole quoted path, so an entry from another
 * checkout, or a path that only starts the same, is not ours. */
function isOurs(hook: unknown, cliPath: string): boolean {
  return isRecord(hook) && typeof hook.command === 'string' && hook.command.includes(shellQuote(cliPath));
}

/** The settings text with one weftwork Stop entry for `command`. `text` is the
 * file's text, or null when there is no file. A weftwork entry that exists is
 * replaced in place, and any more of them are removed, so there is at most
 * one. Every other key and hook stays, in order. */
export function installStopHook(text: string | null, cliPath: string, command: string): InstallResult {
  if (command.trim() === '') {
    return refuse('the declared command is blank');
  }
  let settings: unknown = {};
  if (text !== null) {
    try {
      settings = JSON.parse(text);
    } catch (error) {
      return refuse(`the settings are not valid JSON: ${messageOf(error)}`);
    }
  }
  if (!isRecord(settings)) {
    return refuse('the settings are not a JSON object');
  }
  const hooks = settings.hooks ?? {};
  if (!isRecord(hooks)) {
    return refuse('"hooks" in the settings is not an object');
  }
  const stop = hooks.Stop ?? [];
  if (!Array.isArray(stop)) {
    return refuse('"hooks.Stop" in the settings is not a list');
  }

  const entry = { type: 'command', command: stopHookCommand(cliPath, command), timeout: hookTimeoutSeconds };
  let found = false;
  const groups: unknown[] = [];
  for (const group of stop as unknown[]) {
    if (!isRecord(group) || !Array.isArray(group.hooks)) {
      return refuse('a group in "hooks.Stop" is not an object with a "hooks" list');
    }
    const kept: unknown[] = [];
    let touched = false;
    for (const hook of group.hooks as unknown[]) {
      if (!isOurs(hook, cliPath)) {
        kept.push(hook);
      } else if (!found) {
        found = true;
        touched = true;
        kept.push(entry);
      } else {
        touched = true;
      }
    }
    if (kept.length > 0 || !touched) {
      groups.push({ ...group, hooks: kept });
    }
  }
  if (!found) {
    groups.push({ hooks: [entry] });
  }

  const out = `${JSON.stringify({ ...settings, hooks: { ...hooks, Stop: groups } }, null, 2)}\n`;
  const changed = out !== text;
  const action = !changed ? 'unchanged' : found ? 'replaced' : 'added';
  return { ok: true, text: out, changed, action };
}

export type InstallInProject =
  | { ok: true; action: 'added' | 'replaced' | 'unchanged'; path: string }
  | { ok: false; error: string };

/** Read the settings file, or null when there is none. Only a regular file is
 * read. The agent can replace the file, and opening a FIFO blocks (BUG-007), so
 * the open does not block and does not follow a symlink, and the opened file is
 * checked. Returns the file's mode too, so a rewrite keeps it. */
function readSettings(path: string): { text: string; mode: number } | null {
  let fd: number;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
  } catch (error) {
    if (isMissing(error)) {
      return null;
    }
    throw new Error(`${path} cannot be opened as a regular file: ${messageOf(error)}`);
  }
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) {
      throw new Error(`${path} is not a regular file`);
    }
    return { text: readFileSync(fd, 'utf8'), mode: stat.mode & 0o777 };
  } finally {
    closeSync(fd);
  }
}

/** Register the Stop hook in `dir`'s .claude/settings.json. `dir` must be the
 * root of a git repository. Writes only when the text changes, through a
 * temporary file and a rename, so a crash never leaves half a file. Returns an
 * error value, and writes nothing, for anything it will not edit. */
export function installInProject(dir: string, cliPath: string, command: string): InstallInProject {
  const fail = (error: string): InstallInProject => ({ ok: false, error });
  try {
    try {
      lstatSync(join(dir, '.git'));
    } catch {
      return fail(`${dir} is not the root of a git repository`);
    }
    const claudeDir = join(dir, '.claude');
    const path = join(claudeDir, 'settings.json');
    let claudeStat: ReturnType<typeof lstatSync> | null = null;
    try {
      claudeStat = lstatSync(claudeDir);
    } catch (error) {
      if (!isMissing(error)) {
        throw error;
      }
    }
    if (claudeStat !== null && !claudeStat.isDirectory()) {
      return fail(`${claudeDir} is not a directory (a symlink is refused)`);
    }
    const existing = readSettings(path);
    const result = installStopHook(existing?.text ?? null, cliPath, command);
    if (!result.ok) {
      return fail(`${path}: ${result.error}`);
    }
    if (result.changed) {
      mkdirSync(claudeDir, { recursive: true });
      const temp = join(claudeDir, `settings.json.${process.pid}.tmp`);
      try {
        writeFileSync(temp, result.text, { flag: 'wx', mode: existing?.mode ?? 0o644 });
        renameSync(temp, path);
      } finally {
        rmSync(temp, { force: true });
      }
    }
    return { ok: true, action: result.action, path };
  } catch (error) {
    return fail(messageOf(error));
  }
}
