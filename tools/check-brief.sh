#!/usr/bin/env bash
# Check a research brief against brief_rules in specs/planning-context.yaml.
# Usage: check-brief.sh <brief> <R-id> [--sources]
#        check-brief.sh --selftest
# Exit: 0 pass, 1 check failed, 2 usage error (bad R-id, missing file).
# Env:  PLANNING_CONTEXT overrides the planning-context.yaml path.
set -uo pipefail

SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"

usage() {
  echo "Usage: check-brief.sh <brief> <R-id> [--sources] | --selftest" >&2
}

PY='import sys, yaml
d = yaml.safe_load(open(sys.argv[1]))
for r in d["research_stories"]:
    print("R", r["id"])
for h in d["hypotheses"]:
    if sys.argv[2] in h.get("tested_by", []):
        print("H", h["id"])'

REQUIRED=("## Sources" "## Verdicts" "## Implications for weftwork"
  "## Earns its place vs ceremony" "## Open questions")

fails=0
fail() {
  echo "FAIL $brief: $*" >&2
  fails=$((fails + 1))
}

brief_check() {
  brief=$1
  local rid=$2 mode=$3 ctx query ids h
  if [[ ! -f $brief ]]; then
    echo "check-brief: no such file: $brief" >&2
    return 2
  fi
  ctx=${PLANNING_CONTEXT:-$(dirname "$SELF")/../specs/planning-context.yaml}
  if ! query=$(python3 -I -c "$PY" "$ctx" "$rid"); then
    echo "check-brief: cannot read $ctx" >&2
    return 2
  fi
  mapfile -t ids < <(sed -n 's/^R //p' <<<"$query")
  if ! printf '%s\n' "${ids[@]}" | grep -qx "$rid"; then
    echo "check-brief: unknown R-id '$rid'; valid: ${ids[*]}" >&2
    return 2
  fi
  for h in "${REQUIRED[@]}"; do
    if [[ $mode == sources && $h != "## Sources" ]]; then continue; fi
    grep -qxF -- "$h" "$brief" || fail "missing section '$h'"
  done
  if [[ $fails -gt 0 ]]; then
    return 1
  fi
  echo "check-brief: OK ($rid)"
}

write_context() {
  cat > "$1" <<'YAML'
---
research_stories:
  - id: R0
  - id: R1
  - id: R2
hypotheses:
  - id: H1
    tested_by: [R1]
  - id: H2
    tested_by: [R1, R2]
  - id: H3
    tested_by: [R2]
YAML
}

write_brief() {
  cat > "$1" <<'MD'
# R1 fixture brief

## Sources
- [S1] Alpha, https://example.org/a - accessed: 2026-11-07 published: 2025-03-01
- [S2] Beta, https://example.org/b - accessed: 2026-11-07 published: 2024-12-31

## Verdicts
- H1: confirmed - alpha shows it [S1]
- H2: refined - beta narrows it [S2]

## Implications for weftwork
Text.

## Earns its place vs ceremony
Text.

## Open questions
Text.
MD
}

# expect <name> <want-exit> <want-output-regex> <args...>
expect() {
  local name=$1 want=$2 pat=$3 out got
  shift 3
  out=$(PLANNING_CONTEXT="$CTX" bash "$SELF" "$@" 2>&1)
  got=$?
  if [[ $got -ne $want ]] || ! grep -Eq -- "$pat" <<<"$out"; then
    echo "FAIL $name: want exit $want and /$pat/, got exit $got:" >&2
    while IFS= read -r line; do echo "  | $line" >&2; done <<<"$out"
    return 1
  fi
  echo "PASS $name"
}

# mutate <out-file> <sed-script>: copy the passing brief with one change
mutate() {
  sed "$2" "$T/ok.md" > "$1"
}

selftest() {
  T=$(mktemp -d)
  trap 'rm -rf "$T"' EXIT
  CTX="$T/planning-context.yaml"
  write_context "$CTX"
  write_brief "$T/ok.md"

  # Anti-vacuity: the passing case runs first. Every rejecting case below
  # breaks exactly one thing in this same brief.
  expect SC-e01s01-P1-01 0 'OK' "$T/ok.md" R1 || return 1

  mutate "$T/nosec.md" '/^## Open questions/d'
  expect section-missing 1 'Open questions' "$T/nosec.md" R1 || return 1
  expect SC-e01s01-P1-04 2 'R0.*R1.*R2' "$T/ok.md" R99 || return 1
  expect SC-e01s01-P2-08 2 "$T/absent.md" "$T/absent.md" R1 || return 1
  expect usage 2 'Usage' || return 1

  mutate "$T/noacc.md" '/\[S1\]/s/accessed: [0-9-]*//'
  expect SC-e01s01-P1-03a 1 'S1' "$T/noacc.md" R1 || return 1
  mutate "$T/nopub.md" '/\[S2\]/s/published: [0-9-]*//'
  expect SC-e01s01-P1-03b 1 'S2' "$T/nopub.md" R1 || return 1
  mutate "$T/undated.md" '/\[S2\]/s/published: [0-9-]*/published: undated/'
  expect undated-warns 0 'warning: 1 undated' "$T/undated.md" R1 || return 1
  sed -n '/^## Sources/,/^$/p' "$T/ok.md" > "$T/draft.md"
  expect SC-e01s01-P2-07 0 'OK' "$T/draft.md" R1 --sources || return 1
  echo "check-brief: selftest OK"
}

main() {
  if [[ ${1:-} == --selftest ]]; then
    selftest
    return
  fi
  if [[ $# -lt 2 || $# -gt 3 ]]; then
    usage
    return 2
  fi
  local mode=all
  if [[ ${3:-} == --sources ]]; then
    mode=sources
  elif [[ $# -eq 3 ]]; then
    usage
    return 2
  fi
  brief_check "$1" "$2" "$mode"
}

main "$@"
