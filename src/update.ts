// `weftwork update`: bring the skills of a project that weftwork set up to
// this version. A skill file that holds a text weftwork shipped
// (skill-hashes.ts) is replaced in place, since the owner did not change it; a
// file the owner changed is kept; a skill this version adds is created; a
// skill folder from before the rename is deleted when it holds only a text
// weftwork shipped. It plans first and writes nothing until applied. AGENTS.md,
// CONVENTIONS.md and the backlog are the owner's and never touched; the hooks
// run `weftwork` from PATH, so an upgrade of the command updates them.
// update-cli.ts is the thin shell. docs/SETUP.md § Update.
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isMissing, messageOf, type Failure } from './errors.ts';
import { readRegularFile, writeAtomic } from './regular-file.ts';
import { oldSkillFolders, pathRefusal, skillTexts } from './setup.ts';
import { lineDiff } from './setup-diff.ts';
import { shippedSkillTexts } from './skill-hashes.ts';

/** `update` and `create` write, `delete` removes; `edited` and `keep-old` are
 * the owner's and kept. */
export type UpdateAction = 'unchanged' | 'update' | 'create' | 'edited' | 'delete' | 'keep-old';

/** One planned change. `before` is the file's text when planned (null: no
 * file), so a file changed since the plan is kept, not written. */
export type UpdateChange = { path: string; action: UpdateAction; text?: string; diff?: string; mode?: number; before?: string | null };
export type UpdatePlan = { changes: UpdateChange[] };
export type Shipped = Readonly<Record<string, readonly string[]>>;
export type Updated = { ok: true; written: string[]; deleted: string[]; kept: string[] } | Failure;

const maxFileBytes = 1024 * 1024;
const skillsDir = '.claude/skills';

export const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

/** The change that brings the skill file at `path` to `text`. */
function skillChange(dir: string, path: string, text: string, shipped: Shipped): UpdateChange {
  const read = readRegularFile(join(dir, path), { follow: false, maxBytes: maxFileBytes });
  if (!read.ok) return { path, action: 'edited', diff: `(${read.error})` };
  if (read.file === null) return { path, action: 'create', text, diff: '(new in this version)', before: null };
  if (read.file.text === text) return { path, action: 'unchanged' };
  const diff = lineDiff(read.file.text, text);
  const name = path.slice(skillsDir.length + 1);
  if (!shipped[name]?.includes(sha256(read.file.text))) return { path, action: 'edited', diff };
  return { path, action: 'update', text, diff, mode: read.file.mode, before: read.file.text };
}

/** The change for a skill folder from before the rename, or null when it is
 * not there: deleted when it holds only a SKILL.md that weftwork shipped. */
function oldFolderChange(dir: string, folder: string, shipped: Shipped): UpdateChange | null {
  const path = `${skillsDir}/${folder}`;
  const keep = (why: string): UpdateChange => ({ path, action: 'keep-old', diff: `(${why})` });
  try {
    const stat = lstatSync(join(dir, path));
    if (stat.isSymbolicLink() || !stat.isDirectory()) return keep('not a plain folder');
    const names = readdirSync(join(dir, path));
    if (names.length !== 1 || names[0] !== 'SKILL.md') return keep('it holds other files');
  } catch (error) {
    return isMissing(error) ? null : keep(messageOf(error));
  }
  const file = `${path}/SKILL.md`;
  const read = readRegularFile(join(dir, file), { follow: false, maxBytes: maxFileBytes });
  if (!read.ok || read.file === null) return keep('its SKILL.md is not a regular file');
  if (!shipped[`${folder}/SKILL.md`]?.includes(sha256(read.file.text))) return keep('you changed it');
  return { path: file, action: 'delete', diff: '(an old name; it holds only a text weftwork shipped)', before: read.file.text };
}

/** The plan for updating the skills of the project in `dir`. Writes nothing. */
export function planUpdate(dir: string, engineDir: string, shipped: Shipped = shippedSkillTexts): { ok: true; plan: UpdatePlan } | Failure {
  const skills = skillTexts(engineDir);
  if (!skills.ok) return skills;
  const changes: UpdateChange[] = [];
  for (const [path, text] of skills.files) {
    const refusal = pathRefusal(dir, path);
    if (refusal !== null) return { ok: false, error: refusal };
    changes.push(skillChange(dir, path, text, shipped));
  }
  for (const folder of oldSkillFolders) {
    const change = oldFolderChange(dir, folder, shipped);
    if (change !== null) changes.push(change);
  }
  if (changes.every((change) => change.action === 'create')) {
    return { ok: false, error: `${dir} has no weftwork skills in ${skillsDir}; set it up with weftwork init` };
  }
  return { ok: true, plan: { changes } };
}

/** How many changes of `plan` write or delete: 0 when the skills are up to date. */
export function behind(plan: UpdatePlan): number {
  return plan.changes.filter((change) => change.action === 'update' || change.action === 'create' || change.action === 'delete').length;
}

/** True when the file at `change.path` still holds what the plan saw, and,
 * for a delete, its folder still holds nothing else (review r1m1). */
function unchangedSincePlan(dir: string, change: UpdateChange): boolean {
  const read = readRegularFile(join(dir, change.path), { follow: false, maxBytes: maxFileBytes });
  if (!read.ok || (read.file?.text ?? null) !== change.before) return false;
  if (change.action !== 'delete') return true;
  try {
    const names = readdirSync(dirname(join(dir, change.path)));
    return names.length === 1 && names[0] === 'SKILL.md';
  } catch {
    return false;
  }
}

/** Apply `plan` to `dir`. A file that changed since the plan is kept. */
export function applyUpdate(dir: string, plan: UpdatePlan): Updated {
  const written: string[] = [];
  const deleted: string[] = [];
  const kept: string[] = [];
  for (const change of plan.changes) {
    if (change.action !== 'update' && change.action !== 'create' && change.action !== 'delete') continue;
    const refusal = pathRefusal(dir, change.path);
    if (refusal !== null) return { ok: false, error: refusal };
    if (!unchangedSincePlan(dir, change)) {
      kept.push(change.path);
      continue;
    }
    const path = join(dir, change.path);
    if (change.action !== 'delete') {
      const failed = writeAtomic(path, change.text ?? '', change.mode);
      if (failed !== null) return failed;
      written.push(change.path);
      continue;
    }
    try {
      unlinkSync(path);
    } catch (error) {
      return { ok: false, error: `${change.path} could not be deleted: ${messageOf(error)}` };
    }
    deleted.push(change.path);
    try {
      rmdirSync(dirname(path));
    } catch {
      // Not empty, or gone: the folder stays as it is.
    }
  }
  return { ok: true, written, deleted, kept };
}

/** The plan as text: each change that writes, deletes or is kept, with its
 * diff indented. */
export function renderUpdate(dir: string, plan: UpdatePlan): string {
  const hints: Partial<Record<UpdateAction, (path: string) => string>> = {
    edited: (path) => `  (kept: you changed it; weftwork init --overwrite ${path} replaces it)`,
    'keep-old': () => '  (kept: delete it by hand when you no longer need it)',
  };
  const lines = [`Update for ${dir}:`, ''];
  for (const change of plan.changes) {
    if (change.action === 'unchanged') continue;
    lines.push(`  ${change.action.padEnd(9)} ${change.path}${hints[change.action]?.(change.path) ?? ''}`);
    for (const line of (change.diff ?? '').split('\n').filter((text) => text !== '')) lines.push(`    ${line}`);
  }
  return `${lines.join('\n')}\n`;
}
