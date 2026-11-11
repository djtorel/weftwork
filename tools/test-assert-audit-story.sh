#!/usr/bin/env bash
# Regression test for tools/assert-audit-story.sh (BUG-006). Each case builds
# a throwaway repo layout and checks the wrapper's exit code.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tool="$here/assert-audit-story.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fail() { echo "FAIL $1" >&2; exit 1; }

# run_case <name> <want-exit> <active_story> <audit-file-text>
run_case() {
  local d="$tmp/$1"; mkdir -p "$d/specs"
  printf 'active_story: %s\n' "$3" > "$d/specs/state.yaml"
  printf '%s' "$4" > "$d/specs/AUDIT_LATEST.md"
  local got=0
  (cd "$d" && bash "$tool" commit >/dev/null 2>&1) || got=$?
  [ "$got" = "$2" ] || fail "$1: want exit $2, got $got"
  echo "PASS $1"
}

run_case same-story-pass 0 e04s02 $'Story: e04s02 (x)\n\nVERDICT: PASS\n'
run_case other-story-pass 1 e05s01 $'Story: e04s02 (x)\n\nVERDICT: PASS\n'
run_case no-story-line 1 e04s02 $'VERDICT: PASS\n'
run_case same-story-fail 1 e04s02 $'Story: e04s02\n\nVERDICT: FAIL\n'
run_case prefix-not-match 1 e04s0 $'Story: e04s02\n\nVERDICT: PASS\n'

# Missing AUDIT_LATEST.md fails.
d="$tmp/missing"; mkdir -p "$d/specs"; printf 'active_story: e1\n' > "$d/specs/state.yaml"
got=0; (cd "$d" && bash "$tool" commit >/dev/null 2>&1) || got=$?
[ "$got" = 1 ] || fail "missing-audit: want exit 1, got $got"
echo "PASS missing-audit"
