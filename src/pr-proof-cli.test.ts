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
  assert.match(ready.stdout, /^budget: 1 run in this loop, 0 failed runs of this command before the pass, tokens not counted \(no transcript given\)$/m);

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

test('a transcript path: the budget line shows the session\'s tokens; none or a missing file: not counted, same exit', () => {
  const repo = makeTestRepo();
  assert.equal(node(engineCli, repo, JSON.stringify({ command: 'true' })).status, 0);
  const transcript = join(makeTempDir(), 'session.jsonl');
  const line = (id: string, usage: object) => JSON.stringify({ type: 'assistant', message: { id, usage } });
  writeFileSync(transcript, `${line('m1', { input_tokens: 3, output_tokens: 10, cache_read_input_tokens: 100, cache_creation_input_tokens: 20 })}\n${line('m2', { input_tokens: 4, output_tokens: 1 })}\n`);

  const counted = node(proofCli, repo, JSON.stringify({ command: 'true', transcript }));
  assert.equal(counted.status, 0, counted.stderr);
  assert.match(counted.stdout, /^budget: 1 run in this loop, .*, tokens 7 input, 11 output, 100 cache read, 20 cache write$/m);

  const none = node(proofCli, repo, JSON.stringify({ command: 'true' }));
  assert.equal(none.status, 0, none.stderr);
  assert.match(none.stdout, /^budget: .*, tokens not counted \(no transcript given\)$/m);

  // The skill passes "" when it finds no transcript.
  const empty = node(proofCli, repo, JSON.stringify({ command: 'true', transcript: '' }));
  assert.equal(empty.status, 0, empty.stderr);
  assert.match(empty.stdout, /^budget: .*, tokens not counted \(no transcript given\)$/m);

  const missing = node(proofCli, repo, JSON.stringify({ command: 'true', transcript: `${transcript}.gone` }));
  assert.equal(missing.status, 0, missing.stderr);
  assert.match(missing.stdout, /^budget: .*, tokens not counted \(no transcript at /m);
});

test('a transcript that is not a string: exit 2, the reason on stderr', () => {
  const repo = makeTestRepo();
  const out = node(proofCli, repo, JSON.stringify({ command: 'true', transcript: 5 }));
  assert.equal(out.status, 2);
  assert.equal(out.stdout, '');
  assert.match(out.stderr, /"transcript" must be a string/);
});
