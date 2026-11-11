#!/usr/bin/env bash
# validate-specs-yaml.sh: real-parse gate plus required keys for state,
# release-plan and execution-status.
#
# Ported from bigpowers 2.93.3 scripts/validate-specs-yaml.sh (MIT License,
# Copyright (c) 2026 Daniel VM) so that CI and a clean checkout can run
# Preflight without the machine-local scripts/ symlink. Changes from the
# source: it uses ${PYTHON:-python3} instead of lib/python-env.sh, and it
# also checks that each epics[].capsule_dir holds an epic.yaml (the source
# checks only epics[].file, which this repository does not use).
#
# Usage: validate-specs-yaml.sh [specs-dir]   (default: <repo>/specs)
# Exit: 0 all checks pass, 1 a check fails.
set -euo pipefail

PYTHON="${PYTHON:-python3}"
if ! "$PYTHON" -c "import yaml" 2>/dev/null; then
  echo "validate-specs-yaml: $PYTHON lacks PyYAML (pip install pyyaml)" >&2
  exit 1
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/.." && pwd)"
SPECS="${1:-$REPO_ROOT/specs}"

err=0

# Phase 1: every specs/**/*.yaml must parse. Test fixtures under
# verifications/fixtures/ hold deliberately broken YAML, so a real tree
# skips them; a fixture directory passed as SPECS is still checked.
parse_report="$($PYTHON -c "
import sys, glob, os
import yaml

specs = sys.argv[1]
bad = []
for f in sorted(glob.glob(os.path.join(specs, '**', '*.yaml'), recursive=True)):
    rel = os.path.relpath(f, specs)
    if rel.startswith('verifications' + os.sep + 'fixtures' + os.sep):
        continue
    try:
        with open(f) as fh:
            yaml.safe_load(fh)
    except yaml.YAMLError as e:
        bad.append((f, str(e).splitlines()[0] if str(e) else type(e).__name__))

for f, msg in bad:
    print(f'PARSE ERROR: {f}: {msg}')

sys.exit(1 if bad else 0)
" "$SPECS")" || err=1

if [[ -n "$parse_report" ]]; then
  echo "$parse_report"
fi

if [[ "$err" -ne 0 ]]; then
  echo "validate-specs-yaml: FAIL (a specs/**/*.yaml file is not valid YAML)"
  exit 1
fi

# Phase 2: required keys, checked on the parsed objects, not with grep.
need_key() {
  local file="$1" py_check="$2" msg="$3"
  if [[ ! -f "$file" ]]; then
    echo "missing: $file"
    err=1
    return
  fi
  if ! $PYTHON -c "
import sys, yaml
with open(sys.argv[1]) as fh:
    d = yaml.safe_load(fh) or {}
sys.exit(0 if ($py_check) else 1)
" "$file" 2>/dev/null; then
    echo "$file: $msg"
    err=1
  fi
}

need_key "$SPECS/state.yaml" "'active_flow' in d and (d.get('active_flow') is None or isinstance(d.get('active_flow'), str))" 'missing or invalid active_flow'
need_key "$SPECS/release-plan.yaml" "isinstance(d.get('release'), dict)" 'missing release block'
need_key "$SPECS/release-plan.yaml" "isinstance(d.get('release'), dict) and 'version' in d['release']" 'missing release.version'
need_key "$SPECS/release-plan.yaml" "isinstance(d.get('epics'), list) and len(d['epics']) > 0" 'missing epics list'
need_key "$SPECS/execution-status.yaml" "isinstance(d.get('development_status'), dict)" 'missing development_status'

# Phase 3: every epic's file and capsule_dir must exist, read from the
# parsed release plan. A capsule_dir must be a directory with epic.yaml.
if [[ -f "$SPECS/release-plan.yaml" ]]; then
  epic_report="$($PYTHON -c "
import sys, os, yaml
specs = sys.argv[1]
with open(os.path.join(specs, 'release-plan.yaml')) as fh:
    d = yaml.safe_load(fh) or {}
for epic in d.get('epics') or []:
    if not isinstance(epic, dict):
        continue
    f = epic.get('file')
    if f and not os.path.isfile(os.path.join(specs, f)):
        print('release-plan: missing epic file ' + os.path.join(specs, f))
    c = epic.get('capsule_dir')
    if c:
        p = os.path.join(specs, c)
        if not os.path.isdir(p):
            print('release-plan: missing epic capsule_dir ' + p)
        elif not os.path.isfile(os.path.join(p, 'epic.yaml')):
            print('release-plan: capsule_dir has no epic.yaml ' + p)
" "$SPECS" 2>&1)" || err=1
  if [[ -n "$epic_report" ]]; then
    echo "$epic_report"
    err=1
  fi
fi

if [[ "$err" -ne 0 ]]; then
  exit 1
fi
echo "validate-specs-yaml: OK"
