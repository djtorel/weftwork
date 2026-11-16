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
  const result = planConvert(dir, { system: 'bigpowers', tag });
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
  const result = planConvert(dir, { system: 'bigpowers', tag: 'bigpowers-era' });
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

test('AC-e12s03-14 a .gitignore that cites a moved spec still gets .specs/; the citation is a note', () => {
  const dir = makeTestRepo({ 'specs/state.yaml': '---\n', 'specs/adr/1.md': 'a\n', '.gitignore': 'specs/adr/1.md\n' });
  const p = plan(dir);
  assert.ok(applyConvert(dir, p).ok);
  assert.match(readFileSync(join(dir, '.gitignore'), 'utf8'), /^\.specs\/$/m);
  assert.ok(p.notes.some((note) => note.startsWith('.gitignore still names specs/')));
});

// story: e12s03b
function gsdRepo(): string {
  return makeTestRepo({
    '.planning/PROJECT.md': '# Shop\n\n## Key Decisions\n\n| Decision | Rationale |\n',
    '.planning/ROADMAP.md': '- [x] **Phase 1: Base** - Repo\n- [ ] **Phase 2: Pay** - Pay for a cart\n',
    '.planning/STATE.md': '# State\n',
    '.planning/config.json': '{}\n',
    '.planning/phases/02-pay/02-01-PLAN.md': '# Plan\n\n<objective>\nCharge the card.\n</objective>\n',
    '.planning/phases/03-ship/03-01-PLAN.md': '# Plan\n',
    '.planning/phases/03-ship/03-01-SUMMARY.md': '# Done\n',
    '.planning/codebase/ARCHITECTURE.md': '# Layers\n',
    'README.md': 'See .planning/codebase/ARCHITECTURE.md and .planning/STATE.md.\n',
  });
}

test('AC-e12s03b-04 a GSD plan: tag gsd-era, cited codebase docs into docs/, .planning/ to .gsd-planning/, phases to the backlog', () => {
  const dir = gsdRepo();
  const result = planConvert(dir, { system: 'gsd', tag: 'gsd-era' });
  assert.ok(result.ok, result.ok ? '' : result.error);
  const p = result.plan;
  assert.deepEqual(p.moves, [
    { from: '.planning/codebase/ARCHITECTURE.md', to: 'docs/codebase/ARCHITECTURE.md' },
    { from: '.planning', to: '.gsd-planning' },
  ]);
  assert.equal(p.changes[0].path, 'README.md');
  assert.match(p.changes[0].diff ?? '', /\+See docs\/codebase\/ARCHITECTURE\.md and \.planning\/STATE\.md\./);
  assert.ok(p.notes.some((note) => note.startsWith('README.md still names .planning/')));
  assert.ok(p.notes.some((note) => note.includes('Key Decisions')));
  const applied = applyConvert(dir, p);
  assert.ok(applied.ok, applied.ok ? '' : applied.error);
  assert.equal(readFileSync(join(dir, 'docs/codebase/ARCHITECTURE.md'), 'utf8'), '# Layers\n');
  assert.equal(readFileSync(join(dir, '.gsd-planning/STATE.md'), 'utf8'), '# State\n');
  assert.equal(existsSync(join(dir, '.planning')), false);
  assert.match(readFileSync(join(dir, '.gitignore'), 'utf8'), /^\.gsd-planning\/$/m);
  const backlogText = readFileSync(commonBacklog(dir), 'utf8');
  assert.match(backlogText, /## Converted from GSD/);
  assert.match(backlogText, /- \[ \] \*\*Phase 2: Pay\.\*\* Goal: Pay for a cart\n {2}Open plan 02-01: Charge the card\. \(02-01-PLAN\.md, not on the roadmap\)\n {2}Old spec: `\.gsd-planning\/phases\/02-pay\/`/);
  assert.doesNotMatch(backlogText, /Phase 1|Phase 3/);
  assert.doesNotMatch(execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: dir, encoding: 'utf8' }), /gsd-planning/);
});

test('AC-e12s03b-05 the GSD plan refuses: no .planning/, a dirty .planning/, an existing .gsd-planning/', () => {
  const refuse = (dir: string): string | null => {
    const result = planConvert(dir, { system: 'gsd', tag: 'gsd-era' });
    return result.ok ? null : result.error;
  };
  assert.match(String(refuse(makeTestRepo())), /no GSD \.planning\//);
  const dirty = gsdRepo();
  writeFileSync(join(dirty, '.planning/STATE.md'), 'changed\n');
  assert.match(String(refuse(dirty)), /\.planning\/ has uncommitted changes/);
  const copied = gsdRepo();
  execFileSync('mkdir', [join(copied, '.gsd-planning')]);
  assert.match(String(refuse(copied)), /\.gsd-planning exists/);
});

test('AC-e12s03-17 a tracked file that names the plans folder as a quoted string is a note: a path built in code', () => {
  const dir = makeTestRepo({
    'specs/state.yaml': '---\nactive_flow: null\n',
    'tools/state.ts': "const path = join(root, 'specs', 'state.yaml');\n",
    'tools/other.py': 'ROOT = "specs-old"\n',
  });
  const notes = plan(dir).notes;
  assert.ok(notes.some((note) => note === 'tools/state.ts names "specs" as a string: a path built in code (join(\'specs\', ...)) breaks when specs/ moves; check it.'), notes.join('\n'));
  assert.ok(!notes.some((note) => note.startsWith('tools/other.py')), notes.join('\n'));
});
