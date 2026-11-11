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
  cp "$here/restore-yaml-style.py" "$dir/tools/" 2>/dev/null || true
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

# An empty file means the global script wrote nothing. The restore must leave
# it empty: sed on an empty file writes nothing.
EMPTY_CASE_DIR="$(mktemp -d "$tmp/e.XXXX")"
git init -q "$EMPTY_CASE_DIR"
mkdir -p "$EMPTY_CASE_DIR/scripts" "$EMPTY_CASE_DIR/specs" "$EMPTY_CASE_DIR/tools"
cp "$here/record-cycle-time.sh" "$EMPTY_CASE_DIR/tools/"
cp "$here/restore-yaml-style.py" "$EMPTY_CASE_DIR/tools/" 2>/dev/null || true
printf '#!/usr/bin/env bash\n: > "$(git rev-parse --show-toplevel)/specs/execution-status.yaml"\n' \
  > "$EMPTY_CASE_DIR/scripts/record-cycle-time.sh"
printf 'a: 0\n' > "$EMPTY_CASE_DIR/specs/execution-status.yaml"
rc=0
(cd "$EMPTY_CASE_DIR" && bash tools/record-cycle-time.sh) >/dev/null 2>&1 || rc=$?
[ "$rc" = 0 ] || fail "empty file: wrapper exit $rc, want 0"
[ ! -s "$EMPTY_CASE_DIR/specs/execution-status.yaml" ] || fail "empty file: content was written"
echo "PASS leaves an empty file empty"

# Arguments reach the global script unchanged, including a path with a space.
ARG_DIR="$(mktemp -d "$tmp/a.XXXX")"
git init -q "$ARG_DIR"
mkdir -p "$ARG_DIR/scripts" "$ARG_DIR/specs" "$ARG_DIR/tools"
cp "$here/record-cycle-time.sh" "$ARG_DIR/tools/"
cp "$here/restore-yaml-style.py" "$ARG_DIR/tools/" 2>/dev/null || true
printf '#!/usr/bin/env bash\nprintf "%%s\\n" "$@" > "$(git rev-parse --show-toplevel)/args.txt"\nprintf -- "---\\na: 1\\n" > "$(git rev-parse --show-toplevel)/specs/execution-status.yaml"\n' \
  > "$ARG_DIR/scripts/record-cycle-time.sh"
printf -- '---\na: 0\n' > "$ARG_DIR/specs/execution-status.yaml"
rc=0
(cd "$ARG_DIR" && bash tools/record-cycle-time.sh --story e03s04 --file "specs/metrics/cycle times.md") >/dev/null 2>&1 || rc=$?
[ "$rc" = 0 ] || fail "arguments: wrapper exit $rc, want 0"
want=$'--story\ne03s04\n--file\nspecs/metrics/cycle times.md'
got=$(cat "$ARG_DIR/args.txt")
[ "$got" = "$want" ] || fail "arguments: got [$got]"
echo "PASS forwards arguments unchanged"

# BUG-005: the global script rewrites the file in PyYAML's style. Blocks whose
# data did not change must keep their text; a block it really changed (here
# `stories`) keeps the script's text; the exit status passes through.
GT_DIR="$(mktemp -d "$tmp/g.XXXX")"
git init -q "$GT_DIR"
mkdir -p "$GT_DIR/scripts" "$GT_DIR/specs" "$GT_DIR/tools"
cp "$here/record-cycle-time.sh" "$GT_DIR/tools/"
cp "$here/restore-yaml-style.py" "$GT_DIR/tools/" 2>/dev/null || true
printf -- '---\ngate_trace:\n  verdict: WAIVED\n  rationale: >-\n    folded text that\n    continues here.\nstories:\n  e01s01:\n    status: todo\n' \
  > "$GT_DIR/specs/execution-status.yaml"
printf '#!/usr/bin/env bash\nprintf "gate_trace:\\n  verdict: WAIVED\\n  rationale: folded text that continues here.\\nstories:\\n  e01s01:\\n    status: done\\n" > "$(git rev-parse --show-toplevel)/specs/execution-status.yaml"\nexit 3\n' \
  > "$GT_DIR/scripts/record-cycle-time.sh"
rc=0
(cd "$GT_DIR" && bash tools/record-cycle-time.sh) >/dev/null 2>&1 || rc=$?
[ "$rc" = 3 ] || fail "gate_trace: exit $rc, want 3"
want=$'---\ngate_trace:\n  verdict: WAIVED\n  rationale: >-\n    folded text that\n    continues here.\nstories:\n  e01s01:\n    status: done'
[ "$(cat "$GT_DIR/specs/execution-status.yaml")" = "$want" ] || { cat "$GT_DIR/specs/execution-status.yaml" >&2; fail "gate_trace: block not preserved or data change lost"; }
echo "PASS keeps the style of blocks the script did not change"
