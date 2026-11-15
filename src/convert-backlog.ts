// story: e12s03
// The backlog section a bigpowers conversion writes, from the parsed epic and
// task files: each open epic and story as a backlog item that keeps its id,
// with its goal, its done-when, the checks of its open tasks and a link to the
// old spec in the gitignored .specs/. Pure: no file is read here.
// docs/CONVERT.md.
import { isRecord } from './json.ts';

/** One epic folder under specs/: its path from specs/, its parsed epic.yaml,
 * and its parsed task files by name. The YAML is untrusted, so it is unknown. */
export type BigpowersEpic = { dir: string; epic: unknown; tasks: Map<string, unknown> };

export const sectionTitle = '## Converted from bigpowers';

/** `value` as one line of text, or '' when it is not a string or a number. */
function line(value: unknown): string {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** True when the item with `id` and `status` is not done; execution-status.yaml wins. */
function isOpen(id: string, status: unknown, statuses: Record<string, unknown>): boolean {
  return line(statuses[id] ?? status) !== 'done';
}

const oldPath = (dir: string, name: string): string => `\`.specs/${dir}/${name}\``;

/** The lines for one open story. */
function storyItem(dir: string, story: Record<string, unknown>, tasks: Map<string, unknown>): string[] {
  const head = `- [ ] **${line(story.id)} ${line(story.title)}.**`;
  const acceptance = line(story.acceptance);
  const out = [acceptance === '' ? head : `${head} Done when: ${acceptance}`];
  const file = tasks.get(line(story.tasks));
  const parsed = isRecord(file) ? file : {};
  for (const task of list(parsed.tasks)) {
    if (!isRecord(task) || line(task.status) === 'done' || line(task.verify) === '') continue;
    out.push(`  Check: task ${line(task.id)}: \`${line(task.verify)}\``);
  }
  const spec = line(parsed.spec);
  out.push(`  Old spec: ${oldPath(dir, spec === '' ? 'epic.yaml' : spec)}`);
  return out;
}

/** The lines for one epic, or none when it is done. */
function epicLines(found: BigpowersEpic, statuses: Record<string, unknown>): string[] {
  if (!isRecord(found.epic)) return [];
  const epic = found.epic;
  const id = line(epic.id);
  const doneWhen = line(epic.done_when);
  const stories = list(epic.stories).filter(isRecord).filter((story) => isOpen(line(story.id), story.status, statuses));
  if (stories.length === 0) {
    if (!isOpen(id, epic.status, statuses) || list(epic.stories).length > 0) return [];
    const head = `- [ ] **${id} ${line(epic.title)}.**`;
    return [doneWhen === '' ? head : `${head} Done when: ${doneWhen}`, `  Old spec: ${oldPath(found.dir, 'epic.yaml')}`, ''];
  }
  const out = [`### ${id} ${line(epic.title)}`, ''];
  if (doneWhen !== '') out.push(`Done when: ${doneWhen}`);
  out.push(`Old spec: ${oldPath(found.dir, 'epic.yaml')}`, '');
  for (const story of stories) out.push(...storyItem(found.dir, story, found.tasks));
  out.push('');
  return out;
}

/** The section, from the open epics in `epics` (sorted by folder) and the
 * statuses in execution-status.yaml (`development_status`). */
export function backlogSection(epics: BigpowersEpic[], statuses: Record<string, unknown>, tag: string): string {
  const intro = [
    sectionTitle,
    '',
    `The open epics and stories of the old bigpowers plan, by id. The old specs`,
    `are in the gitignored \`.specs/\` and at the tag \`${tag}\`.`,
    '',
  ];
  const body = [...epics].sort((a, b) => a.dir.localeCompare(b.dir)).flatMap((found) => epicLines(found, statuses));
  if (body.length === 0) body.push('No open epics or stories.', '');
  return [...intro, ...body].join('\n').replace(/\n+$/, '\n');
}
