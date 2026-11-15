# R19 Review that converges and audits

Question (docs/research/planning-context.yaml): what do teams that run AI code review at scale, and the 2026 papers on it, say about keeping a review loop bounded while it still catches the problems that matter, and is a score, a council of several models or a severity gate the better way to gate a change? The owner asked for this on 2026-11-15, after reading how Theo Browne's `council` and `sol-loop` skills work, to check that the review round (e11s03, `docs/REVIEW.md`) is thorough enough and cannot run away. Story e13s01.

## Sources

- [S1] Osmani, Lunt and Wang, "How the Claude Code team does code review", Anthropic, https://claude.dev/blog/solving-code-review-at-anthropic/ (full page) - accessed: 2026-11-15 published: 2026-10-15
- [S2] Trębacz et al., "A Practical Approach to Verifying Code at Scale", OpenAI Alignment blog, https://alignment.openai.com/scaling-code-verification/ (full page; figure values not in the text) - accessed: 2026-11-15 published: 2025-12-01
- [S3] Kaplan, "Building a better Bugbot", Cursor, https://cursor.com/blog/building-bugbot (full page) - accessed: 2026-11-15 published: 2026-01-15
- [S4] Li et al., "OpenCodeReview: Determinism over Non-Determinism for Cost-Effective Agent-Based Code Review", arXiv:2608.09290, https://arxiv.org/abs/2608.09290 (abstract and parts of the HTML full text) - accessed: 2026-11-15 published: 2026-08-10
- [S5] Lin, Liang, Thongtanunam and Tantithamthavorn, "Is Agentic Code Review Helpful? Mining Developers' Feedback to CodeRabbit Reviews in the Wild", arXiv:2607.03316, https://arxiv.org/abs/2607.03316 (abstract and parts of the HTML full text) - accessed: 2026-11-15 published: 2026-07-03
- [S6] Pan et al., "CRJudgeBench: Can AI Detect Plausible but Invalid Code Reviews?", arXiv:2609.37216, https://arxiv.org/abs/2609.37216 (abstract and parts of the HTML full text) - accessed: 2026-11-15 published: 2026-09-29
- [S7] Zhang et al., "Code Review Agent Benchmark" (c-CRAB), arXiv:2603.23448, https://arxiv.org/abs/2603.23448 (abstract and introduction) - accessed: 2026-11-15 published: 2026-03-24
- [S8] Qiu and Gill, "Adversarial Review: Structured Disagreement for Grounded Agentic Code Review", arXiv:2608.18167, https://arxiv.org/abs/2608.18167 (abstract and parts of the HTML full text; ICML 2026 DL4C workshop) - accessed: 2026-11-15 published: 2026-08-16
- [S9] Arimbur, "How Many Tries Does It Take? Iterative Self-Repair in LLM Code Generation Across Model Scales and Benchmarks", arXiv:2604.10508, https://arxiv.org/abs/2604.10508 (abstract and parts of the HTML full text) - accessed: 2026-11-15 published: 2026-04-12
- [S10] Haroon, Khan and Gulzar, "Evaluating LLM-Based Test Generation Under Software Evolution", arXiv:2603.23443, https://arxiv.org/abs/2603.23443 (abstract and introduction) - accessed: 2026-11-15 published: 2026-03-24
- [S11] Nguyen, Hao, Elazar and Tan, "Benchmarking Agentic Review Systems", arXiv:2606.19749, https://arxiv.org/abs/2606.19749 (abstract and parts of the HTML full text; reviews of research papers, not code) - accessed: 2026-11-15 published: 2026-06-18
- [S12] t3dotgg/tstack, `skills/council/SKILL.md` and `skills/sol-loop/SKILL.md` at commit 11e37a7, https://github.com/t3dotgg/tstack - accessed: 2026-11-15 published: 2026-11-11
- [S13] weftwork brief R17, practitioner autonomy, `docs/research/R17-practitioner-autonomy.md` (Theo's reported council runaways, from secondary summaries) - accessed: 2026-11-15 published: 2026-11-15
- [S14] weftwork brief R7, agent review and decisions, `docs/research/R7-review-and-decisions.md` - accessed: 2026-11-15 published: 2026-11-08
- [S15] weftwork `docs/REVIEW.md`, the `review-loop` skill and the body of PR #76 (a setup change reviewed under the 5-round ceiling the agent chose) - accessed: 2026-11-15 published: 2026-11-15

## Method

Access date 2026-11-15. Web searches found candidates; the secondary pages they returned (news write-ups, vendor guides, skill directories) were used only to find primary sources and are not cited. Web-fetch subagents read [S1] to [S11] and reported quotes and numbers; I did not read those pages myself. For [S4] to [S11] the later sections of the HTML came back as a model-written summary, so a number marked "summary" below is not verbatim. I cloned [S12] into the session scratchpad and read the two skill files; it has had no commit since R17 read it. [S1] to [S3] are each company's own figures about its own product, not independent measurements. No experiment was run.

## What the sources say

Bounding the loop:

- Anthropic caps its internal review loop: "After three rounds, the reviewer asks the author to step back and reconsider the approach." One pull request had gone through "more than fifty rounds of review and fixes overnight", and "about 59% of it was code that had been there since the reviewer's first pass": the reviewer kept finding a few more old issues each round. They added diff-only re-review after the first passes, a "Pre-existing" tag, and "No repeats of findings already posted" [S1].
- Those changes moved their numbers: pull requests that passed after one review and fix round went from 65 to 78 percent, those that needed five or more rounds from 8.9 to 1.5 percent, and the mean reviews to pass from 2.08 to 1.32 [S1].
- Repair loops give most of their gain early: on HumanEval and MBPP, round 1 is "the largest single-round gain for all seven models" and two rounds hold most of the total gain (76 to 95 percent; the paper does not show how the range was computed, and the per-round table fits it) [S9]. That is a model repairing its own code from test errors, not review, but it points the same way as [S1].
- Theo's `council` loops "until all delegates are satisfied" and limits scope only in prose; `sol-loop` has a 3-round budget, 5 for security, auth, data loss and concurrency [S12]. His reported runaways (600 or more subagents, a pull request grown from about 1,000 to more than 20,000 lines) come from secondary summaries of his videos [S13].

Precision, false alarms and what blocks:

- Every team here chose precision over recall. OpenAI "explicitly accepted a measured tradeoff: modestly reduced recall in exchange for high signal quality and developer trust", and calls style comments possibly "negative utility" [S2]. Anthropic: "It's easy to catch more bugs if you don't mind flagging a lot of non-bugs" [S1].
- False alarms are the common failure. Developers rejected 56.3 percent of the CodeRabbit reviews they answered (31,073 reviews, 10,191 pull requests); 58.0 percent of the rejections were invalid suggestions [S5]. On AACR-Bench, Claude Code reached the highest recall (28.90 percent) at 7.23 percent precision with 4,580 comments, while a pipeline with fixed file dispatch and a reflection step that drops comments the diff contradicts reached 33.90 percent precision at 20.00 percent recall and 5 to 15 times fewer tokens [S4]. In reviews of research papers, false positives (38.5 percent) and nitpicks (17.3 percent) led the downvote reasons (summary) [S11].
- Models are poor at spotting a wrong review comment by reading: on CRJudgeBench every baseline model called at least 85.52 percent of comments trustworthy against a true share of 63.79 percent, and caught 2.31 to 20.77 percent of the untrustworthy ones. A judge that gathers evidence in the repository and was trained for it caught 37.69 percent, at 76.60 percent accuracy [S6].
- What blocks a merge at Anthropic is open findings and CI, not a score: "A PR can't merge while any finding from the bug review or the security review is still open", and each finding is closed by a fix or by resolving the thread with a reason. Findings are tagged Important, Nit or Pre-existing [S1]. None of [S1] to [S3] gates on a score. Anthropic does score its reviewer: each incident becomes an eval case, the reviewer runs on that set daily, and a change to the reviewer is kept only if the score goes up [S1].
- Measures of the reviewer, not the change: Cursor's resolution rate is the share of flagged bugs the author fixed by merge time, judged by a model and spot-checked with authors; it rose from 52 to more than 70 percent over 40 experiments [S3]. OpenAI reports that 46 percent of its comments on Codex-written pull requests and 53 percent on human ones led to a code change [S2].

How many reviewers:

- More independent reviewers did not help much on their own: on SWE-PRBench two independent reviewers scored F1 0.503 against 0.495 for one. A reviewer whose findings a critic must agree with, and where a concern without cited code must be confirmed or refuted from the diff, scored 0.533; one workshop paper, one model (Claude Sonnet 4.5), about 4.5 times the tokens (summary) [S8].
- Cursor's early pipeline ran eight passes with randomized diff order, kept bugs found by more than one pass and ran a validator model; it then saw "the largest gains" from one agentic reviewer that decides where to dig [S3]. Anthropic has several agents look for bugs and "a separate group votes on each finding" before it is posted [S1].
- Different tools find different issues: on c-CRAB the review agents "taken together can solve only around 40%" of the human-identified issues, more than any one of them [S7]. The union of six models caught 83.3 percent of injected errors in research papers against 71.6 percent for the best one (summary) [S11].
- OpenAI's reviewer is the same model as its generator, trained differently, and they watch "whether the model learns to subtly game or avoid its own checks"; so far it "remains similarly effective" on Codex-written and human pull requests [S2].

What a thorough review covers:

- Anthropic's reviewer reads the diff "against the whole repo and the PR's stated intent" and asks whether the change "solve[s] its problem, fit[s] the system, or break[s] something else"; it "flags code that breaks a convention in" CLAUDE.md and "changes that make a line in it out of date"; a REVIEW.md asks "for a file and line as evidence instead of a guess" and to "cap the nits". A separate security review runs on every pull request and can block [S1].
- Letting the reviewer use the repository and run code helped: "repository access and code execution abilities ... results in a stronger reviewer, catching more critical issues and raising fewer false alarms" [S2].
- Tests that pass do not show that they test the change: of the LLM-written tests that failed on a changed program, more than 99 percent passed on the original program while running the changed region, so they encoded the old behaviour [S10]. c-CRAB turns each human review comment into a test that fails before the fix and passes after, because text similarity cannot tell a useful review from a useless one [S7]. R7 found 7.8 percent of SWE-bench "solved" patches fail the developer suite [S14].
- In weftwork today, the review brief asks for bugs, broken callers, mismatch with the intent and code the intent does not need; the agent sets `sensitive` and so the ceiling; diff growth is limited by a line of skill text; PR #76 was a setup change reviewed under the 5-round ceiling because the agent marked it sensitive [S15].

## Verdicts

- H13: refined - a reviewer from another family stays a sensible default but is still unproven: OpenAI runs the same model as generator and reviewer and reports it equally effective on its own and human code [S2]; a second independent reviewer barely moved F1 (0.503 against 0.495) [S8]; different tools do find different issues [S7][S11]. The fresh-context half is used by Anthropic (a second agent in a fresh context) and still unmeasured [S1][S14]. Spend added reviewers on checking findings, not on more independent finders [S6][S8][S3].
- H14: refined - review that checks evidence is better supported than in R7: execution access gave fewer false alarms and more critical catches [S2], evidence-gathering lifted the detection of invalid review comments from 20.77 to 37.69 percent [S6], and a "file and line as evidence" rule is in Anthropic's REVIEW.md [S1]. Passing tests are weak evidence that the change is tested [S10][S14]; running the new tests against the base, where they must fail, is the cheap form of c-CRAB's fail-before, pass-after rule [S7]. Mutation testing stays out, as R7 left it [S14].
- H15: refined - a counted round ceiling is what large teams do: Anthropic's 3 rounds, then step back, came with diff-only re-review, a Pre-existing tag and no repeated findings, and together these changes cut the mean reviews to pass from 2.08 to 1.32 [S1]; [S1] does not give the effect of each change alone. Most repair gain comes in two rounds [S9]. The cause of the 50-round loop was new findings on old code, which a ceiling ends but does not prevent [S1]. Theo's runaways had no counted ceiling [S12][S13].
- H31: refined - each part has a source, none is measured in weftwork: a grounded severity gate [S1][S2][S6], a tier set by the change, not the author [S1][S15], scores for the reviewer and not the change [S1][S3][S2]. Refined on later rounds: Anthropic limits them by scope (diff-only re-review, no repeats) and a tag for old code, not by a rule that stops a finding from blocking [S1]. A mechanical rule that a new must-fix on an unchanged file cannot block would also hide a caller that the latest fix broke, so the claim's "later rounds cannot block on unchanged code" goes too far: the engine should narrow what later rounds look at and mark such findings, and leave the end of the loop to the ceiling. The diff-growth ceiling rests on one practitioner's secondary report [S13] and on the skill's own "cut first" rule [S12], not on a measurement. The red-on-base proof check is an inference from [S10] and [S7].

## Implications for weftwork

- Keep: the 3-round ceiling with 5 for sensitive changes, counted by the engine; only a must-fix blocks; a failed reviewer is neither a pass nor a block; the done gate before review; no score gate [S1][S2][S3][S9][S12].
- e13s02, loop safety in the engine: a `FOLLOW-UP` label for a real defect that the change did not cause, which does not block the round and goes to the backlog. Anthropic tags such findings Pre-existing but still asks for each to be fixed or resolved with a reason [S1]; not blocking is weftwork's inference, and listing each one as a follow-up in the PR is its reason. CONVENTIONS.md bans "pre-existing" as a dismissal, so the label names what happens to the finding. A must-fix whose file or line does not exist does not block [S1][S6]. From round 2 the engine, not the agent's brief, tells the reviewer which files changed since the last round and which must-fix findings were open, and asks for those only; a regression this change causes still blocks wherever it is, and a new must-fix on a file that did not change since the last round is marked in the report, not demoted [S1]. `review.sensitive_paths` lets the files set the ceiling [S1][S15]. A diff that grew past a ceiling since round 1 stops the review until it is cut [S13][S12]. The round ceiling stays what ends the loop.
- e13s03, what the reviewer checks: the engine, not the agent's brief, adds a fixed checklist (correctness and callers, the proof, the project's rules and stale docs, scope) and lets the reviewer run read-only checks to confirm a must-fix [S1][S2]. A sensitive change gets a security checklist in the same pass [S1]. A must-fix is closed by a test that fails without the fix, or by a written dispute with evidence [S7][S12].
- e13s04, the proof: run the changed tests on the base commit; they should fail there. Report only at first [S10][S7].
- e13s05, measure the reviewer: log each finding's outcome (fixed, disputed, declined, follow-up) and report a resolution rate per reviewer, as Cursor and OpenAI measure theirs [S3][S2]. Anthropic runs its reviewer daily on a set built from past incidents [S1]; a weftwork set of that kind, or of seeded bugs, is a proposal for B7.
- Do not add now: a three-provider council on every change, a score gate, majority voting across reviewers, or a reviewer-and-critic loop. The critic loop had the best F1 in [S8] but rests on one workshop paper and costs about 4.5 times the tokens; revisit it with e13s05's data.

## Earns its place vs ceremony

- Earns its place: a counted round ceiling of about 3 [S1][S9].
- Earns its place: a tag for old defects and later rounds scoped to what changed; with the ceiling and no repeats they cut Anthropic's mean reviews to pass, with no split of each change's effect [S1].
- Earns its place: precision over recall in what blocks [S2][S4][S5].
- Unproven, cheap: the file-and-line grounding check; it is deterministic and only demotes a finding [S1][S6].
- Unproven, cheap: the diff-growth ceiling [S13].
- Unproven: the red-on-base check; inferred from [S10][S7], with no measurement of it as a gate.
- Ceremony until measured: several independent reviewers per change [S8][S3], a score per change [S1][S3], a reviewer-and-critic loop [S8].

## Open questions

- No source measures a weftwork review round. e13s05's outcome log is the first data; a seeded-bug set (B7) would give recall.
- Whether a reviewer told to look only at what changed since the last round misses a caller that the latest fix broke. No source measures it; the outcome log and the marked "new on an unchanged file" findings should show it.
- Whether a separate security pass finds more than a security checklist in the same pass; [S1] runs a separate one and gives no comparison.
- [S1] to [S3] are each company's numbers about its own reviewer. [S4] to [S11] are preprints, and some figures here come from a summary of their later sections.
