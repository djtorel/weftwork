// story: e12s02
// Undoing a setup: apply records what it wrote, and undo reverses each write
// that is still as setup left it. A file the owner changed since is kept, and
// a .gitignore the owner edited loses only the lines setup added.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applySetup, planSetup } from './setup.ts';
import type { Answers, CheckedReport } from './setup-text.ts';
import { recordSetup, undoSetup } from './setup-undo.ts';
import { cleanupTempDirs, isolatedEnv, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const engineDir = join(import.meta.dirname, '..');
const answers: Answers = { about: 'A tool.', words: [], never: [], rules: ['Wrap errors.'], tasks: ['First task.'] };

function report(dir: string): CheckedReport {
  const check = { status: 'passed' as const, exitCode: 0 };
  return { path: dir, languages: ['go'], packageManagers: ['go'], frameworks: [], commands: [{ kind: 'test', command: 'go test ./...', source: 'go.mod', check }], ci: [], agentFiles: [], planning: [], packages: [], notes: [] };
}

async function setUp(dir: string, overwrite: string[] = []): Promise<void> {
  const planned = planSetup(dir, report(dir), answers, { engineDir, stopHook: true });
  assert.ok(planned.ok, planned.ok ? '' : planned.error);
  const applied = applySetup(dir, planned.plan, { overwrite });
  assert.ok(applied.ok, applied.ok ? '' : applied.error);
  const recorded = await recordSetup(dir, applied.record);
  assert.equal(recorded, null);
}

const gone = (path: string): boolean => {
  try {
    lstatSync(path);
    return false;
  } catch {
    return true;
  }
};

test('AC-e12s02-20 undo removes what setup created and restores what it appended or overwrote', async () => {
  const dir = makeTestRepo({ 'main.go': 'package main\n', '.gitignore': '.env\n', 'CLAUDE.md': '# Old notes\n' });
  await setUp(dir, ['CLAUDE.md']);
  assert.equal(readFileSync(join(dir, 'CLAUDE.md.weftwork-old'), 'utf8'), '# Old notes\n');
  const undone = await undoSetup(dir);
  assert.ok(undone.ok, undone.ok ? '' : undone.error);
  assert.deepEqual(undone.kept, []);
  for (const path of ['AGENTS.md', 'CONVENTIONS.md', '.claude/skills/weft-ready/SKILL.md', '.claude/settings.json', 'CLAUDE.md.weftwork-old']) assert.ok(gone(join(dir, path)), path);
  assert.ok(gone(join(dir, '.git', 'weftwork', 'BACKLOG.md')));
  assert.equal(readFileSync(join(dir, 'CLAUDE.md'), 'utf8'), '# Old notes\n');
  assert.equal(readFileSync(join(dir, '.gitignore'), 'utf8'), '.env\n');
  const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: dir, encoding: 'utf8' });
  assert.equal(status.stdout, '');
});

test('AC-e12s02-21 undo keeps a file changed since setup, and drops only setup lines from an edited .gitignore', async () => {
  const dir = makeTestRepo({ 'main.go': 'package main\n', '.gitignore': '.env\n' });
  await setUp(dir);
  writeFileSync(join(dir, 'AGENTS.md'), '# Mine now\n');
  writeFileSync(join(dir, '.gitignore'), `dist/\n${readFileSync(join(dir, '.gitignore'), 'utf8')}`);
  const undone = await undoSetup(dir);
  assert.ok(undone.ok, undone.ok ? '' : undone.error);
  assert.deepEqual(undone.kept, ['AGENTS.md']);
  assert.equal(readFileSync(join(dir, 'AGENTS.md'), 'utf8'), '# Mine now\n');
  assert.equal(readFileSync(join(dir, '.gitignore'), 'utf8'), 'dist/\n.env\n');
  const again = await undoSetup(dir);
  assert.ok(again.ok);
  assert.deepEqual(again.kept, ['AGENTS.md'], 'a kept entry stays in the record');
});

test('AC-e12s02-22 undo with no record fails with the reason, and the CLI undoes without detecting', async () => {
  const dir = makeTestRepo({ 'main.go': 'package main\n' });
  const none = await undoSetup(dir);
  assert.equal(none.ok, false);
  assert.match(none.ok ? '' : none.error, /no setup to undo/);
  const cli = join(import.meta.dirname, 'setup-cli.ts');
  const run = (request: object) => spawnSync(process.execPath, [cli], { cwd: dir, input: JSON.stringify(request), env: isolatedEnv(), encoding: 'utf8', timeout: 60000 });
  const applied = run({ answers: { about: 'A tool.' }, apply: true, run: false });
  assert.equal(applied.status, 0, applied.stderr);
  assert.ok(existsSync(join(dir, 'AGENTS.md')));
  const out = run({ undo: true });
  assert.equal(out.status, 0, out.stderr);
  const answer = JSON.parse(out.stdout);
  assert.ok(answer.undone.includes('AGENTS.md'));
  assert.ok(gone(join(dir, 'AGENTS.md')));
  assert.equal(run({ undo: true, apply: true }).status, 2);
});

test('AC-e12s02-23 a .gitignore setup created is removed; a record entry outside the project, or undo from another folder, is refused', async () => {
  const dir = makeTestRepo({ 'main.go': 'package main\n' });
  await setUp(dir);
  const recordPath = join(dir, '.git', 'weftwork', 'setup-record.json');
  const record = JSON.parse(readFileSync(recordPath, 'utf8'));
  const outside = makeTestRepo({ 'keep.txt': 'mine\n' });
  record.entries.unshift({ path: '../' + outside.split('/').pop() + '/keep.txt', made: 'create', link: false, before: null, after: 'mine\n' });
  record.entries.unshift({ path: join(outside, 'keep.txt'), made: 'create', link: false, before: null, after: 'mine\n' });
  writeFileSync(recordPath, JSON.stringify(record));
  mkdirSync(join(dir, 'sub'));
  const elsewhere = await undoSetup(join(dir, 'sub'));
  assert.equal(elsewhere.ok, false);
  assert.match(elsewhere.ok ? '' : elsewhere.error, /the setup was of/);
  const undone = await undoSetup(dir);
  assert.ok(undone.ok, undone.ok ? '' : undone.error);
  assert.ok(gone(join(dir, '.gitignore')), '.gitignore setup created is removed');
  assert.equal(readFileSync(join(outside, 'keep.txt'), 'utf8'), 'mine\n');
  assert.equal(undone.kept.length, 2);
});
