# e03s08 — R15 run termination for autonomous loops

**type:** research (brief)
**risk:** P2
**context:** infra
**bcps:** 5
**epic:** e03 (Design topics, wave 3)
**research story:** R15, hypotheses H1, H15

Risk note: the epic's P2, as e03s01 to e03s07 used. No code ships and
nothing here can lose data or leak anything.

Owner decisions on 2026-11-10 ("do what you recommend" to the three
questions below):

- **Hypotheses.** R15 was assigned H15 only (budget ceilings stop the
  run), which covers one of the five stop conditions in the R15
  question. This plan adds R15 to H1's `tested_by` (done means a
  declared command the harness watched exit 0, which is completion
  detection). It adds no hypothesis, so the range stays H1 to H27.
  Circuit breakers and rate limits get a section and open questions,
  not a verdict. If the evidence shows a loop-termination claim the
  brief cannot place under H1 or H15, it goes in Open questions as a
  candidate hypothesis for e04s02.
- **Scope.** R15 reviews evidence only, as R9, R11, R12 and R13 did. It
  runs no loop and no Stop-hook trial. Each check the brief needs
  becomes a candidate story for R10 (e04s01).
- **Estimate.** Stays at 5 BCPs: two hypotheses and eight tasks, the
  load e03s06 had at 5. If the estimate breaks, raise it with the
  owner rather than thin the evidence.

## 1. Purpose

One output: `docs/research/R15-run-termination.md`. It answers the R15
question in `specs/planning-context.yaml`: stop conditions for
autonomous loops (completion detection, dual exit checks, circuit
breakers, rate limits and budget ceilings), with peer-reviewed or arXiv
studies where they exist, and it opens the two unverified leads from R0.
It gives sourced verdicts for:

- **H1** Evidence over claims: done = declared command the harness
  watched exit 0 after the last edit; self-reports do not count. (R4
  and R7 refined it. R15 adds the loop view: what ends a run.)
- **H15** Tiers not model names; escalate after N failures; budget
  ceilings stop the run; escalations logged. (R9 refined it: ceilings
  are partial, the failure count is unsourced above one. R15 adds the
  stop-condition evidence.)

For both, the brief reads the earlier verdicts first and says what the
R15 evidence adds. It does not redo R4, R7 or R9.

Reason for Depth: none. No code, no new abstraction.

## 2. Zoom-out

- **Purpose:** R15 is the last design topic of wave 3. It decides which
  stop conditions weftwork's loop enforces, which it leaves to the
  model, and which host controls it can rely on.
- **Callers:** e04s02 (synthesis) reads the verdicts and the Stop
  conditions compared table for the minimum useful first release. R10
  (e04s01) takes the candidate measurements.
- **Contracts:** the five `brief_rules` H2 headings, dated sources, a
  sourced verdict per hypothesis, papers cited wherever literature
  exists (CONVENTIONS.md §Evidence).
- **Inputs passed forward by earlier briefs:**
  - R0: ralph combines a dual exit check (completion indicators and an
    explicit exit signal), a circuit breaker and an hourly rate limit
    with no outcome data [R0 S6]. One search found no peer-reviewed
    study; two arXiv ids, 2604.08224 and 2607.00038, were not opened
    and are unverified leads. R15 opens both.
  - R4 and R7: the H1 verdicts (a declared command is only as good as
    its scope; a review does not replace the command gate).
    R7 also says to cap review rounds and hand over to a human at the
    cap, as bigpowers does at 5 (feeds R15) [R7 S25].
  - R9: the H15 verdict. Claude Code has a dollar cap and a turn cap in
    print mode, opencode a step cap, Codex an experimental rollout
    token budget; the overshoot is noted for the Claude Code cap [R9
    S45][S51][S69]. R9 leaves stop conditions that are not about cost
    to R15 and cites nothing for them.
  - R12: compaction can loop or fail. Claude Code stops auto-compacting
    after a few attempts when one file or tool output refills the
    window; pi allows one compact-and-retry recovery. R15 also needs the
    context ceiling as a stop condition [R12 S22][S23].
  - R13: Bounded Loops (arXiv:2609.27871, full text read in R13) gives
    a budget ceiling enforced inside an attempt and a gate verdict
    before done as the two enforced stop conditions, with the caveat
    that its 47 vacuity defects are in the authors' own 69-loop
    catalogue [R13 S11]. The Code as Agent Harness survey
    (arXiv:2605.18747) says termination should be governed by
    verification, not model confidence. In Claude Code a Stop hook exit
    2 sends the agent back to work and onFailure has no effect on Stop
    hooks, so a Stop gate that cannot start does not stop a loop.
- **Sources (proposed):** papers through the https arXiv API, ACM or
  Semantic Scholar, broad queries in relevance order, `sleep 5` between
  arXiv calls; host docs through raw URLs or web fetch, not `gh api` or
  `api.github.com` (the R6 and R9 waivers). Candidate topics: stopping
  and termination of LLM agent loops, agent loop budgets and cost
  control, stagnation and repeated-action detection, completion
  verification, human handover after N attempts, and host docs for
  Claude Code, Codex, pi and opencode stop controls.
- No module changes, so `assess-impact` is skipped. No external package
  is added, so slopcheck has nothing to tag.

## 3. Requirements

This story replaces the three placeholder tasks in `e03s08-tasks.yaml`
with eight. It is planning output, not behaviour, so all requirements
are ADDED, except two MODIFIED.

#### MODIFIED: H1 testers
**Before:** H1 `tested_by: [R4, R7, R10]`. **After:**
`tested_by: [R4, R7, R10, R15]`. Rationale: owner decision, 2026-11-10;
completion detection is what ends a loop and needs a verdict, not only
a section. The edit to `specs/planning-context.yaml` is part of this
plan.

#### MODIFIED: e03s08 task list
**Before:** three placeholder tasks (draft the brief, search for stop
condition studies and the two leads, add verdicts), tasks_total 3.
**After:** eight tasks, one per brief section, tasks_total 8.
Rationale: each section needs its own scoped check, as for e03s07. The
placeholder checks are kept: the leads and the words circuit breaker and
budget now sit in tasks 1, 2, 4 and 5.

#### ADDED: R15 brief
`docs/research/R15-run-termination.md` passes
`bash tools/check-brief.sh <brief> R15`, so it has the required
headings and a sourced verdict for H1 and H15.

#### ADDED: Papers and the two leads
`## Sources` lists at least six papers (an arXiv or DOI link each),
including arXiv:2604.08224, arXiv:2607.00038 and arXiv:2609.27871.

#### ADDED: Method
Under `## Method`: the access date, the version, release or commit read
for each tool, whether any page came through a summarizing subagent,
that both leads were opened, that no workflow or measurement was run,
and the arXiv queries used.

#### ADDED: Completion detection
Bullets on how a loop decides it is done: the model's claim, a verified
gate, ralph's dual exit check. Cites R0, R4, R7 and R13. Each bullet
cites a source or says it is unsourced. Input to H1.

#### ADDED: Budget, rate and context ceilings
Bullets on what stops a run by cost, count, time or window size. Cites
R9, R12 and R13. Each bullet cites a source or says it is unsourced.
Input to H15.

#### ADDED: Circuit breakers and no-progress detection
Bullets on what stops a loop that runs but makes no progress, ralph's
breaker, and any study of it, or the queries that found none. Cites R0.
Each bullet cites a source or says it is unsourced. Input to H15.

#### ADDED: Host stop controls
Bullets on what Claude Code, Codex, pi and opencode give a loop to stop
it, with the version or commit read. Cites R5, R9 and R13. Each bullet
cites a source or says it is unsourced.

#### ADDED: Stop conditions compared
One Markdown table. Header: `| Condition | Enforced by | What it stops |
Failure mode | Evidence |`. At least seven rows: Model done claim,
Verified completion gate, Dual exit check, Budget ceiling, Context
ceiling, Rate limit, Circuit breaker. No empty cell. Every row cites
`[S<n>]` or says `unsourced`. "Enforced by" names a mechanism (model,
harness, engine, CI, human), not a host product.

## 4. Acceptance criteria (Gherkin)

These IDs are local to this story. No e03 test plan exists.

```gherkin
Scenario: AC-e03s08-01 sources are dated and include papers and leads
  Given the R15 brief with a Sources section
  When check-brief.sh runs with --sources
  Then it exits 0
  And Sources lists at least six arXiv or DOI links
  And Sources lists arXiv:2604.08224, 2607.00038 and 2609.27871

Scenario: AC-e03s08-02 method records what was read and searched
  Given the Method section
  Then it names an access date, a version or commit, the subagent use,
    that both leads were opened, that no workflow or measurement was
    run, and the arXiv queries

Scenario: AC-e03s08-03 completion detection covers the dual exit check
  Given the Completion detection section
  Then every bullet cites a source or says it is unsourced
  And it covers completion, dual exit and exit signal, and cites R0,
    R4, R7 and R13

Scenario: AC-e03s08-04 ceilings cite the earlier briefs
  Given the Budget, rate and context ceilings section
  Then every bullet cites a source or says it is unsourced
  And it covers budget, rate limit, context and ceiling, and cites R9,
    R12 and R13

Scenario: AC-e03s08-05 circuit breakers are covered or searched for
  Given the Circuit breakers and no-progress detection section
  Then every bullet cites a source or says it is unsourced
  And it covers circuit breaker and no-progress, and cites R0

Scenario: AC-e03s08-06 host stop controls cover four hosts
  Given the Host stop controls section
  Then every bullet cites a source or says it is unsourced
  And it covers the Stop hook, Claude Code, Codex, pi and opencode, and
    cites R5, R9 and R13

Scenario: AC-e03s08-07 the stop-condition table is complete and sourced
  Given the Stop conditions compared table
  Then its header has the five columns
  And it has rows for the seven named conditions, no empty cell, each
    cited or marked unsourced

Scenario: AC-e03s08-08 hypotheses have sourced verdicts
  When check-brief.sh runs on the R15 brief with R-id R15
  Then it exits 0
  And every section is non-empty, every cited [S<n>] is listed and the
    headings are in order
```

## 5. Brief content

Headings, in order: `## Sources`, `## Method`,
`## Completion detection`, `## Budget, rate and context ceilings`,
`## Circuit breakers and no-progress detection`,
`## Host stop controls`, `## Stop conditions compared`, `## Verdicts`,
`## Implications for weftwork`, `## Earns its place vs ceremony`,
`## Open questions`.

## 6. Steps

Decision reference: every step follows the owner's 2026-11-10
decisions (R15 added to H1; evidence only; 5 BCPs), recorded in the
plan commit fb7b442 and in the `state.yaml` handoff note.

1. Draft the brief with dated sources, six or more papers including the
   two leads and Bounded Loops → verify: task 1 in `e03s08-tasks.yaml`
2. Write Method → verify: task 2
3. Write Completion detection → verify: task 3
4. Write Budget, rate and context ceilings → verify: task 4
5. Write Circuit breakers and no-progress detection → verify: task 5
6. Write Host stop controls → verify: task 6
7. Write Stop conditions compared → verify: task 7
8. Write Verdicts, Implications, Earns its place, Open questions →
   verify: task 8 (`bash tools/check-brief.sh
   docs/research/R15-run-termination.md R15` plus section, citation and
   heading-order checks)

No ADR covers this story.

The eight verify commands were run against a fixture brief during
plan-work: all eight pass on a well-formed brief; ten single-fault
copies (a lead id removed from Method, a table row removed, the Stop
hook bullet removed, a citation removed, the H15 verdict removed, the
second lead removed from Sources, the Open questions heading removed,
a table cell emptied, R0 removed from the circuit-breaker bullet, the
rate-limit bullet removed) each fail exactly the one task that owns the
fault; all eight fail with no brief.

The task verify commands check structure, citations and keywords only.
A well-formed brief with a wrong cell or a wrong verdict passes them.
Tasks 3 to 7 accept "unsourced" in place of a citation, so they cannot
tell a weak search from a thorough one. The human spot-check in the
Verification Script and review decide whether a cell, a search or a
verdict is good enough.

## 7. Out of scope

- Any measurement (owner decision, 2026-11-10): loop trials, Stop-hook
  trials, budget-cap overshoot tests, token counts. Each is a candidate
  story for R10.
- Review design and escalation (R7), model routing and cost (R9),
  context and memory (R12), enforcement design (R13). Cite them; do not
  redo them.
- Re-surveying per-host settings (R5).
- Choosing weftwork's engine, loop design or stack (e04s02).
- Changing this repository's own gates, hooks or loop.

## 8. Risks

- **Two hypotheses cover five stop conditions.** Mitigation: H1 and H15
  get verdicts; circuit breakers and rate limits get sections and open
  questions; a claim that fits neither goes to Open questions as a
  candidate hypothesis.
- **Literature is thin or on chat agents.** R0's one search found no
  peer-reviewed study. Mitigation: open both leads; run broad arXiv
  queries over https before any absence claim; record them in Method;
  say "none found" rather than stretch an adjacent paper.
- **Vendor claims.** Stop-control behaviour comes from host docs.
  Mitigation: record the version or commit read; label behaviour claims
  as documented, not tested.
- **A README is not evidence.** Ralph's design has no outcome data [R0
  S6]. Mitigation: report it as a design, not a result.
- **Numbers stretched past sources and abstracts read in place of full
  text** (the R7 to R13 review lessons). Mitigation: search the full
  text of a source with several plain keywords before writing "not
  found" or "unsourced"; never cut grep output before reading it; read
  the full text of every paper whose number carries a verdict; run plain
  arXiv queries as well as narrow ones; recheck counts after each review
  round.
- **Single-commit story.** Mitigation: commit in steps, each with the
  `Story: e03s08` trailer.
- **Subagents.** At most 2 at once (CONVENTIONS.md).

## Verification Script (human)

1. `bash tools/check-brief.sh docs/research/R15-run-termination.md
   R15` — exit 0.
2. Open Stop conditions compared. Pick two rows and confirm the cited
   source supports the cell, or that "unsourced" is honest.
3. Read Method. Confirm it says what each of the two leads turned out to
   be, and that the queries are listed.
4. Read Host stop controls. Confirm each host line names the version or
   commit read, and that the Stop hook bullet matches R13.
5. Read the two verdicts and confirm each cites a source, follows from
   the sections above it, and says what changed from the earlier
   verdict.
