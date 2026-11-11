# R10 Evaluation design

Question (specs/planning-context.yaml): a small task set comparing a plain agent, an agent with evidence gates, full ceremony, and a fixed tier against a routed tier, measuring pass rate and cost per accepted task, and testing H1, H4, H7, H17, H19 and H20 directly. This brief is a design: it says what to run, on what, how to decide, and what each run would cost. It runs nothing.

## Sources

- [S1] Jimenez et al., "SWE-bench: Can Language Models Resolve Real-World GitHub Issues?", arXiv:2310.06770, https://arxiv.org/abs/2310.06770 (abstract only) - accessed: 2026-11-10 published: 2023-10-10
- [S2] Wang, Pradel and Liu, "Are 'Solved Issues' in SWE-bench Really Solved Correctly? An Empirical Study", arXiv:2503.15223, https://arxiv.org/abs/2503.15223 (abstract only; also R4 S18) - accessed: 2026-11-10 published: 2025-03-19
- [S3] Xiang et al., "Cross-Model LLM Code Review: Should you use Claude to review Codex or vice versa?", arXiv:2607.21656, https://arxiv.org/abs/2607.21656 (abstract only; also R7 S37) - accessed: 2026-11-10 published: 2026-07-22
- [S4] Sun et al., "What Effort Level Should I Choose? On the Economics of Reasoning Effort in LLM Agents", arXiv:2610.34491, https://arxiv.org/abs/2610.34491 (abstract only; also R9 S3) - accessed: 2026-11-10 published: 2026-10-25
- [S5] Orlanski et al., "SlopCodeBench: Benchmarking How Coding Agents Degrade Over Long-Horizon Iterative Tasks", arXiv:2603.24755, https://arxiv.org/abs/2603.24755 (abstract only; also R8 S7) - accessed: 2026-11-10 published: 2026-03-25
- [S6] Trinh et al., "HiL-Bench (Human-in-Loop Benchmark): Do Agents Know When to Ask for Help?", arXiv:2604.09408, https://arxiv.org/abs/2604.09408 (abstract only; also R7 S14) - accessed: 2026-11-10 published: 2026-04-10
- [S7] Kapoor et al., "AI Agents That Matter", arXiv:2407.01502, https://arxiv.org/abs/2407.01502 (abstract only) - accessed: 2026-11-10 published: 2024-07-01
- [S8] Miller, "Adding Error Bars to Evals: A Statistical Approach to Language Model Evaluations", arXiv:2411.00640, https://arxiv.org/abs/2411.00640 (abstract only) - accessed: 2026-11-10 published: 2024-11-01
- [S9] Bowyer, Aitchison and Ivanova, "Position: Don't Use the CLT in LLM Evals With Fewer Than a Few Hundred Datapoints", arXiv:2503.01747, https://arxiv.org/abs/2503.01747 (abstract only) - accessed: 2026-11-10 published: 2025-03-03
- [S10] Wang, "Measuring all the noises of LLM Evals", arXiv:2512.21326, https://arxiv.org/abs/2512.21326 (abstract only) - accessed: 2026-11-10 published: 2025-12-24
- [S11] Bjarnason, Silva and Monperrus, "On Randomness in Agentic Evals", arXiv:2602.07150, https://arxiv.org/abs/2602.07150 (passages of the full text read) - accessed: 2026-11-10 published: 2026-02-06
- [S12] de la Rubia and Pafka, "Identical Runs, Different Results: Benchmarking AI Coding Agents on Open-Weight Models", arXiv:2609.33812, https://arxiv.org/abs/2609.33812 (passages of the full text read) - accessed: 2026-11-10 published: 2026-09-27
- [S13] Liu et al., "Coding Agents Have Converged: Why the SWE-bench Leaderboard Can No Longer Order Its Top Entries, and What to Measure Instead", arXiv:2609.17394, https://arxiv.org/abs/2609.17394 (passages of the full text read) - accessed: 2026-11-10 published: 2026-09-15
- [S14] Conn, "DeltaSelect: Affordable A/B Testing for Coding Agents", arXiv:2609.19607, https://arxiv.org/abs/2609.19607 (passages of the full text read) - accessed: 2026-11-10 published: 2026-09-17
- [S15] Yu et al., "UTBoost: Rigorous Evaluation of Coding Agents on SWE-Bench", arXiv:2506.09289, https://arxiv.org/abs/2506.09289 (abstract only) - accessed: 2026-11-10 published: 2025-06-10
- [S16] Zhang et al., "SWE-bench Goes Live!", arXiv:2505.23419, https://arxiv.org/abs/2505.23419 (abstract only) - accessed: 2026-11-10 published: 2025-05-29
- [S17] Yao et al., "tau-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains", arXiv:2406.12045, https://arxiv.org/abs/2406.12045 (abstract only) - accessed: 2026-11-10 published: 2024-06-17
- [S18] Khanal, Tao and Zhou, "Beyond pass@1: A Reliability Science Framework for Long-Horizon LLM Agents", arXiv:2603.29231, https://arxiv.org/abs/2603.29231 (abstract only) - accessed: 2026-11-10 published: 2026-03-31
- [S19] Kapoor et al., "Holistic Agent Leaderboard: The Missing Infrastructure for AI Agent Evaluation", arXiv:2510.11977, https://arxiv.org/abs/2510.11977 (abstract only) - accessed: 2026-11-10 published: 2025-10-13
- [S20] Gloaguen et al., "Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?", arXiv:2602.11988, https://arxiv.org/abs/2602.11988 (abstract only) - accessed: 2026-11-10 published: 2026-02-12
- [S21] Lulla et al., "On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents", arXiv:2601.20404, https://arxiv.org/abs/2601.20404 (abstract only) - accessed: 2026-11-10 published: 2026-01-28
- [S22] Khatri, "Do Context Files Help Coding Agents? A Two-Agent Ablation Study on Real Repositories", arXiv:2607.27250, https://arxiv.org/abs/2607.27250 (passages of the full text read) - accessed: 2026-11-10 published: 2026-07-28
- [S23] McMillan, "Instruction Adherence in Coding Agent Configuration Files: A Factorial Study of Four File-Structure Variables", arXiv:2605.10039, https://arxiv.org/abs/2605.10039 (abstract only) - accessed: 2026-11-10 published: 2026-05-11
- [S24] Ganz et al., "The Handoff Tax: Continuing Non-Native Trajectories in LLM Agents", arXiv:2608.24358, https://arxiv.org/abs/2608.24358 (passages of the full text read) - accessed: 2026-11-10 published: 2026-08-25
- [S25] Shi and Assuncao, "Hard Issue, Weak Model, or Bad Run? Rethinking Failure Prediction for Coding Agents", arXiv:2611.08285, https://arxiv.org/abs/2611.08285 (passages of the full text read) - accessed: 2026-11-10 published: 2026-11-05
- [S26] Manoharan et al., "Task-to-Model Optimization for Enterprise LLM Coding Assistants: A Data-Driven Framework for Cost-Optimal Routing", arXiv:2608.08528, https://arxiv.org/abs/2608.08528 (abstract only) - accessed: 2026-11-10 published: 2026-08-09
- [S27] Agarwal et al., "Deep Reinforcement Learning at the Edge of the Statistical Precipice", arXiv:2108.13264, https://arxiv.org/abs/2108.13264 (abstract only) - accessed: 2026-11-10 published: 2021-08-30
- [S28] Chen et al., "Rethinking the Value of Agent-Generated Tests for LLM-Based Software Engineering Agents", arXiv:2602.07900, https://arxiv.org/abs/2602.07900 (abstract only; also R4 S9) - accessed: 2026-11-10 published: 2026-02-08
- [S29] Li et al., "Preference Leakage: A Contamination Problem in LLM-as-a-judge", arXiv:2502.01534, https://arxiv.org/abs/2502.01534 (abstract only; also R7 S3) - accessed: 2026-11-10 published: 2025-02-03
- [S30] Wu et al., "RLM-Cascade: Response-Level Speculative Decoding for Cost-Efficient LLM API Serving", arXiv:2606.22840, https://arxiv.org/abs/2606.22840 (abstract only) - accessed: 2026-11-10 published: 2026-06-22
- [S31] Hu et al., "Analyzing and Mitigating Cost-Inefficient Behaviors in Coding Agents", arXiv:2609.30725, https://arxiv.org/abs/2609.30725 (abstract only) - accessed: 2026-11-10 published: 2026-09-25
- [S32] Gao and Peng, "More with Less: An Empirical Study of Turn-Control Strategies for Efficient Coding Agents", arXiv:2510.16786, https://arxiv.org/abs/2510.16786 (abstract only) - accessed: 2026-11-10 published: 2025-10-19
- [S33] Zhao et al., "SpecBench: Measuring Reward Hacking in Long-Horizon Coding Agents", arXiv:2605.21384, https://arxiv.org/abs/2605.21384 (abstract only) - accessed: 2026-11-10 published: 2026-05-20
- [S34] Sion and April, "Who Verifies the Builder? Toward Independent Assurance for Agent-Produced Software", arXiv:2610.28667, https://arxiv.org/abs/2610.28667 (abstract only) - accessed: 2026-11-10 published: 2026-10-16

## Method

Accessed 2026-11-10. R10 is design only: I ran no agent trial and no pilot (owner decision, 2026-11-10). The one calculation in this brief, the detectable-difference table in Sample size and variance, comes from a stdlib python script shown there; it computes statistical power for assumed rates and measures no agent. No file outside this repository was read. No subagent was used.

How papers were found. The arXiv API rejected my first batch of queries (HTTP 429, no results), and a later check returned 429 again, so I used none of its output. I found papers with the web search tool restricted to arxiv.org, then confirmed each paper's title, authors, first-submission date and abstract on its arxiv.org abstract page. Search results are summaries by the search tool, not evidence; I used them to find leads only, and I did not use one search-snippet figure about escalation recovery; I used only the figures in the paper's abstract and in the coding-agent findings that I read. For seven papers (S11, S12, S13, S14, S22, S24, S25) I fetched the HTML full text from arxiv.org and read the passages around the numbers I cite by searching for plain keywords; those are marked "passages of the full text read" in Sources, and all other papers were read at abstract level only.

The arXiv queries and searches were: "AI agents that matter" with cost-controlled evaluation; adding error bars to evals; SWE-bench contamination, insufficient tests, UTBoost and SWE-bench-Live; tau-bench pass^k reliability; DeltaSelect A/B testing for coding agents; run-to-run variance of coding agents on SWE-bench with repeated runs; effect of AGENTS.md context files on success rate and cost; cheap-first cascades and escalation for coding agents with cost per resolved issue; ablation of workflow stages (planning, test-first, review) in coding-agent pipelines; spec-driven development with verification depth scaled by risk against a fixed process. I ran no query for escape hatches, gate retirement or loop thresholds; R13 and R15 searched that ground and cite what they found, and I did not repeat their searches.

Carried-in inputs: the Open questions of R4, R6, R7, R8, R9, R11, R12, R13 and R15 in this repository, read in full for the triage table, and the hypothesis list in specs/planning-context.yaml.

## Evaluation methods in the literature

- Oracle. A test suite that only runs the pull request's own tests lets wrong patches pass: R4 traced 7.8 percent of patches counted correct to this, and that a full-suite run fixes it is an inference with its cost unmeasured [S2]. Adding generated tests to SWE-bench found 345 erroneous patches labelled passed, touching 40.9 percent of Lite and 24.4 percent of Verified leaderboard entries and changing 18 and 11 rankings [S15]. A benchmark of 30 systems tasks splits visible tests from held-out tests that compose the same features: every frontier agent saturates the visible suite, the held-out gap persists, and it grows by 28 points for every tenfold increase in code size [S33]. Agent-written tests mostly act as observation, not a gate (R4) [S28].
- Variance. Single-run pass@1 on SWE-bench Verified moved by 2.2 to 6.0 points depending on which run was used, across 60,000 trajectories, with standard deviations above 1.5 points even at temperature 0; the authors recommend several runs per task and a power analysis [S11]. One task replicated 52 times per agent-model pairing gave a run-to-run spread larger than the gaps between pairings, and resolving them would take tens to more than a hundred runs of each [S12]. Exact paired McNemar tests separated none of the adjacent top-30 entries on Verified [S13]. Error bars from the central limit theorem are too small below a few hundred datapoints [S9]; paired comparison with a stated super-population gives the formulas for planning an evaluation [S8]; paired prediction noise typically exceeds paired data noise, so averaging repeated runs raises power [S10]; interval estimates are the fix when only a handful of runs is affordable [S27].
- Cost. Report cost beside accuracy and optimise both [S7]. One large harness spent about 40,000 dollars on 21,730 rollouts over nine models and nine benchmarks and found higher reasoning effort reduced accuracy in most runs [S19]. Cost differed more than twentyfold between two agents on the same model, mostly through the prompt cache [S12]. A routing method argues for cost per completed task with failure escalation priced in; its abstract reports no results, only a methodology for future empirical study [S26]. R9 found no paper that holds a repository-level task set fixed and compares tiers and effort on pass rate and cost per accepted task (R9; the nearest are [S4] and one more).
- Contamination. A live benchmark of 1,319 tasks from issues created since 2024 across 93 repositories shows a performance gap against static SWE-bench [S16]; the original benchmark has 2,294 problems [S1]. An LLM judge prefers outputs from related models, so a judge from the same family as the agent is a leak (R7) [S29].
- Ablation of scaffolds and ceremony. No source found isolates ceremony stages (plan, test-first, review) on pass rate and cost together; R13 found none either (R13). The nearest are context-file ablations that disagree: no general gain and over 20 percent more cost [S20], 28.64 percent lower median runtime and 16.58 percent fewer output tokens on 124 pull requests [S21], correctness equivalent to within 10 to 15 points on 17 tasks and 288 runs [S22], and no detectable effect of four file-structure variables [S23]. One self-run case study removed plan review, cut cost, and saw scores fall [S14].
- Drift. Coding agents degrade over long iterative tasks, and prose guidance reduced initial erosion but not its rate (R8) [S5]. Reliability decays with task duration in software engineering tasks, and memory scaffolds hurt long-horizon performance across 10 models [S18]. Reliability across repeated attempts is a separate metric, pass^k [S17].

## Arms

- **Plain**: the host's default agent with the same model, tools and task prompt as every other arm, no weftwork instructions, no gate and no review; done is the agent's own claim. This is the control [S20][S22]. A variant adds the AGENTS.md conventions (R8) so the context-file question is answered in the same run [S20][S21][S22][S23].
- **Evidence gates**: plain plus a declared command the harness reruns after the last edit; the task is accepted only on exit 0 (H1), with a logged escape hatch (H4); no plan, review or release steps (R13). The held-out oracle in Measures and oracles scores every arm, including this one, so a gate's own command is not the only judge [S33][S34].
- **Full ceremony**: the whole bigpowers-style chain (R2): plan, tests first, verify, audit, independent review and release, applied to every task whatever its risk. It is the costliest arm and the one whose parts no source has isolated [S14]. A sub-arm scales the chain by the declared `risk:` field P0 to P3 (H7, R13), so risk-scaled and fixed ceremony differ in one variable.
- **Fixed tier**: one model tier and one effort level for every task, taken from R9's default tier table; run it at the standard tier first, with a light and a heavy tier as extra cells only where an experiment names them [S4][S19].
- **Routed**: the tier is chosen before the run from deterministic size signals (BCPs, files touched, repository size; H20, R9), starts low and escalates after a verified failure (H19). Escalation restarts the task with the stronger tier and the repository state, not the cheaper model's trajectory: raw continuation recovered less than half of the quality gap in both model families, and for one family restarting was cheaper and more accurate than continuing [S24]. Route on the task, not on the run: a pre-run difficulty score predicted failure far better than trajectory predictors [S25].
- **Held fixed**: model versions pinned by id, host and host version, tool set, system prompt apart from the arm's own text, per-run token and dollar ceiling, wall-clock cap, repository commit, container image, and prompt-cache state (cold or warm, the same in every arm), because cache behaviour alone moved cost twentyfold [S12] and temperature 0 still leaves run-to-run variance [S11]. Record the price table and its date with every run (unsourced).

## Task set

- Where tasks come from. weftwork has no product code, so its stories so far are research briefs and cannot serve as coding tasks (unsourced; inference from the project state). Candidate sources, in order of fit: tasks from the first build epic once code exists; seeded-defect tasks in a small repository the owner chooses; a subset of an executable benchmark such as SWE-bench [S1] or its live variant [S16], whose per-task container images make runs reproducible [S16].
- Selection. Choose tasks that have a runnable check and a held-out oracle, are small enough to run many times, and sit in an informative difficulty band: issue difficulty dominates failure (a pre-run difficulty score reached 0.92 AUROC) [S25], borderline difficulty is agent-specific (Spearman 0.75) [S22], and only 19.5 percent of tasks (22 of 113) tracked full-benchmark performance in one resampling analysis [S14]. Stratify by declared risk and by size so the routing and risk arms have cells to fill (unsourced).
- Seeded-defect subset. Plant known defects in finished-looking patches for the review experiments (E7, E8) and for H1's false-success test (R15); a fresh-context verifier found more of 46 seeded faults than the builder's own tests, and a verifier from another provider added no detection [S34] (unsourced for weftwork's own seeding method).
- Held-out failing case. Give every task a hidden test that the agent never sees and that composes features the visible tests exercise separately, so a patch that games the visible tests fails [S33][S2][S15]. Inadequate holdout sets let agents overfit [S7].
- Long task. Include at least one task of many iterations, so quality drift and verbosity can be measured over the whole run [S5][S18].
- Contamination and reproducibility. Prefer tasks created after the models' training cutoff, pin the repository commit and container, and record the model ids [S16]; a task from a public repository may still be in training data (unsourced for the models used).
- Outside the repository. Any task source outside this repository, including the legacy project that R14 read and any other clone, needs the owner to name that path again; the R14 exception does not carry over (CONVENTIONS.md, Boundaries). The owner also decides who pays for the runs and sets the total spend cap (unsourced).

## Measures and oracles

- Pass rate by declared command: the share of runs where the declared command exits 0 after the last edit (H1). Report it per arm as a paired difference with an interval, not a point score [S8][S9], and report pass@k and pass^k beside pass@1 when a task is run several times [S17][S11].
- Cost per accepted task: total spend over all attempts, including failed attempts, retries, escalations, reviews and re-plans, divided by the number of accepted tasks (H17, H19) [S7][S26]. Token cost alone misleads once retries and escalations count [S26]. R9's open question asks for exactly this measure on a fixed set (R9).
- Accepted: a task is accepted only when the declared command exits 0 after the last edit, the held-out oracle passes, and the run broke no rule (protected path, spend cap, scope). Runs that broke the task's rules held the highest scores in one replication, so compliance is reported beside quality and non-compliant runs are rejected first [S12]; the rule-break criteria are the project's own (unsourced).
- Stronger oracle: held-out tests that compose features, plus test augmentation, scored on every arm; R4 asked for resolution against a stronger oracle than the project's own tests [S2][S15][S33]. Add a mutant check of the `verify:` commands themselves (R13) so a gate that always passes is caught.
- Drift and verbosity: erosion and verbosity per iteration on the long task, with and without the conventions [S5] (R8), and a reliability decay curve across task duration [S18].
- Token and cache accounting: record input, output, cache-read and cache-write tokens per run, the price table and its date, and the tool-call count, because cost differed more than twentyfold on one model through the cache [S12] and three recurring behaviours (subsumed retrieval, similar script generation and test re-execution) account for up to 22.75 percent of task cost [S31] (R9 asks for the cache cost of an escalation).
- Escalation counts: escalations per task, tokens spent before the first escalation, and whether each was a restart or a continuation [S24]; a fixed turn limit at the 75th percentile of the baseline cut cost by 24 to 68 percent with minimal effect on solve rates in one study, so the cap is a held-fixed setting [S32].
- Failures stay in the denominator: a run stopped by a cap or a crash counts as not accepted, never dropped (unsourced; R15 left the cap behaviour untested).

## Sample size and variance

The table comes from a paired design: the same tasks run under both arms, one run per task per arm, each task scored pass or fail, compared with an exact McNemar test (an exact sign test on the tasks where exactly one arm passes) at alpha 0.05 and power 0.80. The discordant share is the share of tasks where the two arms disagree; I do not know it for weftwork (unsourced), so the table brackets it at 0.2 and 0.4. Cells are the smallest difference in pass rate, in percentage points, that reaches 80 percent power; "none" means no difference up to the discordant share reaches it.

| Tasks | Detectable difference, discordant share 0.2 | Detectable difference, discordant share 0.4 |
| --- | --- | --- |
| 20 | none | 39 points |
| 40 | 20 points | 29 points |
| 80 | 15 points | 21 points |
| 160 | 11 points | 15 points |

```python
import math
from functools import lru_cache

ALPHA = 0.05
POWER = 0.80


def pmf(n, k, p):
    return math.comb(n, k) * p**k * (1 - p) ** (n - k)


@lru_cache(maxsize=None)
def reject(m):
    """Counts x of A-only wins, out of m discordant pairs, that an exact
    two-sided sign test (McNemar's exact test) rejects at ALPHA."""
    out = set()
    for x in range(m + 1):
        lo = sum(pmf(m, k, 0.5) for k in range(x + 1))
        hi = sum(pmf(m, k, 0.5) for k in range(x, m + 1))
        if min(1.0, 2 * min(lo, hi)) <= ALPHA:
            out.add(x)
    return tuple(sorted(out))


def power(n, d, delta):
    """n tasks, share d of tasks where the two arms disagree, arm A passes
    a share delta more tasks than arm B."""
    q = (d + delta) / (2 * d)
    return sum(
        pmf(n, m, d) * sum(pmf(m, x, q) for x in reject(m))
        for m in range(n + 1)
    )


def detectable(n, d):
    for step in range(1, int(d * 100) + 1):
        if power(n, d, step / 100) >= POWER:
            return step
    return None


print("tasks discordant_share detectable_difference_points")
for n in (20, 40, 80, 160):
    for d in (0.2, 0.4):
        pts = detectable(n, d)
        print(n, d, pts if pts is not None else "none")
```

- What the table says. A 40-task set can only show a pass-rate difference of 20 to 29 points, and an 80-task set 15 to 21 points. Differences of a few points between ceremony levels or tiers cannot be resolved at the task-set sizes in the table; this matches the leaderboard audit, where exact paired tests separated none of 29 adjacent Verified pairs on 500 instances [S13]. An experiment whose decision rule needs a smaller margin than its table row is marked underpowered in its protocol.
- Runs per task. The table uses one run per task. Averaging runs lowers run noise, which exceeds data noise in paired comparisons [S10], but not the noise from sampling tasks, so more tasks set the floor and more runs only help below it (the gain for weftwork is unmeasured, unsourced). The planned default is 3 runs per task per arm, so pass^3 and pass@3 can be computed [S17][S11]. For a benchmark-level score, 9 runs per agent detect a 2-point gain and 36 detect a 1-point gain at 80 percent power when the run-to-run standard deviation is 1.5 points [S11]; those numbers are for 500 tasks and do not carry over to a small set. One study of 17 tasks and 288 runs could only bound the effect to within 10 to 15 points by equivalence testing [S22].
- Intervals. Report a paired bootstrap 95 percent confidence interval over tasks for every difference, and the exact McNemar test for pass and fail outcomes; do not use central-limit error bars at these sizes [S9][S8]. For cost per accepted task, which is continuous and paired, take the ratio per task and bootstrap over tasks; its spread is unmeasured, so the first ten tasks of any experiment estimate it before the rest are run (unsourced).
- Cheaper ways to run a comparison. A task-selection method picks a fixed task set within a dollar budget from tasks whose one-run results track the full benchmark; in one projection a 109-task one-run design costs 740.58 dollars against 3,063.63 for the full published protocol, and the projection shows expected detectability, not a realized test [S14].

## Experiment protocols

Cost scale: S is no agent runs or fewer than 50, M is 50 to 300 runs, L is more than 300 runs. Every decision rule is fixed here, before any run; a threshold below the detectable difference in the table is marked underpowered. Task counts follow the table: 80 tasks resolve 15 to 21 points.

- E1 (H1, done gate against model claim): arms are the model's own done claim, a transcript-only evaluator, and the harness-run gate after the last edit; all three judge the same 80 recorded runs of seeded finished-looking work, 2 runs per task, so the comparison is paired by construction. The measure is the false-success rate, accepted runs whose held-out oracle fails. Decision rule: confirm the gate clause of H1 if the gate accepts at least 25 points fewer false successes than the model claim with the lower bound of the paired 95 percent interval above zero; otherwise keep H1 refined. Cost M, about 160 runs, and it builds the seeded task set and oracle that E7 and E8 reuse [S2][S15][S33][S34].
- E2 (H4, gates and the escape hatch): arms are a gate with no hatch and a gate with a logged hatch, observed over the first build epic, not run as a trial. The measure is overrides, false alarms and observed failures per gate. Decision rule: retire a gate overridden as a false alarm in at least 3 of its first 10 firings, and keep a gate only with an observed failure logged against it; H4 is confirmed only if both happen at least once. The thresholds are tunable defaults, unsourced. Cost S, logging only; the evidence for any hard-gate claim today is a single self-run case [S14] and the R14 ledger (R13).
- E3 (H7, risk-scaled against fixed ceremony): arms are full ceremony on every task, ceremony scaled by the declared risk field P0 to P3, and evidence gates alone; 80 tasks stratified by risk, 20 per stratum, 3 runs each. The measures are pass rate with the held-out oracle and cost per accepted task. Decision rule: adopt risk scaling if cost per accepted task is at least 25 percent lower than fixed ceremony and the lower bound of the paired 95 percent interval for the pass-rate difference is above minus 20 points; a smaller margin is underpowered at 80 tasks. Cost L, about 720 runs [S14][S13].
- E4 (H17, fixed tier against routed tier): arms are the fixed standard tier, the fixed heavy tier and the routed arm; 80 tasks, 3 runs each. The measures are pass rate with the held-out oracle and cost per accepted task. Decision rule: adopt routing if cost per accepted task is at least 25 percent below the fixed standard tier and the lower bound of the paired pass-rate interval is above minus 20 points. Cost L, about 720 runs; light-tier and effort cells are added only after this cheaper design shows a gap [S4][S19][S26][S30].
- E5 (H19, start cheap and escalate against picking up front): arms are the standard tier up front, start light and escalate by restart after the first verified failure, and start light and continue the trajectory; 80 tasks, 3 runs each. The measures are cost per accepted task including the failed attempt and the escalation, escalation count and cache tokens. Decision rule: adopt escalation by restart if cost per accepted task is at least 15 percent below the up-front tier and the pass-rate lower bound is above minus 20 points; the continue arm is there to test the handoff tax. Cost L, about 720 runs [S24][S25].
- E6 (H20, sizing signals): arms are BCPs, files touched, repository size and a planner model's size rating, each used to predict first-try failure and tokens; no new runs, the outcomes of E4 and E5 supply the data. The measure is AUROC on tasks held out from the fit. Decision rule: a signal is reliable enough to route on if its AUROC on held-out tasks is at least 0.75 (a tunable threshold, unsourced) and it beats a pre-run difficulty score from other models' results. Cost S, but it waits for E4 or E5 [S25][S14].
- E7 (different-family reviewer): arms are a same-family reviewer, a different-family reviewer and a stronger same-family reviewer, so different is separated from stronger (R7); 60 seeded-defect patches, each reviewed once per arm. The measures are seeded defects found and false alarms per review. Decision rule: make a different-family reviewer the default only if recall is at least 15 points higher than the same-family reviewer with the lower bound of the paired interval above zero; the one earlier direct test was mixed and another provider added no detection in a pre-registered study [S3][S34][S29]. Cost M, about 180 reviews.
- E8 (fresh briefed context against continued context): arms are a fresh briefed reviewer, a reviewer that continues the builder's context and the builder's own tests; the same 60 seeded-defect patches. The measures are recall, false oracles and tokens per review. Decision rule: adopt the fresh context as the default if recall is at least 15 points higher than the continued context; in a pre-registered study a fresh-context verifier found more of 46 seeded faults than the builder's tests, at the price of rare false oracles [S34]. Cost M, about 180 reviews.
- E9 (review round cost): arms are each tool's own review loop (bigpowers reviewer, GSD verifier, Superpowers per-context review, BMAD triage, as R7 read them); 10 tasks per tool. The measures are tokens, dollars and wall time per round. Decision rule: flag any review round that costs more than the implementation it reviews and cap its rounds; no source gives a per-round cost, so this only counts (unsourced). Cost S, about 40 runs.
- E10 (decider Ask-F1): arms are a decider agent, always ask and never ask, on 50 tasks with planted ambiguity and some blocked states. The measure is Ask-F1, the score for asking when help is needed and proceeding when not, plus the cost of each wrong ask. Decision rule: allow auto-answers only for a class of decision where the decider's precision is at least 0.9; reversibility classes are R7's unsourced idea. Cost M, about 150 runs; whether Ask-F1 transfers from its benchmark to weftwork's decision requests is open [S6].

## Candidate measurements triage

The earlier briefs named these measurements for R10 and stopped. Cost is S (no agent runs, or fewer than 50), M (50 to 300 runs) or L (more than 300). Call: run first means before or alongside the first build epic because it needs no candidate workflow or is cheap; run later means after a workflow exists; build epic means it is a build task, not an experiment; drop means not worth doing here.

| ID | Source | Hypothesis | Measurement | Cost | Call |
| --- | --- | --- | --- | --- | --- |
| C01 | R4 | H1, H14 | Resolution against a stronger held-out oracle than the project's own tests | M | run first |
| C02 | R6 | H12 | Two agents on a small repository, disjoint then overlapping scopes, textual and semantic conflicts | M | run later |
| C03 | R6 | H11 | Tokens per dispatch, one agent per task against one per subsystem | S | run later |
| C04 | R7 | H13 | Different-family against same-family reviewer on seeded defects (E7) | M | run later |
| C05 | R7 | H13 | Fresh briefed context against continued context (E8) | M | run later |
| C06 | R7 | H14 | Review round cost per tool (E9) | S | run first |
| C07 | R7 | H1, H13 | Decider scored with Ask-F1 (E10) | M | run later |
| C08 | R7 | H14 | Mutation testing inside an agent review round | L | drop |
| C09 | R7 | H14 | Reviewer that runs one focused command against a reader only | M | run later |
| C10 | R8 | H3 | With and without AGENTS.md conventions: pass rate, cost, erosion and verbosity | M | run later |
| C11 | R8 | H2 | Conventions compiled into executable checks against prose-only compliance | M | run later |
| C12 | R8 | H3 | The sentence that code takes precedence, on a repository with a stale convention | S | drop |
| C13 | R8 | H3 | Command-resolution check on AGENTS.md: build it and log what it finds | S | build epic |
| C14 | R9 | H17, H18 | Light, standard and heavy tiers at two effort levels on a fixed task set (E4) | L | run later |
| C15 | R9 | H19 | Start low and escalate against the standard tier up front (E5) | L | run later |
| C16 | R9 | H15 | How many failures before escalating, N above one | M | run later |
| C17 | R9 | H20 | Do BCPs, repository size or file counts predict tokens or first-try failure (E6) | S | run later |
| C18 | R9 | H15 | Cache cost of an escalation, fresh dispatch against a mid-session switch | M | run later |
| C19 | R9 | H8 | Tokens added by tool and skill listings with and without tool search | S | drop |
| C20 | R11 | H21 | Effective sandbox per host: out-of-sandbox write, network call and credential read | M | run later |
| C21 | R11 | H23 | Planted instruction in a spec file, executed effects with and without a capability check | M | run later |
| C22 | R11 | H22 | False-positive rate of a repository-aware skill scan on the catalog | S | run later |
| C23 | R11 | H21 | Approval gate on and off in one host, plus a consequence-checking variant | M | run later |
| C24 | R12 | H26 | Transcript resume, note, and note plus excerpts, on one task | L | run later |
| C25 | R12 | H25 | Context warning hook on and off at 35 and 25 percent | M | run later |
| C26 | R12 | H24 | Do the hard rules survive a compaction on pi and Claude Code, with and without re-injection | M | run later |
| C27 | R12 | H26 | Size of specs/state.yaml and its handoff note, and the cost per session start | S | run first |
| C28 | R12 | H8 | Plain files against a database-backed tracker on the same task set | L | drop |
| C29 | R13 | H2, H6, H16 | A failing hook on five hosts, with and without the fail-closed option | M | run later |
| C30 | R13 | H2 | Mutant check of finished stories' verify commands against held-out failing cases | S | run first |
| C31 | R13 | H4 | Overrides and false alarms of a logged hatch over a longer window (E2) | S | build epic |
| C32 | R13 | H7 | Risk-scaled against fixed ceremony, declared risk field first (E3) | L | run later |
| C33 | R13 | H16 | CLI engine against server cost per tool call | S | build epic |
| C34 | R13 | H27 | Conflict rate when two hosts write through one engine | M | run later |
| C35 | R15 | H1 | Done gate against model claim on seeded false successes (E1) | M | run first |
| C36 | R15 | H1 | Edit after a passing run: does the gate rerun | S | run first |
| C37 | R15 | H15 | No-progress thresholds 2, 3 and 5 replayed on recorded loops | M | run later |
| C38 | R15 | H15 | What each host's cap leaves on disk when it trips | S | run later |
| C39 | R15 | H15 | Claude Code Stop-hook override after eight continuations: end state and what the user sees | S | run later |
| C40 | R15 | H15 | A stated budget with and without a tracker on one task set | M | run later |

## Verdicts

- H1: refined - R4, R7 and R15 refined it; R10 adds that a declared command is evidence only against an oracle that is not the command itself, because passing patches fail a stronger oracle in two studies and visible tests are gamed more as tasks grow longer, and an independent fresh-context verifier found more seeded faults than the builder's tests; the clause "after the last edit" has no source and E1 and C36 would test it; nothing was run, so this is literature-supported, not measured [S2][S15][S33][S34]
- H4: refined - no study of escape hatches, overridden-gate retirement or gates added only after an observed failure was found by R13 or by this brief's searches (none was run for it); the only evidence that a single process step may or may not earn its place is one self-run case study where restricting plan review cut cost and lowered the score; E2 would count overrides over the first build epic; nothing was run [S14]
- H7: refined - no source compares risk-scaled with fixed ceremony on pass rate and cost (R13), and this brief's two ceremony-ablation searches found only context-file studies that disagree on cost and success and a single case study; at 80 tasks only differences of 15 to 21 points are detectable, so "the same pass rate at lower cost" can be shown only within a wide margin; E3 is designed, not run [S20][S21][S22][S14][S13]
- H17: refined - one proxy deployment cut API cost by 45.8 percent on 125 requests of one workload with quality at or above the baseline on a 20-task benchmark, and a routing method argues for cost per completed task but its abstract reports no results, while higher reasoning effort reduced accuracy in most runs of a large harness; no study holds a repository-level task set fixed across tiers and measures cost per accepted task (R9); E4 would; nothing was run [S30][S26][S19][S4]
- H19: refined - escalating by continuing the cheaper model's trajectory recovered less than half of the quality gap in both model families and, for one family, restarting with the stronger model was cheaper and more accurate, and per-issue model switching gained nothing on held-out runs while trajectory predictors added nothing beyond issue difficulty and model ability; the claim can hold only if escalation restarts and an evidence gate marks the failure; E5 would test it; nothing was run [S24][S25]
- H20: refined - a pre-run difficulty score from other models' results predicted failure at 0.92 AUROC against about 0.62 for trajectory predictors, which says pre-run signals can route; no source tests deterministic signals such as BCPs, file counts or repository size, so E6 would; nothing was run [S25][S14]

## Implications for weftwork

- Treat R10 as a plan for a measurement harness, not a set of arguments: the first build epic records one row per run (arm, task, model id, host version, token counts by type, price table date, declared-command result, oracle result, rule breaks, escalations) in a plain file; no schema is imported (unsourced design; the fields follow [S12][S19][S31]).
- Start with the cheap measurements that need no candidate workflow: round cost (C06), state-file size (C27), a mutant check of existing verify commands (C30), the stale-pass clause (C36) and the done gate against seeded false successes (C35, E1). E1 also builds the seeded task set and held-out oracle that the review experiments reuse [S2][S15][S33].
- Do not promise small effects. At 80 tasks only 15 to 21 points are detectable, so claims such as risk scaling "does not lose pass rate" carry a wide margin, and the plan reports intervals, not winners [S13][S9][S8].
- Define acceptance once and use it everywhere: declared command after the last edit, held-out oracle, no rule break; reject rule-breaking runs before ranking arms [S12].
- Make the held-out oracle part of every task's definition from the first build epic, so the gate is never the only judge [S33][S34].
- Escalate by restart with the repository state, not by continuing the cheaper model's trajectory, until E5 says otherwise [S24].
- Route on pre-run task features, not on in-run signals, until E6 shows a deterministic signal that works [S25].
- Fix the prompt-cache state across arms and report cost with the cache split out, since cache behaviour can outweigh model price [S12].
- Pass^k and pass@k are cheap once runs exist; report them for any claim about reliability, not only for pass@1 [S17][S11].
- Choosing the task source and the spend cap is the owner's call, and the answer shapes e04s02's first release; until then no experiment can start (unsourced).

## Earns its place vs ceremony

- Held-out oracle on every arm: earns its place; it costs one hidden test per task and two studies and a benchmark show passing patches that fail a stronger check [S2][S15][S33].
- Paired design with repeated runs and bootstrap intervals: earns its place; single runs and point scores are within noise at these sizes [S11][S12][S13][S8].
- Cost per accepted task with all attempts and the cache split out: earns its place; token price alone misleads and cache effects are large [S26][S12].
- Full-ceremony arm: ceremony until measured; no source isolates its stages and the one case study cut cost by removing a step [S14].
- Routed arm with escalation by restart: unproven; it earns its place only if E4 and E5 meet their rules, and raw continuation is dominated in one study [S24].
- Adding AGENTS.md conventions to every arm: ceremony until measured; four studies disagree on cost and show no general success gain [S20][S21][S22][S23].
- Always-high reasoning effort as the fixed tier: do not assume it pays; higher effort reduced accuracy in most runs of one large harness [S19][S4].
- LLM-judge scoring for acceptance: ceremony, avoid it; a judge from a related family is a leak, and commands and held-out tests are available [S29].
- A pilot run before a candidate workflow exists: not yet; it would test the harness, not the claims, and the table above says 20 tasks resolve nothing under 39 points.

## Open questions

- Which repository supplies the tasks, and who sets the spend cap? Owner decision; an outside path must be named again (CONVENTIONS.md). Until decided, no experiment can start (unsourced).
- What discordant share do real weftwork arms show? The table brackets it at 0.2 and 0.4 and I know no figure for coding arms on a small set; a first small run would estimate it (unsourced).
- How large is the run-to-run spread of cost per accepted task, in log terms? Unmeasured; the first ten tasks of an experiment estimate it (unsourced).
- Do more runs per task substitute for more tasks? The paired noise result says averaging helps [S10], but its size for a 40 to 80 task coding set is unknown (unsourced).
- Candidate hypothesis for e04s02 (not added to planning-context.yaml): "A workflow claim is a finding only when it is a paired difference with an interval against a held-out oracle that the agent never saw; a pass of the declared command alone is not enough." H1 covers the gate and none of H1 to H27 covers the oracle or the interval [S2][S33][S13].
- Papers read at abstract level only (all but S11, S12, S13, S14, S22, S24 and S25) should be read in full before a verdict rests on a number from them; in particular S2, S15, S33 and S34 for the oracle claims, and S19, S26 and S30 for the routing numbers.
- The four R11 papers left unread (arXiv:2609.39678, 2610.02456, 2603.10387 and 2608.25817) and the R13 and R15 papers read only in passages are routed to e04s03, not here.
- Are there studies of escape hatches, gate retirement and no-progress thresholds that R13 and R15 missed? This brief ran no new query for them (see Method).
- Candidate new stories: a pilot of E1 with the cheap measurements C06, C27, C30 and C36 as the first build-epic evidence task; and a harness-recording task for the first build epic. Both go to the e04s02 synthesis.
