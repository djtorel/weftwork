// story: e12s03c
// The backlog section a BMAD conversion writes: each open epic of the sprint
// status keeps its number, with its title and goal from epics.md and each
// open story with its status and story file; done work is left out, and an
// open retrospective action item is an item too. The format is BMAD
// v6.12.4's sprint-status-template.yaml, epics-template.md and the
// create-story template.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bmadSection, bmadV4Section } from './convert-bmad.ts';

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

// story: e12s03d
// BMAD v4 (v4.44.3): epics in the PRD, sharded into docs/prd/epic-{n}*.md
// (prd-tmpl.yaml: "Epic {{epic_number}} {{epic_title}}", "Story
// {{epic_number}}.{{story_number}} {{story_title}}"; shard-doc.md lifts each
// level by one), and story files docs/stories/{epic}.{story}.{slug}.md from
// story-tmpl.yaml, whose Status section is one of Draft, Approved,
// InProgress, Review, Done; create-brownfield-story.md writes "## Status: Draft".
const v4Epic1 = [
  '# Epic 1 Foundation & Core Infrastructure',
  '',
  'Establish project setup, authentication, and basic user management.',
  '',
  '## Story 1.1 Project setup',
  '',
  'As a developer, I want a repository with CI, so that every change is checked.',
  '',
  '### Acceptance Criteria',
  '',
  '1: CI runs the tests.',
  '',
  '## Story 1.2 Health check route',
  '',
  '## Story 1.3 Sign in',
].join('\n');
const v4Epic2 = '# Epic 2 Core Business Entities\n\nCreate and manage plant records.\n\n## Story 2.1 Plant records\n';
const v4Epic3 = '# Epic 3 Reporting\n\nShow watering history.\n\n## Story 3.1 History chart\n';

const v4Story = (number: string, title: string, status: string): string =>
  [`# Story ${number}: ${title}`, '', '## Status', '', status, '', '## Story', '', '**As a** user,', '**I want** it,', '**so that** it works', '', '## Acceptance Criteria', '', '1. It works.', ''].join('\n');

test('AC-e12s03d-01 BMAD v4: a story whose Status is not Done is open, with its story file; a PRD story with no file is open; a done epic is left out', () => {
  const notes: string[] = [];
  const stories = {
    '1.1.project-setup.md': v4Story('1.1', 'Project setup', 'Done'),
    '1.2.health-check-route.md': v4Story('1.2', 'Health check route', 'InProgress'),
    '2.1.plant-records.md': '# Story 2.1: Plant records\n\n## Status: Draft\n\n## Story\n',
    '3.1.history-chart.md': v4Story('3.1', 'History chart', 'Done'),
    'README.md': '# not a story\n',
  };
  const text = bmadV4Section({ epics: [v4Epic1, v4Epic2, v4Epic3], stories, prd: 'docs/prd/' }, 'bmad-era', notes);
  assert.match(text, /^## Converted from BMAD v4$/m);
  assert.match(text, /gitignored `\.bmad-stories\/` and at the tag `bmad-era`\./);
  assert.match(text, /^### Epic 1: Foundation & Core Infrastructure\n\nGoal: Establish project setup, authentication, and basic user management\.\nPRD: `docs\/prd\/`\n$/m);
  assert.match(text, /^- \[ \] \*\*Story 1\.2 Health check route\.\*\* Status: InProgress\n {2}Old spec: `\.bmad-stories\/1\.2\.health-check-route\.md`$/m);
  assert.match(text, /^- \[ \] \*\*Story 1\.3 Sign in\.\*\* Status: no story file yet$/m);
  assert.match(text, /^- \[ \] \*\*Story 2\.1 Plant records\.\*\* Status: Draft\n {2}Old spec: `\.bmad-stories\/2\.1\.plant-records\.md`$/m);
  assert.doesNotMatch(text, /Story 1\.1|Epic 3|Story 3\.1|README/);
  assert.deepEqual(notes, []);
});

test('AC-e12s03d-02 BMAD v4: an unsharded prd.md and a story file the PRD does not list', () => {
  const prd = '# Plants Product Requirements Document (PRD)\n\n## Epic List\n\n- Epic 1: Foundation: set up.\n\n## Epic 1: Foundation\n\nSet up.\n\n### Story 1.1: Repo\n\n## Checklist Results Report\n';
  const text = bmadV4Section({ epics: [prd], stories: { '1.2.story.md': '# Story 1.2: Extra work\n\n## Status\n\nApproved\n' }, prd: 'docs/prd.md' }, 'old', []);
  assert.match(text, /^### Epic 1: Foundation\n\nGoal: Set up\.\nPRD: `docs\/prd\.md`$/m);
  assert.match(text, /^- \[ \] \*\*Story 1\.1 Repo\.\*\* Status: no story file yet$/m);
  assert.match(text, /^- \[ \] \*\*Story 1\.2 Extra work\.\*\* Status: Approved\n {2}Old spec: `\.bmad-stories\/1\.2\.story\.md`$/m);
  assert.match(bmadV4Section({ epics: [], stories: {}, prd: 'docs/prd.md' }, 'old', []), /No open epics or stories\./);
});
