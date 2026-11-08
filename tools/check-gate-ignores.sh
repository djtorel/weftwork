#!/usr/bin/env bash
# Check that bigpowers gate outputs are gitignored (BUG-002 regression).
# These files are regenerated on every gate run; if one stops being
# ignored, the next gate run leaves the tree dirty. The list covers the
# outputs seen in this repository so far; keep it in step with the
# matching block in .gitignore.
# Usage: check-gate-ignores.sh (from anywhere inside the repository)
# Exit: 0 every path is ignored, 1 a path is not, 2 not in a git repo.
set -uo pipefail

PATHS=(
  specs/blind-spots.json
  specs/traceability-matrix.json
  specs/TRACEABILITY_LATEST.md
  specs/codebase-wiki/index.md
  specs/codebase-wiki/e00s00.md
  specs/verifications/ADVERSARIAL_LATEST.yaml
)

top=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "check-gate-ignores: not inside a git repository" >&2
  exit 2
}
cd "$top" || exit 2

rc=0
for p in "${PATHS[@]}"; do
  if git ls-files --error-unmatch -- "$p" >/dev/null 2>&1; then
    echo "FAIL $p: gate output is tracked; run git rm --cached" >&2
    rc=1
  elif ! git check-ignore -q -- "$p" ||
    [[ $(git check-ignore -v -- "$p" | cut -d: -f1) != .gitignore ]]; then
    # -q fails on a "!" re-include rule (-v alone exits 0 for it). -v
    # names the matching file: a global or .git/info/exclude match would
    # pass here but not in CI. Only the root .gitignore counts.
    echo "FAIL $p: gate output is not ignored by .gitignore (see BUG-002)" >&2
    rc=1
  fi
done
[[ $rc -ne 0 ]] || echo "check-gate-ignores: OK (${#PATHS[@]} paths)"
exit $rc
