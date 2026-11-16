// story: e12s02
// The AGENTS.md letter of a monorepo: each package's commands that resolve
// today (H3), checked in the package's own folder, one line per package, and
// a cap that keeps the letter short. docs/SETUP.md.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkedReport } from './init.ts';
import { agentsLetter, type Answers, type CheckedReport } from './setup-text.ts';
import { cleanupTempDirs, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const answers: Answers = { about: 'A monorepo.', words: [], never: [], rules: [], tasks: [] };

const scripts = (name: string, map: Record<string, string>): string => JSON.stringify({ name, scripts: map });

/** A monorepo: `api` has a test that passes only in its own folder and a
 * lint that fails; `web` has only a test whose command is missing. */
function monorepo(): string {
  return makeTestRepo({
    'package.json': JSON.stringify({ name: 'root', private: true, workspaces: ['packages/*'] }),
    'packages/api/package.json': scripts('api', { test: 'test -f only-in-api', lint: 'exit 3' }),
    'packages/api/only-in-api': '',
    'packages/web/package.json': scripts('web', { test: 'no-such-command-weftwork-test' }),
    'packages/notes/README.md': 'not a package\n',
  });
}

test('setup checks each package command in its own folder, and skips them all when run is false', async () => {
  const dir = monorepo();
  const checked = await checkedReport(dir, true, 60_000);
  assert.ok(checked.ok, checked.ok ? '' : checked.error);
  const status = (path: string): Record<string, string> =>
    Object.fromEntries(checked.report.packages.find((each) => each.path === path)?.commands.map((command) => [command.kind, command.check.status]) ?? []);
  assert.deepEqual(status('packages/api'), { test: 'passed', lint: 'failed' });
  assert.deepEqual(status('packages/web'), { test: 'missing' });

  const unchecked = await checkedReport(dir, false, 60_000);
  assert.ok(unchecked.ok);
  assert.ok(unchecked.report.packages.flatMap((each) => each.commands).every((command) => command.check.status === 'skipped'));
});

test('the letter names each package command that resolves, one line per package, and leaves the rest out', async () => {
  const checked = await checkedReport(monorepo(), true, 60_000);
  assert.ok(checked.ok);
  const letter = agentsLetter('mono', checked.report, answers);
  assert.match(letter, /## Packages\n\nEach command runs in its package's folder\.\n\n- `packages\/api`: test `npm run test`, lint `npm run lint` \(fails today\)\n/);
  assert.doesNotMatch(letter, /packages\/web|packages\/notes/);
});

function manyPackages(count: number): CheckedReport {
  const check = { status: 'passed' as const, exitCode: 0 };
  const packages = Array.from({ length: count }, (_, index) => ({
    path: `packages/p${String(index).padStart(2, '0')}`,
    languages: ['go'],
    packageManagers: ['go'],
    frameworks: [],
    commands: [{ kind: 'test' as const, command: 'go test ./...', source: 'go.mod', check }],
  }));
  return { path: '/x', languages: [], packageManagers: [], frameworks: [], commands: [], ci: [], agentFiles: [], planning: [], packages, notes: [] };
}

test('a large monorepo lists its first 20 packages and says how many more were left out', () => {
  const letter = agentsLetter('big', manyPackages(23), answers);
  assert.equal(letter.match(/^- `packages\/p\d\d`: test `go test \.\/\.\.\.`$/gm)?.length, 20);
  assert.match(letter, /- `packages\/p19`/);
  assert.doesNotMatch(letter, /packages\/p20/);
  assert.match(letter, /\n- 3 more packages are not listed, to keep this file short\.\n/);
});

test('a package path with a backtick stays one code span, and one with a line break is left out', () => {
  const report = manyPackages(2);
  report.packages[0].path = 'packages/a`b';
  report.packages[1].path = 'packages/c\nd';
  const letter = agentsLetter('odd', report, answers);
  assert.match(letter, /- ``packages\/a`b``: test `go test \.\/\.\.\.`\n/);
  assert.doesNotMatch(letter, /packages\/c/);
  assert.doesNotMatch(letter, /more package/);
});
