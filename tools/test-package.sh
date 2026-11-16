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
  || fail "the installed skill does not call the weftwork command"
grep -q 'all-ready' repo/.claude/skills/all-in/SKILL.md \
  || fail "init did not install the all-in skill"
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
  *"npx weftwork install"*"npm install -g weftwork"*) ;;
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

# A clone's own install, no global one needed (docs/INSTALL.md): install the
# tarball into a new repository, pinned; with only node and git on PATH the
# hooks and a Bash command of the session run it; a global weftwork hands its
# commands to it; init --local sets the project up from it; upgrade there
# installs into the clone.
mkdir tools
ln -s "$(node -p process.execPath)" tools/node
ln -s "$(command -v git)" tools/git
ln -s "$(command -v dirname)" tools/dirname
only="$work/tools"
mkdir local
git -C local init -q -b main
echo '{"name":"local","scripts":{"test":"node -e 0"}}' > local/package.json
git -C local add -A
git -C local -c user.name=t -c user.email=t@t commit -q -m init
(cd local && PATH="$only:$PATH" "$bin" install --from "$work/$tarball") \
  | grep -q "Installed weftwork $want" || fail "install --from did not install"
grep -qx "engine: $want" local/weftwork.yaml \
  || fail "install did not pin $want in weftwork.yaml"
common="$(git -C local rev-parse --path-format=absolute --git-common-dir)"
engine="$common/weftwork/engine/node_modules/weftwork"
[ "$(cd local && "$bin" path)" = "$engine" ] \
  || fail "the global weftwork did not hand path to the clone's install"
(cd local && PATH="$only" "$bin" install) | grep -q 'already installed' \
  || fail "a second install did not find the pinned version there"
(cd local && "$bin" init --local --yes --stop-hook >/dev/null 2>&1) \
  || fail "init --local failed"
lsettings="$work/local/.claude/settings.json"
lguard="$(node -e 'const s = require(process.argv[1]);
  console.log(s.hooks.PreToolUse.at(-1).hooks[0].command)' "$lsettings")"
(cd local && echo "$read_input" | PATH="$only" CLAUDE_PROJECT_DIR="$work/local" \
  /bin/sh -c "$lguard") \
  || fail "the guard entry with only the clone's install did not let a Read through"
lenv="$(node -e 'const s = require(process.argv[1]);
  console.log(s.hooks.SessionStart.at(-1).hooks[0].command)' "$lsettings")"
(cd local && PATH="$only" CLAUDE_ENV_FILE="$work/env.sh" /bin/sh -c "$lenv") \
  || fail "the SessionStart entry failed"
[ "$(cd local && PATH="$only" "$(command -v bash)" -c ". '$work/env.sh'; weftwork path")" \
  = "$engine" ] || fail "a session's Bash command did not find the clone's install"
# The fake npm installs nothing, so the upgrade must refuse, not pin 99.0.0.
set +e
up="$(cd local && PATH="$work/fakenpm:$only" "$bin" upgrade 2>&1)"
status=$?
set -e
grep -qx "install --prefix $common/weftwork/engine --save-exact --ignore-scripts --no-audit --no-fund weftwork@99.0.0" \
  fakenpm/calls || fail "upgrade in the clone did not install into it: $up"
[ "$status" -eq 1 ] && case "$up" in *"not 99.0.0"*) true ;; *) false ;; esac \
  || fail "upgrade in the clone did not refuse an install that left another version: $up"
grep -qx "engine: $want" local/weftwork.yaml \
  || fail "a failed upgrade moved the pin"

echo "test-package: OK ($tarball)"
