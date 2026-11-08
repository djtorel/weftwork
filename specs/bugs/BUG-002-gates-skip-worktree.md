---
bug_id: BUG-002
status: fixed
severity: medium
scope: kickoff-branch worktrees; verify-work gate scripts
title: Gate scripts evaluate the primary checkout, not the story worktree
---

# BUG-002: verify-work gates cannot evaluate a story worktree

Found by verify-work for e02s02 on 2026-11-08 (discovered gate
failure, not a user report).

## Symptom

In the worktree `../e02s02-r2-bigpowers`:

- `bash scripts/validate-specs-yaml.sh` fails with "No such file"
  (exit 127). `scripts/` is a gitignored symlink, so a new worktree
  has none.
- `validate-specs-yaml.sh`, `check-blind-spots.sh`,
  `trace-stories.sh` and `lib/completeness-critic.sh`, run by absolute
  path from the primary checkout, read and write the primary checkout
  (`main`), not the worktree. The validator's "OK" there was about
  `main`'s `specs/`, not the story's. The critic reported `BLOCKER=1`
  for `main`.

## Root cause

Two causes combine:

1. A new worktree has no `scripts/` symlink, because the symlink is
   gitignored and machine-local. So the gates cannot be called by the
   relative path the skills use.
2. The scripts set `REPO_ROOT` from their own path, not from the
   current directory: `validate-specs-yaml.sh` line 15
   (`$SCRIPT_DIR/..`), `completeness-critic.sh` (`../..`) and
   `skill-common.sh` `resolve_repo_root`. Called by absolute path
   through the primary checkout's symlink, they resolve to the primary
   checkout. Called through a symlink inside the worktree, they would
   very likely resolve to the worktree, since `cd` and `pwd` keep the
   logical path; that was not tested.

`verify-adversarial.sh` uses `git rev-parse --show-toplevel` and is not
affected. The scripts live in the global bigpowers install, so they are
not fixable from this repository.

## Fix

Rejected alternative: create the `scripts` symlink in each new
worktree. It would likely fix cause 1 and, through the logical path,
cause 2, but it adds a manual step to every kickoff and was not
tested.

Start story branches in the primary checkout with `git checkout -b`,
not with a worktree. `kickoff-branch` allows a branch without a
worktree. Gate outputs regenerated on every run are gitignored:
`specs/blind-spots.json`, `specs/traceability-matrix.json`,
`specs/TRACEABILITY_LATEST.md`, `specs/codebase-wiki/` and
`specs/verifications/ADVERSARIAL_LATEST.yaml`.

e02s02 was moved from the worktree to the primary checkout; the gates
then ran on the branch: blind spots 0 findings, completeness critic
`BLOCKER=0 WARNING=0`.

## Verify

`bash scripts/lib/completeness-critic.sh && git status --short`
on a story branch in the primary checkout: critic exits 0, and no
generated gate output is listed as untracked.

Regression test: `bash tools/check-gate-ignores.sh`, run in Preflight
and CI. It fails if any gate output path stops being gitignored.

## Recurrence

Any story kicked off in a worktree. Owner decision (2026-11-08): fix
locally by not using worktrees; an upstream report is the owner's
call.
