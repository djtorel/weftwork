---
name: convert-project
description: Use when the user asks to convert a project from bigpowers (a specs/state.yaml) or GSD (a .planning/ folder) to weftwork.
---

# Convert Project

Move a bigpowers or GSD project the user names onto weftwork, in one pull request.
Never read another project without the user's say-so: the folder they name is
that say-so. `docs/CONVERT.md` has the details.

1. **Branch and check.** In the project, start a feature branch from an
   up-to-date main and run its Preflight. It must pass before you start.
2. **Show the plan.** Run, from this repository,
   `echo '{"path":"<folder>"}' | node src/convert-cli.ts`. Show the user the
   tag, every move, every change with its `diff`, and the `notes`. Change
   nothing yet. A folder with both needs `"system":"bigpowers"` or `"gsd"`.
3. **Ask once** whether to apply it. Apply only on a yes: the same request
   with `"apply":true`. Report `tag`, `moved`, `written` and `kept`.
4. **Work the notes.** For each file that still names `specs/` (GSD:
   `.planning/`), check what calls it. Drop a tool or CI step that exists only
   for the old system; point the rest at the new place. Carry the decisions a
   note names into AGENTS.md or `docs/`. Run Preflight and fix what the move broke.
5. **New AGENTS.md.** Use the `setup-project` skill on the same folder, and
   overwrite the old AGENTS.md (it is moved aside, not deleted).
6. **One pull request** with the moves, the rewrites and the new letter, and
   Preflight green. Its body names the tag and how to undo:
   `git tag -d <tag>` and a revert of the pull request.
