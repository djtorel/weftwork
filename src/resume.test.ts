// story: e08s04
// The resume report: does the handoff block still match the repository?
// Pure, over facts, so each rule of spec section 1 (decisions 1, 2 and 4) is
// tested without a repository. Cases follow AC-e08s04-01 to AC-e08s04-05.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeReport, type ResumeFacts } from './resume.ts';

/** A block as the e08s03 writer leaves it. */
function block(change: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    next_skill: 'develop-tdd',
    next_story: 'e08s04',
    next_epic: 'e08',
    branch: 'main',
    written_at: '2026-11-14T01:00:00Z',
    files: ['docs/a.md', 'build'],
    uncommitted: ['notes.txt'],
    note: 'a note',
    ...change,
  };
}

/** The repository as the block says it is. */
function facts(change: Partial<ResumeFacts> = {}): ResumeFacts {
  const present = new Set(['docs/a.md', 'build']);
  return { branch: 'main', uncommitted: ['notes.txt'], exists: (path) => present.has(path), ...change };
}

test('AC-01 a block that matches the repository is ready, with no reasons', () => {
  const report = resumeReport(block(), facts());
  assert.equal(report.answer, 'ready');
  assert.deepEqual(report.reasons, []);
  assert.deepEqual(report.notes, []);
  assert.equal(report.next_skill, 'develop-tdd');
});

test('AC-02 another branch is stale, and the reason names both branches', () => {
  const report = resumeReport(block(), facts({ branch: 'e08s04-handoff-check' }));
  assert.equal(report.answer, 'stale');
  assert.equal(report.reasons.length, 1);
  assert.match(report.reasons[0] ?? '', /e08s04-handoff-check/);
  assert.match(report.reasons[0] ?? '', /main/);
});

test('AC-02 a detached HEAD is stale: it is not the handoff branch', () => {
  const report = resumeReport(block(), facts({ branch: null }));
  assert.equal(report.answer, 'stale');
  assert.equal(report.reasons.length, 1);
  assert.match(report.reasons[0] ?? '', /detached/);
  assert.match(report.reasons[0] ?? '', /main/);
});

test('AC-02 a file the block names that is gone is stale, and the reason names it', () => {
  const report = resumeReport(block(), facts({ exists: (path) => path === 'build' }));
  assert.equal(report.answer, 'stale');
  assert.equal(report.reasons.length, 1);
  assert.match(report.reasons[0] ?? '', /docs\/a\.md/);
});

test('AC-02 a path uncommitted now that the block did not list is stale, and the reason names it', () => {
  const report = resumeReport(block(), facts({ uncommitted: ['notes.txt', 'src/new.ts'] }));
  assert.equal(report.answer, 'stale');
  assert.equal(report.reasons.length, 1);
  assert.match(report.reasons[0] ?? '', /src\/new\.ts/);
});

test('AC-02 an untracked folder compares as git lists it, dir/ then and now', () => {
  const report = resumeReport(block({ uncommitted: ['out/'] }), facts({ uncommitted: ['out/'] }));
  assert.equal(report.answer, 'ready');
});

test('AC-03 several faults give one reason each, the branch first', () => {
  const report = resumeReport(block(), facts({ branch: 'other', exists: () => false }));
  assert.equal(report.answer, 'stale');
  assert.equal(report.reasons.length, 3);
  assert.match(report.reasons[0] ?? '', /other/);
  // Each list in sorted order, whatever order the block or git gave.
  assert.match(report.reasons[1] ?? '', /build/);
  assert.match(report.reasons[2] ?? '', /docs\/a\.md/);
});

test('AC-03 every unexpected uncommitted path is a reason, in sorted order', () => {
  const report = resumeReport(block({ uncommitted: [] }), facts({ uncommitted: ['z.txt', 'a.txt'] }));
  assert.equal(report.answer, 'stale');
  assert.equal(report.reasons.length, 2);
  assert.match(report.reasons[0] ?? '', /a\.txt/);
  assert.match(report.reasons[1] ?? '', /z\.txt/);
});

test('AC-04 a path uncommitted then and clean now is a note, not a reason', () => {
  const report = resumeReport(block(), facts({ uncommitted: [] }));
  assert.equal(report.answer, 'ready');
  assert.deepEqual(report.reasons, []);
  assert.equal(report.notes.length, 1);
  assert.match(report.notes[0] ?? '', /notes\.txt/);
});

test('AC-05 no handoff block, or a null one, is missing', () => {
  for (const handoff of [undefined, null]) {
    const report = resumeReport(handoff, facts());
    assert.equal(report.answer, 'missing', String(handoff));
    assert.equal(report.reasons.length, 1);
    assert.equal(report.next_skill, null);
  }
});

test('AC-05 a block that cannot be checked is unverifiable, and the reason names the key', () => {
  const cases: [string, unknown, RegExp][] = [
    ['no branch', block({ branch: undefined }), /branch/],
    ['branch not text', block({ branch: 7 }), /branch/],
    ['files is text', block({ files: 'docs/a.md' }), /files/],
    ['files holds a number', block({ files: ['docs/a.md', 1] }), /files/],
    ['uncommitted is a mapping', block({ uncommitted: { a: 1 } }), /uncommitted/],
    ['a list', ['main'], /mapping/],
    ['text', 'main', /mapping/],
  ];
  for (const [name, handoff, named] of cases) {
    const report = resumeReport(handoff, facts());
    assert.equal(report.answer, 'unverifiable', name);
    assert.equal(report.reasons.length, 1, name);
    assert.match(report.reasons[0] ?? '', named, name);
  }
});

test('AC-05 a block without files or uncommitted reads them as empty lists', () => {
  const handoff = block();
  delete handoff['files'];
  delete handoff['uncommitted'];
  assert.equal(resumeReport(handoff, facts({ uncommitted: [] })).answer, 'ready');
  // Errs toward stale: with no list, any dirty path is unexpected.
  assert.equal(resumeReport(handoff, facts()).answer, 'stale');
});

test('next_skill is null when the block holds no text for it', () => {
  assert.equal(resumeReport(block({ next_skill: 3 }), facts()).next_skill, null);
});
