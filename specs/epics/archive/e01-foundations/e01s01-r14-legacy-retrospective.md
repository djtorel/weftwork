# e01s01 — R14 legacy retrospective (tracer: builds the checker)

**type:** feat (checker) + research (brief)
**risk:** P1
**context:** infra
**bcps:** 3
**epic:** e01 (Foundations, wave 1)
**research story:** R14, hypotheses H4 and H6

## 1. Purpose

Two outputs. First, `tools/check-brief.sh`: the gate every later brief
passes. Second, the R14 brief: what the archived `pi-flow-legacy`
project taught about gates and ceremony. The brief is the first user of
the checker, so the checker is proved on real input before e01s02 and
e01s03 depend on it.

Reason for Depth: the checker is one bash file with one embedded YAML
read (`python3 -I -c`, PyYAML already installed). No library, no
abstraction. It exists because a false pass would spread to all 15
briefs (test plan §Scope).

## 2. Zoom-out

- **Purpose:** `check-brief.sh` turns `brief_rules` in
  `specs/planning-context.yaml` into an exit code.
- **Callers:** the `verify:` lines of e01s01, e01s02, e01s03, and every
  e02–e04 research story.
- **Contracts to keep:** the CLI in `e01s02-tasks.yaml` task 1 and
  `e01s03-tasks.yaml` is `bash tools/check-brief.sh <brief> <R-id>
  [--sources]`. Do not change that signature.

## 3. Requirements (all ADDED; no existing behavior changes)

#### ADDED: Brief format contract

A brief at `docs/research/<ID>-<slug>.md` has these H2 headings, exact
text: `## Sources`, `## Verdicts`, `## Implications for weftwork`,
`## Earns its place vs ceremony`, `## Open questions`.

- A source is a list item in `## Sources` that starts with `- [S<n>]`
  and holds `accessed: YYYY-MM-DD` and `published: YYYY-MM-DD`. For a
  page with no date, `published: undated` is allowed. The checker
  prints a warning that counts these.
- A verdict is a list item in `## Verdicts`:
  `- H<n>: confirmed|refined|refuted — <reason> [S<n>]`. The `[S<n>]`
  must name a source that exists in `## Sources`.

#### ADDED: `tools/check-brief.sh <brief> <R-id> [--sources]`

- Exit 0: all checks pass. Exit 1: a check failed. Exit 2: usage error
  (bad R-id, missing file). Every failure names the file and the
  hypothesis, source or section at fault.
- The R-id list and hypothesis assignment come from
  `specs/planning-context.yaml` (`research_stories[].id`,
  `hypotheses[].tested_by`). Env `PLANNING_CONTEXT` overrides the path
  (used by the self-test).
- `--sources`: check `## Sources` only.
- An R-id with no assigned hypothesis prints `none assigned`.

#### ADDED: `tools/check-brief.sh --selftest`

Builds fixtures in `mktemp -d`, runs every scenario below, leaves the
repo untouched, exits non-zero on the first failed scenario.

#### ADDED: R14 brief

`docs/research/R14-legacy-retrospective.md` passes the checker and
holds the analysis in §5.

## Acceptance criteria (Gherkin; IDs from the e01 test plan)

```gherkin
Scenario: SC-e01s01-P1-01 complete brief passes
  Given a brief with all five sections, dated sources and a verdict for
        every hypothesis assigned to its R-id
  When check-brief.sh runs on it
  Then it exits 0

Scenario: SC-e01s01-P1-02 missing verdict is named
  Given the passing brief with the verdict for one hypothesis removed
  When check-brief.sh runs
  Then it exits 1 and the output names that hypothesis

Scenario: SC-e01s01-P1-03 undated source fails
  Given the passing brief with one source missing accessed or published
  When check-brief.sh runs
  Then it exits 1 and the output names that source

Scenario: SC-e01s01-P1-04 unknown R-id
  When check-brief.sh runs with R-id R99
  Then it exits 2 and the output lists the valid R-ids

Scenario: SC-e01s01-P1-05 bad verdict word
  Given the passing brief with one verdict word changed to "probably"
  When check-brief.sh runs
  Then it exits 1

Scenario: SC-e01s01-P1-10 verdict without a real source (added by plan-work)
  Given the passing brief with one verdict citing [S9], which is absent
  When check-brief.sh runs
  Then it exits 1 and the output names that hypothesis

Scenario: SC-e01s01-P2-06 R-id with no hypotheses
  When check-brief.sh runs on a passing brief for R0
  Then the output says "none assigned" and it exits 0

Scenario: SC-e01s01-P2-07 --sources ignores other sections
  Given a draft with only a valid Sources section
  When check-brief.sh runs with --sources
  Then it exits 0

Scenario: SC-e01s01-P2-08 missing file
  When check-brief.sh runs on a path that does not exist
  Then it exits 2 and the output holds the path

Scenario: SC-e01s01-P2-09 selftest leaves the repo clean
  When --selftest runs
  Then git status --porcelain is the same before and after
```

Anti-vacuity: every rejecting scenario starts from the SC-01 fixture and
breaks one thing (test plan §2).

## 5. R14 brief content

- Sources: the eight inputs named in `planning-context.yaml`, each cited
  by path (`../pi-flow-legacy/specs/` DECISIONS, OPEN-QUESTIONS,
  VERIFICATION, spikes/, SPEC-01..04), plus papers where literature
  exists on gates or verification.
- `## Gate review`: one table row per gate, numbered `G1`, `G2`, ...
  Outcome is exactly one of `caught`, `never-fired`, `overridden`, with
  an evidence cite.
- `## Why archived`.
- Verdicts for H4 and H6, implications, earns-its-place vs ceremony,
  open questions.

## 6. Out of scope

- Judging whether the brief's claims are true (owner and R7 review).
- URL link checking.
- Checking that papers are cited. A tool cannot know where literature
  exists. The brief author and the owner carry that rule.
- Editing anything in `../pi-flow-legacy`. Read only.

## 7. Risks

- **Checker too strict or too loose.** Detect: R14 brief fails for a
  format reason, or a deliberately broken brief passes. The selftest
  covers the second case.
- **Format contract churn.** e01s02 and e01s03 may want other headings.
  Detect at the e01 re-plan checkpoint; change the contract once there.
- **Legacy files are large.** VERIFICATION.md is 1298 lines. Read it in
  slices; cite line ranges.
- **Status ledger.** `plan-work` says new tasks start `failing`.
  CONVENTIONS.md sets its own status words. This plan follows
  CONVENTIONS.md.

## Verification Script (human)

1. `bash tools/check-brief.sh --selftest` — prints one PASS line per
   scenario.
2. Delete one `- H4:` line from a copy of the brief; run the checker on
   the copy — it must exit 1 and name H4.
3. `bash tools/check-brief.sh docs/research/R14-legacy-retrospective.md
   R14` — exit 0.
4. Open the brief; spot-check three cited legacy paths and one verdict.
