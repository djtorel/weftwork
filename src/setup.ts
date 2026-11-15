// story: e12s02
// Set up a new or plain project: plan the files from the detect report and
// the owner's answers (a dry run that writes nothing), then apply the plan.
// A file that exists and differs is a conflict, shown as a diff and kept,
// unless the owner names it; then the old file is moved aside, never deleted.
// The texts are in setup-text.ts. docs/SETUP.md.
import { lstatSync, readlinkSync, renameSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isAbsolute, join, resolve } from 'node:path';
import { shellQuote } from './claude-install.ts';
import { installInProject, isGitRoot } from './claude-settings-file.ts';
import { isMissing, messageOf, type Failure } from './errors.ts';
import { readRegularFile, writeAtomic } from './regular-file.ts';
import { lineDiff } from './setup-diff.ts';
import { agentsLetter, backlog, conventions, ignoreLines, missingLines, preflight, type Answers, type CheckedReport } from './setup-text.ts';

export type ChangeAction = 'create' | 'append' | 'link' | 'hook' | 'unchanged' | 'conflict';

/** One planned change. `path` is from the project folder, or absolute for the
 * backlog in the git directory. `text` is what is written (for a hook, the
 * Preflight it declares); `diff` is what the owner reviews. */
export type Change = { path: string; action: ChangeAction; text?: string; diff?: string; mode?: number };
export type Plan = { changes: Change[]; notes: string[] };
export type SetupOptions = { engineDir: string; stopHook: boolean };
export type Applied = { ok: true; written: string[]; kept: string[] } | Failure;

const maxFileBytes = 1024 * 1024;
const skillFiles = ['full-stop/SKILL.md', 'review-loop/SKILL.md', 'file-pr/SKILL.md', 'README.md', 'TSTACK-LICENSE'];
const ignoreHeader = '# Added by weftwork setup.';
const oldSuffix = '.weftwork-old';

/** Why a write to `path` (from `dir`) could leave the folder: a folder on the
 * way that is a symlink or not a folder. Null when every folder is plain. */
function pathRefusal(dir: string, path: string): string | null {
  const parts = path.split('/').slice(0, -1);
  for (let end = 1; end <= parts.length; end++) {
    const folder = parts.slice(0, end).join('/');
    try {
      const stat = lstatSync(join(dir, folder));
      if (stat.isSymbolicLink()) return `${folder} is a symlink; setup writes only into plain folders`;
      if (!stat.isDirectory()) return `${folder} is not a folder`;
    } catch (error) {
      if (isMissing(error)) return null;
      return `${folder} cannot be checked: ${messageOf(error)}`;
    }
  }
  return null;
}

const absolute = (dir: string, path: string): string => (isAbsolute(path) ? path : join(dir, path));

/** The change that makes `path` hold `text`. */
function fileChange(dir: string, path: string, text: string): Change {
  const read = readRegularFile(absolute(dir, path), { follow: false, maxBytes: maxFileBytes });
  if (!read.ok) return { path, action: 'conflict', text, diff: `(${read.error})` };
  if (read.file === null) return { path, action: 'create', text, diff: lineDiff('', text) };
  if (read.file.text === text) return { path, action: 'unchanged' };
  return { path, action: 'conflict', text, diff: lineDiff(read.file.text, text), mode: read.file.mode };
}

/** CLAUDE.md as a symlink to AGENTS.md. */
function linkChange(dir: string): Change {
  const path = 'CLAUDE.md';
  try {
    const stat = lstatSync(join(dir, path));
    if (stat.isSymbolicLink() && readlinkSync(join(dir, path)) === 'AGENTS.md') return { path, action: 'unchanged' };
    const read = readRegularFile(join(dir, path), { follow: false, maxBytes: maxFileBytes });
    const before = read.ok && read.file !== null ? read.file.text : '';
    return { path, action: 'conflict', diff: `${lineDiff(before, '')}\n(becomes a symlink to AGENTS.md)` };
  } catch (error) {
    if (isMissing(error)) return { path, action: 'link', diff: '(a symlink to AGENTS.md)' };
    return { path, action: 'conflict', diff: `(${messageOf(error)})` };
  }
}

/** The .gitignore with the missing lines added at the end. */
function ignoreChange(dir: string, report: CheckedReport): Change | Failure {
  const read = readRegularFile(join(dir, '.gitignore'), { follow: false, maxBytes: maxFileBytes });
  if (!read.ok) return read;
  const old = read.file?.text ?? '';
  const lines = missingLines(old, ignoreLines(report));
  if (lines.length === 0) return { path: '.gitignore', action: 'unchanged' };
  const gap = old === '' ? '' : old.endsWith('\n') ? '\n' : '\n\n';
  const added = `${ignoreHeader}\n${lines.join('\n')}\n`;
  return { path: '.gitignore', action: 'append', text: old + gap + added, diff: lineDiff('', added), mode: read.file?.mode };
}

/** The skills, with each `node src/<cli>.ts` naming this engine's checkout, so
 * they run from another repository (as the Stop hook entry does). */
function skillTexts(engineDir: string): { ok: true; files: [string, string][] } | Failure {
  const files: [string, string][] = [];
  for (const name of skillFiles) {
    const read = readRegularFile(join(engineDir, '.claude', 'skills', name), { follow: true, maxBytes: maxFileBytes });
    if (!read.ok) return read;
    if (read.file === null) return { ok: false, error: `the engine has no skill file ${name}` };
    const text = read.file.text.replace(/node src\/([\w.-]+\.ts)/g, (_, cli: string) => `node ${shellQuote(join(engineDir, 'src', cli))}`);
    files.push([`.claude/skills/${name}`, text]);
  }
  return { ok: true, files };
}

/** The git common directory of the repository rooted at `dir`. */
function gitCommonDir(dir: string): string | null {
  const run = spawnSync('git', ['rev-parse', '--git-common-dir'], { cwd: dir, encoding: 'utf8' });
  return run.status === 0 ? resolve(dir, run.stdout.trim()) : null;
}

/** The plan for setting up `dir`. Writes nothing. */
export function planSetup(dir: string, report: CheckedReport, answers: Answers, options: SetupOptions): { ok: true; plan: Plan } | Failure {
  const name = dir.split('/').filter(Boolean).pop() ?? 'project';
  const skills = skillTexts(options.engineDir);
  if (!skills.ok) return skills;
  const wanted: [string, string][] = [['AGENTS.md', agentsLetter(name, report, answers)]];
  const rules = conventions(answers);
  if (rules !== null) wanted.push(['CONVENTIONS.md', rules]);
  wanted.push(...skills.files);
  const changes: Change[] = [];
  const notes: string[] = [];
  for (const [path, text] of wanted) {
    const refusal = pathRefusal(dir, path);
    if (refusal !== null) return { ok: false, error: refusal };
    changes.push(fileChange(dir, path, text));
  }
  changes.splice(1, 0, linkChange(dir));
  const ignore = ignoreChange(dir, report);
  if ('ok' in ignore) return ignore;
  changes.push(ignore);
  const common = isGitRoot(dir) ? gitCommonDir(dir) : null;
  if (common === null) {
    notes.push(`${dir} is not a git repository root: no backlog and no Stop hook. Run git init and set up again.`);
    return { ok: true, plan: { changes, notes } };
  }
  changes.push(fileChange(dir, join(common, 'weftwork', 'BACKLOG.md'), backlog(answers)));
  const check = preflight(report);
  if (options.stopHook && check === null) notes.push('No Stop hook: no test, lint or typecheck command passed, so there is no Preflight to declare.');
  if (options.stopHook && check !== null) changes.push({ path: '.claude/settings.json', action: 'hook', text: check, diff: `(Stop hook and guard declaring: ${check})` });
  return { ok: true, plan: { changes, notes } };
}

/** Write one change. */
function write(dir: string, change: Change, engineDir: string): Failure | null {
  const path = absolute(dir, change.path);
  if (!isAbsolute(change.path)) {
    const refusal = pathRefusal(dir, change.path);
    if (refusal !== null) return { ok: false, error: refusal };
  }
  if (change.action === 'hook') {
    const clis = { stop: join(engineDir, 'src', 'claude-hook-cli.ts'), guard: join(engineDir, 'src', 'guard-cli.ts') };
    const installed = installInProject(dir, clis, change.text ?? '');
    return installed.ok ? null : installed;
  }
  try {
    if (change.path === 'CLAUDE.md') {
      symlinkSync('AGENTS.md', path);
      return null;
    }
  } catch (error) {
    return { ok: false, error: `CLAUDE.md could not be linked: ${messageOf(error)}` };
  }
  return writeAtomic(path, change.text ?? '', change.mode);
}

/** Move the file at `path` aside to `path.weftwork-old`, which must not exist. */
function moveAside(path: string): Failure | null {
  try {
    lstatSync(path + oldSuffix);
    return { ok: false, error: `${path + oldSuffix} exists; move it before overwriting` };
  } catch (error) {
    if (!isMissing(error)) return { ok: false, error: messageOf(error) };
  }
  try {
    renameSync(path, path + oldSuffix);
    return null;
  } catch (error) {
    return isMissing(error) ? null : { ok: false, error: `${path} could not be moved aside: ${messageOf(error)}` };
  }
}

/** Apply `plan` to `dir`. A conflict is written only when `overwrite` names its
 * path, after the old file is moved aside; the rest are kept. */
export function applySetup(dir: string, plan: Plan, options: { engineDir: string; overwrite: string[] }): Applied {
  const conflicts = new Set(plan.changes.filter((change) => change.action === 'conflict').map((change) => change.path));
  const stray = options.overwrite.find((path) => !conflicts.has(path));
  if (stray !== undefined) return { ok: false, error: `"overwrite" names ${stray}, which is not a conflict in the plan` };
  const written: string[] = [];
  const kept: string[] = [];
  for (const change of plan.changes) {
    if (change.action === 'unchanged') continue;
    if (change.action === 'conflict') {
      if (!options.overwrite.includes(change.path)) {
        kept.push(change.path);
        continue;
      }
      const moved = moveAside(absolute(dir, change.path));
      if (moved !== null) return moved;
    }
    const failed = write(dir, change, options.engineDir);
    if (failed !== null) return failed;
    written.push(change.path);
  }
  return { ok: true, written, kept };
}
