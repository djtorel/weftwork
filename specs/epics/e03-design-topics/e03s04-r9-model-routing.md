# e03s04 — R9 model routing and cost efficiency

**type:** research (brief)
**risk:** P2
**context:** infra
**bcps:** 8
**epic:** e03 (Design topics, wave 3)
**research story:** R9, hypotheses H15, H17, H18, H19, H20

Risk note: the BCP heuristic (BCP 8) gives P0, the documentation
heuristic gives P3. This plan proposes the epic's P2, as e03s01 to
e03s03 did. Nothing here can lose data or leak anything, and no code
ships.
Scope decision: the owner chose on 2026-11-09 that R9 reviews evidence
only. It runs no measurement: no token counts, no coding-task runs
across models or effort levels. Claims without a measurement stay
labelled unproven, and each measurement the brief needs becomes a
candidate story for R10 (e04s01), as in R8.

## 1. Purpose

One output: `docs/research/R9-model-routing.md`. It answers the R9
question in `specs/planning-context.yaml`: sizing tasks before
dispatch (planner against deterministic signals), model size against
reasoning effort, escalate on failure against the right tier up front,
a default tier per role, token efficiency (cache hits, context per
dispatch, per-subsystem dispatch), local models as a tier with limited
parallelism, and budgets. The e01 re-plan added tool-definition context
cost with code-based tool access, and evidence on coding tasks for
routing and effort. It gives sourced verdicts for H15 (tiers not model
names; escalate after N failures; budget ceilings stop the run;
escalations logged), H17 (routing simple tasks to cheaper models keeps
pass rate and cuts cost per accepted task), H18 (reasoning effort is a
separate, useful knob), H19 (start cheap and escalate is cheaper than
picking the tier up front) and H20 (deterministic task-sizing signals
are reliable enough to route on).

Reason for Depth: none. No code, no new abstraction.

## 2. Zoom-out

- **Purpose:** R9 is the fourth design topic of wave 3. It tests the
  cost side of the seed spec: tiers per role and escalation (H15),
  routing (H17, H19, H20) and effort (H18).
- **Callers:** e04s02 (synthesis) reads it for default tiers and
  budgets. R10 (e04s01) reads its candidate measurements. R15 (e03s08)
  shares H15 and reads the Budgets section for stop conditions. R12
  reads Token efficiency for context per dispatch.
- **Contracts:** the five `brief_rules` H2 headings, dated sources, a
  sourced verdict per hypothesis, papers cited wherever literature
  exists (CONVENTIONS.md §Evidence).
- **Inputs passed forward by earlier briefs:**
  - R4: a strong/weak router cut cost over 2x at similar quality on
    general benchmarks [R4 S15]; cascades cut cost up to 98% [R4 S16];
    the best use of test-time compute varies with prompt difficulty, so
    effort is a knob separate from model size [R4 S19]; one agent with
    a planner/executor split and routing [R4 S13]. None is on coding
    tasks. R4: "R9 should find or run one".
  - R0: tool-definition context cost fell from 150,000 to 2,000 tokens
    with on-demand definitions and code-based MCP calls; the only
    source is a vendor post [R0 S10]. Label it unproven.
  - R1: GSD has four model profiles (`quality`, `balanced`, `budget`,
    `inherit`) that map each of 15 agents to opus, sonnet or haiku;
    under `balanced` the planner is opus [R1 S1].
  - R2: every bigpowers `SKILL.md` declares `model:` and `effort:`
    (49 sonnet, 24 haiku, 7 opus); whether hosts honour it and whether
    cheaper models hold quality is unmeasured [R2 S1].
  - R5: per-dispatch model and effort settings per host (pi with
    pi-subagents, Claude Code, Codex CLI, opencode, Gemini CLI)
    [R5 S2][S3][S5][S7]. R9 cites R5's table; it does not redo it.
  - R6: token cost scales with teammates; each dispatch starts cold;
    no source measures re-learning cost or per-subsystem against
    per-task dispatch [R6 S2][S5][S8][S17].
  - R7: the reviewer's model as a setting (Codex `review_model`
    [R7 S23]); cross-model review was mixed [R7 S37].
  - R8: context files raise inference cost by over 20% [R8 S1].
  - R14: the legacy project began on local LLMs [R14 S14].
- **Sources (proposed):** papers through the https arXiv API, ACM or
  Semantic Scholar, broad queries in relevance order, `sleep 5` between
  arXiv calls (the R8 lesson); host docs and pricing pages through raw
  URLs or web fetch, not `gh api` or `api.github.com`. Candidate
  topics: LLM routing and cascades, routing for code generation or
  software engineering agents, reasoning effort or thinking budgets on
  coding benchmarks, task difficulty prediction, prompt caching, tool
  retrieval and tool-definition context, small or local models on
  coding agents, cost-aware agents and budgets.
- No module changes, so `assess-impact` is skipped. No external
  package is added, so slopcheck has nothing to tag.

## 3. Requirements

This story replaces the four placeholder tasks in `e03s04-tasks.yaml`
with nine tasks. It is planning output, not behaviour, so all
requirements are ADDED.

#### ADDED: R9 brief
`docs/research/R9-model-routing.md` passes
`bash tools/check-brief.sh <brief> R9`, so it has the required headings
and a sourced verdict for H15, H17, H18, H19 and H20.

#### ADDED: Papers
`## Sources` lists at least five papers (an arXiv or DOI link each),
because routing, cascades, test-time compute, caching and tool
retrieval have a literature.

#### ADDED: Method
Under `## Method`: the access date, the version, release or commit read
for each tool, the date of any price quoted, whether any page came
through a summarizing subagent, that no workflow or measurement was
run, and the arXiv queries used.

#### ADDED: Task sizing
Under `## Task sizing`, bullets on sizing a task before dispatch: by a
planner model and by deterministic signals (files touched, diff size,
BCPs, test count, and others found). Each bullet cites a source or
says it is unsourced. Input to H20.

#### ADDED: Model size and reasoning effort
Under `## Model size and reasoning effort`, bullets on model size and
reasoning effort as separate settings, and what each buys. It states
whether evidence on coding tasks exists, citing it or saying none was
found. Each bullet cites a source or says it is unsourced. Input to
H18.

#### ADDED: Routing and escalation
Under `## Routing and escalation`, bullets on routing up front against
escalating on failure (cascades), the failure count before escalation,
and evidence on coding tasks or its absence. Each bullet cites a source
or says it is unsourced. Input to H15, H17 and H19.

#### ADDED: Default tier per role
Under `## Default tier per role`, one Markdown table. Header:
`| Role | Default tier | Effort | Escalation | Evidence |`. At least
five rows: Planner, Implementer, Reviewer, Explorer, Verifier. Tiers
are named, not models (H15). No empty cell. Every row cites `[S<n>]`
or says `unsourced`.

#### ADDED: Token efficiency
Under `## Token efficiency`, bullets on prompt cache hits, context per
dispatch, per-subsystem dispatch, and tool-definition context cost with
code-based tool access. Vendor-only claims are labelled unproven. Each
bullet cites a source or says it is unsourced.

#### ADDED: Local models
Under `## Local models`, bullets on local models as a tier: what they
can do in a coding agent and the limit on parallel dispatch. Each
bullet cites a source or says it is unsourced.

#### ADDED: Budgets
Under `## Budgets`, bullets on budget ceilings per run or story, what
stops the run, and logging of escalations (H15). Each bullet cites a
source or says it is unsourced. Stop conditions for loops are R15's;
R9 covers the cost side and cites R15 as the owner of the rest.

## 4. Acceptance criteria (Gherkin)

These IDs are local to this story. No e03 test plan exists.

```gherkin
Scenario: AC-e03s04-01 sources are dated and include papers
  Given the R9 brief with a Sources section
  When check-brief.sh runs with --sources
  Then it exits 0
  And Sources lists at least five arXiv or DOI links

Scenario: AC-e03s04-02 method records what was read and searched
  Given the Method section
  Then it names an access date, a version or commit, the date of
    prices, the subagent use, that no workflow or measurement was run,
    and the arXiv queries

Scenario: AC-e03s04-03 task sizing covers planner and signals
  Given the Task sizing section
  Then every bullet cites a source or says it is unsourced
  And it covers a planner and deterministic signals

Scenario: AC-e03s04-04 size and effort state coding-task evidence
  Given the Model size and reasoning effort section
  Then every bullet cites a source or says it is unsourced
  And it covers model size, reasoning effort and coding tasks

Scenario: AC-e03s04-05 routing covers up front, escalation, coding
  Given the Routing and escalation section
  Then every bullet cites a source or says it is unsourced
  And it covers routing up front, escalation, cascades and coding
    tasks

Scenario: AC-e03s04-06 the tier table is complete and sourced
  Given the Default tier per role table
  Then its header has the five columns
  And it has rows for Planner, Implementer, Reviewer, Explorer and
    Verifier, with no empty cell, each cited or marked unsourced

Scenario: AC-e03s04-07 token efficiency covers the four topics
  Given the Token efficiency section
  Then every bullet cites a source or says it is unsourced
  And it covers caching, context per dispatch, per-subsystem dispatch
    and tool-definition cost, with vendor claims labelled unproven

Scenario: AC-e03s04-08 local models and budgets are covered
  Given the Local models and Budgets sections
  Then every bullet cites a source or says it is unsourced
  And Local models covers parallelism
  And Budgets covers a ceiling and logging escalations

Scenario: AC-e03s04-09 hypotheses have sourced verdicts
  When check-brief.sh runs on the R9 brief with R-id R9
  Then it exits 0
  And every section is non-empty, every cited [S<n>] is listed and
    the headings are in order
```

## 5. Brief content

Headings, in order: `## Sources`, `## Method`, `## Task sizing`,
`## Model size and reasoning effort`, `## Routing and escalation`,
`## Default tier per role`, `## Token efficiency`, `## Local models`,
`## Budgets`, `## Verdicts`, `## Implications for weftwork`,
`## Earns its place vs ceremony`, `## Open questions`.

## 6. Steps

1. Draft the brief with dated sources, five or more papers → verify:
   task 1 in `e03s04-tasks.yaml`
2. Write Method → verify: task 2
3. Write Task sizing → verify: task 3
4. Write Model size and reasoning effort → verify: task 4
5. Write Routing and escalation → verify: task 5
6. Write Default tier per role → verify: task 6
7. Write Token efficiency → verify: task 7
8. Write Local models and Budgets → verify: task 8
9. Write Verdicts, Implications, Earns its place, Open questions →
   verify: task 9 (`bash tools/check-brief.sh
   docs/research/R9-model-routing.md R9` plus section, citation and
   heading-order checks)

No ADR covers this story.

The task verify commands check structure, citations and keywords only.
A well-formed brief with a wrong cell or a wrong verdict passes them.
Tasks 3 to 8 accept "unsourced" in place of a citation, so they cannot
tell a weak search from a thorough one. The human spot-check in the
Verification Script and review decide whether a cell, a search or a
verdict is good enough.

## 7. Out of scope

- Any measurement (owner decision, 2026-11-09): token counts of tool or
  skill listings, coding-task runs across models or effort levels,
  cost per accepted task. Each is a candidate story for R10.
- Choosing weftwork's models or prices. The brief names tiers, not
  models (H15), and quotes prices only as dated examples.
- Re-surveying per-dispatch model and effort fields per host (R5).
  Cite R5.
- Loop stop conditions other than cost (R15), context and memory design
  (R12), and reviewer choice (R7). Cite them; do not redo them.
- Hardware sizing for local models.

## 8. Risks

- **Literature is on chat and reasoning, not coding.** R4 found no
  coding-task routing or effort paper. Mitigation: broad arXiv queries
  over https before any absence claim; record them in Method; say
  "none found" rather than stretch an adjacent paper.
- **Vendor claims.** Tool-definition cost and caching savings come
  from vendor posts. Mitigation: label them unproven and name the
  measurement that would prove them.
- **Prices and models change fast.** Mitigation: date every price and
  model name; the table uses tiers, not model names.
- **Overlap with R15 on budgets.** Mitigation: R9 states cost ceilings
  and escalation logging; R15 owns termination.
- **Numbers stretched past sources** (the R7 and R8 review lesson).
  Mitigation: check every number and quote against the abstract.
- **Subagents.** At most 2 at once (CONVENTIONS.md).

## Verification Script (human)

1. `bash tools/check-brief.sh docs/research/R9-model-routing.md R9`
   — exit 0.
2. Open the Default tier per role table. Pick two rows and confirm the
   cited source supports the cell, or that "unsourced" is honest.
3. Read Model size and reasoning effort, and Routing and escalation.
   Confirm each says whether coding-task evidence exists and that
   Method records the queries.
4. Read Token efficiency. Confirm the tool-definition cost claim is
   labelled unproven unless a paper or measurement backs it.
5. Read the H15, H17, H18, H19 and H20 verdicts and confirm each cites
   a source and follows from the sections above it.
