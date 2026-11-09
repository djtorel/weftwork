#!/usr/bin/env bash
# Wrapper for the global scripts/record-cycle-time.sh (BUG-004): that
# script drops the leading "---" from specs/execution-status.yaml.
# Run it with the same arguments, then restore the marker.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
bash "$ROOT/scripts/record-cycle-time.sh" "$@"
f="$ROOT/specs/execution-status.yaml"
if [ -f "$f" ] && [ "$(head -n1 "$f")" != "---" ]; then
  sed -i '1i ---' "$f"
fi
