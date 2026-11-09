# e03s02 — R7 agent review and agent-answered decisions

**type:** research (brief)
**risk:** P2
**context:** infra
**bcps:** 5
**epic:** e03 (Design topics, wave 3)
**research story:** R7, hypotheses H1, H13, H14

Risk note: the BCP heuristic (BCP 5) gives P0, the documentation
heuristic gives P3. This plan proposes the epic's P2, as e03s01 did.
Nothing here can lose data or leak anything, and no code ships.
Decision: the owner approved the plan with "approve" on 2026-11-08, keeping
the epic's P2 and the project status values (todo, in_progress, done), so
the MED status-ledger finding is acknowledged.

## 1. Purpose

One output: `docs/research/R7-review-and-decisions.md`. It answers the R7
question in `specs/planning-context.yaml`: for agent review and for
agents that answer other agents' questions, what works, how to avoid
self-agreement, and when to escalate to a human. It gives sourced
verdicts for H1 (done means a declared command the harness watched exit
0; self-reports do not count), H13 (the reviewer and decider use a
different model and a fresh context; auto-answers are limited by
reversibility class) and H14 (review checks evidence, such as tests run
and mutations tried, not opinion).

Reason for Depth: none. No code, no new abstraction.

## 2. Zoom-out

- **Purpose:** R7 is the second design topic of wave 3. It tests the
  review rounds and the decision protocol in `docs/SEED-SPEC.md` §6
  (decision request, decider, decision log, auto-answers limited to
  classes the owner allows; reviewers check evidence on a different
  model and a fresh context).
- **Callers:** e04s01 (R10 evaluation design) and e04s02 (synthesis)
  read it. R9 reads it for the reviewer tier (`must_differ_from:
  worker` in SEED-SPEC). R13 reads it for which review checks become
  gates. R15 reads it for when a loop stops and asks.
- **Contracts:** the five `brief_rules` H2 headings, dated sources, a
  sourced verdict per hypothesis, papers cited wherever literature
  exists (CONVENTIONS.md §Evidence).
- **Inputs passed forward by earlier briefs:**
  - R0: cross-model review loops map to R7.
  - R1: GSD's goal-backward verification is model-run, so the
    self-review warning applies.
  - R2: bigpowers' fresh-context reviewer (`request-review` after
    `audit-code`) is unproven with a positive signal [R2 S6].
  - R3: Superpowers and BMAD review between tasks; one report found
    spec review a blocker.
  - R4: models struggle to self-correct without external feedback
    [R4 S8]; model heterogeneity helps debate [R4 S11]; agent-written
    tests add little [R4 S9]; passing tests overstate correctness
    [R4 S18]. No source found for mutation testing in review (H14) or
    for reversibility classes (H13). The e01 checkpoint adds a task:
    find one or say the claim is unsourced.
  - R5: hosts differ on a model-callable ask-user path; R5 recommends
    routing questions through the engine.
  - R6: parallelize read-heavy work such as review first; a fresh
    subagent plus two-part review per task is ceremony until measured.
  - R14: the legacy project's typed review verdict gate never fired;
    reviewer children timed out; 193 decisions were logged.
- **Sources (proposed):** each tool's own docs or repository, read
  through raw URLs or web fetch, not `gh api` or `api.github.com` (the
  e02s04 and e03s01 waivers); the R4 papers may be reused; new papers
  through arXiv, ACM or Semantic Scholar. Candidate topics: LLM-as-judge
  and self-preference bias, automated code review with LLMs, LLM-based
  mutation testing, human-in-the-loop escalation and abstention.
- No module changes, so `assess-impact` is skipped. No external
  package is added, so slopcheck has nothing to tag.

## 3. Requirements (all ADDED; no existing behavior changes)

#### ADDED: R7 brief
`docs/research/R7-review-and-decisions.md` passes
`bash tools/check-brief.sh <brief> R7`, so it has the required headings
and a sourced verdict for H1, H13 and H14.

#### ADDED: Papers
`## Sources` lists at least four papers (an arXiv or DOI link each),
because LLM review, LLM-as-judge and self-preference have a literature.

#### ADDED: Method
Under `## Method`: the access date, the version, release or commit read
for each tool in the table, whether any page came through a summarizing
subagent, and that no workflow was run.

#### ADDED: Review practices
Under `## Review practices`, one Markdown table. Header:
`| Tool | Reviewer | Context | Model | Evidence checked | Escalation |`.
At least six rows, including Claude Code, Codex CLI, GSD, bigpowers,
Superpowers and BMAD. No empty cell; write `none` or `not found` when
that is the finding. Every row cites at least one `[S<n>]`.

#### ADDED: Self-agreement
Under `## Self-agreement`, cited bullets on why a model that reviews or
judges its own output agrees with it (self-preference), and on the
mitigations: a different model and a fresh context. This is the input
to the first half of the H13 verdict.

#### ADDED: Evidence in review
Under `## Evidence in review`, bullets on what a reviewer checks (tests
run, mutations tried, conventions checked) and what each catches. They
cover mutation testing. Each bullet cites a source or says it is
unsourced. This is the input to the H14 verdict.

#### ADDED: Decisions and escalation
Under `## Decisions and escalation`, bullets on agents answering other
agents' questions, limits by reversibility class, and when to escalate
to a human. Each bullet cites a source or says it is unsourced. This is
the input to the second half of the H13 verdict.

## 4. Acceptance criteria (Gherkin)

These IDs are local to this story. No e03 test plan exists.

```gherkin
Scenario: AC-e03s02-01 sources are dated and include papers
  Given the R7 brief with a Sources section
  When check-brief.sh runs with --sources
  Then it exits 0
  And Sources lists at least four arXiv or DOI links

Scenario: AC-e03s02-02 method records what was read
  Given the Method section
  Then it names an access date, a version or commit, the subagent
    use and that no workflow was run

Scenario: AC-e03s02-03 the review table is complete and cited
  Given the Review practices table
  Then its header has the six columns
  And it has rows for Claude Code, Codex CLI, GSD, bigpowers,
    Superpowers and BMAD, each cited, with no empty cell

Scenario: AC-e03s02-04 self-agreement is cited
  Given the Self-agreement section
  Then every bullet cites a source
  And it covers self-preference, a different model and a fresh context

Scenario: AC-e03s02-05 evidence in review covers mutation testing
  Given the Evidence in review section
  Then every bullet cites a source or says it is unsourced
  And it covers tests run and mutation testing

Scenario: AC-e03s02-06 decisions cover reversibility and escalation
  Given the Decisions and escalation section
  Then every bullet cites a source or says it is unsourced
  And it covers reversibility and escalation to a human

Scenario: AC-e03s02-07 hypotheses have sourced verdicts
  When check-brief.sh runs on the R7 brief with R-id R7
  Then it exits 0
  And every section is non-empty, every cited [S<n>] is listed and
    the headings are in order
```

## 5. Brief content

Headings, in order: `## Sources`, `## Method`, `## Review practices`,
`## Self-agreement`, `## Evidence in review`,
`## Decisions and escalation`, `## Verdicts`,
`## Implications for weftwork`, `## Earns its place vs ceremony`,
`## Open questions`.

## 6. Steps

1. Draft the brief with dated sources, four or more papers → verify:
   task 1 in `e03s02-tasks.yaml`
2. Write Method → verify: task 2
3. Write Review practices → verify: task 3
4. Write Self-agreement → verify: task 4
5. Write Evidence in review, with the mutation-testing search → verify:
   task 5
6. Write Decisions and escalation, with the reversibility search →
   verify: task 6
7. Write Verdicts, Implications, Earns its place, Open questions →
   verify: task 7 (`bash tools/check-brief.sh
   docs/research/R7-review-and-decisions.md R7` plus section, citation
   and heading-order checks)

No ADR covers this story.

The task verify commands check structure, citations and keywords only.
A well-formed brief with a wrong cell or a wrong verdict passes them.
Tasks 5 and 6 accept "unsourced" in place of a citation, as the e01
checkpoint allows, so they cannot tell a weak search from a thorough
one. The human spot-check in the Verification Script and review decide
whether a cell, a search or a verdict is good enough.

The seven task verify commands were tested on 2026-11-08 against
fixtures. A complete brief passes all seven. Each of 23 defects fails
only the task that targets it: three papers; a Method with no date, no
commit or version, no subagent statement or no workflow statement; a
missing BMAD row, an empty cell, an uncited row, a wrong header; no
self-preference, no different model, no fresh context, an uncited
self-agreement bullet; no mutation bullet, no tests-run bullet, a
bullet with neither a citation nor "unsourced" in Evidence in review;
no reversibility bullet, no escalation bullet, the same bare bullet in
Decisions and escalation; no H13 verdict, a cited id not in Sources,
an empty section, and headings out of order. The fixtures ran from the
session scratchpad and are not committed.

## 7. Out of scope

- Running review or decider agents here, or an A/B test of reviewer
  models. A measured experiment is a candidate story for Open
  questions (R10 designs evaluations).
- Re-surveying host ask-user paths (R5), dispatch and integration
  (R6), model tiers and cost (R9), gates and hooks (R13) and loop
  stops (R15). Cite them; do not redo them.
- Choosing weftwork's review or decision design. The brief recommends;
  e04s02 decides.
- URL link checking.

## 8. Risks

- **LLM-as-judge papers are not code review.** Most self-preference
  work tests text generation and chat. Mitigation: say which papers
  test code or code review, and mark transfer to code as inference.
- **The two R4 gaps may stay open.** Mutation testing in review and
  reversibility classes may have no source. Mitigation: record the
  search terms and places in Method, and write "unsourced" rather than
  stretch an adjacent source.
- **Vendor docs describe features, not outcomes.** Mitigation: the
  table describes mechanisms from each tool's own docs; claims about
  outcomes need a paper or a measurement.
- **Fast-moving tools.** Mitigation: record version or commit and
  access date per tool.
- **Secondary summaries.** Mitigation: say in Method which pages came
  through a fetch subagent; spot-check two cells in UAT.
- **Subagents.** At most 2 at once (CONVENTIONS.md).

## Verification Script (human)

1. `bash tools/check-brief.sh docs/research/R7-review-and-decisions.md R7`
   — exit 0.
2. Open the Review practices table. Pick two cells in different rows
   and confirm the cited source is that tool's own docs or repository
   and supports the cell.
3. Read the mutation-testing and reversibility bullets. Confirm each
   either cites a source that covers it or says it is unsourced, and
   that Method records where the search looked.
4. Read the H1, H13 and H14 verdicts and confirm each cites a source and
   follows from the sections above it.
