// story: e11s04
// The decision CLI as a real process: a decision on stdin is logged for the
// current branch; `list` prints the branch's decisions for the PR body.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { cleanupTempDirs, git, isolatedEnv, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const decisionCli = join(import.meta.dirname, 'decision-cli.ts');

function decide(cwd: string, args: string[], input = '') {
  const out = spawnSync(process.execPath, [decisionCli, ...args], { cwd, input, env: isolatedEnv(), encoding: 'utf8', timeout: 20000 });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

const one = { question: 'Split the file?', choice: 'Yes', reason: 'It passed 300 lines.' };

test('AC-e11s04-15 a logged decision is listed on its branch and not on another', () => {
  const repo = makeTestRepo();
  git(repo, 'checkout', '-q', '-b', 'feat/a');
  assert.equal(decide(repo, ['list']).stdout, 'None\n');
  const logged = decide(repo, [], JSON.stringify(one));
  assert.equal(logged.status, 0, logged.stderr);
  assert.deepEqual(decide(repo, ['list']), { status: 0, stdout: '- Split the file? Choice: Yes. Reason: It passed 300 lines.\n', stderr: '' });
  git(repo, 'checkout', '-q', '-b', 'feat/b');
  assert.equal(decide(repo, ['list']).stdout, 'None\n');
});

test('AC-e11s04-16 bad input or no repository exits 2 with the reason', () => {
  const repo = makeTestRepo();
  const bad = decide(repo, [], JSON.stringify({ ...one, reason: '' }));
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /^decision: .*reason/);
  assert.equal(decide(repo, ['nope']).status, 2);
});
