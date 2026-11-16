# Convert a project

<!-- story: e12s03, e12s03b, e12s03c, e12s03d -->

The third step of backlog e12: move a project off another planning system and
onto weftwork. It converts bigpowers (`specs/state.yaml`), GSD
(`.planning/`, the v1.30 layout), GSD 2 (`.gsd/`), spec-kit (`.specify/` with `specs/`) and
BMAD (`_bmad/` with `_bmad-output/`, the v6 sprint layout; or v4's
`.bmad-core/` with `docs/stories/`). It makes the steps of PR #66 general. The
`migrate` skill drives it in Claude Code, and then runs setup
(`docs/SETUP.md`) for the new AGENTS.md.

## Run it

```bash
echo '{"path":"/path/to/project"}' | node src/convert-cli.ts
```

| Key | Default | Meaning |
| --- | --- | --- |
| `path` | the current folder | The project folder, the root of a git repository |
| `system` | found from the folder | `bigpowers`, `gsd`, `gsd2`, `spec-kit`, `bmad` or `bmad-v4`; needed only when the folder has more than one |
| `tag` | `bigpowers-era`, `gsd-era`, `gsd2-era`, `speckit-era` or `bmad-era` (both BMAD) | The tag put on the last commit that tracks the plans |
| `apply` | `false` | Convert; without it the CLI prints the plan and writes nothing |

It prints one JSON line and exits 0. It exits 1, with the reason on stderr,
when the conversion is refused, and 2 for bad input.

Without `apply`: `{"ok":true,"plan":{"system","tag","moves","changes","notes"}}`.
Each change has a `path`, an `action` (`rewrite`, `append`, `create`,
`unchanged`) and a `diff`. With `apply`:
`{"ok":true,"tag","moved","written","kept","notes"}`.

## What it does

The steps below are for bigpowers; "GSD", "GSD 2", "spec-kit", "BMAD" and
"BMAD v4" below them say what differs.

1. **Tag** `HEAD` with `tag`, so the last tracked copy of the old plans stays
   in the history. Undo: `git tag -d <tag>`.
2. **Move cited files into `docs/`.** A file under `specs/` that a tracked file
   outside `specs/` names as `specs/<path>` moves to `docs/<path>`, and so
   does every ADR (`specs/adr/`). bigpowers' own plans and state stay behind,
   even when cited: `state.yaml`, `execution-status.yaml`,
   `release-plan.yaml`, `planning-status.yaml`, `*_LATEST.*` and the folders
   `epics/`, `metrics/`, `checkpoints/`, `verifications/`, `product/`,
   `archive/` and `codebase-wiki/`.
3. **Rewrite the citations** of each moved file, in tracked files and in the
   moved files, from `specs/<path>` to `docs/<path>`. A file's mode is kept.
   `.gitignore` is only appended to; a citation there is a note.
4. **Untrack the rest:** `specs/` moves to `.specs/`, and `.gitignore` gets
   `.specs/`. Git then shows the old files as deleted; the local copy keeps
   every byte.
5. **Add the open work to the local backlog**
   (`<git common dir>/weftwork/BACKLOG.md`), as a section
   `## Converted from bigpowers`. Each open epic and story keeps its id, with
   its title, its done-when (`done_when`, `acceptance`), the `verify` command
   of each open task as `Check:` and a link to its old spec in `.specs/`. An
   epic with no stories is one item, and so is an open epic whose stories are
   all done, marked `Every story is done; close the epic or add what is
   left.` Status comes from `execution-status.yaml` when it has the id, else
   from `epic.yaml`; anything `done` is left out, and so is `epics/archive/`.
   A done epic's open stories are left out too, with a note naming them. A backlog that has
   the section already is left as it is.

**GSD.** The plans folder is `.planning/` and its local copy
`.gsd-planning/` (`.planning` is already hidden, and `.gsd` is GSD 2's
folder). GSD's own plans and state stay behind, even when cited:
`PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `MILESTONES.md`,
`RETROSPECTIVE.md`, `config.json` and the folders `phases/`, `milestones/`,
`quick/`, `todos/`, `debug/`, `seeds/`, `threads/`, `forensics/` and
`reports/`; a cited `codebase/` or `research/` file moves to `docs/`. GSD has
no ADR folder: a `Decisions` or `Key Decisions` section in `PROJECT.md` or
`STATE.md` is a note, for the agent to carry by hand. The backlog section is
`## Converted from GSD`: one item per open phase of `ROADMAP.md`, keeping its
number, with its goal, its success criteria as `Done when:`, each open plan,
and a link to its folder in `.gsd-planning/phases/` (or to `ROADMAP.md` when
it has none). A phase is done when its line is ticked, the Progress table
says `Complete`, or every plan is done; a shipped milestone collapsed in
`<details>` is left out. A `<id>-PLAN.md` in a phase folder with no
`<id>-SUMMARY.md` beside it is open, as GSD itself counts it, even when the
roadmap does not list it: it joins its phase's item as `Open plan <id>:
<title> (<file>, not on the roadmap)`, and a phase folder the roadmap does not
list becomes an item marked `Not on the roadmap.` The title is the first line
of the plan's `<objective>` (GSD's `templates/phase-prompt.md`), cut to 120
characters; a plan with no objective, or an empty one, gets no title. A phase
ticked or `Complete` on the roadmap stays done. Nothing else in a plan is
read.

**GSD 2.** The plans folder is `.gsd/`, as GSD 2 (v3.0.0) renders it from its
database. GSD 2 puts `.gsd` in `.gitignore` by default, and then there is
nothing tracked to tag or move: the plan has no tag (`"tag": ""`), no moves,
and only the backlog change, with a note, and `.gsd/` stays where it is. A
project that tracks `.gsd/` is converted like GSD: tag `gsd2-era`, `.gsd/`
to the gitignored `.gsd2-plans/`; all of `.gsd/` is GSD 2's own, so nothing
moves to `docs/`. `DECISIONS.md` or `KNOWLEDGE.md` in `.gsd/` is a note.
The backlog section is `## Converted from GSD 2`: each milestone folder
(`milestones/M001/`) with no `M001-SUMMARY.md` and an unticked slice keeps
its id, with the title from `# M001: <title>` in `M001-ROADMAP.md`, its
`**Vision:**` as `Goal:` and its `## Success Criteria` as `Done when:`; each
unticked slice (`- [ ] **S02: Title**`) has its `After this:` line, each open
task of `slices/S02/S02-PLAN.md` (an unticked `- [ ] **T01: Title**` with no
`tasks/T01-SUMMARY.md`), and a link to its folder. Template guidance in HTML
comments is skipped. The format is gsd-build/gsd-2 v3.0.0's
`templates/roadmap.md`, `templates/plan.md` and `paths.ts`.

**spec-kit.** The plans folder is `specs/`, one folder per feature
(`specs/001-name/`), and its local copy `.speckit-specs/`; the marker is
`.specify/`. Each feature's own `spec.md`, `plan.md`, `tasks.md`,
`quickstart.md` and `checklists/` stay behind, even when cited; a cited
contract, data model or research file moves to `docs/`. `.specify/`
(spec-kit's templates, scripts and `memory/constitution.md`) stays tracked,
with a note: carry the constitution's principles into AGENTS.md or
CONVENTIONS.md, then drop `.specify/` and the spec-kit agent commands once
nothing else calls them. The backlog section is `## Converted from
spec-kit`: one item per feature folder with an open task, or with no tasks
yet, keeping its folder name, with the title from `# Feature
Specification: <name>` in `spec.md`, the `SC-` lines of its `## Success
Criteria` as `Done when:`, each open top-level task of `tasks.md` (`- [ ]
T012 [P] [US1] ...`, up to 20 and a count of the rest), and a link to its
folder in `.speckit-specs/`. A feature whose tasks are all ticked is done.
A project with `.specify/` and no `specs/` is refused: there is nothing to
convert.

**BMAD.** The plans folder is `_bmad-output/` and its local copy
`.bmad-output/`; the marker is `_bmad/`. The format is BMAD v6.12.4's: the
sprint in `implementation-artifacts/sprint-status.yaml`, the story files
beside it (`1-2-account-management.md`), and the epics in
`planning-artifacts/epics.md` (or `epics/*.md`). The sprint, the stories and
the epics files stay behind, even when cited; a cited PRD, architecture or UX
document moves to `docs/`. `_bmad/` (the installed modules) stays tracked,
with a note, like spec-kit's `.specify/`. The backlog section is `##
Converted from BMAD`: each open epic of `development_status` keeps its
number, with its title and goal from the `## Epic N:` heading of epics.md,
and each open story (`N-M-slug`, any status but `done`) its title from
`### Story N.M:`, its status, and a link to its story file when there is
one. A done epic's open stories are left out with a note; an open epic with
every story done is one item. Each retrospective action item not `done` is
an item. With no sprint status, every story in epics.md is open. The newer
ticket tree (`_bmad-output/initiative-*/tickets/tickets.toml`, or
`_bmad-output/backlog/`) is refused with a reason: its file format has no
public release or template to build it from yet.

**BMAD v4.** The marker is `.bmad-core/`. The format is BMAD-METHOD
v4.44.3's, the last v4 release (tag `v4.44.3`, commit `4c4f6dc`, 2025-10-30;
the `V4` branch has no later commit), read with `gh api` from
`bmad-code-org/BMAD-METHOD`: `bmad-core/core-config.yaml`,
`bmad-core/templates/story-tmpl.yaml`, `bmad-core/templates/prd-tmpl.yaml`,
`bmad-core/tasks/create-next-story.md`,
`bmad-core/tasks/create-brownfield-story.md` and
`bmad-core/tasks/shard-doc.md`. The plans folder is the story folder,
`devStoryLocation` in `.bmad-core/core-config.yaml` (`docs/stories` by
default), and its local copy `.bmad-stories/`. Every story file is BMAD's
own, so nothing in it moves to `docs/`. The PRD, the architecture and the QA
files are in `docs/` already and stay there, tracked; so does `.bmad-core/`,
with a note. A `devStoryLocation`, `prdFile` or `prdShardedLocation` that is
not a plain path inside the project is refused. The backlog section is `##
Converted from BMAD v4`. The epics come from the sharded PRD
(`prdShardedLocation`, files that match `epicFilePattern`, `docs/prd/epic-1-*.md`)
when `prdSharded` is not false and such files exist, else from `prdFile`
(`docs/prd.md`): `# Epic N Title` or `## Epic N Title` (a colon after the
number is allowed), its first paragraph as `Goal:`, and `## Story N.M Title`
or `### Story N.M Title`. A story file is `<epic>.<story>.<slug>.md` (or
`<epic>.<story>.story.md`); its status is the line under `## Status`, or the
rest of `## Status: Draft`. A story is open when its status is not `Done`
(story-tmpl.yaml has Draft, Approved, InProgress, Review and Done; the dev
agent also writes `Ready for Review`). A PRD story with no story file is open
as `no story file yet`, since v4 writes story files one at a time. Each open
epic keeps its number, title and goal, a `PRD:` link, and each open story its
status and a link to its file in `.bmad-stories/`. An epic whose stories are
all `Done` is left out. A v4 project with no story folder yet is refused.

Text taken from the old plans is escaped for Markdown before it goes into
the backlog (`src/markdown-text.ts`): `\`, a backtick, `*`, `<`, `[`, `~`,
a `&` that starts an entity (`&amp;`, `&#169;`) and a `_` not inside a word
get a backslash (`snake_case` stays as it is), and a `Check:` command or an old-spec path is a code span fenced
longer than any backtick inside. An HTML comment or a stray backtick in a
roadmap or an epic stays text and does not hide the rest of the backlog, and
a `[link]`, `~~strike~~`, `_emphasis_` or `&amp;` shows as written.

Nothing is deleted. Nothing is committed: the owner's agent commits the
result, with the new AGENTS.md, in one pull request.

## What it refuses

The plan is refused when the folder is not a git repository root, has no
`specs/state.yaml` (GSD: `.planning/`; spec-kit: `.specify/` and `specs/`;
BMAD: `_bmad/` and `_bmad-output/`, not the ticket tree; BMAD v4:
`.bmad-core/` and the story folder), has uncommitted changes in the plans
folder (the tag would not hold them), already has the tag or the local copy,
has more than one system and no `system`, has no plans folder to move, or when a cited file would
move onto a file that exists. Apply checks all of these again. A file that
changed between the plan and the write is kept and listed in `kept`.

## What is left for the agent

- **The notes.** Each tracked file that still names `specs/` (GSD:
  `.planning/`) after the rewrite is a note: a citation of the old system's
  own state, a tool or a CI step that exists only for it, or a path built in
  code. Check what calls each one; drop it if it serves only the old system,
  or point it at the new place.
- **Paths built in code.** The scan reads text, so `join('specs',
  'state.yaml')` is not rewritten. A tracked file that names the plans folder
  as a quoted string (`'specs'`, `".planning"`) is a note; check each, and
  Preflight after the conversion finds the rest.
- **AGENTS.md.** Run setup (`docs/SETUP.md`) and overwrite the old letter;
  setup moves it to `AGENTS.md.weftwork-old` first.
- Preflight must pass before and after, in the same pull request.
