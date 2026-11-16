// story: e12s03b
// The backlog section a GSD conversion writes, from the text of
// .planning/ROADMAP.md and the names of the folders and files in
// .planning/phases/: each open phase as a backlog item that keeps its number,
// with its goal, its success criteria as done-when, its open plans and a link
// to its old phase folder in the gitignored .gsd-planning/. A PLAN.md with no
// SUMMARY.md beside it is open even when the roadmap does not list it (GSD's
// own rule); such a plan takes its title from the first line of its
// <objective>. Pure: no file is read here. The format is GSD v1.30's
// templates/roadmap.md and templates/phase-prompt.md. docs/CONVERT.md.

import { codeSpan, inlineText } from './markdown-text.ts';

export const gsdSectionTitle = '## Converted from GSD';

type Phase = { id: string; name: string; goal: string; criteria: string[]; plans: { done: boolean; text: string }[]; done: boolean; listed: boolean };

const listLine = /^- \[([ xX])\] \*\*Phase (\d+(?:\.\d+)*): (.+?)\*\*(?: - (.*))?$/;
const heading = /^#{2,4}\s+(?:\S+\s+)?Phase (\d+(?:\.\d+)*): (.+?)\s*$/;
const planLine = /^- \[([ xX])\] (\d+(?:\.\d+)*-\d+: .+)$/;
const progressLine = /^\|\s*(\d+(?:\.\d+)*)\. [^|]*\|.*\|\s*Complete\s*\|/;

const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** The phases of `roadmap`, in the order they first appear; a phase in a
 * collapsed `<details>` block (a shipped milestone) is done. */
function phases(roadmap: string): Phase[] {
  const found = new Map<string, Phase>();
  const get = (id: string, name: string): Phase => {
    const old = found.get(id);
    if (old !== undefined) return old;
    const phase: Phase = { id, name: oneLine(name), goal: '', criteria: [], plans: [], done: false, listed: true };
    found.set(id, phase);
    return phase;
  };
  let current: Phase | null = null;
  let inCriteria = false;
  let collapsed = false;
  const completed = new Set<string>();
  for (const raw of roadmap.split('\n')) {
    const text = raw.trimEnd();
    if (/^<details>/i.test(text.trim())) collapsed = true;
    if (/^<\/details>/i.test(text.trim())) {
      collapsed = false;
      current = null;
      continue;
    }
    const listed = listLine.exec(text);
    if (collapsed) {
      // A shipped phase: kept as done, so its folder is not a new phase.
      const id = listed?.[2] ?? heading.exec(text)?.[1];
      if (id !== undefined) get(id, '').done = true;
      continue;
    }
    const titled = heading.exec(text);
    const progress = progressLine.exec(text);
    if (listed !== null) {
      const phase = get(listed[2], listed[3]);
      if (listed[1] !== ' ') phase.done = true;
      if (phase.goal === '' && listed[4] !== undefined) phase.goal = oneLine(listed[4]);
      current = null;
    } else if (titled !== null) {
      current = get(titled[1], titled[2]);
      inCriteria = false;
    } else if (progress !== null) {
      completed.add(progress[1]);
    } else if (/^#{1,4}\s/.test(text)) {
      current = null;
    } else if (current !== null) {
      const goal = /^\*\*Goal\*\*:\s*(.*)$/.exec(text);
      const plan = planLine.exec(text);
      if (goal !== null) current.goal = oneLine(goal[1]);
      else if (/^\*\*Success Criteria\*\*/.test(text)) inCriteria = true;
      else if (/^\*\*/.test(text) || /^Plans:/.test(text)) inCriteria = false;
      else if (inCriteria && /^\s*\d+\.\s/.test(text)) current.criteria.push(oneLine(text.replace(/^\s*\d+\.\s/, '')));
      if (plan !== null) current.plans.push({ done: plan[1] !== ' ', text: oneLine(plan[2]) });
    }
  }
  for (const id of completed) {
    const phase = found.get(id);
    if (phase !== undefined) phase.done = true;
  }
  return [...found.values()];
}

/** The folder of phase `id` in `folders` (GSD pads the whole part to two
 * digits: `02-checkout`, `06.1-fix`), or null. */
function folderOf(id: string, folders: string[]): string | null {
  const [whole, ...rest] = id.split('.');
  const padded = [whole.padStart(2, '0'), ...rest].join('.');
  return folders.find((name) => name.startsWith(`${padded}-`)) ?? null;
}

const phaseFolder = /^(\d+(?:\.\d+)*)-(.+)$/;
const planFile = /^(\d+(?:\.\d+)*-\d+)-PLAN\.md$/;

const titleMax = 120;

/** The first non-empty line inside the `<objective>` (its tag at a line
 * start) of plan text `text`, on one line and at most 120 characters, or
 * null. */
function objectiveTitle(text: string): string | null {
  const body = /^<objective>([\s\S]*?)<\/objective>/m.exec(text)?.[1] ?? '';
  const first = [...oneLine(body.split('\n').find((line) => line.trim() !== '') ?? '')];
  if (first.length === 0) return null;
  return first.length > titleMax ? `${first.slice(0, titleMax - 1).join('')}…` : first.join('');
}

/** Adds to `found` each plan in `files` (`<folder>/<name>`) that has a
 * PLAN.md, no SUMMARY.md beside it and no line in its phase's roadmap
 * Plans list; a folder the roadmap does not list becomes a phase. */
function addUnlisted(found: Phase[], files: string[], plans: Record<string, string>): Phase[] {
  const present = new Set(files);
  const all = [...found];
  for (const path of files) {
    const [folder, name, ...deeper] = path.split('/');
    const plan = planFile.exec(name ?? '');
    const owner = phaseFolder.exec(folder);
    if (plan === null || owner === null || deeper.length > 0 || present.has(`${folder}/${plan[1]}-SUMMARY.md`)) continue;
    const id = owner[1].replace(/^0+(?=\d)/, '');
    let phase = all.find((each) => each.id === id);
    if (phase === undefined) {
      phase = { id, name: owner[2], goal: '', criteria: [], plans: [], done: false, listed: false };
      all.push(phase);
    }
    if (phase.plans.some((each) => each.text.startsWith(`${plan[1]}:`))) continue;
    const title = plans[path] === undefined ? null : objectiveTitle(plans[path]);
    phase.plans.push({ done: false, text: `${plan[1]}${title === null ? '' : `: ${title}`} (${name}, not on the roadmap)` });
  }
  return all;
}

const isOpen = (phase: Phase): boolean => !phase.done && !(phase.plans.length > 0 && phase.plans.every((plan) => plan.done));

/** The lines for one open phase. */
function phaseItem(phase: Phase, folders: string[]): string[] {
  const head = `- [ ] **Phase ${phase.id}: ${inlineText(phase.name)}.**`;
  const out = [phase.goal !== '' ? `${head} Goal: ${inlineText(phase.goal)}` : phase.listed ? head : `${head} Not on the roadmap.`];
  if (phase.criteria.length > 0) out.push(`  Done when: ${inlineText(phase.criteria.join('; '))}`);
  for (const plan of phase.plans.filter((plan) => !plan.done)) out.push(`  Open plan ${inlineText(plan.text)}`);
  const folder = folderOf(phase.id, folders);
  out.push(`  Old spec: ${codeSpan(`.gsd-planning/${folder === null ? 'ROADMAP.md' : `phases/${folder}/`}`)}`);
  return out;
}

/** The section, from the text of ROADMAP.md (null when there is none), the
 * folder names in .planning/phases/, the tag that holds the old plans, and
 * the files one level inside those folders, as `<folder>/<name>`, and the
 * text of the PLAN.md files among them, by the same key. */
export function gsdSection(roadmap: string | null, folders: string[], tag: string, files: string[] = [], plans: Record<string, string> = {}): string {
  const intro = [
    gsdSectionTitle,
    '',
    'The open phases of the old GSD roadmap and phase folders, by number. The',
    `old plans are in the gitignored \`.gsd-planning/\` and at the tag ${codeSpan(tag)}.`,
    '',
  ];
  const open = addUnlisted(phases(roadmap ?? ''), files, plans).filter(isOpen);
  const body = open.flatMap((phase) => phaseItem(phase, folders));
  if (body.length === 0) body.push('No open phases.');
  return [...intro, ...body, ''].join('\n');
}
