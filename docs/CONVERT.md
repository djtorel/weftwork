# Convert a project

<!-- story: e12s03, e12s03b -->

The third step of backlog e12: move a project off another planning system and
onto weftwork. It converts bigpowers (`specs/state.yaml`) and GSD
(`.planning/`, the v1.30 layout); spec-kit and BMAD come later. It makes the steps of PR #66 general. The
`convert-project` skill drives it in Claude Code, and then runs setup
(`docs/SETUP.md`) for the new AGENTS.md.

## Run it

```bash
echo '{"path":"/path/to/project"}' | node src/convert-cli.ts
```

| Key | Default | Meaning |
| --- | --- | --- |
| `path` | the current folder | The project folder, the root of a git repository |
| `system` | found from the folder | `bigpowers` or `gsd`; needed only when the folder has both |
| `tag` | `bigpowers-era`, or `gsd-era` | The tag put on the last commit that tracks the plans |
| `apply` | `false` | Convert; without it the CLI prints the plan and writes nothing |

It prints one JSON line and exits 0. It exits 1, with the reason on stderr,
when the conversion is refused, and 2 for bad input.

Without `apply`: `{"ok":true,"plan":{"system","tag","moves","changes","notes"}}`.
Each change has a `path`, an `action` (`rewrite`, `append`, `create`,
`unchanged`) and a `diff`. With `apply`:
`{"ok":true,"tag","moved","written","kept","notes"}`.

## What it does

The steps below are for bigpowers; "GSD" below them says what differs.

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
   epic with no stories is one item. Status comes from
   `execution-status.yaml` when it has the id, else from `epic.yaml`;
   anything `done` is left out, and so is `epics/archive/`. A backlog that has
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
read; GSD 2's `.gsd/` layout is not converted.

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
`specs/state.yaml` (GSD: `.planning/`), has uncommitted changes in the plans
folder (the tag would not hold them), already has the tag or the local copy,
has both systems and no `system`, or when a cited file would
move onto a file that exists. Apply checks all of these again. A file that
changed between the plan and the write is kept and listed in `kept`.

## What is left for the agent

- **The notes.** Each tracked file that still names `specs/` (GSD:
  `.planning/`) after the rewrite is a note: a citation of the old system's
  own state, a tool or a CI step that exists only for it, or a path built in
  code. Check what calls each one; drop it if it serves only the old system,
  or point it at the new place.
- **Paths built in code.** The scan reads text, so `join('specs',
  'state.yaml')` is not found. Preflight after the conversion finds what
  breaks.
- **AGENTS.md.** Run setup (`docs/SETUP.md`) and overwrite the old letter;
  setup moves it to `AGENTS.md.weftwork-old` first.
- Preflight must pass before and after, in the same pull request.
