#!/usr/bin/env bash
# Check that bigpowers gate outputs are gitignored (BUG-002 regression).
# These files are regenerated on every gate run; if one stops being
# ignored, the next gate run leaves the tree dirty.
# Usage: check-gate-ignores.sh
# Exit: 0 every path is ignored, 1 otherwise.
set -uo pipefail

PATHS=(
  specs/blind-spots.json
  specs/traceability-matrix.json
  specs/TRACEABILITY_LATEST.md
  specs/codebase-wiki/index.md
  specs/verifications/ADVERSARIAL_LATEST.yaml
)

rc=0
for p in "${PATHS[@]}"; do
  git check-ignore -q -- "$p" || {
    echo "FAIL $p: gate output is not gitignored (see BUG-002)" >&2
    rc=1
  }
done
[[ $rc -ne 0 ]] || echo "check-gate-ignores: OK (${#PATHS[@]} paths)"
exit $rc
