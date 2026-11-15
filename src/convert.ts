// story: e12s03
// Convert a bigpowers project, the steps of PR #66 made general: tag the last
// commit that tracks specs/, move the files that tracked code or docs cite
// (and the ADRs, which are decisions) into docs/ and rewrite the citations,
// move the rest of specs/ into the gitignored .specs/, and add the open epics
// and stories to the local backlog. The plan is a dry run; apply never deletes,
// only tags and moves, and keeps a file that changed since the plan.
// docs/CONVERT.md.
import { lstatSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { parse } from 'yaml';
import { isGitRoot } from './claude-settings-file.ts';
import { backlogSection, sectionTitle, type BigpowersEpic } from './convert-backlog.ts';
import { isMissing, messageOf, type Failure } from './errors.ts';
import { isRecord } from './json.ts';
import { readRegularFile, writeAtomic } from './regular-file.ts';
import { lineDiff } from './setup-diff.ts';
import { changedSincePlan, gitCommonDir, ignoreAppend, pathRefusal, type Change } from './setup.ts';
import { backlog } from './setup-text.ts';

export type Move = { from: string; to: string };
export type ConvertPlan = { tag: string; moves: Move[]; changes: Change[]; notes: string[] };
export type Converted = { ok: true; tag: string; moved: Move[]; written: string[]; kept: string[] } | Failure;

const maxFileBytes = 1024 * 1024;
/** `specs/<path>` not inside a longer path such as `.specs/` or `my-specs/`. */
const citation = /(?<![\w./-])specs\/([\w./-]*[\w-])/g;
const anyCitation = /(?<![\w./-])specs\//;
/** bigpowers' own plans and state, from specs/: they stay in the local
 * .specs/ even when cited, since what cites them is bigpowers tooling. */
const planOwned = /^(state|execution-status|release-plan|planning-status)\.yaml$|^(epics|metrics|checkpoints|verifications|product|archive|codebase-wiki)\/|_LATEST\.[\w]+$/;

function git(dir: string, args: string[]): { ok: boolean; out: string } {
  const run = spawnSync('git', args, { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { ok: run.status === 0, out: run.stdout ?? '' };
}

function exists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    return !isMissing(error);
  }
}

function readFile(path: string): { text: string; mode: number } | null {
  const read = readRegularFile(path, { follow: false, maxBytes: maxFileBytes });
  return read.ok && read.file !== null ? read.file : null;
}

const readText = (path: string): string | null => readFile(path)?.text ?? null;

function readYaml(path: string, notes: string[]): unknown {
  const text = readText(path);
  if (text === null) return null;
  try {
    return parse(text);
  } catch (error) {
    notes.push(`${path} was not parsed: ${messageOf(error)}`);
    return null;
  }
}

/** Every regular file under specs/, as paths from the project folder. */
function specsFiles(dir: string): string[] {
  return readdirSync(join(dir, 'specs'), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort();
}

/** The open-work inputs: each epic folder outside archive/, and the statuses. */
function readEpics(dir: string, notes: string[]): { epics: BigpowersEpic[]; statuses: Record<string, unknown> } {
  const status = readYaml(join(dir, 'specs', 'execution-status.yaml'), notes);
  const statuses = isRecord(status) && isRecord(status.development_status) ? status.development_status : {};
  const epics: BigpowersEpic[] = [];
  let names: string[] = [];
  try {
    names = readdirSync(join(dir, 'specs', 'epics')).filter((name) => name !== 'archive');
  } catch {
    return { epics, statuses };
  }
  for (const name of names) {
    const epic = readYaml(join(dir, 'specs', 'epics', name, 'epic.yaml'), notes);
    if (!isRecord(epic)) continue;
    const tasks = new Map<string, unknown>();
    for (const story of Array.isArray(epic.stories) ? epic.stories : []) {
      const file = isRecord(story) ? story.tasks : undefined;
      if (typeof file === 'string' && /^[\w.-]+$/.test(file)) tasks.set(file, readYaml(join(dir, 'specs', 'epics', name, file), notes));
    }
    epics.push({ dir: `epics/${name}`, epic, tasks });
  }
  return { epics, statuses };
}

/** `text` with each citation of a moved file pointed at its new path. */
function rewrite(text: string, moved: Map<string, string>): string {
  return text.replace(citation, (match, rest: string) => moved.get(`specs/${rest}`) ?? match);
}

/** The backlog change: create it, append the section, or leave it. */
function backlogChange(path: string, section: string, notes: string[]): Change {
  const read = readRegularFile(path, { follow: false, maxBytes: maxFileBytes });
  if (!read.ok) return { path, action: 'conflict', diff: `(${read.error})` };
  if (read.file === null) {
    const text = `${backlog({ about: '', words: [], never: [], rules: [], tasks: [] })}\n${section}`;
    return { path, action: 'create', text, diff: lineDiff('', text), before: null };
  }
  const old = read.file.text;
  if (old.split('\n').includes(sectionTitle)) {
    notes.push(`${path} already has a "${sectionTitle}" section; it is left as it is.`);
    return { path, action: 'unchanged' };
  }
  const gap = old === '' ? '' : old.endsWith('\n') ? '\n' : '\n\n';
  return { path, action: 'append', text: old + gap + section, diff: lineDiff('', section), mode: read.file.mode, before: old };
}

/** Why `dir` cannot be converted with `tag`, or null. */
function refusal(dir: string, tag: string): string | null {
  if (!isGitRoot(dir)) return `${dir} is not a git repository root`;
  if (!exists(join(dir, 'specs', 'state.yaml'))) return `${dir} has no bigpowers specs/state.yaml`;
  if (pathRefusal(dir, 'specs/state.yaml') !== null || lstatSync(join(dir, 'specs')).isSymbolicLink()) return 'specs is not a plain folder';
  if (!git(dir, ['check-ref-format', `refs/tags/${tag}`]).ok) return `${tag} is not a valid tag name`;
  if (git(dir, ['rev-parse', '-q', '--verify', `refs/tags/${tag}`]).ok) return `the tag ${tag} exists; pass another "tag"`;
  if (!git(dir, ['rev-parse', '-q', '--verify', 'HEAD']).ok) return 'the repository has no commit to tag';
  const status = git(dir, ['status', '--porcelain', '--untracked-files=all', '--', 'specs']);
  if (!status.ok || status.out !== '') return 'specs/ has uncommitted changes; commit them first, so the tag holds them';
  if (exists(join(dir, '.specs'))) return '.specs exists; move it before converting';
  return null;
}

/** The plan for converting the bigpowers project in `dir`. Writes nothing. */
export function planConvert(dir: string, options: { tag: string }): { ok: true; plan: ConvertPlan } | Failure {
  const refused = refusal(dir, options.tag);
  if (refused !== null) return { ok: false, error: refused };
  const notes: string[] = [];
  const files = specsFiles(dir);
  const known = new Set(files);
  const tracked = git(dir, ['ls-files', '-z']).out.split('\0').filter((path) => path !== '' && !path.startsWith('specs/'));
  const texts = new Map<string, { text: string; mode: number }>();
  let skipped = 0;
  const cited = new Set(files.filter((path) => path.startsWith('specs/adr/')));
  for (const path of tracked) {
    const file = readFile(join(dir, path));
    if (file === null) skipped++;
    else texts.set(path, file);
    for (const match of (file?.text ?? '').matchAll(citation)) {
      if (known.has(`specs/${match[1]}`) && !planOwned.test(match[1])) cited.add(`specs/${match[1]}`);
    }
  }
  if (skipped > 0) notes.push(`${skipped} tracked files were not scanned for citations: not a regular UTF-8 file of at most 1 MiB.`);
  const moved = new Map([...cited].sort().map((from) => [from, `docs/${from.slice('specs/'.length)}`]));
  for (const to of moved.values()) {
    if (exists(join(dir, to))) return { ok: false, error: `${to} exists; a cited spec file would move onto it` };
    const bad = pathRefusal(dir, to);
    if (bad !== null) return { ok: false, error: bad };
  }
  const changes: Change[] = [];
  const edit = (path: string, file: { text: string; mode: number } | null): void => {
    const before = file?.text ?? '';
    const after = rewrite(before, moved);
    if (after !== before) changes.push({ path, action: 'rewrite', text: after, diff: lineDiff(before, after), mode: file?.mode, before });
    if (anyCitation.test(after)) notes.push(`${path} still names specs/: check it, and drop it if it serves only bigpowers.`);
  };
  for (const [path, file] of texts) edit(path, file);
  for (const [from, to] of moved) edit(to, readFile(join(dir, from)));
  const ignore = ignoreAppend(dir, ['.specs/'], '# Added by weftwork convert: the old bigpowers plans, local only.');
  if ('ok' in ignore) return ignore;
  changes.push(ignore);
  const common = gitCommonDir(dir);
  if (common === null) return { ok: false, error: 'the git common directory was not found' };
  const { epics, statuses } = readEpics(dir, notes);
  changes.push(backlogChange(join(common, 'weftwork', 'BACKLOG.md'), backlogSection(epics, statuses, options.tag), notes));
  const moves = [...[...moved].map(([from, to]) => ({ from, to })), { from: 'specs', to: '.specs' }];
  return { ok: true, plan: { tag: options.tag, moves, changes, notes } };
}

/** Move `from` to `to` (from `dir`), never onto something that exists. */
function move(dir: string, { from, to }: Move): Failure | null {
  if (exists(join(dir, to))) return { ok: false, error: `${to} exists; nothing more was moved` };
  try {
    mkdirSync(dirname(join(dir, to)), { recursive: true });
    renameSync(join(dir, from), join(dir, to));
    return null;
  } catch (error) {
    return { ok: false, error: `${from} could not be moved to ${to}: ${messageOf(error)}` };
  }
}

/** Apply `plan` to `dir`: tag HEAD, move the cited files, write the changes
 * (keeping any file changed since the plan), then move specs/ to .specs/. */
export function applyConvert(dir: string, plan: ConvertPlan): Converted {
  const refused = refusal(dir, plan.tag);
  if (refused !== null) return { ok: false, error: refused };
  if (!git(dir, ['tag', plan.tag, 'HEAD']).ok) return { ok: false, error: `the tag ${plan.tag} could not be made` };
  const moved: Move[] = [];
  const written: string[] = [];
  const kept: string[] = [];
  const last = plan.moves.at(-1);
  for (const step of plan.moves.slice(0, -1)) {
    const failed = move(dir, step);
    if (failed !== null) return failed;
    moved.push(step);
  }
  for (const change of plan.changes) {
    if (change.action === 'unchanged' || change.action === 'conflict') continue;
    if (changedSincePlan(dir, change)) {
      kept.push(change.path);
      continue;
    }
    const failed = writeAtomic(isAbsolute(change.path) ? change.path : join(dir, change.path), change.text ?? '', change.mode);
    if (failed !== null) return failed;
    written.push(change.path);
  }
  if (last !== undefined) {
    const failed = move(dir, last);
    if (failed !== null) return failed;
    moved.push(last);
  }
  return { ok: true, tag: plan.tag, moved, written, kept };
}
