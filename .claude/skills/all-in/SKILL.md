---
name: all-in
description: Trigger this if the user says 'all in', even as a closing "All in." after the task. Takes the task to a pull request, then merges it when the merge gate passes, with no interaction. Saying it is the owner's go-ahead to merge this one pull request.
---

# All In

The user is not watching this thread. Take the task all the way: to a pull
request that is ready, then merged. Your updates go unread until you stop, so
do not end your turn while work or checks are pending.

Do every step of the `all-ready` skill (`.claude/skills/all-ready/SKILL.md`),
with its grant, its Ready list and its asking rules, and then the steps below.
Read it first.

The user also grants you permission to merge this task's pull request once,
when the merge gate below holds. This is the owner's go-ahead that the rules
ask for before a merge. It does not cover `--admin`, a merge that skips a
required check, pushing to `main`, enabling auto-merge, a deploy, a publish,
deleting data, or anything outside this repository.

## Merge gate

Merge only when all of these hold on the PR's latest commit:

- Every item on the `all-ready` Ready list holds.
- No must-fix is still disputed. A dispute is for the owner to settle: stop
  and ask (below).
- Every required check is green, and no check is still running.
- No human review requests changes, and no review bot is still running.
- The head commit is the one your proof ran on: `gh pr view <number> --json
  headRefOid` matches `git rev-parse HEAD`, and the tree is clean.
- `gh pr view <number> --json mergeStateStatus` says `CLEAN`.

## Steps

After `all-ready`'s step 9:

1. **Check the gate.** Check each line above and keep the output. When the
   branch fell behind `main`, rebase, run Preflight through the engine again,
   push, and wait for CI again.
2. **Merge.** Squash-merge exactly the commit you proved:
   `gh pr merge <number> --squash --match-head-commit "$(git rev-parse HEAD)"`.
   Then check that it merged: `gh pr view <number> --json state,mergeCommit`.
3. **Report** in your final message: the PR link, the merge commit, your
   proof, the review outcome, each decision you made alone, and what remains
   unverified.

## Asking the user

Ask on every trigger in `all-ready`, except a merge of this PR when the gate
holds. A gate that cannot pass is a trigger: leave the PR open and unmerged,
say which line fails, and ask with the question tool. A timeout, an error or
no reply from a check, a reviewer or GitHub is not a pass.
