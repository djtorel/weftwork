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
//
// e11s04 adds the mechanical ask triggers (docs/ASK.md) when the hook knows
// the worktree: a file tool that writes outside it, and a Bash command that
// pushes to main (guard-push.ts). The Bash write check stays by path text.
//
// e10s01 adds the protected-paths list beyond the engine's own files: git
// internals, the hosts' hook and settings files, and credential files, plus
// the owner's `guard.protected` (guard-setting.ts). A file tool is matched by
// the path from the project root, or the whole path outside it; Bash by each
// path-like word of the command, the same known-partial text match.
import { lstatSync, realpathSync } from 'node:fs';
import { basename, dirname, join, matchesGlob, resolve, sep } from 'node:path';
import { userSettingPath } from './budget.ts';
import { userSettingsPath } from './claude-settings-file.ts';
import { pushToMain, type PushContext } from './guard-push.ts';
import { isRecord } from './json.ts';

/** One entry of the protected-paths list: a pattern (see matchesNames) and
 * the patterns it leaves writable. An exception holds for its own entry only,
 * so it never takes a path off another entry or off the owner's list. */
export type ProtectedPattern = { pattern: string; except: readonly string[] };

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
  /** The project root, which the patterns are matched from. */
  root: string;
  /** The protected-paths list: the built-in entries, then the owner's. */
  patterns: ProtectedPattern[];
};

/** The branches of a repository: the protected ones (main, master and each
 * remote's default branch), the local ones, and the remote-tracking ones
 * (`origin/feat/x`). */
export type Refs = { protected: string[]; local: string[]; remote: string[] };

/** The worktree an agent works in, for the ask triggers. `allowed` holds the
 * folders and files outside it that stay writable: the temp folder and the
 * clone's backlog. `branch` is the current branch, null on a detached HEAD.
 * `refs` is null when git could not list the branches. */
export type Worktree = { root: string; allowed: string[]; branch: string | null; refs: Refs | null };

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
  'decisions.jsonl',
  'override.json',
  'last-call.json',
  'claude-install-cli',
];

const none: readonly string[] = [];

/** e10s01: the built-in protected-paths list, the same in every host, since
 * the hosts' own lists differ (R11, docs/GUARD.md). A name matches at any
 * depth; a trailing `/` protects the whole folder; `*` and `?` match inside
 * one name. Skill and agent folders are not on it: normal work edits them, so
 * the owner adds them to `guard.protected` to protect them. Example env files
 * hold no secret, and the clone's backlog is the owner's plan. */
export const builtInProtected: readonly ProtectedPattern[] = [
  // Git internals: hooks and config run code (R11 S26, S29).
  { pattern: '.git/', except: [`.git/weftwork/${backlogFile}`] },
  // The hosts' hook and settings files (R11 S26, S29; R5; R13).
  { pattern: '.claude/hooks/', except: none },
  { pattern: '.mcp.json', except: none },
  { pattern: '.codex/', except: ['.codex/skills/', '.codex/agents/'] },
  { pattern: '.gemini/settings.json', except: none },
  { pattern: 'opencode.json', except: none },
  { pattern: 'opencode.jsonc', except: none },
  { pattern: '.opencode/plugins/', except: none },
  { pattern: '.pi/extensions/', except: none },
  { pattern: '.kiro/hooks/', except: none },
  // Shell startup files run at every shell start (R11 S26).
  ...['.bashrc', '.bash_profile', '.zshrc', '.profile'].map((pattern) => ({ pattern, except: none })),
  // Credential files (R11 S29, S30).
  { pattern: '.env', except: none },
  { pattern: '.env.*', except: ['.env.example', '.env.sample', '.env.template'] },
  ...['*.pem', '*.key', '*.p12', 'id_rsa*', 'id_dsa*', 'id_ecdsa*', 'id_ed25519*'].map((pattern) => ({ pattern, except: none })),
  ...['.npmrc', '.netrc', '.pypirc', '.aws/', '.ssh/'].map((pattern) => ({ pattern, except: none })),
];

/** True when `pattern` matches `names`, a path split into names: its names
 * match some run of names, which for a file pattern ends the path. */
function matchesNames(names: string[], pattern: string): boolean {
  const parts = pattern.split('/').filter((part) => part !== '');
  const folder = pattern.endsWith('/');
  for (let at = 0; at + parts.length <= names.length; at += 1) {
    if (!parts.every((part, index) => matchesGlob(names[at + index] ?? '', part))) continue;
    if (folder || at + parts.length === names.length) return true;
  }
  return false;
}

/** True when the names hit an entry of the list and none of its exceptions. */
function hitsPattern(names: string[], paths: GuardPaths): boolean {
  return paths.patterns.some(
    ({ pattern, except }) => matchesNames(names, pattern) && !except.some((allowed) => matchesNames(names, allowed)),
  );
}

/** The names of `path` from `root` when it is inside it, else all of them, so
 * a project kept under a folder such as `.codex/` is not protected whole. */
function namesFrom(path: string, root: string | null): string[] {
  const rest = root !== null && isInside(path, root) ? path.slice(root.length) : path;
  return rest.split(/[\\/]/).filter((name) => name !== '' && name !== '.' && name !== '~');
}

/** The protected paths for `project`. `engineDir` is `<git dir>/weftwork`, or
 * null outside a git repository. `extra` is the owner's `guard.protected`,
 * whose entries have no exceptions. */
export function guardPaths(project: string, engineDir: string | null, env: NodeJS.ProcessEnv, extra: readonly string[] = []): GuardPaths {
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
    root: project,
    patterns: [...builtInProtected, ...extra.map((pattern) => ({ pattern, except: none }))],
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
 * folder, and not an allowed file, or on the protected-paths list. */
function isProtected(path: string, paths: GuardPaths): boolean {
  if (paths.allowed.some((file) => canonical(file) === path)) return false;
  if (paths.files.some((file) => canonical(file) === path) || paths.dirs.some((dir) => isInside(path, canonical(dir)))) return true;
  return hitsPattern(namesFrom(path, canonical(paths.root)), paths);
}

function blocked(tool: string, target: string, why: string): GuardAnswer {
  return { block: true, tool, target, reason: `${tool} blocked: ${why}` };
}

const ownerOnly =
  'it sets your own limits or the hooks that hold you, or it is on the protected-paths list ' +
  '(git internals, host hooks and settings, credential files, guard.protected), and only the owner changes it.';

const byText =
  'The guard matches a command by its text, so a command that only reads or mentions the path is blocked too. ' +
  'To read the file, use the Read tool. To put the path in a commit or PR text, write the text to a file and pass the file.';

const askOwner =
  'Only the owner may do this. Decide another way inside the task, or end the run blocked with a handoff and ask the owner (docs/ASK.md).';

/** Block a write outside the worktree, unless it is an allowed path. */
function checkOutside(tool: string, raw: string, path: string, worktree: Worktree): GuardAnswer {
  if (isInside(path, canonical(worktree.root))) return { block: false };
  if (worktree.allowed.some((allowed) => isInside(path, canonical(allowed)))) return { block: false };
  return blocked(tool, raw, `${raw} is outside the worktree ${worktree.root}. ${askOwner}`);
}

function checkFile(
  tool: string,
  input: Record<string, unknown>,
  cwd: unknown,
  guard: GuardPaths,
  worktree: Worktree | null,
): GuardAnswer {
  const raw = input[fileTools[tool] ?? ''];
  if (typeof raw !== 'string' || raw === '') {
    return blocked(tool, '', 'the guard could not read the path the tool writes.');
  }
  const base = typeof cwd === 'string' ? cwd : '/';
  const path = canonical(resolve(base, raw));
  if (isProtected(path, guard)) return blocked(tool, raw, `${raw} is protected: ${ownerOnly}`);
  return worktree === null ? { block: false } : checkOutside(tool, raw, path, worktree);
}

/** `text` as a whole path: not followed by a character that would make it a
 * longer name (`BACKLOG.md.bak` is another file). */
function wholeToken(text: string): RegExp {
  const escaped = text.replace(/[.*+?^$|()[\]{}\\]/g, '\\$&');
  return new RegExp(`${escaped}(?![^\\s'"\`;|&)<>])`, 'g');
}

/** Whether `name` is a path in `cwd`; true in doubt, and for a cwd outside
 * the worktree, where git would run on another repository. */
function isPathIn(cwd: unknown, root: string, name: string): boolean {
  if (typeof cwd !== 'string' || !isInside(canonical(cwd), canonical(root))) return true;
  try {
    lstatSync(resolve(cwd, name));
    return true;
  } catch (error) {
    return !(error instanceof Error && 'code' in error && error.code === 'ENOENT');
  }
}

function pushContext(worktree: Worktree, cwd: unknown): PushContext | null {
  const { refs } = worktree;
  if (refs === null) return null;
  const isPath = (name: string) => isPathIn(cwd, worktree.root, name);
  return { protected: new Set(refs.protected), local: new Set(refs.local), remote: refs.remote, isPath };
}

function checkBash(command: unknown, cwd: unknown, guard: GuardPaths, worktree: Worktree | null): GuardAnswer {
  if (typeof command !== 'string') {
    return blocked('Bash', '', 'the guard could not read the command.');
  }
  const push = worktree === null ? null : pushToMain(command, worktree.branch, pushContext(worktree, cwd));
  const step = "a push to main, master or the remote's default branch is the owner's step";
  if (push !== null) return blocked('Bash', 'git push', `${push}, and ${step}. ${askOwner}`);
  const text = guard.allowedText.reduce((rest, allowed) => rest.replace(wholeToken(allowed), ''), command);
  const needle = guard.needles.find((name) => text.includes(name)) ?? protectedWord(command, guard);
  return needle === undefined
    ? { block: false }
    : blocked('Bash', needle, `the command names ${needle}, which is protected: ${ownerOnly} ${byText}`);
}

/** The first path-like word of `command` on the protected-paths list. A word
 * that starts with the project root is read from the root. */
function protectedWord(command: string, guard: GuardPaths): string | undefined {
  const roots = [guard.root, canonical(guard.root)];
  const words = command.split(/[\s'"`;|&()<>=$]+/).filter((word) => word !== '' && !guard.allowed.includes(word));
  return words.find((word) => hitsPattern(namesFrom(word, roots.find((root) => isInside(word, root)) ?? null), guard));
}

/** Block or allow one PreToolUse input. A tool the guard does not watch is
 * allowed; an input it cannot read is blocked, since the guard must not fail
 * open on the calls it watches. The ask triggers run only with a worktree. */
export function guardCall(input: unknown, guard: GuardPaths, worktree: Worktree | null = null): GuardAnswer {
  if (!isRecord(input) || typeof input.tool_name !== 'string') {
    return blocked('tool call', '', 'the guard could not read the hook input.');
  }
  const tool = input.tool_name;
  const toolInput = input.tool_input;
  if (!(tool in fileTools) && tool !== 'Bash') return { block: false };
  if (!isRecord(toolInput)) return blocked(tool, '', 'the guard could not read the tool input.');
  if (tool === 'Bash') return checkBash(toolInput.command, input.cwd, guard, worktree);
  return checkFile(tool, toolInput, input.cwd, guard, worktree);
}
