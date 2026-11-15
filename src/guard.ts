// story: e11s01
// The guard: an agent's tool call must not change the files that set its own
// limits or register the hooks that hold it (docs/GUARD.md). guardCall reads
// one PreToolUse input and says block or allow; guard-cli.ts is the hook.
//
// Edit, Write, MultiEdit and NotebookEdit are matched by path: the path is
// resolved against the tool's cwd and through symlinks, then compared with
// each protected path resolved the same way. Bash is matched by text: the
// command is blocked when it names a protected path or a protected file name.
// That is a known partial guard. A command can build a path the text does not
// show (a variable, a glob, `cd .git`), and a command that only reads or only
// mentions a path is blocked too. The engine's own CLIs write these files from
// their own process, so no tool call names the path and they still work.
import { realpathSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { userSettingPath } from './budget.ts';
import { userSettingsPath } from './claude-settings-file.ts';
import { isRecord } from './json.ts';

/** What the guard protects, for one project. */
export type GuardPaths = {
  /** Single files: the setting files and the Claude Code settings. */
  files: string[];
  /** Folders whose whole contents are protected: the engine's folder. */
  dirs: string[];
  /** Files inside a protected folder that stay writable. */
  allowed: string[];
  /** Text that blocks a Bash command that holds it. */
  needles: string[];
  /** Text removed from a Bash command before the needles are matched. */
  allowedText: string[];
};

export type GuardAnswer = { block: false } | { block: true; tool: string; target: string; reason: string };

/** The tools that write a file, and the input key that names it. */
const fileTools: Record<string, string> = {
  Edit: 'file_path',
  Write: 'file_path',
  MultiEdit: 'file_path',
  NotebookEdit: 'notebook_path',
};

/** The local backlog of this clone lives in the common git dir's engine
 * folder, which is the engine folder itself in a main checkout. It is the
 * owner's plan, which the agent ticks, not a limit. */
const backlogFile = 'BACKLOG.md';

/** Names that block a Bash command wherever they appear: the files above as a
 * command is likely to write them, and the install CLI, which rewrites the
 * hook entries. */
const fixedNeedles = [
  'weftwork.yaml',
  '.claude/settings',
  '.git/weftwork',
  'weftwork/config.yaml',
  'weftwork/state.yaml',
  'ledger.jsonl',
  'override.json',
  'last-call.json',
  'claude-install-cli',
];

/** The protected paths for `project`. `engineDir` is `<git dir>/weftwork`, or
 * null outside a git repository. */
export function guardPaths(project: string, engineDir: string | null, env: NodeJS.ProcessEnv): GuardPaths {
  const files = [
    join(project, 'weftwork.yaml'),
    join(project, '.claude', 'settings.json'),
    join(project, '.claude', 'settings.local.json'),
    userSettingPath(env),
    userSettingsPath(env),
  ].filter((path) => path !== null);
  const dirs = engineDir === null ? [] : [engineDir];
  const allowed = dirs.map((dir) => join(dir, backlogFile));
  return {
    files,
    dirs,
    allowed,
    needles: [...fixedNeedles, ...files, ...dirs],
    allowedText: [...allowed, `weftwork/${backlogFile}`],
  };
}

/** `path` with every symlink in it resolved. The part that does not exist yet
 * is kept as written, under its resolved parent. */
function canonical(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    const parent = dirname(path);
    return parent === path ? path : join(canonical(parent), basename(path));
  }
}

function isInside(path: string, dir: string): boolean {
  return path === dir || path.startsWith(dir.endsWith(sep) ? dir : dir + sep);
}

/** True when the resolved `path` is a protected file or inside a protected
 * folder, and not an allowed file. */
function isProtected(path: string, paths: GuardPaths): boolean {
  if (paths.allowed.some((file) => canonical(file) === path)) return false;
  return paths.files.some((file) => canonical(file) === path) || paths.dirs.some((dir) => isInside(path, canonical(dir)));
}

function blocked(tool: string, target: string, why: string): GuardAnswer {
  return { block: true, tool, target, reason: `${tool} blocked: ${why}` };
}

const ownerOnly = 'it sets your own limits or the hooks that hold you, and only the owner changes it.';

const byText =
  'The guard matches a command by its text, so a command that only reads or mentions the path is blocked too. ' +
  'To read the file, use the Read tool. To put the path in a commit or PR text, write the text to a file and pass the file.';

function checkFile(tool: string, input: Record<string, unknown>, cwd: unknown, guard: GuardPaths): GuardAnswer {
  const raw = input[fileTools[tool] ?? ''];
  if (typeof raw !== 'string' || raw === '') {
    return blocked(tool, '', 'the guard could not read the path the tool writes.');
  }
  const base = typeof cwd === 'string' ? cwd : '/';
  const path = canonical(resolve(base, raw));
  return isProtected(path, guard)
    ? blocked(tool, raw, `${raw} is protected: ${ownerOnly}`)
    : { block: false };
}

function checkBash(command: unknown, guard: GuardPaths): GuardAnswer {
  if (typeof command !== 'string') {
    return blocked('Bash', '', 'the guard could not read the command.');
  }
  const text = guard.allowedText.reduce((rest, allowed) => rest.replaceAll(allowed, ''), command);
  const needle = guard.needles.find((name) => text.includes(name));
  return needle === undefined
    ? { block: false }
    : blocked('Bash', needle, `the command names ${needle}, which is protected: ${ownerOnly} ${byText}`);
}

/** Block or allow one PreToolUse input. A tool the guard does not watch is
 * allowed; an input it cannot read is blocked, since the guard must not fail
 * open on the calls it watches. */
export function guardCall(input: unknown, guard: GuardPaths): GuardAnswer {
  if (!isRecord(input) || typeof input.tool_name !== 'string') {
    return blocked('tool call', '', 'the guard could not read the hook input.');
  }
  const tool = input.tool_name;
  const toolInput = input.tool_input;
  if (!(tool in fileTools) && tool !== 'Bash') return { block: false };
  if (!isRecord(toolInput)) return blocked(tool, '', 'the guard could not read the tool input.');
  if (tool === 'Bash') return checkBash(toolInput.command, guard);
  return checkFile(tool, toolInput, input.cwd, guard);
}
