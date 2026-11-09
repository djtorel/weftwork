---
bug_id: BUG-004
status: open
severity: low
scope: scripts/record-cycle-time.sh (global install, not this repo)
title: record-cycle-time.sh drops the --- line from execution-status.yaml
---

# BUG-004: record-cycle-time.sh rewrites execution-status.yaml without `---`

Found by release-branch for e03s01 on 2026-11-08 (discovered tool
side effect, not a user report).

## Symptom

`bash scripts/record-cycle-time.sh append --story e03s01 ...` appends
the story's `effort_hours`, `lead_time_minutes` and `bcp_per_hour` to
`specs/execution-status.yaml`, and also removes the leading `---`
line. `yamllint specs` then warns `missing document start "---"`.
The warning does not fail the command, so Preflight still reports green.

## Root cause

The script rewrites the file with a YAML dumper that does not emit a
document start marker. BUG-001 was the same class of fault in
`bp-timing.sh` and `state.yaml`.

## Fix

Not fixable from this repository: `scripts/` is a gitignored symlink to
the global install (CONVENTIONS.md, Boundaries). Workaround used here:
restore the `---` line by hand after every run. Options for the owner:
report upstream, or make `yamllint` treat the warning as an error so
Preflight catches it.

## Mitigation

Since 2026-11-08 `.yamllint` makes `document-start` an error (the
`specs/state.yaml` exemption stays), so a stripped marker now fails
`yamllint specs` in Preflight and CI. Tested by removing the line from
`specs/release-plan.yaml`: exit 0 before the change, exit 1 after. The
bug stays open until the script keeps the marker or the owner records a
decision to keep the manual workaround. An upstream report is deferred
and would be batched with BUG-001 to BUG-003.

## Verify

`head -1 specs/execution-status.yaml` prints `---`. The bug is closed
when the script keeps the marker, or the owner records a decision to
keep the manual workaround.

## Recurrence

Every story release in this repo that records cycle time meets it.
