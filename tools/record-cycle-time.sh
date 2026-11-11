#!/usr/bin/env bash
# Wrapper for the global scripts/record-cycle-time.sh (BUG-004): that
# script drops the leading "---" from specs/execution-status.yaml.
# Run it with the same arguments, then restore the marker. The restore
# runs on EXIT, so it also happens when the global script fails, and the
# exit status passes through. sed leaves an empty file empty, so no
# guard is needed for that case.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
f="$ROOT/specs/execution-status.yaml"
snap="$(mktemp)"
[ -f "$f" ] && cp "$f" "$snap"
restore() {
  # BUG-005: put back the text of blocks the script rewrote without changing.
  if [ -s "$snap" ] && [ -f "$HERE/restore-yaml-style.py" ]; then
    python3 "$HERE/restore-yaml-style.py" "$f" --from "$snap" \
      || echo "WARN: could not restore the YAML style of $f" >&2
  fi
  rm -f "$snap"
  if [ "$(head -n1 "$f")" != "---" ]; then
    sed -i '1i ---' "$f"
  fi
}
trap restore EXIT
bash "$ROOT/scripts/record-cycle-time.sh" "$@"
