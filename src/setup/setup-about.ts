// story: e12s02
// What a project says it is, for setup's recommended "about" answer: the
// description in package.json, pyproject.toml or Cargo.toml, else the first
// paragraph of prose in README.md. Reads only those files. docs/SETUP.md.
import { join } from 'node:path';
import { isRecord } from '../shared/json.ts';
import { readRegularFile } from '../shared/regular-file.ts';

const maxFileBytes = 1024 * 1024;
const maxLength = 300;

function read(dir: string, name: string): string | null {
  const found = readRegularFile(join(dir, name), { follow: true, maxBytes: maxFileBytes });
  return found.ok && found.file !== null ? found.file.text : null;
}

/** `text` as one line of at most maxLength characters, or null when empty. */
function oneLine(text: string): string | null {
  const line = text.replace(/\s+/g, ' ').trim().slice(0, maxLength).trim();
  return line === '' ? null : line;
}

function packageDescription(text: string | null): string | null {
  if (text === null) return null;
  try {
    const pkg: unknown = JSON.parse(text);
    return isRecord(pkg) && typeof pkg.description === 'string' ? oneLine(pkg.description) : null;
  } catch {
    return null;
  }
}

/** The `description = "..."` (or '...') line of the package table of a
 * TOML file: `[project]`, `[tool.poetry]` or `[package]`. */
function tomlDescription(text: string | null): string | null {
  let table = '';
  for (const line of (text ?? '').split('\n')) {
    const header = /^\s*\[([^\]]*)\]/.exec(line);
    if (header !== null) table = header[1].trim();
    const found = /^description\s*=\s*(["'])(.*?)\1\s*(#.*)?$/.exec(line);
    if (found !== null && ['project', 'tool.poetry', 'package'].includes(table)) return oneLine(found[2]);
  }
  return null;
}

/** The first paragraph of README.md that is prose: outside code fences, and
 * not a heading (ATX or Setext), badge, image, HTML, list, quote, table or
 * rule. */
function readmeDescription(text: string | null): string | null {
  if (text === null) return null;
  let fenced = false;
  let paragraph: string[] = [];
  for (const line of [...text.split('\n'), '']) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    else if (!fenced && line.trim() !== '') {
      paragraph.push(line);
      continue;
    }
    const heading = paragraph.some((each) => /^\s*(=+|-+)\s*$/.test(each));
    if (paragraph.length > 0 && !heading && !/^\s*([#<>|!\-*+=]|\[!\[|\d+\.\s)/.test(paragraph[0])) return oneLine(paragraph.join(' '));
    paragraph = [];
  }
  return null;
}

/** What the project in `dir` says it is, or null when nothing says. */
export function projectDescription(dir: string): string | null {
  return (
    packageDescription(read(dir, 'package.json')) ??
    tomlDescription(read(dir, 'pyproject.toml')) ??
    tomlDescription(read(dir, 'Cargo.toml')) ??
    readmeDescription(read(dir, 'README.md'))
  );
}
