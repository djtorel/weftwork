// story: e12s03
// Converting a bigpowers project: the plan is a dry run; apply tags the last
// commit that tracks specs/, moves the files that code or docs cite (and the
// ADRs) into docs/ and rewrites the citations, moves the rest of specs/ into
// the gitignored .specs/, and adds the open work to the local backlog. Nothing
// is deleted.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyConvert, planConvert, type ConvertPlan } from './convert.ts';
import { cleanupTempDirs, git, makeTempDir, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const epic = [
  '---',
  'id: e02',
  'title: Open work',
  'status: todo',
  'done_when: It works',
  'stories:',
  '  - id: e02s01',
  '    title: Next story',
  '    status: todo',
  '    acceptance: Given X then Z',
  '',
].join('\n');

function bigpowersRepo(): string {
  return makeTestRepo({
    'specs/state.yaml': '---\nactive_flow: null\n',
    'specs/execution-status.yaml': '---\ndevelopment_status:\n  e02: todo\n',
    'specs/epics/e02-open/epic.yaml': epic,
    'specs/bugs/BUG-001-x.md': '# Bug one\n\nSee specs/state.yaml.\n',
    'specs/adr/0001-choice.md': '# We chose X\n',
    'specs/notes.md': 'not cited\n',
    'README.md': 'Read specs/bugs/BUG-001-x.md, or .specs/old.md, or specs/ itself.\n',
    'src/a.ts': '// see specs/bugs/BUG-001-x.md.\n',
  });
}

const commonBacklog = (dir: string): string => join(dir, '.git', 'weftwork', 'BACKLOG.md');

function plan(dir: string, tag = 'bigpowers-era'): ConvertPlan {
  const result = planConvert(dir, { tag });
  assert.ok(result.ok, result.ok ? '' : result.error);
  return result.plan;
}

test('AC-e12s03-04 the plan is a dry run: the tag, the moves, the rewrites, the backlog; nothing written', () => {
  const dir = bigpowersRepo();
  const p = plan(dir);
  assert.equal(p.tag, 'bigpowers-era');
  assert.deepEqual(p.moves, [
    { from: 'specs/adr/0001-choice.md', to: 'docs/adr/0001-choice.md' },
    { from: 'specs/bugs/BUG-001-x.md', to: 'docs/bugs/BUG-001-x.md' },
    { from: 'specs', to: '.specs' },
  ]);
  const paths = p.changes.map((change) => `${change.path} ${change.action}`);
  assert.deepEqual(paths.slice(0, 3), ['README.md rewrite', 'src/a.ts rewrite', '.gitignore append']);
  assert.ok(paths[3].endsWith('weftwork/BACKLOG.md create'));
  assert.match(p.changes[0].diff ?? '', /\+Read docs\/bugs\/BUG-001-x\.md, or \.specs\/old\.md, or specs\/ itself\./);
  assert.ok(p.notes.some((note) => note.includes('README.md') && note.includes('still names specs/')));
  assert.ok(p.notes.some((note) => note.includes('docs/bugs/BUG-001-x.md') && note.includes('still names specs/')));
  assert.equal(existsSync(join(dir, '.specs')), false);
  assert.throws(() => execFileSync('git', ['rev-parse', '-q', '--verify', 'refs/tags/bigpowers-era'], { cwd: dir, stdio: 'ignore' }));
});

test('AC-e12s03-05 apply tags HEAD, moves and rewrites, untracks specs/ into .specs/ and seeds the backlog; nothing is lost', () => {
  const dir = bigpowersRepo();
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  const applied = applyConvert(dir, plan(dir));
  assert.ok(applied.ok, applied.ok ? '' : applied.error);
  assert.equal(execFileSync('git', ['rev-parse', 'bigpowers-era^{commit}'], { cwd: dir, encoding: 'utf8' }).trim(), head);
  assert.equal(readFileSync(join(dir, 'docs/bugs/BUG-001-x.md'), 'utf8'), '# Bug one\n\nSee specs/state.yaml.\n');
  assert.equal(readFileSync(join(dir, 'docs/adr/0001-choice.md'), 'utf8'), '# We chose X\n');
  assert.equal(readFileSync(join(dir, 'src/a.ts'), 'utf8'), '// see docs/bugs/BUG-001-x.md.\n');
  assert.equal(existsSync(join(dir, 'specs')), false);
  assert.equal(readFileSync(join(dir, '.specs/notes.md'), 'utf8'), 'not cited\n');
  assert.equal(readFileSync(join(dir, '.specs/state.yaml'), 'utf8'), '---\nactive_flow: null\n');
  assert.match(readFileSync(join(dir, '.gitignore'), 'utf8'), /^\.specs\/$/m);
  assert.match(readFileSync(commonBacklog(dir), 'utf8'), /\*\*e02s01 Next story\.\*\* Done when: Given X then Z/);
  const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: dir, encoding: 'utf8' });
  assert.doesNotMatch(status, /\.specs/);
  assert.match(status, /^ D specs\/notes\.md$/m);
  assert.match(status, /^\?\? docs\/bugs\/BUG-001-x\.md$/m);
});

test('AC-e12s03-06 an existing backlog gets the section appended, once', () => {
  const dir = bigpowersRepo();
  const p = plan(dir);
  const path = commonBacklog(dir);
  execFileSync('mkdir', ['-p', join(dir, '.git', 'weftwork')]);
  writeFileSync(path, '# Backlog\n\n- [ ] Mine\n');
  const again = plan(dir);
  assert.equal(again.changes.find((change) => change.path === path)?.action, 'append');
  assert.ok(applyConvert(dir, again).ok);
  const text = readFileSync(path, 'utf8');
  assert.match(text, /^# Backlog\n\n- \[ \] Mine\n\n## Converted from bigpowers/);
  assert.equal(p.changes.find((change) => change.path === path)?.action, 'create');
});

test('AC-e12s03-07 the plan refuses: no specs/state.yaml, a dirty specs/, an existing tag, an existing .specs/, a move onto a file', () => {
  const plain = makeTestRepo();
  assert.match(String(refusal(plain)), /no bigpowers specs\/state\.yaml/);
  const dirty = bigpowersRepo();
  writeFileSync(join(dirty, 'specs/notes.md'), 'changed\n');
  assert.match(String(refusal(dirty)), /specs\/ has uncommitted changes/);
  const tagged = bigpowersRepo();
  git(tagged, 'tag', 'bigpowers-era');
  assert.match(String(refusal(tagged)), /tag bigpowers-era exists/);
  const copied = bigpowersRepo();
  execFileSync('mkdir', [join(copied, '.specs')]);
  assert.match(String(refusal(copied)), /\.specs exists/);
  const taken = bigpowersRepo();
  execFileSync('mkdir', ['-p', join(taken, 'docs/adr')]);
  writeFileSync(join(taken, 'docs/adr/0001-choice.md'), 'mine\n');
  assert.match(String(refusal(taken)), /docs\/adr\/0001-choice\.md exists/);
  assert.match(String(refusal(makeTempDir())), /not a git repository root/);
});

test('AC-e12s03-08 a file changed after the plan is kept, not rewritten', () => {
  const dir = bigpowersRepo();
  const p = plan(dir);
  writeFileSync(join(dir, 'src/a.ts'), '// mine now, specs/bugs/BUG-001-x.md\n');
  const applied = applyConvert(dir, p);
  assert.ok(applied.ok);
  assert.deepEqual(applied.kept, ['src/a.ts']);
  assert.equal(readFileSync(join(dir, 'src/a.ts'), 'utf8'), '// mine now, specs/bugs/BUG-001-x.md\n');
});

function refusal(dir: string): string | null {
  const result = planConvert(dir, { tag: 'bigpowers-era' });
  return result.ok ? null : result.error;
}

test('AC-e12s03-09 a rewritten script keeps its mode', () => {
  const dir = makeTestRepo({ 'specs/state.yaml': '---\n', 'specs/x.md': 'x\n', 'tools/run.sh': '#!/bin/sh\ncat specs/x.md\n' });
  execFileSync('chmod', ['755', join(dir, 'tools/run.sh')]);
  git(dir, 'commit', '-q', '-am', 'mode');
  assert.ok(applyConvert(dir, plan(dir)).ok);
  assert.equal(readFileSync(join(dir, 'tools/run.sh'), 'utf8'), '#!/bin/sh\ncat docs/x.md\n');
  assert.equal(statSync(join(dir, 'tools/run.sh')).mode & 0o777, 0o755);
});

test('AC-e12s03-13 bigpowers plans and state stay in .specs/ even when cited; the citation is a note', () => {
  const dir = makeTestRepo({
    'specs/state.yaml': '---\n',
    'specs/release-plan.yaml': '---\n',
    'specs/epics/e01-x/epic.yaml': '---\nid: e01\n',
    'specs/AUDIT_LATEST.md': 'a\n',
    'specs/security/REVIEW.md': 'r\n',
    'tools/gate.sh': 'cat specs/state.yaml specs/release-plan.yaml specs/epics/e01-x/epic.yaml specs/AUDIT_LATEST.md specs/security/REVIEW.md\n',
  });
  const p = plan(dir);
  assert.deepEqual(p.moves.map((step) => step.from), ['specs/security/REVIEW.md', 'specs']);
  assert.ok(p.notes.some((note) => note.startsWith('tools/gate.sh still names specs/')));
});
