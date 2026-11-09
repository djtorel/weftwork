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
- [S21] weftwork R0 brief, `docs/research/R0-discovery-sweep.md` (where state lives: tracker or plain files) - accessed: 2026-11-08 published: 2026-11-08

## Method

I read every source on 2026-11-08 and ran no workflow, no parallel agents and no merge experiment. No subagent was used for this brief.

- **Tool docs.** I fetched the Claude Code and Codex pages with `curl` in their `.md` form [S1][S2][S3][S4]. Both are living docs without a publication date. The Codex worktree page describes the ChatGPT desktop app; for the command line I rely on the R5 brief [S10].
- **Tool repositories.** I fetched the raw `SKILL.md` or `README.md` files for bigpowers, Superpowers and beads, and noted the commit read: bigpowers c19edc7, Superpowers 22f0b46, beads f3d688d [S6][S8][S9]. I first got those commit ids and their dates from the GitHub REST API with `curl`, not `gh api`. That still breaks the rule to use raw URLs and web fetch only (the e02s04 waiver ended with that story), so treat it as a small deviation. On 2026-11-09 I re-checked every id without the API: `git ls-remote` shows each repository's HEAD, the raw files at each commit are byte-identical to the copies I read, and each repository's public Atom feed gives the same commit time. For a repository source, `published` is the commit date of the files read. GSD is the local copy in `.pi/gsd`, version 1.30.0, read only [S5]. I did not read GSD's upstream repository this time.
- **Papers.** I found candidates with web search, which returns snippets and proves nothing. I then read each paper's title, date and abstract from the arXiv API. I did not read any full text, so every number below comes from an abstract and is a preprint claim. Where a snippet gave a figure the abstract did not, I left it out.
- **Not verified.** I did not check which of the eight papers have a peer-reviewed venue.
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

## Failure modes

What goes wrong when agents share a codebase. Figures come from abstracts, and each paper uses its own benchmark.

- Textual merge conflicts are common when agents work at once. The authors replayed three-way merges on 747 pairs of concurrent agent-authored pull requests, one pair per repository. Textual conflicts hit 41.7% of cross-agent pairs and 19.8% of same-agent pairs. Of the conflicted files, 84.4% were source files, and nearly 42% of the conflicts were structural (modify/delete or add/add) [S18]. These are pull requests agents opened on GitHub, not the output of one planned decomposition, so the rates show how often overlap happens without coordination.
- Two agents on one file overwrite each other, and the vendors say so. Claude Code's agent teams page: "Two teammates editing the same file leads to overwrites" [S2]. Codex's subagent page: parallel agents editing code at once "can create conflicts and increase coordination overhead" [S4].
- Semantic conflicts survive a clean merge. CodeCRDT reached 100% convergence with zero merge failures and still measured semantic conflict rates of 5-10% [S14]. Its speed results were mixed: up to 21.1% faster on some tasks and up to 39.4% slower on others [S14]. This is one preprint on one stack, read by abstract.
- Features that can be built independently still collide. CooperBench gives two agents different features on real repositories, each implementable alone but liable to conflict. Agents succeeded on average 30% less often together than alone [S13]. The authors trace this to vague or late messages, broken commitments and wrong beliefs about the other agent's plan [S13].
- Multi-agent failures are not only about files. MAST built a taxonomy of 14 failure modes from traces across 7 multi-agent frameworks [S20]. I read only the abstract, so I cannot say which modes apply to concurrent code edits.
- Workspace isolation may only move the conflict. STORM argues that one worktree per agent defers conflict handling to a merge step where recovery is costly, and reports +18.7 on Commit0-Lite against a worktree baseline [S15]. CAID reports the opposite reading of the same primitives: branch-and-merge with test-based integration beat a single agent by 25.6 points on PaperBench and 14.7 on Commit0 [S16]. The two compare against different baselines, so they do not settle which is better.
- Isolation leaks. Claude Code's worktree checks read the target path, the working directory and the command text, but "none of them tracks which files a shell command writes", so `cp` or a redirect into the main checkout is not refused [S1]. In weftwork's own use, the gates of a new worktree evaluated the primary checkout because the gitignored `scripts/` link was missing, so a green result described the wrong tree (BUG-002) [S7].
- Parallel paths may skip enforcement. GSD tells parallel executors to commit with `--no-verify` to avoid pre-commit hook contention [S5]. Any rule enforced by a commit hook is therefore off in GSD's parallel path.
- Shared state files are written from many worktrees. In GSD each parallel executor updates STATE.md and ROADMAP.md [S5]. I did not find how GSD reconciles those writes, so whether they conflict is an inference, not a finding.
- Git allows a branch in one checkout only. Codex notes that a branch checked out in a worktree cannot be checked out locally at the same time [S3]. An engine that creates worktrees must pick branch names so that handoff does not collide.
- Coordination costs tokens and time. Claude Code states that token cost scales linearly with teammates and that more teammates mean more coordination and potential conflicts [S2]. Co-Coder's starting point is that adding agents adds communication overhead that "can sometimes offset the efficiency gains" [S17].

## Dispatch granularity

The unit of dispatch decides how often an agent starts cold. The sources use five units.

- **Per task, one at a time.** Superpowers sends a fresh implementer subagent per task with a review after each, and says what that costs: "a fresh context per task and per review", where an inline run costs one context plus one final reviewer [S8]. It also forbids parallel implementers: "Never dispatch multiple implementation subagents in parallel (conflicts)" [S8].
- **Per independent problem domain.** Superpowers' parallel skill dispatches "one agent per independent problem domain", for example different test files or subsystems, and only when there is no shared state [S8]. It is written for investigating separate failures, not for building a feature.
- **Per plan with declared files.** GSD's unit is a plan whose frontmatter lists `files_modified`, grouped into waves at plan time; each executor loads the full execute-plan context [S5].
- **Per set of files.** Claude Code's agent teams advise that each teammate owns a different set of files. They suggest 3-5 teammates to start, and tasks with clear boundaries that do not write code, because parallel implementation brings the coordination problems [S2].
- **Per dependency community.** Co-Coder builds a dependency graph by static analysis, sets structural hub files apart, and partitions the rest by community detection. Its gains were largest on the most dependency-dense projects, with up to 2.10x speedup and up to 35% lower API cost than its baselines [S17]. CAID uses a central manager that builds a dependency-aware task plan and runs subtasks in isolated workspaces [S16]. Co-Coder's units are file communities found by a tool, not human-named subsystems, and the abstract frames the gain as a communication-versus-computation trade-off [S17].
- **Read-heavy work parallelizes more safely than writing.** Codex recommends parallel agents for exploration, tests, triage and summarization, and care with parallel write-heavy work [S4]. Claude Code's agent teams page gives the same advice for newcomers [S2].
- **A cold start is paid per dispatch.** bigpowers says each agent starts cold, that brief size controls token cost and hallucination risk, and that each agent should get only the decisions relevant to its task [S6].
- **What I did not find.** None of these sources measures what re-learning the codebase costs, or compares one agent per subsystem with one agent per task on the same work [S5][S8][S17].

## Verdicts

- H11: refined - grouping parallel work by how tightly the code is coupled is supported, but the stated reason (avoid re-learning the codebase) is not measured and the supported unit is a dependency community, not a subsystem. Co-Coder partitions by static dependency graph and, against sequential, file-parallel and Claude Code Agent Teams baselines, lifts pass rate by up to 14.0%, speeds up to 2.10x and cuts API cost by up to 35%, with the largest gains on dependency-dense projects [S17]; CAID's manager also plans from a dependency graph [S16]; Claude Code advises one set of files per teammate [S2]. Against it, Superpowers deliberately uses a fresh agent per task and accepts the cold-start cost [S8], and bigpowers briefs each agent cold to limit tokens [S6]. No source measures re-learning cost or compares subsystem dispatch with task dispatch on equal work [S5][S8][S17], and the paper evidence is preprint abstracts.
- H12: refined - the two halves fare differently. Half one, disjoint file scopes checked before dispatch: it is the common mechanism (GSD `files_modified`, bigpowers `in_scope` and `out_of_bounds`, Claude Code's advice) [S5][S6][S2], but in the tools read the check is a planner convention or a manual step, not a mechanical one [S5][S6], and disjoint files do not remove semantic conflicts: CodeCRDT measured 5-10% after clean convergence and CooperBench found 30% lower success on features that could be built independently [S14][S13]. Pre-write admission control is proposed by ATM, within one governance domain and without a claim of superiority [S19]. Half two, an integrator that re-verifies the merged result: supported, since CAID integrates with executable test-based verification and beats single agents [S16], bigpowers' parent runs the verify commands and checks diffs after collecting [S6], and GSD verifies `must_haves` after all plans [S5]. A scope check is necessary but not sufficient; re-verification on the merged tree is the part the sources agree on.

## Implications for weftwork

These are recommendations for e04s02, not decisions.

- Make the overlap check mechanical. Give each parallel task a declared file list, as GSD and bigpowers do, and have the engine refuse to dispatch two parallel tasks whose lists overlap; add a coupling check (shared imports or types) where the stack allows it, because name-disjoint files can still break each other [S5][S6][S14][S13][S17].
- Integrate by re-running the declared verify commands on the merged tree, not by trusting each worktree's own result [S16][S6]. Point every gate at the checkout being judged, since BUG-002 showed gates silently judging the primary checkout [S7].
- Let the engine create worktrees and pick branch names that cannot collide, because hosts differ and Git allows a branch in one checkout only [S10][S3].
- Default to sequential writing and parallelize read-heavy work first (review, exploration, test runs), which Claude Code and Codex advise and Superpowers enforces for implementers [S8][S4][S2].
- Do not skip hooks in the parallel path. GSD's `--no-verify` turns off commit-time rules for parallel executors [S5]; run the gates in the integrator instead.
- Keep shared state files to one writer. The orchestrator should write the state file; parallel agents should return results. beads' claim step is one way to do it, GSD's executors each editing STATE.md is the case to avoid, and this is an inference, not a tested result [S9][S5].
- Do not adopt a coordination database yet. beads adds a Dolt database [S9]; plain files with a single-writer rule are the smaller option, and R0 listed where state lives as an open topic [S21].

## Earns its place vs ceremony

- Earns its place: a mechanical file-overlap check before parallel dispatch. It is cheap and deterministic, and concurrent agent-authored pull requests conflicted textually in 19.8% to 41.7% of replayed merges [S18][S5][S6].
- Earns its place: re-running verify commands on the merged result. It is the one practice that CAID, bigpowers and GSD share [S16][S6][S5].
- Earns its place: engine-created worktrees with gates aimed at them, from weftwork's own failure [S7][S10].
- Ceremony until proven: a fresh subagent plus a two-part review for every task. Superpowers' own docs list the cost, and I found no measurement of the benefit [S8].
- Ceremony until proven: typed message envelopes between agents (`task_brief`, `checkpoint`, `result`, `circuit_open`). No source tests them [S6].
- Ceremony until proven: agent teams that message each other. CooperBench traces coordination failures to jammed or inaccurate messages, and Claude Code marks the feature experimental [S13][S2].
- Ceremony until proven: a lock file for stories, such as `specs/agent-locks.yaml`. It guards one checkout, and I found no evidence it prevents a real conflict [S6].
- Ceremony until proven: a database tracker for coordination [S9].

## Open questions

- Is there a re-learning cost, and how large? Candidate story: measure tokens per dispatch for one agent per task against one per subsystem on a real weftwork task.
- Do disjoint scopes remove most conflicts in practice? Candidate story for R10: two agents on a small repository, with disjoint and then overlapping scopes, counting textual and semantic conflicts.
- The eight papers were read by abstract. Read the full text of CAID, STORM, Co-Coder and CodeCRDT to check baselines, in particular whether "worktree" means the same thing in each, and whether results on Commit0 and PaperBench transfer to documents and YAML [S15][S16][S17][S14].
- Does GSD reconcile parallel writes to STATE.md and ROADMAP.md, and does upstream merge its worktrees? I read only local version 1.30.0 [S5].
- Does the Codex command-line `--worktree` flag behave as the desktop page describes? R5 recorded the flag from docs only [S3][S10].
- Which static dependency tool would give weftwork a coupling check for its chosen stack? That depends on R8 [S17].
- Candidate story: the R14 retrospective found fan-out, worktree isolation and dispatch stories still open when the legacy project stopped. Check whether a live parallel run was ever completed there [S12].
