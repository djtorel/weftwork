// story: e12s03b
// The backlog section a GSD conversion writes, from the text of
// .planning/ROADMAP.md and the names of the folders in .planning/phases/:
// each open phase as a backlog item that keeps its number, with its goal,
// its success criteria as done-when, its open plans and a link to its old
// phase folder in the gitignored .gsd-planning/. Pure: no file is read here.
// The format is GSD v1.30's templates/roadmap.md. docs/CONVERT.md.

export const gsdSectionTitle = '## Converted from GSD';

type Phase = { id: string; name: string; goal: string; criteria: string[]; plans: { done: boolean; text: string }[]; done: boolean };

const listLine = /^- \[([ xX])\] \*\*Phase (\d+(?:\.\d+)*): (.+?)\*\*(?: - (.*))?$/;
const heading = /^#{2,4}\s+(?:\S+\s+)?Phase (\d+(?:\.\d+)*): (.+?)\s*$/;
const planLine = /^- \[([ xX])\] (\d+(?:\.\d+)*-\d+: .+)$/;
const progressLine = /^\|\s*(\d+(?:\.\d+)*)\. [^|]*\|.*\|\s*Complete\s*\|/;

const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** The phases of `roadmap`, in the order they first appear, outside any
 * collapsed `<details>` block (a shipped milestone). */
function phases(roadmap: string): Phase[] {
  const found = new Map<string, Phase>();
  const get = (id: string, name: string): Phase => {
    const old = found.get(id);
    if (old !== undefined) return old;
    const phase: Phase = { id, name: oneLine(name), goal: '', criteria: [], plans: [], done: false };
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
    if (collapsed) continue;
    const listed = listLine.exec(text);
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
      else if (inCriteria && /^\s+\d+\.\s/.test(text)) current.criteria.push(oneLine(text.replace(/^\s+\d+\.\s/, '')));
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

const isOpen = (phase: Phase): boolean => !phase.done && !(phase.plans.length > 0 && phase.plans.every((plan) => plan.done));

/** The lines for one open phase. */
function phaseItem(phase: Phase, folders: string[]): string[] {
  const head = `- [ ] **Phase ${phase.id}: ${phase.name}.**`;
  const out = [phase.goal === '' ? head : `${head} Goal: ${phase.goal}`];
  if (phase.criteria.length > 0) out.push(`  Done when: ${phase.criteria.join('; ')}`);
  for (const plan of phase.plans.filter((plan) => !plan.done)) out.push(`  Open plan ${plan.text}`);
  const folder = folderOf(phase.id, folders);
  out.push(`  Old spec: \`.gsd-planning/${folder === null ? 'ROADMAP.md' : `phases/${folder}/`}\``);
  return out;
}

/** The section, from the text of ROADMAP.md (null when there is none), the
 * folder names in .planning/phases/, and the tag that holds the old plans. */
export function gsdSection(roadmap: string | null, folders: string[], tag: string): string {
  const intro = [
    gsdSectionTitle,
    '',
    'The open phases of the old GSD roadmap, by number. The old plans are in',
    `the gitignored \`.gsd-planning/\` and at the tag \`${tag}\`.`,
    '',
  ];
  const open = phases(roadmap ?? '').filter(isOpen);
  const body = open.flatMap((phase) => phaseItem(phase, folders));
  if (body.length === 0) body.push('No open phases.');
  return [...intro, ...body, ''].join('\n');
}
