# e03s07 — R13 enforcement design

**type:** research (brief)
**risk:** P2
**context:** infra
**bcps:** 8
**epic:** e03 (Design topics, wave 3)
**research story:** R13, hypotheses H2, H4, H5, H6, H7, H16, H27

Risk note: the epic's P2, as e03s01 to e03s06 used. No code ships and
nothing here can lose data or leak anything.

Owner decisions on 2026-11-10:

- **Hypotheses.** R13 was assigned H2, H4, H5, H7 and H16, and earlier
  briefs already refined all five. Two parts of the R13 question had
  no hypothesis. This plan adds R13 to H6's `tested_by` (advisory
  skills against enforced hooks), adds H27 to
  `specs/planning-context.yaml` with `tested_by: [R13]` (where state
  lives when two hosts share a repo), and moves every live "H1-H26"
  reference in `specs/` to "H1-H27" (the success criteria, the e04
  epic, the e04s02 tasks and verify, SCOPE, the glossary). Released
  stories, briefs and audit records are not changed.
- **Estimate.** Raised from 5 to 8 BCPs (owner: "raise the estimate if you
  think it's more", 2026-11-10). Seven hypotheses and nine tasks, two of
  them change-request items, against e03s06's six and eight at 5 BCPs,
  which still needed five review rounds. R9 ran 8 BCPs for nine tasks.
  The e03 total moves from 41 to 44; WSJF is not rescored (see
  `release-plan.yaml`).
- **Scope.** R13 reviews evidence only, as R9, R11 and R12 did. It
  runs no measurement and no trial: no hook tests, no gate trials, no
  token counts. Each check the brief needs becomes a candidate story
  for R10 (e04s01).

## 1. Purpose

One output: `docs/research/R13-enforcement-design.md`. It answers the
R13 question in `specs/planning-context.yaml`: advisory skills against
enforced hooks and engine gates, ceremony scaled to risk, escape
hatches, gate retirement, model judgment against deterministic checks,
and SEED §9 (engine CLI against library, and where state lives when
two hosts share a repo). It gives sourced verdicts for:

- **H2** Deterministic where possible: stack facts, commands and gate
  verdicts come from code, not the model. (R4 and R8 refined it.)
- **H4** Gates earn their keep: logged escape hatch, overridden gates
  retired, no hard gate without an observed failure. (R14 refined it.)
- **H5** Merge-safe generated files: hashed managed blocks; human
  edits never overwritten. (R8 refined it.)
- **H6** Workflow first, enforcement second. (R1, R2 and R14 tested
  it.)
- **H7** Ceremony proportional to risk. (R1, R2 and R3 refined it.)
- **H16** Engine split: host-agnostic engine, thin adapters, skills.
  (R5 refined it.)
- **H27** When two hosts share a repo, workflow state lives in one set
  of plain repo files that both reach through the engine, not in a
  host's own store.

For H2, H4, H5, H6, H7 and H16 the brief reads the earlier verdicts
first and says what the R13 evidence adds. It does not redo R1 to R5,
R8 or R14.

Reason for Depth: none. No code, no new abstraction.

## 2. Zoom-out

- **Purpose:** R13 is the seventh design topic of wave 3. It decides
  which rules weftwork leaves to the model, which it enforces, where
  the enforcement runs, and how a gate is waived or retired.
- **Callers:** e04s02 (synthesis) reads the verdicts and the
  Enforcement compared table, and needs SEED §9's engine and state
  answers for the minimum useful first release. R15 (e03s08) reads it
  for which stop conditions are enforced. R10 (e04s01) takes its
  candidate measurements.
- **Contracts:** the five `brief_rules` H2 headings, dated sources, a
  sourced verdict per hypothesis, papers cited wherever literature
  exists (CONVENTIONS.md §Evidence).
- **Inputs passed forward by earlier briefs:**
  - R0: hook-based guards map to R13; one project's gates are
    "advisory, not blocked" outside Claude Code, an input for R5 and
    R13 [R0 S9].
  - R1: GSD ships prompt files for several hosts with no common
    version check; "R5 and R13 should look at this" [R1 S1].
  - R2: a guard hook "does nothing until it is installed", and this
    repo's settings did not register it; "R13 should decide what else
    deserves that form". A gate written as prose is a request. Compute
    the risk score in code and let it set verification depth, "a
    candidate for R13 or R10". State writes need a format-preserving
    writer [R2 S1][S4].
  - R3: no tool scales ceremony by risk with evidence; "the next place
    to look is R10 and R13". Kiro's steering and hooks pages were read
    through a summary only; read them before comparing enforcement in
    R13 [R3 S5][S17].
  - R4: SWE-agent, interface design changes agent results
    (arXiv:2405.15793) [R4 S1]; Agentless, a fixed code-driven
    pipeline (arXiv:2407.01489) [R4 S3]; reading stack facts by command
    is "an untested inference (H2; feeds R8, R13)" [R4 S14].
  - R5: the H16 verdict (refined: every host has a blocking tool-call
    hook and reads `SKILL.md`; three hosts call an out-of-process
    command, two load in-process TypeScript). "Code as Agent Harness"
    was not found [R5 S1][S5][S7][S9][S11].
  - R7: keep the evidence gate separate from review and make it a gate
    the worker cannot write to [R7 S38]; use rule-based escalation
    triggers, because models judge when to ask poorly [R7 S14].
  - R8: the H2 and H5 verdicts; executable checks compiled from
    AGENTS.md reached 88.3% compliance against 67.0% prompt-only
    (ContextCov, arXiv:2603.00822, read as abstract only) [R8 S30].
  - R11: the threats table that gates must enforce; which
    protected-paths list weftwork requires, and who owns it when hosts
    disagree, is "open for the owner and for R13" [R11 S26][S29].
  - R12: keep durable state in plain repo files written by one
    format-preserving tool, "a requirement for R13 and the v1 spec";
    "R13 decides where state lives for two hosts" [R12 S33][S35].
  - R14: the H4 verdict (refined: escape hatch and retirement rule
    designed and unit-tested, but the live ledger holds 0 overrides
    and 1 catch); "do plausible-but-wrong passes show up in
    agent-written verify commands? Candidate story for R13 or R9"
    [R14 S1][S3][S13].
- **This repository as one record.** `specs/state.yaml` holds a
  waiver ledger: gate-trace rule R1 waived every release because the
  project has no code, and request-review waived after capped rounds.
  The brief may cite it as one observed record of overrides from one
  repo, labelled as such, not as a measured rate.
- **Sources (proposed):** papers through the https arXiv API, ACM or
  Semantic Scholar, broad queries in relevance order, `sleep 5`
  between arXiv calls (the R8 lesson); host docs through raw URLs or
  web fetch, not `gh api` or `api.github.com` (the R6 and R9
  waivers). Candidate topics: guardrails and runtime enforcement for
  LLM agents, policy enforcement on tool calls, instruction following
  against executable constraints, human-in-the-loop approval and
  escalation, adaptive process and risk-based verification, alert and
  gate fatigue, and host docs on hooks, permissions and rules (Claude
  Code, Codex, pi, opencode, Kiro steering and hooks).
- No module changes, so `assess-impact` is skipped. No external
  package is added, so slopcheck has nothing to tag.

## 3. Requirements

This story replaces the four placeholder tasks in `e03s07-tasks.yaml`
with nine tasks. It is planning output, not behaviour, so all
requirements are ADDED, except three MODIFIED.

#### MODIFIED: hypothesis range
**Before:** the program had hypotheses H1-H26, and no hypothesis
covered where state lives when two hosts share a repo. **After:** H27
exists with `tested_by: [R13]`, and the success criteria, the e04
epic, the e04s02 tasks and verify, SCOPE and the glossary say H1-H27.
Rationale: owner decision, 2026-11-10.

#### MODIFIED: H6 testers
**Before:** H6 `tested_by: [R14, R1, R2]`. **After:**
`tested_by: [R14, R1, R2, R13]`. Rationale: owner decision,
2026-11-10; advisory against enforced is the core of the R13
question and needs a verdict, not only a section.

#### MODIFIED: change-request tasks
**Before:** the change request of 2026-11-08 added two standalone
tasks, each checked by a grep over the whole brief: locate "Code as
Agent Harness" (task 3) and read Kiro's steering and hooks pages
directly (task 4). **After:** both stay as requirements and keep their
checks, scoped to a section: Kiro in `## Advisory and enforced`
(task 3) and the survey in `## Engine shape and shared state`
(task 7). Rationale: each finding belongs to one section's argument;
no content is dropped.

#### ADDED: R13 brief
`docs/research/R13-enforcement-design.md` passes
`bash tools/check-brief.sh <brief> R13`, so it has the required
headings and a sourced verdict for H2, H4, H5, H6, H7, H16 and H27.

#### ADDED: Papers
`## Sources` lists at least six papers (an arXiv or DOI link each),
including arXiv:2603.00822 (ContextCov) and arXiv:2407.01489
(Agentless).

#### ADDED: Method
Under `## Method`: the access date, the version, release or commit
read for each tool, whether any page came through a summarizing
subagent, that the Kiro pages were read directly, that no workflow or
measurement was run, and the arXiv queries used.

#### ADDED: Advisory and enforced
Under `## Advisory and enforced`, bullets on what each host can
enforce (tool-call hooks, permission rules, engine gates) against
what it only asks of the model (skills, context-file rules), R2's
unregistered guard hook, and Kiro's steering and hooks, read directly.
Cites R2 and R5. Each bullet cites a source or says it is unsourced.
Input to H6 and H16.

#### ADDED: Ceremony scaled to risk
Under `## Ceremony scaled to risk`, bullets on how tools scale
ceremony (size, kind, human choice, declared risk) and any evidence
that risk-scaled verification works. Cites R1, R2 and R3. Each bullet
cites a source or says it is unsourced. Input to H7.

#### ADDED: Escape hatches and gate retirement
Under `## Escape hatches and gate retirement`, bullets on logged
escape hatches, retiring overridden gates, gates added only after an
observed failure, and this repo's waiver ledger as one record. Cites
R14. Each bullet cites a source or says it is unsourced. Input to H4.

#### ADDED: Model judgment and deterministic checks
Under `## Model judgment and deterministic checks`, bullets on which
verdicts come from code and which from the model, and the evidence
for each. Cites R4, R7 and R8. Each bullet cites a source or says it
is unsourced. Input to H2.

#### ADDED: Engine shape and shared state
Under `## Engine shape and shared state`, bullets on SEED §9 (engine
CLI against library), where state lives when two hosts share a repo,
the format-preserving writer, managed blocks in generated files, and
the "Code as Agent Harness" survey (its arXiv id and what it says
about H9 and H16, or the searches run and that it could not be
located). Cites R5 and R12. Each bullet cites a source or says it is
unsourced. Input to H5, H16 and H27.

#### ADDED: Enforcement compared
Under `## Enforcement compared`, one Markdown table. Header:
`| Mechanism | Enforced by | What it stops | Bypass | Evidence |`. At
least six rows: Skill instruction, Context file rule, Tool-call hook,
Engine gate, CI check, Human approval. No empty cell. Every row cites
`[S<n>]` or says `unsourced`. "Enforced by" names a mechanism (model,
harness, engine, CI, human), not a host product.

## 4. Acceptance criteria (Gherkin)

These IDs are local to this story. No e03 test plan exists.

```gherkin
Scenario: AC-e03s07-01 sources are dated and include papers
  Given the R13 brief with a Sources section
  When check-brief.sh runs with --sources
  Then it exits 0
  And Sources lists at least six arXiv or DOI links
  And Sources lists arXiv:2603.00822 and arXiv:2407.01489

Scenario: AC-e03s07-02 method records what was read and searched
  Given the Method section
  Then it names an access date, a version or commit, the subagent
    use, the direct Kiro reading, that no workflow or measurement was
    run, and the arXiv queries

Scenario: AC-e03s07-03 advisory and enforced covers hosts and Kiro
  Given the Advisory and enforced section
  Then every bullet cites a source or says it is unsourced
  And it covers advisory, hook and skill, cites R2 and R5
  And a Kiro bullet names steering and a Kiro bullet names hooks

Scenario: AC-e03s07-04 ceremony cites the earlier H7 verdicts
  Given the Ceremony scaled to risk section
  Then every bullet cites a source or says it is unsourced
  And it covers ceremony, risk and size, and cites R1, R2 and R3

Scenario: AC-e03s07-05 escape hatches cite R14 and the ledger
  Given the Escape hatches and gate retirement section
  Then every bullet cites a source or says it is unsourced
  And it covers escape hatch, retire, override, observed failure and
    waiver, and cites R14

Scenario: AC-e03s07-06 model judgment cites earlier verdicts
  Given the Model judgment and deterministic checks section
  Then every bullet cites a source or says it is unsourced
  And it covers deterministic and model judgment, and cites R4, R7
    and R8

Scenario: AC-e03s07-07 engine shape answers SEED section 9
  Given the Engine shape and shared state section
  Then every bullet cites a source or says it is unsourced
  And it covers CLI, library, two hosts, format-preserving and
    managed block, and cites R5 and R12
  And a bullet on "Code as Agent Harness" gives an arXiv id or says
    no such survey or could not locate

Scenario: AC-e03s07-08 the enforcement table is complete and sourced
  Given the Enforcement compared table
  Then its header has the five columns
  And it has rows for Skill instruction, Context file rule, Tool-call
    hook, Engine gate, CI check and Human approval, with no empty
    cell, each cited or marked unsourced

Scenario: AC-e03s07-09 hypotheses have sourced verdicts
  When check-brief.sh runs on the R13 brief with R-id R13
  Then it exits 0
  And every section is non-empty, every cited [S<n>] is listed and
    the headings are in order
```

## 5. Brief content

Headings, in order: `## Sources`, `## Method`,
`## Advisory and enforced`, `## Ceremony scaled to risk`,
`## Escape hatches and gate retirement`,
`## Model judgment and deterministic checks`,
`## Engine shape and shared state`, `## Enforcement compared`,
`## Verdicts`, `## Implications for weftwork`,
`## Earns its place vs ceremony`, `## Open questions`.

## 6. Steps

Decision reference: every step follows the owner's 2026-11-10
decisions (R13 added to H6; H27 added; evidence only, no measurement),
recorded in the plan commit and in the `state.yaml` handoff note.

1. Draft the brief with dated sources, six or more papers including
   ContextCov and Agentless → verify: task 1 in `e03s07-tasks.yaml`
2. Write Method → verify: task 2
3. Write Advisory and enforced, reading Kiro's steering and hooks
   pages directly → verify: task 3
4. Write Ceremony scaled to risk → verify: task 4
5. Write Escape hatches and gate retirement → verify: task 5
6. Write Model judgment and deterministic checks → verify: task 6
7. Write Engine shape and shared state, locating "Code as Agent
   Harness" → verify: task 7
8. Write Enforcement compared → verify: task 8
9. Write Verdicts, Implications, Earns its place, Open questions →
   verify: task 9 (`bash tools/check-brief.sh
   docs/research/R13-enforcement-design.md R13` plus section,
   citation and heading-order checks)

No ADR covers this story.

The nine verify commands were run against a fixture brief during
plan-work: all nine pass on a well-formed brief; tasks 3, 7, 8 and 9
fail when the Kiro hooks bullet, the survey bullet, the Human approval
row and the H27 verdict are removed; all nine fail with no brief.

The task verify commands check structure, citations and keywords only.
A well-formed brief with a wrong cell or a wrong verdict passes them.
Tasks 3 to 8 accept "unsourced" in place of a citation, so they cannot
tell a weak search from a thorough one. The human spot-check in the
Verification Script and review decide whether a cell, a search or a
verdict is good enough.

## 7. Out of scope

- Any measurement (owner decision, 2026-11-10): hook trials, gate
  trials, override counts across repos, token counts. Each is a
  candidate story for R10.
- Run termination and stop conditions (R15, e03s08). Cite R15 as open.
- Re-surveying per-host hook and permission settings (R5), sandbox and
  threat design (R11), review design (R7) or state format (R12). Cite
  them; do not redo them.
- Choosing weftwork's engine language, packaging or stack (e04s02).
  The brief gives evidence for CLI against library; the synthesis
  decides.
- Changing this repository's own gates or hooks.

## 8. Risks

- **Seven hypotheses for 8 BCPs.** Six already have verdicts from
  earlier briefs. Mitigation: for H2, H4, H5, H6, H7 and H16, state
  the earlier verdict and what R13 adds; do not re-search their whole
  topic. If the estimate breaks again, raise it with the owner rather
  than thin the evidence.
- **Literature is on guardrails for chat and web agents, not coding
  workflows.** Mitigation: broad arXiv queries over https before any
  absence claim; record them in Method; say "none found" rather than
  stretch an adjacent paper.
- **Vendor claims.** Hook and permission behaviour comes from host
  docs. Kiro is closed source. Mitigation: record the version or
  commit read; label behaviour claims as documented, not tested.
- **One-repo evidence.** This repo's waiver ledger and R14's ledger
  are single repositories. Mitigation: label them as one record, not a
  rate.
- **Numbers stretched past sources, and abstracts read in place of
  full text** (the R7 to R12 review lessons). ContextCov was read as
  abstract only by R8. Mitigation: read the full text of any paper
  whose number carries a verdict; check which arms a cited experiment
  ran; search with a plain query as well as a narrow one; count
  matches before a bulk replace; recheck counts after each review
  round.
- **Single-commit story.** e03s06's cycle-time row was meaningless.
  Mitigation: commit in steps, each with the `Story: e03s07` trailer.
- **Subagents.** At most 2 at once (CONVENTIONS.md).

## Verification Script (human)

1. `bash tools/check-brief.sh docs/research/R13-enforcement-design.md
   R13` — exit 0.
2. Open the Enforcement compared table. Pick two rows and confirm the
   cited source supports the cell, or that "unsourced" is honest.
3. Read Advisory and enforced. Confirm the Kiro bullets cite the
   steering and hooks pages themselves, not a summary.
4. Read Engine shape and shared state. Confirm it gives an answer, or
   the evidence for each option, for both SEED §9 questions, and that
   the "Code as Agent Harness" bullet lists the searches run.
5. Read the seven verdicts and confirm each cites a source and follows
   from the sections above it; for H2, H4, H5, H6, H7 and H16, confirm
   it says what changed from the earlier verdict.
