// story: B7
// The measure CLI as a real process: the zero-cost first experiment writes one
// row per run to the file the owner names and prints the summary; agent arms
// without a spend cap are refused before anything runs (docs/MEASURE.md).
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempDirs, isolatedEnv, makeTempDir } from './test-helpers.ts';

after(cleanupTempDirs);

const measureCli = join(import.meta.dirname, 'measure-cli.ts');

function measure(cwd: string, input: object) {
  const out = spawnSync(process.execPath, [measureCli], { cwd, input: JSON.stringify(input), env: isolatedEnv(), encoding: 'utf8', timeout: 120000 });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

test('AC-B7-9 weftwork measure runs the seeded experiment, appends a row per run and prints the false-success rates', () => {
  const dir = makeTempDir();
  writeFileSync(join(dir, 'rows.jsonl'), '{"earlier":true}\n');
  const run = measure(dir, { out: 'rows.jsonl' });
  assert.equal(run.status, 0, run.stderr);
  const lines = readFileSync(join(dir, 'rows.jsonl'), 'utf8').trim().split('\n');
  assert.equal(lines[0], '{"earlier":true}', 'rows are appended, never overwritten');
  assert.equal(lines.length, 1 + 21);
  assert.equal(JSON.parse(lines[1] ?? '').experiment, 'e1-seeded');
  assert.match(run.stdout, /^weftwork measure: e1-seeded, 21 runs/);
  assert.match(run.stdout, /self-report +21 +18 +21 +3 +18 +100%/);
  assert.match(run.stdout, /gate +21 +18 +15 +3 +12 +67%/);
  assert.match(run.stdout, /mask-exit +3 of 3 accepted/);
});

test('AC-B7-10 agent arms without maxSpend are refused with exit 2 and nothing runs', () => {
  const dir = makeTempDir();
  const run = measure(dir, { out: 'rows.jsonl', arms: [{ name: 'plain', agent: 'touch ran' }] });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /^measure: .*maxSpend/);
  assert.equal(existsSync(join(dir, 'rows.jsonl')), false);
});
