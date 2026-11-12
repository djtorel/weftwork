// story: e06s02
// A fingerprint of a git working tree: the files that git lists as tracked
// or as untracked and not ignored, with their contents. The gate takes it
// before and after a command, so a command that edits the tree is not done.
//
// Git is run with an argument array and never through a shell (threat
// model C5). A symbolic link is hashed as its target string and never
// followed (C6). A FIFO, a socket or a directory is never opened.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import type { Stats } from 'node:fs';
import { lstat, readlink } from 'node:fs/promises';
import { promisify } from 'node:util';

const run = promisify(execFile);

// A listing larger than this is an error, so the result is no-tree.
const maxListingBytes = 256 * 1024 * 1024;

export type FingerprintResult =
  | { ok: true; fingerprint: string }
  | { ok: false; error: string };

type Entry = { path: Buffer; kind: string; digest: string };

/** Run git in `cwd`. core.fsmonitor=false stops a repository's own config
 * from naming a program for git to run. */
async function gitOutput(cwd: string, args: string[]): Promise<Buffer> {
  const { stdout } = await run('git', ['-c', 'core.fsmonitor=false', ...args], {
    cwd,
    encoding: 'buffer',
    maxBuffer: maxListingBytes,
  });
  return stdout;
}

async function repositoryRoot(cwd: string): Promise<Buffer> {
  const output = await gitOutput(cwd, ['rev-parse', '--show-toplevel']);
  return output.subarray(0, output.length - 1);
}

/** Tracked files and untracked files that are not ignored, as bytes. */
async function listFiles(root: Buffer): Promise<Buffer[]> {
  const output = await gitOutput(root.toString(), [
    'ls-files', '-z', '--cached', '--others', '--exclude-standard',
  ]);
  const paths = new Map<string, Buffer>();
  for (const path of output.toString('latin1').split('\0')) {
    if (path !== '') {
      paths.set(path, Buffer.from(path, 'latin1'));
    }
  }
  return [...paths.values()];
}

async function hashFile(path: Buffer): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

function describeStats(stats: Stats, path: Buffer): Promise<{ kind: string; digest: string }> {
  if (stats.isSymbolicLink()) {
    return readlink(path, 'buffer').then((target) => ({
      kind: 'link',
      digest: createHash('sha256').update(target).digest('hex'),
    }));
  }
  if (stats.isFile()) {
    const kind = (stats.mode & 0o111) === 0 ? 'file' : 'file-x';
    return hashFile(path).then((digest) => ({ kind, digest }));
  }
  return Promise.resolve({ kind: 'other', digest: '-' });
}

async function describeEntry(root: Buffer, relative: Buffer): Promise<Entry> {
  const path = Buffer.concat([root, Buffer.from('/'), relative]);
  try {
    return { path: relative, ...(await describeStats(await lstat(path), path)) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { path: relative, kind: 'missing', digest: '-' };
    }
    throw error;
  }
}

/**
 * Fingerprint the whole working tree that holds `cwd`. Resolves ok with a
 * SHA-256 in hex, or not ok when `cwd` is not in a git working tree, git is
 * missing, or a listed file cannot be read. Never rejects.
 */
export async function fingerprintTree(cwd: string): Promise<FingerprintResult> {
  try {
    const root = await repositoryRoot(cwd);
    const files = await listFiles(root);
    const entries = await Promise.all(files.map((file) => describeEntry(root, file)));
    entries.sort((a, b) => Buffer.compare(a.path, b.path));
    const hash = createHash('sha256');
    for (const { path, kind, digest } of entries) {
      hash.update(path).update('\0').update(kind).update('\0').update(digest).update('\0');
    }
    return { ok: true, fingerprint: hash.digest('hex') };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
