// story: e12s03, e12s03b, e12s03c
// Convert a bigpowers, GSD (1 or 2), spec-kit or BMAD (v6 or v4) project, the steps of PR #66 made general: tag
// the last commit that tracks the plans folder (specs/ or .planning/), move
// the files that tracked code or docs cite (and bigpowers' ADRs, which are
// decisions) into docs/ and rewrite the citations, move the rest into a
// gitignored local folder, and add the open work to the local backlog. The
// plan is a dry run; apply never deletes, only tags and moves, and keeps a
// file that changed since the plan. In a linked worktree, which is deleted
// after its pull request, it copies the local folder to the main checkout too.
// docs/CONVERT.md.
import { cpSync, lstatSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { parse } from 'yaml';
import { isGitRoot } from '../claude/claude-settings-file.ts';
import { backlogSection, sectionTitle, type BigpowersEpic } from './convert-backlog.ts';
import { gsdSection, gsdSectionTitle } from './convert-gsd.ts';
import { gsd2Section, gsd2SectionTitle } from './convert-gsd2.ts';
import { speckitLocal, speckitSection, speckitSectionTitle } from './convert-speckit.ts';
import { bmadLocal, bmadSection, bmadSectionTitle, bmadV4Local, bmadV4Section, bmadV4SectionTitle } from './convert-bmad.ts';
import { idsIn } from './convert-order.ts';
import { isMissing, messageOf, type Failure } from '../shared/errors.ts';
import { isRecord } from '../shared/json.ts';
import { readRegularFile, writeAtomic } from '../shared/regular-file.ts';
import { lineDiff } from '../setup/setup-diff.ts';
import { changedSincePlan, gitCommonDir, ignoreAppend, pathRefusal, type Change } from '../setup/setup.ts';
import { backlog } from '../setup/setup-text.ts';

export type Move = { from: string; to: string };
export type SystemName = 'bigpowers' | 'gsd' | 'gsd2' | 'spec-kit' | 'bmad' | 'bmad-v4';
/** `copy`: the absolute path in the main checkout that gets a copy of the
 * local folder, or null. */
export type ConvertPlan = { system: SystemName; tag: string; moves: Move[]; changes: Change[]; notes: string[]; copy: string | null };
export type Converted = { ok: true; tag: string; moved: Move[]; written: string[]; kept: string[]; copied: string | null } | Failure;

const maxFileBytes = 1024 * 1024;

/** What differs between planning systems. `planOwned` matches the system's
 * own plans and state (from inside `root`): they stay in `local` even when
 * cited, since what cites them is the old system's tooling. */
type System = {
  name: string;
  root: string;
  marker: string;
  local: string;
  planOwned: RegExp;
  alwaysMove: string;
  title: string;
  /** The section; `where` is where the old plans are after the conversion. */
  section: (dir: string, tag: string, notes: string[], where: string) => string;
  /** True when a plans folder git does not track is converted to the backlog
   * only: no tag, no move (GSD 2 ignores .gsd/ by default). */
  untrackedRoot?: boolean;
  /** Why this project's layout cannot be converted, or null. */
  layoutRefusal?: (dir: string) => string | null;
};

const systems: Record<SystemName, System> = {
  bigpowers: {
    name: 'bigpowers',
    root: 'specs',
    marker: 'specs/state.yaml',
    local: '.specs',
    planOwned: /^(state|execution-status|release-plan|planning-status)\.yaml$|^(epics|metrics|checkpoints|verifications|product|archive|codebase-wiki)\/|_LATEST\.[\w]+$/,
    alwaysMove: 'specs/adr/',
    title: sectionTitle,
    section: (dir, tag, notes) => {
      const { epics, statuses } = readEpics(dir, notes);
      return backlogSection(epics, statuses, tag, notes, idsIn(readYaml(join(dir, 'specs', 'release-plan.yaml'), notes), 'epics'));
    },
  },
  gsd: {
    name: 'GSD',
    root: '.planning',
    marker: '.planning',
    local: '.gsd-planning',
    planOwned: /^(PROJECT|REQUIREMENTS|ROADMAP|STATE|MILESTONES|RETROSPECTIVE)\.md$|^config\.json$|^(phases|milestones|quick|todos|debug|seeds|threads|forensics|reports)\//,
    alwaysMove: '',
    title: gsdSectionTitle,
    section: (dir, tag, notes) => {
      for (const name of ['PROJECT.md', 'STATE.md']) {
        const found = /^#{2,3} ((Key )?Decisions)\b/m.exec(readText(join(dir, '.planning', name)) ?? '');
        if (found !== null) notes.push(`.planning/${name} has a "${found[1]}" section; carry the decisions still in force into AGENTS.md or docs/.`);
      }
      const folders = namesIn(join(dir, '.planning', 'phases')).sort();
      const files = folders.flatMap((folder) => namesIn(join(dir, '.planning', 'phases', folder)).map((name) => `${folder}/${name}`));
      const plans: Record<string, string> = {};
      for (const path of files.filter((each) => each.endsWith('-PLAN.md'))) {
        const text = readText(join(dir, '.planning', 'phases', path));
        if (text !== null) plans[path] = text;
      }
      return gsdSection(readText(join(dir, '.planning', 'ROADMAP.md')), folders, tag, files, plans);
    },
  },
  gsd2: {
    name: 'GSD 2',
    root: '.gsd',
    marker: '.gsd',
    local: '.gsd2-plans',
    // .gsd/ is GSD 2's own: rendered from its database, so all of it stays.
    planOwned: /^/,
    alwaysMove: '',
    title: gsd2SectionTitle,
    untrackedRoot: true,
    section: (dir, tag, notes, where) => {
      for (const name of ['DECISIONS.md', 'KNOWLEDGE.md']) {
        if (exists(join(dir, '.gsd', name))) notes.push(`.gsd/${name} holds GSD 2's ${name === 'DECISIONS.md' ? 'decisions' : 'project knowledge'}; carry what is still in force into AGENTS.md or docs/.`);
      }
      const base = join(dir, '.gsd', 'milestones');
      const milestones = namesIn(base)
        .filter((name) => /^M\d+/.test(name) && isFolder(join(base, name)))
        .map((name) => {
          const files = namesIn(join(base, name));
          const roadmap = files.find((file) => /^M\d+.*-ROADMAP\.md$/.test(file));
          const slicesDir = join(base, name, 'slices');
          const slices = namesIn(slicesDir)
            .filter((slice) => /^S\d+/.test(slice) && isFolder(join(slicesDir, slice)))
            .map((slice) => {
              const plan = namesIn(join(slicesDir, slice)).find((file) => /^S\d+.*-PLAN\.md$/.test(file));
              const doneTasks = namesIn(join(slicesDir, slice, 'tasks')).flatMap((file) => /^(T\d+).*-SUMMARY\.md$/.exec(file)?.[1] ?? []);
              return { dir: slice, plan: plan === undefined ? null : readText(join(slicesDir, slice, plan)), doneTasks };
            });
          return { dir: name, roadmap: roadmap === undefined ? null : readText(join(base, name, roadmap)), summary: files.some((file) => /^M\d+.*-SUMMARY\.md$/.test(file)), slices };
        });
      return gsd2Section(milestones, tag, where, idsIn(readJson(join(dir, '.gsd', 'QUEUE-ORDER.json'), notes), 'order'));
    },
  },
  'spec-kit': {
    name: 'spec-kit',
    root: 'specs',
    marker: '.specify',
    local: speckitLocal,
    // Each feature's own spec, plan, tasks and checklists; a cited contract,
    // data model or research file moves to docs/.
    planOwned: /^[^/]+\/(spec|plan|tasks|quickstart)\.md$|^[^/]+\/checklists\//,
    alwaysMove: '',
    title: speckitSectionTitle,
    section: (dir, tag, notes) => {
      if (exists(join(dir, '.specify', 'memory', 'constitution.md'))) {
        notes.push('.specify/memory/constitution.md holds the project principles; carry those still in force into AGENTS.md or CONVENTIONS.md.');
      }
      notes.push(".specify/ stays tracked: spec-kit's templates, scripts and memory. Drop it, and the agent commands that run spec-kit, once nothing else calls them.");
      const features = namesIn(join(dir, 'specs'))
        .filter((name) => isFolder(join(dir, 'specs', name)))
        .map((name) => ({ dir: name, spec: readText(join(dir, 'specs', name, 'spec.md')), tasks: readText(join(dir, 'specs', name, 'tasks.md')) }));
      return speckitSection(features, tag);
    },
  },
  bmad: {
    name: 'BMAD',
    root: '_bmad-output',
    marker: '_bmad',
    local: bmadLocal,
    // The sprint, the stories and the epics; a cited PRD, architecture or UX
    // document moves to docs/.
    planOwned: /^implementation-artifacts\/|^planning-artifacts\/epics[^/]*\.md$|^planning-artifacts\/epics\//,
    alwaysMove: '',
    title: bmadSectionTitle,
    section: (dir, tag, notes) => {
      notes.push('_bmad/ stays tracked: the installed BMAD modules and their config. Drop it, and the agent commands that run BMAD, once nothing else calls them.');
      const planning = join(dir, '_bmad-output', 'planning-artifacts');
      const implementation = join(dir, '_bmad-output', 'implementation-artifacts');
      const epicFiles = [
        ...namesIn(planning).filter((name) => /^epics?\b.*\.md$/i.test(name)).map((name) => join(planning, name)),
        ...namesIn(join(planning, 'epics')).filter((name) => name.endsWith('.md')).map((name) => join(planning, 'epics', name)),
      ].sort();
      const epics = epicFiles.map(readText).filter((text): text is string => text !== null);
      const status = readYaml(join(implementation, 'sprint-status.yaml'), notes);
      return bmadSection({ status, epics, storyFiles: namesIn(implementation) }, tag, notes);
    },
    layoutRefusal: (dir) =>
      namesIn(join(dir, '_bmad-output')).some((name) => /^initiative-/.test(name)) || exists(join(dir, '_bmad-output', 'backlog'))
        ? "_bmad-output/ uses BMAD's ticket tree (tickets.toml), which is not converted yet; only the v6 sprint layout is"
        : null,
  },
  'bmad-v4': {
    name: 'BMAD v4',
    // The default; systemFor reads devStoryLocation from core-config.yaml.
    root: 'docs/stories',
    marker: '.bmad-core',
    local: bmadV4Local,
    // Every story file is BMAD's own; the PRD and architecture are in docs/
    // already and stay there.
    planOwned: /^/,
    alwaysMove: '',
    title: bmadV4SectionTitle,
    section: (dir, tag, notes) => {
      notes.push('.bmad-core/ stays tracked: the installed BMAD v4 agents, tasks, templates and core-config.yaml. Drop it, and the agent commands that run BMAD, once nothing else calls them.');
      const config = bmadV4Config(dir);
      if (!config.ok) return bmadV4Section({ epics: [], stories: {}, prd: '' }, tag, notes);
      notes.push(`${config.prd} stays in place: it is a document, not a plan.`);
      const stories: Record<string, string> = {};
      for (const name of namesIn(join(dir, config.stories))) {
        const text = readText(join(dir, config.stories, name));
        if (text !== null) stories[name] = text;
      }
      const epics = config.epicFiles.map((path) => (pathRefusal(dir, path) === null ? readText(join(dir, path)) : null)).filter((text): text is string => text !== null);
      return bmadV4Section({ epics, stories, prd: config.prd }, tag, notes);
    },
    layoutRefusal: (dir) => {
      const config = bmadV4Config(dir);
      return config.ok ? null : config.error;
    },
  },
};

/** A plain relative path inside the project: no `.` or `..` part. */
const plainPath = (value: unknown): value is string =>
  typeof value === 'string' && /^[\w.-]+(\/[\w.-]+)*$/.test(value) && !value.split('/').some((part) => part === '.' || part === '..');

type BmadV4Config = { ok: true; stories: string; prd: string; epicFiles: string[] } | Failure;

/** The story folder and the PRD's epic files of a BMAD v4 project, from
 * .bmad-core/core-config.yaml (v4.44.3), with its defaults for a key it
 * does not set: the sharded epics (prdShardedLocation, epicFilePattern)
 * when prdSharded is not false and any exist, else prdFile. */
function bmadV4Config(dir: string): BmadV4Config {
  const problems: string[] = [];
  const config = readYaml(join(dir, '.bmad-core', 'core-config.yaml'), problems);
  if (problems.length > 0) return { ok: false, error: problems[0] };
  const top = isRecord(config) ? config : {};
  const prd = isRecord(top.prd) ? top.prd : {};
  const values = {
    devStoryLocation: top.devStoryLocation ?? 'docs/stories',
    prdFile: prd.prdFile ?? 'docs/prd.md',
    prdShardedLocation: prd.prdShardedLocation ?? 'docs/prd',
  };
  for (const [key, value] of Object.entries(values)) {
    if (!plainPath(value)) return { ok: false, error: `.bmad-core/core-config.yaml: ${key} ${JSON.stringify(value)} is not a plain path inside the project` };
  }
  const pattern = typeof prd.epicFilePattern === 'string' ? prd.epicFilePattern : 'epic-{n}*.md';
  const epicFile = new RegExp(`^${escaped(pattern).replace(/\\\*/g, '.*').replace(/\\\{n\\\}/g, '\\d+')}$`);
  const shard = values.prdShardedLocation as string;
  const shards = prd.prdSharded === false ? [] : namesIn(join(dir, shard)).filter((name) => epicFile.test(name)).sort().map((name) => `${shard}/${name}`);
  const prdFile = values.prdFile as string;
  return { ok: true, stories: values.devStoryLocation as string, prd: shards.length > 0 ? `${shard}/` : prdFile, epicFiles: shards.length > 0 ? shards : [prdFile] };
}

/** `name`'s system for the project in `dir`: BMAD v4's plans folder is its
 * devStoryLocation. */
function systemFor(dir: string, name: SystemName): System {
  const system = systems[name];
  if (name !== 'bmad-v4') return system;
  const config = bmadV4Config(dir);
  return config.ok ? { ...system, root: config.stories } : system;
}

function isFolder(path: string): boolean {
  try {
    return lstatSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** The names in folder `path`; none when it is missing or not a folder
 * (no phases folder: every phase links to ROADMAP.md). */
function namesIn(path: string): string[] {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** `<root>/<path>` not inside a longer path such as `.specs/` or `my-specs/`. */
const citationOf = (root: string): RegExp => new RegExp(`(?<![\\w./-])${escaped(root)}/([\\w./-]*[\\w-])`, 'g');
const anyCitationOf = (root: string): RegExp => new RegExp(`(?<![\\w./-])${escaped(root)}/`);

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

function readJson(path: string, notes: string[]): unknown {
  const text = readText(path);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    notes.push(`${path} was not parsed: ${messageOf(error)}`);
    return null;
  }
}

/** Every regular file under `root`, as paths from the project folder. */
function planFiles(dir: string, root: string): string[] {
  return readdirSync(join(dir, root), { recursive: true, withFileTypes: true })
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
function rewrite(text: string, moved: Map<string, string>, root: string): string {
  return text.replace(citationOf(root), (match, rest: string) => moved.get(`${root}/${rest}`) ?? match);
}

/** The backlog change: create it, append the section, or leave it. */
function backlogChange(path: string, section: string, title: string, notes: string[]): Change {
  const read = readRegularFile(path, { follow: false, maxBytes: maxFileBytes });
  if (!read.ok) return { path, action: 'conflict', diff: `(${read.error})` };
  if (read.file === null) {
    const text = `${backlog({ about: '', words: [], never: [], rules: [], tasks: [] })}\n${section}`;
    return { path, action: 'create', text, diff: lineDiff('', text), before: null };
  }
  const old = read.file.text;
  if (old.split('\n').includes(title)) {
    notes.push(`${path} already has a "${title}" section; it is left as it is.`);
    return { path, action: 'unchanged' };
  }
  const gap = old === '' ? '' : old.endsWith('\n') ? '\n' : '\n\n';
  return { path, action: 'append', text: old + gap + section, diff: lineDiff('', section), mode: read.file.mode, before: old };
}

/** The systems whose marker is in `dir`. */
export function systemsIn(dir: string): SystemName[] {
  return (Object.keys(systems) as SystemName[]).filter((name) => exists(join(dir, systems[name].marker)));
}

/** True when `system` converts `dir` to the backlog only: its plans folder
 * holds no file git tracks. */
function isBacklogOnly(dir: string, system: System): boolean {
  return system.untrackedRoot === true && git(dir, ['ls-files', '--', system.root]).out === '';
}

/** The main checkout of the repository when `dir` is a linked worktree; null
 * in the main checkout itself. `bare` when the repository has none. */
function mainCheckout(dir: string): string | null | 'bare' {
  const common = gitCommonDir(dir);
  const own = git(dir, ['rev-parse', '--absolute-git-dir']);
  if (common === null || !own.ok || resolve(own.out.trim()) === common) return null;
  const [first = ''] = git(dir, ['worktree', 'list', '--porcelain', '-z']).out.split('\0\0');
  const lines = first.split('\0');
  const path = lines[0]?.startsWith('worktree ') ? lines[0].slice('worktree '.length) : '';
  return path === '' || lines.includes('bare') ? 'bare' : path;
}

/** Where apply copies the local folder: the main checkout, when `dir` is a
 * linked worktree and `copy` is not false. */
function copyTarget(dir: string, system: System, copy: boolean): string | null | 'bare' {
  if (!copy || isBacklogOnly(dir, system)) return null;
  const main = mainCheckout(dir);
  return main === null || main === 'bare' ? main : join(main, system.local);
}

/** Why `dir` cannot be converted from `system` with `tag`, or null. */
function refusal(dir: string, system: System, tag: string, copy: boolean): string | null {
  const { root, local } = system;
  if (!isGitRoot(dir)) return `${dir} is not a git repository root`;
  if (!exists(join(dir, system.marker))) return `${dir} has no ${system.name} ${system.marker === root ? `${root}/` : system.marker}`;
  const layout = system.layoutRefusal?.(dir) ?? null;
  if (layout !== null) return layout;
  if (!exists(join(dir, root))) return `${dir} has no ${root}/ to convert`;
  if (pathRefusal(dir, `${root}/x`) !== null || !lstatSync(join(dir, root)).isDirectory()) return `${root} is not a plain folder`;
  if (isBacklogOnly(dir, system)) return null;
  if (!git(dir, ['check-ref-format', `refs/tags/${tag}`]).ok) return `${tag} is not a valid tag name`;
  if (git(dir, ['rev-parse', '-q', '--verify', `refs/tags/${tag}`]).ok) return `the tag ${tag} exists; pass another "tag"`;
  if (!git(dir, ['rev-parse', '-q', '--verify', 'HEAD']).ok) return 'the repository has no commit to tag';
  const status = git(dir, ['status', '--porcelain', '--untracked-files=all', '--', root]);
  if (!status.ok || status.out !== '') return `${root}/ has uncommitted changes; commit them first, so the tag holds them`;
  if (exists(join(dir, local))) return `${local} exists; move it before converting`;
  const target = copyTarget(dir, system, copy);
  if (target !== null && target !== 'bare' && exists(target)) return `${local} exists in the main checkout (${target}); move it before converting, or pass "copy": false`;
  return null;
}

/** The plan for converting the `system` project in `dir`. Writes nothing. */
export function planConvert(dir: string, options: { system: SystemName; tag: string; copy?: boolean }): { ok: true; plan: ConvertPlan } | Failure {
  const system = systemFor(dir, options.system);
  const { root } = system;
  const copy = options.copy !== false;
  const refused = refusal(dir, system, options.tag, copy);
  if (refused !== null) return { ok: false, error: refused };
  const notes: string[] = [];
  if (isBacklogOnly(dir, system)) {
    notes.push(`${root}/ is not tracked by git: there is no tag to make and nothing to move; only the backlog is written. ${root}/ stays where it is.`);
    const common = gitCommonDir(dir);
    if (common === null) return { ok: false, error: 'the git common directory was not found' };
    const change = backlogChange(join(common, 'weftwork', 'BACKLOG.md'), system.section(dir, '', notes, root), system.title, notes);
    return { ok: true, plan: { system: options.system, tag: '', moves: [], changes: [change], notes, copy: null } };
  }
  const files = planFiles(dir, root);
  const known = new Set(files);
  const tracked = git(dir, ['ls-files', '-z']).out.split('\0').filter((path) => path !== '' && !path.startsWith(`${root}/`));
  const texts = new Map<string, { text: string; mode: number }>();
  let skipped = 0;
  const cited = new Set(system.alwaysMove === '' ? [] : files.filter((path) => path.startsWith(system.alwaysMove)));
  for (const path of tracked) {
    const file = readFile(join(dir, path));
    if (file === null) skipped++;
    else texts.set(path, file);
    for (const match of (file?.text ?? '').matchAll(citationOf(root))) {
      if (known.has(`${root}/${match[1]}`) && !system.planOwned.test(match[1])) cited.add(`${root}/${match[1]}`);
    }
  }
  if (skipped > 0) notes.push(`${skipped} tracked files were not scanned for citations: not a regular UTF-8 file of at most 1 MiB.`);
  const moved = new Map([...cited].sort().map((from) => [from, `docs/${from.slice(root.length + 1)}`]));
  const anyCitation = anyCitationOf(root);
  for (const to of moved.values()) {
    if (exists(join(dir, to))) return { ok: false, error: `${to} exists; a cited spec file would move onto it` };
    const bad = pathRefusal(dir, to);
    if (bad !== null) return { ok: false, error: bad };
  }
  const changes: Change[] = [];
  const edit = (path: string, file: { text: string; mode: number } | null): void => {
    const before = file?.text ?? '';
    const after = rewrite(before, moved, root);
    // .gitignore is only appended to (below), so a rewrite cannot hide that.
    if (after !== before && path !== '.gitignore') changes.push({ path, action: 'rewrite', text: after, diff: lineDiff(before, after), mode: file?.mode, before });
    if (anyCitation.test(path === '.gitignore' ? before : after)) notes.push(`${path} still names ${root}/: check it, and drop it if it serves only ${system.name}.`);
  };
  for (const [path, file] of texts) edit(path, file);
  const quoted = new RegExp(`(['"\`])${escaped(root)}\\1`);
  for (const [path, file] of texts) {
    if (quoted.test(file.text)) notes.push(`${path} names "${root}" as a string: a path built in code (join('${root}', ...)) breaks when ${root}/ moves; check it.`);
  }
  for (const [from, to] of moved) edit(to, readFile(join(dir, from)));
  const ignore = ignoreAppend(dir, [`${system.local}/`], `# Added by weftwork convert: the old ${system.name} plans, local only.`);
  if ('ok' in ignore) return ignore;
  changes.push(ignore);
  const common = gitCommonDir(dir);
  if (common === null) return { ok: false, error: 'the git common directory was not found' };
  changes.push(backlogChange(join(common, 'weftwork', 'BACKLOG.md'), system.section(dir, options.tag, notes, system.local), system.title, notes));
  const moves = [...[...moved].map(([from, to]) => ({ from, to })), { from: root, to: system.local }];
  const target = copyTarget(dir, system, copy);
  if (target === 'bare') notes.push(`This is a linked worktree of a repository with no main checkout: ${system.local}/ stays in this worktree only, and is deleted with it. Copy it somewhere first.`);
  else if (target !== null) notes.push(`This is a linked worktree: ${system.local}/ is also copied to ${target} in the main checkout, so it outlives the worktree. The main checkout shows it as untracked until this change is merged there.`);
  else if (!copy && mainCheckout(dir) !== null) notes.push(`"copy" is false: ${system.local}/ stays in this linked worktree only, and is deleted with it.`);
  return { ok: true, plan: { system: options.system, tag: options.tag, moves, changes, notes, copy: target === 'bare' ? null : target } };
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
 * (keeping any file changed since the plan), then move the plans folder to
 * its local name. */
export function applyConvert(dir: string, plan: ConvertPlan): Converted {
  const system = systemFor(dir, plan.system);
  const refused = refusal(dir, system, plan.tag, plan.copy !== null);
  if (refused !== null) return { ok: false, error: refused };
  if (plan.copy !== null && copyTarget(dir, system, true) !== plan.copy) return { ok: false, error: 'the main checkout changed since the plan; plan again' };
  // A backlog-only plan (tag '') applies only while the folder is untracked.
  if (plan.tag === '' && !isBacklogOnly(dir, system)) return { ok: false, error: `${system.root}/ is tracked now; plan again` };
  if (plan.tag !== '' && !git(dir, ['tag', plan.tag, 'HEAD']).ok) return { ok: false, error: `the tag ${plan.tag} could not be made` };
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
  if (plan.copy !== null && last !== undefined) {
    try {
      cpSync(join(dir, last.to), plan.copy, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true, verbatimSymlinks: true });
    } catch (error) {
      return { ok: false, error: `${last.to} could not be copied to ${plan.copy}: ${messageOf(error)}; the conversion is done, copy it by hand` };
    }
  }
  return { ok: true, tag: plan.tag, moved, written, kept, copied: plan.copy };
}
