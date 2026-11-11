#!/usr/bin/env bash
# Audit gate that checks the story (BUG-006). The global assert-epic-gate.sh
# passes on any "VERDICT: PASS" in specs/AUDIT_LATEST.md, even one written for
# an earlier story. This wrapper passes only when that file names the active
# story from specs/state.yaml on a "Story: <id>" line and says PASS.
# Usage: assert-audit-story.sh [STAGE]   Exit: 0 pass, 1 fail.
set -euo pipefail
stage="${1:-commit}"
state=specs/state.yaml
audit=specs/AUDIT_LATEST.md
die() { echo "ERROR [$stage]: $1" >&2; exit 1; }

[ -f "$state" ] || die "$state not found"
[ -f "$audit" ] || die "$audit not found; run audit-code"
story="$(sed -n 's/^active_story:[[:space:]]*\([A-Za-z0-9_-]*\).*/\1/p' "$state" | head -n1)"
[ -n "$story" ] || die "no active_story in $state"
grep -qE "^Story:[[:space:]]*${story}([[:space:]]|\$)" "$audit" \
  || die "$audit does not name the active story $story"
grep -qE "^VERDICT:[[:space:]]*PASS" "$audit" \
  || die "$audit has no VERDICT: PASS for $story"
echo "PASS [$stage]: audit-code verified for $story."
