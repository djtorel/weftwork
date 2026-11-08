#!/usr/bin/env bash
# Check every research brief in docs/research with check-brief.sh.
# Usage: check-briefs.sh [--selftest]
# Exit: 0 every brief passes and at least one was found, 1 otherwise.
# Env:  RESEARCH_DIR overrides docs/research. PLANNING_CONTEXT passes
#       through to check-brief.sh.
set -uo pipefail

SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
HERE="$(dirname "$SELF")"

# check_all <dir>: run check-brief.sh on each R<n>-<slug>.md in <dir>.
# A file that starts with R plus a digit but is not named R<n>-<slug>.md
# is an error, and so is a directory with no brief. Other files are
# ignored.
check_all() {
  local f base n=0 rc=0
  shopt -s nullglob
  for f in "$1"/R[0-9]*; do
    base=$(basename "$f")
    if [[ $base =~ ^(R[0-9]+)-.+\.md$ ]]; then
      n=$((n + 1))
      bash "$HERE/check-brief.sh" "$f" "${BASH_REMATCH[1]}" || rc=1
    else
      echo "FAIL $f: name must match R<n>-<slug>.md" >&2
      rc=1
    fi
  done
  if [[ $n -eq 0 ]]; then
    echo "check-briefs: no R<n>-<slug>.md brief in $1" >&2
    rc=1
  fi
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

# expect <name> <want-exit> <want-output-regex> <research-dir>
expect() {
  local name=$1 want=$2 pat=$3 dir=$4 out got line
  out=$(RESEARCH_DIR="$dir" PLANNING_CONTEXT="$CTX" bash "$SELF" 2>&1)
  got=$?
  if [[ $got -ne $want ]] || ! grep -Eq -- "$pat" <<<"$out"; then
    echo "FAIL $name: want exit $want and /$pat/, got exit $got:" >&2
    while IFS= read -r line; do echo "  | $line" >&2; done <<<"$out"
    return 1
  fi
  echo "PASS $name"
}

# Anti-vacuity: the passing set runs first; every rejecting case breaks
# exactly one thing in a copy of that set. All fixtures live in mktemp -d.
selftest() {
  T=$(mktemp -d)
  trap 'rm -rf "$T"' EXIT
  CTX="$T/planning-context.yaml"
  write_context "$CTX"
  write_brief "$T/ok.md"
  mkdir "$T/pass"
  cp "$T/ok.md" "$T/pass/R1-alpha.md"
  echo 'not a brief' > "$T/pass/SYNTHESIS.md"
  expect AC-e01s04-01 0 'OK \(R1\)' "$T/pass" || return 1
  cp -r "$T/pass" "$T/bad"
  sed '/^## Open questions/d' "$T/ok.md" > "$T/bad/R0-bad.md"
  expect AC-e01s04-02 1 'R0-bad\.md' "$T/bad" || return 1
  cp -r "$T/pass" "$T/mis"
  cp "$T/ok.md" "$T/mis/R7_notes.md"
  expect AC-e01s04-03 1 'R7_notes\.md' "$T/mis" || return 1
  mkdir "$T/empty"
  echo 'not a brief' > "$T/empty/SYNTHESIS.md"
  expect AC-e01s04-04 1 'no R<n>-<slug>\.md brief' "$T/empty" || return 1
  echo "check-briefs: selftest OK"
}

main() {
  if [[ ${1:-} == --selftest ]]; then
    selftest
    return
  fi
  check_all "${RESEARCH_DIR:-$HERE/../docs/research}"
}

main "$@"
