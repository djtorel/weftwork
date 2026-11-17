// story: B8
// The file-overlap check before parallel work (docs/PARALLEL.md, R6): each
// planned task names the files it will change, as paths, folders (a trailing
// `/`) or globs, or as a git branch whose changed files are read with
// `git diff --name-only <merge base>..<branch>`. Two tasks overlap when an
// entry of one can name a file that an entry of the other names. The check
// is conservative: a pair it reports may not conflict, but two entries that
// can name the same file are always reported (globs: see globsMeet).
import { posix } from 'node:path';
import { messageOf } from '../shared/errors.ts';
import { isRecord } from '../shared/json.ts';
import { strictUtf8 } from '../shared/regular-file.ts';
import { gitOutput } from '../engine/tree.ts';

/** A task as planned: its files, or the branch that holds its change. */
export type PlannedTask = { name: string; files: string[] } | { name: string; branch: string };

/** A task with its files known. `literal` files are paths, never globs (a
 * branch's changed files: a file may be named `a[1].ts`). */
export type ResolvedTask = { name: string; files: string[]; literal?: boolean };

/** Two tasks that overlap, and each pair of their entries that does. */
export type OverlapPair = { tasks: [string, string]; files: [string, string][] };

type Failure = { ok: false; error: string };

type Entry =
  | { kind: 'file'; text: string; path: string }
  | { kind: 'glob'; text: string; pattern: string; prefix: string; suffix: string };

// Extended globs (`+(a|b)`) count too: posix.matchesGlob takes them (review r1s1).
const globChar = /[*?[\]{}()]/;

/** `path` as one form: no `./`, no doubled `/`; a trailing `/` (a folder)
 * kept. Null when it leaves the project (absolute, `..`) or names its root. */
function normalized(path: string): string | null {
  const text = posix.normalize(path);
  if (text.startsWith('/') || text === '..' || text.startsWith('../') || text === '.' || text === './') return null;
  return text.startsWith('./') ? text.slice(2) : text;
}

/** The folder part of a glob before its first glob segment, and the fixed
 * end of its last segment, which every file it matches ends with. */
function toEntry(text: string, literal: boolean): Entry {
  const folder = text.endsWith('/');
  if (literal || (!folder && !globChar.test(text))) return { kind: 'file', text, path: text };
  // A folder is the glob `<folder>/**`: everything below it.
  const pattern = folder ? `${text}**` : text;
  const segments = pattern.split('/');
  const first = segments.findIndex((segment) => globChar.test(segment));
  const last = segments.at(-1) ?? '';
  const end = Math.max(...[...'*?]})'].map((char) => last.lastIndexOf(char)));
  return { kind: 'glob', text, pattern, prefix: segments.slice(0, first).join('/'), suffix: last.slice(end + 1) };
}

/** True when `inner` is `outer` or below it; every path is below the root ''. */
function within(inner: string, outer: string): boolean {
  return outer === '' || inner === outer || inner.startsWith(`${outer}/`);
}

/** A name's leading dot as `_`, so a wildcard matches it. */
const undotted = (text: string) => text.replace(/(^|\/)\./g, '$1_');

/** posix.matchesGlob, where `*` and `**` also match a name that starts with
 * a dot: a task that changes `**\/*.yml` can change `.github/ci.yml`. A dot
 * the pattern names is changed with the path's, so `.github/**` still
 * matches `.github/.config` (review r1m1). */
function globMatches(path: string, pattern: string): boolean {
  return posix.matchesGlob(path, pattern) || posix.matchesGlob(undotted(path), undotted(pattern));
}

/** Two globs can name one file only when their fixed folders nest and the
 * fixed end of one last segment ends with the other's (`*.ts` and `*.md`
 * cannot meet). A glob names files; one that names a folder may be missed. */
function globsMeet(a: Entry & { kind: 'glob' }, b: Entry & { kind: 'glob' }): boolean {
  const nest = within(a.prefix, b.prefix) || within(b.prefix, a.prefix);
  return nest && (a.suffix.endsWith(b.suffix) || b.suffix.endsWith(a.suffix));
}

/** A file and a glob meet when the glob matches it, or the glob reaches
 * inside it (then it is a folder). */
function fileMeetsGlob(file: string, glob: Entry & { kind: 'glob' }): boolean {
  return globMatches(file, glob.pattern) || (glob.prefix !== '' && within(glob.prefix, file));
}

function meet(a: Entry, b: Entry): boolean {
  if (a.kind === 'file' && b.kind === 'file') return within(a.path, b.path) || within(b.path, a.path);
  if (a.kind === 'file' && b.kind === 'glob') return fileMeetsGlob(a.path, b);
  if (a.kind === 'glob' && b.kind === 'file') return fileMeetsGlob(b.path, a);
  return globsMeet(a as Entry & { kind: 'glob' }, b as Entry & { kind: 'glob' });
}

function entriesOf(task: ResolvedTask): Entry[] {
  const texts = new Set(task.files.flatMap((file) => normalized(file) ?? []));
  return [...texts].map((text) => toEntry(text, task.literal === true));
}

/** Every pair of tasks whose entries overlap, in task order. */
export function findOverlaps(tasks: ResolvedTask[]): OverlapPair[] {
  const entries = tasks.map(entriesOf);
  const pairs: OverlapPair[] = [];
  for (let i = 0; i < tasks.length; i += 1) {
    for (let j = i + 1; j < tasks.length; j += 1) {
      const files = entries[i]!.flatMap((a) => entries[j]!.filter((b) => meet(a, b)).map((b): [string, string] => [a.text, b.text]));
      if (files.length > 0) pairs.push({ tasks: [tasks[i]!.name, tasks[j]!.name], files });
    }
  }
  return pairs;
}

/** Why `value` is not a list of paths and globs, or null. */
function badFiles(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return 'must be a non-empty array';
  for (const file of value) {
    if (typeof file !== 'string' || file === '' || file.includes('\0')) return 'must hold non-empty strings';
    if (file.startsWith('!')) return `holds a negated glob, which the check does not take: ${file}`;
    if (normalized(file) === null) return `holds a path outside the project or its root: ${file}`;
  }
  return null;
}

/** The tasks and base in a request, or why it is not one. `base` (default
 * HEAD) is where a branch task's merge base is taken from. */
export function toPlannedTasks(input: Record<string, unknown>): { ok: true; tasks: PlannedTask[]; base: string } | Failure {
  const { tasks, base = 'HEAD' } = input;
  if (typeof base !== 'string' || base === '' || base.startsWith('-')) return { ok: false, error: '"base" must be a git revision' };
  if (!Array.isArray(tasks) || tasks.length < 2) return { ok: false, error: '"tasks" must be an array of two or more tasks' };
  const planned: PlannedTask[] = [];
  const names = new Set<string>();
  for (const [index, task] of tasks.entries()) {
    const at = `tasks[${index}]`;
    if (!isRecord(task)) return { ok: false, error: `${at} must be an object` };
    const { name, files, branch } = task;
    if (typeof name !== 'string' || name.trim() === '') return { ok: false, error: `${at}.name must be a non-empty string` };
    if (names.has(name)) return { ok: false, error: `${at}.name repeats "${name}"` };
    names.add(name);
    if ((files === undefined) === (branch === undefined)) return { ok: false, error: `${at} must have "files" or "branch", not both` };
    if (branch !== undefined) {
      if (typeof branch !== 'string' || branch === '' || branch.startsWith('-') || branch.includes('\0')) {
        return { ok: false, error: `${at}.branch must be a git branch` };
      }
      planned.push({ name, branch });
      continue;
    }
    const bad = badFiles(files);
    if (bad !== null) return { ok: false, error: `${at}.files ${bad}` };
    planned.push({ name, files: files as string[] });
  }
  return { ok: true, tasks: planned, base };
}

/** The files `branch` changed since its merge base with `base`. */
async function branchFiles(cwd: string, branch: string, base: string): Promise<{ ok: true; files: string[] } | Failure> {
  try {
    const mergeBase = (await gitOutput(cwd, ['merge-base', '--end-of-options', base, branch])).toString().trim();
    const diff = await gitOutput(cwd, ['diff', '--name-only', '-z', '--no-renames', `${mergeBase}..${branch}`, '--']);
    const text = strictUtf8(diff);
    if (text === null) return { ok: false, error: `a file ${branch} changed is not named in UTF-8` };
    return { ok: true, files: text.split('\0').filter((file) => file !== '') };
  } catch (error) {
    return { ok: false, error: `the files of branch ${branch} cannot be read: ${messageOf(error)}` };
  }
}

/** Each task with its files: a branch task's from git, run in `cwd`. */
export async function resolveTasks(cwd: string, tasks: PlannedTask[], base: string): Promise<{ ok: true; tasks: ResolvedTask[] } | Failure> {
  const resolved: ResolvedTask[] = [];
  for (const task of tasks) {
    if ('files' in task) {
      resolved.push(task);
      continue;
    }
    const read = await branchFiles(cwd, task.branch, base);
    if (!read.ok) return read;
    resolved.push({ name: task.name, files: read.files, literal: true });
  }
  return { ok: true, tasks: resolved };
}
