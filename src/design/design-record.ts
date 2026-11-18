// story: e16s02
// The design loop's record for the owner (docs/DESIGN-LOOP.md): one Markdown
// page per round, one per loop with the grades round by round, and an index
// of every loop in the clone. Text from a reviewer is data: it goes in as
// escaped Markdown, so it cannot add a link, an image or HTML.
import { inlineText } from '../shared/markdown-text.ts';
import { criteria, type Compare, type Grades, type Mark, type RoundOutcome } from './design.ts';

/** A mark with its number in the round and the reviewer that made it. */
export type NumberedMark = Mark & { n: number; reviewer: string };

/** What the loop file keeps of each round. */
export type RoundSummary = {
  round: number;
  at: string;
  outcome: RoundOutcome;
  grades: Grades;
  mean: number;
  marks: number;
  mustFix: number;
  compare: Compare[];
  stop: string | null;
  images: string[];
  /** The marks as one line each, for the next round's prompt. */
  markTexts: string[];
};

export type LoopRecord = { branch: string; loop: string; rounds: RoundSummary[] };

function text(value: string): string {
  return inlineText(value).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
}

/** A link target for a file name, so a space or bracket cannot break it. */
function target(name: string): string {
  return `<${encodeURI(name).replace(/[<>]/g, encodeURIComponent)}>`;
}

const outcomeText: Record<RoundOutcome, string> = { pass: 'pass', changes: 'changes needed', 'no-verdict': 'no verdict' };

/** The page of one round. */
export function roundMarkdown(input: {
  record: LoopRecord;
  summary: RoundSummary;
  brief: string;
  pass: number;
  maxRounds: number;
  reviewers: { name: string; ok: boolean; error?: string; grades?: Grades; reply?: string }[];
  marks: NumberedMark[];
  marked: Record<string, string | null>;
}): string {
  const { record, summary } = input;
  const lines = [
    `# Design round ${summary.round}: ${text(record.loop)} on ${text(record.branch)}`,
    '',
    `- Outcome: **${outcomeText[summary.outcome]}**${summary.stop === null ? '' : `; the loop stops: ${text(summary.stop)}`}`,
    `- When: ${summary.at}`,
    `- Pass mark: ${input.pass} of 5 on every criterion; round ${summary.round} of at most ${input.maxRounds}`,
    `- Mean of the lowest grades: ${summary.mean}`,
    `- Loop: [all rounds](<../loop.md>)`,
    '',
    '## Brief',
    '',
    ...input.brief.trim().split('\n').map((line) => `> ${text(line)}`),
    '',
    '## Grades',
    '',
    `| Criterion | ${input.reviewers.map((reviewer, index) => `${index + 1}. ${text(reviewer.name)}`).join(' | ')} | Lowest |`,
    `| --- | ${input.reviewers.map(() => '---').join(' | ')} | --- |`,
  ];
  for (const { key } of criteria) {
    const lowest = summary.grades[key];
    const flag = typeof lowest === 'number' && lowest < input.pass ? ' (below)' : '';
    lines.push(`| ${key} | ${input.reviewers.map((reviewer) => (reviewer.ok ? (reviewer.grades?.[key] ?? 'n/a') : 'failed')).join(' | ')} | ${lowest ?? 'n/a'}${flag} |`);
  }
  for (const [index, reviewer] of input.reviewers.entries()) {
    if (!reviewer.ok) lines.push('', `Reviewer ${index + 1} failed: ${text(reviewer.error ?? '')}`);
  }
  if (summary.compare.length > 0) lines.push('', `Compared with round ${summary.round - 1}: ${summary.compare.join(', ')}`);
  lines.push('', '## Marks', '');
  if (input.marks.length === 0) lines.push('None.');
  const images = [...new Set([...summary.images, ...input.marks.map((mark) => mark.image)])];
  for (const image of images) {
    const marks = input.marks.filter((mark) => mark.image === image);
    if (marks.length === 0 && !summary.images.includes(image)) continue;
    lines.push(`### ${text(image)}`, '');
    const marked = input.marked[image];
    if (summary.images.includes(image)) lines.push(marked === null || marked === undefined ? `![${text(image)}](${target(image)})` : `![${text(image)}, marked](${target(marked)})`, '');
    for (const mark of marks) {
      const where = mark.box === null ? 'no box' : `box ${mark.box.x},${mark.box.y},${mark.box.w},${mark.box.h}`;
      // The number as text, not a Markdown list, so it stays the box's number (review round 1).
      lines.push(`- **${mark.n}.** ${mark.kind === 'must-fix' ? '**MUST-FIX** ' : ''}**${text(mark.criterion)}** (${text(mark.reviewer)}, ${where}): ${text(mark.text)}`);
    }
    lines.push('');
  }
  lines.push('## Replies', '', ...input.reviewers.map((reviewer, index) => `- Reviewer ${index + 1}, ${text(reviewer.name)}: ${reviewer.ok ? `[reply](<reply-${index + 1}.txt>)` : 'failed'}`), '');
  return `${lines.join('\n')}\n`;
}

/** The page of one loop: every round's lowest grades, oldest first. */
export function loopMarkdown(record: LoopRecord, pass: number): string {
  const lines = [
    `# Design loop: ${text(record.loop)} on ${text(record.branch)}`,
    '',
    `Pass mark: ${pass} of 5 on every criterion.`,
    '',
    `| Round | Outcome | ${criteria.map((c) => c.key).join(' | ')} | Mean | Marks |`,
    `| --- | --- | ${criteria.map(() => '---').join(' | ')} | --- | --- |`,
  ];
  for (const summary of record.rounds) {
    const name = `round-${String(summary.round).padStart(2, '0')}`;
    lines.push(`| [${summary.round}](<${name}/round.md>) | ${outcomeText[summary.outcome]} | ${criteria.map((c) => summary.grades[c.key] ?? 'n/a').join(' | ')} | ${summary.mean} | ${summary.marks} |`);
  }
  const stop = record.rounds.at(-1)?.stop;
  if (stop !== null && stop !== undefined) lines.push('', `The loop stopped: ${text(stop)}.`);
  return `${lines.join('\n')}\n`;
}

/** The index of every loop in the clone, newest first. */
export function indexMarkdown(loops: { path: string; record: LoopRecord }[]): string {
  const rows = loops
    .map(({ path, record }) => ({ path, record, last: record.rounds.at(-1) }))
    .sort((a, b) => (b.last?.at ?? '').localeCompare(a.last?.at ?? ''));
  const lines = [
    '# Design reviews',
    '',
    'Kept by `weftwork design`, untracked: every worktree of this clone writes here, and it stays when a worktree is removed. `LESSONS.md` holds the lessons kept for later rounds.',
    '',
    '| Branch | Loop | Rounds | Last outcome | Mean | When |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(({ path, record, last }) => `| ${text(record.branch)} | [${text(record.loop)}](<${path}/loop.md>) | ${record.rounds.length} | ${last === undefined ? 'none' : outcomeText[last.outcome]} | ${last?.mean ?? ''} | ${last?.at ?? ''} |`),
  ];
  return `${lines.join('\n')}\n`;
}
