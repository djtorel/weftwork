# Audit: e05s01 (port the specs validator into tools/)

Story: e05s01
Mode: default (full checklist). Diff: branch `e05s01-port-validator-ci`,
`main` (7e153c2) to HEAD (ba2a403), plus the uncommitted
`specs/verifications/e05s01-verify.yaml` and bookkeeping in `specs/state.yaml`.
Files reviewed (churn rank, `scripts/bp-churn-rank.sh --since 90.days`):
`.github/workflows/ci.yml`, `CONVENTIONS.md`, `AGENTS.md` (the story's churn
hotspots, read first), then `tools/validate-specs-yaml.sh`,
`tools/test-validate-specs-yaml.sh`, the story spec and tasks file.

VERDICT: PASS

## Checklist

### Supply Chain & Security
- ✓ slopcheck: no new package. PyYAML and yamllint already in use; no new
  GitHub Action (spec §4).
- ✓ No `[SLOP]` packages.
- ✓ No secrets in the diff (scanned for `sk-`, `ghp_`, `AKIA`, private keys,
  `password`, `token=`). No matches.
- ✓ OWASP spot-check. The validator takes a path argument and passes it to
  Python through `sys.argv`, never interpolated into code. Paths are quoted.
  The only embedded Python is fixed text written in the script. No network
  access. No eval.
- ✓ No unaddressed HIGH security findings. No `EXCEPTIONS.md` entries needed.
  P2 skips the security scan in verify-work.

### Provenance & Metadata
- ✓ Story spec and tasks file carry `type:`, `risk:`, `context:` and `spec:`.
- ✓ Story spec cites its source (bigpowers 2.93.3) and the owner decision for
  the `capsule_dir` change, 2026-11-11.

### Law of Demeter
- ✓ No method chains. Bash and the small Python snippets call PyYAML once per
  file.

### CONVENTIONS.md Compliance
- ✓ Output files are in `specs/`. The audit lives in `specs/verifications/`.
- ✓ No `gh issue create`, no `api.github.com`, no `curl`, in the diff.
- ✓ Commit messages are Conventional Commits. Each commit carries
  `Story: e05s01`. No AI attribution.
- ✓ YAML files start with `---`. The new story spec is Markdown; the tasks and
  verify files pass `yamllint`.

### Scope
- ✓ Changes match the spec: the port, the selftest, two CI steps, Preflight
  text in two docs, and task status.
- ✓ No speculative features. The port does not add the `--fast` or
  other flags the spec left out.
- ✓ No files touched outside the story. `scripts/validate-specs-yaml.sh` (the
  global copy) is unchanged, as the spec says.
- ✓ Preflight is green on the branch, so no discovered defect blocks the story.

### Boy Scout Rule
- ✓ The files touched were new or small text edits. No dead code. No commented
  code blocks.

### Types and Safety
- ✓ N/A: the repository has no typed language yet. The scripts use
  `set -euo pipefail` throughout.
- ✓ No `eslint-disable`, `@ts-ignore` or `shellcheck disable` in the diff.

### Test Coverage
- ✓ Each function in the validator is exercised by the selftest. Each
  required-key check has its own bad case, and the capsule_dir check has two.
- ✓ Story has no bug fix, so no regression test is needed.
- ✓ The selftest drives the public command line (path argument and exit code),
  not internals.
- ✓ F.I.R.S.T: Fast (about 1 second locally, not timed precisely). Independent
  (each case uses its own `mktemp` tree). Repeatable (no clock or network).
  Self-validating (exit codes and named output). Timely (the RED commit
  `cb58343` came before the port `0a45c36`).
- ✓ Anti-vacuity: the good tree passes first, and the fixture-skip case
  proves the broken fixture is skipped, not failing silently.

### SOLID and Heuristics
- ✓ Single responsibility: each phase (parse, required keys, epic references)
  has its own section.
- ✓ N/A for Open/Closed and Dependency Inversion in a single shell script.
- ✓ No smells found in the diff.

### Refactoring Smells (Fowler)
- ✓ None detected. The three `need_key` calls repeat a pattern, and that is the
  intended table form, not duplication to extract.

### Code Style (CONVENTIONS.md)
- ✓ Files under 300 lines: 118 and 87.
- ✓ Functions: the only function is `need_key` (about 12 lines).
- ✓ Comments explain why: the fixture skip, the `capsule_dir` difference from
  the global script, and the reason `PYTHON` is set from the environment.
- ⚠ The inline Python blocks are about 20 lines each. They are readable, so I
  did not split them.

### Red Flags
- No checklist item was skipped.
- Rationalization caught: "the RED evidence is in the commit message, so it is
  recorded." Task 1 asks for RED evidence in the verification record. I added
  it to `specs/verifications/e05s01-verify.yaml` (`red_evidence`, commit
  cb58343) before writing this report. The output is copied from the run.

## Findings

Fixed during this audit:
1. RED evidence was recorded only in the commit message and the state note.
   Task 1 asks for it in the verification record. Fixed: `red_evidence` block
   added to `e05s01-verify.yaml`.

Open, low severity (no action needed for this story):
2. `tools/test-validate-specs-yaml.sh` uses `sed -i '/version:/d'`, which GNU
   sed accepts and BSD/macOS sed does not without a backup suffix. CI runs on
   Ubuntu and this machine is Linux, so no failure today. Fix when a macOS
   contributor appears: use a temp-file rewrite instead.
3. The skill's own Verify line (`test -d skills/enforce-first` and similar) does
   not apply to this repository, because the skills live in the global
   bigpowers install. It exits 1 here. Not a defect in the story.
4. CI has not run on any of this. AC-e05s01-05 is open until a push and PR, which
   need the owner's go-ahead.

## Gates

- Preflight: green (`yamllint specs`, `validate-specs-yaml: OK`,
  `check-gate-ignores: OK (6 paths)`).
- Security review: P2, skipped by depth. The scan above is the manual check.
- Blind-spot and completeness gates: not run in this audit. Run by verify-work
  for P0 and P1 only.
- Gate-trace: not run. Waived by the same e05 pattern as e02 to e04 if
  requested.

## Next

`commit-message`, then the owner decides on the push and PR. Ask first.
