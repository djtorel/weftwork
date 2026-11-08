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
- `check-blind-spots.sh`, `trace-stories.sh` and
  `lib/completeness-critic.sh`, run by absolute path from the primary
  checkout, read and write the primary checkout (`main`), not the
  worktree. The critic reported `BLOCKER=1` for `main`.

## Root cause

These scripts set `REPO_ROOT` from their own path (`scripts/lib/../..`
or `skill-common.sh` `resolve_repo_root`), not from the current
directory. Through the `scripts/` symlink, that is always the primary
checkout. `verify-adversarial.sh` uses `git rev-parse --show-toplevel`
and is not affected. The scripts live in the global bigpowers install,
so they are not fixable from this repository.

## Fix

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

## Recurrence

Any story kicked off in a worktree. Owner decision (2026-11-08): fix
locally by not using worktrees; an upstream report is the owner's
call.
