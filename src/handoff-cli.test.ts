// story: e08s03
// The handoff CLI, run as a real process in temporary repositories (e08s03
// AC-07, AC-08): it writes the handoff block of specs/state.yaml from JSON on
// stdin and keeps every other byte, exits 1 when the engine refuses and 2 for
// input it cannot read, and leaves the file as it was unless it exits 0. The
// field checks are tested on writeHandoff itself (handoff.test.ts). No test
// touches this repository's own specs/state.yaml.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { cleanupTempDirs, makeStateRepo, makeTempDir } from './test-helpers.ts';

after(cleanupTempDirs);

const handoffCli = join(import.meta.dirname, 'handoff-cli.ts');
const fixture = readFileSync(join(import.meta.dirname, 'fixtures', 'state.yaml'), 'utf8');

const input = JSON.stringify({
  next_skill: 'verify-work',
  next_story: 'e08s03',
  branch: 'e08s03-handoff-note',
  note: 'Task 3 is done.',
});

/** Run the handoff CLI in `cwd` with `stdin`. Its stdout must be one JSON line. */
function runCli(cwd: string, stdin: string | Buffer): { status: number | null; result: { ok: boolean; error?: string } } {
  const out = spawnSync('node', [handoffCli], { cwd, input: stdin, encoding: 'utf8', timeout: 20000 });
  const lines = out.stdout.split('\n').filter((line) => line !== '');
  assert.equal(lines.length, 1, `stdout: ${out.stdout} stderr: ${out.stderr}`);
  return { status: out.status, result: JSON.parse(lines[0] as string) as { ok: boolean; error?: string } };
}

// AC-e08s03-07
test('a complete input writes the block and keeps the rest of the file', () => {
  const { repo, state } = makeStateRepo(fixture);
  const run = runCli(repo, input);
  assert.equal(run.status, 0, JSON.stringify(run.result));
  assert.deepEqual(run.result, { ok: true, action: 'written', file: 'specs/state.yaml' });
  const text = readFileSync(state, 'utf8');
  const block = (parse(text) as Record<string, Record<string, unknown>>)['handoff'];
  assert.equal(block?.['next_skill'], 'verify-work');
  assert.equal(block?.['note'], 'Task 3 is done.');
  assert.equal(typeof block?.['written_at'], 'string');
  const above = fixture.slice(0, fixture.indexOf('\nhandoff:'));
  const below = fixture.slice(fixture.indexOf('\nmetrics:'));
  assert.ok(above.length > 1000 && below.length > 100, 'the fixture has text on both sides');
  assert.ok(text.startsWith(above), 'the waivers and the keys above are byte-identical');
  assert.ok(text.endsWith(below), 'the metrics are byte-identical');
});

test('the CLI writes the state file of the repository root from a subdirectory', () => {
  const { specs, state } = makeStateRepo(fixture);
  assert.equal(runCli(specs, input).status, 0);
  assert.ok(readFileSync(state, 'utf8').includes('branch: e08s03-handoff-note'));
});

// AC-e08s03-08
for (const [name, stdin, code] of [
  ['a note of 4001 code points', JSON.stringify({ ...JSON.parse(input), note: 'x'.repeat(4001) }), 1],
  ['a file that does not exist', JSON.stringify({ ...JSON.parse(input), files: ['nope.txt'] }), 1],
  ['text that is not JSON', 'not json', 2],
  ['a JSON list, not an object', '[]', 2],
  ['a request with an ok key, which is an unknown key', JSON.stringify({ ...JSON.parse(input), ok: true }), 1],
  ['bytes that are not UTF-8', Buffer.from([0x7b, 0xff, 0x7d]), 2],
] as [string, string | Buffer, number][]) {
  test(`${name} exits ${code} and leaves the file as it was`, () => {
    const { repo, state } = makeStateRepo(fixture);
    const run = runCli(repo, stdin);
    assert.equal(run.status, code, JSON.stringify(run.result));
    assert.equal(run.result.ok, false);
    assert.equal(readFileSync(state, 'utf8'), fixture);
  });
}

test('a note the yaml package cannot write as a block scalar still gives one JSON line and exit 0', () => {
  // Review round 2, B1: this note made setMapping throw, and the CLI print a stack trace.
  const { repo, state } = makeStateRepo(fixture);
  // Whitespace-only lines first, as in the crash; the note itself is not only whitespace.
  const run = runCli(repo, JSON.stringify({ ...JSON.parse(input), note: ' \n\t\nx' }));
  assert.equal(run.status, 0, JSON.stringify(run.result));
  assert.equal((parse(readFileSync(state, 'utf8')) as Record<string, Record<string, unknown>>)['handoff']?.['note'], ' \n\t\nx');
});

test('outside a git repository the CLI exits 2', () => {
  const run = runCli(makeTempDir(), input);
  assert.equal(run.status, 2);
  assert.match(run.result.error ?? '', /git repository/);
});
