#!/usr/bin/env bash
# Wrapper for the global scripts/record-cycle-time.sh (BUG-004): that
# script drops the leading "---" from specs/execution-status.yaml.
# Run it with the same arguments, then restore the marker. The restore
# runs on EXIT, so it also happens when the global script fails, and the
# exit status passes through. sed leaves an empty file empty, so no
# guard is needed for that case.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
f="$ROOT/specs/execution-status.yaml"
restore() {
  if [ "$(head -n1 "$f")" != "---" ]; then
    sed -i '1i ---' "$f"
  fi
}
trap restore EXIT
bash "$ROOT/scripts/record-cycle-time.sh" "$@"
