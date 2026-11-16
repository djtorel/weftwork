#!/usr/bin/env bash
# Pack weftwork as npm would publish it, install the tarball globally into a
# temporary prefix, and use it as a user would: --version, --help, path,
# detect, init on a new git repository, the Claude Code hook install, update,
# and upgrade against a fake npm.
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
for f in LICENSE README.md docs/SETUP.md .claude/skills/all-ready/SKILL.md \
  .claude/skills/all-in/SKILL.md \
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
grep -q 'weftwork engine' repo/.claude/skills/all-ready/SKILL.md \
  .claude/skills/all-in/SKILL.md \
  || fail "the installed skill does not call the weftwork command"
settings="$work/repo/.claude/settings.json"
grep -qF "weftwork claude-hook -- " "$settings" \
  || fail "the Stop hook does not run weftwork claude-hook from PATH"
# The guard entry as Claude Code runs it: with the package on PATH it runs
# weftwork guard, which lets a harmless Read through; with no weftwork on
# PATH it blocks (exit 2) and says how to install it.
guard="$(node -e 'const s = require(process.argv[1]);
  console.log(s.hooks.PreToolUse.at(-1).hooks[0].command)' "$settings")"
read_input='{"tool_name":"Read","tool_input":{"file_path":"x"}}'
(cd repo && echo "$read_input" | PATH="$work/prefix/bin:$PATH" \
  CLAUDE_PROJECT_DIR="$work/repo" sh -c "$guard") \
  || fail "the guard entry with weftwork on PATH did not let a Read through"
mkdir empty
set +e
missing="$(cd repo && echo "$read_input" \
  | PATH="$work/empty" /bin/sh -c "$guard" 2>&1)"
status=$?
set -e
[ "$status" -eq 2 ] \
  || fail "the guard entry with no weftwork exited $status, not 2"
case "$missing" in
  *"npm install -g weftwork"*) ;;
  *) fail "the guard entry with no weftwork did not say how to install it" ;;
esac
(cd repo && echo '{"command":"true"}' | "$bin" engine) | tail -n 1 \
  | grep -q '"done":true' || fail "the engine did not pass true in the repo"

# update: a project just set up is up to date; with a skill gone, update
# --yes brings it back.
(cd repo && "$bin" update) | grep -q 'up to date' \
  || fail "update did not find a new setup up to date"
rm -r repo/.claude/skills/retro
(cd repo && "$bin" update --yes >/dev/null) || fail "update --yes failed"
[ -f repo/.claude/skills/retro/SKILL.md ] \
  || fail "update did not create the missing skill"

# upgrade, with a fake npm first on PATH: it asks for the latest version and
# installs exactly that one; --check installs nothing.
mkdir fakenpm
cat > fakenpm/npm <<'EOF'
#!/bin/sh
echo "$*" >> "$(dirname "$0")/calls"
[ "$1" = view ] && echo 99.0.0
exit 0
EOF
chmod +x fakenpm/npm
PATH="$work/fakenpm:$PATH" "$bin" upgrade --check | grep -q '99.0.0 is out' \
  || fail "upgrade --check did not report the newer version"
! grep -q '^install' fakenpm/calls || fail "upgrade --check ran npm install"
PATH="$work/fakenpm:$PATH" "$bin" upgrade | grep -q 'Installed weftwork 99.0.0' \
  || fail "upgrade did not install the newer version"
grep -qx 'install -g weftwork@99.0.0' fakenpm/calls \
  || fail "upgrade did not run npm install -g weftwork@99.0.0"

echo "test-package: OK ($tarball)"
