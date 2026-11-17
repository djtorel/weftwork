// The layout of src/ (docs/ARCHITECTURE.md): the command files at the top,
// one folder per feature below, and the folder table in the doc kept true.
// A file in the wrong place fails here with what to do, so the layout holds
// for agents as well as for people who read the doc.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..');
const src = join(root, 'src');
const entries = readdirSync(src, { withFileTypes: true });
const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

/** The relative imports of every .ts file in `folder`, as [file, specifier]. */
function importsIn(folder: string): [string, string][] {
  const found: [string, string][] = [];
  for (const name of readdirSync(join(src, folder), { recursive: true, encoding: 'utf8' })) {
    if (!name.endsWith('.ts')) continue;
    const text = readFileSync(join(src, folder, name), 'utf8');
    for (const match of text.matchAll(/^(?:import|export)\b[^;']*'(\.{1,2}\/[^']+)'/gm)) {
      found.push([`${folder}/${name}`, match[1] ?? '']);
    }
  }
  return found;
}

test('the top of src/ holds only command files: cli.ts and <command>-cli.ts', () => {
  const stray = entries
    .filter((entry) => entry.isFile() && !/^(?:cli|[a-z][a-z0-9-]*-cli)\.ts$/.test(entry.name))
    .map((entry) => entry.name);
  assert.deepEqual(stray, [], 'move library code and tests into a feature folder (docs/ARCHITECTURE.md)');
});

test('docs/ARCHITECTURE.md lists every folder of src/, and no folder that is gone', () => {
  const doc = readFileSync(join(root, 'docs', 'ARCHITECTURE.md'), 'utf8');
  const listed = [...doc.matchAll(/^\| `src\/([a-z-]+)\/` \|/gm)].map((match) => match[1]).sort();
  assert.deepEqual(listed, folders, 'add a row for a new folder to the table in docs/ARCHITECTURE.md, or remove the row of a gone one');
});

test('src/shared/ imports nothing from a feature folder', () => {
  const outside = importsIn('shared').filter(([, spec]) => spec.startsWith('../') && !spec.startsWith('../test-support/'));
  assert.deepEqual(outside, [], 'shared/ is the bottom layer: move the code that needs a feature into that feature');
});

test('no library file imports a command file; the command files are thin shells over the library', () => {
  const hits = folders.flatMap(importsIn).filter(([, spec]) => /^\.\.\/[a-z0-9-]*cli\.ts$/.test(spec));
  assert.deepEqual(hits, [], 'move what the library needs out of the command file into the library');
});
