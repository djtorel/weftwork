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

## Method

I read every source on 2026-11-08 and ran no workflow, no parallel agents and no merge experiment. No subagent was used for this brief.

- **Tool docs.** I fetched the Claude Code and Codex pages with `curl` in their `.md` form [S1][S2][S3][S4]. Both are living docs without a publication date. The Codex worktree page describes the ChatGPT desktop app; for the command line I rely on the R5 brief [S10].
- **Tool repositories.** I fetched the raw `SKILL.md` or `README.md` files for bigpowers, Superpowers and beads, and noted the commit read: bigpowers c19edc7, Superpowers 22f0b46, beads f3d688d [S6][S8][S9]. I got those commit ids from the GitHub REST API with `curl`, not `gh api`, to follow the e02s04 waiver (raw URLs and web fetch only). The REST call is still a GitHub API read, so treat that as a small deviation. GSD is the local copy in `.pi/gsd`, version 1.30.0, read only [S5]. I did not read GSD's upstream repository this time.
- **Papers.** I found candidates with web search, which returns snippets and proves nothing. I then read each paper's title, date and abstract from the arXiv API. I did not read any full text, so every number below comes from an abstract and is a preprint claim. Where a snippet gave a figure the abstract did not, I left it out.
- **Not verified.** I did not check which of the eight papers have a peer-reviewed venue. R4 [S11 there] already warns that same-model multi-agent debate is unproven; this brief makes no claim about debate.
- **Cells.** "Not found" in a table cell means absent from the pages listed in Sources, not proof that the feature does not exist.

## Coordination patterns

Six tools, one row each. The columns ask how a tool isolates edits, where agents share state, how work is handed over, whether the files each agent may touch are checked before dispatch, and how results are integrated.

| Tool | Isolation | Shared state | Handoff | Scope check | Integration |
|------|-----------|--------------|---------|-------------|-------------|
| Claude Code | `--worktree` session or subagent `isolation: worktree`; four checks block edits and git redirected into the main checkout, but not shell writes such as `cp` or a redirect [S1] | Agent teams (experimental) keep a shared task list on disk, claimed with file locking, plus a JSON mailbox per agent [S2] | Subagents report back to the main agent; teammates message each other [S2] | None enforced; the docs say to give each teammate a different set of files, because two teammates on one file overwrite each other [S2] | None found; on exit the user keeps or removes the worktree and its branch [S1] |
| Codex CLI | A Git worktree per chat, detached HEAD by default; Git allows a branch in one checkout only [S3]; the command line has a `--worktree` flag per R5 [S10] | None found beyond the repository; subagents return summaries to the main thread [S4] | Handoff moves a chat and its code between Local and Worktree [S3]; subagent results are collected in one response [S4] | None; the docs say to be careful with parallel write-heavy work [S4] | None found beyond Handoff to the local checkout [S3] |
| GSD | Parallel executors start with `isolation="worktree"`; with `parallelization` off, plans in a wave run one by one [S5] | Each executor writes its own SUMMARY.md and updates STATE.md and ROADMAP.md [S5] | Plan frontmatter with `wave`, `depends_on` and `files_modified`; one SUMMARY.md per plan [S5] | Exclusive file ownership declared in `files_modified`; a file in two plans makes the later plan depend on the earlier; I found no mechanical overlap check in the copy read [S5] | If a completion signal is missing, the orchestrator spot-checks commits and SUMMARY.md; a verification subagent checks `must_haves` after all plans; I found no step that merges the worktrees [S5] |
| bigpowers | `kickoff-branch` makes a worktree or a plain branch; a new worktree had no gitignored `scripts/` link, so the gates checked the primary checkout (BUG-002) [S6][S7] | `specs/state.yaml` and a story lock in `specs/agent-locks.yaml` [S6] | Typed envelopes `task_brief`, `checkpoint`, `result`, `circuit_open`; a brief lists `in_scope`, `out_of_bounds` and `verify` [S6] | A manual step: the parent confirms no two tasks write the same file or shared state before dispatch; I found no script that checks it [S6] | The parent reviews results, runs the verify commands, checks diffs for scope violations, merges accepted results and resolves conflicts by hand [S6] |
| Superpowers | `using-git-worktrees` uses the platform's worktree tools first, then `git worktree` [S8] | A plan workspace and ledger shared by implementer and reviewers in one session [S8] | A fresh implementer subagent per task with a crafted brief, then a review package for the reviewer [S8] | Avoided by design: "Never dispatch multiple implementation subagents in parallel (conflicts)"; parallel dispatch is for independent domains with no shared state [S8] | A task review (spec and quality) after each task, then a broad review of the whole branch [S8] |
| beads | None for files; it tracks work, not edits, though its database has native branching [S9] | A dependency graph in a Dolt database; the default embedded mode has a single writer [S9] | `bd ready` lists unblocked work, `bd update <id> --claim` claims it atomically, `bd close` releases dependents [S9] | None for files; the dependency graph decides what is claimable [S9] | `bd dolt push` and `pull` sync with remotes; hash-based ids avoid id collisions on merge [S9] |
