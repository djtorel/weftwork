// story: e12s01
// Detecting a project from its files alone: fixture folders for a Node, a
// Python, a Go and an empty project give the expected reports. No command runs
// here; detect-check.test.ts covers the runs.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { detectProject, type ProjectReport } from './detect.ts';
import { cleanupTempDirs, makeTempDir } from './test-helpers.ts';

after(cleanupTempDirs);

/** A temporary folder with `files` (a name ending in `/` is an empty folder). */
function fixture(files: Record<string, string>): string {
  const dir = makeTempDir();
  for (const [name, content] of Object.entries(files)) {
    if (name.endsWith('/')) {
      mkdirSync(join(dir, name), { recursive: true });
      continue;
    }
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

function empty(path: string): ProjectReport {
  return { path, languages: [], packageManagers: [], frameworks: [], commands: [], ci: [], agentFiles: [], planning: [], packages: [], notes: [] };
}

async function report(dir: string): Promise<ProjectReport> {
  const result = await detectProject(dir);
  assert.ok(result.ok, result.ok ? '' : result.error);
  return result.report;
}

test('AC-e12s01-01 a Node project: language, package manager, frameworks, scripts, CI, agent files, bigpowers', async () => {
  const pkg = {
    scripts: { test: 'vitest run', lint: 'eslint .', typecheck: 'tsc --noEmit', build: 'vite build', dev: 'vite', deploy: 'vercel deploy', format: 'prettier -w .' },
    dependencies: { react: '19.0.0' },
    devDependencies: { typescript: '5.9.0', vite: '7.0.0' },
  };
  const dir = fixture({
    'package.json': JSON.stringify(pkg),
    'pnpm-lock.yaml': '',
    'tsconfig.json': '{}',
    '.github/workflows/ci.yml': '',
    '.github/workflows/release.yaml': '',
    'AGENTS.md': '',
    'CLAUDE.md': '',
    'specs/state.yaml': '',
  });
  assert.deepEqual(await report(dir), {
    ...empty(dir),
    languages: ['typescript'],
    packageManagers: ['pnpm'],
    frameworks: ['React', 'Vite'],
    commands: [
      { kind: 'test', command: 'pnpm run test', source: 'package.json', body: 'vitest run' },
      { kind: 'lint', command: 'pnpm run lint', source: 'package.json', body: 'eslint .' },
      { kind: 'typecheck', command: 'pnpm run typecheck', source: 'package.json', body: 'tsc --noEmit' },
      { kind: 'build', command: 'pnpm run build', source: 'package.json', body: 'vite build' },
      { kind: 'run', command: 'pnpm run dev', source: 'package.json', body: 'vite' },
    ],
    ci: ['.github/workflows/ci.yml', '.github/workflows/release.yaml'],
    agentFiles: ['AGENTS.md', 'CLAUDE.md'],
    planning: [{ system: 'bigpowers', path: 'specs/state.yaml' }],
  });
});

test('AC-e12s01-02 a Python project: poetry, FastAPI, pytest, ruff, mypy, GSD and Cursor rules', async () => {
  const pyproject = [
    '[tool.poetry]',
    'name = "app"',
    '[tool.poetry.dependencies]',
    'fastapi = "^0.110"',
    '[tool.poetry.group.dev.dependencies]',
    'pytest = "^8"',
    'ruff = "^0.5"',
    'mypy = "^1"',
  ].join('\n');
  const dir = fixture({ 'pyproject.toml': pyproject, 'poetry.lock': '', '.planning/': '', '.cursor/rules/': '', '.gitlab-ci.yml': '' });
  assert.deepEqual(await report(dir), {
    ...empty(dir),
    languages: ['python'],
    packageManagers: ['poetry'],
    frameworks: ['FastAPI'],
    commands: [
      { kind: 'test', command: 'poetry run pytest', source: 'pyproject.toml' },
      { kind: 'lint', command: 'poetry run ruff check .', source: 'pyproject.toml' },
      { kind: 'typecheck', command: 'poetry run mypy .', source: 'pyproject.toml' },
    ],
    ci: ['.gitlab-ci.yml'],
    agentFiles: ['.cursor/rules'],
    planning: [{ system: 'gsd', path: '.planning' }],
  });
});

test('AC-e12s01-03 a Go project: go.mod, Gin, the go commands, Makefile targets, spec-kit', async () => {
  const goMod = 'module example.com/app\n\ngo 1.23\n\nrequire github.com/gin-gonic/gin v1.10.0\n';
  const makefile = '.PHONY: lint test\nVERSION := 1\n\nlint:\n\tgolangci-lint run\n\ntest: build\n\tgo test -race ./...\n\nship:\n\t./deploy.sh\n';
  const dir = fixture({ 'go.mod': goMod, Makefile: makefile, '.specify/': '' });
  assert.deepEqual(await report(dir), {
    ...empty(dir),
    languages: ['go'],
    packageManagers: ['go'],
    frameworks: ['Gin'],
    commands: [
      { kind: 'test', command: 'go test ./...', source: 'go.mod' },
      { kind: 'lint', command: 'go vet ./...', source: 'go.mod' },
      { kind: 'build', command: 'go build ./...', source: 'go.mod' },
      { kind: 'lint', command: 'make lint', source: 'Makefile', body: 'golangci-lint run' },
      { kind: 'test', command: 'make test', source: 'Makefile', body: 'go test -race ./...\n# build' },
    ],
    planning: [{ system: 'spec-kit', path: '.specify' }],
  });
});

test('AC-e12s01-04 an empty folder gives an empty report', async () => {
  const dir = makeTempDir();
  assert.deepEqual(await report(dir), empty(dir));
});

test('AC-e12s01-05 a broken manifest is a note, not a failure, and BMAD is found', async () => {
  const dir = fixture({ 'package.json': '{ not json', '_bmad/': '' });
  const found = await report(dir);
  assert.deepEqual(found.languages, ['javascript']);
  assert.deepEqual(found.commands, []);
  assert.deepEqual(found.planning, [{ system: 'bmad', path: '_bmad' }]);
  assert.equal(found.notes.length, 1);
  assert.match(found.notes[0] ?? '', /^package\.json is not a JSON object/);
});

test('AC-e12s01-06 a path that is not a folder fails with the reason', async () => {
  const dir = fixture({ 'file.txt': '' });
  const result = await detectProject(join(dir, 'file.txt'));
  assert.equal(result.ok, false);
  assert.match(result.ok ? '' : result.error, /is not a folder/);
  assert.equal((await detectProject(join(dir, 'gone'))).ok, false);
});

test('AC-e12s01-18 a monorepo: npm and pnpm workspaces, go.work and a Cargo workspace each report their packages', async () => {
  const pkg = { workspaces: ['packages/*', '!packages/skip'], scripts: { test: 'node -e 0' } };
  const dir = fixture({
    'package.json': JSON.stringify(pkg),
    'pnpm-lock.yaml': '',
    'pnpm-workspace.yaml': 'packages:\n  - tools/cli\n',
    'packages/web/package.json': JSON.stringify({ scripts: { test: 'vitest run' }, dependencies: { react: '19.0.0' } }),
    'packages/skip/package.json': '{}',
    'packages/notes.md': '',
    'tools/cli/package.json': JSON.stringify({ scripts: { lint: 'eslint .' } }),
    'go.work': 'go 1.23\n\nuse (\n\t./svc\n\t../outside\n)\n',
    'svc/go.mod': 'module example.com/svc\n',
    'Cargo.toml': '[workspace] # all crates\nmembers = [\n  "crates/*",\n]\nexclude = ["crates/old"]\n',
    'crates/core/Cargo.toml': '[package]\nname = "core"\n',
    'crates/old/Cargo.toml': '[package]\nname = "old"\n',
  });
  const found = await report(dir);
  assert.deepEqual(found.packages, [
    { path: 'crates/core', languages: ['rust'], packageManagers: ['cargo'], frameworks: [], commands: [
      { kind: 'test', command: 'cargo test', source: 'Cargo.toml' },
      { kind: 'typecheck', command: 'cargo check', source: 'Cargo.toml' },
      { kind: 'build', command: 'cargo build', source: 'Cargo.toml' },
    ] },
    { path: 'packages/web', languages: ['javascript'], packageManagers: ['pnpm'], frameworks: ['React'], commands: [
      { kind: 'test', command: 'pnpm run test', source: 'package.json', body: 'vitest run' },
    ] },
    { path: 'svc', languages: ['go'], packageManagers: ['go'], frameworks: [], commands: [
      { kind: 'test', command: 'go test ./...', source: 'go.mod' },
      { kind: 'lint', command: 'go vet ./...', source: 'go.mod' },
      { kind: 'build', command: 'go build ./...', source: 'go.mod' },
    ] },
    { path: 'tools/cli', languages: ['javascript'], packageManagers: ['pnpm'], frameworks: [], commands: [
      { kind: 'lint', command: 'pnpm run lint', source: 'package.json', body: 'eslint .' },
    ] },
  ]);
});

test('AC-e12s01-20 a pnpm-workspace.yaml that does not parse is a note', async () => {
  const found = await report(fixture({ 'pnpm-workspace.yaml': 'packages: [\n', 'package.json': '{}' }));
  assert.deepEqual(found.packages, []);
  assert.ok(found.notes.some((note) => /^pnpm-workspace\.yaml was not parsed/.test(note)), found.notes.join('; '));
});
