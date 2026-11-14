// story: e08s01
// story: e08s02
// The state CLI, run as a real process in temporary repositories (e08s02
// AC-06 to AC-08): "set" changes one documented field of specs/state.yaml
// through the field table and keeps every other byte, "get" prints the
// documented fields, and the exit codes of e08s01 stay. The writer's file
// refusals are tested on writeStateField itself (state-write.test.ts).
// No test touches this repository's own specs/state.yaml.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { setField } from './state-file.ts';
import { stateFields } from './state-fields.ts';
import { cleanupTempDirs, makeStateRepo, makeTempDir, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const stateCli = join(import.meta.dirname, 'state-cli.ts');
const fixture = readFileSync(join(import.meta.dirname, 'fixtures', 'state.yaml'), 'utf8');

type Run = {
  status: number | null;
  result: { ok: boolean; action?: string; file?: string; error?: string; fields?: Record<string, unknown> };
};

/** Run the state CLI in `cwd` with `input` on stdin. Its stdout must be one
 * JSON line. */
function runCli(cwd: string, input: string | Buffer): Run {
  const out = spawnSync('node', [stateCli], { cwd, input, encoding: 'utf8', timeout: 20000 });
  const lines = out.stdout.split('\n').filter((line) => line !== '');
  assert.equal(lines.length, 1, `stdout: ${out.stdout} stderr: ${out.stderr}`);
  return { status: out.status, result: JSON.parse(lines[0] as string) as Run['result'] };
}

const set = (key: unknown, value: unknown): string => JSON.stringify({ op: 'set', key, value });
const get = JSON.stringify({ op: 'get' });

/** The documented fields of the fixture, read with the yaml package, so the
 * test holds no story id. */
const fixtureFields = Object.fromEntries(stateFields.map((key) => {
  let node: unknown = parse(fixture);
  for (const part of key.split('.')) node = (node as Record<string, unknown>)[part];
  return [key, node];
}));

test('set writes one documented field, keeps the mode and leaves no temp file', () => {
  const { repo, specs, state } = makeStateRepo(fixture);
  const run = runCli(repo, set('active_story', 'e08s02'));
  assert.equal(run.status, 0, JSON.stringify(run.result));
  assert.deepEqual(run.result, { ok: true, action: 'written', file: 'specs/state.yaml' });
  const expected = setField(fixture, ['active_story'], 'e08s02');
  assert.ok(expected.ok);
  assert.equal(readFileSync(state, 'utf8'), expected.text);
  assert.equal(statSync(state).mode & 0o777, 0o640);
  assert.deepEqual(readdirSync(specs), ['state.yaml']);
});

test('set leaves a field that already holds the value as it was', () => {
  const { repo, state } = makeStateRepo(fixture);
  const before = statSync(state).mtimeMs;
  const run = runCli(repo, set('phase', 'planning'));
  assert.equal(run.status, 0);
  assert.deepEqual(run.result, { ok: true, action: 'unchanged', file: 'specs/state.yaml' });
  assert.equal(readFileSync(state, 'utf8'), fixture);
  assert.equal(statSync(state).mtimeMs, before);
});

test('the state file is found from the repository root, whatever the working directory', () => {
  const { specs, state } = makeStateRepo(fixture);
  const run = runCli(specs, set('active_story', null));
  assert.equal(run.status, 0, run.result.error ?? '');
  assert.match(readFileSync(state, 'utf8'), /^active_story: null$/m);
});

// AC-e08s02-06
test('get prints the documented fields and no other key', () => {
  const { repo, specs } = makeStateRepo(fixture);
  for (const cwd of [repo, specs]) {
    const run = runCli(cwd, get);
    assert.equal(run.status, 0, JSON.stringify(run.result));
    assert.deepEqual(run.result, { ok: true, fields: fixtureFields });
  }
});

// AC-e08s02-07
test('setting every documented field keeps the rest of the file byte for byte', () => {
  const { repo, state } = makeStateRepo(fixture);
  const values: [string, string | null][] = [
    ['active_flow', 'build_epic'],
    ['active_epic', 'e09'],
    ['active_story', 'e09s01'],
    ['phase', 'execute'],
    ['vcs.branch', 'e09s01-budget'],
  ];
  for (const [key, value] of values) {
    const run = runCli(repo, set(key, value));
    assert.equal(run.status, 0, `${key}: ${JSON.stringify(run.result)}`);
  }
  const after = readFileSync(state, 'utf8');
  const rest = (text: string): string => text.slice(text.indexOf('\nwaivers:'));
  assert.equal(rest(after), rest(fixture), 'waivers, handoff and metrics');
  for (const line of ['workflow_mode: solo-git', 'test_plan: lite', '  kind: git']) {
    assert.ok(after.includes(`\n${line}\n`) || after.startsWith(`${line}\n`), line);
  }
  const read = runCli(repo, get);
  assert.deepEqual(read.result.fields, Object.fromEntries(values));
});

test('the CLI refuses with exit 1 and leaves the state file as it was', () => {
  const cases: [string, string, RegExp][] = [
    ['a key outside the table', set('handoff.next_skill', 'x'), /"handoff\.next_skill" is not a field the engine writes/],
    ['a key the owner writes', set('workflow_mode', 'x'), /"workflow_mode"/],
    ['a value with a newline', set('phase', 'a\nb'), /"phase" must be one line/],
    ['a value over 200 characters', set('phase', 'x'.repeat(201)), /"phase" must be 200 characters or fewer/],
    ['a number', set('phase', 3), /"phase" must be text or null/],
    ['an object', set('phase', { a: 1 }), /"phase" must be text or null/],
  ];
  for (const [label, input, message] of cases) {
    const { repo, state } = makeStateRepo(fixture);
    const run = runCli(repo, input);
    assert.equal(run.status, 1, `${label}: ${JSON.stringify(run.result)}`);
    assert.equal(run.result.ok, false, label);
    assert.match(run.result.error ?? '', message, label);
    assert.equal(readFileSync(state, 'utf8'), fixture, label);
  }
});

test('set and get answer exit 1 when the state file cannot be read', () => {
  const missing = makeTestRepo();
  const linked = makeStateRepo(fixture);
  writeFileSync(join(linked.specs, 'real.yaml'), fixture);
  unlinkSync(linked.state);
  symlinkSync(join(linked.specs, 'real.yaml'), linked.state);
  const cases: [string, string, string, RegExp][] = [
    ['set with no state file', missing, set('phase', 'x'), /specs\/state\.yaml/],
    ['get with no state file', missing, get, /specs\/state\.yaml/],
    ['set on a symlinked state file', linked.repo, set('phase', 'x'), /regular file/],
    ['get on a symlinked state file', linked.repo, get, /regular file/],
  ];
  for (const [label, cwd, input, message] of cases) {
    const run = runCli(cwd, input);
    assert.equal(run.status, 1, `${label}: ${JSON.stringify(run.result)}`);
    assert.match(run.result.error ?? '', message, label);
  }
  assert.equal(readFileSync(join(linked.specs, 'real.yaml'), 'utf8'), fixture);
});

// AC-e08s02-08
test('the CLI answers exit 2 for input it cannot read', () => {
  const { repo, state } = makeStateRepo(fixture);
  const cases: [string, string, string | Buffer][] = [
    ['stdin that is not JSON', repo, '{"op":'],
    ['stdin that is not an object', repo, '["set"]'],
    ['no op', repo, JSON.stringify({ key: 'phase', value: 'x' })],
    ['an unknown op', repo, JSON.stringify({ op: 'delete', key: 'phase' })],
    ['a request with a "file" field', repo, JSON.stringify({ op: 'set', file: 'specs/state.yaml', key: 'phase', value: 'x' })],
    ['a "path" list in place of a key', repo, JSON.stringify({ op: 'set', path: ['phase'], value: 'x' })],
    ['a key that is not text', repo, set(['phase'], 'x')],
    ['set with no value', repo, JSON.stringify({ op: 'set', key: 'phase' })],
    ['get with a key', repo, JSON.stringify({ op: 'get', key: 'phase' })],
    ['stdin that is not valid UTF-8', repo, Buffer.concat([
      Buffer.from('{"op":"set","key":"phase","value":"b'), Buffer.from([0xff]), Buffer.from('"}'),
    ])],
    ['stdin over 1 MiB', repo, set('phase', 'x'.repeat(1024 * 1024))],
    ['a working directory that is not in a git repository', makeTempDir(), get],
  ];
  for (const [label, cwd, input] of cases) {
    const run = runCli(cwd, input);
    assert.equal(run.status, 2, `${label}: ${JSON.stringify(run.result)}`);
    assert.equal(run.result.ok, false, label);
    assert.ok((run.result.error ?? '').length > 0, label);
  }
  assert.equal(readFileSync(state, 'utf8'), fixture);
});
