// story: e11s02
// The PR proof CLI as a real process in a temporary repository: the engine CLI
// runs the check and logs it, then the proof CLI reads the ledger and the tree.
// Exit 0 ready, 1 draft, 2 when it cannot run.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempDirs, isolatedEnv, makeTempDir, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const engineCli = join(import.meta.dirname, 'cli.ts');
const proofCli = join(import.meta.dirname, 'pr-proof-cli.ts');

function node(script: string, cwd: string, input: string) {
  return spawnSync(process.execPath, [script], { cwd, input, env: isolatedEnv(), encoding: 'utf8', timeout: 20000 });
}

test('after a done run of the engine: exit 0 and a ready proof; after an edit: exit 1 and a draft', () => {
  const repo = makeTestRepo();
  const request = JSON.stringify({ command: 'true' });
  assert.equal(node(engineCli, repo, request).status, 0);

  const ready = node(proofCli, repo, request);
  assert.equal(ready.status, 0, ready.stderr);
  assert.match(ready.stdout, /^weftwork done gate: ready$/m);
  assert.match(ready.stdout, /^budget: 1 run in this loop, 0 failed runs of this command before the pass$/m);

  writeFileSync(join(repo, 'tracked.txt'), 'two\n');
  const draft = node(proofCli, repo, request);
  assert.equal(draft.status, 1, draft.stderr);
  assert.match(draft.stdout, /^weftwork done gate: draft$/m);
});

test('a failed run of the engine: exit 1 and a draft', () => {
  const repo = makeTestRepo();
  const request = JSON.stringify({ command: 'false' });
  assert.equal(node(engineCli, repo, request).status, 1);
  const draft = node(proofCli, repo, request);
  assert.equal(draft.status, 1, draft.stderr);
  assert.match(draft.stdout, /^why: the last run of this command is not done$/m);
});

for (const [name, input, cwd] of [
  ['stdin is not JSON', 'nope', () => makeTestRepo()],
  ['no command', '{}', () => makeTestRepo()],
  ['not a git repository', '{"command":"true"}', () => makeTempDir()],
] as [string, string, () => string][]) {
  test(`${name}: exit 2, nothing on stdout, the reason on stderr`, () => {
    const out = node(proofCli, cwd(), input);
    assert.equal(out.status, 2);
    assert.equal(out.stdout, '');
    assert.notEqual(out.stderr.trim(), '');
  });
}
