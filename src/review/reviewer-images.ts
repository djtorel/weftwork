// Copies of a round's images for the reviewers, in a private folder outside
// the git dir. The engine keeps screenshots and design images under the git
// dir, and Claude Code (2.1.329) refuses to read a file under `.git` in
// dontAsk mode, even in an added folder with an allow rule, so the Claude
// reviewer saw no image (docs/UI.md). The copies go before the round and are
// removed after it.
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { messageOf, type Failure } from '../shared/errors.ts';

/** Copy each of `paths`, which are under `base`, into a new private folder,
 * at the same place under it; the folder and the copies' paths in order. */
export async function copyImages(base: string, paths: readonly string[]): Promise<{ ok: true; dir: string; paths: string[] } | Failure> {
  let dir: string | null = null;
  try {
    dir = await mkdtemp(join(tmpdir(), 'weftwork-images-'));
    const copies: string[] = [];
    for (const path of paths) {
      const rel = relative(base, path);
      if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`${path} is not under ${base}`);
      const copy = join(dir, rel);
      await mkdir(dirname(copy), { recursive: true });
      await copyFile(path, copy);
      copies.push(copy);
    }
    return { ok: true, dir, paths: copies };
  } catch (error) {
    if (dir !== null) await removeImages(dir);
    return { ok: false, error: `the images could not be copied for the reviewers: ${messageOf(error)}` };
  }
}

/** Remove the copies; never rejects. */
export async function removeImages(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
}
