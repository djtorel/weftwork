# weftwork — AI Agents

> **Multi-agent context** — This file is the canonical project context for AGENTS.md-native tools: pi, opencode, Codex CLI, Cline, Aider.
> Claude Code reads it via the `CLAUDE.md` symlink.

Read CONVENTIONS.md before any GitHub or git operation.

<!-- BEGIN bigpowers:context-routing -->
## Context Routing

Load subdirectory context by file glob — see project-specific routing table (seeded by `seed-conventions`).
<!-- END bigpowers:context-routing -->

<!-- BEGIN bigpowers:learned-preferences -->
## Learned User Preferences

- (none yet — updated via `session-state`)

## Workspace Facts

- Start story branches with `git checkout -b` in this checkout, not a git
  worktree. bigpowers gate scripts only evaluate this checkout, and a
  worktree has no `scripts/` symlink (BUG-002).
<!-- END bigpowers:learned-preferences -->

<!-- BEGIN bigpowers:project -->
## Project

weftwork is a host-agnostic workflow for coding agents (pi and Claude Code first).
Stack: none yet. The project is in a research phase and contains no product code.

## Commands

| Action | Command |
| ------ | ------- |
| Run | N/A |
| Test | N/A |
| Build | N/A |
| Lint | `yamllint specs` |
| Preflight | `yamllint specs && bash scripts/validate-specs-yaml.sh && bash tools/check-gate-ignores.sh` |
| CI | `.github/workflows/ci.yml` (GitHub Actions) |

`scripts/` is a symlink to the global bigpowers install. It is gitignored and machine-local.

## Test

N/A until product code exists.

## Lint

`yamllint specs` with default rules: 80 columns, `---` document start.

## Build

N/A until product code exists.

## Architecture

No code exists. `docs/SEED-SPEC.md` sketches an engine, thin host adapters, and portable skills. That sketch is provisional.
Research briefs go in `docs/research/`. Plans, epics, and state go in `specs/`.

## Conventions

- Write every brief to `docs/research/<ID>-<slug>.md`.
- Cite sources with access date and publication date.
- Cite papers wherever literature exists on the topic.
- Give each assigned hypothesis a verdict: confirmed, refined, or refuted.
- Write YAML with a `---` start and lines of 80 columns or fewer.
- Write commit messages as Conventional Commits.
- Treat `docs/SEED-SPEC.md` as provisional until the v1 spec replaces it.

## Never

- Never dismiss reproducible gate failures as pre-existing or out of scope
- Never proceed on red Preflight — invoke quick-fix or fix-bug first
- NEVER read or write files in other projects without asking the owner.
- NEVER commit to `main`. Work on a feature branch.
- NEVER commit, push, or land without the owner's go-ahead.
- NEVER mark a brief done before its verify command passes.
- NEVER state a research claim as a decision without a cited source.
- NEVER run more than 2 subagents at once.

## Agent Rules

- **Workflow Mandate:** This project currently follows bigpowers. Use its skills (`plan-work`, `develop-tdd`, `build-epic`) for structured work. The mandate is provisional: R2 evaluates bigpowers.
- **Always Green:** Preflight must pass before forward work.
- Read `specs/` and CONVENTIONS.md before writing.
- Write the minimum that solves the stated problem.
- Run the task's `verify:` command after every change. Show the output before declaring done.
- Write all planning output to `specs/`.

## Token Economy — Minimal Footprint

1. **Check existing dependencies first.** DO inspect what current dependencies already do before adding a package.
2. **Prefer mature, maintained libraries.** DO NOT rewrite a capability a maintained library provides without a documented reason.
3. **Copy validated patterns.** DO study how established products solve the same problem first.
4. **Keep the simplest working implementation.** DO write the least code that satisfies the requirement. NEVER add preventive abstraction.
<!-- END bigpowers:project -->

## Flow Discipline (bigpowers, provisional)

These rules keep the bigpowers flow in order. They apply while this project uses bigpowers. The owner can override any of them by saying so in the session. An override covers that one case, unless the owner says it is permanent. If skipping a step looks sensible, ask the owner. Do not decide alone.

- **Follow each skill's Handoff gate.** Run the skill it names next. Do not edit `handoff.next_skill` to skip a skill. To skip one, ask first. Then write the skip and the reason in the PR body.
- **One story at a time.** Do not suggest, plan, or start the next story until `release-branch` has finished for the current one. If the owner starts a skill for a story whose predecessor is not released, say so once and ask before going on.
- **One branch per story.** Do not stack stories on one branch unless the owner says to.
- **Start each new story or epic in a fresh session.** When `release-branch` finishes, stop. Name the next skill and story from `state.yaml`. Tell the owner to start a fresh session. Do not run the next story's skills in this session.
- **`release-branch` leaves nothing open.** Do all of this in the same PR, before the merge:
  - Reconcile the story status in its tasks file, `epic.yaml`, and `execution-status.yaml`.
  - Write the handoff for the next story in `state.yaml`: `vcs.branch: main`, `next_skill: kickoff-branch`, the next story id, and anything the owner must decide first. Write the note for a session that remembers nothing of this one.
  - Commit `state.yaml` only as part of that handoff, so `main` is not left with a dirty `state.yaml` after the merge.
  - Name every gate in the PR body that passed, was waived, was stale, or was missing (audit, security review, gate-trace).
  - Leave out the bigpowers provenance marker. CONVENTIONS.md bans AI attribution in commits, and a squash merge can carry the PR body into the commit.
- **After the merge:** sync `main`, delete the local and remote branch, and confirm a clean tree and green CI on the merge commit. Leave no scratch files in the repo.
