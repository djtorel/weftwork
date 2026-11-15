// story: e12s02
// The setup CLI as a real process: with no answers it asks the questions, with
// answers it prints a dry-run plan and writes nothing, and with "apply" it
// writes; bad input exits 2.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempDirs, isolatedEnv, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const setupCli = join(import.meta.dirname, 'setup-cli.ts');

function setup(dir: string, request: object) {
  const out = spawnSync(process.execPath, [setupCli], { cwd: dir, input: JSON.stringify(request), env: isolatedEnv(), encoding: 'utf8', timeout: 60000 });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

function project(): string {
  const dir = makeTestRepo({ 'package.json': JSON.stringify({ scripts: { test: 'node -e 0', lint: 'node -e "process.exit(1)"' } }) });
  return dir;
}

const answers = { about: 'A test project.', never: ['Never push to main.'] };

test('AC-e12s02-09 no answers: the questions, each with a recommended answer, and the checked report', () => {
  const dir = project();
  const out = setup(dir, {});
  assert.equal(out.status, 0, out.stderr);
  const answer = JSON.parse(out.stdout);
  assert.deepEqual(
    answer.questions.map((question: { id: string }) => question.id),
    ['about', 'words', 'never', 'rules', 'tasks'],
  );
  assert.ok(answer.questions.every((question: { recommended?: unknown }) => question.recommended !== undefined));
  assert.equal(answer.report.commands[0].check.status, 'passed');
});

test('AC-e12s02-10 answers: a dry-run plan with diffs, and nothing written', () => {
  const dir = project();
  const out = setup(dir, { answers });
  assert.equal(out.status, 0, out.stderr);
  const plan = JSON.parse(out.stdout).plan;
  const agents = plan.changes.find((change: { path: string }) => change.path === 'AGENTS.md');
  assert.equal(agents.action, 'create');
  assert.match(agents.diff, /^\+npm run test$/m);
  assert.equal(agents.text, undefined, 'the plan shows diffs, not the raw text twice');
  assert.equal(existsSync(join(dir, 'AGENTS.md')), false);
});

test('AC-e12s02-11 apply writes, and a re-run keeps a file the owner changed', () => {
  const dir = project();
  const first = setup(dir, { answers, apply: true });
  assert.equal(first.status, 0, first.stderr);
  assert.match(readFileSync(join(dir, 'AGENTS.md'), 'utf8'), /A test project\./);
  writeFileSync(join(dir, 'AGENTS.md'), '# Mine\n');
  const again = JSON.parse(setup(dir, { answers, apply: true }).stdout);
  assert.deepEqual(again.kept, ['AGENTS.md']);
  assert.equal(readFileSync(join(dir, 'AGENTS.md'), 'utf8'), '# Mine\n');
});

test('AC-e12s02-12 bad input exits 2 with the reason on stderr', () => {
  const dir = project();
  for (const request of [{ answers: { about: 'two\nlines' } }, { answers, overwrite: 'AGENTS.md' }, { apply: true }, { stopHook: 'yes' }]) {
    const out = setup(dir, request);
    assert.equal(out.status, 2, JSON.stringify(request));
    assert.match(out.stderr, /^setup: /);
  }
});
