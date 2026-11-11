# Security review for branch fix-bug-005-state-file-style (BUG-005)
review_date: 2026-11-11
branch: fix-bug-005-state-file-style
head: b6032a7
base: main
scope: branch diff main...HEAD (11 files: tools/restore-yaml-style.py (new),
  tools/record-cycle-time.sh, tools/test-restore-yaml-style.sh,
  tools/test-record-cycle-time.sh, .github/workflows/ci.yml, CONVENTIONS.md,
  specs/bugs/BUG-005*.md, specs/state.yaml, three verifications files)
method: manual review of the full diff, plus a scan for secret patterns
  (sk-, ghp_, AKIA, private-key headers) and for executable constructs
  (eval, exec, subprocess, curl, wget, rm -rf, chmod, sudo, shell=True,
  os.system). The security-review skill was not run (P2 skips it per
  verify-work).

## Summary

No secrets. No network access added. No shell string built from input.

## Findings

- LOW: tools/restore-yaml-style.py passes the --base revision into a git
  argument as "REV:./name". A revision that starts with "-" would be read by
  git as an option. The tool is run by the operator on their own repository,
  and the argument list is not passed through a shell, so the risk is
  limited to a mistyped option. Mitigation not applied: the value is only
  ever HEAD in this repository. Revisit if the tool is run on untrusted input.
- INFO: the tool and the wrapper write only the file they are given, through
  a snapshot in mktemp (removed on exit) and a restore that never changes data
  (the tool checks this before writing).
- INFO: the tests use mktemp directories and remove them on exit.

## Verdict

No HIGH or MEDIUM findings. Review passes for this branch diff.
