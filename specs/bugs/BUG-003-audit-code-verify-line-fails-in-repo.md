---
bug_id: BUG-003
status: open
severity: low
scope: audit-code skill verify line (global install, not this repo)
title: audit-code's own verify line fails in any repo without skills/ dirs
---

# BUG-003: audit-code verify line checks paths this repo does not have

Found by audit-code for e02s03 on 2026-11-08 (discovered gate
failure, not a user report).

## Symptom

The audit-code skill ends with this verify line:

```bash
test -f CONVENTIONS.md && test -d skills/enforce-first \
  && test -d skills/request-review
```

In this repository it exits 1: `CONVENTIONS.md` exists, but there is no
`skills/` directory. The same line is the verify step of
`request-review` (`test -f scripts/lib/parallel-review-worktrees.sh &&
test -f skills/request-review/SKILL.md`), which fails the same way.

## Root cause

The skills are installed globally (`~/.claude/skills/`, and the
bigpowers package behind the `scripts/` symlink). Their verify lines
were written for the bigpowers source repository, where `skills/` is a
top-level directory. They test the skill's own packaging, not the
project being reviewed.

## Fix

Not fixable from this repository: the skill files are outside it, and
`scripts/` is a gitignored symlink (CONVENTIONS.md, Boundaries). Options
for the owner: report upstream, or leave the line unrun and note it in
audits. Preflight does not run these lines, so no gate in this repo
depends on them.

## Verify

`test -d skills/enforce-first` exits 1 in this repo today. The bug is
closed when the owner records either an upstream report or a decision
to ignore the line.

## Recurrence

Every audit-code and request-review run in this repo meets the same
failure if the line is run.
