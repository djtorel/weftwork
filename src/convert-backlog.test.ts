// story: e12s03
// The backlog section a bigpowers conversion writes: open epics and stories
// keep their ids, each with its goal, its done-when, its open tasks' checks and
// a link to the old spec; done work is left out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backlogSection, type BigpowersEpic } from './convert-backlog.ts';

const epics: BigpowersEpic[] = [
  {
    dir: 'epics/e01-done',
    epic: { id: 'e01', title: 'Done work', status: 'done', stories: [{ id: 'e01s01', title: 'Old', status: 'done' }] },
    tasks: new Map(),
  },
  {
    dir: 'epics/e02-open',
    epic: {
      id: 'e02',
      title: 'Open work',
      status: 'in_progress',
      done_when: 'The thing\n  works end to end',
      stories: [
        { id: 'e02s01', title: 'Finished story', status: 'done' },
        { id: 'e02s02', title: 'Next story', status: 'todo', acceptance: 'Given X, when Y,\n  then Z', tasks: 'e02s02-tasks.yaml' },
      ],
    },
    tasks: new Map([
      [
        'e02s02-tasks.yaml',
        {
          spec: 'e02s02-next.md',
          tasks: [
            { id: 1, status: 'done', verify: 'true' },
            { id: 2, status: 'todo', verify: 'npm test\n  -- --grep next' },
          ],
        },
      ],
    ]),
  },
  {
    dir: 'epics/e03-empty',
    epic: { id: 'e03', title: 'No stories yet', status: 'todo', done_when: 'A list exists', stories: [] },
    tasks: new Map(),
  },
];

test('AC-e12s03-01 open epics and stories keep their ids, goal, done-when, check and old spec; done work is left out', () => {
  const text = backlogSection(epics, {}, 'bigpowers-era');
  assert.doesNotMatch(text, /e01|e02s01/);
  assert.match(text, /^### e02 Open work$/m);
  assert.match(text, /Done when: The thing works end to end/);
  assert.match(text, /^- \[ \] \*\*e02s02 Next story\.\*\* Done when: Given X, when Y, then Z$/m);
  assert.match(text, /^ {2}Check: task 2: `npm test -- --grep next`$/m);
  assert.doesNotMatch(text, /task 1/);
  assert.match(text, /^ {2}Old spec: `\.specs\/epics\/e02-open\/e02s02-next\.md`$/m);
  assert.match(text, /^- \[ \] \*\*e03 No stories yet\.\*\* Done when: A list exists$/m);
  assert.match(text, /tag `bigpowers-era`/);
});

test('AC-e12s03-02 execution-status.yaml wins over the status in epic.yaml', () => {
  const text = backlogSection(epics, { e02s01: 'in_progress', e02s02: 'done', e03: 'done' }, 'old');
  assert.match(text, /\*\*e02s01 Finished story\.\*\*/);
  assert.doesNotMatch(text, /e02s02|e03/);
});

test('AC-e12s03-03 nothing open: the section says so', () => {
  const text = backlogSection([epics[0]], {}, 'old');
  assert.match(text, /No open epics or stories/);
});

test('AC-e12s03-06 epic, story and task text from the YAML cannot break how the backlog renders (PR #86 review)', () => {
  const hostile: BigpowersEpic[] = [
    {
      dir: 'epics/e04-x',
      epic: { id: 'e04', title: 'Pay <!-- now', status: 'todo', stories: [{ id: 'e04s01', title: 'A *b', status: 'todo', acceptance: 'Shows `x', tasks: 't.yaml' }] },
      tasks: new Map([['t.yaml', { spec: 'odd`name.md', tasks: [{ id: 1, status: 'todo', verify: 'echo `date`' }] }]]),
    },
  ];
  const text = backlogSection(hostile, {}, 'old');
  assert.match(text, /^### e04 Pay \\<!-- now$/m);
  assert.match(text, /^- \[ \] \*\*e04s01 A \\\*b\.\*\* Done when: Shows \\`x$/m);
  assert.match(text, /^ {2}Check: task 1: `` echo `date` ``$/m);
  assert.match(text, /^ {2}Old spec: ``\.specs\/epics\/e04-x\/odd`name\.md``$/m);
});

test('AC-e12s03-16 a done epic leaves its open stories out with a note, and an open epic with every story done stays as one item', () => {
  const mixed: BigpowersEpic[] = [
    {
      dir: 'epics/e05-closed',
      epic: { id: 'e05', title: 'Closed early', status: 'done', stories: [{ id: 'e05s01', title: 'Left over', status: 'todo' }] },
      tasks: new Map(),
    },
    {
      dir: 'epics/e06-almost',
      epic: { id: 'e06', title: 'Almost there', status: 'in_progress', done_when: 'Shipped', stories: [{ id: 'e06s01', title: 'Built', status: 'done' }] },
      tasks: new Map(),
    },
  ];
  const notes: string[] = [];
  const text = backlogSection(mixed, {}, 'old', notes);
  assert.doesNotMatch(text, /e05/);
  assert.deepEqual(notes, ['Epic e05 is done, but its stories e05s01 are not; they are left out of the backlog.']);
  assert.match(text, /^- \[ \] \*\*e06 Almost there\.\*\* Every story is done; close the epic or add what is left\. Done when: Shipped$/m);
  assert.match(text, /^ {2}Old spec: `\.specs\/epics\/e06-almost\/epic\.yaml`$/m);
});
