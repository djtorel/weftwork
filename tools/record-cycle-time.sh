#!/usr/bin/env bash
# Wrapper for the global scripts/record-cycle-time.sh (BUG-004): that
# script drops the leading "---" from specs/execution-status.yaml.
# Run it with the same arguments, then restore the marker. The restore
# runs on EXIT, so it also happens when the global script fails, and the
# exit status passes through. An empty file is left alone: the global
# script wrote nothing, so there is no line to put the marker on.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
f="$ROOT/specs/execution-status.yaml"
restore() {
  if [ -s "$f" ] && [ "$(head -n1 "$f")" != "---" ]; then
    sed -i '1i ---' "$f"
  fi
}
trap restore EXIT
bash "$ROOT/scripts/record-cycle-time.sh" "$@"
