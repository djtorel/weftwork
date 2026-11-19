// story: e11s05, e11s06
// UI changes checked from screenshots (docs/UI.md). The engine runs the
// owner's screenshot command with WEFTWORK_SHOTS set to a folder of its own,
// keeps the PNG files it wrote with their hashes and the tree they show, and
// tells the review whether a change touches ui.paths and which screenshots
// the reviewers read. A model's score is reported, never a gate. A UI change
// is reviewed as a design audit against the project's design reference, and
// each reviewer gets the images in WEFTWORK_IMAGES (e11s06).
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, join, matchesGlob, relative } from 'node:path';
import { terminalSafe } from '../shared/cli-io.ts';
import { messageOf, type Failure } from '../shared/errors.ts';
import { runCommand } from '../engine/process.ts';
import { readRegularFile, strictUtf8 } from '../shared/regular-file.ts';
import { fingerprintTree, gitOutput, repositoryRoot } from '../engine/tree.ts';
import type { UiSetting } from './ui-setting.ts';

export type Phase = 'before' | 'after';
export type Shot = { name: string; bytes: number; sha256: string };
/** What one phase kept: when, on which branch and tree, and the files. */
export type Shots = { phase: Phase; at: string; branch: string | null; base: string; fingerprint: string; files: Shot[] };

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
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

/** The PNG files in `dir`, each checked by its signature, sorted by name.
 * More than `maxShots` (ui.max_shots) is an error: the reviewers read every one. */
async function readPngs(dir: string, maxShots: number): Promise<{ ok: true; files: Shot[] } | Failure> {
  const names = (await readdir(dir)).filter((name) => name.toLowerCase().endsWith('.png')).sort();
  if (names.length === 0) return { ok: false, error: 'the screenshot command wrote no PNG file' };
  if (names.length > maxShots) return { ok: false, error: `the screenshot command wrote ${names.length} PNG files; at most ${maxShots} (ui.max_shots)` };
  const files: Shot[] = [];
  const comma = names.find((name) => name.includes(','));
  // WEFTWORK_IMAGES joins the paths with commas (e11s06).
  if (comma !== undefined) return { ok: false, error: `${terminalSafe(comma)} has a comma in its name` };
  for (const name of names) {
    const shot = await readShot(dir, name);
    if (!shot.ok) return shot;
    files.push(shot.shot);
  }
  return { ok: true, files };
}

/** One screenshot file, read without following a symlink, with its size and hash. */
async function readShot(dir: string, name: string): Promise<{ ok: true; shot: Shot } | Failure> {
  const stat = await lstat(join(dir, name));
  if (!stat.isFile() || stat.size > maxShotBytes) return { ok: false, error: `${terminalSafe(name)} is not a PNG file of at most ${maxShotBytes} bytes` };
  const handle = await open(join(dir, name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  const bytes = await handle.readFile().finally(() => handle.close());
  if (!bytes.subarray(0, 8).equals(pngSignature)) return { ok: false, error: `${terminalSafe(name)} is not a PNG file` };
  return { ok: true, shot: { name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') } };
}

/** The first screenshot of a manifest whose file is gone or no longer has
 * its size and hash, or null when every one matches. The review hashes them
 * again before it hands them to the reviewers (e11s05 review round 1). */
export async function changedShot(weftwork: string, shots: Shots): Promise<string | null> {
  for (const file of shots.files) {
    const name = typeof file?.name === 'string' ? file.name : '';
    if (name === '' || name !== basename(name)) return name;
    try {
      const read = await readShot(shotsDir(weftwork, shots.phase), name);
      if (!read.ok || read.shot.sha256 !== file.sha256 || read.shot.bytes !== file.bytes) return name;
    } catch {
      return name;
    }
  }
  return null;
}

export type TakeResult = { kind: 'taken'; shots: Shots } | { kind: 'refused' | 'failed'; why: string } | { kind: 'error'; error: string };

/**
 * Take one phase's screenshots: run ui.screenshot in `cwd` with WEFTWORK_SHOTS
 * set to an emptied folder, check what it wrote, and keep a manifest with the
 * tree it shows. Before screenshots are refused once the tree changes
 * ui.paths, since they would show the change. A ui.design file the review
 * could not use is an error before the command runs, so a bad path fails
 * here and not at review time (e11s06). Never rejects.
 */
export async function takeShots(request: { cwd: string; weftwork: string; ui: UiSetting; phase: Phase; base: string; branch: string | null }): Promise<TakeResult> {
  const { cwd, ui, phase } = request;
  if (ui.design !== undefined) {
    const design = await readDesign(cwd, ui.design);
    if (!design.ok) return { kind: 'error', error: design.error };
  }
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
    const pngs = await readPngs(dir, ui.maxShots);
    if (!pngs.ok) return { kind: 'failed', why: pngs.error };
    const shots: Shots = { phase, at: new Date().toISOString(), branch: request.branch, base: request.base, fingerprint: tree.fingerprint, files: pngs.files };
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
  | { kind: 'missing'; why: string; next?: string }
  | { kind: 'error'; error: string };

/**
 * What the review does about the UI: skip when UI checks are off or the
 * change does not touch ui.paths; otherwise it needs after screenshots of this
 * branch and this exact tree. Before screenshots are used when they are of
 * the same branch and base; without them the reviewers read the after ones alone.
 * Every screenshot used must still match its manifest's hash.
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
  // Before screenshots of another branch or base (after a rebase) are no baseline (review round 1).
  const same = before !== null && before.branch === request.branch && before.base === request.base;
  const mismatch = (shots: Shots, name: string) => `the ${shots.phase} screenshot ${terminalSafe(name)} does not match its hash in the manifest`;
  const afterChanged = await changedShot(request.weftwork, after);
  if (afterChanged !== null) return { kind: 'missing', why: mismatch(after, afterChanged) };
  if (same) {
    const beforeChanged = await changedShot(request.weftwork, before);
    if (beforeChanged !== null) {
      return { kind: 'missing', why: mismatch(before, beforeChanged), next: `take the before screenshots again on the base tree, or remove ${terminalSafe(shotsDir(request.weftwork, 'before'))} to review without them` };
    }
  }
  return { kind: 'ready', touched, before: same ? before : null, after };
}

/** The design reference ui.design names, read under the setting file rules:
 * a regular file, not a symlink, UTF-8, at most 64 KiB, and inside the
 * repository after its folders are resolved, since the brief goes to a
 * reviewer (review round 1). */
export async function readDesign(cwd: string, design: string): Promise<{ ok: true; design: Design } | Failure> {
  let path: string;
  let root: string;
  try {
    root = await realpath((await repositoryRoot(cwd)).toString());
    path = join(root, design);
  } catch (error) {
    return { ok: false, error: `ui.design: no repository root: ${messageOf(error)}` };
  }
  try {
    const folder = relative(root, await realpath(join(path, '..')));
    if (folder === '..' || folder.startsWith('../')) return { ok: false, error: `ui.design: ${path} is outside the repository` };
  } catch {
    return { ok: false, error: `ui.design: ${path} does not exist` };
  }
  const read = readRegularFile(path, { follow: false, maxBytes: maxDesignBytes });
  if (!read.ok) return { ok: false, error: `ui.design: ${read.error}` };
  if (read.file === null) return { ok: false, error: `ui.design: ${path} does not exist` };
  return { ok: true, design: { path: design, text: read.file.text } };
}

export type Design = { path: string; text: string };
const maxDesignBytes = 64 * 1024;

/** The screenshots as one value for WEFTWORK_IMAGES: absolute paths, before
 * then after, joined by commas (`codex exec --image` takes this form). A
 * path with a comma of its own is an error (review round 1). */
export function imagesValue(weftwork: string, ready: { before: Shots | null; after: Shots }): { ok: true; value: string } | Failure {
  const paths = (shots: Shots | null) => (shots === null ? [] : shots.files.map((file) => join(shotsDir(weftwork, shots.phase), file.name)));
  const all = [...paths(ready.before), ...paths(ready.after)];
  const comma = all.find((path) => path.includes(','));
  if (comma !== undefined) return { ok: false, error: `the screenshot path ${terminalSafe(comma)} has a comma, so WEFTWORK_IMAGES cannot hold it` };
  return { ok: true, value: all.join(',') };
}

const designAudit = [
  'Review it as a design audit as well as for defects. Design checklist:',
  '- consistency with the design reference and with the existing screens',
  '- hierarchy: what the eye reads first, second and last',
  '- spacing and alignment',
  '- typography',
  '- colour and contrast',
  '- states (hover, focus, disabled, error, empty, loading), where the screenshots show them',
  'A screenshot name may give its screen, viewport and state: <screen>.<viewport>.<state>.png.',
  'Severity: MUST-FIX only for an objective break: the change breaks the design reference, text fails WCAG 2 AA contrast, or the layout is broken at a viewport the screenshots show.',
  'A design MUST-FIX names its evidence: the rule of the design reference and the value that breaks it, the two colours and their ratio, or the screenshot and the element that is broken.',
  'A contrast or exact-colour finding seen only in a screenshot is SHOULD-FIX: a model cannot measure colour from pixels reliably, so name the programmatic check that would settle it.',
  'A design judgement call is SHOULD-FIX; it is listed in the pull request and does not block.',
];

/** The part of the brief that hands the reviewers the screenshots, the design
 * checklist and the design reference. */
export function uiPrompt(weftwork: string, ready: { touched: string[]; before: Shots | null; after: Shots }, design: Design | null = null): string {
  const reference =
    design === null
      ? ['Design reference: there is no design reference (ui.design is not set); judge consistency against the existing screens.']
      : [`Design reference (${design.path}), between the two marker lines:`, '----- design reference -----', design.text.replace(/\n*$/, ''), '----- end of design reference -----'];
  return [
    `This change touches the UI (${ready.touched.slice(0, 5).join(', ')}). Open each screenshot and compare before with after.`,
    ...(ready.before === null ? ['before: none were taken'] : shotLines(weftwork, ready.before)),
    ...shotLines(weftwork, ready.after),
    'A UI defect you see is a finding under the same rule: MUST-FIX when the intended case looks wrong or broken.',
    ...designAudit,
    'You may add one line UI-SCORE: <0 to 10> for the UI. It is reported, never a gate.',
    ...reference,
  ].join('\n');
}
