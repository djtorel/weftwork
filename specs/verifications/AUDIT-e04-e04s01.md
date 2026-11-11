# Audit: e04s01 (R10 evaluation design)

Target: the story's change set, `main...HEAD` on `e04s01-evaluation-design`
(commits 9b9cfd3 and 3b032c2), plus the uncommitted working tree
(`specs/state.yaml`, `specs/verifications/e04s01-verify.yaml`, this file,
and two fixes made during this audit). No argument was given, so the
target is the story's changes. Mode: default (full checklist).

Scope of the change: docs and specs only. No product code, no dependency
manifests, no executable files. The one script is a python block inside
the brief, run by task 6.

## Results

### Supply Chain & Security
- ✓ slopcheck: N/A. No dependencies added or changed. The python block
  imports `math` and `functools` only.
- ✓ No `[SLOP]` packages.
- ✓ No secrets in the change set (pattern scan for `sk-`, `ghp_`, `AKIA`,
  `api.github.com`: the one match is spec prose that forbids it).
- ✓ OWASP spot-check: N/A. No code that touches user data, auth or an
  external API.
- ✓ Security: pattern scan only; no unaddressed findings. `security-review`
  was not run (P2). The e01 to e03 waivers cover those epics only, so e04
  has no threat-model waiver. Raised for the owner in the verify-work
  report; the executable surface is `check-brief.sh` and the verify
  strings, as before.

### Provenance & Metadata
- ✓ Plan artefacts carry `type:` and `context:` (spec: research, infra;
  tasks YAML: research, infra).
- ✓ FIXED. The spec's decision reference named no commit. It now names the
  plan commit `3b032c2` and the `state.yaml` waivers. No ADR covers this
  story (stated in the spec).

### Law of Demeter
- ✓ N/A. No code.

### CONVENTIONS.md Compliance
- ✓ Outputs are in `specs/` and `docs/research/`; nothing at project root.
- ✓ No `gh issue create` in the change set.
- ✗ DEVIATION, process only. This session ran `gh run list --branch main
  --limit 3` once, read-only, to check CI on the merge commit b4382d6
  (all three runs succeeded). That is a GitHub API call through `gh` that
  is not a pull request or clone operation. Nothing in the diff depends
  on it and it cannot be undone. Going forward: read CI through the pull
  request, or ask. The owner accepted the deviation on 2026-11-10 ("do
  what you recommend"); the waiver is recorded in `specs/state.yaml`.
- ✓ No direct GitHub REST calls (no curl to `api.github.com`). Papers came
  from the web search tool and from `arxiv.org` pages; the arXiv API
  call was rejected with HTTP 429 and none of its output was used.

### Scope
- ✓ Changes are limited to the story: brief, spec, tasks file, status
  counts, verification evidence and state. The `state.yaml` top-level
  fix (active story, branch) was asked for in the same session.
- ✓ No speculative features. Task source and spend cap are left to the
  owner, not decided.
- ✓ No files outside the stated scope. `scripts/` was only read.
- ✓ Discovered defects: Preflight green, `check-briefs.sh` green, no gate
  failure to route to `quick-fix`.
- ✓ Boy Scout: no gate-failing file was opened.

### Boy Scout Rule
- ✓ Every touched file is no worse. No dead code, no commented-out blocks.
- ✓ FIXED. E10 in the brief described Ask-F1 as a score for asking and
  proceeding. The HiL-Bench abstract defines it as the harmonic mean of
  question precision and blocker recall. The brief now says so and cites
  S6. All nine verify commands and `check-brief.sh` pass after the edit.

### Types and Safety
- ✓ N/A. The python block has no type ignores; its functions have
  docstrings, and the two helpers are untyped, which this project has not
  required for a stdlib snippet in a brief.

### Test Coverage
- ✓ Every task has a runnable `verify:`; all nine pass (verify-work).
- ✓ The nine verify commands were checked against a fixture brief and
  16 single-fault copies at plan time: each fault failed only the task
  that owns it.
- ✓ Task 6 runs the python block and requires exit 0 and three output
  lines. The table was compared by hand with the output: 20: none and 39;
  40: 20 and 29; 80: 15 and 21; 160: 11 and 15. The commands check
  structure, not whether a figure or a verdict is right.
- ✓ F.I.R.S.T: the verify commands are fast (about a second), independent
  (read-only, one brief), repeatable and self-validating (exit code).

### SOLID and Heuristics
- ✓ N/A. No code design. Reason for Depth: none, stated in the spec.

### Refactoring Smells (Fowler)
- None detected. The verify commands repeat an awk section-extraction
  idiom across tasks; the earlier e03 tasks do the same, and a shared
  helper would be a new abstraction with no Reason for Depth.

### Code Style (CONVENTIONS.md)
- ✓ YAML: `---` start, lines of 80 columns or fewer (`yamllint specs`).
- ✓ Conventional Commits with a `Story: e04s01` trailer; no `Co-authored-by`
  and no AI attribution (checked on both commits).
- ✓ Sources dated: 35 with `accessed:` and `published:`; no undated source.
- ✓ Every assigned hypothesis has a sourced verdict (H1, H4, H7, H17,
  H19, H20), each `refined`.
- ✓ Length rules are for code. The spec is 364 lines, the tasks file 303,
  the brief 273; e03s08's spec was 319.

### Red Flags
- I nearly passed the Ask-F1 sentence because every verify command was
  green; the structural checks cannot see a wrong definition. I read the
  abstracts behind the claims I had not re-read (S1, S3, S6, S29, S4) and
  found the one error above.
- I did not re-read the abstracts of every cited paper in this audit.
  28 of the 35 sources were read at abstract level only, which the brief
  says in Sources and Open questions.
- The audit-code body suggests `request-review` next, the skill's Handoff
  line says `commit-message`. Earlier stories ran `request-review` here.
  I follow that and say so; I did not skip a gate silently.

## Verdict

PASS. One process deviation (the `gh run list` call) was accepted by the
owner on 2026-11-10 and recorded as a waiver. Two fixes were applied during
the audit. `request-review` then passed in round 4 (A 95.0, B 97.2); see
`specs/state.yaml` for the round history.
