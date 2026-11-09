# R6 — Multi-agent work in one codebase

Research story R6, wave 3. Hypotheses H11 and H12.

Question: when several agents work in one codebase, how do they share
state, hand off work, isolate their edits, scope the files each may touch,
avoid or resolve merge conflicts, and integrate the result?

## Sources

- [S1] Claude Code documentation, "Worktrees" (`worktrees.md` on code.claude.com, fetched with curl), https://code.claude.com/docs/en/worktrees - accessed: 2026-11-08 published: undated
- [S2] Claude Code documentation, "Agent teams" (an experimental feature, off by default; `agent-teams.md`, fetched with curl), https://code.claude.com/docs/en/agent-teams - accessed: 2026-11-08 published: undated
- [S3] Codex documentation, "Worktrees" (`environments/git-worktrees.md`; the page describes the ChatGPT desktop app, not the command line), https://learn.chatgpt.com/docs/environments/git-worktrees - accessed: 2026-11-08 published: undated
- [S4] Codex documentation, "Subagents" (`agent-configuration/subagents.md`), https://learn.chatgpt.com/docs/agent-configuration/subagents - accessed: 2026-11-08 published: undated
- [S5] GSD, the local copy in `.pi/gsd` (`VERSION` reads 1.30.0; files `workflows/execute-phase.md`, `templates/phase-prompt.md`, `agents/gsd-planner.md`, `agents/gsd-plan-checker.md`); upstream https://github.com/gsd-build/get-shit-done (last commit bdcaab2, 2026-05-31) - accessed: 2026-11-08 published: 2026-03-27
- [S6] bigpowers skills `dispatch-agents` and `kickoff-branch` (raw `SKILL.md` files at commit c19edc7), https://github.com/danielvm-git/bigpowers - accessed: 2026-11-08 published: 2026-11-08
- [S7] weftwork first-hand record: `specs/bugs/BUG-002-gates-skip-worktree.md` and `docs/research/R2-bigpowers.md` - accessed: 2026-11-08 published: 2026-11-08
- [S8] Superpowers skills `subagent-driven-development`, `dispatching-parallel-agents` and `using-git-worktrees` (raw `SKILL.md` files at commit 22f0b46), https://github.com/obra/superpowers - accessed: 2026-11-08 published: 2026-11-03
- [S9] beads README (raw `README.md` at commit f3d688d, committed 2026-11-09T02:57Z, which is 2026-11-08 local time), https://github.com/steveyegge/beads - accessed: 2026-11-08 published: 2026-11-08
- [S10] weftwork R5 brief, `docs/research/R5-harness-capabilities.md` (worktree, subagent and per-dispatch rows) - accessed: 2026-11-08 published: 2026-11-08
- [S11] weftwork R1 brief, `docs/research/R1-gsd.md` - accessed: 2026-11-08 published: 2026-11-08
- [S12] weftwork R14 brief, `docs/research/R14-legacy-retrospective.md` - accessed: 2026-11-08 published: 2026-11-08
- [S13] "CooperBench: Why Coding Agents Cannot be Your Teammates Yet", arXiv:2601.13295 (v2), https://arxiv.org/abs/2601.13295 (abstract only) - accessed: 2026-11-08 published: 2026-01-19
- [S14] "CodeCRDT: Observation-Driven Coordination for Multi-Agent LLM Code Generation", arXiv:2510.18893, https://arxiv.org/abs/2510.18893 (abstract only) - accessed: 2026-11-08 published: 2025-10-18
- [S15] "Multi-agent Collaboration with State Management" (STORM), arXiv:2605.20563, https://arxiv.org/abs/2605.20563 (abstract only) - accessed: 2026-11-08 published: 2026-05-19
- [S16] "Effective Strategies for Asynchronous Software Engineering Agents" (CAID), arXiv:2603.21489 (v2), https://arxiv.org/abs/2603.21489 (abstract only) - accessed: 2026-11-08 published: 2026-03-23
- [S17] "When Parallelism Pays Off: Cohesion-Aware Task Partitioning for Multi-Agent Coding" (Co-Coder), arXiv:2606.00953, https://arxiv.org/abs/2606.00953 (abstract only) - accessed: 2026-11-08 published: 2026-05-31
- [S18] "AI Agent Pull Requests on GitHub: Frequency, Structure, and Merge Conflict Rates", arXiv:2607.04697 (v2), https://arxiv.org/abs/2607.04697 (abstract only) - accessed: 2026-11-08 published: 2026-07-06
- [S19] "ATM: CID-Brokered Pre-Write Admission for Multi-Agent Code Co-Synthesis", arXiv:2607.00041, https://arxiv.org/abs/2607.00041 (abstract only) - accessed: 2026-11-08 published: 2026-06-29
- [S20] "Why Do Multi-Agent LLM Systems Fail?" (MAST), arXiv:2503.13657 (v3), https://arxiv.org/abs/2503.13657 (abstract only) - accessed: 2026-11-08 published: 2025-03-17
