# R2 — bigpowers in depth

Research story R2, wave 2. Hypotheses H6, H7 and H10.
Question: what bigpowers does, which parts earn their place, which are
ceremony. Same questions as R1 [S10].

Method: read the installed package at the path in [S1] read-only (file
counts and line counts by `find`, `wc` and `grep`; the README top, the
skill index, the git hook head, the test file heads), read upstream
metadata with `gh api` [S2][S3], and record what happened when this
repository used the skills in its own sessions [S4]. I ran no bigpowers
script for measurement, and I did not read most skill bodies end to
end. I read the three that ran in the sessions that produced this story
(`survey-context`, `kickoff-branch`, `develop-tdd`; the harness loaded
their text when they ran, and `survey-context` called `bp-timing.sh`)
and the `opensrc` part of `research-first`. Every statement about what a
skill does comes from that reading; none comes from a controlled run.
The package lives outside this repository (`scripts/` here is a
gitignored symlink into it), so [S1] is machine-local evidence; a reader
without it must use upstream [S2].

## Sources

- [S1] bigpowers local install, `/home/domtorr/.local/share/mise/installs/node/26.7.0/lib/node_modules/bigpowers` (`package.json` reads version 2.93.3; 2,103 files outside `node_modules`; 80 skill directories; `SKILL-INDEX.md`, `README.md`, `hooks/pre-tool-use.sh`, `scripts/`, `tests/`, `constitution.md`). "Published" is the v2.93.3 release date [S3] - accessed: 2026-11-08 published: 2026-11-04
- [S2] danielvm-git/bigpowers, upstream repository metadata via `gh api repos/danielvm-git/bigpowers` (MIT; created 2026-04-24; last push 2026-11-08; 288 stars) and the release list (newest listed: v2.96.0, 2026-11-08), https://github.com/danielvm-git/bigpowers - accessed: 2026-11-08 published: 2026-11-08
- [S3] danielvm-git/bigpowers release v2.93.3, `gh api repos/danielvm-git/bigpowers/releases/tags/v2.93.3` - accessed: 2026-11-08 published: 2026-11-04
- [S4] weftwork first-hand record: `specs/bugs/BUG-001-state-yaml-lint-red.md`, `specs/state.yaml`, `specs/execution-status.yaml`, `git log` (16 commits at HEAD `8a7b1b1`), `npx opensrc --help` and `npx opensrc search lodash` (opensrc 0.7.3), and the survey-context, kickoff-branch and develop-tdd sessions for e02s02 - accessed: 2026-11-08 published: 2026-11-08
- [S5] Liu et al., "Lost in the Middle: How Language Models Use Long Contexts", TACL 2024, arXiv:2307.03172, https://arxiv.org/abs/2307.03172 (as cited in R1 [S4]; verdict rests on the abstract, not re-read here) - accessed: 2026-11-08 published: 2023-07-06
- [S6] Huang et al., "Large Language Models Cannot Self-Correct Reasoning Yet", ICLR 2024, arXiv:2310.01798, https://arxiv.org/abs/2310.01798 (as read in R4 [S8]) - accessed: 2026-11-08 published: 2023-10-03
- [S7] Wang, Pradel and Liu, "Are 'Solved Issues' in SWE-bench Really Solved Correctly? An Empirical Study", ICSE 2026, arXiv:2503.15223, https://arxiv.org/abs/2503.15223 (as read in R4 [S18]) - accessed: 2026-11-08 published: 2025-03-19
- [S8] Gloaguen et al., "Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?", arXiv:2602.11988, https://arxiv.org/abs/2602.11988 (latest version, v3, as read in R4 [S14]) - accessed: 2026-11-08 published: 2026-02-12
- [S9] Ong et al., "RouteLLM: Learning to Route LLMs with Preference Data", arXiv:2406.18665, https://arxiv.org/abs/2406.18665 (as read in R4 [S15]) - accessed: 2026-11-08 published: 2024-06-26
- [S10] weftwork R1 brief, `docs/research/R1-gsd.md` (the GSD counterpart; same questions and format) - accessed: 2026-11-08 published: 2026-11-08
- [S11] weftwork R4 brief, `docs/research/R4-research-literature.md` (source of the paper verdicts reused here) - accessed: 2026-11-08 published: 2026-11-08

## What bigpowers is

Measured from [S1], by file count, line count and `grep`:

| Part | Count | Size |
| ---- | ----- | ---- |
| skills (`skills/*/SKILL.md`) | 80 | 6,887 lines; min 15, median 84, max 150 |
| scripts (`scripts/`, all depths) | 261 files | not counted |
| tests (`tests/`) | 31 files | not counted |
| hooks (`hooks/`) | 2 entries | `pre-tool-use.sh`, 192 lines |
| profiles, kernel, templates, docs | 4, 3, 1, 5 files | not counted |

The 80 skills split by lifecycle phase as the generated skill index
lists them [S1]: Discover 8, Design 7, Plan 9, Build 17, Verify 19,
Release 2, Sustain 18. The README sells it as "a 6-phase lifecycle with
hard gates, a 94% quality threshold, and a YAML cockpit
(`specs/state.yaml`)" for solo developers [S1]. Of the 80 skills, 74
contain the words "HARD GATE" (150 mentions in all). The single piece of
code that blocks a tool call is `hooks/pre-tool-use.sh`; its head says it
blocks dangerous git commands, checks Conventional Commits and blocks
commits and pushes to `main` and `master` [S1]. I read the first 25
lines of it, not the rest.

The flow, from the three skills that ran here and the README [S1][S4]:

1. Discover: `survey-context` reads `specs/` and `CONVENTIONS.md`,
   names a phase and a next skill, and writes timing metrics to
   `state.yaml`.
2. Scope and plan: `scope-work`, `slice-tasks` and `plan-work` produce
   `SCOPE_LATEST.yaml`, epic capsules and `eNNsYY-tasks.yaml` with a
   `verify:` command per task. `plan-release` writes `release-plan.yaml`
   with WSJF order.
3. Build: `kickoff-branch` makes a worktree and a branch and runs a
   clean baseline; `develop-tdd` runs red, green, refactor with two
   commits per behaviour; `build-epic` and `execute-plan` batch this.
4. Verify and release: `verify-work`, `audit-code`, `request-review`,
   `gate-trace` and `security-review`, then `release-branch` opens the
   PR and cleans up.

State lives in YAML (`state.yaml`, `execution-status.yaml`,
`release-plan.yaml`), and each skill ends with a handoff that names the
next skill. The package is a moving target: it was created on
2026-04-24, and 13 releases are listed from 2026-11-04, the date of the
installed v2.93.3, up to v2.96.0 on 2026-11-08, so 12 are newer than the
copy [S2][S3]. Any statement here about what bigpowers does today may be
stale.

## First-hand findings

What happened when this repository used bigpowers, from [S4] and [S1].
These are single observations in one small project, not rates.

- **Documented command that does not exist (tooling drift).**
  `skills/research-first/SKILL.md` tells the agent to run
  `npx opensrc search <pkg>` (lines 19 and 29), and the same string
  appears in `scripts/bp-opensrc-check.sh`, whose other use I did not
  read [S1]. The installed `opensrc` 0.7.3 lists `fetch`, `path`,
  `list`, `remove` and `clean`; running `opensrc search lodash` printed
  `error: unrecognized subcommand 'search'` and suggested `fetch` [S4].
  The scope record had already noted this before I reproduced it. The
  package's `compliance` script runs `audit-compliance.sh`,
  `validate-doctrine.sh` and `check-skill-links.py` [S1]; I did not
  read them, so I cannot say whether any could catch a stale command.
- **A count that disagrees with itself.** `package.json` says "73 agent
  skills"; the directory, the generated index and the README badge say
  80 [S1].
- **The timing helper dirties the tree and breaks lint.**
  `scripts/bp-timing.sh` rewrites `state.yaml` with `yaml.dump` (lines
  40 and 68), which drops the `---` start and the comments and does not
  indent sequences or wrap lines [S1]; this is BUG-001 [S4]. The owner
  chose a local workaround (a `.yamllint` that skips two rules for that
  one file) and not an upstream report. The workaround stops the lint
  failure but not the dirty tree: `survey-context` left `state.yaml`
  modified (16 lines added, 19 removed, mostly re-wrapped text), and
  `develop-tdd` modified it again [S4]. `survey-context` itself calls the
  `story_start` marker "informational progress marker only", so the
  helper's output is ceremony that caused a defect.
- **Rules from three layers disagree.** `kickoff-branch` offers to
  commit a dirty `specs/` tree on `main` as `chore(state): checkpoint
  before kickoff`; this repository's `CONVENTIONS.md` and `AGENTS.md`
  say never commit to `main` [S4]. The agent had to pick. I put the
  commit on the new branch and told the owner [S4].
- **The kickoff worktree cannot run the project's Preflight.**
  `scripts/` is a gitignored symlink, so a new worktree has none:
  `bash scripts/validate-specs-yaml.sh` there fails with "No such file"
  (exit 127). I ran the primary checkout's copy by absolute path. The
  skill's step 4 says to run Preflight in the worktree [S4].
- **Three phase vocabularies.** `survey-context` names a 6-phase loop
  (Discover, Elaborate, Plan, Build, Verify, Release) and then maps the
  project onto a table of ten labels (Discover, Design, Plan, Initiate,
  Execute, Verify, Bug, Review, Integrate, Sustain); the generated index
  uses seven (Discover, Design, Plan, Build, Verify, Release, Sustain)
  [S1][S4].
- **Code-shaped gates on a research story.** `develop-tdd` requires two
  commits per behaviour, a test-only commit that fails, then the fix,
  checked by `verify-tdd-red-commit.sh` [S1]. For this story the tests
  are the `verify:` commands already in `e02s02-tasks.yaml`, so there is
  no test file to commit. I ran the three commands to show red (all
  exit 2, no brief) and did not run the isolation script or make a red
  commit. That is a skipped gate; I judged it inapplicable and I am
  recording it here, not hiding it. It is also ceremony in the plain
  sense: a step whose cost is paid and whose purpose is absent [S4].
- **Overhead visible in the history.** Across 16 commits, 100 file
  touches are under `specs/` and 4 under `docs/research/` (counted from
  `git log --name-only`). This project is in a planning phase, so a high
  `specs/` share is expected; the figure shows where the effort went and
  does not show waste [S4].
- **Timestamps that cannot be work time.** `execution-status.yaml` gives
  e02s01 a start of 13:31:19 and an end of 13:33:24, 2 minutes 5 seconds
  for a 198-line brief; e01s03 shows 2 hours 34 minutes [S4]. I infer
  the fields mark the wrap-up of a story and not its work; I did not
  check how they are written.
