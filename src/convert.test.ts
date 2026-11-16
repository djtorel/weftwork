// story: e12s03
// Converting a bigpowers project: the plan is a dry run; apply tags the last
// commit that tracks specs/, moves the files that code or docs cite (and the
// ADRs) into docs/ and rewrites the citations, moves the rest of specs/ into
// the gitignored .specs/, and adds the open work to the local backlog. Nothing
// is deleted.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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

function speckitRepo(): string {
  return makeTestRepo({
    '.specify/memory/constitution.md': '# Constitution\n\n## Core Principles\n',
    '.specify/templates/spec-template.md': '# Feature Specification: [FEATURE NAME]\n',
    'specs/001-albums/spec.md': '# Feature Specification: Albums\n',
    'specs/001-albums/tasks.md': '- [x] T001 Set up in a.py\n- [ ] T002 [US1] Make albums in b.py\n',
    'specs/001-albums/contracts/albums.yaml': 'openapi: 3.1.0\n',
    'specs/002-done/tasks.md': '- [x] T001 Done in c.py\n',
    'README.md': 'API: specs/001-albums/contracts/albums.yaml. Plan: specs/001-albums/spec.md.\n',
  });
}

test('AC-e12s03c-03 a spec-kit project: tag, cited contracts into docs/, specs/ to .speckit-specs/, open features to the backlog, notes for .specify/', () => {
  const dir = speckitRepo();
  const result = planConvert(dir, { system: 'spec-kit', tag: 'speckit-era' });
  assert.ok(result.ok, result.ok ? '' : result.error);
  const p = result.plan;
  assert.deepEqual(p.moves, [
    { from: 'specs/001-albums/contracts/albums.yaml', to: 'docs/001-albums/contracts/albums.yaml' },
    { from: 'specs', to: '.speckit-specs' },
  ]);
  assert.ok(p.notes.some((note) => note.startsWith('.specify/memory/constitution.md holds the project')), p.notes.join('\n'));
  assert.ok(p.notes.some((note) => note.startsWith('.specify/ stays tracked')), p.notes.join('\n'));
  const applied = applyConvert(dir, p);
  assert.ok(applied.ok, applied.ok ? '' : applied.error);
  assert.equal(readFileSync(join(dir, 'docs/001-albums/contracts/albums.yaml'), 'utf8'), 'openapi: 3.1.0\n');
  assert.equal(readFileSync(join(dir, 'README.md'), 'utf8'), 'API: docs/001-albums/contracts/albums.yaml. Plan: specs/001-albums/spec.md.\n');
  assert.equal(existsSync(join(dir, 'specs')), false);
  assert.match(readFileSync(join(dir, '.gitignore'), 'utf8'), /^\.speckit-specs\/$/m);
  const backlogText = readFileSync(commonBacklog(dir), 'utf8');
  assert.match(backlogText, /- \[ \] \*\*001-albums Albums\.\*\*\n {2}Open task T002 \\\[US1\] Make albums in b\.py\n/);
  assert.doesNotMatch(backlogText, /002-done/);
});

test('AC-e12s03c-04 the spec-kit plan refuses: no .specify/, no specs/, a dirty specs/', () => {
  const refuse = (dir: string): string | null => {
    const result = planConvert(dir, { system: 'spec-kit', tag: 'speckit-era' });
    return result.ok ? null : result.error;
  };
  assert.match(String(refuse(makeTestRepo())), /no spec-kit \.specify/);
  assert.match(String(refuse(makeTestRepo({ '.specify/memory/constitution.md': '#\n' }))), /no specs\/ to convert/);
  const dirty = speckitRepo();
  writeFileSync(join(dirty, 'specs/001-albums/tasks.md'), 'changed\n');
  assert.match(String(refuse(dirty)), /specs\/ has uncommitted changes/);
});

function bmadRepo(): string {
  return makeTestRepo({
    '_bmad/bmm/config.yaml': 'project_name: Plants\n',
    '_bmad-output/planning-artifacts/prd.md': '# PRD\n',
    '_bmad-output/planning-artifacts/architecture.md': '# Architecture\n',
    '_bmad-output/planning-artifacts/epics.md': '## Epic 1: Accounts\n\nSign up.\n\n### Story 1.1: Log in\n\n### Story 1.2: Profile\n',
    '_bmad-output/implementation-artifacts/sprint-status.yaml': 'development_status:\n  epic-1: in-progress\n  1-1-log-in: done\n  1-2-profile: in-progress\n',
    '_bmad-output/implementation-artifacts/1-2-profile.md': '# Story 1.2: Profile\n\nStatus: in-progress\n',
    'README.md': 'Design: _bmad-output/planning-artifacts/architecture.md. Plan: _bmad-output/planning-artifacts/epics.md.\n',
  });
}

test('AC-e12s03c-08 a BMAD v6 project: tag, cited docs into docs/, _bmad-output/ to .bmad-output/, open stories to the backlog, a note for _bmad/', () => {
  const dir = bmadRepo();
  const result = planConvert(dir, { system: 'bmad', tag: 'bmad-era' });
  assert.ok(result.ok, result.ok ? '' : result.error);
  const p = result.plan;
  assert.deepEqual(p.moves, [
    { from: '_bmad-output/planning-artifacts/architecture.md', to: 'docs/planning-artifacts/architecture.md' },
    { from: '_bmad-output', to: '.bmad-output' },
  ]);
  assert.ok(p.notes.some((note) => note.startsWith('_bmad/ stays tracked')), p.notes.join('\n'));
  const applied = applyConvert(dir, p);
  assert.ok(applied.ok, applied.ok ? '' : applied.error);
  assert.equal(readFileSync(join(dir, 'docs/planning-artifacts/architecture.md'), 'utf8'), '# Architecture\n');
  assert.equal(existsSync(join(dir, '_bmad-output')), false);
  assert.match(readFileSync(join(dir, '.gitignore'), 'utf8'), /^\.bmad-output\/$/m);
  const backlogText = readFileSync(commonBacklog(dir), 'utf8');
  assert.match(backlogText, /### Epic 1: Accounts\n\nGoal: Sign up\.\nOld spec: `\.bmad-output\/planning-artifacts\/`\n\n- \[ \] \*\*Story 1\.2 Profile\.\*\* Status: in-progress\n {2}Old spec: `\.bmad-output\/implementation-artifacts\/1-2-profile\.md`/);
  assert.doesNotMatch(backlogText, /Story 1\.1/);
});

test('AC-e12s03c-09 the BMAD plan refuses: no _bmad/, no _bmad-output/, and the ticket-tree layout', () => {
  const refuse = (dir: string): string | null => {
    const result = planConvert(dir, { system: 'bmad', tag: 'bmad-era' });
    return result.ok ? null : result.error;
  };
  assert.match(String(refuse(makeTestRepo())), /no BMAD _bmad/);
  assert.match(String(refuse(makeTestRepo({ '_bmad/x.yaml': '\n' }))), /no _bmad-output\/ to convert/);
  const tree = makeTestRepo({ '_bmad/x.yaml': '\n', '_bmad-output/initiative-shop/tickets/tickets.toml': '\n' });
  assert.match(String(refuse(tree)), /ticket tree .*is not converted yet/);
});

// story: e12s03d
// A BMAD v4.44.3 project: .bmad-core/core-config.yaml (devStoryLocation,
// prd.prdSharded, prd.prdShardedLocation, prd.epicFilePattern), the sharded
// PRD and story files from story-tmpl.yaml.
const bmadV4Config = 'markdownExploder: true\nprd:\n  prdFile: docs/prd.md\n  prdVersion: v4\n  prdSharded: true\n  prdShardedLocation: docs/prd\n  epicFilePattern: epic-{n}*.md\ndevStoryLocation: docs/stories\n';
const bmadV4Story = (number: string, title: string, status: string): string => `# Story ${number}: ${title}\n\n## Status\n\n${status}\n\n## Story\n\n**As a** user,\n`;
function bmadV4Repo(extra: Record<string, string> = {}): string {
  return makeTestRepo({
    '.bmad-core/core-config.yaml': bmadV4Config,
    'docs/prd.md': '# Plants Product Requirements Document (PRD)\n',
    'docs/prd/index.md': '# Plants PRD\n',
    'docs/prd/epic-1-foundation.md': '# Epic 1 Foundation\n\nSet up.\n\n## Story 1.1 Repo\n\n## Story 1.2 Health check\n',
    'docs/architecture.md': '# Architecture\n',
    'docs/stories/1.1.repo.md': bmadV4Story('1.1', 'Repo', 'Done'),
    'docs/stories/1.2.health-check.md': bmadV4Story('1.2', 'Health check', 'Review'),
    'README.md': 'Stories: docs/stories/1.2.health-check.md. Design: docs/architecture.md.\n',
    ...extra,
  });
}

test('AC-e12s03d-03 a BMAD v4 project: tag, docs/stories/ to .bmad-stories/, the PRD stays, open stories to the backlog, a note for .bmad-core/', () => {
  const dir = bmadV4Repo();
  const result = planConvert(dir, { system: 'bmad-v4', tag: 'bmad-era' });
  assert.ok(result.ok, result.ok ? '' : result.error);
  const p = result.plan;
  assert.deepEqual(p.moves, [{ from: 'docs/stories', to: '.bmad-stories' }]);
  assert.ok(p.notes.some((note) => note.startsWith('.bmad-core/ stays tracked')), p.notes.join('\n'));
  assert.ok(p.notes.some((note) => note.startsWith('README.md still names docs/stories/')), p.notes.join('\n'));
  const applied = applyConvert(dir, p);
  assert.ok(applied.ok, applied.ok ? '' : applied.error);
  assert.equal(execFileSync('git', ['tag'], { cwd: dir, encoding: 'utf8' }), 'bmad-era\n');
  assert.equal(existsSync(join(dir, 'docs/stories')), false);
  assert.equal(readFileSync(join(dir, '.bmad-stories/1.2.health-check.md'), 'utf8'), bmadV4Story('1.2', 'Health check', 'Review'));
  assert.equal(readFileSync(join(dir, 'docs/prd/epic-1-foundation.md'), 'utf8').startsWith('# Epic 1'), true);
  assert.match(readFileSync(join(dir, '.gitignore'), 'utf8'), /^\.bmad-stories\/$/m);
  const backlogText = readFileSync(commonBacklog(dir), 'utf8');
  assert.match(backlogText, /### Epic 1: Foundation\n\nGoal: Set up\.\nPRD: `docs\/prd\/`\n\n- \[ \] \*\*Story 1\.2 Health check\.\*\* Status: Review\n {2}Old spec: `\.bmad-stories\/1\.2\.health-check\.md`/);
  assert.doesNotMatch(backlogText, /Story 1\.1/);
});

test('AC-e12s03d-04 BMAD v4 reads devStoryLocation and an unsharded PRD from core-config.yaml', () => {
  const dir = makeTestRepo({
    '.bmad-core/core-config.yaml': 'prd:\n  prdFile: plans/prd.md\n  prdSharded: false\ndevStoryLocation: plans/stories\n',
    'plans/prd.md': '# PRD\n\n## Epic 1 Foundation\n\nSet up.\n\n### Story 1.1 Repo\n',
    'plans/stories/1.1.repo.md': bmadV4Story('1.1', 'Repo', 'Draft'),
  });
  const result = planConvert(dir, { system: 'bmad-v4', tag: 'bmad-era' });
  assert.ok(result.ok, result.ok ? '' : result.error);
  assert.deepEqual(result.plan.moves, [{ from: 'plans/stories', to: '.bmad-stories' }]);
  const backlog = result.plan.changes.find((change) => change.path.endsWith('BACKLOG.md'));
  assert.match(String(backlog?.diff), /PRD: `plans\/prd\.md`/);
  assert.match(String(backlog?.diff), /Story 1\.1 Repo\.\*\* Status: Draft/);
});

test('AC-e12s03d-05 the BMAD v4 plan refuses: no .bmad-core/, no story folder, a devStoryLocation outside the project, a dirty story folder', () => {
  const refuse = (dir: string): string | null => {
    const result = planConvert(dir, { system: 'bmad-v4', tag: 'bmad-era' });
    return result.ok ? null : result.error;
  };
  assert.match(String(refuse(makeTestRepo())), /no BMAD v4 \.bmad-core/);
  assert.match(String(refuse(makeTestRepo({ '.bmad-core/core-config.yaml': bmadV4Config }))), /no docs\/stories\/ to convert/);
  assert.match(String(refuse(makeTestRepo({ '.bmad-core/core-config.yaml': 'devStoryLocation: ../elsewhere\n' }))), /devStoryLocation .*not a plain path/);
  const dirty = bmadV4Repo();
  writeFileSync(join(dirty, 'docs/stories/1.2.health-check.md'), 'changed\n');
  assert.match(String(refuse(dirty)), /docs\/stories\/ has uncommitted changes/);
});

const gsd2Roadmap = '# M001: Flight\n\n**Vision:** Fly.\n\n## Slices\n\n- [x] **S01: Physics**\n- [ ] **S02: Controls**\n';
const gsd2Files = {
  '.gsd/PROJECT.md': '# Flight\n',
  '.gsd/DECISIONS.md': '# Decisions\n',
  '.gsd/milestones/M001/M001-ROADMAP.md': gsd2Roadmap,
  '.gsd/milestones/M001/slices/S02/S02-PLAN.md': '# S02: Controls\n\n## Tasks\n\n- [ ] **T01: Keys**\n- [ ] **T02: Mouse**\n',
  '.gsd/milestones/M001/slices/S02/tasks/T01-SUMMARY.md': '# T01\n',
};

test('AC-e12s03b-16 a GSD 2 project with .gsd/ ignored: backlog only, no tag, nothing moved', () => {
  const dir = makeTestRepo({ '.gitignore': '.gsd\n', 'README.md': 'Flight.\n' });
  for (const [path, text] of Object.entries(gsd2Files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  const result = planConvert(dir, { system: 'gsd2', tag: 'gsd2-era' });
  assert.ok(result.ok, result.ok ? '' : result.error);
  const p = result.plan;
  assert.equal(p.tag, '');
  assert.deepEqual(p.moves, []);
  assert.deepEqual(p.changes.map((change) => change.action), ['create']);
  assert.ok(p.notes.some((note) => note.startsWith('.gsd/ is not tracked by git')), p.notes.join('\n'));
  assert.ok(p.notes.some((note) => note.startsWith('.gsd/DECISIONS.md holds')), p.notes.join('\n'));
  const applied = applyConvert(dir, p);
  assert.ok(applied.ok, applied.ok ? '' : applied.error);
  assert.equal(execFileSync('git', ['tag'], { cwd: dir, encoding: 'utf8' }), '');
  assert.ok(existsSync(join(dir, '.gsd/milestones/M001/M001-ROADMAP.md')));
  const backlogText = readFileSync(commonBacklog(dir), 'utf8');
  assert.match(backlogText, /### M001: Flight\n\nGoal: Fly\.\nOld spec: `\.gsd\/milestones\/M001\/`\n\n- \[ \] \*\*S02: Controls\.\*\*\n {2}Open task T02: Mouse\n/);
  assert.match(backlogText, /The old plans stay in `\.gsd\/`, which git does not track\./);
});

test('AC-e12s03b-17 a GSD 2 project that tracks .gsd/: tag gsd2-era and .gsd/ to .gsd2-plans/, as for GSD', () => {
  const dir = makeTestRepo({ ...gsd2Files, 'README.md': 'Flight.\n' });
  const result = planConvert(dir, { system: 'gsd2', tag: 'gsd2-era' });
  assert.ok(result.ok, result.ok ? '' : result.error);
  assert.deepEqual(result.plan.moves, [{ from: '.gsd', to: '.gsd2-plans' }]);
  const applied = applyConvert(dir, result.plan);
  assert.ok(applied.ok, applied.ok ? '' : applied.error);
  assert.equal(execFileSync('git', ['tag'], { cwd: dir, encoding: 'utf8' }), 'gsd2-era\n');
  assert.ok(existsSync(join(dir, '.gsd2-plans/milestones/M001/M001-ROADMAP.md')));
  assert.match(readFileSync(commonBacklog(dir), 'utf8'), /Old spec: `\.gsd2-plans\/milestones\/M001\/slices\/S02\/`/);
});
