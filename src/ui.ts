// story: e11s05
// UI changes checked from screenshots (docs/UI.md). The engine runs the
// owner's screenshot command with WEFTWORK_SHOTS set to a folder of its own,
// keeps the PNG files it wrote with their hashes and the tree they show, and
// tells the review whether a change touches ui.paths and which screenshots
// the council reads. A model's score is reported, never a gate.
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, matchesGlob } from 'node:path';
import { terminalSafe } from './cli-io.ts';
import { messageOf, type Failure } from './errors.ts';
import { runCommand } from './process.ts';
import { strictUtf8 } from './regular-file.ts';
import { fingerprintTree, gitOutput } from './tree.ts';
import type { UiSetting } from './ui-setting.ts';

export type Phase = 'before' | 'after';
export type Shot = { name: string; bytes: number; sha256: string };
/** What one phase kept: when, on which branch and tree, and the files. */
export type Shots = { phase: Phase; at: string; branch: string | null; fingerprint: string; files: Shot[] };

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** More screenshots than this is an error: the council reads every one. */
const maxShots = 20;
const maxShotBytes = 20 * 1024 * 1024;

/** The folder for one phase's screenshots, in the engine's own folder. */
export function shotsDir(weftwork: string, phase: Phase): string {
  return join(weftwork, 'ui', phase);
}

/** The commit the change is measured from: `base` when given, else the merge
 * base of HEAD with origin/HEAD, origin/main or main, the first that exists. */
export async function baseCommit(cwd: string, base?: string): Promise<{ ok: true; sha: string } | Failure> {
  if (base !== undefined) {
    if (base.startsWith('-') || base.includes('\0')) return { ok: false, error: `the base is not a commit: ${base}` };
    try {
      return { ok: true, sha: (await gitOutput(cwd, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`])).toString().trim() };
    } catch {
      return { ok: false, error: `the base is not a commit: ${base}` };
    }
  }
  for (const ref of ['origin/HEAD', 'origin/main', 'main']) {
    try {
      return { ok: true, sha: (await gitOutput(cwd, ['merge-base', 'HEAD', ref])).toString().trim() };
    } catch {
      // Try the next ref.
    }
  }
  return { ok: false, error: 'no base: pass "base", or have origin/HEAD, origin/main or main' };
}

/** The files the working tree changes from `base`: changed, added or deleted
 * tracked files, and untracked files that are not ignored. */
export async function changedPaths(cwd: string, base: string): Promise<{ ok: true; paths: string[] } | Failure> {
  try {
    const diff = await gitOutput(cwd, ['diff', '--name-only', '-z', '--no-renames', base, '--']);
    const untracked = await gitOutput(cwd, ['ls-files', '-z', '--others', '--exclude-standard', '--full-name', ':(top)']);
    const text = strictUtf8(Buffer.concat([diff, untracked]));
    if (text === null) return { ok: false, error: 'a changed path is not UTF-8' };
    return { ok: true, paths: [...new Set(text.split('\0').filter((path) => path !== ''))] };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
}

/** The paths that match a ui.paths pattern. */
export function uiFiles(paths: string[], patterns: string[]): string[] {
  return paths.filter((path) => patterns.some((pattern) => matchesGlob(path, pattern)));
}

/** The PNG files in `dir`, each checked by its signature, sorted by name. */
async function readPngs(dir: string): Promise<{ ok: true; files: Shot[] } | Failure> {
  const names = (await readdir(dir)).filter((name) => name.toLowerCase().endsWith('.png')).sort();
  if (names.length === 0) return { ok: false, error: 'the screenshot command wrote no PNG file' };
  if (names.length > maxShots) return { ok: false, error: `the screenshot command wrote ${names.length} PNG files; at most ${maxShots}` };
  const files: Shot[] = [];
  for (const name of names) {
    const stat = await lstat(join(dir, name));
    if (!stat.isFile() || stat.size > maxShotBytes) return { ok: false, error: `${terminalSafe(name)} is not a PNG file of at most ${maxShotBytes} bytes` };
    const handle = await open(join(dir, name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const bytes = await handle.readFile().finally(() => handle.close());
    if (!bytes.subarray(0, 8).equals(pngSignature)) return { ok: false, error: `${terminalSafe(name)} is not a PNG file` };
    files.push({ name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  return { ok: true, files };
}

export type TakeResult = { kind: 'taken'; shots: Shots } | { kind: 'refused' | 'failed'; why: string } | { kind: 'error'; error: string };

/**
 * Take one phase's screenshots: run ui.screenshot in `cwd` with WEFTWORK_SHOTS
 * set to an emptied folder, check what it wrote, and keep a manifest with the
 * tree it shows. Before screenshots are refused once the tree changes
 * ui.paths, since they would show the change. Never rejects.
 */
export async function takeShots(request: { cwd: string; weftwork: string; ui: UiSetting; phase: Phase; base: string; branch: string | null }): Promise<TakeResult> {
  const { cwd, ui, phase } = request;
  if (phase === 'before') {
    const changed = await changedPaths(cwd, request.base);
    if (!changed.ok) return { kind: 'error', error: changed.error };
    const touched = uiFiles(changed.paths, ui.paths);
    if (touched.length > 0) return { kind: 'refused', why: `the tree already changes ui.paths: ${touched.slice(0, 5).join(', ')}` };
  }
  const tree = await fingerprintTree(cwd);
  if (!tree.ok) return { kind: 'error', error: `no git working tree: ${tree.error}` };
  const dir = shotsDir(request.weftwork, phase);
  try {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
  } catch (error) {
    return { kind: 'error', error: `the screenshot folder cannot be made: ${messageOf(error)}` };
  }
  const outcome = await runCommand(ui.screenshot, cwd, ui.timeoutSeconds * 1000, undefined, { ...process.env, WEFTWORK_SHOTS: dir });
  if (outcome.reason !== 'passed') {
    const how = outcome.reason === 'exit-nonzero' ? `exit ${outcome.exitCode}` : outcome.reason === 'timeout' ? `timed out after ${ui.timeoutSeconds} s` : outcome.reason;
    return { kind: 'failed', why: `the screenshot command failed: ${how}` };
  }
  const after = await fingerprintTree(cwd);
  if (!after.ok || after.fingerprint !== tree.fingerprint) return { kind: 'failed', why: 'the screenshot command changed the tree' };
  try {
    const pngs = await readPngs(dir);
    if (!pngs.ok) return { kind: 'failed', why: pngs.error };
    const shots: Shots = { phase, at: new Date().toISOString(), branch: request.branch, fingerprint: tree.fingerprint, files: pngs.files };
    await writeFile(join(dir, 'manifest.json'), `${JSON.stringify(shots)}\n`);
    return { kind: 'taken', shots };
  } catch (error) {
    return { kind: 'failed', why: `the screenshots cannot be read: ${messageOf(error)}` };
  }
}

/** One phase's manifest, or null when there is none or it cannot be read. */
export async function readShots(weftwork: string, phase: Phase): Promise<Shots | null> {
  try {
    const shots = JSON.parse(await readFile(join(shotsDir(weftwork, phase), 'manifest.json'), 'utf8')) as Shots;
    return shots.phase === phase && Array.isArray(shots.files) ? shots : null;
  } catch {
    return null;
  }
}

/** One line per screenshot: phase, absolute path, size and hash. */
export function shotLines(weftwork: string, shots: Shots): string[] {
  return shots.files.map((file) => `${shots.phase}: ${terminalSafe(join(shotsDir(weftwork, shots.phase), file.name))} ${file.bytes} bytes sha256:${file.sha256.slice(0, 12)}`);
}

export type UiForReview =
  | { kind: 'skip' }
  | { kind: 'ready'; touched: string[]; before: Shots | null; after: Shots }
  | { kind: 'missing'; why: string }
  | { kind: 'error'; error: string };

/**
 * What the review does about the UI: skip when UI checks are off or the
 * change does not touch ui.paths; otherwise it needs after screenshots of this
 * branch and this exact tree. Before screenshots are used when they are of
 * the same branch; without them the council reads the after ones alone.
 */
export async function uiForReview(request: { cwd: string; weftwork: string; ui: UiSetting | null; base: string; branch: string | null; fingerprint: string }): Promise<UiForReview> {
  if (request.ui === null) return { kind: 'skip' };
  const changed = await changedPaths(request.cwd, request.base);
  if (!changed.ok) return { kind: 'error', error: changed.error };
  const touched = uiFiles(changed.paths, request.ui.paths);
  if (touched.length === 0) return { kind: 'skip' };
  const after = await readShots(request.weftwork, 'after');
  if (after === null || after.branch !== request.branch || after.fingerprint !== request.fingerprint) {
    return { kind: 'missing', why: `the change touches ui.paths (${touched.slice(0, 5).join(', ')}) and there are no after screenshots of this tree` };
  }
  const before = await readShots(request.weftwork, 'before');
  return { kind: 'ready', touched, before: before !== null && before.branch === request.branch ? before : null, after };
}

/** The part of the brief that hands the council the screenshots. */
export function uiPrompt(weftwork: string, ready: { touched: string[]; before: Shots | null; after: Shots }): string {
  return [
    `This change touches the UI (${ready.touched.slice(0, 5).join(', ')}). Open each screenshot and compare before with after.`,
    ...(ready.before === null ? ['before: none were taken'] : shotLines(weftwork, ready.before)),
    ...shotLines(weftwork, ready.after),
    'A UI defect you see is a finding under the same rule: MUST-FIX when the intended case looks wrong or broken.',
    'You may add one line UI-SCORE: <0 to 10> for the UI. It is reported, never a gate.',
  ].join('\n');
}
