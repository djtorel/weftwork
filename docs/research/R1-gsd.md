# R1 — GSD in depth

Research story R1, wave 2. Hypotheses H6, H7 and H10.
Question: what GSD ("Get Shit Done") does, which parts earn their place,
which are ceremony.

Method: read the local copy at `.pi/gsd` (file counts and line counts by
`find` and `wc`), read the agents, workflows, hooks and config template
that carry a claim, then check upstream metadata with `gh api`. I did not
run any GSD command. The copy calls a CLI, `pi-gsd-tools`, which is not
installed on this machine, so every statement about behaviour comes from
reading the prompt files, not from watching them run. `.pi/` is
gitignored in this repository, so the local copy is machine-local
evidence; a reader without it must use upstream [S2].

## Sources

- [S1] GSD local copy, `.pi/gsd` (`VERSION` reads 1.30.0; hooks carry `gsd-hook-version: 1.30.0`; workflow files carry `<gsd-version v="1.12.4" />`; 201 files). "Published" is the upstream v1.30.0 release date; the workflow files are tagged an older version, so some are older than this date - accessed: 2026-11-08 published: 2026-03-27
- [S2] gsd-build/get-shit-done, upstream repository metadata via `gh api repos/gsd-build/get-shit-done` (MIT; created 2025-12-14; last push 2026-05-31; description "A light-weight and powerful meta-prompting, context engineering and spec-driven development system for Claude Code") and release list (newest listed: v1.43.0-rc2, 2026-05-17), https://github.com/gsd-build/get-shit-done - accessed: 2026-11-08 published: 2026-05-31
- [S3] gsd-build/get-shit-done release v1.30.0, `gh api repos/gsd-build/get-shit-done/releases/tags/v1.30.0` - accessed: 2026-11-08 published: 2026-03-27
- [S4] Liu et al., "Lost in the Middle: How Language Models Use Long Contexts", TACL 2024, arXiv:2307.03172, https://arxiv.org/abs/2307.03172 (publication date checked against the arXiv API; verdict rests on the abstract, which I recalled and did not re-read) - accessed: 2026-11-08 published: 2023-07-06
- [S5] Huang et al., "Large Language Models Cannot Self-Correct Reasoning Yet", ICLR 2024, arXiv:2310.01798, https://arxiv.org/abs/2310.01798 (as read in R4 [S8]) - accessed: 2026-11-08 published: 2023-10-03
- [S6] Wang, Pradel and Liu, "Are 'Solved Issues' in SWE-bench Really Solved Correctly? An Empirical Study", ICSE 2026, arXiv:2503.15223, https://arxiv.org/abs/2503.15223 (as read in R4 [S18]) - accessed: 2026-11-08 published: 2025-03-19
- [S7] Gloaguen et al., "Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?", arXiv:2602.11988, https://arxiv.org/abs/2602.11988 (latest version, v3, as read in R4 [S14]) - accessed: 2026-11-08 published: 2026-02-12
- [S8] Ong et al., "RouteLLM: Learning to Route LLMs with Preference Data", arXiv:2406.18665, https://arxiv.org/abs/2406.18665 (as read in R4 [S15]) - accessed: 2026-11-08 published: 2024-06-26
- [S9] weftwork R4 brief, `docs/research/R4-research-literature.md` (source of the paper verdicts reused here) - accessed: 2026-11-08 published: 2026-11-08

## What GSD is

Measured from [S1], by file count and line count:

| Part | Files | Lines |
| ---- | ----- | ----- |
| workflows | 65 | 22,711 |
| agents | 18 | 9,851 |
| templates | 43 | 8,245 |
| references | 15 | 3,810 |
| hooks | 5 | 612 |
| prompts (one per slash command) | 54 | 345 |

That is about 45,600 lines of prompt text and 612 lines of hook code
before any project runs. The prompts are thin entry points; the
workflows hold the logic. The state tool (`pi-gsd-tools`) is not in the
copy.

The flow, from `workflows/help.md` and the workflow files [S1]:

1. `/gsd-new-project`: questioning, optional research with four
   parallel researcher agents, requirements with v1/v2/out-of-scope,
   a roadmap. Writes `.planning/` (`PROJECT.md`, `REQUIREMENTS.md`,
   `ROADMAP.md`, `STATE.md`, `config.json`).
2. `/gsd-discuss-phase`: captures the owner's intent in `CONTEXT.md`.
3. `/gsd-plan-phase`: researcher, planner and plan-checker agents,
   with a revision loop of at most 3 iterations
   (`workflows/plan-phase.md` section 12). Writes `PLAN.md` files.
4. `/gsd-execute-phase`: groups plans into waves, runs the plans in a
   wave in parallel, one fresh executor agent per plan. Each executor
   commits after every task and stages files one by one, never
   `git add .` (`agents/gsd-executor.md`, `task_commit_protocol`).
5. `/gsd-verify-work`: a user-run acceptance walk-through that writes a
   UAT file and, on failure, plans gap-closure work. Separately, the
   `gsd-verifier` agent checks the phase goal backward: what must be
   true, what must exist, what must be wired, then scans for stubs. Its
   statuses are `passed`, `gaps_found` and `human_needed`
   (`agents/gsd-verifier.md`, steps 2 to 9).

Side paths: `/gsd-fast` (inline, no subagent; for work of at most 3 file
edits, `workflows/fast.md`), `/gsd-quick` (a lighter plan-and-execute
path), `/gsd-do` (a router that turns free text into a command and
"never does the work itself", `workflows/do.md`), plus about 45 more
commands for backlog, workspaces, milestones, UI review, profiling and
updates.

Enforcement is soft. The prompt-injection guard is "advisory warning
(does not block)"; the workflow guard is "a SOFT guard - it advises,
not blocks" and is off by default (`hooks.workflow_guard: false`); the
context monitor injects a warning at 35 percent context remaining and a
stop-and-save-state message at 25 percent ([S1] `hooks/`). The
`config.json` template ships eight confirmation gates, all `true`, and
sets `mode: interactive`, with `research`, `plan_check`, `verifier` and
`nyquist_validation` on. `auto_advance` is off.

Per-agent model choice: four profiles (`quality`, `balanced`, `budget`,
`inherit`) map each of 15 agents to opus, sonnet or haiku. Under the
default `balanced` profile the planner is opus; executor, researchers
and checkers are sonnet, except the codebase mapper, which is haiku
([S1] `references/model-profiles.md`).

Version caveat: the copy mixes versions. `VERSION` and the hooks say
1.30.0, but every workflow file is tagged 1.12.4. The newest upstream
release I could list was v1.43.0-rc2 [S2], 13 minor versions ahead of
1.30.0 [S3]. Any statement here about what GSD does today may be stale.

## Verdicts

- H6: refined - GSD is built workflow-first and enforces softly: the guards advise and do not block, and the workflow guard ships off ([S1] `hooks/`); that shows one mature tool chose this order, but nothing in [S1] or the papers [S5][S6] tests that the order beats the reverse, and the verifier's goal-backward checks are a form of evidence gate inside the workflow, so "enforcement second" is better stated as "evidence checks inside the workflow, hard blocks later or never".
- H7: refined - GSD has tiers by effort, not by measured risk: `fast` for up to 3 edits, `quick`, then the full discuss-plan-execute-verify chain, plus a `granularity` setting and switches for research, plan check and verifier ([S1] `workflows/fast.md`, `templates/config.json`); the owner or a triviality check picks the tier, and no file scores risk. No source tests whether risk-scaled ceremony works better ([S6] only shows that unscaled checks on tests can mislead).
- H10: refined - GSD is a counter-example to "small catalog": 54 commands, 65 workflows and 18 agents ([S1]), and its own `/gsd-do` router exists to hide that size, which supports "one entry command per host" and refutes "small catalog" for this tool; whether a large catalog costs context or accuracy is unmeasured, though [S4] gives a reason to expect cost when long text sits in the middle of a context and [S7] shows that extra context files raise cost without a general gain.

None is `confirmed`: no source tests GSD, or workflow-first design, as a
treatment. None is `refuted`: GSD's design is consistent with H6 and
H7, and its size contradicts only the "small catalog" half of H10,
which is why that one is `refined`, not `confirmed`.

## Implications for weftwork

- Copy the tiering idea, not the tiers: a trivial path (inline, no
  subagent) and a full path both exist in GSD [S1]. weftwork needs a
  rule that picks the tier from the change, for example the number of
  files touched, because GSD leaves the choice to the owner. This is an
  inference from [S1], not a finding.
- A router command is the thing to keep if the catalog grows: `/gsd-do`
  shows the shape [S1].
- Goal-backward verification, with stub detection and a wiring check,
  is the one GSD part that checks the product and not the paperwork. It
  asks "is the goal true" and not "did the task finish". Candidate for
  weftwork's evidence gate, but run by a model, so the self-review
  warning applies [S5].
- Fresh executor context per plan, with a commit per task, is cheap to
  copy, since the rules are a few paragraphs in `gsd-executor.md` [S1].
- The context-monitor hook is a concrete answer to a R12 question: warn
  the agent, not just the user, at set thresholds [S1]. R12 should
  decide the thresholds.
- Do not copy the size. About 45,600 lines of prompt text before a
  project starts is a load for any host and a maintenance burden
  that weftwork's v1 should avoid [S1].
- GSD ships by npm, for Claude Code first, and the copy shows ports for
  other hosts (the `.pi/gsd` layout and `pi-gsd-tools`) [S1]. The port
  mixes version tags, which is a warning about shipping prompt files for
  several hosts with no common version check. R5 and R13 should look at
  this.

## Earns its place vs ceremony

Verdict labels: earns its place, ceremony, unproven. A verdict rests on
the cited source only. Where a source is missing the label is
`unproven`, with the direction of any signal.

- Goal-backward verification (truths, artifacts, wiring, stub scan):
  unproven, positive signal. [S6] finds that passing tests overstate
  correctness, which is the failure this check targets; GSD gives no
  data on how often it catches a real stub [S1].
- Plan checker with a revision loop of at most 3: unproven, negative
  signal. [S5] finds that models struggle to self-correct without
  external feedback; the checker has no tool run to lean on, though under
  `balanced` it is a different model than the planner (sonnet against
  opus) [S1], which [S5] does not test.
- Fresh subagent context per plan, waves in parallel: unproven, positive
  signal for short contexts [S4]; no data on cost or on merge conflicts
  between parallel plans [S1].
- Codebase map of seven documents (stack, architecture, structure,
  conventions, testing, integrations, concerns): ceremony, by analogy.
  [S7] finds that repository overviews in context files do not help; the
  analogy is mine, since [S7] tests `AGENTS.md` files and not GSD's
  mapper output.
- Eight confirmation gates, all on by default: unproven. Each gate
  keeps the owner in control; none is tied to a failure it caught [S1].
- Four parallel researcher agents at project start: unproven; no data on
  yield or cost [S1].
- Per-agent model profiles: unproven, positive signal. [S8] shows
  routing between a strong and a weak model cut cost with little quality
  loss; GSD picks the model by role, not per query, and reports no
  results [S1].
- Soft guards (injection scan, workflow guard): unproven. They cannot
  block, and the workflow guard ships off [S1], so as shipped they add
  text and little else.
- Context-monitor warnings at 35 and 25 percent remaining: unproven,
  positive signal for the idea [S4]; GSD reports no data on the
  thresholds [S1].
- `/gsd-fast` and `/gsd-quick` (the cheap tiers): unproven; they match
  the H7 shape and no source tests them [S1].
- Manual UAT walk-through: unproven; it is an external check and so
  avoids the [S5] limit, at the cost of the owner's time.
- Roughly 45 commands beyond the main flow (backlog, workspaces,
  milestones, UI, profiling): ceremony for weftwork's purpose, by
  scope: weftwork is for coding agents on one repository and none
  of these is needed for the research program [S1]. This is a scope
  judgment, not a measurement.

## Open questions

- Does a current GSD (v1.43) still look like the 1.30.0 copy? The
  workflow files in the copy carry 1.12.4, so the copy may not match any
  release. A story could install a current release and compare file and
  line counts. Candidate new story.
- How often does the verifier's goal-backward check find a real stub?
  GSD has no published figure in what I read [S1][S2]. R10 could test
  the check on a small task set.
- Does the size of the catalog change agent accuracy or cost? No source
  here measures it. R10 might include a run with a trimmed catalog.
- I did not read the Nyquist validation, UI, profiling or debugger parts
  in depth. Nyquist validation (`workflows/plan-phase.md`, "Dimension 8")
  looks like extra plan-time ceremony, but I did not read enough to
  label it.
- I did not look at how GSD handles `STATE.md` across sessions beyond
  the commands that read it. R12 owns that question.
- The README and docs on the upstream site were not read; they may
  carry claims or data about quality that I did not check [S2].
