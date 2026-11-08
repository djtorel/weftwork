---
bug_id: BUG-001
status: fixed
severity: medium
scope: specs/state.yaml
title: Preflight red; bp-timing.sh rewrites state.yaml in a lint-failing style
---

# BUG-001: `yamllint specs` fails on `specs/state.yaml`

Found by survey-context on 2026-11-08 (discovered gate failure, not a
user report).

## Symptom

`yamllint specs` exits 1: one indentation error (list items at column
0) and four line-length errors (81 to 86 columns). `HEAD` passes.
`validate-specs-yaml.sh` passes.

## Root cause

`scripts/bp-timing.sh` (`start` and `end`) loads `state.yaml` and writes
it back with `yaml.dump(default_flow_style=False)`. PyYAML does not
indent block sequences, drops the leading `---` and comments, and does
not wrap long quoted scalars at 80 columns. Every skill that calls the
timing helper therefore re-breaks the file. `scripts/` is a symlink to
the global bigpowers install, so the helper is not fixable from this
repo.

## Fix

Rewrite `specs/state.yaml` by hand: restore the `---` and comment,
indent the `waivers` list, and fold the long `why` and `note` values
with `>-`. Keep every value unchanged except `handoff` and `bug_cycle`.

## Verify

`yamllint specs && bash scripts/validate-specs-yaml.sh`

## Recurrence

Every `bp-timing.sh` call rewrites the file again. Owner decision
(2026-11-08): fix locally, do not report upstream. The repo now has a
`.yamllint` that extends the default rules and skips only the
`indentation` and `line-length` rules for `specs/state.yaml`. Checked
by running the helper (`start` then `end`): `yamllint specs` still
exits 0. A mis-indented list in another file still fails.
