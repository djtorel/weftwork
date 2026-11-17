// story: e12s03b
// The backlog section a GSD 2 conversion writes, from the Markdown that GSD 2
// renders into .gsd/milestones/: each open milestone keeps its id, with its
// title, vision and success criteria from its ROADMAP, and each open slice
// (an unticked `- [ ] **S01: Title**` line) with its `After this:` demo, the
// open tasks of its slice PLAN (an unticked `- [ ] **T01: Title**` with no
// T01-SUMMARY.md) and a link to its folder. A milestone with a SUMMARY, or
// with every slice ticked, is done. Pure: no file is read here. The format is
// gsd-build/gsd-2 v3.0.0: templates/roadmap.md, templates/plan.md and the
// ID-SUFFIX names of paths.ts. docs/CONVERT.md.
import { codeSpan, inlineText } from '../shared/markdown-text.ts';
import { inPlanOrder } from './convert-order.ts';

export const gsd2SectionTitle = '## Converted from GSD 2';

/** One slice folder: its name, its PLAN's text (null: none), and the ids of
 * the tasks with a SUMMARY. */
export type Gsd2Slice = { dir: string; plan: string | null; doneTasks: string[] };

/** One milestone folder: its name, its ROADMAP's text (null: none), whether
 * it has a SUMMARY, and its slice folders. */
export type Gsd2Milestone = { dir: string; roadmap: string | null; summary: boolean; slices: Gsd2Slice[] };

const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** `text` without HTML comments, where the templates keep their guidance. */
const uncommented = (text: string): string => text.replace(/<!--[\s\S]*?(-->|$)/g, '');

/** The lines under the `## <name>` heading of `text`, up to the next one. */
function section(text: string, name: string): string[] {
  const out: string[] = [];
  let inside = false;
  for (const line of text.split('\n')) {
    if (/^## /.test(line)) inside = line.trim() === `## ${name}`;
    else if (inside) out.push(line);
  }
  return out;
}

type Item = { id: string; title: string; done: boolean; demo: string };

/** The top-level `- [ ] **X01: Title**` lines under `## <name>`, each with
 * the `> After this:` line below it. */
function items(text: string, name: string, prefix: string): Item[] {
  const out: Item[] = [];
  for (const line of section(text, name)) {
    const found = new RegExp(`^- \\[([ xX])\\] \\*\\*(${prefix}\\d+):\\s*(.+?)\\*\\*`).exec(line);
    const demo = /^\s+>\s*After this:\s*(.+)$/.exec(line);
    if (found !== null) out.push({ id: found[2], title: oneLine(found[3]), done: found[1] !== ' ', demo: '' });
    else if (demo !== null && out.length > 0 && out[out.length - 1].demo === '') out[out.length - 1].demo = oneLine(demo[1]);
  }
  return out;
}

/** The id at the start of a folder name: `S03-HUD` is `S03`. */
const idOf = (dir: string): string => /^[A-Z]\d+/.exec(dir)?.[0] ?? dir;

/** The lines for one milestone, or none when it is done. */
function milestoneLines(milestone: Gsd2Milestone, where: string): string[] {
  const text = uncommented(milestone.roadmap ?? '');
  const slices = items(text, 'Slices', 'S');
  const open = slices.filter((slice) => !slice.done);
  if (milestone.summary || (slices.length > 0 && open.length === 0)) return [];
  const heading = /^# (M\d+):\s*(.+)$/m.exec(text);
  const id = heading?.[1] ?? idOf(milestone.dir);
  const out = [`### ${id}${heading === null ? '' : `: ${inlineText(oneLine(heading[2]))}`}`, ''];
  const vision = /^\*\*Vision:\*\*\s*(.+)$/m.exec(text);
  if (vision !== null) out.push(`Goal: ${inlineText(oneLine(vision[1]))}`);
  const criteria = section(text, 'Success Criteria').flatMap((line) => /^- (.+)$/.exec(line)?.[1] ?? []).map(oneLine);
  if (criteria.length > 0) out.push(`Done when: ${inlineText(criteria.join('; '))}`);
  out.push(`Old spec: ${codeSpan(`${where}/milestones/${milestone.dir}/`)}`, '');
  for (const slice of open) {
    const head = `- [ ] **${slice.id}: ${inlineText(slice.title)}.**`;
    out.push(slice.demo === '' ? head : `${head} After this: ${inlineText(slice.demo)}`);
    const folder = milestone.slices.find((each) => idOf(each.dir) === slice.id);
    const done = new Set(folder?.doneTasks ?? []);
    for (const task of items(uncommented(folder?.plan ?? ''), 'Tasks', 'T')) {
      if (!task.done && !done.has(task.id)) out.push(`  Open task ${task.id}: ${inlineText(task.title)}`);
    }
    const link = folder === undefined ? `${where}/milestones/${milestone.dir}/` : `${where}/milestones/${milestone.dir}/slices/${folder.dir}/`;
    out.push(`  Old spec: ${codeSpan(link)}`);
  }
  out.push('');
  return out;
}

/** The milestone number of folder `dir` (`M001-FLIGHT`), as GSD 2's
 * milestoneIdSort reads it; 0 when there is none. */
const numberOf = (dir: string): number => Number(/^M(\d+)/.exec(dir)?.[1] ?? 0);

/** The section, from the milestone folders, the tag that holds the old
 * plans ('' when `.gsd/` is not tracked, so none was made), `where` the old
 * plans are after the conversion, and `order`, the milestone ids of
 * QUEUE-ORDER.json. A folder is the id or `<id>-<descriptor>`, as GSD 2's
 * resolveDir finds it; one the queue does not list comes after, by number. */
export function gsd2Section(milestones: Gsd2Milestone[], tag: string, where: string, order: string[] = []): string {
  const kept =
    tag === ''
      ? `The old plans stay in ${codeSpan(`${where}/`)}, which git does not track.`
      : `The old plans are in the gitignored ${codeSpan(`${where}/`)} and at the tag ${codeSpan(tag)}.`;
  const how = order.length > 0 ? 'in the queue order of GSD 2 (`QUEUE-ORDER.json`)' : 'by milestone number, the default queue order of GSD 2';
  const intro = [gsd2SectionTitle, '', `The open milestones and slices of the old GSD 2 roadmaps, ${how}.`, kept, ''];
  const sorted = inPlanOrder(
    milestones,
    order,
    (milestone, id) => milestone.dir === id || milestone.dir.startsWith(`${id}-`),
    (a, b) => numberOf(a.dir) - numberOf(b.dir) || a.dir.localeCompare(b.dir),
  );
  const body = sorted.flatMap((milestone) => milestoneLines(milestone, where));
  if (body.length === 0) body.push('No open milestones.', '');
  return [...intro, ...body].join('\n').replace(/\n+$/, '\n');
}
