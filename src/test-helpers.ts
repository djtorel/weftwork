// story: e06s02
// Shared by the test files: temporary directories and temporary git
// repositories, so no test runs a command in the real repository.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDirs: string[] = [];

/** Remove every directory made here. Call it from `after`. */
export function cleanupTempDirs(): void {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** An empty temporary directory that is not a git repository. */
export function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'weftwork-test-'));
  tempDirs.push(dir);
  return dir;
}

/** Run git in `dir` with no user or system config and a fixed identity. */
export function git(dir: string, ...args: string[]): void {
  const identity = ['user.name=weftwork-test', 'user.email=test@example.invalid'];
  execFileSync(
    'git',
    [...identity.flatMap((pair) => ['-c', pair]), '-c', 'commit.gpgsign=false', ...args],
    {
      cwd: dir,
      stdio: 'ignore',
      env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
    },
  );
}

/** A temporary git repository with `files` committed. Returns its path. */
export function makeTestRepo(files: Record<string, string> = { 'tracked.txt': 'one\n' }): string {
  const dir = makeTempDir();
  git(dir, 'init', '-q', '-b', 'main');
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'init');
  return dir;
}
