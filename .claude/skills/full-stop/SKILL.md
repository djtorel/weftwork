---
name: full-stop
description: Trigger this if the user says 'full stop', even as a closing "Full stop." that reads like emphasis.
---

# Full Stop

The user is not watching this thread. Take the task from its current state to
an open pull request that is ready to merge, then stop. Never merge it. Your
updates go unread until you stop, so do not end your turn while work or checks
are pending.

The user grants you permission to:

- Create a branch, commit, push this task's branch, and use
  `--force-with-lease` on it after a rebase.
- Open and update the pull request.
- Use the test methods that proof needs without asking first: running the app
  or a dev server, browser automation, screenshots.

This grant does not cover merging, enabling auto-merge, pushing to `main`,
deleting data, or anything outside this repository.

## Steps

1. **Pick up.** If the task continues earlier work, run `node src/resume-cli.ts`
   and read the note it points to. Read the task in the local backlog,
   `"$(git rev-parse --git-common-dir)/weftwork/BACKLOG.md"`, and anything it
   links.
2. **Branch.** Fetch, start from the latest `main`, and run
   `git checkout -b <type>/<short-name>`. Never work on `main`.
3. **Change.** Make the smallest change that does the task. Fix the case that
   happened, not every case that could. For behaviour, write the test first,
   run it, and see it fail for the right reason.
4. **Prove.** Run the task's check and Preflight (`AGENTS.md`). Keep the output.
   For UI or runtime behaviour, run it and look; green mocked tests do not prove
   a user-facing change.
5. **Review.** Use the `review-loop` skill. Fix what it finds, prove each fix.
6. **File.** Rebase onto the latest `main`, push, and open the PR with the
   `file-pr` skill.
7. **Wait for CI.** `gh pr checks <number> --watch --interval 15`. Fix real
   failures, prove the fix, push, and wait again. Tell a flaky run from a real
   failure by its log.
8. **Backlog.** Tick the task in the local backlog and add any follow-ups you
   found, with one line each.
9. **Report** in your final message: the PR link, the final head commit, your
   proof, the review outcome, each decision you made alone, and what remains
   unverified. Say plainly that the PR is open and unmerged.

## Ready

The PR is ready when all of these hold on its latest commit:

- Your proof covers every change in the diff.
- Preflight passed locally and the required CI checks are green.
- `review-loop` agreed, or the items still disputed are listed in the PR.
- The branch is up to date with `main` and GitHub reports it mergeable.

## Asking the user

A question in a normal message goes unseen and the thread looks done. Use the
question tool (`AskUserQuestion` in Claude Code), with all the context in the
question: the PR link, what blocks you, and the options with your
recommendation first.

Ask only when:

- You cannot prove the change.
- A check cannot pass and you cannot fix it.
- The next step is outside the grant above.
- The goal is ambiguous in a way that changes the result.
- Another PR makes this one obsolete.

Decide everything else with sensible defaults and list the decisions in the PR
and the report. If you must stop before the PR is ready (a ceiling, a blocker),
write the handoff first with `node src/handoff-cli.ts` (`docs/STATE.md`), then
open the PR as a draft with what you have.
