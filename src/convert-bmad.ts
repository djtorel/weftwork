// story: e12s03c
// The backlog section a BMAD conversion writes, from the parsed
// implementation-artifacts/sprint-status.yaml, the text of the epics files in
// planning-artifacts/ and the story file names: each open epic keeps its
// number, with its title and goal from epics.md and each open story with its
// status and a link to its story file in the gitignored .bmad-output/; an
// open retrospective action item is an item too. With no sprint status every
// story in epics.md is open. Pure: no file is read here. The format is BMAD
// v6.12.4: bmad-sprint-planning/sprint-status-template.yaml,
// bmad-create-epics-and-stories/templates/epics-template.md and the
// create-story template. BMAD v4 (`bmadV4Section`) has no sprint file: its
// epics are in the PRD and each story file has a Status section; the format
// is BMAD v4.44.3's prd-tmpl.yaml, story-tmpl.yaml and shard-doc.md.
// docs/CONVERT.md.
import { isRecord } from './json.ts';
import { codeSpan, inlineText } from './markdown-text.ts';

export const bmadSectionTitle = '## Converted from BMAD';
export const bmadLocal = '.bmad-output';
export const bmadV4SectionTitle = '## Converted from BMAD v4';
export const bmadV4Local = '.bmad-stories';

/** What the section is made from. `status` is the parsed YAML, or null. */
export type BmadInput = { status: unknown; epics: string[]; storyFiles: string[] };

type Story = { key: string; number: string; title: string; status: string };
type Epic = { number: number; title: string; goal: string; status: string; stories: Story[] };

const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();
const word = (value: unknown): string => (typeof value === 'string' || typeof value === 'number' ? oneLine(String(value)) : '');

/** The epics and stories the epics files name, by number. */
function fromEpicsFiles(texts: string[]): Map<number, Epic> {
  const epics = new Map<number, Epic>();
  for (const text of texts) {
    let epic: Epic | null = null;
    let wantGoal = false;
    for (const line of text.split('\n')) {
      // v6: `## Epic N:` and `### Story N.M:`. v4: `## Epic N Title` and
      // `### Story N.M Title` in prd.md, one level up in a shard.
      const head = /^#{1,2} Epic (\d+):?\s+(.+)$/.exec(line);
      const story = /^#{2,3} Story (\d+)\.(\d+):?\s+(.+)$/.exec(line);
      if (head !== null) {
        const number = Number(head[1]);
        epic = epics.get(number) ?? { number, title: oneLine(head[2]), goal: '', status: '', stories: [] };
        epics.set(number, epic);
        wantGoal = true;
      } else if (story !== null) {
        const owner = epics.get(Number(story[1])) ?? { number: Number(story[1]), title: '', goal: '', status: '', stories: [] };
        epics.set(owner.number, owner);
        owner.stories.push({ key: '', number: `${story[1]}.${story[2]}`, title: oneLine(story[3]), status: 'backlog' });
        wantGoal = false;
      } else if (/^#/.test(line)) {
        epic = null;
        wantGoal = false;
      } else if (wantGoal && epic !== null && line.trim() !== '' && !line.trim().startsWith('<!--')) {
        epic.goal = oneLine(line);
        wantGoal = false;
      }
    }
  }
  return epics;
}

/** `slug` as a title: `plant-data-model` reads `Plant data model`. */
const titleOf = (slug: string): string => {
  const text = slug.replace(/-/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** The epics, from the epics files, with the sprint status laid over them:
 * its statuses win, and a story it lists that epics.md does not is added. */
function epicsOf(input: BmadInput): Epic[] {
  const epics = fromEpicsFiles(input.epics);
  const development = isRecord(input.status) && isRecord(input.status.development_status) ? input.status.development_status : null;
  if (development !== null) {
    for (const epic of epics.values()) epic.stories = epic.stories.map((story) => ({ ...story, status: '' }));
    for (const [key, value] of Object.entries(development)) {
      const status = word(value);
      const epicKey = /^epic-(\d+)$/.exec(key);
      const storyKey = /^(\d+)-(\d+)-(.+)$/.exec(key);
      if (epicKey !== null) {
        const number = Number(epicKey[1]);
        const epic = epics.get(number) ?? { number, title: '', goal: '', status: '', stories: [] };
        epic.status = status;
        epics.set(number, epic);
      } else if (storyKey !== null) {
        const number = Number(storyKey[1]);
        const epic = epics.get(number) ?? { number, title: '', goal: '', status: '', stories: [] };
        epics.set(number, epic);
        const id = `${storyKey[1]}.${storyKey[2]}`;
        const known = epic.stories.find((story) => story.number === id);
        if (known !== undefined) Object.assign(known, { key, status });
        else epic.stories.push({ key, number: id, title: titleOf(storyKey[3]), status });
      }
    }
    // A story only in epics.md, with no sprint status line, has not started.
    for (const epic of epics.values()) for (const story of epic.stories) if (story.status === '') story.status = 'backlog';
  }
  return [...epics.values()].sort((a, b) => a.number - b.number);
}

/** Where the backlog points: the line for the epics' source, and a story's
 * old file, or null. */
type Where = { epics: string; story: (story: Story) => string | null };

const isDone = (status: string): boolean => status.toLowerCase() === 'done';

/** The lines for one epic, or none when it is done. */
function epicLines(epic: Epic, where: Where, notes: string[]): string[] {
  const open = epic.stories.filter((story) => !isDone(story.status));
  if (epic.status === 'done') {
    if (open.length > 0) notes.push(`Epic ${epic.number} is done, but its stories ${open.map((story) => story.key || story.number).join(', ')} are not; they are left out of the backlog.`);
    return [];
  }
  const title = epic.title === '' ? `Epic ${epic.number}` : `Epic ${epic.number}: ${inlineText(epic.title)}`;
  const oldEpics = `  ${where.epics}`;
  if (open.length === 0) {
    const head = `- [ ] **${title}.**${epic.stories.length > 0 ? ' Every story is done; close the epic or add what is left.' : ''}`;
    return [epic.goal === '' ? head : `${head} Goal: ${inlineText(epic.goal)}`, oldEpics, ''];
  }
  const out = [`### ${title}`, ''];
  if (epic.goal !== '') out.push(`Goal: ${inlineText(epic.goal)}`);
  out.push(oldEpics.trim(), '');
  for (const story of open) {
    const name = story.title === '' ? story.number : `${story.number} ${inlineText(story.title)}`;
    out.push(`- [ ] **Story ${name}.** Status: ${inlineText(story.status)}`);
    const file = where.story(story);
    if (file !== null) out.push(`  Old spec: ${codeSpan(file)}`);
  }
  out.push('');
  return out;
}

/** The open retrospective action items. */
function actionLines(status: unknown): string[] {
  const items = isRecord(status) && Array.isArray(status.action_items) ? status.action_items.filter(isRecord) : [];
  return items
    .filter((item) => word(item.status) !== 'done' && word(item.action) !== '')
    .map((item) => {
      const head = `- [ ] **Retrospective action (epic ${inlineText(word(item.epic))}): ${inlineText(word(item.action))}.**`;
      return word(item.owner) === '' ? head : `${head} Owner: ${inlineText(word(item.owner))}`;
    });
}

/** The section, from `input`, the tag that holds the old plans, and `notes`
 * for what is left out and why. */
export function bmadSection(input: BmadInput, tag: string, notes: string[]): string {
  const intro = [
    bmadSectionTitle,
    '',
    'The open epics and stories of the old BMAD sprint, by number. The old plans',
    `are in the gitignored ${codeSpan(`${bmadLocal}/`)} and at the tag ${codeSpan(tag)}.`,
    '',
  ];
  const files = new Set(input.storyFiles);
  const where: Where = {
    epics: `Old spec: ${codeSpan(`${bmadLocal}/planning-artifacts/`)}`,
    story: (story) => (files.has(`${story.key}.md`) ? `${bmadLocal}/implementation-artifacts/${story.key}.md` : null),
  };
  const body = epicsOf(input).flatMap((epic) => epicLines(epic, where, notes));
  const actions = actionLines(input.status);
  if (actions.length > 0) body.push(...actions, '');
  return sectionText(intro, body);
}

const sectionText = (intro: string[], body: string[]): string => {
  if (body.length === 0) body.push('No open epics or stories.', '');
  return [...intro, ...body].join('\n').replace(/\n+$/, '\n');
};

/** A v4 story file's status: the line under `## Status` (story-tmpl.yaml),
 * or the rest of `## Status: Draft` (create-brownfield-story.md); '' when
 * it has none. */
function storyStatus(text: string): string {
  const lines = text.split('\n');
  for (const [index, line] of lines.entries()) {
    const head = /^## Status\b:?(.*)$/.exec(line.trim());
    if (head === null) continue;
    if (head[1].trim() !== '') return oneLine(head[1]);
    const next = lines.slice(index + 1).find((each) => each.trim() !== '');
    return next === undefined || next.trim().startsWith('#') ? '' : oneLine(next);
  }
  return '';
}

/** What a BMAD v4 section is made from: the text of each epics source (the
 * PRD or its epic shards), each story file by name, and the PRD path. */
export type BmadV4Input = { epics: string[]; stories: Record<string, string>; prd: string };

/** The BMAD v4 section: each epic of the PRD with an open story, keeping its
 * number, title and goal, and each story whose file's Status is not Done, or
 * that has no story file yet. An epic is done when it has stories and all
 * are Done. */
export function bmadV4Section(input: BmadV4Input, tag: string, notes: string[]): string {
  const epics = fromEpicsFiles(input.epics);
  for (const epic of epics.values()) for (const story of epic.stories) story.status = 'no story file yet';
  for (const file of Object.keys(input.stories).sort()) {
    const name = /^(\d+)\.(\d+)\.(.+)\.md$/.exec(file);
    if (name === null) continue;
    const text = input.stories[file];
    const number = Number(name[1]);
    const epic = epics.get(number) ?? { number, title: '', goal: '', status: '', stories: [] };
    epics.set(number, epic);
    const id = `${name[1]}.${name[2]}`;
    const status = storyStatus(text) || 'unknown';
    const title = oneLine(/^# Story \d+\.\d+:?\s+(.+)$/m.exec(text)?.[1] ?? (name[3] === 'story' ? '' : titleOf(name[3])));
    const known = epic.stories.find((story) => story.number === id);
    if (known !== undefined) Object.assign(known, { key: file, status, title: known.title || title });
    else epic.stories.push({ key: file, number: id, title, status });
  }
  for (const epic of epics.values()) if (epic.stories.length > 0 && epic.stories.every((story) => isDone(story.status))) epic.status = 'done';
  const intro = [
    bmadV4SectionTitle,
    '',
    'The open epics and stories of the old BMAD v4 project, by number. The story',
    `files are in the gitignored ${codeSpan(`${bmadV4Local}/`)} and at the tag ${codeSpan(tag)}.`,
    '',
  ];
  const where: Where = { epics: `PRD: ${codeSpan(input.prd)}`, story: (story) => (story.key === '' ? null : `${bmadV4Local}/${story.key}`) };
  const sorted = [...epics.values()].sort((a, b) => a.number - b.number);
  return sectionText(intro, sorted.flatMap((epic) => epicLines(epic, where, notes)));
}
