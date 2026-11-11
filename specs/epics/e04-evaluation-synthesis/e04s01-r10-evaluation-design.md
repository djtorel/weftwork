# e04s01 — R10 evaluation design

**type:** research (brief)
**risk:** P2
**context:** infra
**bcps:** 8
**epic:** e04 (Evaluation and synthesis, wave 4)
**research story:** R10, hypotheses H1, H4, H7, H17, H19, H20

Risk note: the epic's P2, as e03 used. No code ships and nothing here
can lose data or leak anything. R10 spends no model tokens on trials.

Owner decisions on 2026-11-10 (answers to three plan-work questions,
each the recommended option):

- **Scope: design only.** R10 is a brief. It defines the arms, task
  set, measures, sample-size limits and experiment protocols, and gives
  sourced verdicts from literature. It runs no agent trial and no pilot.
  Estimate stays at 8 BCPs. A pilot run is a candidate story for the
  first build epic.
- **Backlog: triage plus core protocol.** Earlier briefs (R0 to R2, R4, R6,
  R7, R8, R9, R11, R12, R13, R15) nominated about 50 candidate
  measurements for R10. The brief lists every one in a triage table
  (cost and a call each) and writes a full protocol only for the six
  assigned hypotheses and the four R7 experiments below.
- **Waiver: e04s02 and e04s03 specs.** plan-consistency-check reports
  CRITICAL and HIGH findings for the two stories that have no spec
  yet. They get their specs when each is planned. Recorded in
  `specs/state.yaml` waivers, scope e04.

Owner request, same day: fold in the R7 Open questions as R10 inputs.
These four become protocols, not verdicts:

- a different-family reviewer against a same-family reviewer, on seeded
  defects [R7 S37, S3];
- a fresh, briefed context against a continued context [R7];
- what one review round costs, per tool [R7 S8, S26];
- how a decider would be scored, with Ask-F1 [R7 S14].

R10 adds no hypothesis and edits no `tested_by`. H13 and H14 stay with
R4 and R7. When the four experiments run, their results feed the e04s02
synthesis. A claim that fits no assigned hypothesis goes in Open
questions as a candidate hypothesis for e04s02.

Routed away, not planned here: four unread R11 papers (arXiv:2609.39678,
2610.02456, 2603.10387, 2608.25817) and the passage-read R13 and R15
papers go to e04s03 (R16 evidence refresh). The stack choice stays with
e04s02.

## 1. Purpose

One output: `docs/research/R10-evaluation.md`. It answers the R10
question in `specs/planning-context.yaml`: how to compare a plain
agent, an agent with evidence gates, full ceremony, a fixed tier and a
routed tier on a small task set, with pass rate and cost per accepted
task as the measures. It gives sourced verdicts for:

- **H1** Evidence over claims: done = a declared command the harness
  watched exit 0 after the last edit. (R4, R7 and R15 refined it. R10
  adds how to measure it.)
- **H4** Gates earn their keep: logged escape hatch, overridden gates
  retired, no hard gate without an observed failure. (R13 and R14.)
- **H7** Ceremony proportional to risk. (R13 found no source that
  compares risk-scaled with fixed ceremony.)
- **H17** Routing simple tasks to cheaper models keeps pass rate while
  cutting cost per accepted task. (R9.)
- **H19** Start cheap and escalate on failure is cheaper overall than
  picking the tier up front. (R9.)
- **H20** Deterministic task-sizing signals are reliable enough to
  route on. (R9.)

For each, the brief reads the earlier verdict first and says what the
R10 evidence adds. Without a trial, a verdict says what the literature
supports and what the designed experiment would decide. It does not
redo R4, R7, R9, R13 or R15.

Reason for Depth: none. No code, no new abstraction. The one script in
the brief, the sample-size calculation, is a stdlib snippet shown in the
brief and run by task 6; it is not a tool.

## 2. Zoom-out

- **Purpose:** R10 is the design that turns the research program's
  unmeasured claims into experiments. It decides which comparisons are
  affordable on a small task set and which are not.
- **Callers:** e04s02 (synthesis) reads the verdicts, the protocols and
  the triage table to set the minimum useful first release and the first
  build epics. The first build epic, if it includes a pilot, reads the
  arms and the sample-size section.
- **Contracts:** the five `brief_rules` H2 headings, dated sources, a
  sourced verdict per hypothesis, papers cited wherever literature
  exists (CONVENTIONS.md §Evidence).
- **Inputs passed forward by earlier briefs:**
  - R4: SWE-bench consists of 2,294 real issues [S17]; 7.8 percent of
    patches counted correct fail a stronger oracle [S18]. Candidate:
    resolution against a stronger oracle.
  - R6: two agents on a small repository, disjoint then overlapping
    scopes, counting conflicts.
  - R7: the four experiments above, and mutation testing in a review
    round, and a reviewer that runs a focused command.
  - R8: erosion and verbosity over long tasks [S7], with and without
    `AGENTS.md` conventions, and conventions compiled into executable
    checks [S30].
  - R9: tier and effort on a fixed task set (H17, H18), start low and
    escalate (H19), and the cache cost of an escalation.
  - R11: sandbox, capability check, skill-scan false positives and an
    approval gate on and off.
  - R12: a context warning hook, rule survival across compaction, state
    file size and a files-against-database comparison (H8).
  - R13: risk-scaled against fixed ceremony (H7), hook failure on five
    hosts, verify commands against held-out failing cases (H2), hatch
    overrides over a longer window (H4), engine cost per call (H16, H27).
  - R15: a done gate against seeded false successes (H1), a stale pass
    after a later edit (H1), no-progress thresholds 2, 3 and 5 (H15),
    what each host's cap leaves on disk, the Claude Code Stop-hook
    override and a budget tracker.
- **Sources (proposed):** papers through the https arXiv API, ACM or
  Semantic Scholar, broad queries in relevance order, `sleep 5` between
  arXiv calls; no `gh api` or `api.github.com` (the R6 and R9 waivers).
  Candidate topics: benchmarks and oracles for coding agents, cost and
  Pareto reporting, variance across runs and statistical tests for small
  task sets, contamination, scaffold and ceremony ablations, long-horizon
  drift, cross-model review, and routing evaluations.
- **Boundary:** a task set drawn from `../pi-flow-legacy` or any other
  path outside this repository needs the owner to name that path again;
  the R14 exception does not carry over (CONVENTIONS.md §Boundaries).
- No module changes, so `assess-impact` is skipped. No external package
  is added, so slopcheck has nothing to tag.

## 3. Requirements

This story replaces the three placeholder tasks in `e04s01-tasks.yaml`
with nine. It is planning output, not behaviour, so all requirements are
ADDED, except one MODIFIED.

#### MODIFIED: e04s01 task list
**Before:** three placeholder tasks (draft the brief, define arms and
measures, add verdicts), tasks_total 3. **After:** nine tasks, one per
brief section group, tasks_total 9. Rationale: each section needs its
own scoped check, as for e03s07. The placeholder checks are kept: the
words plain, gates, ceremony, routed, cost per accepted, oracle and
drift now sit in tasks 4 and 5.

#### ADDED: R10 brief
`docs/research/R10-evaluation.md` passes
`bash tools/check-brief.sh <brief> R10`, so it has the required headings
and a sourced verdict for H1, H4, H7, H17, H19 and H20.

#### ADDED: Papers
`## Sources` lists at least ten papers (an arXiv or DOI link each),
including the papers earlier briefs flagged for R10: arXiv:2310.06770,
2503.15223, 2607.21656, 2610.34491, 2603.24755 and 2604.09408.

#### ADDED: Method
Under `## Method`: the access date, that R10 is design only and ran no
agent trial, that the sample-size table came from a stdlib calculation
shown in the brief, whether any page came through a summarizing
subagent, that no file outside the repository was read, and the arXiv
queries used.

#### ADDED: Evaluation methods in the literature
Bullets on how coding-agent work is measured: benchmarks and oracles,
variance across runs, cost reporting, contamination, ablations of
scaffolds and ceremony, and long-horizon drift. Cites R4, R7, R8 and R9.
Each bullet cites a source or says it is unsourced.

#### ADDED: Arms and Task set
Two sections. Arms: plain, evidence gates, full ceremony, fixed tier and
routed, each with what it changes and what is held fixed. Task set:
where tasks come from, selection criteria, a seeded-defect subset, a
held-out failing case per task and at least one long task for drift.
Each bullet cites a source or says it is unsourced.

#### ADDED: Measures and oracles
Pass rate by declared command, cost per accepted task with "accepted"
defined, a stronger oracle, quality drift and verbosity, token and cache
accounting, and escalation counts. Cites R4, R8 and R9. Each bullet
cites a source or says it is unsourced.

#### ADDED: Sample size and variance
A table of detectable pass-rate differences for at least three task-set
sizes, with power, alpha, the paired test and how runs per task are
chosen. It includes the stdlib `python` snippet that produced the table;
task 6 runs the snippet and it must exit 0.

#### ADDED: Experiment protocols
One bullet per experiment, `- E<n> (<key>):`, for H1, H4, H7, H17, H19,
H20 and the four R7 experiments. Each names arms, measure, decision rule
(a threshold fixed before any run) and cost, and cites a source or says
unsourced.

#### ADDED: Candidate measurements triage
One Markdown table. Header: `| ID | Source | Hypothesis | Measurement |
Cost | Call |`. At least 25 rows. Source names the brief (all of R4, R6,
R7, R8, R9, R11, R12, R13 and R15 appear). Cost is S, M or L. Call is
run first, run later, build epic or drop. No empty cell. At least one
row is run first and at least one is run later or drop.

## 4. Acceptance criteria (Gherkin)

These IDs are local to this story. No e04 test plan exists.

```gherkin
Scenario: AC-e04s01-01 sources are dated and include the flagged papers
  Given the R10 brief with a Sources section
  When check-brief.sh runs with --sources
  Then it exits 0
  And Sources lists at least ten arXiv or DOI links
  And Sources lists arXiv:2310.06770, 2503.15223, 2607.21656,
    2610.34491, 2603.24755 and 2604.09408

Scenario: AC-e04s01-02 method states design only and what was read
  Given the Method section
  Then it names an access date, design only, the subagent use, that no
    file outside the repository was read, the stdlib calculation and the
    arXiv queries

Scenario: AC-e04s01-03 literature section covers how agents are measured
  Given the Evaluation methods in the literature section
  Then every bullet cites a source or says it is unsourced
  And it covers oracle, variance, cost, contamination, ablation and
    drift, and cites R4, R7, R8 and R9

Scenario: AC-e04s01-04 arms and task set are fully described
  Given the Arms and Task set sections
  Then every bullet cites a source or says it is unsourced
  And Arms covers plain, gates, full ceremony, fixed tier, routed and
    what is held fixed
  And Task set covers seeded, held-out, long, repository and the
    owner's naming of any outside path

Scenario: AC-e04s01-05 measures define accepted and a stronger oracle
  Given the Measures and oracles section
  Then every bullet cites a source or says it is unsourced
  And it covers pass rate, cost per accepted task, accepted, oracle,
    drift, verbosity, token and cache, and cites R4, R8 and R9

Scenario: AC-e04s01-06 sample-size table is backed by a running script
  Given the Sample size and variance section
  Then it has a table with at least three data rows
  And it names power, alpha, paired and a bootstrap or confidence
    interval
  And its python code block exits 0 and prints at least three lines

Scenario: AC-e04s01-07 every assigned hypothesis and R7 item has a protocol
  Given the Experiment protocols section
  Then it has an E bullet for H1, H4, H7, H17, H19 and H20
  And E bullets for different-family, fresh context, round cost and
    Ask-F1
  And every bullet names arms, measure, decision rule and cost

Scenario: AC-e04s01-08 the triage table is complete
  Given the Candidate measurements triage table
  Then its header has the six columns
  And it has at least 25 rows, no empty cell, a Cost of S, M or L and a
    valid Call
  And R4, R6, R7, R8, R9, R11, R12, R13 and R15 each appear in Source

Scenario: AC-e04s01-09 hypotheses have sourced verdicts
  When check-brief.sh runs on the R10 brief with R-id R10
  Then it exits 0
  And every section is non-empty, every cited [S<n>] is listed and the
    headings are in order
```

## 5. Brief content

Headings, in order: `## Sources`, `## Method`,
`## Evaluation methods in the literature`, `## Arms`, `## Task set`,
`## Measures and oracles`, `## Sample size and variance`,
`## Experiment protocols`, `## Candidate measurements triage`,
`## Verdicts`, `## Implications for weftwork`,
`## Earns its place vs ceremony`, `## Open questions`.

## 6. Steps

Decision reference: every step follows the owner's 2026-11-10
decisions (design only; triage plus core protocol; e04s02 and e04s03
spec waiver), recorded in the `state.yaml` waivers and in the plan
commit `3b032c2`.

1. Draft the brief with dated sources, ten or more papers including the
   six flagged ones → verify: task 1 in `e04s01-tasks.yaml`
2. Write Method → verify: task 2
3. Write Evaluation methods in the literature → verify: task 3
4. Write Arms and Task set → verify: task 4
5. Write Measures and oracles → verify: task 5
6. Write Sample size and variance, with the running script → verify:
   task 6
7. Write Experiment protocols → verify: task 7
8. Write Candidate measurements triage → verify: task 8
9. Write Verdicts, Implications, Earns its place, Open questions →
   verify: task 9 (`bash tools/check-brief.sh
   docs/research/R10-evaluation.md R10` plus section, citation and
   heading-order checks)

No ADR covers this story.

The task verify commands check structure, citations, keywords and that
the one script runs. A well-formed brief with a wrong cell, a wrong
verdict or a wrong power figure passes them. Tasks 3 to 5 and 7 accept
"unsourced" in place of a citation, so they cannot tell a weak search
from a thorough one. The human spot-check in the Verification Script and
review decide whether a cell, a search, a number or a verdict is good
enough.

## 7. Out of scope

- Any agent trial or pilot (owner decision, 2026-11-10). Each becomes a
  candidate story in the triage table.
- Review design and escalation (R7), model routing and cost (R9),
  context and memory (R12), enforcement design (R13), run termination
  (R15). Cite them; do not redo them.
- Choosing weftwork's engine, stack or first release (e04s02).
- Reading the four unread R11 papers and the passage-read R13 and R15
  papers (e04s03).
- Reading `../pi-flow-legacy` or any outside path without the owner
  naming it again.
- Changing this repository's own gates, hooks or loop.

## 8. Risks

- **Too many candidates for 8 BCPs.** About 50 measurements and ten
  protocols. Mitigation: the triage table carries every candidate at one
  line each; only ten get a protocol. If the estimate breaks, raise it
  with the owner rather than thin the evidence.
- **A small task set cannot show small effects.** Mitigation: the
  sample-size section states the detectable difference per task-set size
  before any arm is promised; a protocol whose decision rule is below
  that limit is marked underpowered.
- **No task source.** weftwork has no product code. Mitigation: the Task
  set section lists sources and costs; an outside path needs the owner's
  naming; the choice itself is left to the first build epic or e04s02.
- **Verdicts without trials.** Mitigation: label each verdict as
  literature-supported, not measured, and say what the protocol would
  decide.
- **Literature is thin or on chat agents.** Mitigation: run broad arXiv
  queries over https before any absence claim; record them in Method;
  say "none found" rather than stretch an adjacent paper.
- **Numbers stretched past sources and abstracts read in place of full
  text** (the R7 to R15 review lessons). Mitigation: search the full
  text of a source with several plain keywords before writing "not
  found" or "unsourced"; never cut grep output before reading it; read
  the full text of every paper whose number carries a verdict; recheck
  counts after each review round.
- **Single-commit story.** Mitigation: commit in steps, each with the
  `Story: e04s01` trailer.
- **Subagents.** At most 2 at once (CONVENTIONS.md).

## Verification Script (human)

1. `bash tools/check-brief.sh docs/research/R10-evaluation.md R10` —
   exit 0.
2. Open Candidate measurements triage. Pick three rows and confirm the
   cited brief's Open questions holds that measurement, and that no
   candidate named in R6, R7, R8, R9, R11, R12, R13 or R15 is missing.
3. Open Sample size and variance. Run the python block and confirm the
   table matches its output.
4. Read Experiment protocols. Pick two and confirm the decision rule is
   fixed before any run and is above the detectable difference.
5. Read Method. Confirm it says design only, lists the queries and says
   no outside path was read.
6. Read the six verdicts and confirm each cites a source, follows from
   the sections above and says what changed from the earlier verdict.
