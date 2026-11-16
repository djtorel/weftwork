// story: e12s02
// The recommended "about" answer says what the project is, from the
// package's own description or the README's first paragraph, not only the
// folder name and the languages.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectDescription } from './setup-about.ts';
import { setupQuestions, type CheckedReport } from './setup-text.ts';
import { cleanupTempDirs, makeTempDir } from './test-helpers.ts';

after(cleanupTempDirs);

function folder(files: Record<string, string>): string {
  const dir = makeTempDir();
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

test('AC-e12s02-17 the description comes from package.json, pyproject.toml or Cargo.toml, in that order', () => {
  assert.equal(projectDescription(folder({ 'package.json': JSON.stringify({ description: 'Counts  sheep\nfast.' }), 'README.md': 'Other.\n' })), 'Counts sheep fast.');
  assert.equal(projectDescription(folder({ 'pyproject.toml': '[project]\nname = "x"\ndescription = "A Python tool for sheep."\n' })), 'A Python tool for sheep.');
  assert.equal(projectDescription(folder({ 'Cargo.toml': "[package]\nname = 'x'\ndescription = 'A Rust tool.'\n" })), 'A Rust tool.');
  const pyproject = '[tool.other]\ndescription = "Not this."\n[tool.poetry]\ndescription = "A Poetry tool." # short\n';
  assert.equal(projectDescription(folder({ 'pyproject.toml': pyproject })), 'A Poetry tool.');
});

test('AC-e12s02-18 else the README first paragraph of prose: no heading, badge, HTML or code; none gives null', () => {
  const readme = '# Sheep\n\n[![CI](x.svg)](y)\n<p align="center"><img src="a.png"></p>\n\n```sh\nnpm i\n```\n\nSheep counts sheep\nfor tired farmers.\n\nMore.\n';
  assert.equal(projectDescription(folder({ 'README.md': readme, 'package.json': '{"name":"x"}' })), 'Sheep counts sheep for tired farmers.');
  const long = projectDescription(folder({ 'README.md': `${'word '.repeat(200)}\n` })) ?? '';
  assert.ok(long.length > 290 && long.length <= 300, `${long.length} characters`);
  assert.equal(projectDescription(folder({ 'README.md': '# Only a title\n' })), null);
  assert.equal(projectDescription(folder({ 'README.md': 'Sheep\n=====\n\nCounts sheep.\n' })), 'Counts sheep.');
  assert.equal(projectDescription(makeTempDir()), null);
});

test('AC-e12s02-19 the recommended about answer adds the description, and stays one valid line', () => {
  const report = { languages: ['go'] } as CheckedReport;
  assert.equal(setupQuestions('sheep', report, 'Counts sheep.')[0].recommended, 'sheep is a go project: Counts sheep.');
  assert.equal(setupQuestions('sheep', report, null)[0].recommended, 'sheep is a go project.');
});
