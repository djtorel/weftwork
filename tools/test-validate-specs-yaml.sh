#!/usr/bin/env bash
# Selftest for tools/validate-specs-yaml.sh (e05s01). Every case builds a
# specs/ tree in a temporary directory, never in the repository. The good
# tree must pass first, so a broken selftest cannot pass vacuously. Each
# bad case changes one thing; it must exit 1 and name the broken path.
# Usage: test-validate-specs-yaml.sh
# Exit: 0 all cases pass, 1 a case fails.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tool="$here/validate-specs-yaml.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fail() { echo "FAIL $1" >&2; exit 1; }

# good <dir>: write a minimal specs/ tree that must pass.
good() {
  local s="$1/specs"
  mkdir -p "$s/epics/e01-x" "$s/verifications/fixtures"
  printf 'active_flow: null\n' > "$s/state.yaml"
  printf 'development_status:\n  e01: todo\n' > "$s/execution-status.yaml"
  printf 'id: e01\n' > "$s/epics/e01-x/epic.yaml"
  printf 'id: e02\n' > "$s/epics/e02.yaml"
  cat > "$s/release-plan.yaml" <<'YAML'
release:
  version: "0.1.0"
epics:
  - id: e01
    capsule_dir: epics/e01-x
  - id: e02
    file: epics/e02.yaml
YAML
}

# run_case <name> <want-exit> <needle> <dir>: run the tool on <dir>/specs.
# <needle> is text the output must hold; use - to skip that check.
run_case() {
  local name="$1" want="$2" needle="$3" d="$4" out got=0
  out="$(bash "$tool" "$d/specs" 2>&1)" || got=$?
  [ "$got" = "$want" ] || fail "$name: want exit $want, got $got: $out"
  if [ "$needle" != "-" ]; then
    printf '%s' "$out" | grep -qF -- "$needle" \
      || fail "$name: output does not name '$needle': $out"
  fi
  echo "PASS $name"
}

d="$tmp/good"; good "$d"
run_case good-tree 0 'validate-specs-yaml: OK' "$d"

d="$tmp/fixtures"; good "$d"
printf 'a: [unclosed\n' > "$d/specs/verifications/fixtures/bad.yaml"
run_case fixtures-skipped 0 'validate-specs-yaml: OK' "$d"

d="$tmp/corrupt"; good "$d"
printf 'a: [unclosed\n' > "$d/specs/epics/e01-x/epic.yaml"
run_case corrupt-epic-yaml 1 'epics/e01-x/epic.yaml' "$d"

d="$tmp/no-flow"; good "$d"
printf 'phase: planning\n' > "$d/specs/state.yaml"
run_case missing-active-flow 1 'state.yaml' "$d"

d="$tmp/no-version"; good "$d"
sed -i '/version:/d' "$d/specs/release-plan.yaml"
run_case missing-release-version 1 'release-plan.yaml' "$d"

d="$tmp/no-epics"; good "$d"
printf 'release:\n  version: "0.1.0"\nepics: []\n' \
  > "$d/specs/release-plan.yaml"
run_case empty-epics 1 'release-plan.yaml' "$d"

d="$tmp/no-devstatus"; good "$d"
printf 'other: 1\n' > "$d/specs/execution-status.yaml"
run_case missing-development-status 1 'execution-status.yaml' "$d"

d="$tmp/no-file"; good "$d"
rm "$d/specs/epics/e02.yaml"
run_case missing-epic-file 1 'epics/e02.yaml' "$d"

d="$tmp/no-capsule"; good "$d"
rm -r "$d/specs/epics/e01-x"
run_case missing-capsule-dir 1 'epics/e01-x' "$d"

d="$tmp/no-capsule-epic"; good "$d"
rm "$d/specs/epics/e01-x/epic.yaml"
run_case capsule-without-epic-yaml 1 'epics/e01-x' "$d"

echo "test-validate-specs-yaml: OK"
