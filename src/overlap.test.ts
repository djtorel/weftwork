// story: B8
// The file-overlap check (docs/PARALLEL.md): which pairs of planned tasks
// would change the same file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findOverlaps, toPlannedTasks } from './overlap.ts';

const pairsOf = (tasks: { name: string; files: string[] }[]) => findOverlaps(tasks);

test('B8-01 disjoint file lists are clear', () => {
  assert.deepEqual(pairsOf([
    { name: 'a', files: ['src/a.ts', 'docs/A.md'] },
    { name: 'b', files: ['src/b.ts', 'src/ab.ts'] },
  ]), []);
});

test('B8-02 the same file in two tasks is an overlap, after ./ and // are normalized', () => {
  assert.deepEqual(pairsOf([
    { name: 'a', files: ['./src/a.ts', 'x.md'] },
    { name: 'b', files: ['src//a.ts'] },
  ]), [{ tasks: ['a', 'b'], files: [['src/a.ts', 'src/a.ts']] }]);
});

test('B8-03 a glob that matches the other task\'s path is an overlap, dot files included', () => {
  assert.deepEqual(pairsOf([
    { name: 'a', files: ['src/**/*.ts'] },
    { name: 'b', files: ['src/deep/x.ts', 'src/x.md'] },
    { name: 'c', files: ['.github/workflows/ci.yml'] },
    { name: 'd', files: ['**/*.yml'] },
  ]), [
    { tasks: ['a', 'b'], files: [['src/**/*.ts', 'src/deep/x.ts']] },
    { tasks: ['c', 'd'], files: [['.github/workflows/ci.yml', '**/*.yml']] },
  ]);
});

test('B8-04 a path inside the other task\'s folder is an overlap, either way round', () => {
  assert.deepEqual(pairsOf([
    { name: 'a', files: ['src/engine'] },
    { name: 'b', files: ['src/engine/loop.ts'] },
    { name: 'c', files: ['docs/'] },
    { name: 'd', files: ['docs/x/*.md', 'src/engineering.ts'] },
  ]), [
    { tasks: ['a', 'b'], files: [['src/engine', 'src/engine/loop.ts']] },
    { tasks: ['c', 'd'], files: [['docs/', 'docs/x/*.md']] },
  ]);
});

test('B8-05 two globs overlap when their fixed folders nest, and not when they do not', () => {
  assert.deepEqual(pairsOf([
    { name: 'a', files: ['src/*.ts'] },
    { name: 'b', files: ['src/x/**'] },
    { name: 'c', files: ['docs/*.md'] },
  ]), [{ tasks: ['a', 'b'], files: [['src/*.ts', 'src/x/**']] }]);
});

test('B8-06 a task is never compared with itself', () => {
  assert.deepEqual(pairsOf([
    { name: 'a', files: ['src/a.ts', 'src/a.ts', 'src/**'] },
    { name: 'b', files: ['docs/b.md'] },
  ]), []);
});

test('B8-07 the request must hold two or more named tasks, each with files or a branch', () => {
  const bad: unknown[] = [
    {},
    { tasks: 'a' },
    { tasks: [{ name: 'a', files: ['x'] }] },
    { tasks: [{ name: 'a', files: ['x'] }, { name: 'a', files: ['y'] }] },
    { tasks: [{ name: '', files: ['x'] }, { name: 'b', files: ['y'] }] },
    { tasks: [{ name: 'a', files: [] }, { name: 'b', files: ['y'] }] },
    { tasks: [{ name: 'a', files: ['x'], branch: 'b' }, { name: 'b', files: ['y'] }] },
    { tasks: [{ name: 'a' }, { name: 'b', files: ['y'] }] },
    { tasks: [{ name: 'a', files: ['/etc/x'] }, { name: 'b', files: ['y'] }] },
    { tasks: [{ name: 'a', files: ['../x'] }, { name: 'b', files: ['y'] }] },
    { tasks: [{ name: 'a', files: ['.'] }, { name: 'b', files: ['y'] }] },
    { tasks: [{ name: 'a', branch: '-x' }, { name: 'b', files: ['y'] }] },
    { tasks: [{ name: 'a', files: ['x'] }, { name: 'b', files: ['y'] }], base: '' },
  ];
  for (const input of bad) {
    const read = toPlannedTasks(input as Record<string, unknown>);
    assert.equal(read.ok, false, JSON.stringify(input));
  }
  assert.deepEqual(toPlannedTasks({ tasks: [{ name: 'a', files: ['x'] }, { name: 'b', branch: 'feat/b' }] }), {
    ok: true,
    tasks: [{ name: 'a', files: ['x'] }, { name: 'b', branch: 'feat/b' }],
    base: 'HEAD',
  });
});
