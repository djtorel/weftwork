---
name: review-loop
description: Use when the user says "review loop", and as the review step of full-stop.
---

# Review Loop

Have a council of reviewer models, from another family by default, review
your change, read-only, in a loop, before the pull request. The engine runs
the council, reads the findings and counts the rounds (`docs/REVIEW.md`).
Make the smallest changes that answer real findings, and fight scope creep:
push back with evidence when a finding is wrong or not needed.

## Budget

- The engine holds the ceiling: `review.max_rounds` in `weftwork.yaml`
  (3 by default), or `review.max_rounds_sensitive` (5) when you pass
  `"sensitive": true`. Pass it only for security, permissions, auth, data
  loss or state/concurrency. Round 1 is full; later rounds check only
  changed code and open findings.
- Only a must-fix blocks. Stop early when a round passes. Declined
  should-fix findings and comment, doc or format-only fixes need no new
  round.
- Keep a ledger of your answers: id, severity, outcome.

## 1. Scope

Run `git status --short`. Do not stash, discard or include unrelated changes.
Find the base: `git fetch origin` then `git merge-base HEAD origin/main`. The
change is base to working tree, untracked files included. Use the same diff
command every round. State the intent and what is out of scope in one or two
sentences. Run Preflight through the engine first
(`echo '{"command":"<Preflight>"}' | node src/cli.ts`): the council runs only
when the done gate passed on this tree.

## 2. Run the council

Write the brief to a temporary folder outside the repository, never inside
it, and send it with the same command string the engine ran:

```bash
tmp="$(mktemp -d)"
# write the brief to "$tmp/brief.md" (template below)
node -e 'const [command, file] = process.argv.slice(1);
  console.log(JSON.stringify({ command, brief: require("fs").readFileSync(file, "utf8") }))' \
  "<Preflight>" "$tmp/brief.md" | node src/review-cli.ts
```

The engine adds the reply format (`VERDICT:`, `MUST-FIX`, `SHOULD-FIX`)
after the brief. Exit 0 pass, 1 block, 3 no verdict, 4 the done gate has not
passed, or a UI change has no after screenshots of this tree (run
`echo '{"phase":"after"}' | node src/ui-cli.ts`, `docs/UI.md`), 5 the round
ceiling, 2 an error (`docs/REVIEW.md`). For a UI change the engine adds the
screenshots, a design checklist and the `ui.design` reference to the brief,
and hands reviewers the images in `WEFTWORK_IMAGES`; a design judgement call
is a should-fix, and a reviewer's `UI-SCORE` is reported, never a gate. Do not edit
files in the change while the review runs: a changed tree gives no verdict.
A failed or timed-out reviewer counts as neither pass nor block. On exit 3
(every reviewer failed), fix the cause and run again once; if it fails
again, use one fresh-context subagent of your own host as the reviewer with
the same brief and the reply format, and say so in the PR.

Round 1 brief:

```
Review only. Do not edit, commit, push, comment on PRs, or start subagents.
Repo: <abs path> Base: <sha> Intent: <intent> Out of scope: <scope> Checks: <results>
See: git diff <base>; git status --short (read untracked files too).
Read surrounding code. Find bugs, broken callers, and mismatch with the intent.
Skip style unless it hides a bug. Hold to the smallest change. Flag code,
tests or guards the intent does not need. Other paths, rare cases, small
perf, extra compatibility: should-fix.
```

## 3. Answer findings

Check each finding and its severity yourself; another path, a rare case or a
small cost is a should-fix whatever label it came with.

- Agree: the smallest fix. Prefer deleting or narrowing code over a new lock,
  cache, helper or option. Add one focused test that fails without the fix
  when the intent needs it.
- Disagree: say why, with evidence (file:line, a test, output).
- Out of scope or should-fix: decline in one line and list it as a follow-up.

Re-run the checks. If review grew the diff, cut first. Do not agree just to end
the loop.

## 4. Next round

Start one only if the last round blocked, or behaviour code changed since the
last pass. Pass the done gate again first. Send the round 1 brief, your
ledger (`fixed:` / `disagree:` / `declined:` with evidence), the same base,
and the change since the last round. Ask for open findings and changed code
only.

## 5. Stop

- Agreed: `weftwork review: pass` on the current tree, no must-fix open, no
  concern of your own.
- Stuck: a must-fix stays disputed after two replies, or the engine answers
  `exhausted`. The ceiling is not approval. Put both sides in the PR in two
  or three lines each.

Paste the last round's report into the PR as it is, and add:
`Reviewed with review-loop: <N> rounds. Verdict: <pass|stuck>`. List every
unresolved finding and every declined one with its reason.
Leave the temporary folder for the system to clean; do not `rm -rf` it (a
removal of a path held in a variable is blocked by Claude Code's safety
check and would stall an unattended run).
