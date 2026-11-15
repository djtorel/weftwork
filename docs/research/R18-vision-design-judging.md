# R18 Vision models as design judges

Question (docs/research/planning-context.yaml): how well do vision models judge the visual design of a UI from screenshots, and how much weight should the review council's design findings get? e11s06 (PR #73) made the council review a UI change as a design audit, with a severity rule (MUST-FIX only for an objective break; a judgement call is SHOULD-FIX; the score never gates) and left this brief to say whether that rule holds. Story e11s07.

## Sources

- [S1] Luera et al., "MLLM as a UI Judge: Benchmarking Multimodal LLMs for Predicting Human Perception of User Interfaces", arXiv:2510.08783v1, https://arxiv.org/abs/2510.08783 (full text, HTML version) - accessed: 2026-11-15 published: 2025-10-09
- [S2] Duan, Warner, Li, Hartmann, "Generating Automatic Feedback on UI Mockups with Large Language Models", CHI 2024, arXiv:2403.13139v1, https://arxiv.org/abs/2403.13139 (full text, HTML version) - accessed: 2026-11-15 published: 2024-03-19
- [S3] Duan, Chen, Li, Hartmann, Li, "UICrit: Enhancing Automated Design Evaluation with a UICritique Dataset", UIST 2024, arXiv:2407.08850v3, https://arxiv.org/abs/2407.08850 (full text, HTML version) - accessed: 2026-11-15 published: 2024-07-11
- [S4] Duan, Cheng, Hartmann, Li, "Visual Prompting with Iterative Refinement for Design Critique Generation", arXiv:2412.16829v2, https://arxiv.org/abs/2412.16829 (abstract only) - accessed: 2026-11-15 published: 2024-12-22
- [S5] Chen et al., "MLLM-as-a-Judge: Assessing Multimodal LLM-as-a-Judge with Vision-Language Benchmark", ICML 2024, arXiv:2402.04788v3, https://arxiv.org/abs/2402.04788 (abstract only) - accessed: 2026-11-15 published: 2024-02-07
- [S6] Rahmanzadehgervi, Bolton, Taesiri, Nguyen, "Vision language models are blind: Failing to translate detailed visual features into words", ACCV 2024, arXiv:2407.06581v6, https://arxiv.org/abs/2407.06581 (abstract only) - accessed: 2026-11-15 published: 2024-07-09
- [S7] Liang et al., "ColorBench: Can VLMs See and Understand the Colorful World? A Comprehensive Benchmark for Color Perception, Reasoning, and Robustness", arXiv:2504.10514v3, https://arxiv.org/abs/2504.10514 (abstract only) - accessed: 2026-11-15 published: 2025-04-10
- [S8] Macklon, Bezemer, "Exploring the Capabilities of Vision-Language Models to Detect Visual Bugs in HTML5 <canvas> Applications", arXiv:2501.09236v1, https://arxiv.org/abs/2501.09236 (abstract only) - accessed: 2026-11-15 published: 2025-01-16
- [S9] W3C, "Web Content Accessibility Guidelines (WCAG) 2.2", W3C Recommendation, definition of contrast ratio and Success Criterion 1.4.3, https://www.w3.org/TR/WCAG22/ - accessed: 2026-11-15 published: 2024-12-12
- [S10] weftwork brief R17, practitioner autonomy, `docs/research/R17-practitioner-autonomy.md` (its judge-consistency papers and the practitioner's noisy council scores) - accessed: 2026-11-15 published: 2026-11-15
- [S11] weftwork `docs/UI.md`, the e11s06 design audit and severity rule (PR #73) - accessed: 2026-11-15 published: 2026-11-15

## Method

Access date 2026-11-15. Three web searches found candidates; secondary pages in the results (blogs, review sites, tool pages) were not used as evidence. I read the abstracts of [S1] to [S8] through the arXiv API (`export.arxiv.org`, an `id_list` query and two `search_query` queries, five seconds apart) and searched the HTML full text of [S1], [S2] and [S3] for their result figures. [S4] to [S8] are abstracts only. [S9] was read for the contrast formula and threshold. No experiment was run.

The models in these papers are GPT-4, GPT-4V, GPT-4o, Gemini 1.5 Pro, Claude 3 and 3.5 and Llama 3.2 Vision (2024 to 2025). The council runs newer models. I found no 2026 measurement of design judging, so every number below is a historical result whose fit to today's council is unknown: newer models may do better or not, and nothing here measures them.

## What the literature says

Judgement of design quality (subjective):

- Absolute scores are weak. On 30 interfaces and nine UI factors rated by crowd workers on a 7-point scale, GPT-4o, Claude and Llama matched the rounded human score 35 to 38 percent of the time and came within one point 72 to 77 percent of the time [S1]. A factor could have the best correlation and the worst error at once ("Interesting"), or a low error and near-zero correlation ("Comfort") [S1].
- Pairwise is better than absolute, and better the larger the difference: agreement with the human preference between two UIs rose as the gap between their human scores grew [S1]. The general MLLM judge benchmark found the same split: close to humans on pair comparison, a large gap on scoring and batch ranking, with biases, hallucinated answers and inconsistent judgments even in GPT-4V [S5]. The text-only judge papers in R17 found numeric scales the main source of inconsistency [S10].
- Critiques without examples are mostly wrong. Gemini, prompted without curated examples, wrote 5,927 comments on 983 mobile UIs; designers validated 776 of them, 13.1 percent [S3]. Few-shot examples from a designer dataset and coordinates drawn on the screenshot improved the result by 55 percent over zero-shot [S3], and an iterative visual-prompting pipeline halved the gap to human critiques on one rating [S4]. Both still trail human designers [S3][S4].
- Heuristic evaluation against written guidelines, by a text-only model: GPT-4 read a JSON of the Figma layers (layout, text, element types, positions, sizes and colours), not an image, so this measures judging from structured data, not from screenshots [S2]. 52 percent of suggestions rated accurate, 19 percent partly accurate and 29 percent not accurate by three experts on 51 UIs [S2]. Against 12 experts, 9 percent of violations were found by the model only, 29 percent by both and 62 percent by humans only; the model missed most high-level issues that need the UI's purpose [S2]. The model's own finds were mostly subtle: poor text contrast, unclear labels, misalignment, found from the colour and position values in the JSON [S2]; it did worse where the JSON differed from what the UI showed [S2]. Accuracy fell as designers improved a mockup (39 percent accurate after edits), and the model applied a guideline to every element of a type whether or not there was an issue [S2]. Accuracy varied by guideline: "consistency and standards" was generally accurate, "aesthetic and minimalist design" generally not [S2].

Perception of fine detail (objective, but the model has to see it):

- Low-level vision is weak where elements are close: on seven simple tasks (do two circles overlap, how often do two lines cross, which letter is circled) four VLMs averaged 58 percent, the best 78 percent, against an expected 100 percent for people; accuracy went to near 100 percent when the shapes were far apart [S6]. Overlap and near-misalignment are exactly the layout defects a design audit looks for.
- Colour understanding has been "largely neglected": 32 VLMs show small gaps between models on colour perception and reasoning, colour cues sometimes mislead them, and chain-of-thought helps [S7]. No source read measures whether a model can read a contrast ratio from a screenshot.
- With context, defect detection can be strong: given the app's README, a description of the bug types and a bug-free screenshot, one VLM found injected layout, rendering, appearance and state bugs with up to 100 percent per-application accuracy on 100 screenshots [S8]. weftwork's before screenshot is close to that reference but not the same: it may hold defects of its own, and a change may rightly make the after screen differ from it.
- Contrast is a formula: (L1 + 0.05) / (L2 + 0.05) on relative luminance, at least 4.5:1 for normal text and 3:1 for large text at AA [S9]. A program computes it exactly from the colours in the code or the design reference.

## Verdicts

- H30: refined - the direction holds: a vision model's judgement calls are too unreliable to block (exact-score agreement 35 to 38 percent [S1], 13.1 percent of zero-shot critiques valid [S3], 29 percent of guideline findings not accurate and worse on later iterations even with structured data in place of an image [S2], inconsistent scoring [S5][S10]), and checks a program can make belong in the verify command [S9]. Refined in two ways. First, "objective" is not enough: a contrast failure or a near-overlap is objective, yet models misjudge exactly these fine colour and spatial details [S6][S7], so a design MUST-FIX must name its evidence (the reference rule and the value, the colours and the ratio, the element), and a contrast or exact-colour finding seen only in pixels is SHOULD-FIX until a program confirms it [S9]. Second, comparison earns more weight than absolute judgment: models agree with people more on pairs, and more when the difference is large [S1][S5], and a known bug-free reference screenshot lifts defect detection [S8], so a before-and-after difference the reviewer can point to is the strongest design finding, and a gross break visible against the before screenshot can block. The before screenshot is a weaker reference than [S8]'s, since it is not known to be free of defects. Third, evidence a model reads as values (colours and positions as data, as in [S2]) is a better basis for an exact claim than pixels; the design reference supplies some of those values.

## Implications for weftwork

- Keep the e11s06 rule [S11] and tighten it. The brief now says: a design MUST-FIX names its evidence (the design reference rule and the value that breaks it, the two colours and their ratio, or the screenshot and the broken element); a contrast or exact-colour finding seen only in a screenshot is SHOULD-FIX and names the programmatic check that would settle it (e11s07; `src/ui.ts`, `docs/UI.md`).
- Keep the score a report, never a gate: absolute 0-to-10 scores are the weakest form of model judgment in every source read [S1][S5][S10].
- Keep the before screenshots and the "compare before with after" instruction; pairwise judgment and a bug-free reference are where models do best [S1][S8]. Making before screenshots required for a UI change is a candidate, not a decision: it costs a step on every UI task and no source here measured the gain on a code-review task.
- The design reference (`ui.design`) gives the model written rules and token values to cite, which is the evidence the tightened rule asks for; [S3] found examples lift critiques, and [S2] found a model given colour and position values catches subtle contrast and alignment issues. Projects that care about design should set it.
- Contrast and off-token colours: put them in the verify command (an accessibility checker or a token lint), as `docs/UI.md` already says; the formula is exact [S9] and a model's view of pixels is not [S7].

## Earns its place vs ceremony

- Earns its place: the severity split (objective break with named evidence blocks, judgement does not); it costs one paragraph of brief and keeps a weak judge from blocking a merge [S1][S2][S3].
- Earns its place: before and after screenshots, since comparison is the judgment models make best [S1][S8].
- Earns its place: a programmatic contrast or token check in the verify command, where a project has colours in code [S9].
- Ceremony until measured: the 0-to-10 UI score. It is cheap and only reported, so it can stay, but no source supports reading meaning into it [S1][S5].
- Ceremony until measured: a multi-model design council or designer-curated few-shot examples per project; they help in the papers [S3][S4] but need a dataset per project and nothing shows the gain on a code-review task.

## Open questions

- Every number here is from 2024-2025 models. A small check on today's council (seeded design breaks in a fixture app: broken layout at one viewport, an off-token colour, a contrast failure, a near-overlap, plus clean changes) would measure false blocks and misses directly. Candidate story; it fits B7's measurement harness.
- No source measures whether a model can tell a WCAG AA pass from a fail in a screenshot; the tightened rule assumes it cannot reliably, from [S6] and [S7] by analogy.
- [S1] is 30 interfaces and crowd ratings of perception, not designer judgment of a change; [S2] and [S3] are mobile mockups. None reviews a diff with before and after screens, which is weftwork's case.
- Whether a design finding from two reviewers that agree is more reliable than one: the council supports several reviewers, but no source here measures agreement between model judges on design.
