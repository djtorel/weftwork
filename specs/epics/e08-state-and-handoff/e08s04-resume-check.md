# e08s04 — The engine checks the handoff against the repository at resume

**type:** feat
**risk:** P1
**context:** engine
**bcps:** 5
**epic:** e08 (State and handoff, B2)
**research story:** none (SYNTHESIS candidate epic B2; R12: stored state
goes stale, so resume checks it against the repository before the agent
acts on it [S12][S13])
**branch:** e08s04-handoff-check

## 1. Purpose

e08s03 has the engine write the `handoff` block of `specs/state.yaml`
with facts it measured: the branch to start on, the files the note names,
and the paths that were uncommitted at write time. Nothing reads those
facts back. A session that starts on the wrong branch, or in a tree that
changed since the note, acts on a stale note. This story adds the check:
it compares the block with the repository and answers whether the note
can be trusted. It closes the second half of the epic's `done_when`.

Decisions recorded at plan-work (2026-11-14). The owner took all seven
recommendations:

1. **Four answers.** `ready` (the block matches the repository), `stale`
   (something does not match), `unverifiable` (a block with no `branch`
   to check, or a key of the wrong type) and `missing` (no `handoff`
   block, or a null one). A `stale` answer lists every reason, not only
   the first.
2. **Stale means** one of: the current branch is not `handoff.branch`
   (a detached HEAD is not a branch, so it never matches); a path in
   `files` does not exist; a path is uncommitted now that the block did
   not list in `uncommitted`. `specs/state.yaml` is always left out. A
   path that was uncommitted at write time and is clean now is a note,
   not a reason.
3. **The check never writes.** GSD deletes its handoff after a good
   resume. Here an interrupted resume must not lose the note, and the
   next handoff replaces the block anyway.
4. **No commit hash is compared** (e08s03, decision 3: PRs are
   squash-merged, so a branch hash does not exist on `main`).
5. **Nothing calls the check in this story.** The entry command (e11) or
   a SessionStart hook calls the CLI later. A hook story is added only if
   the owner asks.
6. **Exit codes.** 0 for `ready`; 1 for `stale`, `unverifiable` and
   `missing`; 2 when the state file cannot be read or parsed, or the
   working directory is not in a git repository. Never 0 on a fault.
7. **A separate CLI.** `node src/resume-cli.ts`, no arguments, run
   anywhere in the repository (it finds the root as `handoff-cli.ts`
   does). One JSON line on stdout, a short text on stderr that names the
   next step. `handoff-cli.ts` stays the writer.

`files` and `uncommitted` are never compared with each other. `files`
paths are only checked for existence (`lstat`, a symlink is not
followed, as the writer does). The two `uncommitted` lists, then and now,
both come from `uncommittedPaths` with `--untracked-files=normal`, so an
untracked folder is `dir/` in both and they compare as text.

The check is meant for session start, before `kickoff-branch`. After
kickoff the current branch is the story branch, not the handoff branch,
so the check answers `stale`. That is correct, not a fault.

## 2. Zoom-out

- **`src/handoff.ts`** (e08s03). Purpose: write the `handoff` block.
  Callers: `src/handoff-cli.ts`. This story does not change it; the check
  reads what it writes.
- **`src/state-fields.ts`** (e08s02). Purpose: the fields the engine
  writes, and `readStateData`, which reads the state file with the
  writer's checks (inside the root, regular file, 1 MiB, one document).
  This story exports `readStateData` so the check reads the file the
  same way the writer does. Contract unchanged.
- **`src/tree.ts`** (e06, e08s03). Purpose: the git helpers (`gitOutput`
  with `core.fsmonitor=false`, `repositoryRoot`, `uncommittedPaths`).
  This story adds `currentBranch(cwd)`: the short name of the branch
  HEAD points to, or null on a detached HEAD, through the same helper.
  Reason for depth: there is one way to call git in this codebase, and
  the branch is a git fact like the others.
- **`src/resume.ts`** (new). Purpose: `resumeReport(handoff, facts)`,
  pure, like `liveReport` in `src/claude-live.ts`. Reason for depth: the
  rules of decisions 1 and 2 are testable without a repository only when
  they take facts, not paths.
- **`src/resume-cli.ts`** (new). Thin shell: finds the root, reads the
  state file, gathers the facts, prints.

`assess-impact` is not run as a separate skill. The two changed modules
gain one export each and keep their contracts; their suites cover them.

## 3. Requirements

#### ADDED: the resume report, `src/resume.ts`

- `resumeReport(handoff, facts)` takes the value of the `handoff` key
  (`undefined` when the key is absent) and the facts: `branch` (text, or
  null for a detached HEAD), `uncommitted` (paths now, without
  `specs/state.yaml`) and `exists(path)`. It returns `{ answer, reasons,
  notes, next_skill }`.
- `missing` when the handoff is `undefined` or null.
- `unverifiable` when it is not a mapping, has no `branch`, or `branch`,
  `files` or `uncommitted` has the wrong type (text; list of text; list
  of text). A missing `files` or `uncommitted` is an empty list. The
  reason names the key.
- Otherwise every fault of decision 2 is a reason, in a fixed order
  (branch, then files, then uncommitted paths, each list sorted). Any
  reason makes the answer `stale`; none makes it `ready`.
- A path in the block's `uncommitted` that is clean now gives a note.
- `next_skill` is the block's `next_skill` when it is text, else null.

#### ADDED: the current branch, `src/tree.ts`

- `currentBranch(cwd)` runs `git symbolic-ref --quiet --short HEAD`
  through `gitOutput`. Ok with the name, or with null on a detached HEAD;
  not ok outside a repository. Never rejects.

#### ADDED: the resume CLI, `src/resume-cli.ts`

- No arguments; any argument is a usage error, exit 2.
- Finds the repository root of the working directory, reads
  `specs/state.yaml` with `readStateData`, gathers the facts and prints
  the report as one JSON line on stdout, plus a short text on stderr:
  the answer, the reasons, and the next step (`ready`: run the
  `next_skill`; `stale`: fix the repository or write a new handoff;
  `unverifiable` and `missing`: write a handoff with
  `node src/handoff-cli.ts`).
- Exit codes as decision 6. The state file is never written.

#### MODIFIED: the AGENTS.md Architecture section

- **Before:** names the handoff writer and its CLI as the last engine
  modules.
- **After:** also names `resume.ts` and `resume-cli.ts`, and `docs/STATE.md`
  (section The handoff block) gives the check command.

## 17. Acceptance criteria (Gherkin)

```gherkin
Feature: The engine checks the handoff against the repository at resume

  # AC-e08s04-01
  Scenario: A matching block is ready
    Given a handoff on branch main naming a file that exists
    And the paths uncommitted now are the ones the block lists
    When the report is made on branch main
    Then the answer is ready with no reasons

  # AC-e08s04-02
  Scenario Outline: One fault makes the block stale
    Given a matching handoff
    When <fault>
    Then the answer is stale
    And the one reason names <named>
    Examples:
      | fault                                      | named          |
      | the current branch is another branch        | both branches  |
      | HEAD is detached                            | the branch     |
      | a file in files does not exist              | the file       |
      | a path is uncommitted that the block lacks  | the path       |

  # AC-e08s04-03
  Scenario: Two faults give two reasons
    When the branch differs and a named file is gone
    Then the answer is stale with two reasons, branch first

  # AC-e08s04-04
  Scenario: A path that was uncommitted and is clean now is a note
    Given a handoff that lists a path as uncommitted
    When that path is clean now
    Then the answer is ready
    And one note names the path

  # AC-e08s04-05
  Scenario Outline: A block that cannot be checked
    When the handoff is <block>
    Then the answer is <answer>
    Examples:
      | block                         | answer       |
      | absent                        | missing      |
      | null                          | missing      |
      | a mapping with no branch      | unverifiable |
      | a mapping whose files is text | unverifiable |
      | a list                        | unverifiable |

  # AC-e08s04-06
  Scenario: The current branch
    Given a test repository on branch main
    Then currentBranch gives main
    When HEAD is detached
    Then currentBranch gives null

  # AC-e08s04-07
  Scenario Outline: The CLI after a real handoff write
    Given a test repository with a handoff written by the handoff CLI
    When <change>
    And the resume CLI runs
    Then it exits <code> with answer <answer>
    And specs/state.yaml is the same bytes
    Examples:
      | change                          | code | answer |
      | nothing                         | 0    | ready  |
      | another branch is checked out   | 1    | stale  |
      | a named file is deleted         | 1    | stale  |
      | an untracked file is added      | 1    | stale  |

  # AC-e08s04-08
  Scenario Outline: The CLI faults
    Given <setup>
    When the resume CLI runs
    Then it exits <code>
    Examples:
      | setup                                      | code |
      | a state file with no handoff key           | 1    |
      | a state file that is not YAML              | 2    |
      | no state file                              | 2    |
      | a directory that is not a git repository   | 2    |
      | an argument on the command line            | 2    |
```

## Steps

1. RED then GREEN (ref: §1 decisions 1, 2, 4): write `src/resume.test.ts`
   for AC-01 to AC-05 and record the failure; then write `src/resume.ts`
   → verify: `node --test src/resume.test.ts && npm run typecheck`
2. RED then GREEN (ref: §1 decisions 3, 6, 7): write the
   `currentBranch` tests in `src/tree.test.ts` (AC-06) and
   `src/resume-cli.test.ts` (AC-07, AC-08) and record the failure; then
   add `currentBranch`, export `readStateData` and write
   `src/resume-cli.ts` → verify: `node --test src/tree.test.ts
   src/resume.test.ts src/resume-cli.test.ts && npm run typecheck`
3. Name the check in the AGENTS.md Architecture section and in
   `docs/STATE.md`, then run Preflight (ref: §3 MODIFIED) → verify:
   `grep -q 'resume-cli' AGENTS.md && grep -q 'resume-cli' docs/STATE.md
   && yamllint specs && bash tools/validate-specs-yaml.sh && bash
   tools/check-gate-ignores.sh && npm run typecheck && npm test`

Red-flag check: I caught two. First, I nearly matched `files` against
`uncommitted` with slash rules; decision 2 never compares those two
lists, so that code would have no fault to answer. Second, I nearly
added a staleness limit on `written_at`; it was declined in e07 and no
fault here asks for it.

## 4. Dependencies (slopcheck)

- No new package. `yaml` 2.9.1 `[OK]` (e08s01) parses the state file.

## 5. Out of scope

- Calling the check from a host, a skill or a SessionStart hook
  (decision 5; e11).
- Writing or clearing the handoff from the check (decision 3).
- A commit hash, or an age limit on `written_at`.
- The e08s03 review notes left for later.

## 6. Risks

- **A false `ready` is the costly fault.** An agent trusts the note and
  acts on a changed tree. Every fault path exits non-zero, and a block
  that cannot be read is `unverifiable` or exit 2, never `ready`
  (AC-05, AC-08).
- **The check reads git through the same helper.** `git status` runs a
  clean filter named in `.git/config`; that is accepted risk A1, owned
  by e10, as for the writer.
- **Hand-written older blocks.** A block without `uncommitted` is read as
  having none, so any dirty path makes it stale. That errs toward
  `stale`, not `ready`.
