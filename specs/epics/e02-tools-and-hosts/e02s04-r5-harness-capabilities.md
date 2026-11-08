# e02s04 — R5 harness capability matrix

**type:** research (brief)
**risk:** P2
**context:** infra
**bcps:** 5
**epic:** e02 (Tools and hosts, wave 2)
**research story:** R5, hypotheses H8, H9, H16

Risk note: the BCP heuristic (BCP 5 or more) gives P0, the documentation
heuristic gives P3. This plan uses the epic's P2. Nothing here can lose
data or leak anything, and no code ships. Decision: owner confirmed P2 on
2026-11-08, recorded in this spec, in `risk: P2` in `e02s04-tasks.yaml`,
and in the `specs/state.yaml` handoff note.

## 1. Purpose

One output: `docs/research/R5-harness-capabilities.md`. It answers the R5
question in `specs/planning-context.yaml`: for pi, Claude Code, opencode,
Codex CLI and Gemini CLI, which of hooks, subagents, skills, plugins,
worktrees, an ask-user path, and per-dispatch model and effort choice
each host supports, and how each host gets its instruction and skill
files. The features all five share set the host-agnostic core. It gives
sourced verdicts for H8 (portable artifacts, no bespoke schema), H9 (not
a new runtime: compose the hosts' subagent and worktree machinery through
thin adapters) and H16 (host-agnostic engine, thin adapters, skills).

Reason for Depth: none. No code, no new abstraction.

## 2. Zoom-out

- **Purpose:** R5 is the host half of wave 2. R1 to R3 survey workflows;
  R5 surveys the machinery a workflow can rely on in each host.
- **Callers:** e04s01 (R10 evaluation design) and e04s02 (synthesis)
  read it. R13 also tests H16. R6 (worktrees, multi-agent) and R9 (model
  routing) build on its per-dispatch model, effort and worktree rows.
- **Contracts:** the five `brief_rules` H2 headings, dated sources, a
  sourced verdict per hypothesis, papers cited wherever literature
  exists (CONVENTIONS.md §Evidence).
- **Inputs passed forward by earlier briefs:**
  - R0: one project's per-host enforcement table ("advisory, not
    blocked" outside Claude Code), an input for R5 and R13.
  - R1: GSD's multi-host port mixes version tags; note the risk of
    shipping prompt files to several hosts with no common version check.
  - R2: bigpowers' pi support and MCP server were not read; R5 owns host
    support. Skill listings load on demand in Claude Code; R5 checks the
    other hosts.
  - R3: confirm which hosts let weftwork enforce a planning step, a
    short rules file and a verify command. Read the Claude Code
    plan-mode guidance before citing R3 for Claude Code.
  - R4 [S1]: interface design changes agent performance, so adapters may
    not be neutral (an inference, not a finding).
  - R14: how much of the delegation trouble came from local models.
- **Sources (owner decisions, 2026-11-08):** each host's own docs and
  repository, plus the versions of pi (1.5.0) and Claude Code
  (2.1.319) installed on this machine. `../pi-flow-legacy/specs/spikes/`
  may be read, read only, for pi subagent and extension evidence
  (SCOPE_LATEST.yaml lists it as an input to e02s04). The "Code as Agent
  Harness" survey (SCOPE_LATEST.yaml) is a candidate paper for H9 and
  H16; record its arXiv id.
- No module changes, so `assess-impact` is skipped. No external
  package is added, so slopcheck has nothing to tag.

## 3. Requirements (all ADDED; no existing behavior changes)

#### ADDED: R5 brief
`docs/research/R5-harness-capabilities.md` passes
`bash tools/check-brief.sh <brief> R5`, so it has the required headings
and a sourced verdict for H8, H9 and H16.

#### ADDED: Method
Under `## Method`: the pi and Claude Code versions installed here, the
version, release or commit read for opencode, Codex CLI and Gemini CLI,
the access date, and which legacy spikes were read. A capability shown
only by a local check names the command run.

#### ADDED: Capability matrix
Under `## Capability matrix`, one Markdown table. Header:
`| Capability | pi | Claude Code | opencode | Codex CLI | Gemini CLI |`.
One row each, first cell exactly: Hooks, Subagents, Skills, Plugins,
Worktrees, Ask-user path, Per-dispatch model, Per-dispatch effort,
Instruction files, Skill files. No empty cell; write `no` or `unknown`
when that is the finding. Each row cites at least one `[S<n>]`, and a
host's cell rests on that host's own docs, repository or a local check.

#### ADDED: Instruction and skill files
Under `## Instruction and skill files`, one bullet per host, starting
with the host name in bold, cited, saying which file names it reads
(AGENTS.md, CLAUDE.md, GEMINI.md, SKILL.md, ...), where from, and
whether a project would generate, commit or manage them in fenced
blocks.

#### ADDED: Shared core
Under `## Shared core`, the capabilities all five hosts support, each
bullet cited, and the gaps an adapter would have to fill. This is the
input to the H9 and H16 verdicts.

## 4. Acceptance criteria (Gherkin)

These IDs are local to this story. No e02 test plan exists.

```gherkin
Scenario: AC-e02s04-01 sources are dated
  Given the R5 brief with a Sources section
  When check-brief.sh runs with --sources
  Then it exits 0

Scenario: AC-e02s04-02 method records the versions
  Given the Method section
  Then it names a pi version and a Claude Code version

Scenario: AC-e02s04-03 the matrix is complete and cited
  Given the Capability matrix
  Then its header names pi, Claude Code, opencode, Codex CLI, Gemini CLI
  And it has the ten capability rows, each cited, with no empty cell

Scenario: AC-e02s04-04 every host's file loading is described
  Given the Instruction and skill files section
  Then each of the five hosts has a cited bullet

Scenario: AC-e02s04-05 the shared core is cited
  Given the Shared core section
  Then it has at least one cited bullet

Scenario: AC-e02s04-06 hypotheses have sourced verdicts
  When check-brief.sh runs on the R5 brief with R-id R5
  Then it exits 0
```

## 5. Brief content

Headings, in order: `## Sources`, `## Method`, `## Capability matrix`,
`## Instruction and skill files`, `## Shared core`, `## Verdicts`,
`## Implications for weftwork`, `## Earns its place vs ceremony`,
`## Open questions`.

## 6. Steps

1. Draft the brief with dated sources → verify:
   `bash tools/check-brief.sh docs/research/R5-harness-capabilities.md R5 --sources`
2. Write Method → verify: task 2 in `e02s04-tasks.yaml`
3. Write Capability matrix → verify: task 3
4. Write Instruction and skill files → verify: task 4
5. Write Shared core → verify: task 5
6. Write Verdicts, Implications, Earns its place, Open questions →
   verify: `bash tools/check-brief.sh docs/research/R5-harness-capabilities.md R5`

The task 2 to 5 verify commands were tested on 2026-11-08 against
fixtures: each passes on a complete brief and fails on the defect it
targets (missing version, uncited row, empty cell, missing host, uncited
core).

## 7. Out of scope

- Measuring each host's always-loaded skill listing in tokens (R3's
  candidate story). Note it in Open questions.
- Trying capabilities hands-on beyond reading installed versions and
  short local checks. No trial runs of workflows.
- Re-surveying workflows (R1 to R3) or multi-agent practice (R6).
- Choosing the adapter design. The brief recommends; e04s02 decides.
- Hosts beyond the five named (Cline, Aider, Cursor). Name them in Open
  questions if a finding depends on them.
- URL link checking.

## 8. Risks

- **Docs lag the release.** Hosts ship weekly. Mitigation: record the
  version or commit and access date per host; prefer a local check for
  pi and Claude Code.
- **"Supported" hides differences.** A yes in two hosts may mean
  different semantics (blocking vs advisory hooks, as R0 found).
  Mitigation: cells say what the feature does, not only yes or no.
- **pi docs are thin.** Mitigation: use the pi repository and the
  legacy spikes; mark what is unknown.
- **Secondary summaries.** Pages read through a fetch subagent come back
  as summaries. Mitigation: say so in Method for each such source, as R3
  did, and spot-check two cells in UAT.
- **No literature on host capabilities.** Mitigation: say so; cite R4
  papers and the "Code as Agent Harness" survey for the underlying
  ideas.
- **Subagents.** At most 2 at once (CONVENTIONS.md).

## Verification Script (human)

1. `bash tools/check-brief.sh docs/research/R5-harness-capabilities.md R5`
   — exit 0.
2. Open the Capability matrix. Pick two cells in different hosts and
   confirm the cited source is that host's own docs, repository or a
   named local check, and supports the cell.
3. Read the H8, H9 and H16 verdicts and confirm each cites a source and
   follows from the Shared core.
