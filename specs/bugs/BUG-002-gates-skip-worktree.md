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
   checkout. Called through a `scripts` symlink inside a worktree, they
   resolve to that worktree, since `cd` and `pwd` keep the logical
   path. A request-review round 2 reviewer tested this in a scratch
   worktree: `validate-specs-yaml.sh` called through the worktree's own
   symlink checked the worktree and caught a broken file there.

`verify-adversarial.sh` uses `git rev-parse --show-toplevel` and is not
affected. The scripts live in the global bigpowers install, so they are
not fixable from this repository.

## Fix

Rejected alternative: create the `scripts` symlink in each new
worktree. Per the test above it fixes both causes, but it adds a
manual step to every kickoff, and forgetting it fails silently.

Start story branches in the primary checkout with `git checkout -b`,
not with a worktree. `kickoff-branch` allows a branch without a
worktree. Gate outputs regenerated on every run are gitignored:
`specs/blind-spots.json`, `specs/traceability-matrix.json`,
`specs/TRACEABILITY_LATEST.md`, `specs/codebase-wiki/` and
`specs/verifications/ADVERSARIAL_LATEST.yaml`.

e02s02 was moved from the worktree to the primary checkout; the gates
then ran on the branch: blind spots 0 findings (a run that most likely
read a stale trace matrix; the round-4 re-run, with the matrix
regenerated first, reports 0 HIGH and 1 MEDIUM, the e01 double-tag the
e01 waiver records), completeness critic
`BLOCKER=0 WARNING=0`.

## Verify

`bash scripts/trace-stories.sh --json && bash scripts/check-blind-spots.sh
&& bash scripts/lib/completeness-critic.sh && git status --short`
on a story branch in the primary checkout: the critic exits 0, and no
generated gate output is listed as untracked. The first two commands
regenerate the critic's inputs, which are gitignored and absent in a
fresh clone.

Regression test: `bash tools/check-gate-ignores.sh`, run in Preflight
and CI. It fails if a listed gate output path is tracked, is not
ignored, is re-included by a `!` rule, or is ignored only by a global
or `.git/info/exclude` rule. It checks six sample paths, so a rule
narrowed to exactly those paths would still pass.

Escape hatch: if the check blocks wrongly, the owner records a
one-time waiver in `specs/state.yaml` `waivers` (what, why, date,
scope), as for other gates.

## Recurrence

Any story kicked off in a worktree. Owner decision (2026-11-08): fix
locally by not using worktrees; an upstream report is the owner's
call.
