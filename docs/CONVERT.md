# Convert a project

<!-- story: e12s03 -->

The third step of backlog e12: move a project off another planning system and
onto weftwork. This version converts bigpowers only (`specs/state.yaml`); GSD,
spec-kit and BMAD come later. It makes the steps of PR #66 general. The
`convert-project` skill drives it in Claude Code, and then runs setup
(`docs/SETUP.md`) for the new AGENTS.md.

## Run it

```bash
echo '{"path":"/path/to/project"}' | node src/convert-cli.ts
```

| Key | Default | Meaning |
| --- | --- | --- |
| `path` | the current folder | The project folder, the root of a git repository |
| `tag` | `bigpowers-era` | The tag put on the last commit that tracks `specs/` |
| `apply` | `false` | Convert; without it the CLI prints the plan and writes nothing |

It prints one JSON line and exits 0. It exits 1, with the reason on stderr,
when the conversion is refused, and 2 for bad input.

Without `apply`: `{"ok":true,"plan":{"tag","moves","changes","notes"}}`.
Each change has a `path`, an `action` (`rewrite`, `append`, `create`,
`unchanged`) and a `diff`. With `apply`:
`{"ok":true,"tag","moved","written","kept","notes"}`.

## What it does

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

Nothing is deleted. Nothing is committed: the owner's agent commits the
result, with the new AGENTS.md, in one pull request.

## What it refuses

The plan is refused when the folder is not a git repository root, has no
`specs/state.yaml`, has uncommitted changes under `specs/` (the tag would not
hold them), already has the tag or a `.specs`, or when a cited file would
move onto a file that exists. Apply checks all of these again. A file that
changed between the plan and the write is kept and listed in `kept`.

## What is left for the agent

- **The notes.** Each tracked file that still names `specs/` after the
  rewrite is a note: a citation of bigpowers' own state, a tool or a CI step
  that exists only for bigpowers, or a path built in code. Check what calls
  each one; drop it if it serves only bigpowers, or point it at the new place.
- **Paths built in code.** The scan reads text, so `join('specs',
  'state.yaml')` is not found. Preflight after the conversion finds what
  breaks.
- **AGENTS.md.** Run setup (`docs/SETUP.md`) and overwrite the old letter;
  setup moves it to `AGENTS.md.weftwork-old` first.
- Preflight must pass before and after, in the same pull request.
