# The reviewers

<!-- story: e11s03, e13s02, e13s03, e13s05 -->

Before a pull request, a reviewer model reads the change: by default Gemini
Neon, with Codex (GPT Sol) and then Claude Opus standing in when it fails,
and all three for a sensitive change or a full panel (below). The
engine runs the reviewers, reads their findings and counts the rounds, so
the round ceiling does not depend on the agent's prose. The `second-opinion`
skill calls it.

```bash
echo '{"command":"npm test","brief":"Review only. ..."}' | node src/review-cli.ts
```

| Field | What it is |
| --- | --- |
| `command` | The verify command, the exact string the engine ran. The reviewers run only when the done gate passed for it on this tree (`docs/PR-PROOF.md`). |
| `brief` | What the reviewers read: the repository, the base, the intent, what is out of scope, the checks run. The engine adds the audit checklist and the reply format after it. |
| `base` | The commit the change is measured from, for the UI check (`docs/UI.md`), the diff size and `sensitive_paths`. Optional; by default the merge base of `HEAD` with `origin/HEAD`, `origin/main` or `main`. |
| `sensitive` | `true` for a change to security, permissions, auth, data loss or concurrency: the ceiling is then `max_rounds_sensitive`, and every reviewer answers (the panel). Optional, `false` by default. `sensitive_paths` can also set it, from the files. |
| `panel` | `"all"` or 1 to 5: how many reviewers must answer this round. It can raise `review.panel`, never lower it. The `second-opinion` skill sends `"all"` when the owner asks for a full panel. Optional. |

## The setting

A `review` mapping in the same two files as the budget (`docs/BUDGET.md`):
`weftwork.yaml` at the repository root wins over the user file, key by key.
The guard blocks the agent from editing either file (`docs/GUARD.md`).

```yaml
---
review:
  reviewers:
    - codex exec --ignore-user-config --sandbox read-only --ephemeral ${WEFTWORK_IMAGES:+--image "$WEFTWORK_IMAGES"} -
    - claude -p --model sonnet --setting-sources "" --tools Read,Grep,Glob,Bash --permission-mode dontAsk ${WEFTWORK_IMAGES_DIR:+--add-dir "$WEFTWORK_IMAGES_DIR"}
  panel: 1
  max_rounds: 3
  max_rounds_sensitive: 5
  timeout_seconds: 1200
  slow_seconds: 300
  sensitive_paths:
    - src/guard*.ts
```

| Key | What it is | Range | Built-in |
| --- | --- | --- | --- |
| `reviewers` | Reviewer commands in the order a round tries them, for example `codex exec`, `claude -p` or `gemini -p`, each in its read-only mode (`docs/UI.md` gives `claude -p`, `agy -p` and `gemini -p` entries that also get the screenshots). A file's list replaces the list before it whole. | 1 to 5 | Gemini Neon, Codex, Claude Opus, each read-only (below) |
| `panel` | How many reviewers must answer a round; the next in the list stands in for one that fails (below, The panel) | 1 to 5 | 1 |
| `max_rounds` | Rounds on one branch | 1 to 10 | 3 |
| `max_rounds_sensitive` | Rounds on one branch for a `sensitive` change | 1 to 10 | 5 |
| `timeout_seconds` | Time for one reviewer | 1 to 3600 | 1200 |
| `slow_seconds` | A reviewer with no reply after this long is slow: the next in the list starts as its stand-in (below, A reviewer with no usage). Set it to `timeout_seconds` to turn the rule off | 1 to 3600 | 300 |
| `sensitive_paths` | Glob patterns (as `ui.paths`); a change to a matching file gets `max_rounds_sensitive` whatever the brief says (R19: the change sets the tier, not the author). The files are compared with the default base, never the `base` in the request, so a base of `HEAD` cannot hide a committed change | 1 to 100 patterns | none |

A file that cannot be used stops the review with exit 2, under the same
file rules as the budget. An unknown key under `review` is an error.

## The built-in reviewers

With no `review.reviewers`, these three are the list, in this order, one
from each model family. Opus is last because the owner writes code with
Opus, and a review gains most from a model of another family; it answers
when the other two fail, or when a round needs all three:

```bash
agy --model gemini-4-neon-high --mode plan --settings '{"permissions":{"deny":["command(*)","write_file(*)","read_url(*)","execute_url(*)","mcp(*)"]}}' ${WEFTWORK_IMAGES_DIR:+--add-dir "$WEFTWORK_IMAGES_DIR"} ${WEFTWORK_DIFF:+--add-dir "${WEFTWORK_DIFF%/*}"} -p "$(cat)"
codex exec --ignore-user-config --sandbox read-only --ephemeral ${WEFTWORK_IMAGES:+--image "$WEFTWORK_IMAGES"} -
claude -p --model opus --effort high --setting-sources "" --tools Read,Grep,Glob,Bash --permission-mode dontAsk ${WEFTWORK_IMAGES_DIR:+--add-dir "$WEFTWORK_IMAGES_DIR"}
```

| Reviewer | CLI | Model | Read-only by |
| --- | --- | --- | --- |
| `agy` | Antigravity CLI | Gemini 4 Neon, high effort | Deny rules on every shell command, file write, URL and MCP tool, over the user's settings; `plan` mode |
| `codex` | Codex CLI | Codex's default, GPT Sol (`gpt-6.2-sol` on 2026-11-21) | `--sandbox read-only`, no user config |
| `claude` | Claude Code | Opus (the `opus` alias for the latest), high effort | Read tools and Bash only, `dontAsk`, no settings files |

Claude and Codex run with the user's own settings off. agy has no way to
skip them, so its deny rules, which win over any rule there, keep it
read-only. `docs/UI.md` gives how each was checked and what agy can still
do (web search). To change the model, the effort or the order, set
`review.reviewers` (and `design.reviewers` for the design loop only);
`agy models` lists the Antigravity models.

## The panel

A round asks the reviewers in the list's order until `panel` of them have
answered, at most 2 at once. A reviewer that fails (its CLI not installed,
signed out or out of quota, a timeout, a reply with no `VERDICT:` line) is
replaced by the next in the list at once, also while another reviewer still
runs; the report shows it with the reason, and it counts as neither a pass
nor a block. The ones after the panel is full do not run. A round never
waits for a reviewer's usage to come back (below, A reviewer with no
usage). With the built-in list and a panel of 1, Gemini reviews; when it
fails, Codex; when that fails too, Opus. A panel of 2 is Gemini and Codex. When every reviewer failed, the
round has no verdict (exit 3).

How many must answer:

| Round | Panel |
| --- | --- |
| Routine | `review.panel`, 1 by default |
| Sensitive (`sensitive` in the request, or a `sensitive_paths` match) | Every reviewer |
| A request with `panel` (`"all"`, or a number above `review.panel`) | That many; the owner's "Full panel" in the `second-opinion` skill sends `"all"` |

The report says which in a `panel:` line, such as
`panel: 1 of 3 reviewers (review.panel)`. One reviewer is the default, and
more only where it pays: R19 found false alarms the common failure of AI
review and advised against a three-provider review of every change; the
owner chose three for every design round (`docs/DESIGN-LOOP.md`).

A later round on the same branch asks first the reviewers that answered the
round before (the ledger keeps their names), so the reviewer that raised a
must-fix checks whether it is resolved; the others follow in list order. A
reviewer is known by its name, the first word of its command, so two
entries of one CLI share it.

## A reviewer with no usage

A round goes on with the reviewers that can answer. It does not wait for one
that cannot:

- **Out of usage.** A reviewer that fails and whose last output names a
  usage limit (`usage limit`, `rate limit`, `quota`, `429`, `limit reached`
  and the like) is reported as `failed, out of usage: <its line>`, and the
  next in the list starts at once.
- **Slow.** A reviewer with no reply after `slow_seconds` (300) is slow: it
  runs on, and the next in the list starts as its stand-in when one of the 2
  places is free. When the panel has answered, the reviewers still running
  are stopped. With no stand-in left, a slow reviewer is stopped once another
  reviewer has answered and it has run twice as long as the slowest one that
  answered. So a hung reviewer costs about `slow_seconds`, not
  `timeout_seconds`. While no reviewer has answered, a slow one runs on to
  `timeout_seconds`, since it is the only verdict there can be.
- **Resting.** A reviewer that was out of usage, timed out or was stopped as
  slow rests for 60 minutes: later rounds, on any branch and in any worktree
  of the clone, do not ask it, and the report shows it as `not asked,
  resting until <time> (<why>)`. The record is
  `<git common dir>/weftwork/reviewers-resting.json`; delete it to ask every
  reviewer again. A reviewer that answers rests no more. When every
  reviewer rests, each is asked, since a round with no reviewer has no
  verdict.
- **Review again.** A round with fewer answers than its panel still stands:
  2 of 3, or Opus alone. Its report has a `review again:` line that names
  the reviewers that did not answer. The agent goes on, lists the line in
  the pull request, and adds a backlog line to review the change again with
  those reviewers.

The engine reads a usage limit only from what a failed reviewer printed
last (the end of its stderr and stdout), never from a reply. A CLI that
hangs with no message, or ends with exit 0 and no output, is caught by the
slow rule or as a reply with no `VERDICT:` line.

## A reviewer

Each command runs in a shell in the working directory, in its own process
group, with the brief and the reply format on stdin. Its stdout is the reply
(a reply larger than 1 MiB fails the reviewer, since a cut reply could drop
a must-fix). At most 2 reviewers run at once (AGENTS.md: never more
than 2 subagents at once), so in a panel of 3 the third starts as soon as
one of the first two ends.
When there is a base, the engine writes the change from the base to the
snapshot of the working tree, untracked files included, as a git diff in
`<git dir>/weftwork/review/change.diff`, names it in the brief and sets
`WEFTWORK_DIFF` to its path, for a reviewer that cannot run git (the
Gemini reviewer runs no shell command). For a UI change the brief holds the screenshots and
a design checklist, and `WEFTWORK_IMAGES` holds the image paths
(`docs/UI.md`). The engine asks for this format:

```text
VERDICT: APPROVE or CHANGES
MUST-FIX <file>:<line> <claim>. Fix: <suggestion>
SHOULD-FIX <file>:<line> <claim>. Fix: <suggestion>
FOLLOW-UP <file>:<line> <claim>. Fix: <suggestion>
```

A MUST-FIX is the intended case wrong, or a bug this change causes in any
file. A FOLLOW-UP is a real defect the change did not cause: it never
blocks, and the agent lists it in the PR and adds it to the backlog (R19:
most of a 50-round loop at Anthropic was findings on old code).

A reviewer fails when it exits non-zero, times out or is stopped as slow
(its whole process group is killed), does not start, or replies with no
`VERDICT:` line. A failed
reviewer counts as neither a pass nor a block, and the report says why. The
command must be read-only: give it its read-only mode (`--sandbox read-only`
for Codex). The engine checks the tree after the round. When it changed, the
round has no verdict.

## The audit

After the brief the engine adds the same checklist to every round, so a
thin brief cannot drop a check (R19: what Anthropic's and OpenAI's reviewers
look at):

1. Correctness: the intended case, the callers of what changed, error
   paths and edge cases the intent names.
2. Proof: a test for each behaviour change that would fail without it,
   and whether the brief's claims about checks match the repository.
3. Rules: the rule files at the repository root that exist (`AGENTS.md`,
   `CLAUDE.md`, `CONVENTIONS.md`, `REVIEW.md`, regular files only), a
   change that breaks one, and a doc the change makes out of date.
4. Scope: code, tests, options or guards the intent does not need.
5. Security, only for a sensitive change (`sensitive` or a
   `sensitive_paths` match): outside input reaching a shell, a path or a
   parser; traversal and symlinks; secrets; a check that fails open; a race
   between a check and its use.

The reviewer may run read-only commands, such as a focused test, to
confirm a finding (OpenAI found execution gave fewer false alarms, R19). A
finding it could not confirm is a should-fix. Whether a command runs
depends on the reviewer's sandbox: Codex's `read-only` sandbox stops any
command that writes a file.

## Grounding and later rounds

A must-fix blocks only when it starts with a `<file>:<line>` (in backticks
when the path has a space) that exists: a
file inside the repository (a symlink out of it does not count) with at
least that many lines. Any other must-fix becomes a should-fix, with the
reason after it, such as `[not grounded: line 9 is past the end of a.ts, 3
lines]` (R19: models are poor at telling a wrong review comment from a
right one, and teams ask for a file and line as evidence).

Before the reviewers run, the engine snapshots the working tree as a git
tree (tracked files, also those an ignore rule matches, and untracked
files that are not ignored, through its own index file, so the
repository's index is not touched) and logs it with the
round. From round 2 it adds to the brief the files changed since the last
round and the must-fix findings open after it, and asks for those only. A
new must-fix on a file that did not change since the last round, and that
no open finding named, is marked `[new, on a file unchanged since round
N]` in the report. It still blocks: it may be a caller the latest fix
broke. The round ceiling, not a rule on findings, ends the loop.

The report also shows the lines changed from the base (`git diff --numstat`
from the base to the snapshot) and, from round 2, the size at round 1. Past
twice round 1 and 200 lines more, a `diff growth:` line says to cut the diff
before the next round. That line is a report, not a gate (CONVENTIONS.md:
gates follow an observed failure). A round with `sensitive_paths` matched
or `sensitive` set says why in a `sensitive:` line.

## The round

| Exit | First line | Meaning | What to do |
| --- | --- | --- | --- |
| 0 | `weftwork review: pass` | No must-fix from any reviewer that answered | File the PR; list the should-fix findings in it |
| 1 | `weftwork review: block` | A must-fix | Fix it, pass the done gate again, review again |
| 3 | `weftwork review: no verdict` | Every reviewer failed, or the tree changed during the review | Fix the cause, or review with a fresh-context subagent and say so in the PR. Never wait for a reviewer's usage to come back |
| 4 | `weftwork review: not run` | The done gate has not passed for `command` on this tree, or the change touches `ui.paths` and there are no after screenshots of this tree, or a screenshot no longer matches its hash (`docs/UI.md`) | Run the engine first, or take the screenshots again |
| 5 | `weftwork review: exhausted` | The rounds on this branch reached the ceiling | Open the PR with the unresolved findings listed |
| 2 | none | Bad input, no git working tree, a detached HEAD, a bad setting file, a ledger it cannot read or write, a snapshot git cannot make, or no base when `base` or `sensitive_paths` needs one; the reason is on stderr | Fix the cause |

Only a must-fix blocks. A reviewer of a UI change may add a
`UI-SCORE: <0 to 10>` line; the report shows it, and it never gates
(`docs/UI.md`). A round that ran (exit 0, 1
or 3) adds one review line to the ledger, with the branch, the round, the
ceiling, the findings (at most 50 of each kind, 500 characters each), the
tree it reviewed, the lines changed from the base, the reviewers that
answered, how long the reviewers took in all (`seconds`) and each one's run
(`reviewers`: its seconds and how it ended: `answered`, `failed`, `usage`,
`timeout`, `slow`, `not-needed` or `not-asked`). The report has the same in
a `time:` line, such as `time: 402.4 s: agy 402.4 s, codex 99.6 s (not
needed)`, and the history sums it (`docs/HISTORY.md` § Time):

```json
{"at":"2026-11-15T12:00:00.000Z","review":"block","branch":"feat/x","round":1,"maxRounds":3,"mustFix":["(codex): a.ts:1 bad"],"shouldFix":[],"followUp":[],"failed":[],"tree":"4b825dc642cb6eb9a060e54bf8d69288fbee4904","diffLines":42,"answered":["codex"],"seconds":61.4,"reviewers":[{"name":"codex","seconds":61.4,"end":"answered"}]}
```

The rounds are counted per branch from the last 1 MiB of the ledger: the
highest round number logged there, so earlier rounds cut from the tail still
count. At the
ceiling no reviewer runs, and the answer shows the last round's findings
again, as the unresolved ones. On a detached HEAD there is no branch to
count the rounds on, so no round runs: exit 2 with the reason on stderr.
Check out a branch first. The stop rules and the counts of runs do not read
review lines.

## Finding outcomes

Each finding in a report has an id: `r<round>` then `m` (must-fix), `s`
(should-fix) or `f` (follow-up), then its place among that kind, counted
across reviewers in setting order, as the ledger stores them:

```text
must-fix r1m1 (codex): src/a.ts:12 the error path exits 0. Fix: return 1
```

The agent records what became of each finding, with its evidence:

```bash
echo '{"id":"r1m1","outcome":"fixed","evidence":"src/a.test.ts fails without the fix"}' | node src/review-outcome-cli.ts
echo '{"report":true}' | node src/review-outcome-cli.ts
```

| Outcome | When |
| --- | --- |
| `fixed` | The change now handles it; for behaviour, a test that fails without the fix |
| `disputed` | The finding is wrong; the evidence says why |
| `declined` | Real, but not worth doing in this change; it goes to the backlog |
| `follow-up` | A real defect this change did not cause; it goes to the backlog |

The id must name a finding the ledger holds for a round on the current
branch (at most 50 of each kind per round are stored). The line goes to
`<git dir>/weftwork/review-outcomes.jsonl`; the last outcome for an id
wins. `report` lists every finding of the branch with its outcome, or
`open`, and gives each reviewer's resolution rate: the share of its
must-fix and should-fix findings that were fixed (R19: Cursor's resolution
rate, OpenAI's comments that led to a code change). It measures the
reviewer over time, not the change, and never gates. Exit 0 recorded or
reported, 2 when it cannot (an unknown id, a bad outcome, no evidence).

## Limits

- The agent writes the brief and can set `sensitive`, so it can ask for the
  higher ceiling. It cannot raise either ceiling, and it cannot lower the
  ceiling a `sensitive_paths` match sets.
- A reviewer labels its own findings. It can call a change's bug a
  FOLLOW-UP, and the engine cannot tell; the author reads every finding.
- Grounding checks that the file and line exist, not that the claim is
  true.
- Outcomes are the agent's own record. A finding marked `fixed` that was
  not fixed is not caught here; the next round and the PR reviewer can.
- The reviewer commands come from the setting files, so a repository's
  `weftwork.yaml` can name any command for the review to run, as it can for
  the verify command through the Claude Code hook.
- The ledger is the guard's to protect (`docs/GUARD.md`). An agent that gets
  past the guard can delete review lines and reset the count (T3).
