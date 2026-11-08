# e01s04 — Minimal CI (GitHub Actions)

**type:** chore (tooling)
**risk:** P2
**context:** infra
**bcps:** 3
**epic:** e01 (Foundations, wave 1)
**research story:** none

Order: run this story before e01s02, so the R0 brief is the first one
the gate checks. The ID is s04 because it was added after planning
(change-request, 2026-11-08). `epic.yaml` lists stories in execution
order.

## 1. Purpose

Every PR merges with no automated check, and the briefs are the product.
`tools/check-brief.sh` gates a brief only if someone runs it. This story
runs the checks on every PR and on every push to `main`, and fixes the
two lines that still say no remote exists.

Reason for Depth: one new script, `tools/check-briefs.sh`, a loop over
`docs/research/R<n>-*.md`. It exists so CI and a person run the same
command; a loop buried in workflow YAML cannot be run or tested locally.

## 2. Zoom-out

- **Purpose:** `.github/workflows/ci.yml` (new) runs preflight and the
  brief gate in a clean checkout.
- **Callers:** GitHub runs it on `pull_request` and on `push` to `main`.
- **Contracts:** preflight is `yamllint specs` with default rules.
  `check-brief.sh` exits 0 pass, 1 fail, 2 usage error.
- **Not runnable in CI:** `scripts/validate-specs-yaml.sh`. `scripts/` is
  a gitignored symlink into this machine's bigpowers install, so a clean
  checkout has no `scripts/`. CI therefore runs a subset of preflight.
  Whether to copy that validator into `tools/` is decided in e05.
- `--fast` mode: tooling only, no module interface changes, so
  `assess-impact` is skipped.

## 3. Requirements (all ADDED; no existing behavior changes)

#### ADDED: `tools/check-briefs.sh`
With no argument, checks every `docs/research/R<n>-<slug>.md`, deriving
the R-id from the filename (`R14-x.md` gives `R14`) and running
`tools/check-brief.sh <file> <R-id>`. Exits 0 only if every brief passes
and at least one brief was found. A file in `docs/research/` that starts
with `R` plus a digit but does not match `R<n>-<slug>.md` is an error.
Other files, such as `SYNTHESIS.md`, are ignored.

#### ADDED: CI workflow
`.github/workflows/ci.yml` runs on `pull_request` and on `push` to
`main`. Steps: checkout, Python, `pip install pyyaml yamllint`,
`yamllint specs`, `bash tools/check-brief.sh --selftest`,
`bash tools/check-briefs.sh`.

#### ADDED: Accurate remote text
`AGENTS.md` names the CI workflow in its CI row. `CONVENTIONS.md` no
longer says that no remote exists.

## Acceptance criteria (Gherkin)

These IDs are local to this story.

```gherkin
Scenario: AC-e01s04-01 all briefs pass
  Given docs/research holds only passing R<n> briefs
  When tools/check-briefs.sh runs
  Then it exits 0

Scenario: AC-e01s04-02 one bad brief fails the gate
  Given a passing set plus one brief missing a section
  When tools/check-briefs.sh runs
  Then it exits 1 and names that brief

Scenario: AC-e01s04-03 a mis-named brief is not skipped
  Given a file docs/research/R7_notes.md
  When tools/check-briefs.sh runs
  Then it exits 1

Scenario: AC-e01s04-04 empty set is not a pass
  Given docs/research holds no R<n> brief
  When tools/check-briefs.sh runs
  Then it exits 1

Scenario: AC-e01s04-05 CI is green on a real PR
  Given the workflow is on a branch with an open PR
  Then every check on the PR concludes success

Scenario: AC-e01s04-06 CI goes red on a broken brief
  Given a throwaway branch whose brief lacks a required section
  Then the workflow run concludes failure
```

## 5. Dependencies (slopcheck)

- `actions/checkout`, `actions/setup-python`: GitHub-owned. `[OK]`.
  Confirm the current major version from each action's releases page
  before writing the file. Do not copy a version from memory.
- `yamllint`, `PyYAML`: mature, already used locally. `[OK]`.

## 6. Out of scope

- Branch protection, required checks, PR template (e05; each changes
  repo settings and needs owner approval).
- One-command environment setup (e05).
- Porting `validate-specs-yaml.sh` into `tools/` (e05).
- Link checking, caching, matrix builds.

## 7. Risks

- **Draft briefs fail CI.** The gate checks every brief in
  `docs/research/`. A half-written brief on a PR goes red. Detect: red on
  a research PR. Mitigation: briefs land only when complete, one per
  story.
- **CI runs a subset of local preflight.** A passing CI does not prove
  `validate-specs-yaml.sh` passes. Local preflight stays required.
- **Task 5 and 6 are outward-facing.** They push a branch and open a PR
  on `djtorel/weftwork`. Each needs the owner's go-ahead.

## Verification Script (human)

1. `bash tools/check-briefs.sh` — exit 0, one `OK` line per brief.
2. Open the PR; the CI check shows green.
3. Open the throwaway run; it shows red on the broken brief.
