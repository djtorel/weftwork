---
bug_id: BUG-005
status: fixed
severity: medium
scope: specs/execution-status.yaml and specs/state.yaml (rewritten by the global scripts)
title: record-cycle-time.sh and bp-timing.sh rewrite YAML state files in a different style
---

# BUG-005: global scripts reflow the YAML state files and turn Preflight red

Found by release-branch for e03s06 and again for e03s07 on 2026-11-10
(discovered tool side effect, not a user report). Related: BUG-001
(`bp-timing.sh` and `state.yaml`) and BUG-004 (`record-cycle-time.sh` and
the `---` line).

## Symptom

After `tools/record-cycle-time.sh append --story e03s07 ...`,
`yamllint specs` fails on `specs/execution-status.yaml`:

```
253:81 error line too long (84 > 80 characters)  (line-length)
```

The `gate_trace.rationale` folded scalar is rewritten as long lines.
Preflight stays red until the block is restored by hand. The same happened
at the e03s06 release. `bp-timing.sh` does the same to `specs/state.yaml`:
on the e03s07 branch the diff against main held 54 reflowed lines, all of
older entries whose data had not changed.

## Root cause

`scripts/record-cycle-time.sh` (line 275) and `scripts/bp-timing.sh`
(lines 40 and 68) load the file with PyYAML and write it back with
`yaml.dump(data, ..., default_flow_style=False, sort_keys=False)`. That
keeps the data and drops everything else: comments, the `---` line and the
folded `>-` style, and it re-wraps long scalars. Every top-level block is
rewritten, not only the one the script meant to change. `scripts/` is a
gitignored symlink to the global install, so the scripts cannot be fixed
from this repository (CONVENTIONS.md, Boundaries).

## Fix

Local, as for BUG-004. `tools/restore-yaml-style.py` takes a file and a
snapshot of its text from before the script ran. For each top-level block it
compares the data of the old and new text; if the data is equal it puts the
old text back, and if the data changed it keeps the new text. `tools/record-
cycle-time.sh` snapshots `specs/execution-status.yaml`, runs the global
script and then restores the style. For `bp-timing.sh`, which skills call
directly, run `python3 tools/restore-yaml-style.py specs/state.yaml --base
HEAD` after the story's last timing call and before committing.

## Verify

`bash tools/test-restore-yaml-style.sh` and
`bash tools/test-record-cycle-time.sh` exit 0, and
`yamllint specs` exits 0 after a real `tools/record-cycle-time.sh append`.
The bug is closed when the tests pass in CI and a release runs without a
manual restore.

## Evidence

Checked against the real files on 2026-11-10. Writing the real
`specs/execution-status.yaml` back with `yaml.dump(default_flow_style=False,
sort_keys=False)` reproduced the failure: `yamllint` exit 1. The tool then
restored the file byte for byte. A real `bp-timing.sh start` run changed
`specs/state.yaml` by 43 insertions and 44 deletions; after the tool ran,
the diff against HEAD held only the 5 new timing lines.

## Decision

No upstream report. The owner decided on 2026-11-08 not to file reports for
bugs in the global install; the fix stays in this repository.
