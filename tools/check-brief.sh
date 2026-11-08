#!/usr/bin/env bash
# Check a research brief against brief_rules in specs/planning-context.yaml.
# Usage: check-brief.sh <brief> <R-id> [--sources]
#        check-brief.sh --selftest
# Exit: 0 pass, 1 check failed, 2 usage error (bad R-id, missing file).
# Env:  PLANNING_CONTEXT overrides the planning-context.yaml path.
set -uo pipefail

SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"

PY='import sys, yaml
d = yaml.safe_load(open(sys.argv[1]))
for r in d["research_stories"]:
    print("R", r["id"])
for h in d["hypotheses"]:
    if sys.argv[2] in h.get("tested_by", []):
        print("H", h["id"])'

REQUIRED=("## Sources" "## Verdicts" "## Implications for weftwork"
  "## Earns its place vs ceremony" "## Open questions")

DATE='[0-9]{4}-[0-9]{2}-[0-9]{2}'

usage() {
  echo "Usage: check-brief.sh <brief> <R-id> [--sources] | --selftest" >&2
}

# bad <brief> <message>: report one failure; always returns 1
bad() {
  echo "FAIL $1: $2" >&2
  return 1
}

# section <file> <heading>: the lines under one H2 heading
section() {
  awk -v h="$2" '$0 == h {f = 1; next} /^## / {f = 0} f' "$1"
}

# source_ids <brief>: the [S<n>] ids listed in ## Sources
source_ids() {
  section "$1" "## Sources" | grep -Eo '^- \[S[0-9]+\]' | cut -c3-
}

# check_source <brief> <line>: one source line needs both dates
check_source() {
  local b=$1 line=$2 id rc=0
  id=$(grep -Eo '^- \[S[0-9]+\]' <<<"$line")
  grep -Eq "accessed: $DATE" <<<"$line" ||
    bad "$b" "source $id has no 'accessed: YYYY-MM-DD'" || rc=1
  grep -Eq "published: ($DATE|undated)" <<<"$line" ||
    bad "$b" "source $id has no 'published: YYYY-MM-DD'" || rc=1
  return $rc
}

check_sources() {
  local b=$1 line rc=0 lines undated
  lines=$(section "$b" "## Sources" | grep -E '^- \[S[0-9]+\]')
  [[ -n $lines ]] || bad "$b" "## Sources lists no '- [S<n>]' source" || rc=1
  while IFS= read -r line; do
    [[ -z $line ]] || check_source "$b" "$line" || rc=1
  done <<<"$lines"
  undated=$(grep -c 'published: undated' <<<"$lines")
  [[ $undated -eq 0 ]] || echo "warning: $undated undated source(s)" >&2
  return $rc
}

check_sections() {
  local b=$1 mode=$2 h rc=0
  for h in "${REQUIRED[@]}"; do
    [[ $mode == sources && $h != "## Sources" ]] && continue
    grep -qxF -- "$h" "$b" || bad "$b" "missing section '$h'" || rc=1
  done
  return $rc
}

# check_verdict <brief> <hypothesis> <verdict-line> <source-ids>
check_verdict() {
  local b=$1 h=$2 line=$3 ids=$4 word ref rc=0
  word=$(sed -E 's/^- [^:]+: *([A-Za-z]+).*/\1/' <<<"$line")
  case $word in
    confirmed | refined | refuted) ;;
    *) bad "$b" "$h: verdict word '$word' is not confirmed, refined or refuted" || rc=1 ;;
  esac
  grep -Eq '\[S[0-9]+\]' <<<"$line" ||
    bad "$b" "$h: verdict cites no [S<n>] source" || rc=1
  while IFS= read -r ref; do
    grep -qxF -- "$ref" <<<"$ids" ||
      bad "$b" "$h: verdict cites $ref, which is not in ## Sources" || rc=1
  done < <(grep -Eo '\[S[0-9]+\]' <<<"$line")
  return $rc
}

# check_verdicts <brief> <hypothesis>...: one valid, sourced verdict each
check_verdicts() {
  local b=$1 h line ids rc=0
  shift
  if [[ $# -eq 0 ]]; then
    echo "check-brief: none assigned (no hypotheses for this R-id)"
    return 0
  fi
  ids=$(source_ids "$b")
  for h in "$@"; do
    line=$(section "$b" "## Verdicts" | grep -E "^- $h:" | head -n 1)
    if [[ -z $line ]]; then
      bad "$b" "no verdict for $h in ## Verdicts" || rc=1
    else
      check_verdict "$b" "$h" "$line" "$ids" || rc=1
    fi
  done
  return $rc
}

# context_query <R-id>: "R <id>" per research story, "H <id>" per hypothesis
context_query() {
  local ctx=${PLANNING_CONTEXT:-$(dirname "$SELF")/../specs/planning-context.yaml}
  python3 -I -c "$PY" "$ctx" "$1" 2>/dev/null && return
  echo "check-brief: cannot read $ctx" >&2
  return 1
}

# brief_check <brief> <R-id> <sources|empty>
brief_check() {
  local b=$1 rid=$2 mode=$3 query ids hyps rc=0
  if [[ ! -f $b ]]; then
    echo "check-brief: no such file: $b" >&2
    return 2
  fi
  query=$(context_query "$rid") || return 2
  mapfile -t ids < <(sed -n 's/^R //p' <<<"$query")
  mapfile -t hyps < <(sed -n 's/^H //p' <<<"$query")
  if ! printf '%s\n' "${ids[@]}" | grep -qx "$rid"; then
    echo "check-brief: unknown R-id '$rid'; valid: ${ids[*]}" >&2
    return 2
  fi
  check_sections "$b" "$mode" || rc=1
  check_sources "$b" || rc=1
  [[ $mode == sources ]] || check_verdicts "$b" "${hyps[@]}" || rc=1
  [[ $rc -ne 0 ]] || echo "check-brief: OK ($rid)"
  return $rc
}

write_context() {
  printf '%s\n' '---' 'research_stories:' '  - id: R0' '  - id: R1' \
    '  - id: R2' 'hypotheses:' '  - id: H1' '    tested_by: [R1]' \
    '  - id: H2' '    tested_by: [R1, R2]' '  - id: H3' \
    '    tested_by: [R2]' > "$1"
}

write_brief() {
  local a='accessed: 2026-11-07'
  printf '%s\n' '# R1 fixture brief' '' '## Sources' \
    "- [S1] Alpha - $a published: 2025-03-01" \
    "- [S2] Beta - $a published: 2024-12-31" '' '## Verdicts' \
    '- H1: confirmed - alpha shows it [S1]' \
    '- H2: refined - beta narrows it [S2]' '' \
    '## Implications for weftwork' 'Text.' '' \
    '## Earns its place vs ceremony' 'Text.' '' '## Open questions' \
    'Text.' > "$1"
}

# expect <name> <want-exit> <want-output-regex> <args...>
expect() {
  local name=$1 want=$2 pat=$3 out got line
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

cases_basics() {
  expect SC-e01s01-P1-01 0 'OK' "$T/ok.md" R1 || return 1
  mutate "$T/nosec.md" '/^## Open questions/d'
  expect section-missing 1 'Open questions' "$T/nosec.md" R1 || return 1
  expect SC-e01s01-P1-04 2 'R0.*R1.*R2' "$T/ok.md" R99 || return 1
  expect SC-e01s01-P2-08 2 "$T/absent.md" "$T/absent.md" R1 || return 1
  expect usage 2 'Usage' || return 1
  CTX="$T/none.yaml" expect ctx-unreadable 2 'cannot read' "$T/ok.md" R1 ||
    return 1
}

cases_sources() {
  mutate "$T/noacc.md" '/\[S1\]/s/accessed: [0-9-]*//'
  expect SC-e01s01-P1-03a 1 'S1' "$T/noacc.md" R1 || return 1
  mutate "$T/nopub.md" '/\[S2\]/s/published: [0-9-]*//'
  expect SC-e01s01-P1-03b 1 'S2' "$T/nopub.md" R1 || return 1
  mutate "$T/undated.md" '/\[S2\]/s/published: [0-9-]*/published: undated/'
  expect undated-warns 0 'warning: 1 undated' "$T/undated.md" R1 || return 1
  sed -n '/^## Sources/,/^$/p' "$T/ok.md" > "$T/draft.md"
  expect SC-e01s01-P2-07 0 'OK' "$T/draft.md" R1 --sources || return 1
}

cases_verdicts() {
  mutate "$T/nov.md" '/^- H2:/d'
  expect SC-e01s01-P1-02 1 'H2' "$T/nov.md" R1 || return 1
  mutate "$T/word.md" '/^- H2:/s/refined/probably/'
  expect SC-e01s01-P1-05 1 'H2' "$T/word.md" R1 || return 1
  mutate "$T/ghost.md" '/^- H2:/s/\[S2\]/[S9]/'
  expect SC-e01s01-P1-10 1 'H2.*S9' "$T/ghost.md" R1 || return 1
  mutate "$T/nocite.md" '/^- H1:/s/ \[S1\]//'
  expect verdict-no-source 1 'H1' "$T/nocite.md" R1 || return 1
  expect SC-e01s01-P2-06 0 'none assigned' "$T/ok.md" R0 || return 1
  expect other-rid-missing-H3 1 'H3' "$T/ok.md" R2 || return 1
}

# Anti-vacuity: the passing case runs first; every rejecting case breaks
# exactly one thing in that same brief. T and CTX are fixture paths.
selftest() {
  T=$(mktemp -d)
  trap 'rm -rf "$T"' EXIT
  CTX="$T/planning-context.yaml"
  write_context "$CTX"
  write_brief "$T/ok.md"
  cases_basics || return 1
  cases_sources || return 1
  cases_verdicts || return 1
  echo "check-brief: selftest OK"
}

main() {
  if [[ ${1:-} == --selftest ]]; then
    selftest
    return
  fi
  if [[ $# -lt 2 || $# -gt 3 || ( $# -eq 3 && $3 != --sources ) ]]; then
    usage
    return 2
  fi
  brief_check "$1" "$2" "${3:+sources}"
}

main "$@"
