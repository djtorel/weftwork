# Local history

weftwork can keep a record of each task on your machine. It uses the record to
show the failures that keep coming back, so you can fix them one at a time.
Nothing is sent anywhere. History is off until you turn it on.

The design follows the evidence in
[R20](research/R20-self-improvement.md):

- Learn only from outcomes the engine saw.
- Propose small changes and let the owner accept them.
- Never let the agent change what measures it.
- Do not claim an overall gain that a few tasks cannot show.

## Turn it on

Set `history` in `weftwork.yaml`, or in `~/.config/weftwork/config.yaml` for
every project. The repository file wins.

```yaml
---
history: local
```

| Value | Effect |
| --- | --- |
| `off` (the default) | A record request does nothing and says how to turn history on |
| `local` | Each filed task adds one record to the history file |

The agent cannot turn history on or off. The guard keeps it out of both
files (`docs/GUARD.md`).

## The record

The `pr-it` skill records the task when it files the pull request:

```bash
echo '{"record":true,"model":"<model id>"}' | node src/history-cli.ts
```

The engine counts the record from its own ledger. It counts the lines
written since the branch began, which is the oldest reflog entry of the
branch, and only the review rounds of this branch. A record holds counts and
names only. It holds no command text, no transcript and no code:

| Field | From |
| --- | --- |
| `runs`, `failures`, `longestFailStreak` | Gate runs (`docs/BUDGET.md`) |
| `stops` | Stop states other than done, and overrides by kind |
| `guards` | Guard blocks, by the file or name that was protected |
| `rounds`, `reviewCeiling`, `noVerdictRounds`, `reviewerFailedRounds` | Review rounds (`docs/REVIEW.md`) |
| `taskSeconds`, `gateSeconds`, `repeatRuns`, `repeatSeconds`, `reviewSeconds` | The time of the task, its gate runs and its review rounds (below, Time) |
| `designRounds`, `designSeconds`, `designNoVerdictRounds` | The rounds of the branch's design loops (`docs/DESIGN-LOOP.md`) |
| `reviewers` | Each reviewer's runs, answers and seconds, over the review and design rounds |
| `branch`, `head`, `at` | Git and the clock |
| `model` | The agent's claim, used only to say when to re-check a change |

Finding outcomes and decisions are left out, because they are the agent's
own account.

The file is `<common git dir>/weftwork/history.jsonl`, next to the backlog.
A linked worktree's own git dir is deleted with the worktree; the common dir
stays. If a task is filed again, its new record replaces the old one in the
report.

## The report

```bash
echo '{}' | node src/history-cli.ts
echo '{"min_tasks":5}' | node src/history-cli.ts
```

The report lists each failure class that is found in at least `min_tasks`
tasks (3 by default, 2 to 50), the most common first, with the branches it
was found on. A class is a signal to look into, not proof.

| Class | A task has it when |
| --- | --- |
| `gate:failed` | A gate run failed |
| `gate:streak` | One command failed 3 times in a row |
| `stop:<state>` | The run stopped `blocked`, `stalled`, `exhausted` or `killed`, or was overridden |
| `guard:<name>` | The guard blocked a change to `<name>` |
| `review:second-round` | The review needed a second round |
| `review:ceiling` | The last round hit the ceiling without a pass |
| `review:no-verdict` | A review round gave no verdict: every reviewer failed, or the tree changed |
| `review:reviewer-failed` | A reviewer failed, was out of usage, timed out or was stopped as slow in a review round. The round may still have had a verdict from another reviewer. One that was not needed or not asked did not fail |

A record has a version, `history`. Version 1 records, from before the
history counted time, hold one number for both review classes, so the report
gives them `review:reviewer-failed` only. For a change that targets
`review:no-verdict`, the tasks from before version 2 show no case.

## Time

The engine writes how long each gate run took on its run line, and how long
each review and design round and each of its reviewers took on the round's
line (`docs/REVIEW.md` § The round). A record sums them, in whole seconds:

| Field | What it is |
| --- | --- |
| `taskSeconds` | From the branch's start (its oldest reflog entry) to the record. It holds the time the task waited for the owner too. Null with no reflog |
| `gateSeconds` | The gate runs since the branch began |
| `repeatRuns`, `repeatSeconds` | The gate runs on a tree that had already passed the same command. The pass before them was the answer, so this time bought nothing new: a Stop hook run after the agent's own pass (the hook reuses only its own passes, `docs/BUDGET.md`), or a run made again before filing |
| `reviewSeconds` | The review rounds of the branch |
| `designRounds`, `designSeconds`, `designNoVerdictRounds` | The design rounds of the branch, their time, and those with no verdict |
| `reviewers` | For each reviewer name: how often it ran, how often it answered, and its seconds |

The report gives the median of each over the tasks that recorded time, and
each reviewer's share of answers and mean time of a run:

```text
Time, the median of the 12 tasks that recorded it:
- a task, from its branch to its record: 48 min
- gate runs: 9 min, 3 min of it on a tree that had already passed
- review rounds: 7 min
- design rounds: 12 min, in the 4 tasks with a design loop
Reviewers, in those tasks:
- agy: 14 runs, 12 answered, 402 s a run
- claude: 9 runs, 9 answered, 188 s a run
```

Use it to choose the order of `review.reviewers`, `review.slow_seconds` and
`design.panel` from your own tasks. A task from before this version has no
time and is left out of this part.

Exit 0 when it recorded, reported or found history off. Exit 2 when it
cannot, for example because of bad input, a bad setting or register, a
detached HEAD, or a file it cannot read or write. The reason is on stderr.

## From a class to a fix

The `retro` skill reads the report, takes the most common class and
proposes one change for it, in its own pull request:

- Prefer a check (a test, a lint rule, a Preflight step, a hook) over a
  sentence. If it must be a sentence, write one narrow prohibition.
- Never write or rewrite a whole `CLAUDE.md`, `AGENTS.md` or skill. Never
  change the gate, the ledger, the guard, the history code or the
  settings.
- A check's test must fail on the base (`docs/BASE-CHECK.md`), and
  Preflight must pass.
- The pull request adds one entry to `weftwork-improvements.yaml` at the
  root:

```yaml
---
improvements:
  - id: typecheck-first
    targets: gate:failed
    accepted: 2026-11-20
    change: Run the typecheck before the tests in Preflight
    model: claude-opus-5-5
```

Your merge accepts the change. Reverting the merge removes both the change
and its entry.

For each entry, the report counts the targeted class in the tasks before and
after the `accepted` day. It also gives a one-sided Fisher exact p: the
chance of seeing so few cases after the change if the change did nothing.

| Label | When |
| --- | --- |
| `too few tasks since`, `too few tasks before` | Fewer than 5 tasks on that side |
| `more` | The class is more common since the change |
| `fewer` | Less common, with p below 0.05 |
| `no clear change` | Anything else |

The report adds "the model changed since, so re-check it" when a later
record names another model than the entry. A change that helped one model
can hurt another.

## Limits

- One owner's tasks show only large effects. With 10 tasks before and 10
  after, a class must fall from about 6 to 1 to reach p < 0.05. The report
  counts; it never gates and never proves an overall gain.
- The ledger and the history file are in the git dir, where the agent can
  write (`docs/GUARD.md`, T3). The guard blocks Bash text that names the
  engine folder, and the worktree trigger blocks a file tool that writes
  outside a linked worktree. A path built at run time can still get
  through. Every field is checked on read, and names are cut to safe
  characters.
- The agent can skip the record. A skipped task is missing from the
  history, not falsely recorded.
- The report reads the last 1 MiB of the file, about 2,500 records. Nothing
  prunes it yet.
- CI results and what the owner merged or closed are not recorded yet.
  They are the strongest signals, and they need GitHub.
