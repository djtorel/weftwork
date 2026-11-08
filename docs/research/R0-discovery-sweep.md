# R0 — Discovery sweep

Research story R0, wave 1. No assigned hypotheses.
Question: which topics has the owner not thought of, that a host-agnostic
agentic coding workflow should study?

Method: a shallow, single pass over three awesome lists ([S1], [S2],
[S3]), then one primary-source check per idea that looked new. A list
entry is a pointer, never evidence (CONVENTIONS.md §Evidence). Star
counts and "battle-tested" claims are not used anywhere in this brief.
"Published" for a GitHub README is the date of the last commit to
`README.md`, read with the GitHub API on the access date. For a paper it
is the arXiv v1 submission date.

Sections read. [S1]: Configuration & Rules and Agent Orchestration.
[S2]: Virtual Engineering Teams through TDD and Code Quality, Cross-LLM
Collaboration, Research and Discovery, Autonomous Loops, Scope and
Config, Monitoring, Comprehensive Frameworks. [S3]: Quality & Security,
Meta & Orchestration, Research & Analysis, Smart Model Routing, Tool
Assignment. Not read: the remaining sections of each list, the MCP
server tables in [S1], and every per-agent file in [S3].

Search summaries were wrong twice in this sweep. One gave an old title
for [S12]. Another said context files "reduce" task success for [S13],
where the abstract says they do not generally improve it. Every figure
below was therefore checked on the primary page, not taken from a
summary.

## Sources

- [S1] subinium, awesome-claude-code (list), https://github.com/subinium/awesome-claude-code - accessed: 2026-11-08 published: 2026-04-25
- [S2] ithiria894, awesome-claude-code-workflows (list), https://github.com/ithiria894/awesome-claude-code-workflows - accessed: 2026-11-08 published: 2026-03-28
- [S3] VoltAgent, awesome-claude-code-subagents (list), https://github.com/VoltAgent/awesome-claude-code-subagents - accessed: 2026-11-08 published: 2026-11-02
- [S4] steveyegge/beads README (the README badges now point to gastownhall/beads), https://github.com/steveyegge/beads - accessed: 2026-11-08 published: 2026-11-05
- [S5] MrLesk/Backlog.md README, https://github.com/MrLesk/Backlog.md - accessed: 2026-11-08 published: 2026-10-19
- [S6] frankbria/ralph-claude-code README, https://github.com/frankbria/ralph-claude-code - accessed: 2026-11-08 published: 2026-11-04
- [S7] github/gh-aw README (GitHub Agentic Workflows), https://github.com/github/gh-aw - accessed: 2026-11-08 published: 2026-10-26
- [S8] intellectronica/ruler README, https://github.com/intellectronica/ruler - accessed: 2026-11-08 published: 2026-10-21
- [S9] garrytan/gstack README (per-host support table), https://github.com/garrytan/gstack - accessed: 2026-11-08 published: 2026-11-08
- [S10] Anthropic Engineering, "Code execution with MCP: Building more efficient agents", https://www.anthropic.com/engineering/code-execution-with-mcp - accessed: 2026-11-08 published: 2025-11-04
- [S11] "Agent Skills in the Wild: An Empirical Study of Security Vulnerabilities at Scale", arXiv:2601.10338, https://arxiv.org/abs/2601.10338 - accessed: 2026-11-08 published: 2026-01-15
- [S12] "Do Not Mention This to the User": Detecting and Understanding Malicious Agent Skills in the Wild, arXiv:2602.06547 (v4 title; v1 was titled "Malicious Agent Skills in the Wild"), https://arxiv.org/abs/2602.06547 - accessed: 2026-11-08 published: 2026-02-06
- [S13] Gloaguen et al., "Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?", arXiv:2602.11988, https://arxiv.org/abs/2602.11988 - accessed: 2026-11-08 published: 2026-02-12
- [S14] "Where Do AI Coding Agents Fail? An Empirical Study of Failed Agentic Pull Requests in GitHub", arXiv:2601.15195, https://arxiv.org/abs/2601.15195 - accessed: 2026-11-08 published: 2026-01-21
- [S15] "SlopCodeBench: Benchmarking How Coding Agents Degrade Over Long-Horizon Iterative Tasks", arXiv:2603.24755, https://arxiv.org/abs/2603.24755 - accessed: 2026-11-08 published: 2026-03-25
- [S16] "Beyond Compaction: Structured Context Eviction for Long-Horizon Agents", arXiv:2606.11213, https://arxiv.org/abs/2606.11213 - accessed: 2026-11-08 published: 2026-05-01

## What the sweep found

The lists are dominated by topics the plan already covers. Multi-agent
orchestration and worktrees map to R6. Cross-model review loops map to
R7. The `model:` frontmatter field in [S3] (opus, sonnet, haiku by task
type) maps to R9. Memory and ledger plugins map to R12. Spec-driven kits
map to R3. Hook-based guards map to R13. These are not candidates.

Six topics did not map cleanly to any R-story. They are listed below,
each with a primary source. The order is not a ranking.

## Candidate new stories

The owner decides which of these enter `release-plan.yaml`. Candidates 5 and 6 sit close to R12 and R9, so the owner may prefer to fold them in.

- Skill and plugin supply-chain trust for a portable catalog — reason: 26.1% of 31,132 analysed marketplace skills had at least one vulnerability and script-bundling skills were 2.12x likelier to [S11]; 157 of 98,380 skills were confirmed malicious [S12]; R11 names sandboxing, secrets, destructive commands and repo-content injection but not installed skills — touches: H8, H10, R11 goals
- Per-host generation of instruction and skill files — reason: ruler distributes one rule source to many agents' files, lists Pi, and keeps generated files out of git via `.gitignore` [S8], the opposite of H5's committed managed blocks, while one skill pack is "enforced (hooks block)" on Claude Code and "advisory, not blocked" on the other hosts in its table [S9] — touches: H5, H8, H16
- Agents in CI through GitHub Actions — reason: gh-aw compiles Markdown workflows to Actions, runs agent jobs read-only and sandboxed and applies writes through validated safe-outputs jobs, and lists Pi as an engine [S7]; not-merged agent PRs touch more files and often fail the project's CI [S14] — touches: H9, H13, integrate goal, e05
- Run-termination design for autonomous loops — reason: ralph combines a dual exit check (completion indicators AND an explicit EXIT_SIGNAL), a circuit breaker and an hourly rate limit [S6], and H15 names budget ceilings but no story studies stop conditions — touches: H15, H4
- Where state lives: git-backed tracker or plain spec files — reason: beads "replaces messy markdown plans with a dependency-aware graph" on Dolt [S4] while Backlog.md keeps tasks as plain Markdown files in the repo [S5], and H8 rules out a bespoke schema without a story comparing the two bets — touches: H8, H11, R6 and R12 goals
- Tool-definition context cost and code-based tool access — reason: Anthropic reports 150,000 tokens falling to 2,000 (98.7%) by loading tool definitions on demand and calling MCP tools through code, at the price of needing a sandbox [S10] — touches: H2, R9 and R12 goals

## Verdicts

R0 has no assigned hypotheses: none assigned. The sweep tests no
hypothesis. Findings that bear on H1 to H20 are recorded under
Implications as inputs for the stories that own them.

## Implications for weftwork

- **Enforcement is not portable, so the engine cannot rely on hooks.**
  gstack's own table marks safety skills "enforced (hooks block)" on
  Claude Code and "advisory, not blocked" on Codex CLI, OpenCode, Gemini
  CLI and the other hosts listed [S9]. Pi is not in the table. This is
  one project's packaging, not a general finding. It supports H16 (the
  engine checks, the host only calls it) and H1 (evidence over claims),
  and it is an input for R5 and R13.
- **Keep AGENTS.md small.** [S13] finds that context files do not
  generally improve task success and raise inference cost by over 20% on
  average. Instructions in them are followed. Repository overviews are
  not helpful. Files are useful for non-standard practices. R4 should
  take this paper and R8 should test it. R10 can measure it on our own
  files.
- **Measure quality drift, not only pass rate.** [S15] shows no agent
  solving any of its 36 problems end to end, and quality degrading across
  checkpoints (structural erosion and verbosity). R10 should include
  such measures, and R8 gains a concrete failure to guard against.
- **Deterministic context handling has a published design.** [S16]
  uses agent-annotated, dependency-linked episodes and a deterministic
  LLM-free eviction policy. This supports H2 for context management and
  is an input for R12.
- **Isolation recurs across candidates.** [S7] runs agent jobs
  sandboxed by default, [S10] says code execution needs a secure
  execution environment with sandboxing, resource limits and monitoring,
  and [S12] describes skills that run with full user privileges. R11
  should treat sandboxing as shared infrastructure, not a per-feature
  choice.

## Earns its place vs ceremony

Verdict labels: earns its place, ceremony, unproven. A verdict rests on
the cited source only. None rests on popularity.

| Practice seen | Verdict | Why |
| ------------- | ------- | --- |
| Stating per-host enforcement honestly (full, experimental, instruction-only tiers) | earns its place | Cheap, and it stops false assurance on hosts that cannot block ([S9]) |
| Repository overview sections in context files | ceremony | [S13] finds them not helpful |
| Context files limited to non-standard practices | earns its place | [S13] finds such instructions followed and useful |
| Large role catalogs (100+ subagents, "virtual engineering team") | unproven | The lists give no outcome data ([S2], [S3]); H10 favors a small catalog; R10 can test it |
| Circuit breaker, dual exit check, rate limit in autonomous loops | unproven | [S6] describes the design with no outcome data |
| Write gating through validated safe-outputs jobs | unproven | Sound least-privilege design ([S7]) with no measured effect in the README |
| Pre-install scanning of skills | earns its place | Base rates in [S11] and [S12] are high; they come from public marketplaces, so a private catalog may differ |

## Open questions

- Which candidates enter `release-plan.yaml`, and should candidates 5
  and 6 fold into R12 and R9? That is the owner's decision at the e01s03
  re-plan checkpoint.
- Loop termination (candidate 4): one search found no peer-reviewed
  study, only practitioner posts. Two arXiv IDs that blog posts cite
  (2604.08224, 2607.00038) were not opened and are unverified leads.
  The story that follows must search properly.
- State stores (candidate 5): the search surfaced SWE-STEPS
  (arXiv:2604.03035) and LoopsBench (arXiv:2608.00267) on persistent
  state across long task sequences. Neither was opened. The story must
  read them before relying on them.
- Literature for candidates 2 and 6 (host generation, tool-definition
  cost) was not searched. Only practitioner and vendor sources back
  them today.
- The beads README now points to `gastownhall/beads`. Confirm the
  canonical repository before citing it in a later brief.
- Unread parts of the three lists may hold more candidates. The sweep
  was one pass by design, and the missing sections are named in the
  Method paragraph.
