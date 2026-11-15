# R17 Practitioner autonomy (tstack)

Question (specs/planning-context.yaml): how does a fast-shipping practitioner, Theo Browne of T3 Code, get coding agents to finish, review and merge work without him in August to November 2026, and how does that practice line up with R1 to R16? The owner asked for this after the workflow audit of 2026-11-15, which re-planned e11 as the auto run. The primary source is the practitioner's own published skills; everything about his results comes from secondary summaries of his videos and is labelled so.

## Sources

- [S1] t3dotgg/tstack, README.md, nine `skills/*/SKILL.md` files and the header of `skills/babysit-pr/scripts/pr-wait`, read at commit 11e37a7 (2026-11-11, "feat(council): act on results as they arrive"); first commit 6efae36 on 2026-10-23, MIT licence, https://github.com/t3dotgg/tstack - accessed: 2026-11-15 published: 2026-10-23
- [S2] BigGo Finance news, "Theo Browne says T3 Code went from 2 to 400 merged PRs a day with three engineers", a summary of a 301-minute stream (secondary, AI-generated), https://finance.biggo.com/news/8152715d604b4e26 - accessed: 2026-11-15 published: 2026-11-05
- [S3] BigGo Finance podcast summary, "How Claude Fixes It's Own Code", Theo reading Anthropic's post on the Claude Code review pipeline (secondary, AI-generated), https://finance.biggo.com/podcast/84aa7e46129c57ce - accessed: 2026-11-15 published: 2026-11-06
- [S4] BigGo Finance podcast summary, "Coding Isn't About Code Anymore" (secondary, AI-generated), https://finance.biggo.com/podcast/ae51d553057241e5 - accessed: 2026-11-15 published: 2026-11-09
- [S5] BigGo Finance podcast summary, "I shipped a lot and learned even more :)", a 3h44m live session (secondary, AI-generated), https://finance.biggo.com/podcast/a7f6180d1ab2dfb2 - accessed: 2026-11-15 published: 2026-10-26
- [S6] BigGo Finance podcast summary, "Agents Sucked At UI (Until Today)" (secondary, AI-generated), https://finance.biggo.com/podcast/8b11242133423fc5 - accessed: 2026-11-15 published: 2026-11-03
- [S7] BigGo Finance podcast summary, "You're using AI agents wrong" (secondary, AI-generated), https://finance.biggo.com/podcast/3425bc9e507bd8f7 - accessed: 2026-11-15 published: 2026-09-09
- [S8] BigGo Finance podcast summary, "How I code with AI changed a lot" (secondary, AI-generated; older than the window, read for the baseline), https://finance.biggo.com/podcast/c7c3cb2193d150d2 - accessed: 2026-11-15 published: 2026-05-27
- [S9] The Growth Project, "3 AI Agent Skills for Faster Code Review: Theo", a summary of a 30-minute video (secondary), https://thegrowthproject.com/videos/three-skills-for-shipping-with-ai/ - accessed: 2026-11-15 published: undated
- [S10] "Where Do AI Coding Agents Fail? An Empirical Study of Failed Agentic Pull Requests in GitHub", arXiv:2601.15195, https://arxiv.org/abs/2601.15195 (abstract only) - accessed: 2026-11-15 published: 2026-01-21
- [S11] "When AI Teammates Meet Code Review: Collaboration Signals Shaping the Integration of Agent-Authored Pull Requests", arXiv:2602.19441, https://arxiv.org/abs/2602.19441 (abstract only) - accessed: 2026-11-15 published: 2026-02-23
- [S12] "On the Use of Agentic Coding: An Empirical Study of Pull Requests on GitHub", arXiv:2509.14745, https://arxiv.org/abs/2509.14745 (abstract only) - accessed: 2026-11-15 published: 2025-09-18
- [S13] "TrustJudge: Inconsistencies of LLM-as-a-Judge and How to Alleviate Them", arXiv:2509.21117, https://arxiv.org/abs/2509.21117 (abstract only) - accessed: 2026-11-15 published: 2025-09-25
- [S14] "Time To Impeach LLM-as-a-Judge: Programs are the Future of Evaluation", arXiv:2506.10403, https://arxiv.org/abs/2506.10403 (abstract only) - accessed: 2026-11-15 published: 2025-06-12
- [S15] weftwork research synthesis, `docs/research/SYNTHESIS.md` (verdicts H1 to H27) - accessed: 2026-11-15 published: 2026-11-11
- [S16] weftwork brief R7, review and decisions, `docs/research/R7-review-and-decisions.md` - accessed: 2026-11-15 published: 2026-11-08
- [S17] weftwork brief R15, run termination, `docs/research/R15-run-termination.md` - accessed: 2026-11-15 published: 2026-11-10
- [S18] weftwork brief R13, enforcement design, `docs/research/R13-enforcement-design.md` - accessed: 2026-11-15 published: 2026-11-10
- [S19] weftwork brief R6, multi-agent work in one codebase, `docs/research/R6-multi-agent-codebase.md` - accessed: 2026-11-15 published: 2026-11-08
- [S20] weftwork brief R10, evaluation design, `docs/research/R10-evaluation.md` - accessed: 2026-11-15 published: 2026-11-10
- [S21] weftwork brief R8, code quality and conventions, `docs/research/R8-code-quality-conventions.md` - accessed: 2026-11-15 published: 2026-11-09
- [S22] weftwork brief R12, context and memory, `docs/research/R12-context-memory.md` - accessed: 2026-11-15 published: 2026-11-09
- [S23] weftwork brief R16, evidence refresh, `docs/research/R16-evidence-refresh.md` - accessed: 2026-11-15 published: 2026-11-11

## Method

Access date 2026-11-15. Three kinds of reading, with different weight.

- Primary: I cloned t3dotgg/tstack with `gh repo clone` (depth 50) into the session scratchpad, read README.md, all nine SKILL.md files and the docstring of the `pr-wait` script, and ran nothing from it. `git log` gave the commit dates [S1]. The skills are what he says he runs every day; they are instructions to an agent, not evidence of what the agent does.
- Secondary: two web-fetch subagents read the eight summary pages [S2] to [S9] and reported practices, dates and short quotes. I did not read those pages myself, and none is a transcript: BigGo pages are AI-generated summaries of his videos. So every number about his results (PRs per day, merge counts, cost, runaway loops) is his self-report passed through a summary, and the summaries disagree on some figures (deleted test lines are 258,000 in [S2] and about 250,000 in [S4]). The search snippets that led to these pages (guides on explainx.ai, alphasignal.ai, prompthackers.co, v01.io, a fork at joaorrios/agent-skills) are candidates I did not read and do not cite.
- Papers: two arXiv API queries over https (`export.arxiv.org`, relevance order, five seconds apart): `all:"pull requests" AND all:agent AND all:merged AND all:autonomous` (eight results) and `all:"LLM-as-a-judge" AND all:consistency AND all:scores` (six results). I read the abstracts of the results and cite five [S10] to [S14]. Abstracts only.
- weftwork briefs: claims about R6 to R16 are taken from their own verdict lines or from the synthesis, not rechecked against the papers behind them [S15].

No `api.github.com` call was made. The window "the last three months" is roughly August to November 2026; [S8] is older and is used only as the starting point.

## What he runs

tstack is nine skills and one script, about 750 lines of Markdown, published 2026-10-23 and changed five times since [S1]. Each skill is started by an exact phrase ("full send", "full stop", "council", "sol loop"), not by a routing description. The README says the skills "work in Claude Code and Codex" and use T3 Code tools (`delegate_task`, `watch_pull_request`) when they are there [S1].

- `full-send` takes a change to a merged PR "with nobody watching". Steps: finish the smallest change that works, prove it, review it with `sol-loop`, file the PR with `file-pr`, watch it with `babysit-pr`, merge when the merge gate passes, report the PR, the merge commit, the proof and every decision taken alone. The trigger phrase is the permission for the test methods proof needs, including browser automation and computer use, and replaces any project rule to ask first; it does not cover production changes or data deletion [S1].
- Proof is "evidence you observed yourself in this session": reproduce the failure and watch it pass, run the checks CI runs, add one focused test that fails without the fix, and for UI run the app and look, because "Green mocked tests do not prove that the user experience works". Without proof the agent asks [S1].
- The merge gate: proof covers every change; required checks are green; review bots have finished and each finding is fixed or dismissed with a written reason; no human review requests changes; the branch is current and mergeable. Never `--admin` [S1].
- The agent asks the owner only when it cannot prove the change, the gate cannot pass, the next step is outside the grant (data deletion, production, outside the repo, closing a PR, force-pushing another branch), the goal is ambiguous in a way that changes the result, or another PR makes this one obsolete. It asks through the host's question tool, so the thread shows it is waiting; with no tool it leaves the PR open and unmerged [S1].
- `full-stop` is the same work without the merge, and it disables auto-merge and merge queues first [S1].
- `sol-loop` is the default review: one reviewer on another provider's model (GPT "Sol"), read only, findings labelled blocker, should or nit with stable ids, a ledger of fixed, disputed and declined items, 3 rounds by default and 5 only for security, permissions, auth, data loss or concurrency. It stops early on a round of only nits; "Timeout, error, or no reply is not approval"; "Budget end is not approval"; an item disputed after two replies goes to the user with both sides [S1].
- `council` asks one strong model from each of three providers, read only, for a score out of 10, writes a table of scores per round into the PR description, and loops "until all delegates are satisfied". Since 2026-11-11 it checks each result against the code as soon as it arrives. Its only limit is a prose line: "Do not let repeated reviews result in scope creep" [S1].
- `babysit-pr` waits on one watcher per PR (`pr-wait`, a 556-line Python script that prints one line per real event and exits 0 when ready, 1 when it needs the agent), acts only on checks and comments newer than the last push, treats CodeRabbit as advisory, and declines cheap growth ("unneeded tests, guards for edge cases that do not matter") with a written reason [S1].
- `modernize` rebases an old PR only after deciding MODERNIZE, REWORK or CLOSE; `takeover` finishes another agent's PR and keeps the original credit; `file-pr` writes a PR that leads with the problem and ends with the model and harness that made it [S1].

## How he works with it

From the secondary summaries, so self-reported and second-hand:

- Prompts are short (two sentences or fewer in May), dictated by voice; he has dropped long written plans and asks the model to push back [S8][S7].
- He runs many threads at once on a remote machine (dozens in September), each thread ending at a PR [S7]. In May he described one task per thread on `main` without worktrees [S8].
- Throughput: 52 PRs in one week of August, up from 1 to 3 [S7]; by November T3 Code saw up to 800 PRs a day and more than 400 merged on active days, with three engineers [S2]. In 32 uses of the hands-off skill, 27 changes merged without him looking again [S9].
- He treats the codebase as the guidance: fast CI, a CI check that replays real agent threads and flags regressions in under 45 seconds, and the removal of about 11,000 agent-written tests, of which four came back ("Slop grows faster than weeds do") [S2][S4]. He fixes the codebase before adding guidance files and turned agent memory off after finding it stale [S2][S3].
- Review moved from counting comments to scores, because each nit triggers another round when an agent is the author [S2][S3]. Over 144 reviewer scores, 128 runs ended at 9 or higher [S2]. He says the scores are noisy: the same screenshot can get three different scores, scores of unchanged competitor screenshots rose, and he stopped telling reviewers the target because it may inflate them [S5][S6]. He prefers a program that gives a score: "If you can find a way to turn something into an eval you can hill climb it" [S5].
- UI: the council scored screenshots of the T3 Code UI from about 6 to 9 and later to 9.5 or higher, at roughly 17.6 hours of agent time and $250 to $400 in inference [S5][S6].
- The human role he names is direction, taste, scope, risky code and architecture; three people hold merge rights, and he rejected a 17-line PR because its screenshots did not show the layout risk [S2][S3].
- Failures he reports: one council thread started 600 or more subagents over 20 or more rounds and grew a PR of about 1,000 lines past 20,000; another ran for four days to about 80,000 lines in a background tab until he killed it; he says the skills need "short circuits" and that Opus honours a tap-out instruction while Sol keeps grinding nits [S2][S3]. T3 Code has no merge queue and `main` has been partly broken by CI [S3]. Easy PRs leave a large backlog (414 open PRs in May) [S8]. He predicts some of this will "look silly in six months" [S7].

## What the literature adds

- Agent-authored PRs are often accepted: 83.8 percent of 567 Claude Code PRs in 157 projects were merged, 54.9 percent of those without change [S12]. In 33,000 agent PRs, the ones not merged were larger, touched more files and often failed CI; bug-fix and performance tasks fared worst, and reasons included duplicate PRs and unwanted features [S10]. Larger changes and force pushes go with a lower chance of merging, and iteration count explains little once review signals are counted [S11]. These study human-reviewed projects, not self-merging agents.
- Numeric LLM judges are inconsistent: lower-scored answers beat higher-scored ones in pairwise checks and preferences can be circular, which the authors trace to discrete rating scales [S13]. Judging programs written by an LLM were 15.83 percent more consistent and 23.7 percent less biased than a direct LLM judge in one study [S14]. Both are general LLM evaluation, not code review.

## Verdicts

- H1: refined - his practice matches the direction: "done" is proof the agent observed, CI's own checks and a reproduction, and green mocked tests do not count for UI [S1]. But the proof is still the agent's own report of what it saw, which R15 found unreliable in direction [S17][S15]; and his removal of about 11,000 agent-written tests [S2][S4] is a practitioner instance of R7's point that a gate is only as good as its oracle [S16]. Refined: the practice confirms that evidence beats claims and adds nothing on who runs the check; a harness-run check stays the gap.
- H2: refined - he relies on deterministic machinery for what matters (CI, a replay check that flags regressions in under 45 seconds, the `pr-wait` script for GitHub state, a merge gate on checks and mergeability) [S1][S2][S4], and prefers a program that scores over a model that scores [S5]; a judging-program study supports that preference [S14] and R8 and R13 found checks that run beat prompt-only rules [S21][S18]. Refined: the practice supports the claim for verification and state, while his review and stop rules stay model-judged.
- H6: refined - he built the workflow first and enforced almost nothing: every limit in tstack is prose (round budgets, scope creep, when to ask) [S1], and his reported runaways (600 subagents, 80,000 lines) are the failure R13 and R15 predict when a loop's stop is a request, not a gate [S2][S3][S18][S17]. Refined: workflow first is what ships fastest; the enforcement that should follow is the stop rules, because that is where his own failures are.
- H7: refined - his ceremony scales by phrase, not by a risk field: "full send" or "full stop", `sol-loop` or `council`, 3 rounds or 5 for security, auth, data loss or concurrency [S1]. That is the human-choice scaling R1 to R3 found in other tools, with one rule-based step (the five-round extension) [S15]. His shift from long plans to two-sentence prompts [S8] fits R10 and R13's finding that more ceremony bought reviewability but not correctness on small tasks [S20][S18]. Still no measured comparison.
- H10: refined - nine skills, each started by an exact phrase, with a README that says which skills call which [S1]. Exact triggers sidestep the wrong-skill selection that R16 found drives the drop as a library grows [S23]. This supports a small catalog; one entry command is not what he uses (two entry phrases, two review phrases).
- H12: refined - he runs many threads in parallel with no merge queue, and reports `main` partly broken [S3][S7]; R6 found 5 to 10 percent semantic conflicts after clean merges and a sequential default [S19]. His mitigations are reactive (`pr-wait` reports base commits that touch the PR's files; never merge when behind or when base commits after the last green run touch the PR) [S1]. Refined: no pre-dispatch scope check, so the integrator re-check is what carries the weight, and his partial breakage suggests it is not enough alone.
- H13: refined - both review skills use another provider's model, read only, in a fresh delegate [S1]. His observation that Opus honours a tap-out while Sol grinds nits [S2] fits R7's one direct test, where cross-model review helped one way and hurt the other [S16]. His use of noisy numeric scores runs into the judge inconsistency that [S13] measures and that he reports himself [S5][S6]. Refined: a different model is the practice, the effect is lopsided by pairing, and scores are a weak gate.
- H14: refined - `sol-loop` asks for findings with a file, a line, a claim and a fix, and the author must check each against the code and answer disagreement with evidence [S1]; that is review against evidence, though the reviewer reads and does not run anything. The merge gate adds running evidence (CI, proof) beside the review [S1]. Mutation testing does not appear. Refined as R7 left it [S16].
- H15: refined - his budgets are rounds (3, 5 for some kinds of change) and a council run until all agree [S1]; there is no counted ceiling over the whole loop, and the reported runaways ran for days [S2][S3]. Anthropic's numbers as he read them (mean rounds from 2.08 to 1.32 after round caps) are second-hand [S3]. R15's verdict that the engine must count ceilings itself over the whole loop stands, and this is a practitioner failure that shows why [S17].

## Implications for weftwork

- The two fit together. tstack is the workflow that ships (proof, review, PR filing, babysitting, merge gate, modernize, takeover); weftwork's engine holds what tstack lacks (a done gate the agent cannot fake, counted ceilings over the whole loop, a no-progress breaker, a reserve that leaves a handoff). Build e11's skills by adapting tstack, MIT with credit, rather than writing them from scratch; the CLAUDE.md rule "copy validated patterns" asks for this [S1][S15].
- e11s02 (task to PR): take full-send and full-stop's step order, proof rules, merge gate and "ask only when" list, and replace the agent's self-reported proof with the engine's done gate [S1][S17].
- e11s03 (council): take sol-loop's severity labels, ledger, 3-round budget with a 5-round extension for security, auth, data loss and concurrency, early stop on nits, and "timeout is not approval". Keep council scores as a report, never a gate, and put the round and subagent ceilings in the engine, because the prose limit failed in his own runs [S1][S2][S13].
- e11s04 (owner triggers): full-send's list is close to the e11s04 triggers and to Superpowers' four stops in R7; add "the goal is ambiguous in a way that changes the result" and "another PR makes this one obsolete", and ask through the host question tool so a waiting thread is visible [S1][S16].
- e11s05 (UI check): his proof rule says run the app and look, and the council scored screenshots; keep the screenshot step, prefer a programmatic check, and do not gate on scores [S1][S5][S14].
- Beyond e11: `babysit-pr` with a watcher script and a merge gate on GitHub state is a candidate for a later story, since the agent should keep a PR alive through CI and review bots. Keep PRs small: larger changes merge less often in the AIDev studies [S10][S11].
- Context: his short hand-written agent file and memory turned off agree with R8 and R12, which found mixed evidence that context files help and stale references in many of them [S2][S8][S21][S22].

## Earns its place vs ceremony

- Earns its place: an exact trigger phrase that grants a defined set of permissions (test methods, push, merge) for one task, so project ask-first rules do not stall an unattended run [S1].
- Earns its place: a written merge gate on observable state (proof, checks, bot findings handled, branch current) [S1].
- Earns its place: severity labels with stable ids and a ledger across rounds, a small round budget, and "timeout is not approval" [S1][S16].
- Earns its place: declining cheap growth in writing; larger agent PRs merge less often [S1][S10][S11].
- Ceremony until measured: three-model councils on every change, and numeric scores as a bar (he reports the scores are noisy, and the literature agrees) [S5][S6][S13].
- Missing, not ceremony: a counted stop over the whole loop; his runaways show the cost of leaving it to prose [S2][S3][S17].

## Open questions

- No transcript was read. The video numbers (PRs per day, 27 of 32, the runaways, the score counts) are self-reports passed through AI summaries; watching the videos or reading Anthropic's post directly would firm them up.
- Revert and regression rates for self-merged agent PRs at T3 Code are not given in any source read; the 27 of 32 figure is merges, not correctness.
- Whether `delegate_task` to another provider can be reproduced in Claude Code without T3 Code, and at what subscription cost: the README says council and sol-loop need a harness that can run other providers' models [S1].
- The guides and the fork found by search (explainx.ai, alphasignal.ai, prompthackers.co, v01.io, joaorrios/agent-skills) were not read; the fork's changes to council (two Claude delegates, up to three providers) may be worth a look when e11s03 is planned.
