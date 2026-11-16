// story: e12s03c
// The backlog section a spec-kit conversion writes, from the spec.md and
// tasks.md of each feature folder in specs/: each feature with an open task,
// or with no tasks.md yet, as one backlog item that keeps its folder name,
// with the spec's title, its success criteria as done-when, its open tasks
// and a link to its old folder in the gitignored .speckit-specs/. A feature
// whose tasks are all ticked is done. Pure: no file is read here. The format
// is spec-kit's templates/spec-template.md and templates/tasks-template.md,
// and the tasks command's checklist format (`- [ ] T001 [P] [US1] ...`).
// docs/CONVERT.md.
import { codeSpan, inlineText } from './markdown-text.ts';

export const speckitSectionTitle = '## Converted from spec-kit';
export const speckitLocal = '.speckit-specs';

/** One feature folder under specs/: its name, and the text of its spec.md
 * and tasks.md (null when missing). */
export type SpeckitFeature = { dir: string; spec: string | null; tasks: string | null };

/** The most open tasks listed for one feature. */
const maxTasks = 20;

const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** The feature name from `# Feature Specification: <name>`, or ''. */
function title(spec: string | null): string {
  const found = /^# Feature Specification:\s*(.+)$/m.exec(spec ?? '');
  return found === null ? '' : oneLine(found[1]);
}

/** The `- **SC-001**: ...` lines of the spec's `## Success Criteria`. */
function criteria(spec: string | null): string[] {
  const out: string[] = [];
  let inside = false;
  for (const line of (spec ?? '').split('\n')) {
    if (/^## /.test(line)) inside = /^## Success Criteria\b/.test(line);
    const found = inside ? /^- \*\*SC-\d+\*\*:\s*(.+)$/.exec(line) : null;
    if (found !== null) out.push(oneLine(found[1]));
  }
  return out;
}

/** The checklist tasks of tasks.md, top-level only: `- [ ] T001 ...`. */
function taskLines(tasks: string): { done: boolean; text: string }[] {
  const out: { done: boolean; text: string }[] = [];
  for (const line of tasks.split('\n')) {
    const found = /^- \[([ xX])\] (T\d+\b.*)$/.exec(line.trimEnd());
    if (found !== null) out.push({ done: found[1] !== ' ', text: oneLine(found[2]) });
  }
  return out;
}

/** The lines for one feature, or none when it is done. */
function featureLines(feature: SpeckitFeature): string[] {
  const name = title(feature.spec);
  const head = `- [ ] **${inlineText(feature.dir)}${name === '' ? '' : ` ${inlineText(name)}`}.**`;
  const all = feature.tasks === null ? null : taskLines(feature.tasks);
  const open = all?.filter((task) => !task.done) ?? [];
  if (all !== null && open.length === 0 && all.length > 0) return [];
  const done = criteria(feature.spec);
  const first = all === null || all.length === 0 ? `${head} No tasks yet.` : head;
  const out = [done.length === 0 ? first : `${first} Done when: ${inlineText(done.join('; '))}`];
  for (const task of open.slice(0, maxTasks)) out.push(`  Open task ${inlineText(task.text)}`);
  if (open.length > maxTasks) out.push(`  And ${open.length - maxTasks} more open tasks in tasks.md.`);
  out.push(`  Old spec: ${codeSpan(`${speckitLocal}/${feature.dir}/`)}`);
  return out;
}

/** The section, from the feature folders (sorted by name) and the tag that
 * holds the old specs. */
export function speckitSection(features: SpeckitFeature[], tag: string): string {
  const intro = [
    speckitSectionTitle,
    '',
    'The open features of the old spec-kit specs, by folder. The old specs are',
    `in the gitignored ${codeSpan(`${speckitLocal}/`)} and at the tag ${codeSpan(tag)}.`,
    '',
  ];
  const body = [...features].sort((a, b) => a.dir.localeCompare(b.dir)).flatMap(featureLines);
  if (body.length === 0) body.push('No open features.');
  return [...intro, ...body, ''].join('\n');
}
