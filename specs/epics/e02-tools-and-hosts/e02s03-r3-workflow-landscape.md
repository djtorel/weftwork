# e02s03 — R3 workflow landscape

**type:** research (brief)
**risk:** P2
**context:** infra
**bcps:** 3
**epic:** e02 (Tools and hosts, wave 2)
**research story:** R3, hypotheses H7, H10

Risk note: the BCP heuristic (BCP 3-4) gives P1, the documentation
heuristic gives P3. This plan uses the epic's P2. Nothing here can lose
data or leak anything, and no code ships. The owner can overrule; P1
forces manual UAT in verify-work.

## 1. Purpose

One output: `docs/research/R3-workflow-landscape.md`. It answers the R3
question in `specs/planning-context.yaml`: how Spec Kit, OpenSpec, BMAD,
Kiro and Superpowers structure agentic work; what Claude Code, Codex
CLI, Cline and Aider recommend as practice; and what credible
practitioner post-mortems report. It gives sourced verdicts for H7
(ceremony proportional to risk) and H10 (small skill catalog, one entry
command per host).

Reason for Depth: none. No code, no new abstraction.

## 2. Zoom-out

- **Purpose:** R3 is the wide survey of wave 2. R1 (GSD) and R2
  (bigpowers) go deep on two workflows; R3 puts them in the field.
- **Callers:** e04s01 (R10 evaluation design) and e04s02 (synthesis)
  read it. H7 is also tested by R13 and R10; H10 by R1 and R2.
- **Contracts:** the five `brief_rules` H2 headings, dated sources, a
  sourced verdict per hypothesis, papers cited wherever literature
  exists (CONVENTIONS.md §Evidence).
- **Seeds (SCOPE_LATEST.yaml research-first pass):** start from the
  Graziano comparison page (ainativesoftware.engineering/compare,
  published 2026-09-16) as the skeleton; read the BSWEN and SpecsGraph
  comparisons before relying on them. These are secondary sources: they
  find candidates and prove nothing. Check each table row against the
  tool's own docs or repository.
- **Reuse:** GSD and bigpowers rows summarize R1 and R2 and cite those
  briefs' primary sources; do not re-research them. Reuse R4 papers
  where they bear on spec-driven or phased workflows.
- No module changes, so `assess-impact` is skipped. No external
  package is added, so slopcheck has nothing to tag.

## 3. Requirements (all ADDED; no existing behavior changes)

#### ADDED: R3 brief
`docs/research/R3-workflow-landscape.md` passes
`bash tools/check-brief.sh <brief> R3`, so it has the required headings
and a sourced verdict for H7 and H10.

#### ADDED: Workflow comparison table
Under `## Workflow comparison`, one Markdown table with one row each for
Spec Kit, OpenSpec, BMAD, Kiro, Superpowers, GSD and bigpowers. The tool
name is the first cell. Each row cites at least one `[S<n>]`, and that
source is the tool's own docs or repository. Columns cover at least:
artifacts, phases, gates or checks, and ceremony level.

#### ADDED: Host practices
Under `## Host practices`, the recommended workflow practices of Claude
Code, Codex CLI, Cline and Aider, each from the vendor's own docs.
Capability details (hooks, subagents, worktrees) belong to R5 (e02s04);
link forward rather than duplicate.

#### ADDED: Post-mortems
Under `## Post-mortems`, at least 2 bullets, each a practitioner
post-mortem or field report with a `[S<n>]` cite and one line on what
failed or worked. These are practitioner opinion; where papers exist on
the same point, cite them too.

## Acceptance criteria (Gherkin)

These IDs are local to this story. No e02 test plan exists.

```gherkin
Scenario: AC-e02s03-01 sources are dated
  Given the R3 brief with a Sources section
  When check-brief.sh runs with --sources
  Then it exits 0

Scenario: AC-e02s03-02 every workflow has a sourced row
  Given the Workflow comparison table
  Then Spec Kit, OpenSpec, BMAD, Kiro, Superpowers, GSD and bigpowers
    each have a row whose first cell is the tool name
  And each of those rows cites a source

Scenario: AC-e02s03-03 host practices and post-mortems are covered
  Given the Host practices section
  Then it names Claude Code, Codex CLI, Cline and Aider
  And the Post-mortems section has at least 2 cited bullets

Scenario: AC-e02s03-04 hypotheses have sourced verdicts
  When check-brief.sh runs on the R3 brief with R-id R3
  Then it exits 0
```

## 5. Brief content

Headings, in order: `## Sources`, `## Workflow comparison`,
`## Host practices`, `## Post-mortems`, `## Verdicts`,
`## Implications for weftwork`, `## Earns its place vs ceremony`,
`## Open questions`.

## 6. Out of scope

- Re-researching GSD or bigpowers (R1, R2).
- Host capability matrix: hooks, subagents, plugins, model choice (R5).
- Trying each tool hands-on. Rows come from docs, not trials.
- Choosing a workflow. The brief recommends; e04s02 decides.
- URL link checking.

## 7. Risks

- **Rows copied from the comparison page.** Detect: a row cites only
  the Graziano or BSWEN page. Mitigation: task 2 needs a primary cite
  per row; spot-check two in UAT.
- **Tool docs moved since the comparison page.** Mitigation: record
  the version or commit read, and the access date.
- **Kiro is a closed product.** Its docs may be thin. Mitigation: cite
  what the vendor publishes and say what is unknown in Open questions.
- **No literature on these tools.** Mitigation: say so in the brief
  and cite R4 papers on the underlying ideas (planning, verification).
- **Subagent research times out.** Do the research in the parent
  session; at most 2 subagents.

## Verification Script (human)

1. `bash tools/check-brief.sh docs/research/R3-workflow-landscape.md R3`
   — exit 0.
2. Open the Workflow comparison table. Pick two rows and confirm the
   cited source is the tool's own docs or repository and supports the
   row.
3. Read the H7 and H10 verdicts and confirm each cites a source.
