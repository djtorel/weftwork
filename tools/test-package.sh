#!/usr/bin/env bash
# Pack weftwork as npm would publish it, install the tarball globally into a
# temporary prefix, and use it as a user would: --version, --help, path,
# detect, init on a new git repository, and the Claude Code hook install.
# Node does not strip types under node_modules, so this is what proves the
# build in dist/ works (docs/RELEASING.md).
# Usage: test-package.sh
# Exit: 0 every check passed, 1 otherwise. Needs npm and git; npm install
# fetches the runtime dependencies from the registry or the npm cache.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

fail() { echo "test-package: $*" >&2; exit 1; }

cd "$root"
tarball="$(npm pack --silent --pack-destination "$work" | tail -n 1)"
[ -f "$work/$tarball" ] || fail "npm pack wrote no tarball"
npm install --silent --global --prefix "$work/prefix" "$work/$tarball" \
  >/dev/null
bin="$work/prefix/bin/weftwork"
[ -x "$bin" ] || fail "no weftwork bin after install"

cd "$work"
want="$(node -p 'require(process.argv[1]).version' "$root/package.json")"
got="$("$bin" --version)"
[ "$got" = "$want" ] || fail "--version printed $got, want $want"
"$bin" --help | grep -q '^  init ' || fail "--help does not list init"

pkg="$("$bin" path)"
case "$pkg" in
  "$work/prefix/"*/node_modules/weftwork) ;;
  *) fail "path is $pkg, not the installed package" ;;
esac
[ ! -e "$pkg/src" ] || fail "the package ships src/"
if find "$pkg/dist" -name '*.test.js' | grep -q .; then
  fail "the package ships tests"
fi
for f in LICENSE README.md docs/SETUP.md .claude/skills/full-stop/SKILL.md \
  .github/pull_request_template.md dist/claude-hook-cli.js; do
  [ -f "$pkg/$f" ] || fail "the package has no $f"
done

mkdir plain
echo '{"name":"plain","scripts":{"test":"node -e 0"}}' > plain/package.json
echo '{"path":"plain","run":false}' | "$bin" detect | grep -q '"npm"' \
  || fail "detect did not find npm in a plain folder"

mkdir repo
git -C repo init -q -b main
echo '{"name":"repo","scripts":{"test":"node -e 0"}}' > repo/package.json
git -C repo add -A
git -C repo -c user.name=t -c user.email=t@t commit -q -m init
(cd repo && "$bin" init --yes --stop-hook >/dev/null 2>&1) \
  || fail "init --yes failed"
[ -f repo/AGENTS.md ] || fail "init wrote no AGENTS.md"
grep -q 'weftwork engine' repo/.claude/skills/full-stop/SKILL.md \
  || fail "the installed skill does not call the weftwork command"
hook="$pkg/dist/claude-hook-cli.js"
grep -qF "$hook" repo/.claude/settings.json \
  || fail "the Stop hook does not name $hook"
(cd repo && echo '{"command":"true"}' | "$bin" engine) | tail -n 1 \
  | grep -q '"done":true' || fail "the engine did not pass true in the repo"

echo "test-package: OK ($tarball)"
