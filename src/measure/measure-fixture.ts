// story: B7
// The fixture for the measurement harness (docs/MEASURE.md): a small git
// repository with one planted defect, a visible test the agent sees and runs
// with `sh check.sh`, and a held-out oracle test in a folder beside the
// repository, which the agent never sees (R10, Task set: a hidden test that
// composes what the visible test checks alone).
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { runCapture } from '../engine/process.ts';

const run = promisify(execFile);

/** One planted defect. `partial` passes the visible test and fails the
 * oracle; `call` is the visible test's call, `expected` its JSON result. */
export type FixtureTask = {
  id: string;
  text: string;
  defect: string;
  fixed: string;
  partial: string;
  name: string;
  call: string;
  expected: string;
  oracle: string;
};

export const fixtureTasks: readonly FixtureTask[] = [
  {
    id: 'clamp',
    text: 'clamp in lib.mjs ignores the lower bound. Fix it so `sh check.sh` passes.',
    defect: 'export function clamp(x, lo, hi) {\n  return Math.min(x, hi);\n}\n',
    fixed: 'export function clamp(x, lo, hi) {\n  return Math.max(lo, Math.min(x, hi));\n}\n',
    partial: 'export function clamp(x, lo, hi) {\n  return Math.max(0, Math.min(x, hi));\n}\n',
    name: 'clamp',
    call: 'clamp(-5, 0, 10)',
    expected: '0',
    oracle: 'assert.equal(clamp(3, 5, 10), 5);\nassert.equal(clamp(12, 5, 10), 10);\nassert.equal(clamp(-5, 0, 10), 0);',
  },
  {
    id: 'slug',
    text: 'slug in lib.mjs keeps capital letters. Fix it so `sh check.sh` passes.',
    defect: "export function slug(s) {\n  return s.trim().replace(/\\s+/g, '-');\n}\n",
    fixed: "export function slug(s) {\n  return s.trim().replace(/\\s+/g, '-').toLowerCase();\n}\n",
    partial: "export function slug(s) {\n  return s.trim().replace(/\\s+/g, '-').replace(/^./, (c) => c.toLowerCase());\n}\n",
    name: 'slug',
    call: "slug('Hello')",
    expected: '"hello"',
    oracle: "assert.equal(slug('  Hello World '), 'hello-world');\nassert.equal(slug('ABC'), 'abc');",
  },
  {
    id: 'last',
    text: 'last in lib.mjs returns undefined. Fix it so `sh check.sh` passes.',
    defect: 'export function last(xs) {\n  return xs[xs.length];\n}\n',
    fixed: 'export function last(xs) {\n  return xs[xs.length - 1];\n}\n',
    partial: 'export function last(xs) {\n  return xs[2];\n}\n',
    name: 'last',
    call: 'last([1, 2, 3])',
    expected: '3',
    oracle: "assert.equal(last([7]), 7);\nassert.equal(last(['a', 'b']), 'b');\nassert.equal(last([1, 2, 3]), 3);",
  },
];

/** `dir` holds `repo` (what the agent sees) and the oracle file beside it. */
export type Fixture = { dir: string; repo: string; oracleFile: string };

/** The visible test, which imports lib.mjs and checks one call. */
export function visibleTest(task: FixtureTask): string {
  return [
    "import { test } from 'node:test';",
    "import assert from 'node:assert/strict';",
    `import { ${task.name} } from '../lib.mjs';`,
    '',
    `test('${task.id}', () => {`,
    `  assert.deepEqual(${task.call}, ${task.expected});`,
    '});',
    '',
  ].join('\n');
}

// A test runner sets NODE_TEST_CONTEXT for its children, and a nested
// `node --test` that sees it skips its files and exits 0. Unset it, so the
// fixture's verdicts do not depend on who runs the harness.
export const checkScript = 'unset NODE_TEST_CONTEXT\nnode --test --test-reporter=dot test/visible.test.mjs\n';

async function git(cwd: string, ...args: string[]): Promise<void> {
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
  const identity = ['-c', 'user.name=weftwork-measure', '-c', 'user.email=measure@example.invalid', '-c', 'commit.gpgsign=false'];
  await run('git', [...identity, ...args], { cwd, env });
}

/** A new temporary fixture for `task`, committed, with its oracle held out. */
export async function buildFixture(task: FixtureTask): Promise<Fixture> {
  const dir = await mkdtemp(join(tmpdir(), 'weftwork-measure-'));
  const repo = join(dir, 'repo');
  await mkdir(join(repo, 'test'), { recursive: true });
  await writeFile(join(repo, 'lib.mjs'), task.defect);
  await writeFile(join(repo, 'test', 'visible.test.mjs'), visibleTest(task));
  await writeFile(join(repo, 'check.sh'), checkScript);
  await git(repo, 'init', '-q', '-b', 'main');
  await git(repo, 'add', '-A');
  await git(repo, 'commit', '-q', '-m', 'fixture');
  const oracleFile = join(dir, 'oracle', 'oracle.test.mjs');
  await mkdir(join(dir, 'oracle'));
  const lib = pathToFileURL(join(repo, 'lib.mjs')).href;
  const imports = `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { ${task.name} } from ${JSON.stringify(lib)};\n`;
  await writeFile(oracleFile, `${imports}\ntest('oracle ${task.id}', () => {\n${task.oracle}\n});\n`);
  return { dir, repo, oracleFile };
}

/** True when the held-out oracle passes on the repository as it is now. */
export async function runOracle(fixture: Fixture): Promise<boolean> {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const command = `node --test --test-reporter=dot ${JSON.stringify(fixture.oracleFile)}`;
  const outcome = await runCapture(command, join(fixture.dir, 'oracle'), 60000, '', env);
  return outcome.reason === 'passed';
}

export async function removeFixture(fixture: Fixture): Promise<void> {
  await rm(fixture.dir, { recursive: true, force: true });
}
