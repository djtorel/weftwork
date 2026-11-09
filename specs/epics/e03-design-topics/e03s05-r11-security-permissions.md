# e03s05 — R11 security and permissions

**type:** research (brief)
**risk:** P2
**context:** infra
**bcps:** 5
**epic:** e03 (Design topics, wave 3)
**research story:** R11, hypotheses H21, H22, H23

Risk note: the epic's P2, as e03s01 to e03s04 used. No code ships and
nothing here can lose data or leak anything. The brief describes
attacks; it does not run them.

Owner decisions on 2026-11-09:

- **Hypotheses.** No hypothesis was assigned to R11. This plan adds
  H21, H22 and H23 to `specs/planning-context.yaml`, with
  `tested_by: [R11]`, and moves every "H1-H20" reference in `specs/`
  to "H1-H23" (the e04 epic, the e04s02 tasks and verify, SCOPE,
  the glossary). Released briefs are not changed.
- **Scope.** R11 reviews evidence only, as R9 did. It runs no
  measurement: no sandbox trials, no injection tests, no skill scans.
  Each measurement the brief needs becomes a candidate story for R10
  (e04s01).

## 1. Purpose

One output: `docs/research/R11-security-permissions.md`. It answers
the R11 question in `specs/planning-context.yaml`: sandboxing, secrets,
destructive commands and prompt injection from repo content, for
autonomous agents. The e01 re-plan added skill and plugin supply-chain
trust: installed skills, scanning before install (checkpoint
`specs/checkpoints/e01-replan.md`, candidate 1). It gives sourced
verdicts for:

- **H21** Sandbox by default: ask for approval only for actions that
  leave the sandbox (network, writes outside the worktree,
  irreversible commands).
- **H22** Skills from outside the project are pinned and scanned
  before install.
- **H23** Repo content is untrusted input: defend against prompt
  injection with permission boundaries, not prompt filters.

Reason for Depth: none. No code, no new abstraction.

## 2. Zoom-out

- **Purpose:** R11 is the fifth design topic of wave 3. It sets the
  safety floor for an autonomous loop: what an agent may do without a
  human, and what it must never trust.
- **Callers:** e04s02 (synthesis) reads the verdicts and the Threats
  and controls table. R13 (e03s07) reads it for which gates must be
  enforced, not advisory. R15 (e03s08) reads Destructive commands for
  hard stops. e05 reads it for CI permissions.
- **Contracts:** the five `brief_rules` H2 headings, dated sources, a
  sourced verdict per hypothesis, papers cited wherever literature
  exists (CONVENTIONS.md §Evidence).
- **Inputs passed forward by earlier briefs:**
  - R0: 26.1% of 31,132 marketplace skills had at least one
    vulnerability, and script-bundling skills were 2.12x likelier to
    [R0 S11]; 157 of 98,380 skills were confirmed malicious [R0 S12].
    Isolation recurs: gh-aw runs agent jobs read-only and sandboxed and
    applies writes through validated safe-outputs jobs [R0 S7]; code
    execution needs a sandbox, resource limits and monitoring
    [R0 S10, vendor post]; skills run with full user privileges
    [R0 S12]. R0: "R11 should treat sandboxing as shared
    infrastructure, not a per-feature choice".
  - R5: per-host hooks that can block a tool call, and permission
    settings (opencode `permissions`, Codex, Claude Code)
    [R5 S1][S7][S9]. R11 cites R5's table; it does not redo it.
  - R7: Claude Code permission modes and auto mode [R7 S22]; Codex
    requires approval for a tool call with a destructive annotation
    and can route approvals to a reviewer agent [R7 S23]; Superpowers
    stops for irreversible, destructive or security-sensitive actions
    [R7 S26]; "Revisable by Design" classes agent actions as
    idempotent, reversible, compensable or irreversible [R7 S30].
  - R14: the legacy guard rules `irreversible_git` and
    `irreversible_fs` never fired outside fixtures [R14 G1, G2].
- **Sources (proposed):** papers through the https arXiv API, ACM or
  Semantic Scholar, broad queries in relevance order, `sleep 5`
  between arXiv calls (the R8 lesson); host docs through raw URLs or
  web fetch, not `gh api` or `api.github.com` (the R6 and R9
  waivers). Candidate topics: indirect prompt injection on coding
  agents and tool use (benchmarks and defences), agent sandboxing and
  least privilege, secret leakage by LLM agents, destructive or
  irreversible agent actions, skill and plugin marketplace security,
  MCP server security.
- No module changes, so `assess-impact` is skipped. No external
  package is added, so slopcheck has nothing to tag.

## 3. Requirements

This story replaces the three placeholder tasks in `e03s05-tasks.yaml`
with eight tasks. It is planning output, not behaviour, so all
requirements are ADDED, except one MODIFIED.

#### MODIFIED: hypothesis range
**Before:** the program had hypotheses H1-H20, and none was assigned
to R11. **After:** H21, H22 and H23 exist with `tested_by: [R11]`, and
the success criteria, the e04 epic, the e04s02 tasks and the glossary
say H1-H23. Rationale: owner decision, 2026-11-09.

#### ADDED: R11 brief
`docs/research/R11-security-permissions.md` passes
`bash tools/check-brief.sh <brief> R11`, so it has the required
headings and a sourced verdict for H21, H22 and H23.

#### ADDED: Papers
`## Sources` lists at least five papers (an arXiv or DOI link each),
including arXiv:2601.10338 and arXiv:2602.06547.

#### ADDED: Method
Under `## Method`: the access date, the version, release or commit
read for each tool, whether any page came through a summarizing
subagent, that no workflow or measurement was run, and the arXiv
queries used.

#### ADDED: Sandboxing
Under `## Sandboxing`, bullets on a default sandbox for a coding agent
(filesystem scope, network access), what needs approval, and writes
outside the worktree. Each bullet cites a source or says it is
unsourced. Input to H21.

#### ADDED: Secrets
Under `## Secrets`, bullets on how credentials (API keys, tokens)
reach an agent run and how they leak. Each bullet cites a source or
says it is unsourced.

#### ADDED: Destructive commands
Under `## Destructive commands`, bullets on irreversible commands
against files and git history, how tools block or confirm them, and
the R14 finding that the legacy guards never fired. Each bullet cites
a source or says it is unsourced. Input to H21.

#### ADDED: Prompt injection from repo content
Under `## Prompt injection from repo content`, bullets on untrusted
content (files, issues, docs, tool output) steering an agent; filters
and detectors against permission boundaries; evidence on coding
agents or its absence. Each bullet cites a source or says it is
unsourced. Input to H23.

#### ADDED: Skill and plugin supply chain
Under `## Skill and plugin supply chain`, bullets on installed skills
and plugins, scanning before install and pinning a version. Each
bullet cites a source or says it is unsourced. Input to H22.

#### ADDED: Threats and controls
Under `## Threats and controls`, one Markdown table. Header:
`| Threat | Control | Enforced by | Residual risk | Evidence |`. At
least five rows: Destructive command, Secret leak, Prompt injection,
Malicious skill, Exfiltration. No empty cell. Every row cites
`[S<n>]` or says `unsourced`. "Enforced by" names a mechanism (a
sandbox, a hook, an approval, a reviewer), not a host product.

## 4. Acceptance criteria (Gherkin)

These IDs are local to this story. No e03 test plan exists.

```gherkin
Scenario: AC-e03s05-01 sources are dated and include papers
  Given the R11 brief with a Sources section
  When check-brief.sh runs with --sources
  Then it exits 0
  And Sources lists at least five arXiv or DOI links
  And Sources lists arXiv:2601.10338 and arXiv:2602.06547

Scenario: AC-e03s05-02 method records what was read and searched
  Given the Method section
  Then it names an access date, a version or commit, the subagent
    use, that no workflow or measurement was run, and the arXiv
    queries

Scenario: AC-e03s05-03 sandboxing covers network and approval
  Given the Sandboxing section
  Then every bullet cites a source or says it is unsourced
  And it covers the sandbox, network access, approval and writes
    outside the worktree

Scenario: AC-e03s05-04 secrets and destructive commands are covered
  Given the Secrets and Destructive commands sections
  Then every bullet cites a source or says it is unsourced
  And Secrets covers credentials, API keys or tokens
  And Destructive commands covers irreversible actions and git

Scenario: AC-e03s05-05 injection weighs filters against boundaries
  Given the Prompt injection from repo content section
  Then every bullet cites a source or says it is unsourced
  And it covers untrusted content, filters, permission boundaries
    and coding agents

Scenario: AC-e03s05-06 supply chain covers scan and pin
  Given the Skill and plugin supply chain section
  Then every bullet cites a source or says it is unsourced
  And it covers supply chain, install, scanning and pinning

Scenario: AC-e03s05-07 the threat table is complete and sourced
  Given the Threats and controls table
  Then its header has the five columns
  And it has rows for Destructive command, Secret leak, Prompt
    injection, Malicious skill and Exfiltration, with no empty cell,
    each cited or marked unsourced

Scenario: AC-e03s05-08 hypotheses have sourced verdicts
  When check-brief.sh runs on the R11 brief with R-id R11
  Then it exits 0
  And every section is non-empty, every cited [S<n>] is listed and
    the headings are in order
```

## 5. Brief content

Headings, in order: `## Sources`, `## Method`, `## Sandboxing`,
`## Secrets`, `## Destructive commands`,
`## Prompt injection from repo content`,
`## Skill and plugin supply chain`, `## Threats and controls`,
`## Verdicts`, `## Implications for weftwork`,
`## Earns its place vs ceremony`, `## Open questions`.

## 6. Steps

Decision reference: every step follows the owner's 2026-11-09
decisions (H21 to H23 added; evidence only, no measurement), recorded
in the plan commit and in the `state.yaml` handoff note.

1. Draft the brief with dated sources, five or more papers including
   the two R0 papers → verify: task 1 in `e03s05-tasks.yaml`
2. Write Method → verify: task 2
3. Write Sandboxing → verify: task 3
4. Write Secrets and Destructive commands → verify: task 4
5. Write Prompt injection from repo content → verify: task 5
6. Write Skill and plugin supply chain → verify: task 6
7. Write Threats and controls → verify: task 7
8. Write Verdicts, Implications, Earns its place, Open questions →
   verify: task 8 (`bash tools/check-brief.sh
   docs/research/R11-security-permissions.md R11` plus section,
   citation and heading-order checks)

No ADR covers this story.

The task verify commands check structure, citations and keywords only.
A well-formed brief with a wrong cell or a wrong verdict passes them.
Tasks 3 to 7 accept "unsourced" in place of a citation, so they cannot
tell a weak search from a thorough one. The human spot-check in the
Verification Script and review decide whether a cell, a search or a
verdict is good enough.

## 7. Out of scope

- Any measurement (owner decision, 2026-11-09): sandbox trials,
  injection tests against a live agent, scans of installed skills.
  Each is a candidate story for R10.
- Running or reproducing an attack. The brief cites them.
- Re-surveying per-host permission and hook settings (R5). Cite R5.
- Reversibility classes for auto-answered questions (R7), gate design
  and escape hatches (R13), loop stop conditions (R15). Cite them; do
  not redo them.
- CI permissions and branch protection setup (e05).
- Choosing weftwork's sandbox product. The table names mechanisms.

## 8. Risks

- **Literature is on chat assistants and web agents, not coding
  agents.** Mitigation: broad arXiv queries over https before any
  absence claim; record them in Method; say "none found" rather than
  stretch an adjacent paper.
- **Vendor claims.** Sandbox and approval behaviour comes from host
  docs. Mitigation: record the version or commit read; label behaviour
  claims as documented, not tested.
- **The hypotheses are new and untested by any earlier brief.**
  Mitigation: a verdict may refine or refute the claim; the owner
  wrote them as drafts on 2026-11-09.
- **Numbers stretched past sources** (the R7, R8 and R9 review
  lesson). Mitigation: check every number and quote against the
  abstract.
- **Subagents.** At most 2 at once (CONVENTIONS.md).

## Verification Script (human)

1. `bash tools/check-brief.sh docs/research/R11-security-permissions.md
   R11` — exit 0.
2. Open the Threats and controls table. Pick two rows and confirm the
   cited source supports the cell, or that "unsourced" is honest.
3. Read Prompt injection from repo content. Confirm it says whether
   coding-agent evidence exists and that Method records the queries.
4. Read Skill and plugin supply chain. Confirm the R0 numbers match
   the arXiv abstracts.
5. Read the H21, H22 and H23 verdicts and confirm each cites a source
   and follows from the sections above it.
