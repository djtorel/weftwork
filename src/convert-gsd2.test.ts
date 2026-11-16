// story: e12s03b
// The backlog section a GSD 2 conversion writes: each open milestone keeps
// its id, with its title, vision and success criteria, and each open slice of
// its roadmap with its demo line, its open tasks and a link to its folder; a
// milestone with a summary, or every slice ticked, is done. The format is
// gsd-build/gsd-2 v3.0.0: templates/roadmap.md, templates/plan.md and the
// ID-SUFFIX file names of paths.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gsd2Section, type Gsd2Milestone } from './convert-gsd2.ts';

const roadmap = [
  '# M001: Flight *simulator*',
  '',
  '**Vision:** Fly a plane in the browser.',
  '',
  '## Success Criteria',
  '',
  '<!-- Write success criteria as observable truths. -->',
  '',
  '- A user can take off',
  '- The plane lands',
  '',
  '## Slices',
  '',
  '- [x] **S01: Physics** `risk:high` `depends:[]`',
  '  > After this: a cube falls',
  '- [ ] **S02: Controls** `risk:medium` `depends:[S01]`',
  '  > After this: the plane turns',
  '- [ ] **S03: HUD** `risk:low` `depends:[S01]`',
  '',
  '<!--',
  '  - Checkbox line: - [ ] **S01: Title** `risk:high|medium|low`',
  '-->',
].join('\n');

const plan = ['# S02: Controls', '', '## Tasks', '', '- [x] **T01: Keys** `est:30m`', '- [ ] **T02: Mouse** `est:1h`', '- [ ] **T03: Gamepad** `est:1h`', '  - [ ] **T09: nested** `est:1m`'].join('\n');

const milestones: Gsd2Milestone[] = [
  {
    dir: 'M001-FLIGHT',
    roadmap,
    summary: false,
    slices: [
      { dir: 'S02', plan, doneTasks: ['T03'] },
      { dir: 'S03-HUD', plan: null, doneTasks: [] },
    ],
  },
  { dir: 'M002', roadmap: '# M002: Shipped\n\n## Slices\n\n- [ ] **S01: Left over**\n', summary: true, slices: [] },
  { dir: 'M003', roadmap: '# M003: All ticked\n\n## Slices\n\n- [x] **S01: Done**\n', summary: false, slices: [] },
];

test('AC-e12s03b-14 open milestones keep their ids, title, vision, criteria, open slices and tasks; done ones are left out', () => {
  const text = gsd2Section(milestones, 'gsd2-era', '.gsd');
  assert.match(text, /^## Converted from GSD 2$/m);
  assert.match(text, /^### M001: Flight \\\*simulator\\\*$/m);
  assert.match(text, /^Goal: Fly a plane in the browser\.$/m);
  assert.match(text, /^Done when: A user can take off; The plane lands$/m);
  assert.match(text, /^- \[ \] \*\*S02: Controls\.\*\* After this: the plane turns\n {2}Open task T02: Mouse\n {2}Old spec: `\.gsd\/milestones\/M001-FLIGHT\/slices\/S02\/`$/m);
  assert.match(text, /^- \[ \] \*\*S03: HUD\.\*\*\n {2}Old spec: `\.gsd\/milestones\/M001-FLIGHT\/slices\/S03-HUD\/`$/m);
  assert.doesNotMatch(text, /S01: Physics|T01|T03|T09|M002|M003|Checkbox line/);
  assert.match(text, /tag `gsd2-era`/);
});

test('AC-e12s03b-15 untracked .gsd/: no tag is named; nothing open says so', () => {
  const text = gsd2Section(milestones.slice(1), '', '.gsd');
  assert.match(text, /No open milestones\./);
  assert.match(text, /The old plans stay in `\.gsd\/`, which git does not track\./);
  assert.doesNotMatch(text, /tag/);
});

test('AC-e12s03b-19 milestones keep the queue order of QUEUE-ORDER.json; one it does not list comes after, by number', () => {
  const open = (dir: string): Gsd2Milestone => ({ dir, roadmap: `# ${dir.slice(0, 4)}: Work\n\n## Slices\n\n- [ ] **S01: Open**\n`, summary: false, slices: [] });
  const text = gsd2Section([open('M001'), open('M002-ROUTES'), open('M003'), open('M010')], 'gsd2-era', '.gsd', ['M003', 'M001', 'M002', 'M009']);
  const order = [...text.matchAll(/^### (M\d+):/gm)].map((match) => match[1]);
  assert.deepEqual(order, ['M003', 'M001', 'M002', 'M010']);
  assert.match(text, /in the queue order of GSD 2/);
});
