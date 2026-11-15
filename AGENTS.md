# weftwork — AI Agents

> **Multi-agent context** — This file is the canonical project context for AGENTS.md-native tools: pi, opencode, Codex CLI, Cline, Aider.
> Claude Code reads it via the `CLAUDE.md` symlink.

Read CONVENTIONS.md before any GitHub or git operation.
<!-- story: e05s03 -->

<!-- BEGIN bigpowers:context-routing -->
## Context Routing

Load subdirectory context by file glob — see project-specific routing table (seeded by `seed-conventions`).
<!-- END bigpowers:context-routing -->

<!-- BEGIN bigpowers:learned-preferences -->
## Learned User Preferences

- (none yet — updated via `session-state`)

## Workspace Facts

- Start story branches with `git checkout -b` in this checkout, not a git
  worktree. bigpowers gate scripts evaluate the checkout whose `scripts/`
  symlink they are called through, and a new worktree has none (BUG-002).
<!-- END bigpowers:learned-preferences -->

<!-- BEGIN bigpowers:project -->
## Project

weftwork is a host-agnostic workflow for coding agents (pi and Claude Code first).
Stack: TypeScript on Node 26 or later, npm, and the built-in `node:test` runner. One package that is a CLI and a library.

## Commands

| Action | Command |
| ------ | ------- |
| Run | `echo '{"command":"npm test"}' \| node src/cli.ts` |
| Test | `npm test` |
| Build | `npm run typecheck` (no emit; Node runs `.ts` directly) |
| Lint | `yamllint specs` |
| Preflight | `yamllint specs && bash tools/validate-specs-yaml.sh && bash tools/check-gate-ignores.sh && npm run typecheck && npm test` |
| CI | `.github/workflows/ci.yml` (GitHub Actions) |

`scripts/` is a symlink to the global bigpowers install. It is gitignored and machine-local.
`scripts/bp-read-agents.sh` reads the first command under each heading below, so keep the command in a code block at the top of its section.

## Preflight

```bash
yamllint specs && bash tools/validate-specs-yaml.sh && bash tools/check-gate-ignores.sh && npm run typecheck && npm test
```

Run `bash tools/setup.sh` first on a fresh clone. Preflight needs `node_modules`.

## Test

```bash
npm test
```

Runs `node --test` on the `*.test.ts` files. See CONVENTIONS.md § Tests.

## Lint

```bash
yamllint specs
```

Default rules: 80 columns, `---` document start. No TypeScript linter yet; `tsc` strict mode and review cover TypeScript.

## Build

```bash
npm run typecheck
```

There is no emitted build. Node runs `.ts` files by type stripping, and `tsc --noEmit` checks the types.

## Architecture

`src/` holds the gate library (`gate.ts`), the working-tree fingerprint (`tree.ts`) and the thin CLI (`cli.ts`); e06 adds the rest of the engine. The Claude Code adapter is `claude-hook.ts` (Stop input and engine answer mapping) and its thin CLI `claude-hook-cli.ts`. The state writer is `state-file.ts` (set one field of a YAML state file and keep every other byte, on the `yaml` package's CST), with the file half in `state-write.ts`, the mapping edit that replaces one top-level mapping in `state-mapping.ts`, and the shared JSON stdin read and one-line answer of both CLIs in `cli-io.ts`. The field table `state-fields.ts` limits it to the documented fields of `specs/state.yaml` (`docs/STATE.md`), and its thin CLI `state-cli.ts` sets and gets only those. The handoff writer `handoff.ts` and its thin CLI `handoff-cli.ts` write the whole `handoff` block, with `written_at` and `uncommitted` filled by the engine; `regular-file.ts` holds the non-blocking regular-file read and the atomic write that it shares with the Stop-hook install. The resume check `resume.ts` (a pure report over the branch, the named files and git status) and its thin CLI `resume-cli.ts` check the handoff block against the repository at session start; `tree.ts` gives it `currentBranch`. The budget setting `budget.ts` reads `weftwork.yaml` at the repository root and the user file under `$XDG_CONFIG_HOME/weftwork/`, and sets the engine's limits before the engine runs, for both `cli.ts` and `claude-hook-cli.ts` (`docs/BUDGET.md`). `docs/SEED-SPEC.md` sketches an engine, thin host adapters, and portable skills. That sketch is provisional.
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
- NEVER merge, land, or push to `main` without the owner's go-ahead. Commit, push a feature branch and open a PR without asking (owner decision, 2026-11-15).
- NEVER mark a brief done before its verify command passes.
- NEVER state a research claim as a decision without a cited source.
- NEVER run more than 2 subagents at once.

## Agent Rules

- **Workflow Mandate:** This project currently follows bigpowers, minus the gates retired in "Retired gates and owner check-ins" below. Use its skills (`plan-work`, `develop-tdd`, `build-epic`) for structured work. The mandate is provisional: the e11 auto run replaces it once it ships.
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
  - Name every gate in the PR body that passed, was waived, was stale, or was missing (audit, security review). Do not list retired gates.
  - Leave out the bigpowers provenance marker. CONVENTIONS.md bans AI attribution in commits, and a squash merge can carry the PR body into the commit.
- **After the merge:** sync `main`, delete the local and remote branch, and confirm a clean tree and green CI on the merge commit. Leave no scratch files in the repo.

## Retired gates and owner check-ins

Owner decision, 2026-11-15, after a workflow audit. It is permanent until the owner changes it. It overrides any bigpowers skill text that asks for these gates or check-ins. The data behind it is in `specs/state.yaml`: 55 waivers, 17 of them for gate-trace and 12 for plan-consistency-check, and `request-review` used 37 percent of recorded skill time.

- **Retired, do not run:** `gate-trace`, the plan-consistency check, WSJF rescoring, and the dual-blind AND-gate with a score threshold in `request-review`. Write no waiver for a retired gate.
- **Review:** one reviewer in a fresh context, on another model family when one is installed. At most 2 rounds. Only must-fix findings block. List the unresolved should-fix findings in the PR body and release. The e11 council replaces this when it ships.
- **Open choices with a recommendation** (for example at the top of a tasks file): take the recommendation, record it in the PR body, and do not ask.
- **Ask the owner only for:** a merge, an irreversible or destructive action, a security-sensitive change, an effect outside the repository, a plan too broken to follow, or a choice with no recommendation the specs can settle.
