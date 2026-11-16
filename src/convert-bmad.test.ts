// story: e12s03c
// The backlog section a BMAD conversion writes: each open epic of the sprint
// status keeps its number, with its title and goal from epics.md and each
// open story with its status and story file; done work is left out, and an
// open retrospective action item is an item too. The format is BMAD
// v6.12.4's sprint-status-template.yaml, epics-template.md and the
// create-story template.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bmadSection } from './convert-bmad.ts';

const epics = [
  '# Plants - Epic Breakdown',
  '',
  '## Epic List',
  '',
  '## Epic 1: Accounts',
  '',
  'People can sign up and keep a profile.',
  '',
  '### Story 1.1: User authentication',
  '',
  'As a user, I want to log in.',
  '',
  '### Story 1.2: Account *management*',
  '',
  '## Epic 2: Chat',
  '',
  'Talk to your plant.',
  '',
  '### Story 2.1: Personality system',
].join('\n');

const status = {
  development_status: {
    'epic-1': 'in-progress',
    '1-1-user-authentication': 'done',
    '1-2-account-management': 'ready-for-dev',
    '1-3-plant-data-model': 'backlog',
    'epic-1-retrospective': 'optional',
    'epic-2': 'done',
    '2-1-personality-system': 'review',
  },
  action_items: [
    { epic: 1, action: 'Add error handling to the review checklist', owner: 'Charlie', status: 'open' },
    { epic: 1, action: 'Old one', status: 'done' },
  ],
};

test('AC-e12s03c-06 open epics and stories keep their numbers, titles, goal, status and story file; done work is left out', () => {
  const notes: string[] = [];
  const text = bmadSection({ status, epics: [epics], storyFiles: ['1-2-account-management.md'] }, 'bmad-era', notes);
  assert.match(text, /^## Converted from BMAD$/m);
  assert.match(text, /^### Epic 1: Accounts$/m);
  assert.match(text, /^Goal: People can sign up and keep a profile\.$/m);
  assert.match(text, /^Old spec: `\.bmad-output\/planning-artifacts\/`$/m);
  assert.match(text, /^- \[ \] \*\*Story 1\.2 Account \\\*management\\\*\.\*\* Status: ready-for-dev\n {2}Old spec: `\.bmad-output\/implementation-artifacts\/1-2-account-management\.md`$/m);
  assert.match(text, /^- \[ \] \*\*Story 1\.3 Plant data model\.\*\* Status: backlog$/m);
  assert.match(text, /^- \[ \] \*\*Retrospective action \(epic 1\): Add error handling to the review checklist\.\*\* Owner: Charlie$/m);
  assert.doesNotMatch(text, /Story 1\.1|Epic 2|Old one|retrospective:/);
  assert.deepEqual(notes, ['Epic 2 is done, but its stories 2-1-personality-system are not; they are left out of the backlog.']);
});

test('AC-e12s03c-07 no sprint status: every story in epics.md is open; nothing at all says so', () => {
  const text = bmadSection({ status: null, epics: [epics], storyFiles: [] }, 'old', []);
  assert.match(text, /^### Epic 2: Chat$/m);
  assert.match(text, /^- \[ \] \*\*Story 1\.1 User authentication\.\*\* Status: backlog$/m);
  assert.match(text, /^- \[ \] \*\*Story 2\.1 Personality system\.\*\* Status: backlog$/m);
  assert.match(bmadSection({ status: null, epics: [], storyFiles: [] }, 'old', []), /No open epics or stories\./);
});
