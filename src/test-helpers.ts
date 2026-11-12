// story: e06s02
// Shared by the test files: temporary directories and temporary git
// repositories, so no test runs a command in the real repository.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { ledgerPath, readLedger, type LedgerEntry } from './ledger.ts';

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

/** The ledger of the repository at `repo`, read back. Fails the test if the
 * path cannot be found or the file cannot be read. */
export async function readRepoLedger(
  repo: string,
): Promise<{ entries: LedgerEntry[]; skipped: number }> {
  const path = await ledgerPath(repo);
  assert.notEqual(path, null);
  const read = await readLedger(path as string);
  assert.ok(read.ok);
  return read;
}

/** True while the process lives. A zombie that has not been reaped is gone. */
export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  try {
    return !/\) Z /.test(readFileSync(`/proc/${pid}/stat`, 'utf8'));
  } catch {
    return true;
  }
}

/** Poll until `pid` is gone, for at most `limitMs`. */
export async function waitUntilGone(pid: number, limitMs: number): Promise<boolean> {
  const deadline = Date.now() + limitMs;
  while (isAlive(pid)) {
    if (Date.now() > deadline) {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return true;
}

/** Poll until a file exists and is not empty, for at most `limitMs`. */
export async function waitForFile(path: string, limitMs: number): Promise<boolean> {
  const deadline = Date.now() + limitMs;
  while (!(existsSync(path) && readFileSync(path, 'utf8').trim() !== '')) {
    if (Date.now() > deadline) {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return true;
}
