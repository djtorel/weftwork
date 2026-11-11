#!/usr/bin/env bash
# One command sets up the tools that Preflight and CI need (e05s02).
# Installs PyYAML and yamllint with python3 -m pip, only when one is
# missing. Safe to run twice: a second run installs nothing.
# Usage: setup.sh [--check]
#   --check  install nothing; print one line per missing tool.
# Exit: 0 every tool present, 1 a tool is missing or cannot be installed.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

missing=()

# find_missing: fill missing[] with every absent tool.
find_missing() {
  missing=()
  if ! command -v python3 >/dev/null 2>&1; then
    missing+=(python3)
  elif ! python3 -c 'import yaml' >/dev/null 2>&1; then
    missing+=(PyYAML)
  fi
  command -v yamllint >/dev/null 2>&1 || missing+=(yamllint)
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

if [ "${#missing[@]}" -gt 0 ]; then
  if ! command -v python3 >/dev/null 2>&1; then
    echo "setup: missing python3; install Python 3 (mise or your OS)" >&2
    exit 1
  fi
  echo "setup: installing PyYAML and yamllint with python3 -m pip"
  if ! python3 -m pip install pyyaml yamllint; then
    echo "setup: pip install failed. If this Python is externally" \
      "managed (PEP 668), use a mise or venv Python and run again" >&2
    exit 1
  fi
  find_missing
fi
report
