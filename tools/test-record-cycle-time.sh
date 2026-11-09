#!/usr/bin/env bash
# Regression test for tools/record-cycle-time.sh (BUG-004). A fake global
# script stands in for the real one. Each case runs the wrapper in a
# throwaway repository and checks the marker and the exit status.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fail() { echo "FAIL $1" >&2; exit 1; }

# case_run <name> <global-script-body> <starting-file> <expected-exit>
case_run() {
  local name=$1 body=$2 start=$3 want=$4 dir rc=0 first count
  dir="$(mktemp -d "$tmp/c.XXXX")"
  git init -q "$dir"
  mkdir -p "$dir/scripts" "$dir/specs" "$dir/tools"
  cp "$here/record-cycle-time.sh" "$dir/tools/"
  printf '#!/usr/bin/env bash\n%s\n' "$body" > "$dir/scripts/record-cycle-time.sh"
  printf '%b' "$start" > "$dir/specs/execution-status.yaml"
  (cd "$dir" && bash tools/record-cycle-time.sh) >/dev/null 2>&1 || rc=$?
  first=$(head -n1 "$dir/specs/execution-status.yaml")
  count=$(grep -c '^---$' "$dir/specs/execution-status.yaml" || true)
  [ "$rc" = "$want" ] || fail "$name: exit $rc, want $want"
  [ "$first" = "---" ] || fail "$name: marker missing"
  [ "$count" = "1" ] || fail "$name: marker count $count, want 1"
  echo "PASS $name"
}

WRITE_A='printf "a: 1\n" > "$(git rev-parse --show-toplevel)/specs/execution-status.yaml"'
WRITE_MARKED='printf -- "---\na: 1\n" > "$(git rev-parse --show-toplevel)/specs/execution-status.yaml"'
case_run "restores a dropped marker" "$WRITE_A" 'a: 0\n' 0
case_run "does not add a second marker" "$WRITE_MARKED" 'a: 0\n' 0
case_run "restores marker and keeps failing exit" "$WRITE_A; exit 3" 'a: 0\n' 3
