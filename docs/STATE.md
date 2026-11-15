# State file fields

The engine keeps its state in `<git dir>/weftwork/state.yaml`, next to its
ledger (`weftworkDir` in `src/ledger.ts`). The file is untracked and local:
each worktree has its own, because a linked worktree has its own git dir
(`git rev-parse --absolute-git-dir` names it). Nothing in it is shared
through the repository; the pull request is the shared record of a task.

The engine creates the file, with every field null, the first time a CLI
writes to it. Reading a missing file gives every field null and creates
nothing. The engine writes only the fields marked `engine`, through
`setStateField` in `src/state-fields.ts`. It refuses every other key and
keeps any other key in the file byte for byte. Each engine field is text or
null, on one line, of 200 characters or fewer. The engine does not check id
patterns or phase names.

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
| `handoff` | mapping | engine (handoff CLI) |

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
| `uncommitted` | engine | `git status` paths at write time, sorted; an untracked folder is one entry, `dir/` |

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

At session start, check the block against the repository with
`resumeReport` in `src/resume.ts`:

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
| `missing` | there is no state file, or it has no `handoff` block, or a null one | 1 |

A path that `uncommitted` lists and that git status no longer lists is a
note, not a reason.

`ready` means the same paths are uncommitted, not the same content. It
sees only what `git status` lists. It cannot see a new file inside an
untracked folder that `uncommitted` already lists (`out/`), more edits to
a file that was already uncommitted, the deletion of a file that was
already uncommitted, ignored files, files marked `assume-unchanged` or
`skip-worktree`, a submodule set to `ignore = all`,
or commits made on the branch since the handoff. It does not check the
note or `next_skill`. `files` is the only existence check, so name in it
every path the note relies on.

The state file is outside the working tree, so git status never lists it.
Exit 2 means the check could not run: an argument was given, the working
directory is gone or not in a git repository, git failed, or the state file
is there but cannot be read. After the next task's branch is made, the
check answers `stale`; that is expected.

Every CLI line on stdout and the check's stderr text write control
characters, bidi controls and line separators as `\uXXXX`
(`terminalSafe` in `src/cli-io.ts`).
