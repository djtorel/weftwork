<!-- story: e05s04 -->
# e05s04 — PR template and protected main

**type:** chore (repository settings and a template)
**risk:** P2
**context:** infra
**bcps:** 3
**epic:** e05 (Repository and environment setup, wave 5)
**research story:** none
**branch:** e05s04-pr-template-protected-main

## 1. Purpose

The e05 done_when needs two things that do not exist yet: a PR
template that lists the gates, and a protected `main` that requires
the CI check. Today a guard hook on this machine blocks direct commits
to `main`, but GitHub itself accepts a direct push, a force push, or a
branch deletion. A PR body names the gates only when the agent
remembers the AGENTS.md Flow Discipline rule. e06 starts product code
and must land through PRs that CI gates.

Reason for Depth: none needed. This story adds no abstraction. It adds
one Markdown file, one waiver entry, and one GitHub setting.

## 2. Zoom-out

The story adds a new file and changes repository settings. It changes
no existing module.

- **Purpose:** the PR template pre-fills every PR body. Branch
  protection makes GitHub refuse merges that skip a PR or a red CI.
- **Callers:** `release-branch` writes the PR body with
  `gh pr create`. The owner merges in the GitHub UI or with
  `gh pr merge`. CI (`.github/workflows/ci.yml`, job `checks`)
  reports the status that protection requires.
- **Contracts:**
  - The required status check name is the job name `checks`.
    Renaming the job breaks every merge until protection is updated.
    That is why this story runs last in e05.
  - AGENTS.md Flow Discipline: the PR body names every gate that
    passed, was waived, was stale or was missing, and carries no
    bigpowers provenance marker.
  - The audit-code checklist item "gh is used only for PRs and clones"
    (see AUDIT-e02-e02s04.md). Task 2 records the owner's exception
    for this story.

Blast radius (inline, in place of a separate `assess-impact` run):
after task 3, every change to `main` goes through a PR with a green
`checks` job that is up to date with `main`. `release-branch` already
works that way (squash merge of a PR), so the flow does not change.
Dependabot PRs also need a green `checks`. No code changes.

## 3. Requirements

#### ADDED: PR template
`.github/pull_request_template.md` with these sections: Summary,
Story (the story id), Gates (one line each for audit, security review
and gate-trace: passed, waived, stale or missing, with the reason),
and Verify (the Preflight output or a link to it). No provenance
marker, no AI attribution. GitHub fills the PR body from this file
when the PR is opened in the web UI. `gh pr create --body` replaces
it, so `release-branch` writes its body to the same headings.

#### ADDED: gh api waiver for e05s04
A `state.yaml` waiver in the form of the e02s04 one: the audit-code
item "gh used only for PRs and clones", scope e05s04 only. Reason:
branch protection has no setting outside the REST API and the web UI.
Owner decision 2026-11-11.

#### ADDED: protected main
Classic branch protection on `main`, set with
`gh api -X PUT repos/{owner}/{repo}/branches/main/protection`.
GitHub's docs (docs.github.com/en/rest/branches/branch-protection,
via ctx7, accessed 2026-11-11) mark four body keys as required:
`required_status_checks` (`strict`, `contexts`), `enforce_admins`,
`required_pull_request_reviews` and `restrictions`.
`allow_force_pushes` and `allow_deletions` default to false. The
body is:

- `required_status_checks`: `strict: true` (up to date with `main`),
  `contexts: ["checks"]`.
- `required_pull_request_reviews`: `required_approving_review_count:
  0`. One owner cannot approve their own PR, so a count above 0
  blocks every merge.
- `enforce_admins`: the owner decides when task 3 runs.
  Recommendation: `true`, so the "never commit to main" rule holds on
  GitHub too, not only in the local hook.
- `restrictions: null`. Push restrictions apply only to organization
  repositories, and `djtorel/weftwork` is a personal one.
- `allow_force_pushes: false`, `allow_deletions: false`.

## Acceptance criteria (Gherkin)

These IDs are local to this story.

```gherkin
Scenario: AC-e05s04-01 PR template lists the gates
  Given .github/pull_request_template.md
  Then it has Summary, Story, Gates and Verify headings
  And it has no provenance or AI attribution text

Scenario: AC-e05s04-02 the gh api exception is recorded
  Given specs/state.yaml
  Then a waiver with scope e05s04 names gh

Scenario: AC-e05s04-03 main is protected
  When gh api reads the protection of main
  Then the check "checks" is required and strict is true
  And a pull request is required with 0 approvals
  And force pushes and deletion are blocked
```

## 4. Dependencies (slopcheck)

None added. `gh` is already installed and authenticated on this
machine. `[OK]`: no new packages.

## 5. Out of scope

- Repository rulesets. They are GitHub's newer mechanism, but the
  classic endpoint is enough for one branch and one owner, and task 3
  verify reads it. Revisit if a second protected branch appears.
- CODEOWNERS, required signed commits, linear history and
  conversation resolution. No observed failure justifies them
  (CONVENTIONS.md, Provisional Rules).
- Changes to the CI workflow or the job name.
- Changes to `release-branch` or other global skills.

## 6. Risks

- **The settings change is outward-facing.** It changes GitHub
  settings and needs the owner's go-ahead right before task 3 runs.
  Undo: `gh api -X DELETE repos/{owner}/{repo}/branches/main/protection`.
- **Wrong check name blocks all merges.** If `contexts` does not match
  the job name, every PR waits on a check that never reports. Detect:
  the PR for this story shows "Expected — Waiting for status". The
  check name is copied from `ci.yml` (`jobs.checks`).
- **`strict: true` makes stacked PRs rebase.** A PR behind `main`
  cannot merge until it is updated. One story at a time keeps this
  rare.
- **This story's own PR.** Protection set before the merge applies to
  this PR. Its `checks` run must be green and up to date. That is a
  good first test, not a blocker.

## Verification Script (human)

1. Open a PR in the GitHub web UI. The body shows Summary, Story,
   Gates and Verify.
2. Open Settings → Branches on GitHub. `main` has a rule: PR
   required, `checks` required, branch up to date, no force push, no
   deletion.
3. Try `git push origin HEAD:main` from a scratch commit (do not run
   this unless the owner asks). GitHub refuses it with "protected
   branch".
