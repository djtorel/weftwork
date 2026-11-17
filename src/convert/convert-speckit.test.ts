// story: e12s03c
// The backlog section a spec-kit conversion writes: each feature folder in
// specs/ with an open task, or with no tasks.md yet, is one item that keeps
// its folder name, with the spec's title, its success criteria as done-when,
// its open tasks and a link to the old spec; a feature whose tasks are all
// ticked is left out. The format is spec-kit's templates (spec-template.md,
// tasks-template.md, the tasks command's checklist format).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speckitSection, type SpeckitFeature } from './convert-speckit.ts';

const spec = [
  '# Feature Specification: Photo albums',
  '',
  '**Feature Branch**: `001-photo-albums`',
  '**Status**: Draft',
  '',
  '## Success Criteria *(mandatory)*',
  '',
  '### Measurable Outcomes',
  '',
  '- **SC-001**: Users can make an album in under 1 minute',
  '- **SC-002**: 95% of uploads finish',
  '',
  '## Assumptions',
  '',
  '- **SC-009**: not a criterion, outside the section',
].join('\n');

const tasks = [
  '# Tasks: Photo albums',
  '',
  '## Phase 1: Setup',
  '',
  '- [x] T001 Create project structure per implementation plan',
  '- [X] T002 [P] Configure linting in .eslintrc',
  '',
  '## Phase 3: User Story 1 - Make an album (Priority: P1)',
  '',
  '- [ ] T012 [P] [US1] Create Album model in src/models/album.py',
  '- [ ] T013 [US1] Implement AlbumService in src/services/album_service.py',
  '  - [ ] not a task: indented',
].join('\n');

const features: SpeckitFeature[] = [
  { dir: '001-photo-albums', spec, tasks },
  { dir: '002-done', spec: '# Feature Specification: Done one\n', tasks: '- [x] T001 Do it in a.py\n' },
  { dir: '003-new', spec: '# Feature Specification: Sharing <links>\n', tasks: null },
  { dir: '004-bare', spec: null, tasks: null },
];

test('AC-e12s03c-01 open features keep their folder, title, success criteria, open tasks and old spec; done ones are left out', () => {
  const text = speckitSection(features, 'speckit-era');
  assert.match(text, /^## Converted from spec-kit$/m);
  assert.match(text, /^- \[ \] \*\*001-photo-albums Photo albums\.\*\* Done when: Users can make an album in under 1 minute; 95% of uploads finish$/m);
  assert.match(text, /^ {2}Open task T012 \\\[P\] \\\[US1\] Create Album model in src\/models\/album\.py$/m);
  assert.match(text, /^ {2}Open task T013 \\\[US1\] Implement AlbumService in src\/services\/album_service\.py$/m);
  assert.doesNotMatch(text, /T001|T002|SC-009|not a task|002-done/);
  assert.match(text, /^ {2}Old spec: `\.speckit-specs\/001-photo-albums\/`$/m);
  assert.match(text, /^- \[ \] \*\*003-new Sharing \\<links>\.\*\* No tasks yet\.$/m);
  assert.match(text, /^- \[ \] \*\*004-bare\.\*\* No tasks yet\.$/m);
  assert.match(text, /tag `speckit-era`/);
});

test('AC-e12s03c-02 nothing open: the section says so; past 20 open tasks the rest are counted', () => {
  assert.match(speckitSection([features[1]], 'old'), /No open features\./);
  const many = Array.from({ length: 25 }, (_, index) => `- [ ] T${String(index + 1).padStart(3, '0')} Task ${index + 1} in a.py`).join('\n');
  const text = speckitSection([{ dir: '005-big', spec: null, tasks: many }], 'old');
  assert.match(text, /Open task T020 /);
  assert.doesNotMatch(text, /Open task T021 /);
  assert.match(text, /^ {2}And 5 more open tasks in tasks\.md\.$/m);
});
