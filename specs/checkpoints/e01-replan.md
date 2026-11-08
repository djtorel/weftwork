# e01 re-plan checkpoint

**type:** checkpoint
**context:** infra
**epic:** e01
**story:** e01s03 (task 4)

Recorded 2026-11-08 after the R14, R0 and R4 briefs passed
`tools/check-brief.sh`. Inputs: `docs/research/R14-legacy-retrospective.md`,
`docs/research/R0-discovery-sweep.md` (six candidate stories) and
`docs/research/R4-research-literature.md`. R14 produced no change to
later epics.

Owner approval: 2026-11-08, given in session, for the recommendations
below as written. This file does not change `release-plan.yaml`. The
changes go in through `change-request`, which also rescores BCPs and
WSJF.

Decision: change

The change is small: one new story, four R0 candidates folded into
existing stories (R5, R9, R11, R12), one candidate deferred to e05, and
R4/R0-derived work added to R7 (one task), R9 (one task, plus the
candidate 6 topic) and R10 (two measures). R5 and R12 each gain a
question; R11 gains a topic.

Candidate numbers follow the order of R0's "Candidate new stories":

1. Skill and plugin supply-chain trust
2. Per-host generation of instruction and skill files
3. Agents in CI through GitHub Actions
4. Run-termination design for autonomous loops
5. Where state lives: git-backed tracker or plain spec files
6. Tool-definition context cost and code-based tool access

## e02

- **R5 (e02s04, harness capability matrix): fold in candidate 2.** Add
  a question: how does each host get its instruction and skill files
  (generated, committed or managed blocks)? The matrix already has one
  row per host, so this is one more column. Evidence so far is README
  claims, not studies (R0 [S8], [S9]). R4 [S1] adds that interface
  design affects agent performance, so host adapters may matter too (an
  inference). Size: rescore.
- R1, R2, R3: no change.

## e03

- **New story (candidate 4): run-termination design for autonomous
  loops.** Size: to be scored by change-request. No story owns stop
  conditions, and H15 names budget ceilings without a study. The
  evidence is the weakest of the six: R0 found no peer-reviewed study,
  and two arXiv ids cited by blog posts (2604.08224, 2607.00038) are
  unverified leads. The story must search properly and may find
  nothing. If a smaller plan is wanted, fold it into R13 instead.
- **R11 (e03s05): fold in candidate 1.** Add skill and plugin
  supply-chain trust: installed skills, scanning before install.
  Strongest evidence of the six (R0 [S11], [S12]). Size: rescore.
- **R12 (e03s06): fold in candidate 5.** Compare a git-backed tracker
  with plain spec files against H8 (no bespoke schema; R5 tests H8, so
  read R5's verdict first). Size: rescore.
- **R9 (e03s04): fold in candidate 6, and add one task from R4.**
  Candidate 6 is tool-definition context cost and code-based tool
  access. Its only source is a vendor engineering post (R0 [S10]), so
  label every claim unproven until R9 measures it. Task from R4: test
  model routing and reasoning effort on coding tasks, because the R4
  papers cover chat and reasoning benchmarks (R4 [S15], [S19]).
- **R7 (e03s02): add one task from R4.** Search for sources on
  mutation testing in review (H14) and on reversibility classes for
  auto-answers (H13). R4 found none; the brief must find one or say the
  claim is unsourced.
- R6, R8, R13: no scope change. R8 already tests R0's finding on
  context files; R4 [S14] is the same paper as R0 [S13], so that is one
  source, not two. R4's H2 implication feeds R13 and needs no new task; its H13
  implication (test a different model as reviewer) is already inside
  R7's scope and needs no task.
- e03 total BCPs and WSJF need rescoring.

## e04

- **R10 (e04s01): add two measures from the literature.** Patch
  correctness checked against a stronger oracle than the project's own
  tests (R4 [S18]), and quality drift over long tasks (R0 [S15]).
  Size: rescore.
- Research synthesis: no change.

## Deferred to e05

- Candidate 3, agents in CI through GitHub Actions: record as an e05
  input. No candidate workflow exists until e04 ends, and e05 is sliced
  after e04. No research now.
