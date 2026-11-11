# e04s03 — R16 evidence refresh

**type:** research (brief)
**risk:** P2
**context:** infra
**bcps:** 5
**epic:** e04 (Evaluation and synthesis, wave 4)
**research story:** R16, hypotheses H8, H10

Risk note: the epic's P2, as e04s01 used. No code ships. Tasks 3 and 4
run two hosts on scratch skills and spend a few model calls; nothing
here can lose data or leak anything.

Owner decisions on 2026-11-11 (answers to two plan-work questions, each
the recommended option):

- **Scope: R16 as planned.** R16 closes the three measurement gaps in
  its question and adds no reading. The R10 brief routed four unread
  R11 papers (arXiv:2609.39678, 2610.02456, 2603.10387, 2608.25817) and
  the R13 and R15 papers read only in passages to e04s03. None of them
  bear on H8 or H10. Open questions lists them, and names the R11, R13
  and R15 verdicts that rest on abstracts or passages, so the e04s02
  synthesis can weigh those verdicts. Estimate stays at 5 BCPs.
- **Scratch directory: the session scratchpad.** The runtime tests run
  in a throwaway directory under the session scratchpad
  (`/tmp/claude-1000/...`), outside this repository, with the host
  configuration isolated so the owner's `~/.claude` skills do not enter
  the count. The directory is deleted after the runs. This is the
  owner's naming of an outside path (CONVENTIONS.md §Boundaries); it
  covers this story only.

## 1. Purpose

One output: `docs/research/R16-evidence-refresh.md`. It answers the R16
question in `specs/planning-context.yaml`: the always-loaded skill
listing in tokens for pi and Claude Code, whether Claude Code reads
`.agents/skills` at runtime, and a re-check of BMAD v7. It gives sourced
verdicts for:

- **H8** Portable artifacts (AGENTS.md, SKILL.md, plain YAML and
  Markdown); no bespoke schema. (R5 and R12.)
- **H10** Small skill catalog, one entry command per host. (R1, R2 and
  R3.)

For each, the brief reads the earlier verdict first and says what the
R16 measurement adds. A number that is an estimate is labelled as one.

Reason for Depth: none. No code, no new abstraction. The scratch skills
are throwaway files in the scratchpad, not tools.

## 2. Zoom-out

- **Purpose:** R16 replaces docs-only evidence with measurements before
  the synthesis picks a catalog size and an artifact layout.
- **Callers:** e04s02 (synthesis) reads the H8 and H10 verdicts and the
  Open questions list of routed reading.
- **Contracts:** the five `brief_rules` H2 headings, dated sources, a
  sourced verdict per hypothesis, papers cited wherever literature
  exists (CONVENTIONS.md §Evidence).
- **Inputs passed forward by earlier briefs:**
  - R5: skill listing cost unmeasured; `.agents/skills` in Claude Code
    has docs evidence only (no mention found).
  - R3: BMAD v7 expected mid-November 2026; the R3 table row for BMAD.
  - R9: tool and skill listing tokens with and without tool search are
    left to R16 (R10 triage row C19).
  - R12: plain files against a database-backed tracker (H8) has no
    source; R10 row C28 drops it.
- **Host flags read on 2026-11-11 (`--help`):** pi 1.5.0 has
  `--no-skills` ("Disable skills discovery and loading") and
  `--skill <path>` ("Load a skill file or directory"), which give a
  with and without comparison. Claude Code 2.1.321 has `--bare`
  ("Minimal mode ... Skills still resolve via /skill-name") and
  `--disable-slash-commands` ("Disable all skills and commands"). The
  counting method itself is chosen in develop-tdd from the host docs and
  stated in Method.
- **Sources (proposed):** host docs and changelogs for pi and Claude
  Code at the installed versions; BMAD release pages and repository
  files by raw URL, Atom feed, `git ls-remote` or web fetch (no `gh api`
  and no `api.github.com`, per the R6 and R9 waivers); papers through
  the https arXiv API on skill and tool listing cost and context
  overhead, `sleep 5` between calls.
- No module changes, so `assess-impact` is skipped. No external package
  is added, so slopcheck has nothing to tag. BMAD is read, not
  installed.

## 3. Requirements

This story rewrites the five tasks in `e04s03-tasks.yaml` as six. It is
planning output, not behaviour, so requirements are ADDED except one
MODIFIED.

#### MODIFIED: e04s03 task list
**Before:** five tasks (sources, skill listing cost, `.agents/skills`
test, BMAD re-check, verdicts), tasks_total 5, heading order without
`## Method`. **After:** six tasks, tasks_total 6: a new task 2 writes
`## Method` after `## Sources`; the old tasks 2 to 5 become 3 to 6; the
final task's heading-order check includes `## Method` and its Open
questions check names the routed papers. Rationale: the runtime tests
need a recorded method (scratch path, isolation, versions), and the
owner's scope decision needs a check.

#### ADDED: Method
Under `## Method`: the access date, the scratchpad path and that the
owner named it, how each host's configuration was isolated, the host
versions, that the scratch directory was deleted, whether any page came
through a summarizing subagent, and that no other file outside the
repository was read.

#### ADDED: Skill listing cost
For a fixed set of scratch skills, the listing size in tokens or
characters in pi and in Claude Code, the counting method, and each host
version. An estimate is not presented as a measurement.

#### ADDED: Claude Code and .agents/skills
A run of Claude Code on a scratch skill under `.agents/skills`, with the
version and a line `Result: read` or `Result: not read`.

#### ADDED: BMAD v7 re-check
Release status of BMAD v7 on the access date, install and entry
commands, and whether the R3 table row still holds.

#### ADDED: Verdicts and routed reading
Sourced verdicts for H8 and H10, implications, earns its place vs
ceremony, and Open questions that list arXiv:2609.39678, 2610.02456,
2603.10387 and 2608.25817 and the R13 and R15 passage-read papers.

## 4. Acceptance criteria (Gherkin)

These IDs are local to this story. No e04 test plan exists.

```gherkin
Scenario: AC-e04s03-01 sources are dated
  When check-brief.sh runs on the R16 brief with --sources
  Then it exits 0

Scenario: AC-e04s03-02 method records the scratch run
  Given the Method section
  Then it names an access date, the scratchpad, the isolation, that the
    scratch directory was deleted, the subagent use and that no other
    file outside the repository was read

Scenario: AC-e04s03-03 skill listing is measured in both hosts
  Given the Skill listing cost section
  Then it names a pi version and a Claude Code version
  And it gives a size in tokens or characters and names the method

Scenario: AC-e04s03-04 .agents/skills has a runtime result
  Given the Claude Code and .agents/skills section
  Then it has a line "Result: read" or "Result: not read"
  And it names the Claude Code version

Scenario: AC-e04s03-05 BMAD v7 is re-checked on a date
  Given the BMAD v7 re-check section
  Then it has a date, names v7 and gives a release status

Scenario: AC-e04s03-06 verdicts and routed reading
  When check-brief.sh runs on the R16 brief with R-id R16
  Then it exits 0
  And every section is non-empty, every cited [S<n>] is listed and the
    headings are in order
  And Open questions names the four R11 papers, R13 and R15
```

## 5. Brief content

Headings, in order: `## Sources`, `## Method`, `## Skill listing cost`,
`## Claude Code and .agents/skills`, `## BMAD v7 re-check`,
`## Verdicts`, `## Implications for weftwork`,
`## Earns its place vs ceremony`, `## Open questions`.

## 6. Steps

Decision reference: every step follows the owner's 2026-11-11 decisions
(R16 as planned; scratchpad for the runtime tests), recorded in the
`state.yaml` handoff and in the plan commit `ef2047a`.

1. Draft the brief with dated sources → verify: task 1 in
   `e04s03-tasks.yaml`
2. Write Method → verify: task 2
3. Measure the skill listing in pi and Claude Code → verify: task 3
4. Run the `.agents/skills` test → verify: task 4
5. Re-check BMAD v7 → verify: task 5
6. Write Verdicts, Implications, Earns its place, Open questions →
   verify: task 6 (`bash tools/check-brief.sh
   docs/research/R16-evidence-refresh.md R16` plus section, citation,
   heading-order and routed-reading checks)

No ADR covers this story.

The task verify commands check structure, citations and keywords. A
well-formed brief with a wrong count or a wrong verdict passes them.
The human spot-check below and review decide whether a number or a
verdict is good enough.

## 7. Out of scope

- Reading the four R11 papers or re-reading the R13 and R15 papers
  (owner decision, 2026-11-11). They are listed in Open questions only.
- Installing or running BMAD.
- Tool search, `codemode` or MCP listing cost beyond what the skill
  listing run shows (R10 row C19 is a drop).
- Files against a database tracker (R10 row C28 is a drop).
- Choosing weftwork's catalog, stack or first release (e04s02).
- Any outside path other than the session scratchpad.

## 8. Risks

- **The owner's skills leak into the count.** `~/.claude/skills` holds
  the bigpowers catalog. Mitigation: isolate configuration (pi
  `--no-skills` with `--skill <path>`; for Claude Code a separate
  configuration directory or flags read from its docs) and state the
  method; if isolation fails, say so and report the difference with and
  without the scratch skills instead.
- **No direct token count.** A host may not expose the listing size.
  Mitigation: measure characters of the listing as captured (debug log
  or request), name the tokenizer if one converts it, and label any
  token figure derived from characters as an estimate.
- **Claude Code version drift.** R5 read 2.1.319; 2.1.321 is installed.
  Mitigation: record the version on every result.
- **BMAD v7 not out yet.** Mitigation: report the status found on the
  access date; "not released" is a valid result.
- **Model calls cost money.** Mitigation: a handful of `--print` runs
  with short prompts; no loop.
- **Single-commit story.** Mitigation: commit in steps, each with the
  `Story: e04s03` trailer.
- **Subagents.** At most 2 at once (CONVENTIONS.md).

## Verification Script (human)

1. `bash tools/check-brief.sh docs/research/R16-evidence-refresh.md R16`
   — exit 0.
2. Read Method. Confirm the scratchpad path, the isolation and that the
   directory was deleted.
3. Read Skill listing cost. Confirm each number names its method and
   host version, and estimates are labelled.
4. Read Claude Code and .agents/skills. Confirm the result line follows
   from the run described.
5. Read BMAD v7 re-check against the cited release page.
6. Read the H8 and H10 verdicts and confirm each cites a source and says
   what changed from the earlier verdict.
