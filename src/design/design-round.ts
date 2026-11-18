// story: e16s02
// After the reviewers answered: number the marks, draw them on the images,
// write the round's files and the loop's record, and the report for the
// agent (docs/DESIGN-LOOP.md).
import type { Failure } from '../shared/errors.ts';
import { criteria, lowestGrades, loopStop, meanGrade, roundOutcome, type DesignResult, type Grades, type RoundOutcome } from './design.ts';
import { roundMarkdown, type LoopRecord, type NumberedMark, type RoundSummary } from './design-record.ts';
import type { DesignSetting } from './design-setting.ts';
import { saveLoop, writeRoundFile, type InputImage } from './design-store.ts';
import { markPng } from './png-mark.ts';

const exitCodes: Record<RoundOutcome, number> = { pass: 0, changes: 1, 'no-verdict': 3 };

export function gradeText(grades: Grades): string {
  return criteria.map((c) => `${c.key} ${grades[c.key] ?? 'n/a'}`).join(', ');
}

/** The mean grades of the rounds that had a verdict, for the stall rule. */
export function verdictMeans(rounds: RoundSummary[]): number[] {
  return rounds.filter((round) => round.outcome !== 'no-verdict').map((round) => round.mean);
}

export type FinishInput = {
  root: string;
  dir: string;
  folder: string;
  record: LoopRecord;
  round: number;
  brief: string;
  images: InputImage[];
  setting: DesignSetting;
  results: DesignResult[];
  /** Why the round has no verdict whatever the reviewers said, or null. */
  void: string | null;
};

/** Keep the round and say what it found; `exit` is the CLI's exit code. */
export function finishRound(input: FinishInput): { ok: true; lines: string[]; exit: number } | Failure {
  const { folder, results, setting, round } = input;
  const outcome: RoundOutcome = input.void !== null ? 'no-verdict' : roundOutcome(results, setting.pass);
  const grades = lowestGrades(results);
  let n = 0;
  const marks: NumberedMark[] = results.flatMap((result) => (result.ok ? result.marks.map((mark) => ({ ...mark, n: ++n, reviewer: result.name })) : []));
  const marked: Record<string, string | null> = {};
  for (const image of input.images) {
    const boxes = marks.flatMap((mark) => (mark.image === image.name && mark.box !== null ? [{ ...mark.box, n: mark.n }] : []));
    const png = boxes.length === 0 ? null : markPng(image.bytes, boxes);
    const name = `${image.name.replace(/\.png$/i, '')}.marked.png`;
    marked[image.name] = png === null ? null : name;
    const wrote = png === null ? null : writeRoundFile(folder, name, png);
    if (wrote !== null) return wrote;
  }
  for (const [index, result] of results.entries()) {
    const wrote = result.ok ? writeRoundFile(folder, `reply-${index + 1}.txt`, result.reply) : null;
    if (wrote !== null) return wrote;
  }
  const summary: RoundSummary = {
    round,
    at: new Date().toISOString(),
    outcome,
    grades,
    mean: meanGrade(grades),
    marks: marks.length,
    mustFix: marks.filter((mark) => mark.kind === 'must-fix').length,
    compare: results.flatMap((result) => (result.ok && result.compare !== undefined ? [result.compare] : [])),
    stop: null,
    images: input.images.map((image) => image.name),
    markTexts: marks.slice(0, 50).map((mark) => `m${mark.n} ${mark.image} ${mark.criterion}: ${mark.text}`.slice(0, 400)),
  };
  const rounds = [...input.record.rounds, summary];
  summary.stop = outcome === 'pass' ? null : loopStop(verdictMeans(rounds), setting.maxRounds, setting.stallAfter, rounds.length);
  const reviewers = results.map((result) => (result.ok ? { name: result.name, ok: true, grades: result.grades } : { name: result.name, ok: false, error: result.error }));
  const page = roundMarkdown({ record: input.record, summary, brief: input.brief, pass: setting.pass, maxRounds: setting.maxRounds, reviewers, marks, marked });
  const wrote = writeRoundFile(folder, 'round.md', page);
  if (wrote !== null) return wrote;
  const saved = saveLoop(input.root, input.dir, { ...input.record, rounds }, setting.pass);
  if (saved !== null) return saved;
  return { ok: true, ...report({ summary, setting, results, marks, marked, folder, loop: input.record.loop, why: input.void }) };
}

function report(input: { summary: RoundSummary; setting: DesignSetting; results: DesignResult[]; marks: NumberedMark[]; marked: Record<string, string | null>; folder: string; loop: string; why: string | null }) {
  const { summary, setting } = input;
  const lines = [`weftwork design: ${summary.outcome}`, `round: ${summary.round} of ${setting.maxRounds}`, `loop: ${input.loop}`];
  if (input.why !== null) lines.push(`why: ${input.why}`);
  lines.push(`grades (lowest of each): ${gradeText(summary.grades)}; mean ${summary.mean}; pass mark ${setting.pass}`);
  const below = criteria.flatMap((c) => {
    const grade = summary.grades[c.key];
    return typeof grade === 'number' && grade < setting.pass ? [`${c.key} ${grade}`] : [];
  });
  if (below.length > 0) lines.push(`below the pass mark: ${below.join(', ')}`);
  input.results.forEach((result, index) => {
    const label = `reviewer ${index + 1}, ${result.name}`;
    lines.push(result.ok ? `${label}: ${result.marks.length} marks${result.compare === undefined ? '' : `, ${result.compare} than round ${summary.round - 1}`}` : `${label}: failed, ${result.error}`);
  });
  for (const mark of input.marks) {
    const where = mark.box === null ? '' : ` [${mark.box.x},${mark.box.y},${mark.box.w},${mark.box.h}]`;
    lines.push(`${mark.kind} ${mark.n} (${mark.reviewer}) ${mark.image}${where} ${mark.criterion}: ${mark.text}`);
  }
  for (const [image, name] of Object.entries(input.marked)) if (name !== null) lines.push(`marked: ${input.folder}/${name} (${image})`);
  lines.push(`record: ${input.folder}/round.md`);
  if (summary.stop !== null) {
    lines.push(`stop: ${summary.stop}`);
    return { lines, exit: 5 };
  }
  if (summary.outcome === 'changes') lines.push('next: change the design for each mark, take new images, and run the next round');
  return { lines, exit: exitCodes[summary.outcome] };
}
