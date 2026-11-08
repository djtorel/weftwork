# R4 — Research literature

Research story R4, wave 1. Assigned hypotheses: H1, H2, H13, H14, H18.
Question: which recent papers on agentic coding
bear on weftwork, and what does each one change?

Method: eight topics (agent-computer interfaces, planning, multi-agent,
self-verification, review/debate, context engineering, routing and
compute allocation, benchmarks). Candidates came from web searches
restricted to arxiv.org, plus [S8] and [S18], which the R14 brief
already cites. Every paper in the table was then checked against its
arXiv record on the access date: id, title, first author and v1 date
come from that record, and each verdict rests on the abstract. I did
not read full texts, except that I checked the body of [S18] for the
cause of its 7.8% figure. Venues are listed only where the arXiv record
states one, or (for [S18]) where the R14 brief already cites one;
"unchecked" means no venue was looked up, not that none
exists. Several unchecked papers are known to have venue versions. All
verdicts rest on abstracts, apart from one claim in [S18] checked in its
body. Four `applicable` verdicts ([S3], [S8], [S15], [S19]) are on
2023-2024 papers.
"Published" is the arXiv v1 submission date. By year of v1: 8 papers are
from 2023, 5 from 2024, 4 from 2025 and 3 from 2026, so the set leans
older than the "2024-2026" asked for in the question. Where a quoted
figure or title comes from a later version than v1, the source line says
so.

Not done: the two seed sources named in the scope pass (the SE-agent
surveys and "Code as Agent Harness") were not opened. Search found
enough primary papers without them. Survey papers are used only where a
survey is the topic ([S12]). Search summaries were wrong in R0, so no
figure below comes from a search summary.

## Sources

- [S1] Yang et al., "SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering", arXiv:2405.15793, https://arxiv.org/abs/2405.15793 - accessed: 2026-11-08 published: 2024-05-06
- [S2] Zhang et al., "AutoCodeRover: Autonomous Program Improvement", ISSTA 2024, arXiv:2404.05427, https://arxiv.org/abs/2404.05427 - accessed: 2026-11-08 published: 2024-04-08
- [S3] Xia et al., "Agentless: Demystifying LLM-based Software Engineering Agents" (figures quoted here are from v2; v1 reported 27.33%), arXiv:2407.01489, https://arxiv.org/abs/2407.01489 - accessed: 2026-11-08 published: 2024-07-01
- [S4] Jiang et al., "Self-planning Code Generation with Large Language Models", TOSEM, arXiv:2303.06689, https://arxiv.org/abs/2303.06689 - accessed: 2026-11-08 published: 2023-03-12
- [S5] Qian et al., "ChatDev: Communicative Agents for Software Development", ACL 2024, arXiv:2307.07924, https://arxiv.org/abs/2307.07924 - accessed: 2026-11-08 published: 2023-07-16
- [S6] Hong et al., "MetaGPT: Meta Programming for A Multi-Agent Collaborative Framework", arXiv:2308.00352, https://arxiv.org/abs/2308.00352 - accessed: 2026-11-08 published: 2023-08-01
- [S7] Shinn et al., "Reflexion: Language Agents with Verbal Reinforcement Learning", arXiv:2303.11366, https://arxiv.org/abs/2303.11366 - accessed: 2026-11-08 published: 2023-03-20
- [S8] Huang et al., "Large Language Models Cannot Self-Correct Reasoning Yet", ICLR 2024, arXiv:2310.01798, https://arxiv.org/abs/2310.01798 - accessed: 2026-11-08 published: 2023-10-03
- [S9] Chen et al., "Rethinking the Value of Agent-Generated Tests for LLM-Based Software Engineering Agents", arXiv:2602.07900, https://arxiv.org/abs/2602.07900 - accessed: 2026-11-08 published: 2026-02-08
- [S10] Du et al., "Improving Factuality and Reasoning in Language Models through Multiagent Debate", arXiv:2305.14325, https://arxiv.org/abs/2305.14325 - accessed: 2026-11-08 published: 2023-05-23
- [S11] Zhang et al., "Stop Overvaluing Multi-Agent Debate -- We Must Rethink Evaluation and Embrace Model Heterogeneity" (v1 title: "If Multi-Agent Debate is the Answer, What is the Question?"), arXiv:2502.08788, https://arxiv.org/abs/2502.08788 - accessed: 2026-11-08 published: 2025-02-12
- [S12] Mei et al., "A Survey of Context Engineering for Large Language Models", arXiv:2507.13334, https://arxiv.org/abs/2507.13334 - accessed: 2026-11-08 published: 2025-07-17
- [S13] Bui, "Building Effective AI Coding Agents for the Terminal: Scaffolding, Harness, Context Engineering, and Lessons Learned" (OpenDev; v1 title was "Building AI Coding Agents for the Terminal: ..." without "Effective"), arXiv:2603.05344, https://arxiv.org/abs/2603.05344 - accessed: 2026-11-08 published: 2026-03-05
- [S14] Gloaguen et al., "Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?" (quoted from the latest version, v3; the v1 abstract says context files "tend to reduce task success rates"), arXiv:2602.11988, https://arxiv.org/abs/2602.11988 - accessed: 2026-11-08 published: 2026-02-12
- [S15] Ong et al., "RouteLLM: Learning to Route LLMs with Preference Data", arXiv:2406.18665, https://arxiv.org/abs/2406.18665 - accessed: 2026-11-08 published: 2024-06-26
- [S16] Chen, Zaharia and Zou, "FrugalGPT: How to Use Large Language Models While Reducing Cost and Improving Performance", arXiv:2305.05176, https://arxiv.org/abs/2305.05176 - accessed: 2026-11-08 published: 2023-05-09
- [S17] Jimenez et al., "SWE-bench: Can Language Models Resolve Real-World GitHub Issues?", arXiv:2310.06770, https://arxiv.org/abs/2310.06770 - accessed: 2026-11-08 published: 2023-10-10
- [S18] Wang, Pradel and Liu, "Are 'Solved Issues' in SWE-bench Really Solved Correctly? An Empirical Study", ICSE 2026, arXiv:2503.15223, https://arxiv.org/abs/2503.15223 - accessed: 2026-11-08 published: 2025-03-19
- [S19] Snell et al., "Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling Model Parameters", arXiv:2408.03314, https://arxiv.org/abs/2408.03314 - accessed: 2026-11-08 published: 2024-08-06
- [S20] Zhu et al., "Scaling Test-time Compute for LLM Agents", arXiv:2506.12928, https://arxiv.org/abs/2506.12928 - accessed: 2026-11-08 published: 2025-06-15

## Papers

| Paper | Year | Venue | Topic | Verdict |
| ----- | ---- | ----- | ----- | ------- |
| Yang et al., SWE-agent [S1] | 2024 | unchecked | ACI | interesting |
| Zhang et al., AutoCodeRover [S2] | 2024 | ISSTA 2024 | ACI | interesting |
| Xia et al., Agentless [S3] | 2024 | unchecked | planning | applicable |
| Jiang et al., Self-planning [S4] | 2023 | TOSEM | planning | not relevant |
| Qian et al., ChatDev [S5] | 2023 | ACL 2024 | multi-agent | interesting |
| Hong et al., MetaGPT [S6] | 2023 | unchecked | multi-agent | interesting |
| Shinn et al., Reflexion [S7] | 2023 | unchecked | self-verification | interesting |
| Huang et al., self-correction [S8] | 2023 | ICLR 2024 | self-verification | applicable |
| Chen et al., agent-written tests [S9] | 2026 | unchecked | self-verification | applicable |
| Du et al., multiagent debate [S10] | 2023 | unchecked | review/debate | interesting |
| Zhang et al., debate evaluation [S11] | 2025 | unchecked | review/debate | applicable |
| Mei et al., context survey [S12] | 2025 | unchecked | context engineering | interesting |
| Bui, OpenDev [S13] | 2026 | unchecked | context engineering | interesting |
| Gloaguen et al., AGENTS.md [S14] | 2026 | unchecked | context engineering | applicable |
| Ong et al., RouteLLM [S15] | 2024 | unchecked | routing | applicable |
| Chen et al., FrugalGPT [S16] | 2023 | unchecked | routing | interesting |
| Snell et al., test-time compute [S19] | 2024 | unchecked | routing | applicable |
| Zhu et al., agent test-time scaling [S20] | 2025 | unchecked | routing | interesting |
| Jimenez et al., SWE-bench [S17] | 2023 | ICLR 2024 | benchmarks | interesting |
| Wang et al., solved issues [S18] | 2025 | ICSE 2026 | benchmarks | applicable |

Reasons, from the abstracts. Each `applicable` paper names the
hypothesis or later story it supports.

- [S1] interesting (R5, R13): interface design changes how well an agent
  edits, navigates and runs tests. That host adapters may therefore not
  be neutral is an inference; the paper does not study adapters.
- [S2] interesting: pairs an LLM with code search; the abstract gives
  no data on how much the search matters.
- [S3] applicable (H2): a fixed three-phase pipeline (localization,
  repair, validation) reached 32.00% on SWE-bench Lite at $0.70 (v2;
  v1 reported 27.33%), best among open-source agents when written. One
  benchmark, 2024.
- [S4] not relevant: plans inside one code-generation prompt; weftwork
  plans at the workflow level, not inside one model call.
- [S5], [S6] interesting: role-split agent teams and SOP-encoded
  workflows. [S5]'s abstract reports no results; [S6] reports more
  coherent solutions than earlier chat-based systems, with no figures.
- [S7] interesting: reflection on feedback, 91% pass@1 on HumanEval
  (latest version, v4) against 80% for GPT-4 at the time. The abstract does not separate
  external from simulated feedback.
- [S8] applicable (H1, H13): without external feedback, models struggle
  to self-correct and sometimes get worse.
- [S9] applicable (H14): agent-written tests mostly act as observation
  (print statements), and changing how many tests an agent writes did
  not significantly change outcomes in that study.
- [S10] interesting: debate between copies of one model improved
  reasoning in the authors' tasks; [S11] re-tests this.
- [S11] applicable (H13): five debate methods, nine benchmarks: debate
  often fails to beat chain-of-thought or self-consistency, and
  model heterogeneity improves it.
- [S12] interesting (R12): a taxonomy, not a test; useful as a map for
  the context topic.
- [S13] interesting (R9, R12): one open-source agent with model routing,
  a planner/executor split and context compaction. Single system,
  work in progress (its arXiv comment), authors' own claims.
- [S14] applicable (R8): in v3, context files do not generally raise
  task success and raise cost by over 20%; instructions are followed;
  repository overviews do not help. The v1 abstract is stronger: files
  tend to reduce success.
- [S15] applicable (R9): a router between a strong and a weak model cut
  cost over 2x in some cases at similar quality. General benchmarks,
  not coding.
- [S16] interesting (R9): LLM cascades; up to 98% cost reduction while
  matching the best single model. Pre-agent, not coding.
- [S17] interesting (R10): 2,294 problems from real GitHub issues and
  pull requests in 12 Python repositories; the benchmark that [S1],
  [S3], [S9] and [S18] evaluate on.
- [S18] applicable (H1, H14, R10): 7.8% of patches count as correct
  while failing the developer test suite, and the abstract puts the
  inflation of reported resolution rates at 6.2 points from all the
  weaknesses combined. The paper body says the cause is that
  SWE-bench runs only the developer test files the pull request
  changed, leaving other covered behavior untested. Separately, 29.6%
  of plausible patches behave differently from the ground truth.
- [S19] applicable (H18, R9): the best way to spend test-time compute
  varies with prompt difficulty, so effort is a knob separate from
  model size. Reasoning tasks, not coding.
- [S20] interesting (H18): test-time scaling improved language agents;
  knowing when to reflect matters.

## Verdicts

- H1: refined — external evidence beats self-report [S8], but a passing declared command is only as good as its scope [S18] [S8][S18]
  - Supported: [S8] finds that models struggle to self-correct without
    external feedback and sometimes get worse. [S18] finds that 7.8% of
    patches count as correct while failing the developer test suite. Its
    body gives the cause: SWE-bench "only uses the developer-written test
    files modified in the pull request (PR) for fixing the target issue".
  - Inference (this brief's): a weftwork gate has the same weakness if
    its declared command covers only tests near the change, and a
    candidate rule is to run the whole suite. [S18] does not test that a
    full run fixes this.
- H2: refined — [S3] shows a fixed, code-driven pipeline matched or beat open-source agent loops on SWE-bench Lite, and [S14] finds that prose repository overviews do not help while instructions are followed, which hints that facts may be better read from commands than described, but [S14] does not test that; the evidence is for deterministic control flow, not directly for stack facts or gate verdicts, and covers one benchmark [S3][S14]
- H13: refined — [S11] finds that model heterogeneity improves debate and [S8] finds that models struggle to self-correct without external feedback and sometimes get worse, which is a hint, not a test, that a different model should review (both tested debate and reasoning, not code review); no paper here tests fresh context or reversibility classes, so those parts are unsourced and go to R7 [S8][S11]
- H14: refined — passing tests overstate correctness [S18] and agent-written tests add little [S9]; mutation testing has no source here [S9][S18]
  - Supported: [S18] finds the 7.8% above and, as a separate and costlier
    tier, that differential testing shows 29.6% of plausible patches
    behave differently from the ground truth. [S9] finds that
    agent-written tests are mostly observation (print statements), and
    that changing how many are written did not significantly change
    outcomes in its setting.
  - Inference (this brief's): a review that only checks "tests ran" is
    weak. No paper here covers mutation testing, so that half of H14 is
    unsourced.
- H18: refined — [S19] shows that how much to spend at test time depends on prompt difficulty and that it trades off against model size, and [S20] finds gains for agents; the knob is separate and useful but not uniformly so, and neither paper tests a coding workflow or a vendor effort setting [S19][S20]

None is `confirmed`: every source tests reasoning, issue-resolution or
chat tasks, not a workflow like weftwork's, and no paper tests the
hypothesis wording itself. None is `refuted`: no source contradicts any
of them.

## Implications for weftwork

- Consider gating on a declared command that runs the whole suite, not
  only the tests near the change. [S18] traces 7.8% false passes to
  running only the pull request's test files; that a full run fixes this
  is an inference, and its cost is unmeasured (H1, H14; feeds R7, R10).
- Prefer code-driven control flow where a fixed order is known [S3], and
  consider reading stack facts from the repo by command instead of
  prose. [S14] only shows that overviews do not help; the command route
  is an untested inference (H2; feeds R8, R13).
- Test a different model as the reviewer in R7; [S11] gives a hint for
  debate only. Do not rely on one model re-reading its own work for
  reasoning tasks [S8] (H13; feeds R7).
- Keep context files short and about non-standard practice [S14]
  (feeds R8, R12; R10 can measure it on our own files).
- Treat model routing and effort as two settings [S15][S19]; test both
  on coding tasks before adopting either (H18; feeds R9).
- Do not add an agent-written test requirement as ceremony [S9]. Ask
  for tests that assert behavior.
- Candidate for R10: measure resolution against a stronger oracle than
  the project's own tests, as [S18] does with differential patch
  testing. Research code, cost unknown.

## Earns its place vs ceremony

Verdict labels: earns its place, ceremony, unproven. A verdict rests on
the cited source only.

- Repository overview sections in context files: ceremony [S14].
- A model reviewing its own output without external feedback: unproven,
  with a negative signal for reasoning tasks [S8]; code review is
  untested there.
- A different model as reviewer or debater: unproven, with a positive
  signal. [S11] finds that mixing models improves debate, but debate
  often fails to beat single-agent baselines, and it tests debate, not
  review.
- Same-model multi-agent debate: unproven [S11].
- Agent-written tests as a required step: unproven for outcomes [S9];
  they change process and cost.
- Running the whole test suite, not only the tests near the change:
  unproven, with a positive signal [S18]; the cost of a full run is not
  measured there.
- Differential testing of patches against a reference: unproven for
  this project [S18]; research code, cost unknown.
- Fixed pipeline over a free agent loop: unproven beyond one benchmark
  [S3].
- Model routing and test-time effort control: unproven for coding
  [S15][S16][S19].
- Role-split agent teams and SOP-encoded roles: unproven [S5][S6].

## Open questions

- No paper found for H14's "mutations tried" half or for H13's
  reversibility classes. R7 must search again, or say the claim is
  unsourced.
- Only [S18] and [S9] test the oracle problem on code. R10 may need its
  own measurement.
- [S19] and [S20] test reasoning and agent tasks, not a coding
  workflow with a reasoning-effort setting. R9 should find or run one.
- Eight papers here date from 2023 and only three from 2026. Coverage of
  late-2026 work is thin. R0 already lists unverified leads on loop
  termination and state stores.
- Venues for most rows are "unchecked". A later brief that needs a
  venue must look it up.
