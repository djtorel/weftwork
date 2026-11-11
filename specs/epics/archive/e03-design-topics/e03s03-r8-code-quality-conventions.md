# e03s03 — R8 code quality and conventions

**type:** research (brief)
**risk:** P2
**context:** infra
**bcps:** 5
**epic:** e03 (Design topics, wave 3)
**research story:** R8, hypotheses H2, H3, H5

Risk note: the BCP heuristic (BCP 5) gives P0, the documentation
heuristic gives P3. This plan proposes the epic's P2, as e03s01 and
e03s02 did. Nothing here can lose data or leak anything, and no code
ships.
Scope decision: the owner chose on 2026-11-09 that R8 stays
stack-agnostic. It does not recommend weftwork's implementation stack.
The stack choice is an open question for the synthesis (e04s02). Two
places that said R8 picks the stack are corrected in task 1, in their
own commit.

## 1. Purpose

One output: `docs/research/R8-code-quality-conventions.md`. It answers
the R8 question in `specs/planning-context.yaml`: how agents find and
follow stack conventions, which design principles fit (SOLID,
functional core, and others), enforcement by tools (linters, AST
rules, architecture tests), and keeping docs current. It gives sourced
verdicts for H2 (stack facts, commands and gate verdicts come from
code, not the model), H3 (every command or version in `AGENTS.md`
resolves to the repository) and H5 (generated files are merge-safe:
managed blocks with hashes, and human edits are never overwritten).

Reason for Depth: none. No code, no new abstraction.

## 2. Zoom-out

- **Purpose:** R8 is the third design topic of wave 3. It tests
  SEED-SPEC principle 6 ("good code is checked, not hoped for") and the
  three carried-over principles in SEED-SPEC §4 that H2, H3 and H5
  restate.
- **Callers:** e04s02 (synthesis) reads it, and the stack choice that
  follows reads its enforcement table. R13 reads it for which tool
  checks become gates. R12 reads it for context files. e05 reads it
  when it adds the code-style sections to `CONVENTIONS.md`.
- **Contracts:** the five `brief_rules` H2 headings, dated sources, a
  sourced verdict per hypothesis, papers cited wherever literature
  exists (CONVENTIONS.md §Evidence).
- **Inputs passed forward by earlier briefs:**
  - R0 and R4: context files do not generally raise task success and
    raise cost by over 20%; instructions in them are followed;
    repository overviews do not help [R0 S13 = R4 S14, one source].
    R8 tests this. Reading stack facts by command instead of prose is
    an untested inference (R4, H2).
  - R0: quality degrades across long tasks (structural erosion,
    verbosity) [R0 S15, SlopCodeBench]. R8 gains a failure to guard
    against.
  - R1: GSD's codebase map documents (conventions, testing, and so
    on) are ceremony by analogy to [R1 S7].
  - R2: bigpowers writes `CONVENTIONS.md` and `AGENTS.md` with fenced
    managed regions; this repository's first-hand record.
  - R3: constitution or rules files are common (Spec Kit constitution,
    Kiro steering, Cline rules, Codex `AGENTS.md`).
  - R5: which hosts read which instruction file; no vendor documents
    managed blocks, so they are ceremony until proven.
  - R6: which static dependency tool would give a coupling check
    depends on R8 [R6 S17].
  - R7: whether a convention check in review catches defects that
    tests miss is unsourced.
- **Sources (proposed):** tool docs and repositories read through raw
  URLs or web fetch, not `gh api` or `api.github.com` (the e02s04 and
  e03s01 waivers); the R0 and R4 papers may be reused; new papers
  through arXiv, ACM or Semantic Scholar. Candidate topics: context
  files and convention following, maintainability and code smells in
  LLM-generated code, static-analysis or linter feedback in agent
  loops, code-comment and documentation inconsistency.
- No module changes, so `assess-impact` is skipped. No external
  package is added, so slopcheck has nothing to tag.

## 3. Requirements

#### MODIFIED: Owner of the stack choice
**Before:** `CONVENTIONS.md` line 4 and the e05 note in
`specs/release-plan.yaml` say R8 chooses the stack.
**After:** both say the stack choice is an open question for the
research synthesis (e04s02). R8 does not choose it.

The rest are ADDED.

#### ADDED: R8 brief
`docs/research/R8-code-quality-conventions.md` passes
`bash tools/check-brief.sh <brief> R8`, so it has the required headings
and a sourced verdict for H2, H3 and H5.

#### ADDED: Papers
`## Sources` lists at least four papers (an arXiv or DOI link each),
because context files, LLM code quality, linter feedback and doc
inconsistency have a literature.

#### ADDED: Method
Under `## Method`: the access date, the version, release or commit read
for each tool, whether any page came through a summarizing subagent,
that no workflow was run, and the arXiv queries used (the R7 lesson:
broad queries in relevance order before any "not found" claim).

#### ADDED: Finding conventions
Under `## Finding conventions`, bullets on how agents learn a project's
conventions: context files such as `AGENTS.md`, reading stack facts
from manifests, lockfiles and config files, and the conventions docs of
GSD, bigpowers, Spec Kit and Kiro. Each bullet cites a source or says
it is unsourced. Input to the H2 verdict.

#### ADDED: Principles
Under `## Principles`, bullets on which design principles fit agent-
written code: SOLID, functional core and imperative shell, and others
found. They cover quality erosion over long tasks and code smells in
generated code. Each bullet cites a source or says it is unsourced.

#### ADDED: Enforcement by tools
Under `## Enforcement by tools`, one Markdown table. Header:
`| Mechanism | Example tools | What it checks | Agent use | Evidence |`.
At least five rows: Formatter, Linter, Type checker, AST rules,
Architecture tests. No empty cell; write `none` or `not found` when
that is the finding. Every row cites at least one `[S<n>]`. The
Architecture tests row answers R6's coupling-check question for a
generic stack.

#### ADDED: Keeping docs current
Under `## Keeping docs current`, bullets on doc drift, on checking that
commands and versions in `AGENTS.md` resolve to the repository (H3),
and on managed blocks with hashes (H5). Each bullet cites a source or
says it is unsourced. Input to the H3 and H5 verdicts.

## 4. Acceptance criteria (Gherkin)

These IDs are local to this story. No e03 test plan exists.

```gherkin
Scenario: AC-e03s03-01 the stack choice moves to e04s02
  Given CONVENTIONS.md and specs/release-plan.yaml
  Then neither says R8 chooses the stack
  And CONVENTIONS.md names e04s02

Scenario: AC-e03s03-02 sources are dated and include papers
  Given the R8 brief with a Sources section
  When check-brief.sh runs with --sources
  Then it exits 0
  And Sources lists at least four arXiv or DOI links

Scenario: AC-e03s03-03 method records what was read and searched
  Given the Method section
  Then it names an access date, a version or commit, the subagent
    use, that no workflow was run, and the arXiv queries

Scenario: AC-e03s03-04 finding conventions covers files and stack facts
  Given the Finding conventions section
  Then every bullet cites a source or says it is unsourced
  And it covers context files and reading manifests or config

Scenario: AC-e03s03-05 principles cover SOLID, functional core, erosion
  Given the Principles section
  Then every bullet cites a source or says it is unsourced
  And it covers SOLID, functional core, and erosion or smells

Scenario: AC-e03s03-06 the enforcement table is complete and cited
  Given the Enforcement by tools table
  Then its header has the five columns
  And it has rows for Formatter, Linter, Type checker, AST rules and
    Architecture tests, each cited, with no empty cell

Scenario: AC-e03s03-07 keeping docs current covers H3 and H5
  Given the Keeping docs current section
  Then every bullet cites a source or says it is unsourced
  And it covers drift, commands that resolve, and managed blocks
    with hashes

Scenario: AC-e03s03-08 hypotheses have sourced verdicts
  When check-brief.sh runs on the R8 brief with R-id R8
  Then it exits 0
  And every section is non-empty, every cited [S<n>] is listed and
    the headings are in order
```

## 5. Brief content

Headings, in order: `## Sources`, `## Method`,
`## Finding conventions`, `## Principles`, `## Enforcement by tools`,
`## Keeping docs current`, `## Verdicts`,
`## Implications for weftwork`, `## Earns its place vs ceremony`,
`## Open questions`.

## 6. Steps

1. Correct the two stack-choice references, in a commit of their own
   → verify: task 1 in `e03s03-tasks.yaml`
2. Draft the brief with dated sources, four or more papers → verify:
   task 2
3. Write Method → verify: task 3
4. Write Finding conventions → verify: task 4
5. Write Principles → verify: task 5
6. Write Enforcement by tools → verify: task 6
7. Write Keeping docs current → verify: task 7
8. Write Verdicts, Implications, Earns its place, Open questions →
   verify: task 8 (`bash tools/check-brief.sh
   docs/research/R8-code-quality-conventions.md R8` plus section,
   citation and heading-order checks)

No ADR covers this story.

The task verify commands check structure, citations and keywords only.
A well-formed brief with a wrong cell or a wrong verdict passes them.
Tasks 4, 5 and 7 accept "unsourced" in place of a citation, so they
cannot tell a weak search from a thorough one. The human spot-check in
the Verification Script and review decide whether a cell, a search or
a verdict is good enough.

## 7. Out of scope

- Choosing weftwork's implementation stack (owner decision,
  2026-11-09). The brief lists it as an open question for e04s02.
- Writing the code-style and test sections of `CONVENTIONS.md`. That
  waits for the stack choice.
- Running linters, AST tools or architecture-test tools here, or an
  experiment on context files. A measured test is a candidate story
  for Open questions (R10 designs evaluations).
- Re-surveying host instruction files (R5), gate and hook design
  (R13), context and memory (R12) and review practice (R7). Cite them;
  do not redo them.
- URL link checking.

## 8. Risks

- **Little literature on principles.** SOLID and functional core may
  have practitioner sources only. Mitigation: record the queries in
  Method and write "unsourced" rather than stretch an adjacent paper.
- **Overlap with R13.** Tool enforcement and gate design meet.
  Mitigation: R8 says what each tool checks and what evidence exists;
  R13 decides which checks become gates.
- **Vendor docs describe features, not outcomes.** Mitigation: the
  table describes mechanisms from each tool's own docs; claims about
  outcomes need a paper or a measurement.
- **Fast-moving tools.** Mitigation: record version or commit and
  access date per tool.
- **Secondary summaries.** Mitigation: say in Method which pages came
  through a fetch subagent; spot-check two cells in UAT.
- **Subagents.** At most 2 at once (CONVENTIONS.md).

## Verification Script (human)

1. `bash tools/check-brief.sh docs/research/R8-code-quality-conventions.md R8`
   — exit 0.
2. Open the Enforcement by tools table. Pick two cells in different
   rows and confirm the cited source is that tool's own docs or a paper
   and supports the cell.
3. Read the Principles bullets. Confirm each either cites a source that
   covers it or says it is unsourced, and that Method records the
   queries.
4. Read the H2, H3 and H5 verdicts and confirm each cites a source and
   follows from the sections above it.
5. Read line 4 of `CONVENTIONS.md` and the e05 note in
   `specs/release-plan.yaml` and confirm they name e04s02, not R8.
