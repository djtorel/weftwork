# Parallel work

<!-- story: B8 -->

When two agents change the same file at the same time, their changes
often do not merge. In one study, replayed three-way merges of concurrent
pull requests that agents wrote conflicted in 19.8% of same-agent pairs
and 41.7% of cross-agent pairs (R6). The tools R6 read give each parallel
task a list of the files it will change, but they check the lists by hand
or by planner convention, not mechanically (R6, H12). R6 recommends a
mechanical file-overlap check before parallel dispatch: it is cheap and
deterministic.

This is the first part of backlog item B8. The overlap check is built.
Engine-created worktrees and an integrator that runs the verify commands
again on the merged result are not built yet (below).

## The overlap check

Give each planned task a name and the files it will change, or the git
branch that holds its change. The check reports each pair of tasks that
can change the same file.

```bash
echo '{"tasks":[{"name":"a","files":["src/a.ts"]},{"name":"b","files":["docs/*.md"]}]}' | node src/overlap-cli.ts
```

| Field | What it is |
| --- | --- |
| `tasks` | Two or more tasks. Each has a unique `name`, and `files` or `branch`, not both. |
| `files` | Paths, folders and globs from the repository root. A trailing `/` marks a folder: everything below it. `./` and doubled `/` are removed. An absolute path, a path with `..` that leaves the project, the root itself, and a negated glob (`!x`) are refused. |
| `branch` | A git branch. Its files are the files `git diff --name-only <merge base>..<branch>` lists, where the merge base is `git merge-base <base> <branch>`. Renames count as a delete and an add, so both names are listed. |
| `base` | Where a branch task's merge base is taken from. Optional; `HEAD` by default. |

The answer is one JSON line:

```json
{"result":"overlap","pairs":[{"tasks":["a","b"],"files":[["src/**","src/b.ts"]]}]}
```

Each pair names the two tasks and each pair of their entries that
overlaps, in the order the tasks were given.

| Exit | Result |
| --- | --- |
| 0 | `clear`: no two tasks overlap. |
| 1 | `overlap`: the pairs that do. Do not run them at the same time. |
| 2 | The check cannot run: bad input, or git cannot read a branch. The reason is on stderr. |

## When two entries overlap

| Entries | Overlap when |
| --- | --- |
| Two paths | They are the same, or one is inside the other (then the outer one is a folder). |
| A path and a glob | The glob matches the path, or the glob's fixed folder is inside the path. A glob also matches names that start with a dot: `**/*.yml` matches `.github/ci.yml`. |
| A path and a folder | The path is the folder, inside it, or holds it. |
| Two globs or folders | Their fixed folders nest, and the fixed end of one last segment ends with the other's. `src/*.ts` and `src/x/**` overlap; `src/*.ts` and `docs/*.md` do not; `src/*.ts` and `src/*.md` do not. |

Globs are those that Node's `path.matchesGlob` takes, extended globs such
as `src/+(a|b).ts` included. The fixed folder of a glob is the part before its first glob segment
(`src` for `src/**/*.ts`). The check is conservative: a pair it reports
may not conflict, and apart from the two limits below it does not miss two
entries that can name the same file. A false report costs only running two
tasks one after the other; a miss costs a merge conflict. The two limits:

- A glob names files. When a glob may name a folder (`src/*`), and another
  task changes a file inside that folder, write the folder in the first
  task with a trailing `/`.
- A plain path is a file unless another entry is inside it. When another
  task's glob may reach inside it, write it with a trailing `/`.

A clear answer does not show that the tasks are independent. Tasks that
change different files can still conflict in meaning, for example through
a shared type, and R6 found no source that tests disjoint file lists
directly (R6, H12). The integrator (below) is the check for that.

## Not built yet

These are open in the backlog under B8:

- **Engine-created worktrees.** The engine makes one worktree per parallel
  task. The guard (`docs/GUARD.md`, `docs/ASK.md`) blocks an Edit or Write
  outside the worktree of the hook's project folder
  (`$CLAUDE_PROJECT_DIR`). So today an agent cannot edit files in any other
  worktree, also one the engine made for it. This part must solve that,
  for example by starting each task's agent with its own worktree as the
  project folder.
- **The integrator.** It merges the tasks' branches and runs the verify
  commands again on the merged result, because a clean merge does not show
  a correct result (R6).
- **A coupling check.** R6 also suggests a check for shared imports or
  types where the stack allows it.

## Sources

- `docs/research/R6-multi-agent-codebase.md`: hypothesis H12, the
  recommendation to make the overlap check mechanical, and the conflict
  rates from replayed merges.
