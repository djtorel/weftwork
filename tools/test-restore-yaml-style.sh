#!/usr/bin/env bash
# Regression test for tools/restore-yaml-style.py (BUG-005). Each case writes
# an old file, a rewritten file in PyYAML's style, runs the tool and compares
# the resulting text. Runs in a throwaway directory.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tool="$here/restore-yaml-style.py"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fail() { echo "FAIL $1" >&2; exit 1; }

OLD=$'---\n# keep this comment\na:\n  - 1\n  - 2\nnote: >-\n  folded text that\n  continues here.\nmetrics:\n  x: 1\n'
# PyYAML-style rewrite: same data, no marker, no comment, no folding.
NEW_SAME=$'a:\n- 1\n- 2\nnote: folded text that continues here.\nmetrics:\n  x: 1\n'
NEW_CHANGED=$'a:\n- 1\n- 2\nnote: folded text that continues here.\nmetrics:\n  x: 2\n'

# check <name> <expected-text> <actual-file>
check() { [ "$(cat "$3")" = "$2" ] || { echo "--- got:" >&2; cat "$3" >&2; fail "$1"; }; echo "PASS $1"; }

# 1. A block whose data is unchanged gets its old text back, with the marker
#    and the comment.
printf '%s' "$OLD" > "$tmp/old1"; printf '%s' "$NEW_SAME" > "$tmp/f1"
python3 "$tool" "$tmp/f1" --from "$tmp/old1" >/dev/null || fail "style-only: tool exited non-zero"
check "restores a block whose data is unchanged" "$(printf '%s' "$OLD")" "$tmp/f1"

# 2. A block whose data changed keeps the new text; the others get the old text.
printf '%s' "$NEW_CHANGED" > "$tmp/f2"
python3 "$tool" "$tmp/f2" --from "$tmp/old1" >/dev/null || fail "changed block: tool exited non-zero"
WANT2=$'---\n# keep this comment\na:\n  - 1\n  - 2\nnote: >-\n  folded text that\n  continues here.\nmetrics:\n  x: 2\n'
check "keeps a block whose data changed" "$WANT2" "$tmp/f2"

# 3. A new top-level block is kept as written.
printf '%s%s' "$NEW_SAME" $'stories:\n  e01:\n    status: done\n' > "$tmp/f3"
python3 "$tool" "$tmp/f3" --from "$tmp/old1" >/dev/null || fail "new block: tool exited non-zero"
WANT3="$OLD"$'stories:\n  e01:\n    status: done\n'
check "keeps a new top-level block" "$WANT3" "$tmp/f3"

# 4. A file that already matches is left byte for byte as it was.
cp "$tmp/old1" "$tmp/f4"
python3 "$tool" "$tmp/f4" --from "$tmp/old1" >/dev/null || fail "unchanged: tool exited non-zero"
cmp -s "$tmp/f4" "$tmp/old1" || fail "unchanged file was modified"
echo "PASS leaves an unchanged file alone"

# 5. --base REV reads the old text from git.
repo="$tmp/repo"; git init -q "$repo"
printf '%s' "$OLD" > "$repo/s.yaml"
(cd "$repo" && git add s.yaml && git -c user.email=t@t -c user.name=t commit -q -m base)
printf '%s' "$NEW_SAME" > "$repo/s.yaml"
(cd "$repo" && python3 "$tool" s.yaml --base HEAD >/dev/null) || fail "--base: tool exited non-zero"
check "restores from a git revision with --base" "$(printf '%s' "$OLD")" "$repo/s.yaml"

# 6. A snapshot that does not exist is an error, and the file is not touched.
printf '%s' "$NEW_SAME" > "$tmp/f6"; cp "$tmp/f6" "$tmp/f6.copy"
rc=0; python3 "$tool" "$tmp/f6" --from "$tmp/missing" >/dev/null 2>&1 || rc=$?
[ "$rc" = 2 ] || fail "missing snapshot: exit $rc, want 2"
cmp -s "$tmp/f6" "$tmp/f6.copy" || fail "missing snapshot: file was modified"
echo "PASS rejects a missing snapshot"

# 7. A new file that is not valid YAML is left alone, with a non-zero exit.
printf 'a: [unclosed\n' > "$tmp/f7"; cp "$tmp/f7" "$tmp/f7.copy"
rc=0; python3 "$tool" "$tmp/f7" --from "$tmp/old1" >/dev/null 2>&1 || rc=$?
[ "$rc" = 2 ] || fail "invalid yaml: exit $rc, want 2"
cmp -s "$tmp/f7" "$tmp/f7.copy" || fail "invalid yaml: file was modified"
echo "PASS leaves invalid YAML alone"
