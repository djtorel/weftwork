// story: e12s03
// The convert CLI as a real process: without "apply" it prints the plan and
// writes nothing; with it, it converts; a refusal exits 1 and bad input 2.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempDirs, isolatedEnv, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const convertCli = join(import.meta.dirname, 'convert-cli.ts');

function convert(dir: string, request: object) {
  const out = spawnSync(process.execPath, [convertCli], { cwd: dir, input: JSON.stringify(request), env: isolatedEnv(), encoding: 'utf8', timeout: 60000 });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

const project = (): string => makeTestRepo({ 'specs/state.yaml': '---\n', 'specs/a.md': 'a\n', 'README.md': 'See specs/a.md\n' });

test('AC-e12s03-10 no "apply": the plan, and nothing written', () => {
  const dir = project();
  const out = convert(dir, {});
  assert.equal(out.status, 0, out.stderr);
  const answer = JSON.parse(out.stdout);
  assert.equal(answer.plan.tag, 'bigpowers-era');
  assert.deepEqual(answer.plan.moves.at(-1), { from: 'specs', to: '.specs' });
  assert.equal(answer.plan.changes[0].path, 'README.md');
  assert.equal(answer.plan.changes[0].text, undefined);
  assert.equal(existsSync(join(dir, '.specs')), false);
});

test('AC-e12s03-11 "apply": converts, with the tag named in the request', () => {
  const dir = project();
  const out = convert(dir, { path: dir, tag: 'old-plans', apply: true });
  assert.equal(out.status, 0, out.stderr);
  const answer = JSON.parse(out.stdout);
  assert.equal(answer.tag, 'old-plans');
  assert.ok(answer.written.includes('README.md'));
  assert.ok(existsSync(join(dir, '.specs', 'state.yaml')));
});

test('AC-e12s03-12 a refusal exits 1; bad input exits 2', () => {
  const plain = makeTestRepo();
  const refused = convert(plain, {});
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /no bigpowers specs\/state\.yaml/);
  assert.equal(convert(plain, { apply: 'yes' }).status, 2);
  assert.equal(convert(plain, { tag: '' }).status, 2);
});

// story: e12s03b
test('AC-e12s03b-06 the CLI finds a GSD project by itself; both systems need "system"; a bad system exits 2', () => {
  const gsd = makeTestRepo({ '.planning/ROADMAP.md': '- [ ] **Phase 1: A** - B\n' });
  const out = convert(gsd, {});
  assert.equal(out.status, 0, out.stderr);
  const answer = JSON.parse(out.stdout);
  assert.equal(answer.plan.system, 'gsd');
  assert.equal(answer.plan.tag, 'gsd-era');
  assert.deepEqual(answer.plan.moves.at(-1), { from: '.planning', to: '.gsd-planning' });
  const both = makeTestRepo({ '.planning/ROADMAP.md': '\n', 'specs/state.yaml': '---\n' });
  const refused = convert(both, {});
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /plans of bigpowers and gsd; pass "system"/);
  assert.equal(JSON.parse(convert(both, { system: 'bigpowers' }).stdout).plan.system, 'bigpowers');
  assert.equal(convert(both, { system: 'nope' }).status, 2);
});

// story: e12s03c
test('AC-e12s03c-05 the CLI finds a spec-kit project by itself, with the tag speckit-era', () => {
  const dir = makeTestRepo({ '.specify/memory/constitution.md': '# Rules\n', 'specs/001-a/tasks.md': '- [ ] T001 Do it in a.py\n' });
  const out = convert(dir, {});
  assert.equal(out.status, 0, out.stderr);
  const answer = JSON.parse(out.stdout);
  assert.equal(answer.plan.system, 'spec-kit');
  assert.equal(answer.plan.tag, 'speckit-era');
  assert.deepEqual(answer.plan.moves.at(-1), { from: 'specs', to: '.speckit-specs' });
});

test('AC-e12s03c-10 the CLI finds a BMAD project by itself, with the tag bmad-era', () => {
  const dir = makeTestRepo({ '_bmad/x.yaml': '\n', '_bmad-output/planning-artifacts/epics.md': '## Epic 1: A\n' });
  const out = convert(dir, {});
  assert.equal(out.status, 0, out.stderr);
  const answer = JSON.parse(out.stdout);
  assert.equal(answer.plan.system, 'bmad');
  assert.equal(answer.plan.tag, 'bmad-era');
  assert.deepEqual(answer.plan.moves.at(-1), { from: '_bmad-output', to: '.bmad-output' });
});

// story: e12s03b
test('AC-e12s03b-18 the CLI finds a GSD 2 project by itself', () => {
  const dir = makeTestRepo({ '.gsd/milestones/M001/M001-ROADMAP.md': '# M001: A\n\n## Slices\n\n- [ ] **S01: B**\n' });
  const out = convert(dir, {});
  assert.equal(out.status, 0, out.stderr);
  const answer = JSON.parse(out.stdout);
  assert.equal(answer.plan.system, 'gsd2');
  assert.equal(answer.plan.tag, 'gsd2-era');
});
