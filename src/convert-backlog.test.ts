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
