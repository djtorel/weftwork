# The review council

<!-- story: e11s03 -->

Before a pull request, a council of reviewer models reads the change. The
engine runs the reviewers, reads their findings and counts the rounds, so
the round ceiling does not depend on the agent's prose. The `review-loop`
skill calls it.

```bash
echo '{"command":"npm test","brief":"Review only. ..."}' | node src/review-cli.ts
```

| Field | What it is |
| --- | --- |
| `command` | The verify command, the exact string the engine ran. The council runs only when the done gate passed for it on this tree (`docs/PR-PROOF.md`). |
| `brief` | What the reviewers read: the repository, the base, the intent, what is out of scope. The engine adds the reply format after it. |
| `base` | The commit the change is measured from, for the UI check (`docs/UI.md`). Optional; read only when `ui` is set. |
| `sensitive` | `true` for a change to security, permissions, auth, data loss or concurrency: the ceiling is then `max_rounds_sensitive`. Optional, `false` by default. |

## The setting

A `review` mapping in the same two files as the budget (`docs/BUDGET.md`):
`weftwork.yaml` at the repository root wins over the user file, key by key.
The guard blocks the agent from editing either file (`docs/GUARD.md`).

```yaml
---
review:
  council:
    - codex exec --ignore-user-config --sandbox read-only --ephemeral ${WEFTWORK_IMAGES:+--image "$WEFTWORK_IMAGES"} -
  max_rounds: 3
  max_rounds_sensitive: 5
  timeout_seconds: 1200
```

| Key | What it is | Range | Built-in |
| --- | --- | --- | --- |
| `council` | Reviewer commands, for example `codex exec`, `claude -p` or `gemini -p`, each in its read-only mode. A file's list replaces the list before it whole. | 1 to 5 | One Codex reviewer, read-only (another model family than Claude) |
| `max_rounds` | Rounds on one branch | 1 to 10 | 3 |
| `max_rounds_sensitive` | Rounds on one branch for a `sensitive` change | 1 to 10 | 5 |
| `timeout_seconds` | Time for one reviewer | 1 to 3600 | 1200 |

A file that cannot be used stops the review with exit 2, under the same
file rules as the budget. An unknown key under `review` is an error.

## A reviewer

Each command runs in a shell in the working directory, in its own process
group, with the brief and the reply format on stdin. Its stdout is the reply
(a reply larger than 1 MiB fails the reviewer, since a cut reply could drop
a must-fix). At most 2 reviewers run at once (AGENTS.md: never more
than 2 subagents at once). For a UI change the brief holds the screenshots and
a design checklist, and `WEFTWORK_IMAGES` holds the image paths
(`docs/UI.md`). The engine asks for this format:

```text
VERDICT: APPROVE or CHANGES
MUST-FIX <file>:<line> <claim>. Fix: <suggestion>
SHOULD-FIX <file>:<line> <claim>. Fix: <suggestion>
```

A reviewer fails when it exits non-zero, times out (its whole process group
is killed), does not start, or replies with no `VERDICT:` line. A failed
reviewer counts as neither a pass nor a block, and the report says why. The
command must be read-only: give it its read-only mode (`--sandbox read-only`
for Codex). The engine checks the tree after the round. When it changed, the
round has no verdict.

## The round

| Exit | First line | Meaning | What to do |
| --- | --- | --- | --- |
| 0 | `weftwork review: pass` | No must-fix from any reviewer that answered | File the PR; list the should-fix findings in it |
| 1 | `weftwork review: block` | A must-fix | Fix it, pass the done gate again, review again |
| 3 | `weftwork review: no verdict` | Every reviewer failed, or the tree changed during the review | Fix the cause, or review with a fresh-context subagent and say so in the PR |
| 4 | `weftwork review: not run` | The done gate has not passed for `command` on this tree, or the change touches `ui.paths` and there are no after screenshots of this tree (`docs/UI.md`) | Run the engine first, or take the after screenshots |
| 5 | `weftwork review: exhausted` | The rounds on this branch reached the ceiling | Open the PR with the unresolved findings listed |
| 2 | none | Bad input, no git working tree, a bad setting file, a ledger it cannot read or write; the reason is on stderr | Fix the cause |

Only a must-fix blocks. A reviewer of a UI change may add a
`UI-SCORE: <0 to 10>` line; the report shows it, and it never gates
(`docs/UI.md`). A round that ran (exit 0, 1
or 3) adds one review line to the ledger, with the branch, the round, the
ceiling and the findings (at most 50 of each kind, 500 characters each):

```json
{"at":"2026-11-15T12:00:00.000Z","review":"block","branch":"feat/x","round":1,"maxRounds":3,"mustFix":["(codex): a.ts:1 bad"],"shouldFix":[],"failed":[]}
```

The rounds are counted per branch from the last 1 MiB of the ledger: the
highest round number logged there, so earlier rounds cut from the tail still
count. At the
ceiling no reviewer runs, and the answer shows the last round's findings
again, as the unresolved ones. On a detached HEAD there is no branch, so the
rounds are not counted. The stop rules and the counts of runs do not read
review lines.

## Limits

- The agent writes the brief and can set `sensitive`, so it can ask for the
  higher ceiling. It cannot raise either ceiling.
- The council commands come from the setting files, so a repository's
  `weftwork.yaml` can name any command for the review to run, as it can for
  the verify command through the Claude Code hook.
- The ledger is the guard's to protect (`docs/GUARD.md`). An agent that gets
  past the guard can delete review lines and reset the count (T3).
