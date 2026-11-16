// story: e12s02
// Set up a new or plain project: plan the files from the detect report and
// the owner's answers (a dry run that writes nothing), then apply the plan.
// A file that exists and differs is a conflict, shown as a diff and kept,
// unless the owner names it; then the old file is moved aside, never deleted.
// The texts are in setup-text.ts. docs/SETUP.md.
import { lstatSync, readlinkSync, renameSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isAbsolute, join, resolve } from 'node:path';
import { installStopHook, weftworkOnPath } from './claude-install.ts';
import { installGuardHook } from './claude-guard-install.ts';
import { isGitRoot } from './claude-settings-file.ts';
import { isMissing, messageOf, type Failure } from './errors.ts';
import { readRegularFile, writeAtomic } from './regular-file.ts';
import { lineDiff } from './setup-diff.ts';
import { agentsLetter, backlog, conventions, ignoreLines, missingLines, preflight, type Answers, type CheckedReport } from './setup-text.ts';

export type ChangeAction = 'create' | 'append' | 'link' | 'unchanged' | 'conflict' | 'rewrite';

/** One planned change. `path` is from the project folder, or absolute for the
 * backlog in the git directory. `text` is what is written; `diff` is what the
 * owner reviews; `before` is the file's text when planned (null: no file), or
 * `link` the target when it was a symlink, so a file changed since then is
 * kept, not written. */
export type Change = { path: string; action: ChangeAction; text?: string; diff?: string; mode?: number; before?: string | null; link?: string };
export type Plan = { changes: Change[]; notes: string[] };
export type SetupOptions = { engineDir: string; stopHook: boolean };
export type Applied = { ok: true; written: string[]; kept: string[]; record: Written[] } | Failure;

/** One write, for undo (setup-undo.ts): `made` is how, `before` the text the
 * file had (null: none; for `overwrite`, now in `<path>.weftwork-old`), and
 * `after` what was written, or the target when `link`. */
export type Written = { path: string; made: 'create' | 'append' | 'overwrite'; link: boolean; before: string | null; after: string };

const maxFileBytes = 1024 * 1024;
const skillFiles = ['full-stop/SKILL.md', 'review-loop/SKILL.md', 'file-pr/SKILL.md', 'README.md', 'TSTACK-LICENSE'];
const ignoreHeader = '# Added by weftwork setup.';
const oldSuffix = '.weftwork-old';

/** Why a write to `path` (from `dir`) could leave the folder: a folder on the
 * way that is a symlink or not a folder. Null when every folder is plain. */
export function pathRefusal(dir: string, path: string): string | null {
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
  if (read.file === null) return { path, action: 'create', text, diff: lineDiff('', text), before: null };
  if (read.file.text === text) return { path, action: 'unchanged' };
  return { path, action: 'conflict', text, diff: lineDiff(read.file.text, text), mode: read.file.mode, before: read.file.text };
}

/** CLAUDE.md as a symlink to AGENTS.md. */
function linkChange(dir: string): Change {
  const path = 'CLAUDE.md';
  try {
    const stat = lstatSync(join(dir, path));
    if (stat.isSymbolicLink()) {
      const link = readlinkSync(join(dir, path));
      if (link === 'AGENTS.md') return { path, action: 'unchanged' };
      return { path, action: 'conflict', diff: `(a symlink to ${link}; becomes a symlink to AGENTS.md)`, link };
    }
    const read = readRegularFile(join(dir, path), { follow: false, maxBytes: maxFileBytes });
    if (!read.ok || read.file === null) return { path, action: 'conflict', diff: `(${read.ok ? 'not a regular file' : read.error})` };
    return { path, action: 'conflict', diff: `${lineDiff(read.file.text, '')}\n(becomes a symlink to AGENTS.md)`, before: read.file.text };
  } catch (error) {
    if (isMissing(error)) return { path, action: 'link', diff: '(a symlink to AGENTS.md)', before: null };
    return { path, action: 'conflict', diff: `(${messageOf(error)})` };
  }
}

/** The .gitignore with setup's missing lines added at the end. */
function ignoreChange(dir: string, report: CheckedReport): Change | Failure {
  return ignoreAppend(dir, ignoreLines(report), ignoreHeader);
}

/** The .gitignore with those of `wanted` it lacks added at the end, under
 * `header`. Convert (convert.ts) adds its own lines the same way. */
export function ignoreAppend(dir: string, wanted: string[], header: string): Change | Failure {
  const read = readRegularFile(join(dir, '.gitignore'), { follow: false, maxBytes: maxFileBytes });
  if (!read.ok) return read;
  const old = read.file?.text ?? '';
  const lines = missingLines(old, wanted);
  if (lines.length === 0) return { path: '.gitignore', action: 'unchanged' };
  const gap = old === '' ? '' : old.endsWith('\n') ? '\n' : '\n\n';
  const added = `${header}\n${lines.join('\n')}\n`;
  return { path: '.gitignore', action: 'append', text: old + gap + added, diff: lineDiff('', added), mode: read.file?.mode, before: read.file?.text ?? null };
}

/** `node src/<name>-cli.ts` as the `weftwork <name>` command, and
 * `node src/cli.ts` as `weftwork engine` (weftwork-cli.ts). */
export function commandFor(file: string): string {
  return file === 'cli.ts' ? 'weftwork engine' : `weftwork ${file.replace(/-cli\.ts$/, '')}`;
}

/** The skills, with each `node src/<cli>.ts` as a `weftwork` command and each
 * engine doc or the PR template under `$(weftwork path)`, so they work from
 * another repository and from a moved checkout once it is linked again. */
function skillTexts(engineDir: string): { ok: true; files: [string, string][] } | Failure {
  const files: [string, string][] = [];
  for (const name of skillFiles) {
    const read = readRegularFile(join(engineDir, '.claude', 'skills', name), { follow: true, maxBytes: maxFileBytes });
    if (!read.ok) return read;
    if (read.file === null) return { ok: false, error: `the engine has no skill file ${name}` };
    const text = read.file.text
      .replace(/node src\/((?:[\w.-]+-)?cli\.ts)/g, (_, cli: string) => commandFor(cli))
      .replace(/`((?:docs\/[\w.-]+\.md)|\.github\/pull_request_template\.md)`/g, (_, doc: string) => `\`$(weftwork path)/${doc}\``);
    files.push([`.claude/skills/${name}`, text]);
  }
  return { ok: true, files };
}

/** The checkout the `weftwork` command on PATH runs, or null. */
function linkedEngine(): string | null {
  const run = spawnSync('weftwork', ['path'], { encoding: 'utf8', timeout: 10000 });
  return run.status === 0 ? resolve(run.stdout.trim()) : null;
}

/** The git common directory of the repository rooted at `dir`. */
export function gitCommonDir(dir: string): string | null {
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
  if (linkedEngine() !== resolve(options.engineDir)) {
    notes.push(`The skills call the weftwork command, which does not run this engine here. Install it with npm install -g weftwork, or for a checkout run npm link in ${options.engineDir} (docs/GETTING-STARTED.md).`);
  }
  const common = isGitRoot(dir) ? gitCommonDir(dir) : null;
  if (common === null) {
    notes.push(`${dir} is not a git repository root: no backlog and no Stop hook. Run git init and set up again.`);
    return { ok: true, plan: { changes, notes } };
  }
  changes.push(fileChange(dir, join(common, 'weftwork', 'BACKLOG.md'), backlog(answers)));
  const check = preflight(report);
  if (options.stopHook && check === null) notes.push('No Stop hook: no test, lint or typecheck command passed, so there is no Preflight to declare.');
  if (options.stopHook && check !== null) {
    const hook = hookChange(dir, check);
    if ('ok' in hook) return hook;
    changes.push(hook);
  }
  return { ok: true, plan: { changes, notes } };
}

/** .claude/settings.json with the Stop hook declaring `check` and the guard,
 * as the install writes them (claude-install-cli.ts). An existing file that
 * would change is a conflict, like any other file. */
function hookChange(dir: string, check: string): Change | Failure {
  const path = '.claude/settings.json';
  const read = readRegularFile(join(dir, path), { follow: false, maxBytes: maxFileBytes });
  if (!read.ok) return read;
  const stop = installStopHook(read.file?.text ?? null, weftworkOnPath, check);
  if (!stop.ok) return { ok: false, error: `${path}: ${stop.error}` };
  const guard = installGuardHook(stop.text, weftworkOnPath);
  if (!guard.ok) return { ok: false, error: `${path}: ${guard.error}` };
  return fileChange(dir, path, guard.text);
}

/** True when the file at `change.path` no longer holds what the plan saw. */
export function changedSincePlan(dir: string, change: Change): boolean {
  if (change.link !== undefined) {
    try {
      return readlinkSync(absolute(dir, change.path)) !== change.link;
    } catch {
      return true;
    }
  }
  if (change.before === undefined) return false;
  const read = readRegularFile(absolute(dir, change.path), { follow: false, maxBytes: maxFileBytes });
  return !read.ok || (read.file?.text ?? null) !== change.before;
}

/** Write one change. */
function write(dir: string, change: Change): Failure | null {
  const path = absolute(dir, change.path);
  if (!isAbsolute(change.path)) {
    const refusal = pathRefusal(dir, change.path);
    if (refusal !== null) return { ok: false, error: refusal };
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
 * path, after the old file is moved aside; the rest are kept, and so is a file
 * that changed since the plan. */
export function applySetup(dir: string, plan: Plan, options: { overwrite: string[] }): Applied {
  const conflicts = new Set(plan.changes.filter((change) => change.action === 'conflict').map((change) => change.path));
  const stray = options.overwrite.find((path) => !conflicts.has(path));
  if (stray !== undefined) return { ok: false, error: `"overwrite" names ${stray}, which is not a conflict in the plan` };
  const written: string[] = [];
  const kept: string[] = [];
  const record: Written[] = [];
  for (const change of plan.changes) {
    if (change.action === 'unchanged') continue;
    if (changedSincePlan(dir, change)) {
      kept.push(change.path);
      continue;
    }
    if (change.action === 'conflict') {
      if (!options.overwrite.includes(change.path)) {
        kept.push(change.path);
        continue;
      }
      const moved = moveAside(absolute(dir, change.path));
      if (moved !== null) return moved;
    }
    const failed = write(dir, change);
    if (failed !== null) return failed;
    written.push(change.path);
    const link = change.path === 'CLAUDE.md';
    const made = change.action === 'conflict' ? 'overwrite' : change.action === 'append' && typeof change.before === 'string' ? 'append' : 'create';
    record.push({ path: change.path, made, link, before: change.before ?? null, after: link ? 'AGENTS.md' : (change.text ?? '') });
  }
  return { ok: true, written, kept, record };
}
