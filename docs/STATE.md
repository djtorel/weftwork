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
`uncommitted` lists an untracked folder as git does (`build/`). The resume
check never compares the two lists, so the forms do not meet.

## Checking the handoff at resume

At session start, before `kickoff-branch`, check the block against the
repository with `resumeReport` in `src/resume.ts`:

```bash
node src/resume-cli.ts
```

It prints one JSON line on stdout, `{"ok":true,"answer":...,"reasons":[...],
"notes":[...],"next_skill":...}`, or `{"ok":false,"error":...}` when it cannot
run, and the next step on stderr. It never writes. The answer is one of:

| Answer | Meaning | Exit |
| ------ | ------- | ---- |
| `ready` | the branch, the named files and git status match the block | 0 |
| `stale` | HEAD is not on `branch` (another branch, detached, or a ref outside `refs/heads/`), a path in `files` is not found inside the repository, or a path is uncommitted now that `uncommitted` does not list; every reason is listed | 1 |
| `unverifiable` | the block is not a mapping, has no `branch`, `files` or `uncommitted`, or one of them is null or of the wrong type | 1 |
| `missing` | the state file has no `handoff` block | 1 |

A path that `uncommitted` lists and that git status no longer lists is a
note, not a reason.

`ready` means the same paths are uncommitted, not the same content. It
sees only what `git status` lists. It cannot see a new file inside an
untracked folder that `uncommitted` already lists (`out/`), more edits to
a file that was already uncommitted, ignored files, files marked
`assume-unchanged` or `skip-worktree`, a submodule set to `ignore = all`,
or commits made on the branch since the handoff. It does not check the
note or `next_skill`.

`specs/state.yaml` is always left out. Exit 2 means the check could not
run: an argument was given, the working directory is gone or not in a git
repository, git failed, or the state file cannot be read. After
`kickoff-branch` the branch is the story branch, so the check answers
`stale`; that is expected.

Every CLI line on stdout and the check's stderr text write control
characters, bidi controls and line separators as `\uXXXX`
(`terminalSafe` in `src/cli-io.ts`).
