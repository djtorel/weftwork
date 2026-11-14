# State file fields

`specs/state.yaml` holds the workflow state of this repository. The engine
writes only the fields marked `engine`, through `setStateField` in
`src/state-fields.ts`. It refuses every other key and keeps it byte for
byte. Each engine field is text or null, on one line, of 200 characters or
fewer. The engine does not check id patterns or phase names.

Read and set the engine fields with the state CLI:

```bash
echo '{"op":"get"}' | node src/state-cli.ts
echo '{"op":"set","key":"active_story","value":"e08s02"}' | node src/state-cli.ts
```

| Key | Type | Written by |
| --- | ---- | ---------- |
| `active_flow` | text or null | engine |
| `active_epic` | text or null | engine |
| `active_story` | text or null | engine |
| `phase` | text or null | engine |
| `vcs.branch` | text or null | engine |
| `vcs.kind` | text | owner |
| `workflow_mode` | text | owner |
| `test_plan` | text | owner |
| `handoff` | mapping | engine (handoff CLI) |
| `waivers` | list | owner |
| `metrics` | mapping | global scripts (`bp-timing.sh`) |

A test (`src/state-fields.test.ts`) fails when the `engine` rows of this
table and `stateFields` in the code differ. The `handoff` row is not one
of them: the state CLI refuses `handoff.*`, and only the handoff CLI
writes the block.

## The handoff block

The engine writes the whole `handoff` block for a session that remembers
nothing, through `writeHandoff` in `src/handoff.ts`:

```bash
echo '{"next_skill":"verify-work","branch":"e08s03-handoff-note","note":"..."}' | node src/handoff-cli.ts
```

| Key | Given by | Rule |
| --- | -------- | ---- |
| `next_skill` | caller, required | one line, not empty or only whitespace, 200 characters or fewer |
| `branch` | caller, required | the branch the next session starts on; one line, not empty or only whitespace, 200 characters or fewer |
| `note` | caller, required | 1 to 4000 characters, not only whitespace; a longer note is refused, not cut |
| `next_epic` | caller, may be null | one line, not empty or only whitespace, 200 characters or fewer |
| `next_story` | caller, may be null | one line, not empty or only whitespace, 200 characters or fewer |
| `files` | caller, may be empty | relative paths in normal form that the note names, each once; each must exist in the repository (a symlink is named, not followed) |
| `written_at` | engine | the write time, UTC, to the second |
| `uncommitted` | engine | `git status` paths at write time, sorted, without `specs/state.yaml`; an untracked folder is one entry, `dir/` |

The engine ignores `written_at` and `uncommitted` from the caller and
refuses any other key. A file in the working tree whose name holds a
character PyYAML cannot read (a control character, NEL, LS, PS, U+FFFE or
U+FFFF) makes the write fail with an error that names it; rename or remove
the file. No commit hash is kept, because PRs are squash-merged and a
branch hash does not exist on `main`.

`files` names a folder without a trailing slash (`build`), while
`uncommitted` lists an untracked folder as git does (`build/`). A check
that compares the two lists (e08s04) must allow for that.
