// story: e16s02
// The round page: each mark keeps the number drawn on its box, even when the
// reviewers marked the images in turn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundMarkdown, type RoundSummary } from './design-record.ts';

test('marks on two images, made in turn, keep their numbers on each image', () => {
  const summary: RoundSummary = { round: 1, at: 'now', outcome: 'changes', grades: {}, mean: 3, marks: 3, mustFix: 0, compare: [], stop: null, images: ['a.png', 'b.png'], markTexts: [] };
  const mark = (n: number, image: string) => ({ kind: 'mark' as const, image, box: null, criterion: 'layout', text: `m${n}`, n, reviewer: 'codex' });
  const page = roundMarkdown({
    record: { branch: 'main', loop: 'app', rounds: [] },
    summary,
    brief: 'b',
    pass: 4,
    maxRounds: 5,
    reviewers: [{ name: 'codex', ok: true, grades: {} }],
    marks: [mark(1, 'a.png'), mark(2, 'b.png'), mark(3, 'a.png')],
    marked: { 'a.png': null, 'b.png': null },
  });
  const section = page.slice(page.indexOf('### a.png'), page.indexOf('### b.png'));
  assert.match(section, /^- \*\*1\.\*\* \*\*layout\*\*.*m1$/m);
  assert.match(section, /^- \*\*3\.\*\* \*\*layout\*\*.*m3$/m);
});
