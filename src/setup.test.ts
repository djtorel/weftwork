// story: e12s02
// Setting up a plain project: the plan is a dry run that writes nothing, apply
// writes the letter, the symlink, the skills, the .gitignore lines and the
// backlog, and a re-run never overwrites a file the owner changed.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readlinkSync, rmSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { applySetup, planSetup, type Plan } from './setup.ts';
import type { Answers, CheckedReport } from './setup-text.ts';
import { cleanupTempDirs, makeTempDir, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const engineDir = join(import.meta.dirname, '..');

function report(dir: string): CheckedReport {
  return {
    path: dir,
    languages: ['go'],
    packageManagers: ['go'],
    frameworks: [],
    commands: [
      { kind: 'test', command: 'go test ./...', source: 'go.mod', check: { status: 'passed', exitCode: 0 } },
      { kind: 'lint', command: 'go vet ./...', source: 'go.mod', check: { status: 'failed', exitCode: 1 } },
      { kind: 'build', command: 'go build ./...', source: 'go.mod', check: { status: 'missing', exitCode: 127 } },
    ],
    ci: [],
    agentFiles: [],
    planning: [],
    notes: [],
  };
}

const answers: Answers = {
  about: 'Tool is a CLI for counting sheep.',
  words: ['flock: one input file'],
  never: ['Never push to main.'],
  rules: ['Wrap errors with context.'],
  tasks: ['Add a --json flag.'],
};

function plan(dir: string, options: { stopHook?: boolean } = {}): Plan {
  const result = planSetup(dir, report(dir), answers, { engineDir, stopHook: options.stopHook ?? false });
  assert.ok(result.ok, result.ok ? '' : result.error);
  return result.plan;
}

const action = (p: Plan, path: string): string | undefined => p.changes.find((change) => change.path === path)?.action;

test('AC-e12s02-01 the plan is a dry run: it lists every file and writes none', () => {
  const dir = makeTestRepo({ 'main.go': 'package main\n' });
  const p = plan(dir);
  assert.equal(action(p, 'AGENTS.md'), 'create');
  assert.equal(action(p, 'CLAUDE.md'), 'link');
  assert.equal(action(p, 'CONVENTIONS.md'), 'create');
  assert.equal(action(p, '.gitignore'), 'append');
  assert.equal(action(p, '.claude/skills/full-stop/SKILL.md'), 'create');
  assert.ok(p.changes.some((change) => change.path.endsWith('weftwork/BACKLOG.md') && change.action === 'create'));
  assert.equal(existsSync(join(dir, 'AGENTS.md')), false);
  assert.equal(existsSync(join(dir, '.claude')), false);
});

test('AC-e12s02-02 the letter names only commands that resolve, and Preflight only those that passed', () => {
  const dir = makeTestRepo({ 'main.go': 'package main\n' });
  const letter = plan(dir).changes.find((change) => change.path === 'AGENTS.md')?.text ?? '';
  assert.match(letter, /Tool is a CLI for counting sheep\./);
  assert.match(letter, /\| test \| `go test \.\/\.\.\.` \|/);
  assert.match(letter, /\| lint \(fails today\) \| `go vet \.\/\.\.\.` \|/);
  assert.doesNotMatch(letter, /go build/);
  assert.match(letter, /```bash\ngo test \.\/\.\.\.\n```/);
  assert.match(letter, /- Never push to main\./);
});

test('AC-e12s02-03 apply writes the files, links CLAUDE.md, rewrites skill paths and seeds the backlog', () => {
  const dir = makeTestRepo({ 'main.go': 'package main\n', '.gitignore': '.env\n' });
  const result = applySetup(dir, plan(dir), { overwrite: [] });
  assert.ok(result.ok, result.ok ? '' : result.error);
  assert.match(readFileSync(join(dir, 'AGENTS.md'), 'utf8'), /^# /);
  assert.equal(readlinkSync(join(dir, 'CLAUDE.md')), 'AGENTS.md');
  assert.equal(readFileSync(join(dir, 'CONVENTIONS.md'), 'utf8'), '# Conventions\n\n- Wrap errors with context.\n');
  assert.equal(readFileSync(join(dir, '.gitignore'), 'utf8'), '.env\n\n# Added by weftwork setup.\n.env.*\n');
  const skill = readFileSync(join(dir, '.claude/skills/full-stop/SKILL.md'), 'utf8');
  assert.ok(skill.includes(`node '${join(engineDir, 'src', 'cli.ts')}'`), 'the skill names the engine by absolute path');
  assert.doesNotMatch(skill, /node src\//);
  assert.ok(skill.includes(`\`${join(engineDir, 'docs', 'ASK.md')}\``), 'engine docs are named by absolute path');
  const filePr = readFileSync(join(dir, '.claude/skills/file-pr/SKILL.md'), 'utf8');
  assert.ok(filePr.includes(join(engineDir, '.github', 'pull_request_template.md')));
  const backlogPath = join(dir, '.git', 'weftwork', 'BACKLOG.md');
  assert.match(readFileSync(backlogPath, 'utf8'), /- \[ \] Add a --json flag\./);
});

test('AC-e12s02-04 a re-run changes nothing, and a file the owner changed is a conflict with a diff, kept', () => {
  const dir = makeTestRepo({ 'main.go': 'package main\n' });
  assert.ok(applySetup(dir, plan(dir), { overwrite: [] }).ok);
  const again = plan(dir);
  assert.deepEqual([...new Set(again.changes.map((change) => change.action))], ['unchanged']);
  writeFileSync(join(dir, 'AGENTS.md'), '# Mine\n');
  const changed = plan(dir);
  const agents = changed.changes.find((change) => change.path === 'AGENTS.md');
  assert.equal(agents?.action, 'conflict');
  assert.match(agents?.diff ?? '', /^-# Mine$/m);
  assert.match(agents?.diff ?? '', /^\+## About this project$/m);
  const applied = applySetup(dir, changed, { overwrite: [] });
  assert.ok(applied.ok);
  assert.deepEqual(applied.kept, ['AGENTS.md']);
  assert.equal(readFileSync(join(dir, 'AGENTS.md'), 'utf8'), '# Mine\n');
});

test('AC-e12s02-05 an overwrite named by the owner moves the old file aside, never deletes it', () => {
  const dir = makeTestRepo({ 'main.go': 'package main\n', 'CLAUDE.md': '# Old notes\n' });
  const p = plan(dir);
  assert.equal(action(p, 'CLAUDE.md'), 'conflict');
  assert.ok(applySetup(dir, p, { overwrite: ['CLAUDE.md'] }).ok);
  assert.equal(readlinkSync(join(dir, 'CLAUDE.md')), 'AGENTS.md');
  assert.equal(readFileSync(join(dir, 'CLAUDE.md.weftwork-old'), 'utf8'), '# Old notes\n');
});

test('AC-e12s02-06 a write through a symlinked folder is refused', () => {
  const dir = makeTestRepo({ 'main.go': 'package main\n' });
  const elsewhere = makeTempDir();
  symlinkSync(elsewhere, join(dir, '.claude'));
  const result = planSetup(dir, report(dir), answers, { engineDir, stopHook: false });
  assert.equal(result.ok, false);
  assert.match(result.ok ? '' : result.error, /\.claude is a symlink/);
});

test('AC-e12s02-07 no git repository: no backlog and no Stop hook, with a note', () => {
  const dir = makeTempDir();
  mkdirSync(join(dir, 'src'));
  const p = plan(dir, { stopHook: true });
  assert.ok(!p.changes.some((change) => change.path.endsWith('BACKLOG.md')));
  assert.ok(!p.changes.some((change) => change.path === '.claude/settings.json'));
  assert.ok(p.notes.some((note) => /not a git repository/.test(note)));
});

test('AC-e12s02-08 the Stop hook is planned with the Preflight and installed on apply', () => {
  const dir = makeTestRepo({ 'main.go': 'package main\n' });
  const p = plan(dir, { stopHook: true });
  assert.equal(action(p, '.claude/settings.json'), 'create');
  assert.ok(applySetup(dir, p, { overwrite: [] }).ok);
  const settings = readFileSync(join(dir, '.claude/settings.json'), 'utf8');
  assert.ok(settings.includes('go test ./...'));
  assert.ok(settings.includes(join(engineDir, 'src', 'claude-hook-cli.ts')));
});

test('AC-e12s02-13 a settings file the owner edited is a conflict with a diff, not silently replaced', () => {
  const dir = makeTestRepo({ 'main.go': 'package main\n' });
  assert.ok(applySetup(dir, plan(dir, { stopHook: true }), { overwrite: [] }).ok);
  const path = join(dir, '.claude/settings.json');
  const edited = readFileSync(path, 'utf8').replace('go test ./...', 'go test -short ./...');
  writeFileSync(path, edited);
  const p = plan(dir, { stopHook: true });
  const settings = p.changes.find((change) => change.path === '.claude/settings.json');
  assert.equal(settings?.action, 'conflict');
  assert.match(settings?.diff ?? '', /^-.*go test -short/m);
  const applied = applySetup(dir, p, { overwrite: [] });
  assert.ok(applied.ok);
  assert.deepEqual(applied.kept, ['.claude/settings.json']);
  assert.equal(readFileSync(path, 'utf8'), edited);
});

test('AC-e12s02-14 a file created or changed after the plan is kept, not written', () => {
  const dir = makeTestRepo({ 'main.go': 'package main\n' });
  const p = plan(dir);
  writeFileSync(join(dir, 'AGENTS.md'), '# Written meanwhile\n');
  writeFileSync(join(dir, '.gitignore'), 'dist/\n');
  const applied = applySetup(dir, p, { overwrite: [] });
  assert.ok(applied.ok);
  assert.deepEqual(applied.kept, ['AGENTS.md', '.gitignore']);
  assert.equal(readFileSync(join(dir, 'AGENTS.md'), 'utf8'), '# Written meanwhile\n');
  assert.equal(readFileSync(join(dir, '.gitignore'), 'utf8'), 'dist/\n');
});

test('AC-e12s02-15 a CLAUDE.md edited, relinked or created after the plan is kept, even when named in overwrite', () => {
  const edited = makeTestRepo({ 'main.go': 'package main\n', 'CLAUDE.md': '# Old notes\n' });
  const p = plan(edited);
  writeFileSync(join(edited, 'CLAUDE.md'), '# Edited meanwhile\n');
  const applied = applySetup(edited, p, { overwrite: ['CLAUDE.md'] });
  assert.ok(applied.ok, applied.ok ? '' : applied.error);
  assert.deepEqual(applied.kept, ['CLAUDE.md']);
  assert.equal(readFileSync(join(edited, 'CLAUDE.md'), 'utf8'), '# Edited meanwhile\n');
  assert.equal(existsSync(join(edited, 'CLAUDE.md.weftwork-old')), false);

  const relinked = makeTestRepo({ 'main.go': 'package main\n', 'NOTES.md': '# Notes\n' });
  symlinkSync('NOTES.md', join(relinked, 'CLAUDE.md'));
  const q = plan(relinked);
  rmSync(join(relinked, 'CLAUDE.md'));
  symlinkSync('OTHER.md', join(relinked, 'CLAUDE.md'));
  const again = applySetup(relinked, q, { overwrite: ['CLAUDE.md'] });
  assert.ok(again.ok, again.ok ? '' : again.error);
  assert.deepEqual(again.kept, ['CLAUDE.md']);
  assert.equal(readlinkSync(join(relinked, 'CLAUDE.md')), 'OTHER.md');

  const created = makeTestRepo({ 'main.go': 'package main\n' });
  const r = plan(created);
  writeFileSync(join(created, 'CLAUDE.md'), '# Mine\n');
  const third = applySetup(created, r, { overwrite: [] });
  assert.ok(third.ok, third.ok ? '' : third.error);
  assert.deepEqual(third.kept, ['CLAUDE.md']);
});

test('AC-e12s02-16 a CLAUDE.md symlink unchanged since the plan is still overwritten when named', () => {
  const dir = makeTestRepo({ 'main.go': 'package main\n', 'NOTES.md': '# Notes\n' });
  symlinkSync('NOTES.md', join(dir, 'CLAUDE.md'));
  const applied = applySetup(dir, plan(dir), { overwrite: ['CLAUDE.md'] });
  assert.ok(applied.ok, applied.ok ? '' : applied.error);
  assert.equal(readlinkSync(join(dir, 'CLAUDE.md')), 'AGENTS.md');
  assert.equal(readlinkSync(join(dir, 'CLAUDE.md.weftwork-old')), 'NOTES.md');
});
