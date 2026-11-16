// story: e12s01
// The packages of a monorepo: the folders its workspace files name, from
// package.json `workspaces`, pnpm-workspace.yaml `packages`, go.work `use`
// and a Cargo.toml `[workspace]` `members`. Globs are expanded; a `!` pattern
// leaves folders out; a folder outside the project, through a symlink or
// not, is never named. detect.ts reads each one's stack. docs/DETECT.md.
import { globSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, matchesGlob, normalize, relative } from 'node:path';
import { parse } from 'yaml';
import { messageOf } from './errors.ts';
import { isRecord } from './json.ts';
import type { Files } from './detect-stacks.ts';

/** The most packages reported. */
const maxPackages = 200;

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

function npmPatterns(text: string | undefined): string[] {
  try {
    const pkg: unknown = JSON.parse(text ?? '');
    if (!isRecord(pkg)) return [];
    return isRecord(pkg.workspaces) ? strings(pkg.workspaces.packages) : strings(pkg.workspaces);
  } catch {
    return [];
  }
}

function pnpmPatterns(text: string | undefined, notes: string[]): string[] {
  if (text === undefined) return [];
  try {
    const found: unknown = parse(text);
    return isRecord(found) ? strings(found.packages) : [];
  } catch (error) {
    notes.push(`pnpm-workspace.yaml was not parsed: ${messageOf(error)}`);
    return [];
  }
}

/** go.work: each `use ./dir`, and each line of a `use ( ... )` block. */
function goPatterns(text: string | undefined): string[] {
  const out: string[] = [];
  for (const block of (text ?? '').matchAll(/^use\s*\(([^)]*)\)/gm)) out.push(...block[1].split('\n'));
  for (const line of (text ?? '').matchAll(/^use\s+([^\s(]\S*)/gm)) out.push(line[1]);
  return out.map((line) => line.replace(/\/\/.*$/, '').trim().replace(/^"(.*)"$/, '$1')).filter((line) => line !== '');
}

/** Cargo.toml: the quoted entries of `members = [...]` in `[workspace]`,
 * and each of its `exclude = [...]` as a `!` pattern. */
function cargoPatterns(text: string | undefined): string[] {
  const workspace = /^\[workspace\][ \t]*(#.*)?$([\s\S]*?)(?=^\[|(?![\s\S]))/m.exec(text ?? '')?.[2] ?? '';
  const list = (key: string): string[] => {
    const items = new RegExp(`^\\s*${key}\\s*=\\s*\\[([^\\]]*)\\]`, 'm').exec(workspace)?.[1] ?? '';
    return [...items.matchAll(/(["'])(.*?)\1/g)].map((match) => match[2]);
  };
  return [...list('members'), ...list('exclude').map((path) => `!${path}`)];
}

/** True when `path` (from `dir`) is a folder inside `root`, the real `dir`. */
function isPackageFolder(root: string, dir: string, path: string): boolean {
  try {
    if (!statSync(join(dir, path)).isDirectory()) return false;
    const inside = relative(root, realpathSync(join(dir, path)));
    return inside !== '' && !inside.startsWith('..') && !isAbsolute(inside);
  } catch {
    return false;
  }
}

/** The package folders of the project in `dir`, from its top-level `files`,
 * as sorted paths from `dir`. A workspace file that cannot be parsed is a
 * note. */
export function packageFolders(dir: string, files: Files, notes: string[]): string[] {
  const text = (name: string): string | undefined => files.text.get(name);
  const patterns = [
    ...npmPatterns(text('package.json')),
    ...pnpmPatterns(text('pnpm-workspace.yaml'), notes),
    ...goPatterns(text('go.work')),
    ...cargoPatterns(text('Cargo.toml')),
  ];
  const excluded = patterns.filter((pattern) => pattern.startsWith('!')).map((pattern) => normalize(pattern.slice(1)).replace(/\/$/, ''));
  let root: string;
  try {
    root = realpathSync(dir);
  } catch {
    return [];
  }
  const found = new Set<string>();
  for (const pattern of patterns.filter((each) => !each.startsWith('!'))) {
    if (isAbsolute(pattern)) continue;
    const clean = normalize(pattern).replace(/\/$/, '');
    if (clean.startsWith('..')) continue;
    for (const path of globSync(clean, { cwd: dir, exclude: (name) => name === 'node_modules' || name === '.git' })) {
      const folder = normalize(path);
      if (excluded.some((skip) => matchesGlob(folder, skip)) || !isPackageFolder(root, dir, folder)) continue;
      found.add(folder);
      if (found.size >= maxPackages) return [...found].sort();
    }
  }
  return [...found].sort();
}
