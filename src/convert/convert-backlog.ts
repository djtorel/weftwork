// story: e12s03
// The backlog section a bigpowers conversion writes, from the parsed epic and
// task files: each open epic and story as a backlog item that keeps its id,
// with its goal, its done-when, the checks of its open tasks and a link to the
// old spec in the gitignored .specs/. Pure: no file is read here.
// docs/CONVERT.md.
import { isRecord } from '../shared/json.ts';
import { codeSpan, inlineText } from '../shared/markdown-text.ts';
import { inPlanOrder } from './convert-order.ts';

/** One epic folder under specs/: its path from specs/, its parsed epic.yaml,
 * and its parsed task files by name. The YAML is untrusted, so it is unknown. */
export type BigpowersEpic = { dir: string; epic: unknown; tasks: Map<string, unknown> };

export const sectionTitle = '## Converted from bigpowers';

/** `value` as one line of text, or '' when it is not a string or a number. */
function line(value: unknown): string {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

/** `value` as one line of escaped Markdown text (markdown-text.ts). */
const text = (value: unknown): string => inlineText(line(value));

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** True when the item with `id` and `status` is not done; execution-status.yaml wins. */
function isOpen(id: string, status: unknown, statuses: Record<string, unknown>): boolean {
  return line(statuses[id] ?? status) !== 'done';
}

const oldPath = (dir: string, name: string): string => codeSpan(`.specs/${dir}/${name}`);

/** The lines for one open story. */
function storyItem(dir: string, story: Record<string, unknown>, tasks: Map<string, unknown>): string[] {
  const head = `- [ ] **${text(story.id)} ${text(story.title)}.**`;
  const acceptance = text(story.acceptance);
  const out = [acceptance === '' ? head : `${head} Done when: ${acceptance}`];
  const file = tasks.get(line(story.tasks));
  const parsed = isRecord(file) ? file : {};
  for (const task of list(parsed.tasks)) {
    if (!isRecord(task) || line(task.status) === 'done' || line(task.verify) === '') continue;
    out.push(`  Check: task ${text(task.id)}: ${codeSpan(line(task.verify))}`);
  }
  const spec = line(parsed.spec);
  out.push(`  Old spec: ${oldPath(dir, spec === '' ? 'epic.yaml' : spec)}`);
  return out;
}

/** The lines for one epic, or none when it is done. A done epic's open
 * stories are left out with a note; an open epic whose stories are all done
 * is one item that says so. */
function epicLines(found: BigpowersEpic, statuses: Record<string, unknown>, notes: string[]): string[] {
  if (!isRecord(found.epic)) return [];
  const epic = found.epic;
  const id = text(epic.id);
  const doneWhen = text(epic.done_when);
  const stories = list(epic.stories).filter(isRecord).filter((story) => isOpen(line(story.id), story.status, statuses));
  if (!isOpen(line(epic.id), epic.status, statuses)) {
    const open = stories.map((story) => line(story.id)).join(', ');
    if (open !== '') notes.push(`Epic ${line(epic.id)} is done, but its stories ${open} are not; they are left out of the backlog.`);
    return [];
  }
  if (stories.length === 0) {
    const head = `- [ ] **${id} ${text(epic.title)}.**${list(epic.stories).length > 0 ? ' Every story is done; close the epic or add what is left.' : ''}`;
    return [doneWhen === '' ? head : `${head} Done when: ${doneWhen}`, `  Old spec: ${oldPath(found.dir, 'epic.yaml')}`, ''];
  }
  const out = [`### ${id} ${text(epic.title)}`, ''];
  if (doneWhen !== '') out.push(`Done when: ${doneWhen}`);
  out.push(`Old spec: ${oldPath(found.dir, 'epic.yaml')}`, '');
  for (const story of stories) out.push(...storyItem(found.dir, story, found.tasks));
  out.push('');
  return out;
}

/** The section, from the open epics in `epics` and the statuses in
 * execution-status.yaml (`development_status`). The epics keep `order`, the
 * epic ids of release-plan.yaml; one it does not list comes after, by
 * folder. What is left out and why goes into `notes`. */
export function backlogSection(epics: BigpowersEpic[], statuses: Record<string, unknown>, tag: string, notes: string[] = [], order: string[] = []): string {
  const intro = [
    sectionTitle,
    '',
    order.length > 0
      ? 'The open epics and stories of the old bigpowers plan, in the order of the old release plan (`release-plan.yaml`).'
      : 'The open epics and stories of the old bigpowers plan, by folder: there was no release plan to order them.',
    `The old specs are in the gitignored \`.specs/\` and at the tag ${codeSpan(tag)}.`,
    '',
  ];
  const sorted = inPlanOrder(epics, order, (found, id) => isRecord(found.epic) && line(found.epic.id) === id, (a, b) => a.dir.localeCompare(b.dir));
  const body = sorted.flatMap((found) => epicLines(found, statuses, notes));
  if (body.length === 0) body.push('No open epics or stories.', '');
  return [...intro, ...body].join('\n').replace(/\n+$/, '\n');
}
