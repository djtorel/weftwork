// story: e06s02, e08s03
// Tests for the working-tree fingerprint (e06s02, AC-01 to AC-05).
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  chmodSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fingerprintTree, uncommittedPaths } from './tree.ts';
import { cleanupTempDirs, git, makeTempDir, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

async function fingerprintOf(dir: string): Promise<string> {
  const result = await fingerprintTree(dir);
  assert.ok(result.ok, 'the fingerprint is ok');
  return result.fingerprint;
}

async function assertNotOk(dir: string): Promise<void> {
  const result = await fingerprintTree(dir);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.notEqual(result.error, '');
  }
}

test('AC-e06s02-01 the same tree gives the same fingerprint', async () => {
  const dir = makeTestRepo();
  const first = await fingerprintOf(dir);
  const second = await fingerprintOf(dir);
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(second, first);
});

const changes: ReadonlyArray<{ name: string; apply: (dir: string) => void }> = [
  {
    name: 'the tracked file gets one more byte',
    apply: (dir) => appendFileSync(join(dir, 'tracked.txt'), 'x'),
  },
  {
    name: 'a new untracked file is added',
    apply: (dir) => writeFileSync(join(dir, 'new.txt'), 'new'),
  },
  {
    name: 'the tracked file is deleted',
    apply: (dir) => rmSync(join(dir, 'tracked.txt')),
  },
  {
    name: 'the tracked file gets the executable bit',
    apply: (dir) => chmodSync(join(dir, 'tracked.txt'), 0o755),
  },
  {
    name: 'the symlink is re-pointed at another path',
    apply: (dir) => {
      rmSync(join(dir, 'link'));
      symlinkSync('elsewhere', join(dir, 'link'));
    },
  },
];

for (const { name, apply } of changes) {
  test(`AC-e06s02-02 ${name}: the fingerprint changes`, async () => {
    const dir = makeTestRepo();
    symlinkSync('tracked.txt', join(dir, 'link'));
    const before = await fingerprintOf(dir);
    apply(dir);
    assert.notEqual(await fingerprintOf(dir), before);
  });
}

const noChanges: ReadonlyArray<{
  name: string;
  apply: (dir: string, externalFile: string) => void;
}> = [
  {
    name: 'a file is added under the ignored directory out/',
    apply: (dir) => {
      mkdirSync(join(dir, 'out'));
      writeFileSync(join(dir, 'out', 'a.txt'), 'a');
    },
  },
  {
    name: 'the file the symlink points to gets new content',
    apply: (_dir, externalFile) => writeFileSync(externalFile, 'changed'),
  },
  {
    name: 'the tracked file is touched, content unchanged',
    apply: (dir) => utimesSync(join(dir, 'tracked.txt'), 1, 1),
  },
];

for (const { name, apply } of noChanges) {
  test(`AC-e06s02-03 ${name}: the fingerprint stays`, async () => {
    const dir = makeTestRepo({ 'tracked.txt': 'one\n', '.gitignore': 'out/\n' });
    const externalFile = join(makeTempDir(), 'external.txt');
    writeFileSync(externalFile, 'original');
    symlinkSync(externalFile, join(dir, 'extlink'));
    const before = await fingerprintOf(dir);
    apply(dir, externalFile);
    assert.equal(await fingerprintOf(dir), before);
  });
}

const oddEntries: ReadonlyArray<{ name: string; make: (dir: string) => void }> = [
  { name: 'a name with a newline', make: (dir) => writeFileSync(join(dir, 'a\nb'), 'x') },
  { name: 'a file named -x', make: (dir) => writeFileSync(join(dir, '-x'), 'x') },
  { name: 'a name that is not valid UTF-8', make: (dir) => writeFileSync(badName(dir), 'x') },
  { name: 'a FIFO', make: (dir) => execFileSync('mkfifo', [join(dir, 'pipe')]) },
  {
    name: 'a nested git repository',
    make: (dir) => {
      mkdirSync(join(dir, 'sub'));
      git(join(dir, 'sub'), 'init', '-q', '-b', 'main');
    },
  },
];

function badName(dir: string): Buffer {
  return Buffer.concat([Buffer.from(`${dir}/bad`), Buffer.from([0xff])]);
}

for (const { name, make } of oddEntries) {
  test(`AC-e06s02-04 ${name} does not break it`, { timeout: 5000 }, async () => {
    const dir = makeTestRepo();
    make(dir);
    await fingerprintOf(dir);
  });
}

test('AC-e06s02-04 the content of a non-UTF-8 name is hashed', async () => {
  const dir = makeTestRepo();
  writeFileSync(badName(dir), 'x');
  const before = await fingerprintOf(dir);
  writeFileSync(badName(dir), 'y');
  assert.notEqual(await fingerprintOf(dir), before);
});

test('AC-e06s02-05 a subdirectory gives the fingerprint of the root', async () => {
  const dir = makeTestRepo();
  mkdirSync(join(dir, 'sub'));
  writeFileSync(join(dir, 'sub', 'inner.txt'), 'inner');
  assert.equal(await fingerprintOf(join(dir, 'sub')), await fingerprintOf(dir));
});

test('AC-e06s02-05 a directory that is not in a git repository is not ok', async () => {
  await assertNotOk(makeTempDir());
});

test('AC-e06s02-05 a directory that does not exist is not ok', async () => {
  await assertNotOk(join(makeTempDir(), 'does-not-exist'));
});

test('AC-e06s02-05 a path with a NUL byte is not ok', async () => {
  await assertNotOk('/tmp\u0000x');
});

// e08s03: the paths the handoff records as uncommitted at write time.
test('uncommittedPaths lists changed, staged, renamed and untracked paths', async () => {
  const repo = makeTestRepo({ 'tracked.txt': 'one\n', 'old name.txt': 'x\n', 'clean.txt': 'c\n' });
  writeFileSync(join(repo, 'tracked.txt'), 'two\n');
  git(repo, 'mv', 'old name.txt', 'new name.txt');
  mkdirSync(join(repo, 'dir'));
  writeFileSync(join(repo, 'dir', 'line\nbreak.txt'), 'u\n');
  const result = await uncommittedPaths(repo);
  assert.ok(result.ok, result.ok ? '' : result.error);
  assert.deepEqual([...result.paths].sort(), ['dir/line\nbreak.txt', 'new name.txt', 'tracked.txt']);
});

test('uncommittedPaths gives an empty list for a clean tree', async () => {
  assert.deepEqual(await uncommittedPaths(makeTestRepo()), { ok: true, paths: [] });
});

test('uncommittedPaths refuses a path that is not UTF-8', async () => {
  const repo = makeTestRepo();
  writeFileSync(Buffer.concat([Buffer.from(join(repo, 'bad-')), Buffer.from([0xff]), Buffer.from('.txt')]), 'u\n');
  const result = await uncommittedPaths(repo);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && /UTF-8/.test(result.error), result.ok ? '' : result.error);
});

test('uncommittedPaths fails outside a repository', async () => {
  const result = await uncommittedPaths(makeTempDir());
  assert.equal(result.ok, false);
});
