# Security review for branch e05s03-typescript-conventions (e05s03, TypeScript code-style and test conventions)

review_date: 2026-11-11
branch: e05s03-typescript-conventions
head: fb9235b (no commit on the branch yet)
base: main
scope: uncommitted working tree against main (fb9235b): AGENTS.md,
  CONVENTIONS.md, specs/state.yaml, specs/epics/e05-repo-and-environment/
  e05s03-tasks.yaml, and the new files
  specs/epics/e05-repo-and-environment/e05s03-typescript-conventions.md,
  specs/verifications/e05s03-verify.yaml, specs/verifications/AUDIT-e05-e05s03.md,
  specs/AUDIT_LATEST.md
supersedes: the e04s02 review that previously stood here (branch
  e04s02-research-synthesis, head 178e258). That review does not cover this
  branch.

method: manual review of every added and changed line in the scope above, plus
  a pattern scan of the scope for eval, curl, wget, gh api, api.github.com,
  URLs, secret patterns (sk- with eight or more characters, ghp_, AKIA,
  private-key headers, password, token, secret), and destructive commands.
  Confirmed that no code, CI or script path changed (tools/, scripts/, src/,
  .github/, package.json, tsconfig.json): an empty diff for all of them.
  Findings are scored on the rubric in REFERENCE-confidence-rubric.md, and
  anything below 8 is suppressed.

## Findings (confidence 8 or higher)

None. No finding reached the reporting threshold.

## Notes (below the threshold, recorded for the owner)

- **Eval of the Preflight line.** The verify command in task 4 of
  e05s03-tasks.yaml runs `eval "$(...)"` on the Preflight line that
  `scripts/bp-read-agents.sh` prints from AGENTS.md. Anything that can
  edit AGENTS.md controls the commands an agent evaluates. That trust
  boundary predates this branch. The branch adds `npm run typecheck && npm
  test` to the line, so the eval now also runs code from `src/` and
  `node_modules/`. The inputs are repository files that the team controls,
  not user input. Confidence: about 3. Not a finding.
- **Future story, not this branch.** The e05s04 spec allows `gh api` for that
  story only, with a recorded waiver. Nothing in this branch calls it. Review
  that story's diff when it lands.

## Result

HIGH findings: 0. Gate passes for this diff.
