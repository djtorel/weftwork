#!/usr/bin/env bash
# Regression test for tools/record-cycle-time.sh (BUG-004). A fake global
# script drops the leading "---" the way the real one does; the wrapper
# must put it back. Runs in a throwaway repository and prints PASS or FAIL.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git init -q "$tmp"
mkdir -p "$tmp/scripts" "$tmp/specs" "$tmp/tools"
cp "$here/record-cycle-time.sh" "$tmp/tools/"
printf '#!/usr/bin/env bash\nprintf "a: 1\\n" > "$(git rev-parse --show-toplevel)/specs/execution-status.yaml"\n' \
  > "$tmp/scripts/record-cycle-time.sh"
printf -- '---\na: 0\n' > "$tmp/specs/execution-status.yaml"

(cd "$tmp" && bash tools/record-cycle-time.sh)

if [ "$(head -n1 "$tmp/specs/execution-status.yaml")" = "---" ]; then
  echo "PASS record-cycle-time keeps the document start marker"
else
  echo "FAIL document start marker missing after wrapper run" >&2
  exit 1
fi
