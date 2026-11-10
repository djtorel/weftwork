# e03s06 — R12 context and memory

**type:** research (brief)
**risk:** P2
**context:** infra
**bcps:** 5
**epic:** e03 (Design topics, wave 3)
**research story:** R12, hypotheses H3, H8, H11, H24, H25, H26

Risk note: the epic's P2, as e03s01 to e03s05 used. No code ships and
nothing here can lose data or leak anything.

Owner decisions on 2026-11-09:

- **Hypotheses.** R12 was assigned H3 and H11 only, and R8 and R6
  already refined both. Neither tests compaction, durable state or
  handoffs. This plan adds H24, H25 and H26 to
  `specs/planning-context.yaml`, with `tested_by: [R12]`, and moves
  every "H1-H23" reference in `specs/` to "H1-H26" (the success
  criteria, the e04 epic, the e04s02 tasks and verify, SCOPE, the
  glossary). Released briefs are not changed, except that the owner
  approved correcting R8's H3 verdict and source S33 on 2026-11-09
  (review of R12 showed the S33 claim was wrong).
- **H8.** R12 is added to H8's `tested_by`, so the git-backed tracker
  against plain files comparison (e01 re-plan, candidate 5) ends in a
  sourced verdict that `check-brief.sh` enforces.
- **Scope.** R12 reviews evidence only, as R9 and R11 did. It runs no
  measurement: no compaction trials, no token counts, no handoff
  experiments. Each measurement the brief needs becomes a candidate
  story for R10 (e04s01).

## 1. Purpose

One output: `docs/research/R12-context-memory.md`. It answers the R12
question in `specs/planning-context.yaml`: compaction, durable state,
handoffs across long sessions, and avoiding re-investigation. The e01
re-plan added a comparison of a git-backed tracker with plain spec
files (checkpoint `specs/checkpoints/e01-replan.md`, candidate 5). It
gives sourced verdicts for:

- **H3** We lint our own output: every command and version in
  AGENTS.md resolves to the repo. (R8 refined it.)
- **H8** Portable artifacts (AGENTS.md, SKILL.md, plain YAML and
  Markdown); no bespoke schema. (R5 refined it.)
- **H11** Dispatch per subsystem, not per task, to avoid re-learning
  the codebase. (R6 refined it.)
- **H24** Durable state lives in plain repo files written by one
  format-preserving tool, not in the session transcript.
- **H25** The harness triggers compaction at set context thresholds
  and warns the agent, not only the user.
- **H26** A handoff note written for a session with no memory (state,
  next step, open decisions) avoids re-investigation better than
  resuming a transcript.

For H3, H8 and H11 the brief reads the earlier verdict first and says
what the R12 evidence adds. It does not redo R5, R6 or R8.

Reason for Depth: none. No code, no new abstraction.

## 2. Zoom-out

- **Purpose:** R12 is the sixth design topic of wave 3. It decides
  where a long, autonomous run keeps what it knows, so that a fresh
  session or a fresh agent does not start from nothing.
- **Callers:** e04s02 (synthesis) reads the verdicts and the
  Mechanisms compared table. R13 (e03s07) reads it for where state
  lives when two hosts share a repo. R15 (e03s08) reads Compaction for
  context ceilings as a stop condition. R10 (e04s01) takes its
  candidate measurements.
- **Contracts:** the five `brief_rules` H2 headings, dated sources, a
  sourced verdict per hypothesis, papers cited wherever literature
  exists (CONVENTIONS.md §Evidence).
- **Inputs passed forward by earlier briefs:**
  - R0: beads "replaces messy markdown plans with a dependency-aware
    graph" on Dolt [R0 S4]; Backlog.md keeps tasks as plain Markdown
    in the repo [R0 S5]; tool definitions loaded on demand cut 150,000
    tokens to 2,000 [R0 S10, vendor post]; structured context eviction
    with a deterministic policy, arXiv:2606.11213 [R0 S16].
  - R1: GSD's context-monitor hook warns the agent at set thresholds;
    "R12 should decide the thresholds" [R1 S1]. R1 did not read how
    GSD carries `STATE.md` across sessions: "R12 owns that question".
  - R2: state writes need a format-preserving writer, or the state
    file should be written by one tool only; "R12 and R13 should treat
    this as a requirement" [R2 S1][S4].
  - R4: a context-engineering survey, arXiv:2507.13334 [R4 S12]; one
    agent with context compaction, arXiv:2603.05344 [R4 S13]; keep
    context files short and about non-standard practice,
    arXiv:2602.11988 [R4 S14].
  - R5: the H8 verdict (refined: portable set is `SKILL.md` plus a
    conditionally read `AGENTS.md`; hooks, subagents and plugins have
    per-host schemas) [R5 S1][S5][S7][S9][S11].
  - R6: the H11 verdict (refined: the supported unit is a dependency
    community; re-learning cost is not measured directly) [R6 S17].
  - R8: the H3 verdict (refined: stale instructions are followed; the
    resolution check itself is untested) [R8 S5][S6][S33][S47].
- **Sources (proposed):** papers through the https arXiv API, ACM or
  Semantic Scholar, broad queries in relevance order, `sleep 5`
  between arXiv calls (the R8 lesson); host docs through raw URLs or
  web fetch, not `gh api` or `api.github.com` (the R6 and R9
  waivers). Candidate topics: context compaction and summarization for
  long-horizon agents, context rot and long-context degradation,
  agent memory (episodic, external, file-based), session handoff and
  resumption, repository context files, codebase maps and retrieval
  for coding agents, and host docs on compaction and memory (Claude
  Code, Codex, pi, opencode).
- No module changes, so `assess-impact` is skipped. No external
  package is added, so slopcheck has nothing to tag.

## 3. Requirements

This story replaces the three placeholder tasks in `e03s06-tasks.yaml`
with eight tasks. It is planning output, not behaviour, so all
requirements are ADDED, except two MODIFIED.

#### MODIFIED: hypothesis range
**Before:** the program had hypotheses H1-H23, and R12 was assigned
H3 and H11 only. **After:** H24, H25 and H26 exist with
`tested_by: [R12]`, and the success criteria, the e04 epic, the e04s02
tasks and verify, SCOPE and the glossary say H1-H26. Rationale: owner
decision, 2026-11-09.

#### MODIFIED: H8 testers
**Before:** H8 `tested_by: [R5, R16]`. **After:**
`tested_by: [R5, R16, R12]`. Rationale: owner decision, 2026-11-09;
the storage comparison needs a verdict, not only a section.

#### ADDED: R12 brief
`docs/research/R12-context-memory.md` passes
`bash tools/check-brief.sh <brief> R12`, so it has the required
headings and a sourced verdict for H3, H8, H11, H24, H25 and H26.

#### ADDED: Papers
`## Sources` lists at least six papers (an arXiv or DOI link each),
including arXiv:2606.11213 and arXiv:2603.05344.

#### ADDED: Method
Under `## Method`: the access date, the version, release or commit
read for each tool, whether any page came through a summarizing
subagent, that no workflow or measurement was run, and the arXiv
queries used.

#### ADDED: Compaction
Under `## Compaction`, bullets on when and how a session is compacted
or its context evicted, who triggers it, the thresholds, and whether
the agent is warned. Each bullet cites a source or says it is
unsourced. Input to H25.

#### ADDED: Durable state and handoffs
Under `## Durable state and handoffs`, bullets on what must survive a
session, a resumed transcript against a written handoff note, and a
format-preserving writer. Each bullet cites a source or says it is
unsourced. Input to H24 and H26.

#### ADDED: Git-backed tracker or plain files
Under `## Git-backed tracker or plain files`, bullets comparing beads
and Backlog.md as storage formats against H8, citing R5's verdict.
Each bullet cites a source or says it is unsourced. Input to H8 and
H24.

#### ADDED: Avoiding re-investigation
Under `## Avoiding re-investigation`, bullets on context files,
codebase maps and dispatch per subsystem, citing R6 and R8. Each
bullet cites a source or says it is unsourced. Input to H3 and H11.

#### ADDED: Mechanisms compared
Under `## Mechanisms compared`, one Markdown table. Header:
`| Mechanism | Problem it solves | Where state lives | Triggered by |
Evidence |`. At least six rows: Compaction, Context eviction, Handoff
note, State file, Git-backed tracker, Context file. No empty cell.
Every row cites `[S<n>]` or says `unsourced`. "Triggered by" names a
mechanism (harness, hook, model, human, tool), not a host product.

## 4. Acceptance criteria (Gherkin)

These IDs are local to this story. No e03 test plan exists.

```gherkin
Scenario: AC-e03s06-01 sources are dated and include papers
  Given the R12 brief with a Sources section
  When check-brief.sh runs with --sources
  Then it exits 0
  And Sources lists at least six arXiv or DOI links
  And Sources lists arXiv:2606.11213 and arXiv:2603.05344

Scenario: AC-e03s06-02 method records what was read and searched
  Given the Method section
  Then it names an access date, a version or commit, the subagent
    use, that no workflow or measurement was run, and the arXiv
    queries

Scenario: AC-e03s06-03 compaction covers triggers and warnings
  Given the Compaction section
  Then every bullet cites a source or says it is unsourced
  And it covers compaction, eviction, thresholds and warnings

Scenario: AC-e03s06-04 durable state compares transcript and handoff
  Given the Durable state and handoffs section
  Then every bullet cites a source or says it is unsourced
  And it covers the transcript, the handoff, a format-preserving
    writer and the session

Scenario: AC-e03s06-05 storage comparison is tied to H8
  Given the Git-backed tracker or plain files section
  Then every bullet cites a source or says it is unsourced
  And it covers git-backed, plain, schema and cites R5

Scenario: AC-e03s06-06 re-investigation cites earlier verdicts
  Given the Avoiding re-investigation section
  Then every bullet cites a source or says it is unsourced
  And it covers re-investigation, context files and subsystems, and
    cites R6 and R8

Scenario: AC-e03s06-07 the mechanisms table is complete and sourced
  Given the Mechanisms compared table
  Then its header has the five columns
  And it has rows for Compaction, Context eviction, Handoff note,
    State file, Git-backed tracker and Context file, with no empty
    cell, each cited or marked unsourced

Scenario: AC-e03s06-08 hypotheses have sourced verdicts
  When check-brief.sh runs on the R12 brief with R-id R12
  Then it exits 0
  And every section is non-empty, every cited [S<n>] is listed and
    the headings are in order
```

## 5. Brief content

Headings, in order: `## Sources`, `## Method`, `## Compaction`,
`## Durable state and handoffs`,
`## Git-backed tracker or plain files`,
`## Avoiding re-investigation`, `## Mechanisms compared`,
`## Verdicts`, `## Implications for weftwork`,
`## Earns its place vs ceremony`, `## Open questions`.

## 6. Steps

Decision reference: every step follows the owner's 2026-11-09
decisions (H24 to H26 added; R12 added to H8; evidence only, no
measurement), recorded in the plan commit and in the `state.yaml`
handoff note.

1. Draft the brief with dated sources, six or more papers including
   the two compaction papers → verify: task 1 in `e03s06-tasks.yaml`
2. Write Method → verify: task 2
3. Write Compaction → verify: task 3
4. Write Durable state and handoffs → verify: task 4
5. Write Git-backed tracker or plain files → verify: task 5
6. Write Avoiding re-investigation → verify: task 6
7. Write Mechanisms compared → verify: task 7
8. Write Verdicts, Implications, Earns its place, Open questions →
   verify: task 8 (`bash tools/check-brief.sh
   docs/research/R12-context-memory.md R12` plus section, citation
   and heading-order checks)

No ADR covers this story.

The eight verify commands were run against a fixture brief during
plan-work: all eight pass on a well-formed brief; tasks 7 and 8 fail
when the Context file row and the H26 verdict are removed; all eight
fail with no brief.

The task verify commands check structure, citations and keywords only.
A well-formed brief with a wrong cell or a wrong verdict passes them.
Tasks 3 to 7 accept "unsourced" in place of a citation, so they cannot
tell a weak search from a thorough one. The human spot-check in the
Verification Script and review decide whether a cell, a search or a
verdict is good enough.

## 7. Out of scope

- Any measurement (owner decision, 2026-11-09): compaction trials,
  token counts of this repo's state files, handoff experiments. Each
  is a candidate story for R10.
- Where state lives when two hosts share a repo, and engine CLI
  against library (R13, SEED §9). Cite R13 as open.
- Re-surveying per-host settings (R5), multi-agent dispatch (R6) or
  context-file content rules (R8). Cite them; do not redo them.
- Tool-definition cost and model routing (R9). Cite R9.
- Choosing weftwork's memory or tracker product. The table names
  mechanisms.

## 8. Risks

- **Literature is on chat and web agents, not coding agents.**
  Mitigation: broad arXiv queries over https before any absence
  claim; record them in Method; say "none found" rather than stretch
  an adjacent paper.
- **Vendor claims.** Compaction and memory behaviour comes from host
  docs. Mitigation: record the version or commit read; label
  behaviour claims as documented, not tested.
- **Six hypotheses for 5 BCPs.** Three already have verdicts from R5,
  R6 and R8. Mitigation: for H3, H8 and H11, state the earlier verdict
  and what R12 adds; do not re-search their whole topic.
- **The new hypotheses are drafts.** Mitigation: a verdict may refine
  or refute the claim; the owner accepted them as drafts on
  2026-11-09.
- **Numbers stretched past sources, and abstracts read in place of
  full text** (the R7 to R11 review lessons). Mitigation: read the
  full text of any paper whose number carries a verdict; check what a
  cited experiment turned off; search with a plain query as well as a
  narrow one.
- **Subagents.** At most 2 at once (CONVENTIONS.md).

## Verification Script (human)

1. `bash tools/check-brief.sh docs/research/R12-context-memory.md
   R12` — exit 0.
2. Open the Mechanisms compared table. Pick two rows and confirm the
   cited source supports the cell, or that "unsourced" is honest.
3. Read Compaction. Confirm it names the thresholds R1 asked for, or
   says none is sourced.
4. Read Git-backed tracker or plain files. Confirm it quotes R5's H8
   verdict and compares the storage format only.
5. Read the six verdicts and confirm each cites a source and follows
   from the sections above it; for H3, H8 and H11, confirm it says
   what changed from the earlier verdict.
