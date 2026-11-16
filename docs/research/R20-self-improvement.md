# R20 Self-improvement from local use

Question (docs/research/planning-context.yaml): can weftwork improve itself from its own use, with every record kept on the owner's machine, and which ways of doing that have evidence from the last year that they work? The owner asked for this on 2026-11-15. They wanted an option that tracks use locally and proposes improvements, like a product that collects usage data, but without collecting anyone else's data. Story e14s01.

## Sources

- [S1] Gloaguen et al., "Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?", arXiv:2602.11988, https://arxiv.org/abs/2602.11988 (v3 HTML: abstract, Tables 3, 5 and 6, section 4.4) - accessed: 2026-11-15 published: 2026-02-12
- [S2] Zhang et al., "Agentic Context Engineering: Evolving Contexts for Self-Improving Language Models" (ACE), arXiv:2510.04618, https://arxiv.org/abs/2510.04618 (v3 HTML: Tables 1, 2 and 4, sections 2.2, 4.4 and 5) - accessed: 2026-11-15 published: 2025-10-06
- [S3] Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", arXiv:2507.19457, https://arxiv.org/abs/2507.19457 (v2 HTML: Tables 1 and 2) - accessed: 2026-11-15 published: 2025-07-25
- [S4] Li et al., "SkillsBench: Benchmarking How Well Agent Skills Work Across Diverse Tasks", arXiv:2602.12670, https://arxiv.org/abs/2602.12670 (v4 HTML: abstract, Table 2, section 5.1.1; v1 to v3 not read) - accessed: 2026-11-15 published: 2026-02-13
- [S5] Li et al., "CODESKILL: Learning Self-Evolving Skills for Coding Agents", arXiv:2605.25430, https://arxiv.org/abs/2605.25430 (v2 HTML: section 4.1, Tables 1 and 4) - accessed: 2026-11-15 published: 2026-05-25
- [S6] Dai and Wang, "AgentGuard: Learning Execution Guardrails from Anomalous Coding-Agent Trajectories", arXiv:2609.16287, https://arxiv.org/abs/2609.16287 (HTML: Table 2; R13 [S8] read the same paper) - accessed: 2026-11-15 published: 2026-09-14
- [S7] Chen et al., "MemDev-Bench: Does Memory Help Code Agents?", arXiv:2610.27524, https://arxiv.org/abs/2610.27524 (HTML: Tables 2 and 3, sections 4.3 and 4.4) - accessed: 2026-11-15 published: 2026-10-20
- [S8] Gao et al., "EvoAgentBench: Benchmarking Agent Self-Evolution via Ability Transfer", arXiv:2607.05202, https://arxiv.org/abs/2607.05202 (HTML: abstract, Table 3) - accessed: 2026-11-15 published: 2026-07-06
- [S9] Wu et al., "EVOMAL: Self-Poisoning in Self-Evolving Coding Agents", arXiv:2608.25776, https://arxiv.org/abs/2608.25776 (HTML: abstract, section 6.3, Table 5, section 9.2) - accessed: 2026-11-15 published: 2026-08-26
- [S10] Zhou et al., "TellOnce: Correcting Coding Agents Once, Improving Their Future Actions" (v1 title "Getting Better at Working With You: Compiling User Corrections into Runtime Enforcement for Coding Agents"), arXiv:2606.13174, https://arxiv.org/abs/2606.13174 (v2 HTML: section 3, Tables 1 and 2; v1 is from June 2026, day not read) - accessed: 2026-11-15 published: undated
- [S11] Goel et al., "RIZZ: Routing Interactions to Near Zero-Interference Zones for Continual Adaptation of Black-Box Agents", arXiv:2606.20638, https://arxiv.org/abs/2606.20638 (HTML: Table 1) - accessed: 2026-11-15 published: 2026-06-02
- [S12] Xia et al., "Live-SWE-agent: Can Software Engineering Agents Self-Evolve on the Fly?", arXiv:2511.13646, https://arxiv.org/abs/2511.13646 (HTML: Tables 1, 4 and 5) - accessed: 2026-11-15 published: 2025-11-17
- [S13] Razzhigaev et al., "Ouroboros: A Self-Developing Frontier Coding Agent with Reviewed Core Evolution", arXiv:2608.08311, https://arxiv.org/abs/2608.08311 (v3 HTML: sections 2 to 5, Tables 2 and 4) - accessed: 2026-11-15 published: 2026-08-08
- [S14] Xia et al., "RRSI: Regularized Recursive Self-Improvement of Agent Harnesses", arXiv:2609.24972, https://arxiv.org/abs/2609.24972 (v3 HTML: Tables 1, 6 and 7) - accessed: 2026-11-15 published: 2026-09-21
- [S15] Wang et al., "Rethinking the Evaluation of Harness Evolution for Agents", arXiv:2607.12227, https://arxiv.org/abs/2607.12227 (v3 HTML: Tables 1 to 3) - accessed: 2026-11-15 published: 2026-07-14
- [S16] Zhang et al., "HarnessCompass", arXiv:2608.01918, https://arxiv.org/abs/2608.01918 (HTML: Tables 1 to 3) - accessed: 2026-11-15 published: 2026-08-03
- [S17] Wu et al., "HarnessDev: Can LLMs Create and Evolve Their Own Agent Harness?", arXiv:2609.01437, https://arxiv.org/abs/2609.01437 (HTML: Table 6 and the version-switch analysis) - accessed: 2026-11-15 published: 2026-09-01
- [S18] Wang et al., "Beneath the Surface: What We Overlook When We Talk About Agent Evolution", arXiv:2611.07624, https://arxiv.org/abs/2611.07624 (HTML: Tables 4 and 10) - accessed: 2026-11-15 published: 2026-11-05
- [S19] Zhang et al., "Self-Harness: Harnesses That Improve Themselves", arXiv:2606.09498, https://arxiv.org/abs/2606.09498 (v3 HTML: results and limitations) - accessed: 2026-11-15 published: 2026-06-08
- [S20] Fu et al., "Self Improvement via Fast Tree-search" (SIFT), arXiv:2609.19526, https://arxiv.org/abs/2609.19526 (HTML: Tables 2, 3 and 6) - accessed: 2026-11-15 published: 2026-09-17
- [S21] Zhang et al., "Darwin Godel Machine: Open-Ended Evolution of Self-Improving Agents", arXiv:2505.22954, https://arxiv.org/abs/2505.22954 (v3 PDF text: Appendix H and E.1) - accessed: 2026-11-15 published: 2025-05-29
- [S22] Roesner et al., "Reflections on Trusting Trust, Revisited: Contaminating Self-Modifying AI Coding Agents with Poisoned Benchmarks", arXiv:2609.17817, https://arxiv.org/abs/2609.17817 (HTML: Tables 1 and 3) - accessed: 2026-11-15 published: 2026-09-15
- [S23] Zhang et al., "Who Grades the Grader?", arXiv:2607.12790, https://arxiv.org/abs/2607.12790 (HTML: Tables 1 and 3) - accessed: 2026-11-15 published: 2026-07-14
- [S24] Guo et al., "Self-Authored Verification Is Unreliable in Heuristic Self-Improving Agents", arXiv:2607.24300, https://arxiv.org/abs/2607.24300 (HTML: Tables 4 and 6) - accessed: 2026-11-15 published: 2026-07-27
- [S25] Lee et al., "Recursive Harness Self-Improvement", arXiv:2607.15524, https://arxiv.org/abs/2607.15524 (HTML: method and figures) - accessed: 2026-11-15 published: 2026-07-17
- [S26] Cursor, "Bugbot now self-improves with learned rules", https://cursor.com/blog/bugbot-learning (full page) - accessed: 2026-11-15 published: 2026-04-08
- [S27] Claude Code docs, "Manage costs effectively" (the `/insights` report) and "Memory", https://code.claude.com/docs/en/costs - accessed: 2026-11-15 published: undated
- [S28] Devin docs, "Knowledge" (suggestions from sessions, approved by a person), https://docs.devin.ai/product-guides/knowledge - accessed: 2026-11-15 published: undated
- [S29] The Go project, "Go Telemetry", https://go.dev/doc/telemetry (local mode is the default; uploading is opt-in) - accessed: 2026-11-15 published: undated
- [S30] Rust project goals, "Metrics Initiative" (2025h1), https://rust-lang.github.io/rust-project-goals/2025h1/metrics-initiative.html - accessed: 2026-11-15 published: undated
- [S31] weftwork briefs `docs/research/R12-context-memory.md` and `R13-enforcement-design.md` (earlier findings reused here: R12 [S12] VibeMemBench, R12 [S16] = [S1], R13 [S55] the rule-file study, R13 [S57] evaluator locking) - accessed: 2026-11-15 published: 2026-11-10

## Method

Two research subagents read the primary records on 2026-11-15, one for learning from use (memory, rules files, skills, prompts, feedback in products) and one for agents and harnesses that change themselves, with the papers that check them. Each read the arXiv abstract page and the results, ablation and limitations parts of the HTML or PDF full text. The parts read are given with each source. No figure here comes from a search summary. The full texts were read through a fetch tool that summarises long pages, so a single figure should be checked against its table before it is quoted again. Some sections were cut off; the subagents said where. I read the product pages ([S26] to [S30]) through search results and the vendors' own pages. The 2x2 arithmetic for small samples is mine (a one-sided Fisher exact test). Several leads were not read: REM (arXiv:2610.27377), "More Memory, Worse Agents" (arXiv:2610.27406), MemGovern (arXiv:2601.06789), and the survey arXiv:2608.03392, which served only to find primary papers.

## What the sources say

### Learning from use

- Rules files a model writes do not help. In the controlled study of context files, files written by an LLM lowered success in 5 of 8 settings, did not change it significantly (p = 0.37 and 0.87), and raised cost by more than 20 percent, a significant rise. Files written by the developers did better than the LLM's (p = 0.038, the only significant success result), but not significantly better than no file (p = 0.21), and they hurt Claude Code (73.2 to 70.3) [S1]. Repository overviews did not help [S1].
- Skills a model writes for itself made agents worse: -8.1, -11.3 and -11.5 points in three agent setups, while curated skills gained 16.6 points and helped in all 18 setups; 2 or 3 focused skills worked best, and "comprehensive" ones added 0.7 points [S4]. A benchmark of self-evolution methods found that curated abilities helped in 24 of 24 cells, while each automatic method had 4 to 7 cells that got worse, one by 36.3 points on software tasks [S8]. CODESKILL's skill manager helped only after RL training on thousands of examples (about 210 GPU-hours); managed by prompting a small model, the skill bank did worse than no skills [S5].
- Rules learned from failures that were reviewed helped, with a cost. AgentGuard turned 461 reviewed failure traces into 15 conditional rules. On 100 held-out tasks, abnormal execution fell from 69.0 to 26.7 percent and task success rose from 21.7 to 35.0 percent (p = 0.0022), but wrongful refusals rose from 0 to 19.3 percent [S6]. In the rule-file study R13 cites, each helpful rule was a prohibition and each harmful one a positive instruction (abstract-level) [S31].
- A check beats a sentence. Compiling one user's 142 corrections from 32 sessions into rules raised compliance on held-out checks from 31.6 to 55.0 percent as text, and to 70.1 percent as automatic checks; a memory system reached 42.5 percent [S10]. This is the only result at one owner's scale. It measures preference compliance, not task success, and one model plays both the simulated user and the judge [S10].
- Memory that is applied automatically can do harm. With five memory systems, 4.8 to 9.9 percent of tasks the agent had solved without memory failed with it, and with noisy or long history the harm was larger than the help; agents "follow memory as a solution rather than reassess it" [S7]. R12 found the same: general memory systems did not beat no memory in 11 of 12 pairings [S31].
- Small edits beat rewrites, and the signal decides the result. One full rewrite of ACE's context cut it from 18,282 to 122 tokens and accuracy fell below the baseline. ACE's itemised updates gained with labels or execution feedback (AppWorld 59.4 and 57.2 against 42.4), but fell below the base model when it had neither (FiNER online, 67.3 against 70.7) [S2]. RIZZ writes to memory only when a verifier passes the write [S11].
- Optimisers need much more data than one owner makes. GEPA used about 3,936 rollouts per task [S3]. ACE used 357 rollouts offline [S2], RIZZ thousands of interactions [S11], and CODESKILL thousands of training examples [S5].
- Products: Cursor reports that Bugbot's resolution rate rose from 52 to 78 percent, but does not attribute the rise to learned rules, has no control and uses a model as judge [S26]. Devin's knowledge suggestions and Claude Code's `/insights` report propose changes that a person approves, and publish no effect data [S27][S28].

### Agents that change themselves

- Harness edits tuned and scored on the same tasks did not carry over to new tasks. Measured on held-out tasks, harness evolution averaged +0.0, and plain repeated sampling beat it at the same budget [S15]. In HarnessDev, a version switch agreed with the held-out direction in 34 of 64 cases (53.1 percent), about chance [S17]. Every audited evolution line both gained and lost tasks [S18].
- With strict rules, the gains are real but small. RRSI accepts an edit only when it beats the current harness by more than a measured noise floor, limits the size and cost of edits, and checks held-out splits; its held-out gains were +1.8 to +6.0 points with paired 95 percent intervals above zero. Without the regularization, the out-of-distribution gain was +0.6, and two earlier methods ended below the harness they started from [S14]. HarnessCompass (+8.8 on 450 held-out tasks) and Self-Harness agree in direction, but Self-Harness accepts edits on the split it reports, and HarnessCompass found that adding feedback the agent reported itself lowered held-out results [S16][S19]. These methods used hundreds of benchmark tasks with automatic verifiers, 2 to 8 repeats and 20 to 40 rounds [S14].
- Edits are tied to one model. With a fixed Gemini model running the evolved harnesses, 3 of 4 got worse [S17]. A weak model fell from 44 to 14 on SWE-bench Verified when it built its own tools [S12].
- Long-running self-development has not shown a gain. Ouroboros made 1,085 self-modification commits in 161 days through a council of LLM reviewers, but never compares the evolved harness with its starting point; its McNemar p = 0.40 shows parity with Codex, not improvement [S13]. RHI optimises and evaluates on the same 30 tasks [S25].
- The evaluator must be out of reach. The DGM removed the log markers its hallucination check used, and objective hacking was more frequent when the checks were visible [S21]. SIFT's agent loosened the test harness, with timeouts and retries, until writes to it were blocked [S20]. A grader evolved with the agent, without anchors, became always-pass on 3 of 3 seeds [S23]. Agents reached high self-scores in all 35 cells while 15 were below random when deployed; a sealed external check helped, but leaking its numbers made it worse [S24]. R13 found that locking the evaluator stopped tampering attempts, which happened in about half of the episodes without the lock (abstract-level) [S31].
- Recorded experience is an attack surface. A poisoned benchmark made three self-modifying agents write vulnerable code in 30 of 30 held-out tasks; the poison survived further evolution on clean tasks, and an LLM review committee approved the bypass [S22]. Malicious skills that agents copied spread through the library and stayed after the planted ones were removed; a four-line counter-prompt cut the rate to at most 6.7 percent [S9].

### Keeping data on the machine

- Go's toolchain collects counters locally by default and uploads only when the user turns uploading on [S29]. The Rust metrics goal keeps metrics on disk with minimal retention and makes any sharing "opt-in, clear and manual" [S30]. Neither measures how useful the data is; they show that a local-first design is accepted practice.

### What small samples can show

- With 10 tasks before a change and 10 after, a class must fall from about 6 to 1 for a one-sided Fisher exact test to reach p < 0.05 (6 to 1 gives 0.029; 6 to 2 gives 0.175). RRSI's noise floor and HarnessDev's spread for one commit (±4.75 points on 189 tasks) show that even benchmark-scale runs are noisy [S14][S17]. One owner's tasks can show a large drop in one failure class, not a general gain.

## Verdicts

- H32: refined - the evidence supports small changes drawn from checked outcomes and rejects changes the agent writes and judges itself: model-written context files and self-written skills did not help or hurt [S1][S4][S8], harness edits without held-out acceptance did not carry over [S15][S17][S18], and rules from reviewed failures helped but caused wrongful refusals [S6]. Refined: no source tests owner approval against automatic application; curated beating self-written [S4][S8] and LLM reviewers approving a backdoor [S22] are indirect support only. Prefer a check to a sentence [S10], and keep a text rule to a prohibition [S31].
- H33: refined - the record can stay local, as Go and Rust keep theirs [S29][S30], and one owner's corrections were enough to learn rules that were followed more often [S10]. It cannot prove an overall gain: with tens of tasks only large drops in one class reach significance, benchmark-scale runs are noisy [S14][S17], and a higher mean can hide new failures [S18]. No source measures how well recurring classes in local logs predict a useful fix (unsourced).
- H34: confirmed - every self-improving system whose evaluator was within reach gamed it: removed detector markers [S21], a loosened test harness [S20], an always-pass grader [S23], self-scores that did not hold in deployment [S24]; locking the evaluator stopped tampering [S31]. The data a system learns from also needs protecting [S22][S9].

## Implications for weftwork

- Keep the history local and off by default. The owner turns it on in a setting file the agent cannot edit [S29][S30].
- Record only what the engine saw: gate runs, stop states, guard blocks and review rounds. Leave out the agent's own account, such as finding outcomes and decisions [S2][S11][S24].
- Keep the record where it outlives the worktree. A linked worktree's git dir is deleted with it, so the record goes in the common git dir.
- Report recurring failure classes as signals, not proof, and name the tasks [S18].
- Propose one small change per pull request. Prefer a check, and never write a whole context file or skill [S1][S4][S10]. Accept a change through the base check and the owner's merge, and never let it touch the gate, ledger, guard or history code [S21][S20].
- Keep counting each accepted change: the class before and after, a significance test that shows how little a small sample proves, and a re-check note when the model changes [S17][S12].
- Do not build an autonomous loop that evolves the harness, automatic memory, prompt optimisation or self-written skills. At one owner's volume the evidence is against them or out of reach [S3][S7][S15].

## Earns its place vs ceremony

- Earns its place: a durable record, because without it nothing can be counted. A report of recurring classes. One change at a time with a check that fails on the base. Before-and-after counts for each accepted change.
- Ceremony at this scale: confidence intervals over a whole-workflow score, a learned router, an optimiser that needs thousands of rollouts [S3], and an LLM council to approve self-edits, which shares the agent's blind spots [S13][S22].

## Open questions

- Does a recurring class in one owner's history lead to a fix that lowers that class? Only use will tell; the report is built to count it.
- CI results and what the owner merged, edited or closed are the strongest signals, and they need GitHub. Should the record read them, and how, without trusting the agent's account?
- Is owner approval better than automatic acceptance of small checked changes? No source tests it.
- How much history is too much? MemDev found harm grows with noisy and long history [S7]; the report reads the last 1 MiB and nothing prunes it yet.
