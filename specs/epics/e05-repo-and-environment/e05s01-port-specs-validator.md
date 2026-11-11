# e05s01 — Port the specs validator into tools/ and run it in CI

**type:** chore (tooling)
**risk:** P2
**context:** infra
**bcps:** 3
**epic:** e05 (Repository and environment setup, wave 5)
**research story:** none

## 1. Purpose

Preflight runs `bash scripts/validate-specs-yaml.sh`. `scripts/` is a
gitignored symlink into this machine's bigpowers install, so a clean
checkout has no validator. CI therefore runs a subset of Preflight
(e01s04, Risks). This story copies the validator into `tools/`, where
the repository owns it. Then CI and a person run the same Preflight.

Reason for Depth: one script, `tools/validate-specs-yaml.sh`, plus its
selftest. It exists so the gate is in the repository. No new
abstraction: the port keeps the global script's three phases.

## 2. Zoom-out

- **Purpose:** the validator proves that every `specs/**/*.yaml` file
  parses, and that the three state files hold the keys the skills
  read.
- **Callers:** Preflight in `AGENTS.md` and `CONVENTIONS.md`, the
  `verify:` commands of later stories (e05s03 already names
  `tools/validate-specs-yaml.sh`), and CI after this story.
- **Contracts (kept from the global script, bigpowers 2.93.3):**
  - Optional first argument: the specs directory. Default:
    `<repo>/specs`, resolved from the script's own location.
  - Exit 0 and print `validate-specs-yaml: OK` on success. Exit 1 on
    any failure, with one line per problem that names the file.
  - Skip `specs/verifications/fixtures/` when it scans a real tree.
  - Parse with PyYAML `safe_load`. Run the key checks on the parsed
    objects, not with grep.
- **Not kept:** `source lib/python-env.sh`. The port uses
  `${PYTHON:-python3}`, because CI installs PyYAML into the runner's
  Python and this repo has no `.venv`.
- `--fast` mode: tooling only, no module interface changes, so
  `assess-impact` is skipped. The global script is not changed.

## 3. Requirements

#### ADDED: `tools/validate-specs-yaml.sh`
A port of the global script that needs no `scripts/` symlink. It keeps
the parse pass, the fixture skip, and the required-key checks:
`state.yaml` `active_flow` (present; null or a string),
`release-plan.yaml` `release` block and `release.version`, a non-empty
`epics` list, and `execution-status.yaml` `development_status` (a
mapping). It keeps the MIT copyright notice of bigpowers in its header.

#### MODIFIED: epic reference check
**Before:** the global script checks only `epics[].file`. Every epic
in this repo's `release-plan.yaml` uses `capsule_dir`, so the check
tests nothing here.
**After:** the port checks `epics[].file` (the file must exist) and
`epics[].capsule_dir` (the directory must exist and hold `epic.yaml`).
Owner decision, 2026-11-11.

#### ADDED: `tools/test-validate-specs-yaml.sh`
A selftest that builds trees in `mktemp -d`, never in the repository,
and removes them on exit. The good tree must pass first, so a broken
selftest cannot pass vacuously. Each bad case changes one thing and
must exit 1 with a line that names the broken file.

#### MODIFIED: Preflight command
**Before:** `yamllint specs && bash scripts/validate-specs-yaml.sh &&
bash tools/check-gate-ignores.sh` in `AGENTS.md` and `CONVENTIONS.md`.
**After:** the same chain with `tools/validate-specs-yaml.sh`.

#### MODIFIED: CI workflow
**Before:** CI runs `yamllint specs` but not the validator.
**After:** CI also runs `bash tools/validate-specs-yaml.sh` and
`bash tools/test-validate-specs-yaml.sh`.

## Acceptance criteria (Gherkin)

These IDs are local to this story.

```gherkin
Scenario: AC-e05s01-01 the repository passes
  Given this repository's specs/ tree
  When tools/validate-specs-yaml.sh runs with no argument
  Then it exits 0 and prints "validate-specs-yaml: OK"

Scenario: AC-e05s01-02 a good tree passes (anti-vacuity)
  Given a minimal good tree in a temporary directory
  When the validator runs on it
  Then it exits 0

Scenario Outline: AC-e05s01-03 one broken thing fails
  Given the good tree with <break>
  When the validator runs on it
  Then it exits 1 and the output names <file>

  Examples:
    | break                                   | file                |
    | an epic.yaml that is not valid YAML     | that epic.yaml      |
    | state.yaml without active_flow          | state.yaml          |
    | release-plan.yaml without version       | release-plan.yaml   |
    | release-plan.yaml with epics: []        | release-plan.yaml   |
    | no development_status                   | execution-status.yaml |
    | an epic file: path that does not exist  | that path           |
    | a capsule_dir that does not exist       | that path           |
    | a capsule_dir with no epic.yaml         | that path           |

Scenario: AC-e05s01-04 fixtures are skipped
  Given the good tree plus broken YAML under verifications/fixtures/
  When the validator runs on it
  Then it exits 0

Scenario: AC-e05s01-05 CI runs the validator
  Given the workflow on a PR branch
  Then the validator and selftest steps conclude success
```

## 4. Dependencies (slopcheck)

- `PyYAML`, `yamllint`: already installed locally and in CI. `[OK]`.
- No new package. No new GitHub Action.
- Source copied: bigpowers 2.93.3 `scripts/validate-specs-yaml.sh`, MIT
  License, Copyright (c) 2026 Daniel VM. MIT requires the notice to be
  kept, so the header carries it.

## 5. Out of scope

- Changing the global bigpowers script or reporting its `file` versus
  `capsule_dir` gap upstream. The owner can decide that later.
- Replacing `scripts/` calls in other gates (`assert-epic-gate.sh`,
  `record-cycle-time.sh`, `bp-timing.sh`).
- Rewriting old `scripts/validate-specs-yaml.sh` lines in
  `specs/verifications/` and archived epics. Those record what ran.
- Environment setup (e05s02), TypeScript conventions (e05s03), branch
  protection (e05s04).

## 6. Risks

- **The port drifts from upstream.** A later bigpowers release can add
  checks that the port lacks. Detect: compare the two at the e05
  checkpoint. Mitigation: the header names the source version.
- **The new capsule check fails on a real tree.** All 11 epics hold
  `epic.yaml` today (checked 2026-11-11). Task 2's verify runs the
  validator on the repository, so a failure shows before the PR.
- **CI Python lacks PyYAML.** CI already runs `pip install pyyaml
  yamllint`. Detect: the CI step fails on import.
- **Opening the PR is outward-facing.** It needs the owner's go-ahead.

## Verification Script (human)

1. `bash tools/validate-specs-yaml.sh` prints `validate-specs-yaml: OK`.
2. `bash tools/test-validate-specs-yaml.sh` prints one line per case
   and exits 0.
3. On the PR, the CI check shows green with the two new steps.
