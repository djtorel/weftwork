// story: e12s03b
// The backlog section a GSD conversion writes from .planning/ROADMAP.md: each
// open phase, with its goal, its success criteria, its open plans and a link
// to its phase folder. Shipped milestones and complete phases are left out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gsdSection } from './convert-gsd.ts';

// The shape of GSD v1.30 templates/roadmap.md, milestone-grouped.
const roadmap = [
  '# Roadmap: Shop',
  '',
  '## Phases',
  '',
  '- [x] **Phase 1: Foundation** - Repo and CI',
  '- [ ] **Phase 2: Checkout** - Pay for a cart',
  '- [ ] **Phase 2.1: Hotfix (INSERTED)** - Tax rounding',
  '- [ ] **Phase 3: Reports** - Sales report',
  '',
  '<details>',
  '<summary>v0.9 (Phases 0) - SHIPPED</summary>',
  '',
  '### Phase 0: Spike',
  '**Goal**: Try it',
  '</details>',
  '',
  '## Phase Details',
  '',
  '### Phase 1: Foundation',
  '**Goal**: A repo that builds',
  '**Plans**: 1 plan',
  '',
  'Plans:',
  '- [x] 01-01: Scaffold',
  '',
  '### 🚧 Phase 2: Checkout',
  '**Goal**: A user can pay for a cart',
  '**Depends on**: Phase 1',
  '**Success Criteria** (what must be TRUE):',
  '  1. User can pay by card',
  '  2. A receipt is sent',
  '**Plans**: 2 plans',
  '',
  'Plans:',
  '- [x] 02-01: Cart model',
  '- [ ] 02-02: Card payment',
  '',
  '#### Phase 2.1: Hotfix (INSERTED)',
  '**Goal**: Tax rounds half up',
  '',
  '### Phase 3: Reports',
  '**Goal**: Sales by day',
  '',
  '### Phase 4: Export',
  '**Goal**: CSV export',
  '',
  '## Progress',
  '',
  '| Phase | Plans Complete | Status | Completed |',
  '|-------|----------------|--------|-----------|',
  '| 1. Foundation | 1/1 | Complete | 2026-01-01 |',
  '| 3. Reports | 2/2 | Complete | 2026-02-01 |',
  '',
].join('\n');

test('AC-e12s03b-01 each open phase is one item: goal, done-when from the criteria, open plans, its folder', () => {
  const text = gsdSection(roadmap, ['01-foundation', '02-checkout', '02.1-hotfix'], 'gsd-era');
  assert.match(text, /^## Converted from GSD\n/);
  assert.match(text, /`gsd-era`/);
  const items = text.split('\n').filter((line) => line.startsWith('- [ ]'));
  assert.deepEqual(items, [
    '- [ ] **Phase 2: Checkout.** Goal: A user can pay for a cart',
    '- [ ] **Phase 2.1: Hotfix (INSERTED).** Goal: Tax rounds half up',
    '- [ ] **Phase 4: Export.** Goal: CSV export',
  ]);
  assert.match(text, /\*\*Phase 2: Checkout\.\*\* Goal: A user can pay for a cart\n {2}Done when: User can pay by card; A receipt is sent\n {2}Open plan 02-02: Card payment\n {2}Old spec: `\.gsd-planning\/phases\/02-checkout\/`\n/);
  assert.match(text, /\*\*Phase 2\.1: Hotfix \(INSERTED\)\.\*\* Goal: Tax rounds half up\n {2}Old spec: `\.gsd-planning\/phases\/02\.1-hotfix\/`/);
  assert.match(text, /\*\*Phase 4: Export\.\*\* Goal: CSV export\n {2}Old spec: `\.gsd-planning\/ROADMAP\.md`/);
  assert.doesNotMatch(text, /Phase 0|Phase 1|Phase 3|02-01/);
});

test('AC-e12s03b-02 a phase in the list with no details keeps its one-line description', () => {
  const text = gsdSection('- [ ] **Phase 7: Search** - Find a product\n', [], 'gsd-era');
  assert.match(text, /- \[ \] \*\*Phase 7: Search\.\*\* Goal: Find a product\n {2}Old spec: `\.gsd-planning\/ROADMAP\.md`/);
});

test('AC-e12s03b-03 a phase whose plans are all done is done; no roadmap or no open phase says so', () => {
  const allDone = '### Phase 5: Done\n**Goal**: x\n\nPlans:\n- [x] 05-01: a\n- [X] 05-02: b\n';
  assert.match(gsdSection(allDone, [], 'gsd-era'), /No open phases\./);
  assert.match(gsdSection(null, [], 'gsd-era'), /No open phases\./);
});

test('AC-e12s03b-07 success criteria written without an indent still count (review round 1)', () => {
  const text = gsdSection('### Phase 3: X\n**Goal**: g\n**Success Criteria**:\n1. One\n2. Two\n', [], 'gsd-era');
  assert.match(text, /\n {2}Done when: One; Two\n/);
});

test('AC-e12s03b-08 a PLAN.md with no SUMMARY.md and no roadmap line is an open plan; a folder the roadmap lacks is a phase', () => {
  const unlisted = [
    '- [x] **Phase 1: Base** - Repo',
    '### Phase 2: Checkout',
    '**Goal**: Pay',
    'Plans:',
    '- [x] 02-01: Cart model',
    '- [ ] 02-02: Card payment',
    '### Phase 3: Reports',
    '**Goal**: Sales',
    'Plans:',
    '- [x] 03-01: Daily',
    '',
  ].join('\n');
  const folders = ['01-base', '02-checkout', '03-reports', '05-search', '06-later'];
  const files = [
    '01-base/01-01-PLAN.md',
    '02-checkout/02-01-PLAN.md',
    '02-checkout/02-01-SUMMARY.md',
    '02-checkout/02-02-PLAN.md',
    '02-checkout/02-03-PLAN.md',
    '02-checkout/02-04-PLAN.md',
    '02-checkout/02-04-SUMMARY.md',
    '02-checkout/notes.md',
    '03-reports/03-02-PLAN.md',
    '05-search/05-01-PLAN.md',
    '06-later/06-01-PLAN.md',
    '06-later/06-01-SUMMARY.md',
  ];
  const text = gsdSection(unlisted, folders, 'gsd-era', files);
  assert.equal(
    text.split('\n').filter((line) => /^\s/.test(line) || line.startsWith('- [')).join('\n'),
    [
      '- [ ] **Phase 2: Checkout.** Goal: Pay',
      '  Open plan 02-02: Card payment',
      '  Open plan 02-03 (02-03-PLAN.md, not on the roadmap)',
      '  Old spec: `.gsd-planning/phases/02-checkout/`',
      '- [ ] **Phase 3: Reports.** Goal: Sales',
      '  Open plan 03-02 (03-02-PLAN.md, not on the roadmap)',
      '  Old spec: `.gsd-planning/phases/03-reports/`',
      '- [ ] **Phase 5: search.** Not on the roadmap.',
      '  Open plan 05-01 (05-01-PLAN.md, not on the roadmap)',
      '  Old spec: `.gsd-planning/phases/05-search/`',
    ].join('\n'),
  );
});

test('AC-e12s03b-09 a phase of a shipped milestone in <details> stays out, even with a PLAN.md and no SUMMARY.md (review round 1)', () => {
  const shipped = '<details>\n<summary>v1.0 - SHIPPED</summary>\n\n- [x] **Phase 1: Base** - Repo\n</details>\n';
  assert.match(gsdSection(shipped, ['01-base'], 'gsd-era', ['01-base/01-01-PLAN.md']), /No open phases\./);
});
