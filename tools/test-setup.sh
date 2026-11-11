#!/usr/bin/env bash
# Selftest for tools/setup.sh --check (e05s02). Every case builds a tree
# in a temporary directory, never in the repository: a copy of setup.sh
# and a bin/ of stub tools that log their arguments. setup.sh runs with
# PATH set to that bin/ only. The all-present case must pass first, so a
# broken selftest cannot pass vacuously. Each bad case removes or breaks
# one tool; it must exit 1 and name that tool. No case may call pip.
# Usage: test-setup.sh
# Exit: 0 all cases pass, 1 a case fails.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tool="$here/setup.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fail() { echo "FAIL $1" >&2; exit 1; }

# stub <dir> <name> <body>: write an executable stub that logs its
# arguments to <dir>/calls, then runs <body>.
stub() {
  local d="$1" name="$2" body="$3"
  printf '#!/bin/sh\necho "%s $*" >> "%s/calls"\n%s\n' \
    "$name" "$d" "$body" > "$d/bin/$name"
  chmod +x "$d/bin/$name"
}

# good <dir>: a tree where every checked tool is present.
good() {
  local d="$1" u
  mkdir -p "$d/bin" "$d/tools"
  cp "$tool" "$d/tools/setup.sh"
  for u in cat dirname grep sed tr head; do
    ln -s "$(command -v "$u")" "$d/bin/$u"
  done
  stub "$d" python3 'exit 0'
  stub "$d" yamllint 'exit 0'
}

# run_case <name> <want-exit> <needle> <dir>: run setup.sh --check in
# <dir>. <needle> is text the output must hold; use - to skip that check.
run_case() {
  local name="$1" want="$2" needle="$3" d="$4" out got=0
  out="$(cd "$d" && PATH="$d/bin" "$BASH" tools/setup.sh --check 2>&1)" \
    || got=$?
  [ "$got" = "$want" ] || fail "$name: want exit $want, got $got: $out"
  if [ "$needle" != "-" ]; then
    printf '%s' "$out" | grep -qF -- "$needle" \
      || fail "$name: output does not name '$needle': $out"
  fi
  if [ -f "$d/calls" ] && grep -q 'pip' "$d/calls"; then
    fail "$name: --check called pip: $(cat "$d/calls")"
  fi
  echo "PASS $name"
}

test -f "$tool" || fail "missing $tool"

d="$tmp/good"; good "$d"
run_case all-present 0 - "$d"

d="$tmp/no-yamllint"; good "$d"
rm "$d/bin/yamllint"
run_case missing-yamllint 1 'yamllint' "$d"

d="$tmp/no-pyyaml"; good "$d"
stub "$d" python3 'case "$*" in *yaml*) exit 1;; esac; exit 0'
run_case missing-pyyaml 1 'PyYAML' "$d"

echo "test-setup: OK"
