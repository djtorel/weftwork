// story: e16s02
// Thin shell for the design loop (docs/DESIGN-LOOP.md). JSON on stdin:
//   {"images": ["<png>", ...], "brief": "...", "loop": "app"}  one round
//   {"lesson": "...", "from": "..."}                           keep a lesson
//   {"status": true, "loop": "app"}                            the loop so far
// A round's report goes to stdout; its record to the clone's design folder.
// Logic lives in src/design/.
//
// Exit 0 pass (or a lesson kept, or the status), 1 changes (revise, then run
// the next round), 3 no verdict (every reviewer failed, or the tree changed),
// 5 stopped (the ceiling, or the grades stopped rising; no more rounds), 2
// when it cannot run, with the reason on stderr.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readJsonObject, terminalSafe } from './shared/cli-io.ts';
import { currentBranch, fingerprintTree } from './engine/tree.ts';
import { readDesign } from './review/ui.ts';
import { loadUi } from './review/ui-setting.ts';
import { designPrompt, loopStop, runDesignReviewers } from './design/design.ts';
import { finishRound, gradeText, verdictMeans } from './design/design-round.ts';
import { loadDesign } from './design/design-setting.ts';
import { addLesson, designRoot, loopDir, readImages, readLessons, readLoop, roundDir, startRound } from './design/design-store.ts';

const maxBrief = 20000;

function fail(error: string): void {
  process.stderr.write(`design: ${terminalSafe(error)}\n`);
  process.exitCode = 2;
}

function answer(lines: string[], exitCode: number): void {
  process.stdout.write(`${lines.map(terminalSafe).join('\n')}\n`);
  process.exitCode = exitCode;
}

async function main(): Promise<void> {
  const read = await readJsonObject();
  if (read.kind === 'refused') return fail(read.error);
  const input = read.input;
  const loop = input['loop'] ?? 'app';
  if (typeof loop !== 'string' || loop.trim() === '' || loop.length > 60) return fail('"loop" must be a name of 1 to 60 characters');
  const cwd = process.cwd();
  const root = await designRoot(cwd);
  if (root === null) return fail('no git working tree for the design record');

  if (input['lesson'] !== undefined) {
    const from = input['from'] ?? '';
    if (typeof input['lesson'] !== 'string' || typeof from !== 'string') return fail('"lesson" and "from" must be strings');
    const kept = addLesson(root, input['lesson'], from, new Date());
    if (!kept.ok) return fail(kept.error);
    return answer(['weftwork design: lesson kept', `lessons: ${kept.path}`], 0);
  }

  const branch = await currentBranch(cwd);
  if (!branch.ok) return fail(`the branch cannot be read: ${branch.error}`);
  if (branch.branch === null) return fail('HEAD is detached; design rounds are counted per branch, so check out a branch first');
  const dir = loopDir(root, branch.branch, loop);
  const loaded = readLoop(dir, branch.branch, loop);
  if (!loaded.ok) return fail(loaded.error);
  const record = loaded.record;
  const last = record.rounds.at(-1);

  if (input['status'] === true) {
    if (last === undefined) return answer([`weftwork design: no rounds on ${branch.branch}/${loop}`, `folder: ${root}`], 0);
    const count = `${record.rounds.length} ${record.rounds.length === 1 ? 'round' : 'rounds'}`;
    return answer([`weftwork design: ${count} on ${branch.branch}/${loop}, last: ${last.outcome}, mean ${last.mean}`, `grades: ${gradeText(last.grades)}`, ...(last.stop === null ? [] : [`stop: ${last.stop}`]), `record: ${dir}/loop.md`], 0);
  }

  const brief = input['brief'];
  if (typeof brief !== 'string' || brief.trim() === '' || brief.length > maxBrief) return fail(`"brief" must be a non-empty string of at most ${maxBrief} characters`);
  const setting = await loadDesign(cwd, process.env);
  if (!setting.ok) return fail(setting.error);
  const images = readImages(cwd, input['images'], setting.design.maxImages);
  if (!images.ok) return fail(images.error);
  const stopped = loopStop(verdictMeans(record.rounds), setting.design.maxRounds, setting.design.stallAfter, record.rounds.length);
  if (stopped !== null) {
    return answer(['weftwork design: stopped', `why: ${stopped}`, ...(last === undefined ? [] : [`last round: ${last.outcome}, ${gradeText(last.grades)}`]), `record: ${dir}/loop.md`], 5);
  }
  const ui = await loadUi(cwd, process.env);
  if (!ui.ok) return fail(ui.error);
  let design: string | null = null;
  if (ui.ui?.design !== undefined) {
    const reference = await readDesign(cwd, ui.ui.design);
    if (!reference.ok) return fail(reference.error);
    design = reference.design.text;
  }
  const lessons = readLessons(root);
  if (!lessons.ok) return fail(lessons.error);
  const tree = await fingerprintTree(cwd);
  if (!tree.ok) return fail(`no git working tree: ${tree.error}`);

  const round = record.rounds.length + 1;
  const started = startRound(dir, round, images.images);
  if (!started.ok) return fail(started.error);
  const previousImages = last === undefined ? [] : last.images.map((name) => join(roundDir(dir, last.round), name)).filter((path) => existsSync(path));
  const previous = last === undefined ? null : { round: last.round, grades: last.grades, marks: last.markTexts, images: previousImages };
  const prompt = designPrompt({ brief, images: images.images, pass: setting.design.pass, round, design, lessons: lessons.lessons, previous });
  // Only this round's images go to the reviewers; values from the caller are dropped.
  const { WEFTWORK_IMAGES: _images, WEFTWORK_IMAGES_DIR: _dir, ...env } = process.env;
  const names = images.images.map((image) => image.name);
  const results = await runDesignReviewers(setting.design, cwd, prompt, names, { ...env, WEFTWORK_IMAGES: [...started.paths, ...previousImages].join(','), WEFTWORK_IMAGES_DIR: dir });
  const after = await fingerprintTree(cwd);
  const changed = !after.ok || after.fingerprint !== tree.fingerprint;
  const finished = finishRound({
    root,
    dir,
    folder: started.folder,
    record,
    round,
    brief,
    images: images.images,
    setting: setting.design,
    results,
    void: changed ? 'the tree changed during the review; a reviewer must be read-only' : null,
  });
  if (!finished.ok) return fail(finished.error);
  answer(finished.lines, finished.exit);
}

await main();
