# e03s01 — R6 multi-agent work in one codebase

**type:** research (brief)
**risk:** P2
**context:** infra
**bcps:** 3
**epic:** e03 (Design topics, wave 3)
**research story:** R6, hypotheses H11, H12

Risk note: the BCP heuristic (BCP 3) gives P1, the documentation
heuristic gives P3. This plan proposes the epic's P2, as e02s04 did.
Nothing here can lose data or leak anything, and no code ships.
Decision: pending owner confirmation at plan review.

## 1. Purpose

One output: `docs/research/R6-multi-agent-codebase.md`. It answers the R6
question in `specs/planning-context.yaml`: when several agents work in
one codebase, how do they share state, hand off work, isolate their
edits (worktrees), scope the files each may touch, avoid or resolve
merge conflicts, and integrate the result? It gives sourced verdicts
for H11 (dispatch per subsystem, not per task, to avoid re-learning the
codebase) and H12 (disjoint file scopes checked before dispatch; the
integrator re-verifies the merged result).

Reason for Depth: none. No code, no new abstraction.

## 2. Zoom-out

- **Purpose:** R6 is the first design topic of wave 3. R5 said which
  hosts can isolate and dispatch agents; R6 says how work should be
  split and joined once they do.
- **Callers:** e04s01 (R10 evaluation design) and e04s02 (synthesis)
  read it. R12 also tests H11. R9 (model routing) builds on the same
  dispatch unit.
- **Contracts:** the five `brief_rules` H2 headings, dated sources, a
  sourced verdict per hypothesis, papers cited wherever literature
  exists (CONVENTIONS.md §Evidence).
- **Inputs passed forward by earlier briefs:**
  - R0: multi-agent orchestration and worktrees map to R6. Where state
    lives is open: a git-backed tracker (beads, on Dolt) or plain spec
    files (Backlog.md); the beads README now points to
    `gastownhall/beads`. SCOPE_LATEST.yaml seeds beads, humanlayer,
    ccpm and claude-squad as candidates; popularity lists prove
    nothing.
  - R1: GSD gives no data on cost or merge conflicts for its parallel
    work.
  - R2: bigpowers' worktree mode failed here (BUG-002): a new worktree
    has no gitignored `scripts/` symlink, so the gates checked the
    primary checkout. `dispatch-agents` and `specs/agent-locks.yaml`
    are its multi-agent parts.
  - R3: Superpowers runs subagent-driven development with review
    between tasks.
  - R4: MetaGPT [R4 S6] and ChatDev [R4 S5] are multi-agent papers;
    same-model multi-agent debate is unproven [R4 S11].
  - R5: worktrees are native in Claude Code, Codex CLI and
    (experimentally) Gemini CLI, not found for pi and opencode; R5
    recommends the engine create worktrees itself.
  - R14: the legacy project's delegation epic stopped with fan-out,
    worktree isolation and dispatch stories still open.
- **Sources (proposed, for owner confirmation):** each tool's own docs
  or repository, read through raw URLs or web fetch (not `gh api`, per
  the e02s04 waiver); the R5 sources for Claude Code and Codex CLI may
  be reused; papers through arXiv, ACM or Semantic Scholar.
- No module changes, so `assess-impact` is skipped. No external
  package is added, so slopcheck has nothing to tag.

## 3. Requirements (all ADDED; no existing behavior changes)

#### ADDED: R6 brief
`docs/research/R6-multi-agent-codebase.md` passes
`bash tools/check-brief.sh <brief> R6`, so it has the required headings
and a sourced verdict for H11 and H12.

#### ADDED: Papers
`## Sources` lists at least three papers (an arXiv or DOI link each),
because multi-agent software engineering has a literature (R4,
SCOPE_LATEST.yaml SE-agent surveys).

#### ADDED: Method
Under `## Method`: the access date, the version, release or commit read
for each tool in the table, whether any page came through a summarizing
subagent, and that no workflow was run.

#### ADDED: Coordination patterns
Under `## Coordination patterns`, one Markdown table. Header:
`| Tool | Isolation | Shared state | Handoff | Scope check | Integration |`.
At least six rows, including Claude Code, Codex CLI, GSD, bigpowers,
Superpowers and beads. No empty cell; write `none` or `not found` when
that is the finding. Every row cites at least one `[S<n>]`.

#### ADDED: Failure modes
Under `## Failure modes`, cited bullets on what goes wrong when agents
share a codebase. They cover at least textual merge conflicts and
semantic conflicts (changes that merge cleanly but break together).

#### ADDED: Dispatch granularity
Under `## Dispatch granularity`, cited bullets on the unit of dispatch
(task, story, subsystem) and what each costs in re-learned context.
This is the input to the H11 verdict.

## 4. Acceptance criteria (Gherkin)

These IDs are local to this story. No e03 test plan exists.

```gherkin
Scenario: AC-e03s01-01 sources are dated and include papers
  Given the R6 brief with a Sources section
  When check-brief.sh runs with --sources
  Then it exits 0
  And Sources lists at least three arXiv or DOI links

Scenario: AC-e03s01-02 method records what was read
  Given the Method section
  Then it is not empty and names an access date

Scenario: AC-e03s01-03 the coordination table is complete and cited
  Given the Coordination patterns table
  Then its header has the six columns
  And it has rows for Claude Code, Codex CLI, GSD, bigpowers,
    Superpowers and beads, each cited, with no empty cell

Scenario: AC-e03s01-04 failure modes are cited
  Given the Failure modes section
  Then every bullet cites a source
  And it covers merge conflicts and semantic conflicts

Scenario: AC-e03s01-05 dispatch granularity is cited
  Given the Dispatch granularity section
  Then it has at least one bullet and every bullet cites a source

Scenario: AC-e03s01-06 hypotheses have sourced verdicts
  When check-brief.sh runs on the R6 brief with R-id R6
  Then it exits 0
  And every section is non-empty and every cited [S<n>] is listed
```

## 5. Brief content

Headings, in order: `## Sources`, `## Method`,
`## Coordination patterns`, `## Failure modes`,
`## Dispatch granularity`, `## Verdicts`,
`## Implications for weftwork`, `## Earns its place vs ceremony`,
`## Open questions`.

## 6. Steps

1. Draft the brief with dated sources, three or more papers → verify:
   task 1 in `e03s01-tasks.yaml`
2. Write Method → verify: task 2
3. Write Coordination patterns → verify: task 3
4. Write Failure modes → verify: task 4
5. Write Dispatch granularity → verify: task 5
6. Write Verdicts, Implications, Earns its place, Open questions →
   verify: task 6 (`bash tools/check-brief.sh
   docs/research/R6-multi-agent-codebase.md R6` plus section and
   citation checks)

No ADR covers this story.

The task verify commands check structure, citations and keywords only.
A well-formed brief with a wrong cell or a wrong verdict passes them.
The human spot-check in the Verification Script and review decide
whether a cell or verdict is true.

The six task verify commands were tested on 2026-11-08 against
fixtures, and again after review round 1 tightened tasks 2 and 6. A
complete brief passes all six. Each of sixteen defects fails only the
task that targets it: two papers, a Method with no date, a Method with
no commit or version, a Method with no subagent statement, a Method
with no workflow statement, a missing beads row, an empty cell, an
uncited row, a wrong header, no semantic-conflict bullet, an uncited
failure bullet, an uncited dispatch bullet, no H12 verdict, a cited id
not in Sources, an empty section, and headings out of order. The
fixtures ran from the session scratchpad and are not committed, so the
repository records the result, not the fixtures.

## 7. Out of scope

- Running parallel agents or a merge experiment here. No trial runs of
  workflows; a measured experiment is a candidate story for Open
  questions.
- Re-surveying host capabilities (R5), review between agents (R7),
  model choice per dispatch (R9) and memory across sessions (R12).
  Cite them; do not redo them.
- Choosing weftwork's coordination design. The brief recommends;
  e04s02 decides.
- Fixing BUG-002 or bigpowers' worktree mode. Cite it as evidence.
- URL link checking.

## 8. Risks

- **Popularity is not evidence.** Orchestration tools are many and
  mostly unmeasured. Mitigation: the table describes mechanisms from
  each tool's own docs; claims about outcomes need a paper or a
  measurement.
- **Papers study simulated teams, not shared repositories.** MetaGPT
  and ChatDev split roles, not files. Mitigation: say which papers
  test concurrent edits to one codebase, and mark inference as
  inference.
- **Fast-moving tools.** Mitigation: record version or commit and
  access date per tool.
- **Secondary summaries.** Mitigation: say in Method which pages came
  through a fetch subagent; spot-check two cells in UAT.
- **Subagents.** At most 2 at once (CONVENTIONS.md).

## Verification Script (human)

1. `bash tools/check-brief.sh docs/research/R6-multi-agent-codebase.md R6`
   — exit 0.
2. Open the Coordination patterns table. Pick two cells in different
   rows and confirm the cited source is that tool's own docs or
   repository and supports the cell.
3. Read the H11 and H12 verdicts and confirm each cites a source and
   follows from Failure modes and Dispatch granularity.
