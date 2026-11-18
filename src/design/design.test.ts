// story: e16s02
// One design round: the reply a reviewer gives is read into grades and marks,
// the engine decides the round from the lowest grade of each criterion, and
// the loop stops at its ceiling or when the grades stop rising.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criteria, designPrompt, lowestGrades, loopStop, meanGrade, parseDesignReply, roundOutcome, type DesignResult } from './design.ts';

const allFour = criteria.map((c) => `GRADE ${c.key}: 4 fine`).join('\n');

test('a reply grades every criterion; marks keep their image, box and criterion', () => {
  const reply = `${allFour.replace('GRADE layout: 4 fine', 'GRADE layout: 2 the cards overlap')}
MARK home.png 10,20,300,40 layout: The cards overlap the footer. Fix: give the list a bottom margin of 24px.
MARK home.png - hierarchy: Two buttons look the same. Fix: make Save the filled one.
MUST-FIX home.png 0,0,390,60 layout: The header text is cut off at 390px. Fix: let it wrap.
COMPARE: BETTER`;
  const parsed = parseDesignReply(reply, ['home.png']);
  assert.ok(parsed.ok);
  assert.equal(parsed.grades['layout'], 2);
  assert.equal(parsed.grades['purpose'], 4);
  assert.equal(parsed.marks.length, 3);
  assert.deepEqual(parsed.marks[0], { kind: 'mark', image: 'home.png', box: { x: 10, y: 20, w: 300, h: 40 }, criterion: 'layout', text: 'The cards overlap the footer. Fix: give the list a bottom margin of 24px.' });
  assert.equal(parsed.marks[1]?.box, null);
  assert.equal(parsed.marks[2]?.kind, 'must-fix');
  assert.equal(parsed.compare, 'better');
});

test('n/a is a grade; a criterion with no GRADE line fails the reply', () => {
  const na = parseDesignReply(allFour.replace('GRADE interaction: 4 fine', 'GRADE interaction: n/a no states shown'), ['a.png']);
  assert.ok(na.ok);
  assert.equal(na.grades['interaction'], null);
  const missing = parseDesignReply(allFour.replace('GRADE typography: 4 fine', ''), ['a.png']);
  assert.equal(missing.ok, false);
  assert.match(missing.ok ? '' : missing.error, /typography/);
});

test('a mark on an image the round did not show keeps its text but loses its box', () => {
  const parsed = parseDesignReply(`${allFour}\nMARK other.png 1,2,3,4 colour: Too pale. Fix: darker.`, ['a.png']);
  assert.ok(parsed.ok);
  assert.equal(parsed.marks[0]?.box, null);
  assert.equal(parsed.marks[0]?.image, 'other.png');
});

function result(grades: Record<string, number | null>, mustFix = 0): DesignResult {
  const marks = Array.from({ length: mustFix }, () => ({ kind: 'must-fix' as const, image: 'a.png', box: null, criterion: 'layout', text: 'broken' }));
  return { name: 'r', ok: true, grades, marks, reply: '' };
}

const fours = Object.fromEntries(criteria.map((c) => [c.key, 4]));

test('the round passes when the lowest grade of each criterion meets the pass mark and nothing is must-fix', () => {
  assert.equal(roundOutcome([result(fours)], 4), 'pass');
  assert.equal(roundOutcome([result(fours), result({ ...fours, colour: 3 })], 4), 'changes', 'the lowest reviewer decides');
  assert.equal(roundOutcome([result({ ...fours, interaction: null })], 4), 'pass', 'n/a does not block');
  assert.equal(roundOutcome([result(fours, 1)], 4), 'changes', 'a must-fix blocks');
  assert.equal(roundOutcome([{ name: 'r', ok: false, error: 'timed out' }], 4), 'no-verdict');
});

test('lowestGrades and meanGrade read across reviewers and skip n/a', () => {
  const lowest = lowestGrades([result({ ...fours, colour: 5 }), result({ ...fours, colour: 2, interaction: null })]);
  assert.equal(lowest['colour'], 2);
  assert.equal(lowest['interaction'], 4);
  assert.equal(meanGrade({ a: 2, b: 4, c: null }), 3);
});

test('the loop stops at the ceiling, and when two rounds in a row do not beat the best mean before them', () => {
  assert.equal(loopStop([3, 3.5], 5, 2), null);
  assert.match(loopStop([3, 3.5, 4], 3, 2) ?? '', /ceiling/);
  assert.match(loopStop([3, 3.5, 3.5, 3.4], 5, 2) ?? '', /stalled/);
  assert.equal(loopStop([3, 3.5, 3.5, 3.6], 5, 2), null);
});

test('the prompt names every criterion, each image with its size, the pass mark, and the last round from round 2', () => {
  const prompt = designPrompt({
    brief: 'The sign-in screen of a banking app.',
    images: [{ name: 'login.mobile.png', width: 390, height: 844 }],
    pass: 4,
    round: 2,
    design: 'Primary: #0055ff',
    lessons: '- Buttons are 44px tall.',
    previous: { round: 1, grades: { ...fours, colour: 2 }, marks: ['m1 colour: Too pale.'] },
  });
  for (const c of criteria) assert.match(prompt, new RegExp(`GRADE ${c.key}:`));
  assert.match(prompt, /login\.mobile\.png, 390 by 844 pixels/);
  assert.match(prompt, /pass mark is 4/);
  assert.match(prompt, /Primary: #0055ff/);
  assert.match(prompt, /Buttons are 44px tall/);
  assert.match(prompt, /round 1/i);
  assert.match(prompt, /m1 colour: Too pale\./);
  assert.match(prompt, /COMPARE:/);
});
