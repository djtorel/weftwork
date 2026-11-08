# Audit: e02s02 (R2 bigpowers in depth)

Mode: full checklist, self-review by the coding agent. Refreshed after
request-review round 3.
Diff: `git diff main...HEAD` on branch `e02s02-r2-bigpowers`. Run
`git diff --stat main...HEAD` for current figures; this report does not
pin them, because each review round changes them. No product code. One
new executable: `tools/check-gate-ignores.sh`. Churn ranking
(`bp-churn-rank.sh`) top files: `specs/state.yaml`,
`specs/execution-status.yaml`,
`specs/epics/e02-tools-and-hosts/e02s02-tasks.yaml`.

Result: **all items pass** or are N/A with a reason. This needed a
regression test for BUG-002 after the first pass, and fixes from review
rounds 1 to 3 (see the round sections).

## Supply Chain & Security

- ✓ slopcheck: no new dependencies in the diff.
- ✓ No `[SLOP]` packages.
- ✓ No secrets: diff scanned for `sk-`, `ghp_`, `AKIA`, private-key
  headers and `.env` references. None.
- ✓ OWASP spot-check: no user input, auth or network code. The brief
  reads web and GitHub metadata but ships no fetching code.
- ✓ Security pass over `tools/check-gate-ignores.sh` (added after
  verify-work's diff inspection, which covered 3 files): fixed path
  list, no input from arguments or environment, `--` before every path,
  no `eval`, no network, no writes. Exit 2 outside a repository.
- ✓ No HIGH findings.

## Provenance & Metadata

- N/A `type:` and `context:` metadata. The brief is a research brief,
  not a plan artefact. No file in `docs/research/` carries that
  metadata, and no existing spec does either.
- N/A ADR or commit SHA references. The brief cites commit `8a7b1b1`
  in source [S4].

## Law of Demeter

- N/A. No product code.

## CONVENTIONS.md Compliance

- ✓ Outputs in `specs/` or `docs/research/` (research briefs go in
  `docs/research/` per CLAUDE.md).
- ✓ No `gh issue create` in the diff.
- ✓ No `gh` or curl calls to the GitHub REST API in the diff.
- ✓ Task statuses use `todo`, `in_progress`, `done` (CONVENTIONS.md).
  The first pass missed that the tasks file said `passing`; fixed.

## Scope

- ✓ Story scope: the R2 brief, its tasks file, its verify evidence and
  this report.
- ✓ BUG-002 fix, required by the discovered-defects rule: `.gitignore`
  block, a 3-line Workspace Facts entry in AGENTS.md,
  `tools/check-gate-ignores.sh`, the Preflight row in AGENTS.md and
  CONVENTIONS.md, a CI step in `.github/workflows/ci.yml`,
  an ignore entry for the one YAML gate output in `.yamllint`, and the bug record.
- ✓ BUG-001 record: one wording fix (three skipped rules, not two).
- ✓ No speculative features.

## Boy Scout Rule

- ✓ Touched files are no less clean than before.
- ✓ No dead code or commented-out blocks.

## Types and Safety

- N/A. No typed code.

## Test Coverage

- N/A Every new function has a test. No functions were added.
- ✓ Every bug fix has a regression test. `tools/check-gate-ignores.sh`
  guards BUG-002 in Preflight and CI. Shown red against `main`'s
  `.gitignore`, red when the wiki rule is narrowed to `index.md`, red
  with a tracked gate output ("is tracked"), exit 2 outside a
  repository, and green from the repository root and from `specs/`.
  The fix predates the test, so red was shown by swapping inputs, not
  by a test-only commit.
- N/A F.I.R.S.T. No unit tests.

## SOLID and Heuristics

- N/A. No product code.

## Refactoring Smells

- Duplicated Code: the gate-output list appears in `.gitignore` and in
  the check script. Kept on purpose, since the script is the oracle for
  `.gitignore`; each file has a comment pointing to the other.

## Code Style (CONVENTIONS.md)

- ✓ YAML lines at or under 80 columns in the changed YAML, except
  `specs/state.yaml`.
- ✓ Documented exception: `.yamllint` skips `document-start`,
  `indentation` and `line-length` for `specs/state.yaml`, because
  `bp-timing.sh` rewrites it on every skill call (BUG-001).
- ✓ `yamllint specs` exits 0 with no warnings; gitignored gate outputs
  are no longer linted.

## Review round 1

Reviewers A (81.6, 2 must-fix) and B (82.9) failed the AND-gate. Fixed:

- Brief: the hook blocks more than git (generated paths, a test lock
  during `fix_bug`, commit format); H6, the overview, implications and
  earns-its-place entry rewritten. The hook is not registered in this
  repository.
- Brief: [S7] no longer used for H6 or as a hint for H7; [S6] carries
  the H6 point. H10 reworded; [S5] caveat added (skills load on demand).
- Brief: median 86; three skipped rules; Sustain examples corrected;
  `search-skills` quoted exactly; release count says 12 after the
  installed copy; `skill_timings` verdict now unproven, negative signal,
  with its consumer named; BUG-002 added as a first-hand finding;
  `kickoff-branch` worktree mode now a negative signal.
- BUG-002: root cause restated (missing symlink, then absolute-path
  calls), `validate-specs-yaml.sh` listed, rejected alternative named.
- Check script: runs from the repository top level, flags tracked
  outputs, tests a non-index wiki path.
- Tasks: statuses `done`. State: `vcs.branch` and handoff note current.

## Review round 2

Reviewers A (91.3) and B (91.7) had no must-fix findings but failed
the 94 bar. Fixed:

- Brief: H7 now names verify-work's declared `risk:` tiers (P0 to P3,
  default P1) and the P1 default this story hit. [S5] abstract read
  from the arXiv API, not recalled. Hook claims scoped to this
  repository's settings, user level unchecked, with the
  CONVENTIONS.md guard-hook line noted. Hook limits stated (inline
  `-m` only; gemini mode does not exit). PyYAML re-wraps, not "does
  not wrap". kickoff-branch step named and its self-conflict noted.
  [S9] caveat. Tombstone skill noted. [S4] lists the scope record.
- BUG-002 and AGENTS.md: scripts evaluate the checkout whose `scripts/`
  symlink they are called through (reviewer-tested). Verify command
  now regenerates the critic's gitignored inputs first.
- `.yamllint`: explicit `ignore:` list replaces `ignore-from-file`,
  which crashed when yamllint ran from a subdirectory.
- Check script: the match must come from `.gitignore`, not a global
  or `.git/info/exclude` rule (shown red with an exclude-only rule).
- Status: e02 and e02s02 `in_progress` in `epic.yaml`, the tasks file
  and `execution-status.yaml`.
- Verify evidence: marked `stale_since: dc9472c`, Preflight rechecked
  (exit 0); the owner should re-confirm UAT step 3 before release.

Not changed: commit `f252e7e` uses `fix(tools)` and a 73-character
subject; CONVENTIONS says tooling uses `chore`. The history is
unpushed, but a squash merge replaces the subject, so it was not
rewritten.

## Review round 3

Reviewers A (87.8) and B (90.9, one must-fix) failed the AND-gate.
Fixed:

- Must-fix: H7 said "nothing scores risk". `assess-impact
  --lightweight` (build-epic step 2) scores risk 1 to 10 from fan-in,
  fan-out and churn and gates `grill-me` above 7; it does not set the
  `risk:` field verify-work reads. H7 and the tiering implication
  rewritten.
- Check script: a `!` re-include rule passed (both reviewers). It now
  also requires `git check-ignore -q`. Shown red with a re-include
  rule; earlier cases still behave.
- Brief: method names the five skills that ran and the parts of three
  more that were read; `stocktake-skills` added as a second timing
  consumer; `test_plan` wording fixed (`waived` is the documented
  value); "atomic" dropped; coping tools "suggest", not "exist because
  of"; script paths given in full.
- Verify evidence: `stale_since` set to `07d09ba`, reason corrected,
  UAT steps 1 and 4 added to step 3 for owner re-confirmation; the
  handoff note asks for all three.
- BUG-002: regression scope and its six-sample limit stated; escape
  hatch named (owner waiver in `state.yaml`).
- `.yamllint`: list trimmed to the one YAML gate output.
- `execution-status.yaml`: e02s02 `started_at` from the kickoff commit.

## Red Flags (rationalizations caught)

- I was tempted to call the regression-test item N/A because the fix is
  config, not code. The checklist does not exempt config, so it failed
  and was fixed.
- I followed the develop-tdd skill's `passing` status over the
  project's `done`. The first pass of this audit did not catch it; the
  review did.
- I first wrote the hook claims from its first 25 lines. Reading the
  whole file changed the H6 verdict.
- `specs/state.yaml` timing rewrites ride along in commits that touch
  `state.yaml` (for example `836e634`). They hold metrics only.

## Verdict

PASS. Preflight (`yamllint specs && bash scripts/validate-specs-yaml.sh
&& bash tools/check-gate-ignores.sh`) exits 0. Next: request-review
round 4.
