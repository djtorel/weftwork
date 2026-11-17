// story: e12s01
// Detect a project: a pure report from its folder of the languages, package
// managers, frameworks and commands (detect-stacks.ts), the CI files, the agent
// files and the planning systems. Reads only; detect-check.ts runs the
// commands. docs/DETECT.md.
import { lstat, readdir, stat } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { isAbsolute, join, normalize, relative } from 'node:path';
import { isMissing, messageOf, type Failure } from '../shared/errors.ts';
import { readRegularFile } from '../shared/regular-file.ts';
import { markerFiles, readStacks, textFiles, type Files, type FoundCommand } from './detect-stacks.ts';
import { packageFolders } from './detect-packages.ts';

export type { FoundCommand } from './detect-stacks.ts';

/** One package of a monorepo: its folder from the project, and its stack. */
export type PackageReport = { path: string; languages: string[]; packageManagers: string[]; frameworks: string[]; commands: FoundCommand[] };

export type ProjectReport = {
  path: string;
  languages: string[];
  packageManagers: string[];
  frameworks: string[];
  commands: FoundCommand[];
  ci: string[];
  agentFiles: string[];
  planning: { system: string; path: string }[];
  packages: PackageReport[];
  notes: string[];
};

/** The lock files a package shares with the workspace root. */
const rootLocks = ['pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb', 'poetry.lock', 'uv.lock'];

/** The most of one manifest that is read. */
const maxFileBytes = 1024 * 1024;

const ciFiles = ['.gitlab-ci.yml', '.circleci/config.yml', 'Jenkinsfile', 'azure-pipelines.yml', '.travis.yml', 'bitbucket-pipelines.yml'];

const agentFiles = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.cursorrules', '.cursor/rules', '.windsurfrules', '.clinerules', '.github/copilot-instructions.md'];

const planningMarkers: [string, string][] = [
  ['bigpowers', 'specs/state.yaml'],
  ['gsd', '.planning'],
  ['gsd2', '.gsd'],
  ['spec-kit', '.specify'],
  ['bmad', '_bmad'],
  ['bmad', 'bmad'],
  ['bmad', '.bmad-core'],
];

/** True when `path` exists as anything, a dangling symlink included. */
async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

async function existing(dir: string, names: string[]): Promise<string[]> {
  const found = await Promise.all(names.map(async (name) => ((await exists(join(dir, name))) ? name : null)));
  return found.filter((name): name is string => name !== null);
}

/** The workflow files in .github/workflows, sorted. */
async function workflows(dir: string): Promise<string[]> {
  try {
    const names = await readdir(join(dir, '.github', 'workflows'));
    return names.filter((name) => /\.ya?ml$/.test(name)).sort().map((name) => `.github/workflows/${name}`);
  } catch {
    return [];
  }
}

/** True when `path`, with every symlink resolved, is inside `dir`. */
function isInside(dir: string, path: string): boolean {
  try {
    const inside = relative(realpathSync(dir), realpathSync(path));
    return inside !== '' && !inside.startsWith('..') && !isAbsolute(inside);
  } catch {
    return false;
  }
}

/** The most included makefiles read for one Makefile. */
const maxIncludes = 20;

/** `text` with each makefile it includes (`include`, `-include`, `sinclude`)
 * appended, and theirs, so the rules and variables in them are seen. A name
 * with a variable, or outside the folder, is not read. */
function withIncludes(dir: string, text: string): string {
  const seen = new Set<string>();
  const parts = [text];
  const queue = [text];
  for (let next = queue.shift(); next !== undefined && seen.size < maxIncludes; next = queue.shift()) {
    for (const line of next.matchAll(/^\s*-?s?include\s+(.+)$/gm)) {
      for (const name of line[1].split(/\s+/).filter((each) => each !== '' && !each.includes('$'))) {
        if (seen.has(name) || isAbsolute(name) || normalize(name).startsWith('..') || seen.size >= maxIncludes) continue;
        seen.add(name);
        if (!isInside(dir, join(dir, name))) continue;
        const read = readRegularFile(join(dir, name), { follow: false, maxBytes: maxFileBytes });
        if (!read.ok || read.file === null) continue;
        parts.push(read.file.text);
        queue.push(read.file.text);
      }
    }
  }
  return parts.join('\n');
}

/** The top-level files the stack readers need; an unreadable one is a note. */
async function readFiles(dir: string, notes: string[]): Promise<Files> {
  const text = new Map<string, string>();
  for (const name of textFiles) {
    const read = readRegularFile(join(dir, name), { follow: true, maxBytes: maxFileBytes });
    if (!read.ok) notes.push(`${name} was not read: ${read.error}`);
    else if (read.file !== null) text.set(name, /akefile$/.test(name) ? withIncludes(dir, read.file.text) : read.file.text);
  }
  const present = new Set([...text.keys(), ...(await existing(dir, markerFiles))]);
  return { text, present };
}

function union(lists: string[][]): string[] {
  return [...new Set(lists.flat())];
}

/** The stack of each package folder; one with no stack is left out. */
async function readPackages(dir: string, files: Files, notes: string[]): Promise<PackageReport[]> {
  const packages: PackageReport[] = [];
  for (const path of packageFolders(dir, files, notes)) {
    const own: string[] = [];
    const found = await readFiles(join(dir, path), own);
    notes.push(...own.map((note) => `${path}/${note}`));
    for (const lock of rootLocks) if (files.present.has(lock)) found.present.add(lock);
    const stacks = readStacks(found);
    notes.push(...stacks.flatMap((each) => each.notes.map((note) => `${path}/${note}`)));
    const commands = stacks.flatMap((each) => each.commands);
    const languages = union(stacks.map((each) => each.languages));
    if (languages.length === 0 && commands.length === 0) continue;
    packages.push({ path, languages, packageManagers: union(stacks.map((each) => each.packageManagers)), frameworks: union(stacks.map((each) => each.frameworks)), commands });
  }
  return packages;
}

/** `dir` checked to be a folder, or why not. */
async function checkFolder(dir: string): Promise<Failure | null> {
  try {
    return (await stat(dir)).isDirectory() ? null : { ok: false, error: `${dir} is not a folder` };
  } catch (error) {
    return { ok: false, error: isMissing(error) ? `${dir} does not exist` : `${dir} cannot be read: ${messageOf(error)}` };
  }
}

/** The report for the project in `dir`. Fails only when `dir` is not a
 * readable folder; a file that cannot be read or parsed is a note. */
export async function detectProject(dir: string): Promise<{ ok: true; report: ProjectReport } | Failure> {
  const bad = await checkFolder(dir);
  if (bad !== null) return bad;
  const notes: string[] = [];
  const files = await readFiles(dir, notes);
  const stacks = readStacks(files);
  const packages = await readPackages(dir, files, notes);
  const planning = [];
  for (const [system, path] of planningMarkers) {
    if (await exists(join(dir, path))) planning.push({ system, path });
  }
  return {
    ok: true,
    report: {
      path: dir,
      languages: union(stacks.map((found) => found.languages)),
      packageManagers: union(stacks.map((found) => found.packageManagers)),
      frameworks: union(stacks.map((found) => found.frameworks)),
      commands: stacks.flatMap((found) => found.commands),
      ci: [...(await workflows(dir)), ...(await existing(dir, ciFiles))],
      agentFiles: await existing(dir, agentFiles),
      planning,
      packages,
      notes: [...notes, ...stacks.flatMap((found) => found.notes)],
    },
  };
}
