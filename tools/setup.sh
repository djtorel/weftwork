#!/usr/bin/env bash
# One command sets up the tools that Preflight and CI need (e05s02).
# Installs PyYAML and yamllint with python3 -m pip, only when one is
# missing. Checks node against engines.node in package.json and npm,
# but does not install them; then runs npm ci for the TypeScript tools.
# Safe to run twice.
# Usage: setup.sh [--check]
#   --check  install nothing; print one line per missing tool.
# Exit: 0 every tool present, 1 a tool is missing or cannot be installed.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

# need: the minimum node major version, from "node": ">=N" in engines.
need="$(sed -n 's/.*"node": *">=\([0-9][0-9]*\).*/\1/p' package.json \
  | head -n 1)"
if [ -z "$need" ]; then
  echo 'setup: package.json has no engines "node": ">=N"' >&2
  exit 1
fi

missing=()

# find_missing: fill missing[] with every absent tool.
find_missing() {
  local v major
  missing=()
  if ! command -v python3 >/dev/null 2>&1; then
    missing+=(python3)
  elif ! python3 -c 'import yaml' >/dev/null 2>&1; then
    missing+=(PyYAML)
  fi
  command -v yamllint >/dev/null 2>&1 || missing+=(yamllint)
  if ! command -v node >/dev/null 2>&1; then
    missing+=("node >=$need")
  else
    v="$(node --version)"
    major="${v#v}"
    major="${major%%.*}"
    if ! [ "$major" -ge "$need" ] 2>/dev/null; then
      missing+=("node >=$need (found $v)")
    fi
  fi
  command -v npm >/dev/null 2>&1 || missing+=(npm)
  [ -x node_modules/.bin/tsc ] || missing+=(tsc)
}

# is_missing <prefix>: true if a missing[] entry starts with <prefix>.
is_missing() {
  local t
  for t in "${missing[@]}"; do
    case "$t" in "$1"*) return 0 ;; esac
  done
  return 1
}

# report: print missing tools; exit 1 if any, else print OK.
report() {
  local t
  if [ "${#missing[@]}" -gt 0 ]; then
    for t in "${missing[@]}"; do echo "setup: missing $t" >&2; done
    exit 1
  fi
  echo "setup: OK"
}

find_missing
if [ "${1:-}" = "--check" ]; then
  report
  exit 0
fi

if is_missing python3; then
  echo "setup: missing python3; install Python 3 (mise or your OS)" >&2
  exit 1
fi
if is_missing PyYAML || is_missing yamllint; then
  echo "setup: installing PyYAML and yamllint with python3 -m pip"
  if ! python3 -m pip install pyyaml yamllint; then
    echo "setup: pip install failed. If this Python is externally" \
      "managed (PEP 668), use a mise or venv Python and run again" >&2
    exit 1
  fi
fi
if is_missing node || is_missing npm; then
  echo "setup: install Node >=$need with npm (mise or nodejs.org)," \
    "then run again" >&2
  report
fi
npm ci
find_missing
report
