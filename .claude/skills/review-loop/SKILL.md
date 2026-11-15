---
name: review-loop
description: Use when the user says "review loop", and as the review step of full-stop.
---

# Review Loop

Have a model from another family review your change, read-only, in a loop,
before the pull request. The reviewer is the Codex CLI. Make the smallest
changes that answer real findings, and fight scope creep: push back with
evidence when a finding is wrong or not needed.

## Budget

- Default: 3 rounds. Round 1 is full; later rounds check only changed code and
  open findings.
- Extend to 5 only for security, permissions, auth, data loss or
  state/concurrency, while a blocker or should stays open with evidence, or
  when the user asks.
- Stop early when a round returns only nits. Declined nits and comment, doc or
  format-only fixes need no new round.
- One reviewer. Keep a ledger: id, severity, outcome.

## 1. Scope

Run `git status --short`. Do not stash, discard or include unrelated changes.
Find the base: `git fetch origin` then `git merge-base HEAD origin/main`. The
change is base to working tree, untracked files included. Use the same diff
command every round. State the intent and what is out of scope in one or two
sentences. Run the covering checks first; do not send code the change breaks.

## 2. Run the reviewer

Write the brief and the answer to a temporary folder outside the repository,
never inside it:

```bash
tmp="$(mktemp -d)"
# write the brief to "$tmp/brief.md" (template below)
timeout 1200 codex exec --ignore-user-config --sandbox read-only --ephemeral \
  -C "$(git rev-parse --show-toplevel)" -o "$tmp/answer.md" - < "$tmp/brief.md" \
  > "$tmp/log.txt" 2>&1
grep -m1 '^model:' "$tmp/log.txt"   # the reviewer model, for the PR line
```

`--ignore-user-config` keeps the reviewer off the user's own Codex settings
(a pinned model there can be one the account cannot use) and lets Codex pick
its default model for the account. Add `-m <model>` only when the user names a
reviewer model, in the task or in `AGENTS.md`.

Do not edit files in the change while the review runs. A timeout, an error or
no answer is not approval: retry once, then report it. If the Codex CLI is not
installed or fails twice, use one fresh-context subagent of your own host as
the reviewer with the same brief, and say so in the PR.

Round 1 brief:

```
Review only. Do not edit, commit, push, comment on PRs, or start subagents.
Repo: <abs path> Base: <sha> Intent: <intent> Out of scope: <scope> Checks: <results>
See: git diff <base>; git status --short (read untracked files too).
Read surrounding code. Find bugs, broken callers, and mismatch with the intent.
Skip style unless it hides a bug. Hold to the smallest change. Flag code,
tests or guards the intent does not need. Other paths, rare cases, small
perf, extra compatibility: nits.
blocker = the intended case is wrong. should = a real bug callers will hit,
in the intent. nit = the rest.
Reply:
VERDICT: APPROVE or CHANGES
R1 [blocker|should|nit] <file>:<line> <claim>. Fix: <suggestion> (stable ids)
```

## 3. Answer findings

Check each finding and its severity yourself; another path, a rare case or a
small cost is a nit whatever label it came with.

- Agree: the smallest fix. Prefer deleting or narrowing code over a new lock,
  cache, helper or option. Add one focused test that fails without the fix
  when the intent needs it.
- Disagree: say why, with evidence (file:line, a test, output).
- Out of scope or nit: decline in one line and list it as a follow-up.

Re-run the checks. If review grew the diff, cut first. Do not agree just to end
the loop.

## 4. Next round

Start one only if budget remains and a blocker or should is open, or behaviour
code changed since the last approval. Send the round 1 brief, the ledger
(`fixed:` / `disagree:` / `declined:` with evidence), the same base, and the
change since the last round. Ask for open ids and changed code only.

## 5. Stop

- Agreed: APPROVE on the current diff, no blocker or should open, no concern
  of your own.
- Stuck: an item stays disputed after two replies, or the budget ends. Budget
  end is not approval. Put both sides in the PR in two or three lines each.

Add to the PR: `Reviewed with review-loop: <N> rounds with Codex (<model>).
Verdict: <approved|stuck>`, and list declined findings with their reasons.
Leave the temporary folder for the system to clean; do not `rm -rf` it (a
removal of a path held in a variable is blocked by Claude Code's safety
check and would stall an unattended run).
