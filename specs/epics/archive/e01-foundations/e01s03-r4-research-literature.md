# e01s03 — R4 research literature (recent agentic coding papers)

**type:** research (brief) + checkpoint
**risk:** P1
**context:** infra
**bcps:** 5
**epic:** e01 (Foundations, wave 1)
**research story:** R4, hypotheses H1, H2, H13, H14, H18

Risk note: the BCP-only heuristic (BCP >= 5) gives P0. This plan sets P1
instead. The e01 test plan says P0 is empty because nothing here can
lose data or leak anything. The owner can overrule.

## 1. Purpose

Two outputs. First, `docs/research/R4-research-literature.md`: recent
(mostly 2024-2026) papers on agentic coding, each with a verdict of
applicable, interesting or not relevant. Second,
`specs/checkpoints/e01-replan.md`: the re-plan checkpoint, recorded
after the R14, R0 and R4 briefs exist. It says which later stories (e02,
e03, e04) change, or that none do.

Reason for Depth: none. No code, no new abstraction.

## 2. Zoom-out

- **Purpose:** R4 is the literature base for hypotheses H1, H2, H13,
  H14 and H18 and for later briefs R7, R8, R9, R10 and R13 that list the
  same hypotheses in `tested_by`.
- **Callers:** later briefs cite R4's paper table; the checkpoint reads
  R14, R0 and R4.
- **Contracts:** the five `brief_rules` H2 headings, dated sources, a
  sourced verdict per hypothesis. Papers are cited wherever literature
  exists (CONVENTIONS.md §Evidence). `check-brief.sh` cannot test that
  rule (e01s01 §6), so the owner and the verify greps carry it.
- **Seeds (scope research-first pass, 2026-11-07):** the SE-agent
  surveys found on Semantic Scholar (year >= 2024) and "Code as Agent
  Harness" (arXiv). Use them as the map. Years and authors still need
  checking against the primary papers. Do not re-survey.
- **Reuse:** the R14 brief already cites two papers, Huang et al. (ICLR
  2024, arXiv:2310.01798) and Wang, Pradel and Liu (ICSE 2026,
  arXiv:2503.15223). Reuse them with fresh access dates; do not
  re-derive.
- `--fast` mode: no module changes, so `assess-impact` is skipped.

## 3. Requirements (all ADDED; no existing behavior changes)

#### ADDED: R4 brief
`docs/research/R4-research-literature.md` passes
`bash tools/check-brief.sh <brief> R4`, so it has a sourced verdict for
H1, H2, H13, H14 and H18.

#### ADDED: Paper table
One Markdown table, the only table in the brief. Header
`| Paper | Year | Venue | Topic | Verdict |`. Each row cites `[S<n>]` in
the Paper cell. Topic is one of: ACI, planning, multi-agent,
self-verification, review/debate, context engineering, routing,
benchmarks. Every topic has at least one row. Verdict is one of
`applicable`, `interesting`, `not relevant`. At least 8 sources carry an
`arXiv:` or `doi:` id, a floor of one paper per topic.

#### ADDED: Re-plan checkpoint
`specs/checkpoints/e01-replan.md` has a line `Decision: no change` or
`Decision: change`, and one H2 section each for `e02`, `e03` and `e04`
that says what changes or why nothing does. It starts after e01s02 is
done, because it reads the R0 candidates.

## Acceptance criteria (Gherkin)

These IDs are local to this story. The e01 test plan has no scenarios
for it.

```gherkin
Scenario: AC-e01s03-01 draft brief has dated, paper-backed sources
  Given the R4 brief with a Sources section
  When check-brief.sh runs with --sources
  Then it exits 0
  And at least 8 sources carry an arXiv or doi id

Scenario: AC-e01s03-02 paper table covers every topic
  Given the paper table
  Then each of the 8 topics appears in a Topic cell
  And every data row ends with a valid verdict

Scenario: AC-e01s03-03 hypotheses have sourced verdicts
  When check-brief.sh runs on the R4 brief with R-id R4
  Then it exits 0

Scenario: AC-e01s03-04 checkpoint covers every later epic
  Given the R14, R0 and R4 briefs all pass check-brief.sh
  And the checkpoint has a Decision line and sections for e02, e03, e04
  Then the e01 done_when condition holds
```

## 5. Brief content

Required headings, in `brief_rules` order: `## Sources`, `## Verdicts`,
`## Implications for weftwork`, `## Earns its place vs ceremony`,
`## Open questions`, plus `## Papers` for the table.

The paper table is the only table. Write `## Earns its place vs ceremony`
as a bullet list, not a table as in R0 and R14: task 2's verify reads
every `|` row in the brief as a paper row.

## 6. Out of scope

- Judging claims in the papers beyond a verdict and a reason.
- Reading papers outside the 8 topics, except as seeds.
- Changing `release-plan.yaml`. The checkpoint recommends; the owner
  decides.
- URL link checking.

## 7. Risks

- **Survey years and authors are wrong.** Detect: a table row cites a
  survey, not the paper. Mitigation: check each row's id against the
  primary paper.
- **Table verdicts become opinion.** Mitigation: each `applicable` row
  names the hypothesis or later story it supports in the brief text.
- **Checkpoint written before e01s02 is done.** Detect: task 4's verify
  runs the R0 checker. Do e01s02 first.
- **Subagent research times out.** Do the research in the parent
  session; at most 2 subagents.
- **Loose grep.** The old checkpoint verify matched the word "change"
  anywhere. This plan requires the `Decision:` line.

## Verification Script (human)

1. `bash tools/check-brief.sh docs/research/R4-research-literature.md R4`
   — exit 0.
2. Open the paper table; confirm each topic appears and each row cites a
   source. Spot-check two ids against arxiv.org.
3. Open `specs/checkpoints/e01-replan.md`; confirm the Decision line
   and one section per later epic.
