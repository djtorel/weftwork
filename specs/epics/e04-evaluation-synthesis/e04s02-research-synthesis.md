# e04s02 — Research synthesis

**type:** research (brief)
**risk:** P2
**context:** infra
**bcps:** 3
**epic:** e04 (Evaluation and synthesis, wave 4)
**research story:** synthesis, hypotheses H1 to H27

Risk note: the epic's P2, as e04s01 and e04s03 used. No code ships, no
model tokens are spent and nothing is measured. Every claim is a rollup
of the 17 briefs already on `main`.

Owner decisions on 2026-11-11. The owner asked for plain explanations of
three open items and accepted the recommendations given:

- **Task source: deferred.** No repository is named and no outside path
  is read. The synthesis records two options. The leading source is the
  first build epic's own tasks. For the first experiment (R10's E1, the
  done gate against seeded false successes) it proposes a small fixture
  repository inside weftwork with planted defects. This is the agent's
  inference from R10, which marks it unsourced. The owner decides only
  when an experiment is about to run.
- **Spend cap: deferred, in two parts.** For the research experiments the
  owner sets a hard dollar cap per experiment when one is about to run,
  and starts with a small pilot; no number is set now. For the product,
  the synthesis records a candidate design requirement: a budget setting
  kept in plain per-repository files with a user-level global default
  that a repository overrides; stopping runs on a budget is off by
  default, and counting and showing cost is always on. This is the
  agent's suggestion; no source tests defaults (R15 supports the
  engine counting its own ceilings and an exhausted budget never counting
  as done).
- **Stack: TypeScript on Node, as a recommendation.** One package that is
  both a command-line program (JSON on stdin, exit code out) and an
  importable library, so pi and opencode wrap it in TypeScript and Claude
  Code, Codex CLI and Gemini CLI call it from a hook. The synthesis
  recommends it; the commitment is made at the e04 checkpoint when build
  epics are sliced. Per-call startup cost is unmeasured (R13 lists it).
- **"Undecided R7 items".** Read as R7's open questions. R10 turned four
  of them into experiment protocols; the rest are reading tasks. Nothing
  for the owner to decide here; the synthesis lists the remainder in Open
  questions.
- **Auto mode (owner request, same day).** A toggle that takes a story to
  an open pull request with a decider subagent: candidate build epic B9,
  an implication and a candidate hypothesis (SEED-SPEC goal 4, R7, R15, R11).
- **Estimate stays at 3 BCPs.** The agent expects the rollup of 17 briefs
  to run over it (e04s01 took 8 and e04s03 took 5); see Risks. A raise
  goes through change-request if the owner wants one.

## 1. Purpose

One output: `docs/research/SYNTHESIS.md`. It meets the e04 done_when and
the two phase goals in `specs/planning-context.yaml`:

- every hypothesis H1 to H27 has a verdict (confirmed, refined or
  refuted) with sources;
- the open question for this phase: the minimum useful first release
  (SEED-SPEC §9), answered with reasons;
- a list of candidate build epics, to be sliced with `slice-tasks` at
  the e04 checkpoint.

It also answers the other three SEED-SPEC §9 questions (engine as CLI or
library, where state lives when two hosts share a repo, how much of the
loop is advisory skills and how much enforced engine), because the first
release cannot be defined without them.

Reason for Depth: none. No code and no new abstraction. The table check
in task 2 is one inline stdlib snippet, not a tool.

## 2. Zoom-out

- **Purpose:** the synthesis turns the 17 briefs (R0 to R16) into one
  decision document. Without it the v1 spec has no agreed
  inputs and no build epic has a justification.
- **Callers:** the e04 checkpoint (slices the candidate build epics with
  `slice-tasks`, reviews the standing gate-trace waiver, commits the
  stack); the v1 spec (replaces `docs/SEED-SPEC.md`, which is then
  archived to `docs/archive/`); e05 (repository and environment setup,
  whose shape the stack choice affects).
- **Contracts:** the five `brief_rules` H2 headings (Sources, Verdicts,
  Implications for weftwork, Earns its place vs ceremony, Open
  questions); dated sources; a sourced verdict per hypothesis; no claim
  stated as a decision without a cited source (CONVENTIONS.md
  §Evidence).
- **Verdict matrix read on 2026-11-11** from the `## Verdicts` sections:
  all 27 hypotheses have at least one verdict, 18 have two or more
  briefs (H9, H12 and H21 to H27 have one), and every verdict is
  `refined`. No brief confirmed or refuted
  one. Only R16 measured anything (listing cost and `.agents/skills`);
  R10 is a design with nothing measured. A synthesis that restates
  "refined" 27 times says nothing, so each row states what the
  refinement changes and what kind of evidence stands behind it.
- **Inputs passed forward by earlier briefs** (read for the plan; the
  rest are read in task 5):
  - R5: make the engine a command-line program that reads JSON on stdin
    and answers with an exit code; hosts in two families (out-of-process
    command hooks, in-process TypeScript).
  - R13: the evidence gate as the first enforced rule; keep workflow
    state in plain files written only by the engine; owner-authored,
    one-shot, logged escape hatch.
  - R15: terminal states (done, blocked, stalled, exhausted, killed); an
    error or exhausted budget never counts as done; the engine counts
    ceilings.
  - R10: a measurement harness as a plan; start with the cheap
    measurements; do not promise small effects.
  - R16: portable file format, not portable location; catalog size
    matters for selection more than for listing tokens.
- **Sources (proposed):** the 17 briefs in `docs/research/`,
  `specs/planning-context.yaml` and `docs/SEED-SPEC.md`. No web page or
  paper is fetched. Paper claims are the briefs' claims and carry their
  evidence label; a reader reaches the paper one hop away.
- No module changes, so `assess-impact` is skipped. No external package
  is added, so slopcheck has nothing to tag.

## 3. Requirements

This story rewrites the three tasks in `e04s02-tasks.yaml` as seven. It
is planning output, not behaviour, so requirements are ADDED except one
MODIFIED.

#### MODIFIED: e04s02 task list
**Before:** three tasks (verdict table, minimum useful first release,
candidate build epics), tasks_total 3. **After:** seven tasks, tasks_total
7: Sources and Method; the verdict table; evidence and conflicts; the
first-release answer; implications and inputs for the v1 spec; candidate
build epics; the closing sections and whole-file check. Rationale: each
section needs its own scoped check, as for e04s01 and e04s03. The
original three checks are kept: the H1 to H27 grep, the phrase
"minimum useful first release" and the "candidate build epics" heading.

#### ADDED: Synthesis brief
`docs/research/SYNTHESIS.md` has the nine headings in section 5, in
order, each non-empty, and every cited `[S<n>]` is listed in Sources.

#### ADDED: Sources and Method
Seventeen dated sources, one per brief R0 to R16 (access date and the
date the brief reached `main`), and a Method that states the access date,
that nothing new was read or run, how the verdict table was built, that no
file outside the repository was read, and the use of subagents.

#### ADDED: Verdicts
One table row per hypothesis H1 to H27, with the briefs that gave a
verdict, a synthesis verdict, what the briefs add and the kind of
evidence. Task 2 checks the briefs cell against the briefs' own
`## Verdicts` sections.

#### ADDED: Evidence and conflicts
What was measured, what is design only, and where briefs disagree or
leave a gap, each bullet citing a source or saying it is unsourced.

#### ADDED: Minimum useful first release
The answer to the phase question, plus the other three SEED-SPEC §9
questions, each citing briefs. States the recommended stack and the
deferred owner decisions.

#### ADDED: Implications for weftwork
Inputs for the v1 spec, each citing the brief that justifies it,
including the owner decisions recorded above.

#### ADDED: Candidate build epics
Epics that would build the first release, each tied to the briefs that
justify it and to its dependencies, left to `slice-tasks` at the e04
checkpoint.

## 4. Acceptance criteria (Gherkin)

These IDs are local to this story. No e04 test plan exists.

```gherkin
Scenario: AC-e04s02-01 sources and method are complete
  Given the Sources and Method sections
  Then Sources has 17 dated lines naming R0 to R16
  And Method names the access date, no new reading, how the table was
    built, no outside file and the subagent use

Scenario: AC-e04s02-02 every hypothesis has a checked row
  Given the Verdicts table
  Then H1 to H27 each have one row with no empty cell
  And each briefs cell lists exactly the briefs whose own Verdicts
    section has a line for that hypothesis
  And each verdict is confirmed, refined or refuted, and equals the
    briefs' word when they all agree

Scenario: AC-e04s02-03 evidence and conflicts are stated
  Given the Evidence and conflicts section
  Then every bullet cites a source or says it is unsourced
  And it says what was measured and what was not

Scenario: AC-e04s02-04 the first release is answered
  Given the Minimum useful first release section
  Then it contains the phrase minimum useful first release
  And it answers engine form, shared state, skills against engine and
    parallelism, each citing briefs
  And it names TypeScript and the deferred owner decisions

Scenario: AC-e04s02-05 implications are traceable
  Given the Implications for weftwork section
  Then every bullet cites a source or says it is unsourced
  And it records the budget setting, the task source and the stack

Scenario: AC-e04s02-06 build epics are justified
  Given the Candidate build epics section
  Then it lists at least four epics, each with a source and a dependency
  And it says they are sliced at the e04 checkpoint

Scenario: AC-e04s02-07 the whole file is well formed
  Given the finished brief
  Then the headings are exactly the nine in order
  And every section is non-empty and every cited source is listed
```

## 5. Brief content

Headings, in order: `## Sources`, `## Method`, `## Verdicts`,
`## Evidence and conflicts`, `## Minimum useful first release`,
`## Implications for weftwork`, `## Candidate build epics`,
`## Earns its place vs ceremony`, `## Open questions`.

The Verdicts table header is
`| H | Claim | Briefs | Verdict | What the briefs add | Evidence |`.
Evidence is one or more of: measured, literature, docs, design-only,
none.

## 6. Steps

Decision reference: every step follows the owner's 2026-11-11 decisions
(task source and spend cap deferred, stack recommended, estimate kept),
recorded in the `state.yaml` handoff and in the plan commit `432a538`.

1. Draft Sources and Method → verify: task 1 in `e04s02-tasks.yaml`
2. Build the Verdicts table → verify: task 2
3. Write Evidence and conflicts → verify: task 3
4. Write the Minimum useful first release → verify: task 4
5. Write Implications for weftwork → verify: task 5
6. Write Candidate build epics → verify: task 6
7. Write Earns its place, Open questions and run the whole-file check →
   verify: task 7

No ADR covers this story.

The task verify commands check structure, citations, the table against
the briefs and keywords. A well-formed document with a wrong summary, a
wrong epic list or a stretched refinement passes them. The human
spot-check below and review decide those.

## 7. Out of scope

- Any new reading, search, run or measurement. A gap goes in Open
  questions.
- Re-deciding a brief's verdict. The synthesis restates and weighs; it
  does not overrule a brief without citing the evidence.
- Choosing the stack as a commitment, naming a task repository, or
  setting a spend cap (owner decisions above).
- Slicing the candidate build epics into stories (the e04 checkpoint).
- Writing the v1 spec or archiving `docs/SEED-SPEC.md`.
- Changing this repository's gates, hooks or loop.

## 8. Risks

- **The estimate is low.** Seven tasks over 17 briefs against 3 BCPs.
  Mitigation: build the table from the briefs' Verdicts lines, not from
  re-reading every brief; if the story overruns, raise it with the owner
  by change-request rather than thin the evidence.
- **"Refined" 27 times is empty.** Mitigation: the table's "what the
  briefs add" and "evidence" columns, and the Evidence and conflicts
  section, carry the content; task 2 fails an empty cell.
- **Stretching a brief.** A rollup invites claims stronger than the
  source (the lesson of the R7 to R16 reviews). Mitigation: cite the
  brief for every claim, mark design-only and unsourced items, and
  recheck any number against its brief before it carries a verdict.
- **Papers are one hop away.** The synthesis cites briefs, not papers.
  Mitigation: the Evidence column says literature, docs or measured, and
  each brief names its papers.
- **Stale briefs.** R10 and R16 postdate the earlier ones and may
  supersede a line. Mitigation: read the later brief's verdict first and
  note a conflict in Evidence and conflicts.
- **Overreach on the stack and the budget setting.** Mitigation: both
  are labelled recommendations or candidate requirements with the owner
  decision stated.
- **Single-commit story.** Mitigation: commit in steps, each with the
  `Story: e04s02` trailer.
- **Subagents.** At most 2 at once (CONVENTIONS.md).

## Verification Script (human)

1. Open the Verdicts table. Pick three rows and confirm each cited brief
   has that verdict line, and that "what the briefs add" says what the
   refinement changes.
2. Pick the two rows marked measured and check them against R16.
3. Read Minimum useful first release. Confirm each answer cites a brief
   and that nothing is stated as decided that the owner has not decided.
4. Read Candidate build epics. Confirm each epic names the briefs that
   justify it and that e05 is referred to, not duplicated.
5. Read Method. Confirm it says nothing new was read and no outside file
   was read.
6. Read Open questions. Confirm the deferred task source, spend cap and
   per-call hook cost are listed.
