# e01s02 — R0 discovery sweep (output: candidate new stories)

**type:** research (brief)
**risk:** P1
**context:** infra
**bcps:** 3
**epic:** e01 (Foundations, wave 1)
**research story:** R0, no assigned hypotheses

## 1. Purpose

R0 is a wide, shallow scan for topics the owner has not thought of. Its
output is one brief, `docs/research/R0-discovery-sweep.md`, and a list
of candidate new stories. The owner decides which candidates enter
`release-plan.yaml`. R0 adds nothing to the plan by itself.

Reason for Depth: none. No code, no new abstraction. The brief is gated
by `tools/check-brief.sh` from e01s01.

## 2. Zoom-out

- **Purpose:** `docs/research/R0-discovery-sweep.md` feeds the re-plan
  checkpoint (e01s03 task 4), where the owner can add stories.
- **Callers:** `tools/check-brief.sh` (unchanged here); the e01s03
  checkpoint reads the candidate list.
- **Contracts:** the five H2 headings from `brief_rules`, dated sources
  (`accessed:` and `published:`), and a sourced verdict per assigned
  hypothesis. R0 has none assigned, so the checker prints
  `none assigned` and passes the verdict check (SC-e01s01-P2-06). The
  brief still writes the `## Verdicts` heading and says "none assigned".
- **Seeds (scope research-first pass, 2026-11-07):** the three awesome
  lists, `subinium/awesome-claude-code`,
  `ithiria894/awesome-claude-code-workflows` and
  `VoltAgent/awesome-claude-code-subagents`. They are secondary sources.
  They find candidates and prove nothing (CONVENTIONS.md §Evidence).
  Every candidate needs a primary source before the owner relies on it.
- `--fast` mode: no module changes and 3 BCPs, so `assess-impact` is
  skipped. `tools/check-brief.sh` is only run, never edited.

## 3. Requirements (all ADDED; no existing behavior changes)

#### ADDED: R0 brief
`docs/research/R0-discovery-sweep.md` passes
`bash tools/check-brief.sh <brief> R0`.

#### ADDED: Candidate new stories section
An H2 section `## Candidate new stories`. Each entry is one bullet:
`- <title> — reason: <one line, cites a primary source [S<n>]> — touches:
<hypotheses or goals>`. Write each bullet on ONE line: the verify
commands read the section line by line.
Candidates must not repeat a story already in `release-plan.yaml`.

## 4. Acceptance criteria (Gherkin)

These IDs are local to this story. The e01 test plan has no scenarios
for it (its §4 says the verify commands here are grep checks).

```gherkin
Scenario: AC-e01s02-01 draft brief has dated sources
  Given the R0 brief with a Sources section and seeded from an awesome list
  When check-brief.sh runs with --sources
  Then it exits 0

Scenario: AC-e01s02-02 candidates are well formed
  Given the Candidate new stories section
  Then it has at least one bullet
  And every bullet has "reason:" with an [S<n>] citation, then "touches:"

Scenario: AC-e01s02-03 full brief passes
  When check-brief.sh runs on the R0 brief with R-id R0
  Then it exits 0 and prints "none assigned"
```

## 5. Brief content

Required headings, in `brief_rules` order: `## Sources`, `## Verdicts`,
`## Implications for weftwork`, `## Earns its place vs ceremony`,
`## Open questions`, plus `## Candidate new stories`.

## 6. Out of scope

- Deep analysis of any one topic. That belongs to the story it spawns.
- Editing `release-plan.yaml` or adding stories. The owner decides.
- URL link checking.
- The paper table. That is R4's job (e01s03).

## 7. Risks

- **Seeds are secondary.** Detect: a candidate cites only a list.
  Mitigation: each candidate's `reason:` names a primary source `[S<n>]`.
- **Sweep never ends.** Mitigation: it is shallow by definition. One
  pass over the three lists, one targeted search per idea.
- **Subagent research times out.** Other projects saw repeated
  researcher timeouts. Do the research in the parent session and use at
  most 2 subagents (CONVENTIONS.md §Boundaries).

## Verification Script (human)

1. `bash tools/check-brief.sh docs/research/R0-discovery-sweep.md R0`
   — exit 0, output contains `none assigned`.
2. Open `## Candidate new stories`; confirm each bullet has a reason and
   the hypotheses or goals it touches.
3. Pick one candidate; confirm its `[S<n>]` source is a primary one.
