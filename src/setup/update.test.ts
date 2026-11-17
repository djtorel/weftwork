// Updating a project that weftwork set up: each skill file that still holds
// a text weftwork shipped gets the text of this version; a file the owner
// changed is kept; a skill this version adds is created; a skill folder from
// before the rename is deleted when it holds only a text weftwork shipped.
// AGENTS.md and the backlog are the owner's and never in the plan.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { oldSkillFolders, skillTexts } from './setup.ts';
import { shippedSkillTexts } from './skill-hashes.ts';
import { applyUpdate, behind, planUpdate, sha256, type Shipped, type UpdatePlan } from './update.ts';
import { cleanupTempDirs, makeTestRepo } from '../test-support/test-helpers.ts';

after(cleanupTempDirs);

const engineDir = join(import.meta.dirname, '..', '..');

/** This version's skill files, by their path under .claude/skills/. */
function current(): Map<string, string> {
  const texts = skillTexts(engineDir);
  assert.ok(texts.ok, texts.ok ? '' : texts.error);
  return new Map(texts.files.map(([path, text]) => [path.replace('.claude/skills/', ''), text]));
}

/** A project with every skill file of this version written. */
function setUp(over: Record<string, string> = {}): string {
  const files: Record<string, string> = { 'AGENTS.md': '# mine\n' };
  for (const [name, text] of current()) files[`.claude/skills/${name}`] = text;
  return makeTestRepo({ ...files, ...over });
}

/** An older text of `name`, as an earlier version shipped it. */
const older = (name: string) => `${current().get(name) ?? ''}\nA line an older version had.\n`;

/** The real table with `extra` texts added as shipped. */
function shippedWith(extra: Record<string, string>): Shipped {
  const table: Record<string, string[]> = {};
  for (const [name, hashes] of Object.entries(shippedSkillTexts)) table[name] = [...hashes];
  for (const [name, text] of Object.entries(extra)) table[name] = [...(table[name] ?? []), sha256(text)];
  return table;
}

function plan(dir: string, shipped?: Shipped): UpdatePlan {
  const planned = planUpdate(dir, engineDir, shipped);
  assert.ok(planned.ok, planned.ok ? '' : planned.error);
  return planned.plan;
}

const action = (p: UpdatePlan, path: string) => p.changes.find((change) => change.path === path)?.action;

test('every skill text setup writes now is in the table of shipped texts', () => {
  for (const [name, text] of current()) {
    const hash = sha256(text);
    assert.ok(shippedSkillTexts[name]?.includes(hash), `add '${hash}' to '${name}' in src/setup/skill-hashes.ts`);
  }
});

test('each skill folder weftwork ever shipped is a skill of this version or an old folder that update deletes', () => {
  const now = new Set([...current().keys()].map((name) => name.split('/')[0]));
  for (const name of Object.keys(shippedSkillTexts).filter((name) => name.includes('/'))) {
    const folder = name.split('/')[0];
    assert.ok(now.has(folder) || oldSkillFolders.includes(folder), `add '${folder}' to oldSkillFolders in src/setup/setup.ts`);
  }
});

test('a project set up under the weft- names gets them deleted, since it holds only shipped texts', () => {
  const [name, hashes] = ['weft-ready/SKILL.md', shippedSkillTexts['weft-ready/SKILL.md']];
  assert.ok(hashes !== undefined && hashes.length > 0, 'the weft-ready texts stay in the table');
  const shippedOld = '# the weft-ready skill, as shipped\n';
  const dir = makeTestRepo({ [`.claude/skills/${name}`]: shippedOld });
  const p = plan(dir, shippedWith({ [name]: shippedOld }));
  assert.equal(action(p, `.claude/skills/${name}`), 'delete');
  assert.equal(action(p, '.claude/skills/all-ready/SKILL.md'), 'create');
  assert.equal(action(p, '.claude/skills/all-in/SKILL.md'), 'create');
  const applied = applyUpdate(dir, p);
  assert.ok(applied.ok, applied.ok ? '' : applied.error);
  assert.equal(existsSync(join(dir, '.claude/skills/weft-ready')), false);
});

test('a project set up by this version is up to date, and the plan writes nothing', () => {
  const p = plan(setUp());
  assert.equal(behind(p), 0);
  assert.ok(p.changes.every((change) => change.action === 'unchanged'), JSON.stringify(p.changes.map((c) => [c.path, c.action])));
});

test('a skill file that holds a text an older version shipped is updated in place, with no file moved aside', () => {
  const old = older('all-ready/SKILL.md');
  const dir = setUp({ '.claude/skills/all-ready/SKILL.md': old });
  const p = plan(dir, shippedWith({ 'all-ready/SKILL.md': old }));
  assert.equal(action(p, '.claude/skills/all-ready/SKILL.md'), 'update');
  assert.equal(behind(p), 1);
  const applied = applyUpdate(dir, p);
  assert.ok(applied.ok, applied.ok ? '' : applied.error);
  assert.deepEqual(applied.written, ['.claude/skills/all-ready/SKILL.md']);
  assert.equal(readFileSync(join(dir, '.claude/skills/all-ready/SKILL.md'), 'utf8'), current().get('all-ready/SKILL.md'));
  assert.equal(existsSync(join(dir, '.claude/skills/all-ready/SKILL.md.weftwork-old')), false);
  assert.equal(behind(plan(dir)), 0, 'a second update has nothing to do');
});

test('a skill file the owner changed is kept, with a diff, and never written', () => {
  const dir = setUp({ '.claude/skills/pr-it/SKILL.md': '# my own PR skill\n' });
  const p = plan(dir);
  const change = p.changes.find((c) => c.path === '.claude/skills/pr-it/SKILL.md');
  assert.equal(change?.action, 'edited');
  assert.match(change?.diff ?? '', /my own PR skill/);
  assert.equal(behind(p), 0);
  const applied = applyUpdate(dir, p);
  assert.ok(applied.ok);
  assert.equal(readFileSync(join(dir, '.claude/skills/pr-it/SKILL.md'), 'utf8'), '# my own PR skill\n');
});

test('a skill this version adds is created', () => {
  const dir = setUp();
  rmSync(join(dir, '.claude/skills/retro'), { recursive: true });
  const p = plan(dir);
  assert.equal(action(p, '.claude/skills/retro/SKILL.md'), 'create');
  const applied = applyUpdate(dir, p);
  assert.ok(applied.ok);
  assert.equal(readFileSync(join(dir, '.claude/skills/retro/SKILL.md'), 'utf8'), current().get('retro/SKILL.md'));
});

test('a skill folder from before the rename is deleted when it holds only a shipped text, and kept when changed', () => {
  const shippedOld = '# the old ready skill, as shipped\n';
  const dir = makeTestRepo({
    '.claude/skills/full-stop/SKILL.md': shippedOld,
    '.claude/skills/file-pr/SKILL.md': '# the old PR skill, edited by the owner\n',
    '.claude/skills/review-loop/SKILL.md': shippedOld,
    '.claude/skills/review-loop/notes.md': 'the owner put this here\n',
  });
  const p = plan(dir, shippedWith({ 'full-stop/SKILL.md': shippedOld, 'review-loop/SKILL.md': shippedOld }));
  assert.equal(action(p, '.claude/skills/full-stop/SKILL.md'), 'delete');
  assert.equal(action(p, '.claude/skills/file-pr'), 'keep-old');
  assert.equal(action(p, '.claude/skills/review-loop'), 'keep-old');
  assert.equal(action(p, '.claude/skills/all-ready/SKILL.md'), 'create', 'the renamed skills are created');
  const applied = applyUpdate(dir, p);
  assert.ok(applied.ok, applied.ok ? '' : applied.error);
  assert.deepEqual(applied.deleted, ['.claude/skills/full-stop/SKILL.md']);
  assert.equal(existsSync(join(dir, '.claude/skills/full-stop')), false, 'the empty folder goes too');
  assert.equal(readFileSync(join(dir, '.claude/skills/file-pr/SKILL.md'), 'utf8'), '# the old PR skill, edited by the owner\n');
  assert.ok(existsSync(join(dir, '.claude/skills/review-loop/notes.md')));
});

test('an old folder that gains a file between the plan and the write is kept whole (review r1m1)', () => {
  const shippedOld = '# the old ready skill, as shipped\n';
  const dir = makeTestRepo({ '.claude/skills/full-stop/SKILL.md': shippedOld });
  const p = plan(dir, shippedWith({ 'full-stop/SKILL.md': shippedOld }));
  assert.equal(action(p, '.claude/skills/full-stop/SKILL.md'), 'delete');
  writeFileSync(join(dir, '.claude/skills/full-stop/notes.md'), 'added after the plan\n');
  const applied = applyUpdate(dir, p);
  assert.ok(applied.ok, applied.ok ? '' : applied.error);
  assert.deepEqual(applied.deleted, []);
  assert.deepEqual(applied.kept, ['.claude/skills/full-stop/SKILL.md']);
  assert.equal(readFileSync(join(dir, '.claude/skills/full-stop/SKILL.md'), 'utf8'), shippedOld);
  assert.ok(existsSync(join(dir, '.claude/skills/full-stop/notes.md')));
});

test('AGENTS.md, CLAUDE.md, CONVENTIONS.md and the backlog are never in the plan', () => {
  const p = plan(setUp({ 'CONVENTIONS.md': '# mine\n' }));
  const paths = p.changes.map((change) => change.path);
  assert.ok(paths.every((path) => path.startsWith('.claude/skills/')), paths.join(', '));
});

test('a folder with no weftwork skills is refused: set it up first', () => {
  const planned = planUpdate(makeTestRepo({ 'README.md': '# x\n' }), engineDir);
  assert.equal(planned.ok, false);
  assert.match(planned.ok ? '' : planned.error, /no weftwork skills.*weftwork init/);
});

test('a file that changed between the plan and the write is kept', () => {
  const old = older('second-opinion/SKILL.md');
  const dir = setUp({ '.claude/skills/second-opinion/SKILL.md': old });
  const p = plan(dir, shippedWith({ 'second-opinion/SKILL.md': old }));
  writeFileSync(join(dir, '.claude/skills/second-opinion/SKILL.md'), '# changed meanwhile\n');
  const applied = applyUpdate(dir, p);
  assert.ok(applied.ok);
  assert.deepEqual(applied.kept, ['.claude/skills/second-opinion/SKILL.md']);
  assert.equal(readFileSync(join(dir, '.claude/skills/second-opinion/SKILL.md'), 'utf8'), '# changed meanwhile\n');
});

test('a skills folder that is a symlink is refused, so an update never writes outside the project', () => {
  const elsewhere = makeTestRepo({ 'all-ready/SKILL.md': '# x\n' });
  const dir = makeTestRepo({ 'AGENTS.md': '# mine\n' });
  mkdirSync(join(dir, '.claude'));
  symlinkSync(elsewhere, join(dir, '.claude/skills'));
  const planned = planUpdate(dir, engineDir);
  assert.equal(planned.ok, false);
  assert.match(planned.ok ? '' : planned.error, /symlink/);
});
