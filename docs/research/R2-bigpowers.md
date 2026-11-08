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

## Verdicts

- H6: refined - bigpowers does both at once and in prose: 74 of 80 skills carry a "HARD GATE" line (150 mentions) [S1], but the only code that blocks a tool call is one git hook, `hooks/pre-tool-use.sh` [S1]; the gates the agent met in e02s02 were instructions it had to weigh against other rules, and one conflicted with the project's `CONVENTIONS.md` [S4]. So "workflow first, enforcement second" is better stated as "workflow with prose gates, plus a small hard block for git"; no source tests that this order beats the reverse, and [S7] finds that passing tests can overstate correctness, which argues for gates that run a check over gates that ask the agent to confirm.
- H7: refined - bigpowers has tiers (`quick-fix` for data-only changes, a `lite` test plan in `state.yaml`, recorded waivers) [S1][S4], but the owner or the agent picks the tier and nothing scores risk; the research story was routed through the code-shaped red/green gate anyway, which is ceremony not scaled to risk [S4]. No source tests risk-scaled ceremony; the one hint is [S7], that unscaled test checks can mislead.
- H10: refined - 80 skills, 6,887 lines, 19 in Verify and 18 in Sustain [S1] refute "small catalog" for this tool, and the package ships `search-skills` ("find the right skill from natural-language intent") and `using-bigpowers` ("which skill to call first") to cope with its own size [S1], which supports "one entry command per host"; it has at least four candidate entry points (`using-bigpowers`, `orchestrate-project`, `search-skills`, `survey-context`), not one. Whether the size costs accuracy is unmeasured here, though [S5] gives a reason to expect cost for long contexts and [S8] finds that extra context files raise cost without a general gain.

None is `confirmed`: no source tests bigpowers, or its design choices, as
a treatment. None is `refuted`: the tool's design is consistent with H6
and H7 in shape, and only the "small catalog" half of H10 is
contradicted, which is why that one is `refined` and not `confirmed`.

## Implications for weftwork

- Keep the one thing that works as a block: a hook that stops a tool
  call (git safety, protected branches) [S1]. It does not depend on the
  agent obeying prose. R13 should decide what else deserves that form.
- A gate written as prose is a request. This session showed a request
  and a repo rule disagreeing and the agent choosing [S4]. weftwork's
  rules should have one owner, with the gate text checked against the
  repo rules at install time. This is an inference from [S4], not a
  measured rate.
- Tier the work by what the change is. A research brief with a
  `verify:` command needs the command and the evidence, not a test-only
  commit [S4]. Tiers should come from a rule (for example, files
  touched and file kind), not from the owner's memory of a skill list.
- Do not ship a helper that rewrites the state file in a different
  style from the one the repository lints [S1][S4]. State writes need an
  atomic, format-preserving writer, or the state file should be written
  by one tool only. R12 and R13 should treat this as a requirement.
- Check documented commands against the real CLI. The `opensrc search`
  drift [S4] is a test weftwork can run in CI: extract fenced commands
  from skills and run `--help` on each binary.
- Run Preflight where the work happens. A worktree that lacks the
  project's scripts cannot run its own gate [S4]; weftwork's layout
  should not depend on a gitignored symlink.
- Keep one phase vocabulary and one count, generated from the files
  [S1]. Three vocabularies and a stale count show hand-kept summaries
  drift within a version.
- Copy the handoff idea (each step names the next step and writes it to
  one YAML file) [S1], and keep the cost visible: here it produced a
  dirty tree after two skills [S4].
- Do not copy the size or the release pace: 80 skills, and 13 releases
  in four days to v2.96.0 [S1][S2]. A host adapter pinned to this would
  go stale within a week.

## Earns its place vs ceremony

Verdict labels: earns its place, ceremony, unproven. A verdict rests on
the cited source only. Where a source is missing the label is
`unproven`, with the direction of any signal.

- Git safety hook (`pre-tool-use.sh`: dangerous commands, Conventional
  Commits, protected branches): unproven, positive signal. It is a hard
  block and does not rely on the agent reading prose [S1]. I did not
  see it fire, so I have no catch rate [S4].
- "HARD GATE" prose in 74 of 80 skills: unproven. No data on how often
  agents follow them; one observed conflict with a repo rule [S4].
- `survey-context` (read specs, name a phase, suggest a skill): unproven.
  It gave a correct next step in e02s02, but `state.yaml`'s own handoff
  note already said the same thing [S4], so the information gain was
  small and the cost included a dirty tree.
- `bp-timing.sh` and the `metrics.skill_timings` block: ceremony. The
  skill that starts the timer calls the result informational [S4], and
  the helper caused BUG-001 and a dirty tree twice [S1][S4].
- `kickoff-branch` (clean default branch, worktree, clean baseline):
  unproven. The branch and worktree worked and kept `main` clean [S4];
  the baseline step could not run here because the worktree lacks
  `scripts/` [S4].
- `develop-tdd` two-commit red/green policy on a doc-only story:
  ceremony, in this case. There is no test file, and I skipped the
  isolation check [S4]. For code it is unproven here: no code ran.
- Per-task `verify:` commands in `eNNsYY-tasks.yaml`: earns its place,
  on this project's evidence. Each task has a runnable check, three
  of them gave exit 2 before the brief and exit 0 after, a before and
  after result no prose gate in the session gave [S4]. This fits [S6]:
  a check that runs beats the author's own confirmation. One caveat: the task 2
  command (`grep` for two words) passed on the word "ceremony" already
  in the intro, so it is weaker than the task suggests [S4].
- Fresh-context reviewer (`request-review`, after `audit-code` self
  review): unproven, positive signal. [S6] finds that models struggle
  to correct themselves without external feedback, and a reviewer with a
  clean context is an outside check, though it is still a model [S1].
- Planning spine (`scope-work`, `slice-tasks`, `plan-work`) plus WSJF
  release index: unproven. It produced the structure this research
  program runs on, and the history shows 100 file touches under `specs/`
  against 4 under `docs/research/` in 16 commits [S4]; I have no
  comparison with a lighter plan.
- A/B and ablation tests (`tests/test_ab_*.py`): unproven. They test
  skill subsets against each other [S1], which is the right kind of
  evidence, but I did not run them or read results.
- "94 percent quality threshold" and the receipts page: unproven. The
  README states the figure [S1]; I did not read how it is computed.
- 80-skill catalog: ceremony for weftwork's purpose, by scope. Eighteen
  Sustain skills (VPS hardening, Allure reports, a wiki) are not needed
  to run coding agents on one repository [S1]. This is a scope
  judgment, not a measurement.
- Per-model routing: not present in what I read. [S9] shows routing cuts
  cost; R9 owns the question, and bigpowers gives no input to it here.

## Open questions

- Does v2.96.0 still look like v2.93.3? There are 12 newer releases [S2];
  a story could install the current release and recount skills, scripts
  and hooks. Candidate new story, parallel to the one R1 proposed for GSD.
- Is the `opensrc search` drift fixed upstream, and does any bigpowers
  check test documented commands? I did not read `audit-compliance.sh`,
  `validate-doctrine.sh` or `check-skill-links.py` [S1].
- How often do agents skip or bend a "HARD GATE"? One session is not a
  rate. R10 could count gate follow-through across logged runs; this
  repository has the e01 and e02 session records.
- What do the A/B ablation tests show about which skills change
  outcomes? The tests exist [S1]; I did not run them. R10 should.
- I read three skill bodies and part of a fourth out of 80. The other 76
  may carry more or less ceremony than this sample suggests.
- How do bigpowers and GSD [S10] differ in cost and outcome on the same
  task? Only a run of both can answer that; R10 could design it.
- I did not read the README sections on pi support and the MCP server, or
  the `bigpowers-showcase` repository that the README offers as a worked
  example [S1]. R5 owns host support.
