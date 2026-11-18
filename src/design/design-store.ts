// story: e16s02
// Where the design loop keeps its record (docs/DESIGN-LOOP.md):
// `<common git dir>/weftwork/design/`, next to the clone's backlog. It is
// untracked, every worktree of the clone writes to the same folder, and it
// stays when a worktree is removed, so the owner can read every round and the
// lessons reach later tasks without a commit.
import { constants, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, closeSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { messageOf, type Failure } from '../shared/errors.ts';
import { readRegularFile, strictUtf8, writeAtomic } from '../shared/regular-file.ts';
import { commonDir } from '../guard/guard-worktree.ts';
import { indexMarkdown, loopMarkdown, type LoopRecord } from './design-record.ts';
import { pngSize } from './png-mark.ts';

export type InputImage = { name: string; bytes: Buffer; width: number; height: number };

const maxImages = 20;
const maxImageBytes = 20 * 1024 * 1024;
const maxLoopBytes = 1024 * 1024;
/** The lessons the prompt carries: the end of the file, newest last. */
const maxLessonBytes = 32 * 1024;
const maxLessonLength = 1000;

/** `<common git dir>/weftwork/design` for the clone that holds `cwd`. */
export async function designRoot(cwd: string): Promise<string | null> {
  const common = await commonDir(cwd);
  return common === null ? null : join(common, 'weftwork', 'design');
}

/** A branch or loop name as one safe folder name. */
export function slug(name: string): string {
  const safe = name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|-+$/g, '').slice(0, 80);
  return safe === '' ? 'unnamed' : safe;
}

export function loopDir(root: string, branch: string, loop: string): string {
  return join(root, slug(branch), slug(loop));
}

export function roundDir(dir: string, round: number): string {
  return join(dir, `round-${String(round).padStart(2, '0')}`);
}

/** The loop's record, or a new one when it has no rounds yet. */
export function readLoop(dir: string, branch: string, loop: string): { ok: true; record: LoopRecord } | Failure {
  const read = readRegularFile(join(dir, 'loop.json'), { follow: false, maxBytes: maxLoopBytes });
  if (!read.ok) return read;
  if (read.file === null) return { ok: true, record: { branch, loop, rounds: [] } };
  try {
    const record = JSON.parse(read.file.text) as LoopRecord;
    if (!Array.isArray(record.rounds)) return { ok: false, error: `${join(dir, 'loop.json')} has no rounds list` };
    return { ok: true, record };
  } catch (error) {
    return { ok: false, error: `${join(dir, 'loop.json')} is not JSON: ${messageOf(error)}` };
  }
}

/** The images of a round, read from `paths` (from `cwd`): 1 to 20 regular
 * PNG files, not symlinks, of at most 20 MiB, with distinct file names. */
export function readImages(cwd: string, paths: unknown): { ok: true; images: InputImage[] } | Failure {
  if (!Array.isArray(paths) || paths.length < 1 || paths.length > maxImages || !paths.every((path) => typeof path === 'string' && path !== '' && !path.includes('\0'))) {
    return { ok: false, error: `"images" must be a list of 1 to ${maxImages} PNG file paths` };
  }
  const images: InputImage[] = [];
  for (const path of paths as string[]) {
    const full = resolve(cwd, path);
    const name = basename(full);
    // WEFTWORK_IMAGES joins the paths with commas (docs/UI.md).
    if (name.includes(',')) return { ok: false, error: `${name} has a comma in its name` };
    if (images.some((image) => image.name === name)) return { ok: false, error: `two images are named ${name}` };
    let bytes: Buffer;
    try {
      const stat = lstatSync(full);
      if (!stat.isFile() || stat.size > maxImageBytes) return { ok: false, error: `${full} is not a regular file of at most ${maxImageBytes} bytes` };
      const fd = openSync(full, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        bytes = readFileSync(fd);
      } finally {
        closeSync(fd);
      }
    } catch (error) {
      return { ok: false, error: `${full} cannot be read: ${messageOf(error)}` };
    }
    const size = pngSize(bytes);
    if (size === null) return { ok: false, error: `${full} is not a PNG file` };
    images.push({ name, bytes, ...size });
  }
  return { ok: true, images };
}

/** A fresh folder for round `round` holding a copy of each image, so the
 * record keeps what was reviewed even when the canvas or the app changes. */
export function startRound(dir: string, round: number, images: InputImage[]): { ok: true; folder: string; paths: string[] } | Failure {
  const folder = roundDir(dir, round);
  try {
    rmSync(folder, { recursive: true, force: true });
    mkdirSync(folder, { recursive: true });
    const paths = images.map((image) => {
      const path = join(folder, image.name);
      writeFileSync(path, image.bytes, { flag: 'wx' });
      return path;
    });
    return { ok: true, folder, paths };
  } catch (error) {
    return { ok: false, error: `the round folder cannot be made: ${messageOf(error)}` };
  }
}

/** Write one file of a round; null when written. */
export function writeRoundFile(folder: string, name: string, data: string | Buffer): Failure | null {
  try {
    writeFileSync(join(folder, name), data);
    return null;
  } catch (error) {
    return { ok: false, error: `${join(folder, name)} cannot be written: ${messageOf(error)}` };
  }
}

/** Save the loop's record and its page, and rewrite the clone's index. */
export function saveLoop(root: string, dir: string, record: LoopRecord, pass: number): Failure | null {
  const json = writeAtomic(join(dir, 'loop.json'), `${JSON.stringify(record, null, 2)}\n`, undefined);
  if (json !== null) return json;
  const page = writeAtomic(join(dir, 'loop.md'), loopMarkdown(record, pass), undefined);
  if (page !== null) return page;
  const loops: { path: string; record: LoopRecord }[] = [];
  for (const branch of safeList(root)) {
    for (const loop of safeList(join(root, branch))) {
      const read = readLoop(join(root, branch, loop), branch, loop);
      if (read.ok && read.record.rounds.length > 0) loops.push({ path: `${branch}/${loop}`, record: read.record });
    }
  }
  return writeAtomic(join(root, 'README.md'), indexMarkdown(loops), undefined);
}

function safeList(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('round-'))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

/** The end of the clone's lessons file, or null when it has none. */
export function readLessons(root: string): { ok: true; lessons: string | null } | Failure {
  const path = join(root, 'LESSONS.md');
  let bytes: Buffer;
  try {
    const stat = lstatSync(path);
    if (!stat.isFile()) return { ok: false, error: `${path} is not a regular file` };
    bytes = readFileSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ok: true, lessons: null };
    return { ok: false, error: `${path} cannot be read: ${messageOf(error)}` };
  }
  const text = strictUtf8(bytes.subarray(Math.max(0, bytes.length - maxLessonBytes)), false);
  if (text === null) return { ok: false, error: `${path} is not valid UTF-8` };
  const lessons = text.split('\n').filter((line) => line.startsWith('- ')).join('\n');
  return { ok: true, lessons: lessons === '' ? null : lessons };
}

/** Add one lesson to the clone's lessons file, with where it came from. */
export function addLesson(root: string, lesson: string, from: string, at: Date): { ok: true; path: string } | Failure {
  const line = lesson.replace(/\s+/g, ' ').trim();
  if (line === '' || line.length > maxLessonLength) return { ok: false, error: `"lesson" must be one line of 1 to ${maxLessonLength} characters` };
  const path = join(root, 'LESSONS.md');
  const read = readRegularFile(path, { follow: false, maxBytes: 4 * 1024 * 1024 });
  if (!read.ok) return read;
  const head = read.file?.text ?? '# Design lessons\n\nKept by `weftwork design` from design rounds. Every later design round reads the newest ones; move a lasting rule into the project\'s design reference (`ui.design`) in a pull request.\n\n';
  const source = from.replace(/\s+/g, ' ').trim().slice(0, 200);
  const note = `${source === '' ? '' : `from ${source}, `}${at.toISOString().slice(0, 10)}`;
  const written = writeAtomic(path, `${head.replace(/\n*$/, '\n')}- ${line} (${note})\n`, read.file?.mode);
  return written === null ? { ok: true, path } : written;
}
