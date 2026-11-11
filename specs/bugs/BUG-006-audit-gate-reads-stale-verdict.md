---
bug_id: BUG-006
status: open
severity: medium
scope: specs/AUDIT_LATEST.md, read by the global scripts/lib/assert-epic-gate.sh
title: the audit gate passes any story because AUDIT_LATEST.md holds a stale PASS
---

# BUG-006: the audit gate reads a stale verdict and passes every story

Found by commit-message for e04s02 on 2026-11-11 (discovered while checking
why the gate passed for a story whose audit had not passed; not a user
report). Related: BUG-003 (an audit-code step that does not fit this
repository) and BUG-005 (global scripts with side effects here).

## Symptom

`bash scripts/lib/assert-epic-gate.sh commit` printed
`PASS [commit]: audit-code verified.` for e04s02, while
`specs/verifications/AUDIT-e04-e04s02.md` said the audit had not passed
(one open Provenance item).

## Cause

The gate script, in the global bigpowers install that `scripts/` links to,
passes when `specs/AUDIT_LATEST.md` contains `VERDICT: PASS` (or
`execution-status.yaml` contains `audit_passed: true`). It does not check
which story the verdict is for. This repository last wrote
`AUDIT_LATEST.md` for e03s05 (2026-11-10); later audits went only to
`specs/verifications/AUDIT-<epic>-<story>.md`. So the file kept a PASS for
e03s05, and the gate passed every later story at commit and release.

## Impact

The handoff notes of three releases record `assert-epic-gate release PASS`:
e03s08 (b4382d6), e04s01 (af75105) and e04s03 (8985ca1; PR #30 says so in
its body too). Those results rested on the stale file, not on the stories'
own audits. e03s06 and e03s07 were released after the file went stale and
have no such record; if the gate ran for them, it read the same file. Each
of these stories has its own audit report in `specs/verifications/`, and
those reports passed, so no story shipped with a failed audit. The gate
itself added no check.

## Fix

1. Quick-fix (this commit, data only): `specs/AUDIT_LATEST.md` now names
   e04s02 and its real verdict. The gate fails until the e04s02 audit
   passes.
2. Process, from now on: audit-code writes `specs/AUDIT_LATEST.md` for the
   active story as well as the per-story report, with the story id on the
   verdict line.
3. Durable fix, a later fix-bug story after e04s02 is released: a wrapper in
   `tools/` (the BUG-004 pattern, since `scripts/` must not be edited) that
   fails unless `AUDIT_LATEST.md` names the active story in `state.yaml`
   and says PASS. Whether to change the global gate in bigpowers is the
   owner's decision.

## Verify

`bash scripts/lib/assert-epic-gate.sh commit` exits 1 while the e04s02
audit is open, and exits 0 only after `AUDIT_LATEST.md` records a PASS for
e04s02.
