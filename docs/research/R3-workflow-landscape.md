# R3 — Workflow landscape

Research story R3, wave 2. Hypotheses H7 and H10.
Question: how do Spec Kit, OpenSpec, BMAD, Kiro and Superpowers
structure agentic coding work; what do Claude Code, Codex CLI, Cline
and Aider recommend; and what do credible practitioner reports say
went right or wrong.

Method: I read the README of each open-source tool through
`gh api repos/<owner>/<repo>/readme`, read the repository and latest
release metadata with `gh api`, and counted Superpowers skill folders in
its git tree [S1][S2][S3][S4]. I read Kiro's and the four hosts' own
documentation pages and five practitioner reports through fetch
subagents that returned summaries with short quotes; I did not open
those pages myself, so every statement drawn from [S5]-[S14] is
second-hand through a summary. The Graziano comparison page [S15] is a
secondary source by one author. I used it to choose the columns of the
table and to cross-check, never as the only support for a row. I did
not read the BSWEN and SpecsGraph comparisons that the scope seeds
named. The GSD and bigpowers rows summarize R1 and R2 [S16][S17], which
rest on those briefs' own reading of each tool's files (R1 [S1], R2
[S1]), and add no new research. I ran none of these tools. One practitioner report, EPAM's
Spec Kit brownfield post, returned HTTP 403 and is not used. No
tool-versus-tool controlled study was found; the papers cited are
background on the ideas inside these workflows, not tests of the tools.
Paper verdicts are reused from R4 [S18], not re-read.

## Sources

- [S1] github/spec-kit README, repository metadata and latest release v1.3.2, `gh api repos/github/spec-kit` (MIT; created 2025-08-21; last push 2026-11-07; 148,685 stars), https://github.com/github/spec-kit - accessed: 2026-11-08 published: 2026-11-06
- [S2] Fission-AI/OpenSpec README, repository metadata and latest release v1.16.1, `gh api repos/Fission-AI/OpenSpec` (MIT; created 2025-08-05; 74,294 stars), https://github.com/Fission-AI/OpenSpec - accessed: 2026-11-08 published: 2026-11-07
- [S3] bmad-code-org/BMAD-METHOD README, repository metadata and latest release v6.12.4, `gh api repos/bmad-code-org/BMAD-METHOD` (license field NOASSERTION; README badge says MIT; created 2025-04-13; 55,132 stars; v7 in preview alpha), https://github.com/bmad-code-org/BMAD-METHOD - accessed: 2026-11-08 published: 2026-10-14
- [S4] obra/superpowers README, git tree (15 `skills/*/SKILL.md` folders) and latest release v7.0.2, `gh api repos/obra/superpowers` (MIT; created 2025-10-09; 314,563 stars), https://github.com/obra/superpowers - accessed: 2026-11-08 published: 2026-11-03
- [S5] Kiro documentation, "Specs", https://kiro.dev/docs/specs/ (page says "Page updated: October 15, 2026"; read through a fetch subagent) - accessed: 2026-11-08 published: 2026-10-15
- [S6] Kiro, "Introducing Kiro", https://kiro.dev/blog/introducing-kiro/ (read through a fetch subagent) - accessed: 2026-11-08 published: 2025-07-14
- [S7] Claude Code documentation, "Best practices", https://code.claude.com/docs/en/best-practices (no date shown; the subagent could not read the whole page, and the explore-plan-code-commit and plan-mode sections were not reached) - accessed: 2026-11-08 published: undated
- [S8] Codex documentation, "AGENTS.md" and "Working with agents", https://learn.chatgpt.com/codex/agent-configuration/agents-md and https://learn.chatgpt.com/codex/working-with-agents (reached by redirect from developers.openai.com/codex; no date shown; no best-practices page found) - accessed: 2026-11-08 published: undated
- [S9] Cline documentation, "Plan & Act", "Memory Bank" and "Cline Rules", https://docs.cline.bot/core-workflows/plan-and-act.md, https://docs.cline.bot/best-practices/memory-bank.md, https://docs.cline.bot/customization/cline-rules.md (no date shown) - accessed: 2026-11-08 published: undated
- [S10] Aider documentation, "Chat modes" and "Tips", https://aider.chat/docs/usage/modes.html and https://aider.chat/docs/usage/tips.html (no date shown) - accessed: 2026-11-08 published: undated
- [S11] Li, "Spec-driven development: The Good Parts - and what we learned after three months", Asana Engineering, https://asana.com/inside-asana/spec-driven-development (internal harness, not a tool in this table; practitioner report, uncontrolled) - accessed: 2026-11-08 published: 2026-09-16
- [S12] Thoughtworks Technology Radar, "GitHub Spec Kit" (Assess ring; page marked "not on the current edition"), https://www.thoughtworks.com/radar/languages-and-frameworks/github-spec-kit - accessed: 2026-11-08 published: 2026-04-15
- [S13] Fisher, "Building an RFP finder with Spec Kit", Atomic Object, https://spin.atomicobject.com/rfp-finder-speckit/ - accessed: 2026-11-08 published: 2026-01-15
- [S14] Eretz Kdosha, "I tested three spec-driven AI tools, here's my honest take", Ran the Builder (versions evaluated in February 2026: BMAD v6.0.3, Spec Kit v0.1.6, OpenSpec v1.2.0), https://ranthebuilder.cloud/blog/i-tested-three-spec-driven-ai-tools-here-s-my-honest-take/ - accessed: 2026-11-08 published: 2026-04-13
- [S15] Graziano, "Compare SDD frameworks, side by side", https://ainativesoftware.engineering/compare (27 criteria; footer "Sources checked 16 September 2026"; no publication date shown; secondary source) - accessed: 2026-11-08 published: undated
- [S16] weftwork R1 brief, `docs/research/R1-gsd.md` (GSD rows come from here) - accessed: 2026-11-08 published: 2026-11-08
- [S17] weftwork R2 brief, `docs/research/R2-bigpowers.md` (bigpowers rows come from here) - accessed: 2026-11-08 published: 2026-11-08
- [S18] weftwork R4 brief, `docs/research/R4-research-literature.md` (source of the paper verdicts reused here) - accessed: 2026-11-08 published: 2026-11-08
- [S19] Huang et al., "Large Language Models Cannot Self-Correct Reasoning Yet", ICLR 2024, arXiv:2310.01798, https://arxiv.org/abs/2310.01798 (as read in R4 [S8]) - accessed: 2026-11-08 published: 2023-10-03
- [S20] Gloaguen et al., "Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?", arXiv:2602.11988, https://arxiv.org/abs/2602.11988 (as read in R4 [S14]) - accessed: 2026-11-08 published: 2026-02-12
- [S21] Wang, Pradel and Liu, "Are 'Solved Issues' in SWE-bench Really Solved Correctly? An Empirical Study", ICSE 2026, arXiv:2503.15223, https://arxiv.org/abs/2503.15223 (as read in R4 [S18]) - accessed: 2026-11-08 published: 2025-03-19
- [S22] bigpowers `plan-work` skill, `/home/domtorr/.claude/skills/plan-work/SKILL.md` (section "Requirement delta tags": ADDED, MODIFIED, REMOVED, RENAMED, "OpenSpec-style"; machine-local) - accessed: 2026-11-08 published: undated
- [S23] Liu et al., "Lost in the Middle: How Language Models Use Long Contexts", TACL 2024, arXiv:2307.03172, https://arxiv.org/abs/2307.03172 (as read in R2 [S5]) - accessed: 2026-11-08 published: 2023-07-06

## Workflow comparison

Each row is stated from the tool's own page; the GSD and bigpowers rows
restate R1 and R2. The columns follow the criteria compared on [S15]. "Ceremony" is my reading of how many mandatory steps
the tool puts between an idea and code, not a measurement.

| Tool | Unit of work | Artifacts | Phases and gates | Ceremony |
| ---- | ------------ | --------- | ---------------- | -------- |
| Spec Kit | a feature or an application; bug fixing and idea assessment ship as optional extensions [S1] | constitution, then per-feature spec, plan and tasks [S1] | `constitution`, `specify`, `plan`, `tasks`, `implement`, `converge`, run one at a time with the owner reviewing each result; repeat implement and converge until `Converged`; entry points are "not mandatory phases" [S1] | medium; the extension, preset and bundle machinery adds a second layer [S1][S12] |
| OpenSpec | one change to an existing system [S2] | `proposal.md`, `specs/` with requirements and scenarios (the README example is an `ADDED Requirements` block), `design.md`, `tasks.md`, then an archive [S2] | `explore` (optional), `propose`, `apply`, `archive`; philosophy "fluid not rigid", no gate between phases is described [S2] | light [S2][S14] |
| BMAD | one build session at any size [S3] | briefs, specifications and architecture kept as durable context; specialized agent perspectives [S3] | `bmad-build` is the entry point and `bmad-help` says what is next; "right-sized process": small changes go straight to implementation, larger ones add planning [S3] | adjustable; the full path is heavy [S3][S14] |
| Kiro | one feature or one bug [S5] | `requirements.md` (or `bugfix.md`), `design.md`, `tasks.md` under `.kiro/specs/`; steering files and hooks [S5][S6] | requirements, design, tasks, each with a Review step for comments; Quick Spec makes all three "without approval gates"; tasks run in dependency waves [S5] | medium for Feature Spec, low for Quick Spec [S5] |
| Superpowers | a project or a task [S4] | design, then a plan of 2 to 5 minute tasks with exact paths and verification steps [S4] | brainstorming, worktree, plan, subagent-driven development, TDD, review between tasks, finish; 15 skills fire on their own and are "mandatory workflows, not suggestions"; "small changes get agreed in chat" [S4] | high by design, scaled by project size [S4] |
| GSD | a phase of a project [S16] | planning files, plans, summaries, verification notes [S16] | discuss, plan, execute, verify; `fast` for up to 3 edits, `quick`, then the full chain; guards advise and do not block [S16] | tiered by effort [S16] |
| bigpowers | a story in an epic [S17] | `specs/` YAML, epic capsules, task files, evidence files [S17] | 6 phases, 80 skills, prose "HARD GATE" lines in 74 of them, a hook for a few mechanical rules; `verify-work` scales by a declared `risk:` field [S17] | high; the largest catalog of the seven [S17] |

## Host practices

Capability details (hooks, subagents, plugins, per-dispatch model choice)
belong to R5. This section records only the workflow each vendor
recommends.

- **Claude Code** [S7]: give the agent "something it can run that comes
  back pass or fail" and ask for evidence such as command output; keep
  `CLAUDE.md` short with "only what Claude can't find by reading the
  repo", including test, typecheck and lint commands; rules that must
  always hold belong in hooks or deny rules, because prompts alone do
  not guarantee them; use subagents for independent review and for
  keeping long output out of the main context, at a token cost. The
  plan-mode and explore-plan-code sections were not reached.
- **Codex CLI** [S8]: `AGENTS.md` files are read "before doing any work",
  concatenated from the git root down to the working directory with
  closer files overriding, capped at 32 KiB by default; the guide on
  working with agents says to give a brief (goal, context, allowed
  actions, expected output), ask for a plan first when it fits, review
  visible steps and verify results yourself, and widen scope as
  reliability is shown.
- **Cline** [S9]: plan first ("planning first is highly recommended");
  Plan mode reads and searches but cannot edit or run commands, Act mode
  executes; size guidance is small tasks Act only, medium tasks Plan
  then Act, large tasks `/deep-planning`; an optional Memory Bank of
  six markdown files (`projectbrief.md`, `activeContext.md`,
  `progress.md` and others) is read at the start of every task; rules
  live in `.clinerules/` and should be short because "rules consume
  context".
- **Aider** [S10]: "bounce back and forth between /ask and /code";
  discuss the plan in ask mode, then say "go ahead"; architect mode uses
  two requests (a planner model, then an editor model) at higher cost;
  add only the files that need changes, split goals into small steps, and
  share test output with `/run` or `/test`.

No practice is common to all four hosts in what I read. A planning step
before edits is recommended by Codex CLI, Cline and Aider (the Claude
Code plan-mode section was not read); a short persistent rules file by
Claude Code, Codex CLI and Cline; running a check by Claude Code and
Aider. None describes a gate set by risk.

## Post-mortems

These are practitioner reports. None is a controlled study, none cites a
research paper, and each covers one team or one author.

- Asana [S11], on its internal `/spec-driven` harness (the page title says
  three months of use; the figures cover four months): seven engineers and
  524 merged PRs, PRs per week "rose
  38%" and the explicit-revert rate was 1.2% against 1.66% for other PRs,
  but the comparisons "weren't controlled"; creating a spec "took
  anywhere from 30 minutes to several days"; one infrastructure team
  found spec review a blocker; a data-migration plan went the wrong
  direction; about half of the engineers tried it [S11].
- Thoughtworks Radar [S12], Spec Kit, Assess ring (April 2026), mostly on
  brownfield work: a constitution that captures scope, versions and
  standards helped, and so did trimming the generated markdown, but
  "instruction bloat" led to "context rot" and to "unnecessary defensive
  checks and overly verbose markdown outputs that increased cognitive
  load" [S12].
- Atomic Object [S13], Spec Kit in Cursor on an internal tool: working system in
  production in about a week with no application code written by hand;
  the agents got dependency versions wrong, made page-specific tweaks
  instead of shared components, and did not preserve production data on
  schema changes; the author's line is that spec-driven development "gives
  you leverage, not absolution" and needs care on long-lived production
  systems [S13].
- Ran the Builder [S14], one serverless feature built with BMAD, Spec Kit and
  OpenSpec in February 2026: planning plus implementation cost $200 for
  BMAD Full, $85 for BMAD Quick, $75 for Spec Kit and $95 for OpenSpec
  (the report gives the figures per phase; I summed them); the author
  scored OpenSpec 4.00, BMAD Quick 3.74, BMAD 3.65 and Spec Kit 2.77 out
  of 5 and says to "take these scores with a grain of salt"; Spec Kit's
  code "didn't faithfully map to spec intent" and it has no built-in
  code review; BMAD's artifact set is "heavy and hard to review" [S14].
  One author, one feature, one run per tool.

## Verdicts

- H7: refined - the tools do scale ceremony, but by size or kind of change and by the human's choice, not by measured risk: Spec Kit says its processes are "independent entry points, not mandatory phases" [S1], BMAD sizes the process to the work [S3], Kiro offers a Quick Spec without approval gates [S5], OpenSpec states "fluid not rigid" [S2], Superpowers agrees small changes in chat [S4], Cline sizes the plan by task size [S9], GSD has `fast` and `quick` tiers [S16], and only bigpowers, in what I read, uses a declared `risk:` field, which defaults to P1 when missing [S17]. The reports say what too much ceremony costs: spec creation of 30 minutes to several days and a blocked review [S11], "instruction bloat" and "context rot" [S12], BMAD artifacts "heavy and hard to review" [S14]. None tests whether risk-scaled ceremony beats size-scaled or uniform ceremony; [S21] warns against cutting checks, since a too-narrow test run lets wrong patches pass, and [S19] favours checks that run over agents confirming themselves, so a risk scale should lower the amount of ceremony and keep the checks that run.
- H10: refined - small cores are common, a single entry command is not: the core flow of Spec Kit is 6 commands [S1], OpenSpec 4 [S2], Superpowers 15 skills [S4], and BMAD names `bmad-build` as the entry point and `bmad-help` for what is next [S3]; the Kiro specs page describes no slash commands [S5]. Against these, GSD has 54 commands behind a `/gsd-do` router and bigpowers has 80 skills with at least four candidate entry points [S16][S17]. I count each small tool by its core flow and the two large ones by their whole catalog, which flatters the small tools; Spec Kit's extension, preset, bundle and catalog layers [S1] show the pull towards a large catalog in a small-core tool. Two of seven tools have one named entry (BMAD, and GSD through its router); Superpowers has none because its skills fire on their own [S4]. The costs of size are reported, not measured: "context rot" [S12], Codex capping `AGENTS.md` at 32 KiB [S8] and Cline's "rules consume context" [S9]; [S23] gives a reason to expect harm from long listings and [S20] finds that context files raise cost without a general gain, but neither tests a skill listing. This is a survey of what exists; no source tests whether a small catalog or a single entry command works better, which is why the verdict is `refined`.

None is `confirmed`: no source tests any of these workflows as a
treatment against another. None is `refuted`: H7's direction (ceremony
should vary) holds in most of the tools I read, and H10's "small catalog" holds for
the small-core tools but not for GSD or bigpowers. Both are
`refined` because the variable the tools use for H7 is size, kind or
choice, not risk,
and H10 is a design claim that no source tests: two tools in seven have a
single entry command.

## Implications for weftwork

- Proposal, not a finding: scale ceremony by change size, and test risk
  as a second input in R10 and R13. Most tools use size, kind or
  choice; only bigpowers, in what I read, uses risk, through a declared field with a costly default
  [S17], and nothing here tests that. If weftwork copies the declared
  field, the e02s02 lesson from R2 is a lighter default for doc-only
  and data-only work [S17], with the checks that run kept [S19][S21].
- Proposal: keep a core of about 6 to 15 commands or skills and one named
  entry point. The open-source tools ship cores of this size [S1][S2][S4], though
  no source tests whether that size works better;
  BMAD's `bmad-build` plus `bmad-help` shows the entry-point shape [S3].
  Plan how extension points will be gated, since Spec Kit and BMAD grew
  past their cores [S1][S3].
- Make the artifact a short, reviewable file, not a bundle. The reports
  that went well praised small outputs, and the ones that went badly
  named volume [S11][S12][S14]. OpenSpec's delta specs are the one design
  here aimed at keeping a living spec current [S2] (its README example
  is an ADDED block); plan-work already uses the same delta tags
  [S22].
- Put a runnable check at each gate and review between tasks, as the
  hosts and Superpowers do [S4][S7][S8]. Spec Kit's lack of built-in code
  review was marked down by one report [S14]; the paper evidence on
  self-correction points the same way [S19].
- Treat a planning step, a short rules file and a verify command as
  practices that most hosts recommend, not all [S7][S8][S9][S10] (see
  Host practices for which). R5 should confirm which hosts let weftwork
  enforce each.
- Expect the human to stay in the loop. Asana reported a blocked spec
  review and a migration plan that went the wrong direction [S11], and
  Atomic Object's author concluded the same for production systems
  [S13].

## Earns its place vs ceremony

- Constitution or rules file (Spec Kit, Kiro steering, Cline rules, Codex
  and Claude Code instruction files): earns its place when short [S1][S5]
  [S7][S8][S9]; ceremony when it bloats [S12][S20].
- Separate requirements, design and tasks files per feature (Kiro, Spec
  Kit): earns its place for a feature large enough to need review in
  stages; ceremony for a small change, which is why Kiro ships Quick
  Spec [S5].
- Delta specs and an archive (OpenSpec): earns its place on brownfield
  work where the spec must stay current [S2]; unmeasured here.
- Plan before edit (Cline Plan mode, Aider ask mode, Superpowers
  planning, Codex "ask for a plan first"): earns its place; Superpowers,
  Codex CLI, Cline and Aider all recommend it [S4][S8][S9][S10]. The cost is a second
  request in Aider's architect mode [S10].
- Review between tasks (Superpowers, BMAD code review): earns its place
  where the report shows a miss that review would catch [S4][S14]; the
  evidence is one report [S14] plus [S19].
- Specialized agent perspectives (BMAD): unproven here; BMAD's README
  brings in "product, architecture, UX, development, and testing
  expertise when it helps" [S3], so they are optional.
- Mandatory skill triggering (Superpowers "mandatory workflows"): earns
  its place if skills stay few [S4]; ceremony once the count grows, as in
  R2's finding for bigpowers [S17].
- Extension, preset, bundle and catalog layers (Spec Kit): unproven for
  weftwork; adds a second system to learn [S1][S12].
- Persistent memory files (Cline Memory Bank): earns its place only if
  read by default each session; costs context every time [S9][S20].

## Open questions

- How large is each tool's catalog in tokens at session start? Counts of
  commands and skills are not token costs, and I did not measure any.
  Candidate story: measure the always-loaded listing of each tool in two
  hosts, with R5.
- Does any tool scale ceremony by risk with evidence? I found none; the
  next place to look is R10 (evaluation design) and R13 (enforcement).
- The Claude Code plan-mode and explore-plan-code guidance was not read;
  read it before R5 relies on this brief for Claude Code.
- Kiro is closed source; its approval gates, steering and hooks come from
  two pages read through a summary, and the specs page does not describe
  gates for Feature Specs directly [S5]. Read the steering and hooks pages
  before comparing enforcement in R13.
- BMAD is mid-transition: the README ships v6.12 as stable and v7 as a
  preview alpha with a mid-November 2026 release estimate [S3]. The row
  above may be out of date within weeks. Re-check before the synthesis.
- The practitioner reports use one feature or one team each and mix tool
  versions from February 2026 with later releases [S14]. A repeatable
  comparison on a weftwork-shaped task would be a candidate story for
  e04s01.
- The EPAM brownfield Spec Kit report could not be fetched (HTTP 403);
  the Thoughtworks entry covers the same ground [S12].
