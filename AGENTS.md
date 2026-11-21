# weftwork

This file is the project context for every agent host (Claude Code reads it
through the `CLAUDE.md` symlink; pi, Codex and opencode read `AGENTS.md`).

## About this project

weftwork is a workflow engine for coding agents. The idea is simple: an agent
should be able to take a task from a short request to an open pull request on
its own, and the owner should only be needed to start it, to answer the few
questions that really need a person, and to merge. Prose instructions alone do
not hold an unattended agent to that (see `docs/research/R17-practitioner-autonomy.md`),
so the engine enforces the parts that matter: "done" is a command the engine
ran and watched pass, the loop has counted ceilings, and a hard stop leaves a
handoff note. Everything else is light: short tasks, a reviewer from another model
family (three for a risky change or a design), a pull request that says what it proved.

It is TypeScript on Node 26 or later, one package with one CLI (`weftwork`)
and no library API yet (`docs/RELEASING.md`), tested with the built-in
`node:test` runner. Claude Code is the first
host. The auto run (backlog e11, the `all-ready` skill) and getting started
(e12: setting up and converting projects) are built, and this repository runs
under its own hooks (below).

## Words

- **You**: the agent working in this repository.
- **The owner**: the person who starts tasks and merges pull requests.
- **Task**: one backlog item or one request, done on one branch, ending in one
  pull request.
- **Proof**: evidence you saw yourself in this session: a test that failed and
  then passed, Preflight output, a screenshot. A claim is not proof.
- **Engine**: the code in `src/`. **Ledger**: its record of runs. **Handoff**:
  its note for a session that remembers nothing.

## Where things are

- Tracked: `src/` (map in `docs/ARCHITECTURE.md`), `docs/` (research briefs, bug reports, the security review,
  `SECURITY-BASELINE.md`, `STATE.md`, `BUDGET.md`), `tools/`,
  `.claude/skills/`, `weftwork.yaml` and `weftwork-improvements.yaml` when
  present.
- Local, never committed:
  - The backlog: `"$(git rev-parse --git-common-dir)/weftwork/BACKLOG.md"`,
    shared by every worktree of this clone.
  - The history, when the owner turns it on: `history.jsonl` in the same
    folder, one record per filed task (`docs/HISTORY.md`).
  - The engine's state, ledger and handoff: `"$(git rev-parse --absolute-git-dir)/weftwork/"`,
    one per worktree (`docs/STATE.md`).
  - `.specs/`: the old bigpowers planning tree, read-only history. The tag
    `bigpowers-era` holds the last tracked copy.

## How work happens

1. The owner names a task, often with "all ready" (finish to a ready PR) or
   "all in" (finish and merge it once the merge gate passes) and a backlog id
   or a sentence. Run `node src/resume-cli.ts` first when picking up
   earlier work.
2. Branch from an up-to-date `main`: `git checkout -b <type>/<short-name>`. A
   git worktree is fine; each worktree has its own engine state.
3. Make the smallest change that does the task. For behaviour, write the test
   first and watch it fail, then make it pass.
   For UI work, run the design loop until it passes or stops
   (`docs/DESIGN-LOOP.md`).
4. Prove it: run the task's check and Preflight, and keep the output.
5. Review with the `second-opinion` skill (Gemini Neon by default, then Codex,
   then Opus; all three for a sensitive change or "Full panel"; read-only,
   at most 3 rounds).
6. File the PR with the `pr-it` skill, wait for CI, fix real failures. Stop
   when it is ready. The owner merges, unless the task said "all in".
7. Update the backlog: tick the task and add any follow-ups you found.

The `all-ready` skill runs steps 2 to 7 for you, and `all-in` runs them and
then merges.

## Commands

| Action | Command |
| ------ | ------- |
| Run the engine | `echo '{"command":"npm test"}' \| node src/cli.ts` |
| PR proof | `echo '{"command":"npm test"}' \| node src/pr-proof-cli.ts` |
| Review round | `echo '{"command":"npm test","brief":"..."}' \| node src/review-cli.ts` |
| Base check | `echo '{}' \| node src/base-check-cli.ts` |
| Finding outcomes | `echo '{"report":true}' \| node src/review-outcome-cli.ts` |
| UI screenshots | `echo '{"phase":"after"}' \| node src/ui-cli.ts` |
| Design round | `echo '{"images":["shot.png"],"brief":"..."}' \| node src/design-cli.ts` |
| Detect a project | `echo '{"run":false}' \| node src/detect-cli.ts` |
| File overlap | `echo '{"tasks":[{"name":"a","files":["src/a.ts"]},{"name":"b","branch":"main"}]}' \| node src/overlap-cli.ts` |
| Measure (R10 E1) | `echo '{"out":"/tmp/weftwork-measure.jsonl"}' \| node src/measure-cli.ts` |
| History report | `echo '{}' \| node src/history-cli.ts` |
| Test | `npm test` |
| Typecheck | `npm run typecheck` (no emit; Node runs `.ts` directly) |
| Lint | `yamllint .` |
| Preflight | `yamllint . && bash tools/check-briefs.sh && npm run typecheck && npm test` |
| Setup | `bash tools/setup.sh` (fresh clone; Preflight needs `node_modules`) |
| Install the command | `npm link` (then `weftwork <command>` runs `src/<command>-cli.ts`) |
| Build the package | `npm run build` (`dist/`; `npm pack` runs it) |
| Package test | `bash tools/test-package.sh` (pack, install, use; CI runs it) |
| CI | `.github/workflows/ci.yml` |

## Preflight

```bash
yamllint . && bash tools/check-briefs.sh && npm run typecheck && npm test
```

## Hooks

This repository runs under its own engine. `.claude/settings.json` registers
the Stop hook, which runs the Preflight through the done gate at every stop,
and the guard (`docs/GUARD.md`). Both name the engine as
`$CLAUDE_PROJECT_DIR/src/`, so each worktree runs its own copy. They need
`node_modules`: in a new worktree, run `bash tools/setup.sh` first. Until
then both hooks crash, and Claude Code lets every call and every stop
through. The guard blocks any Bash command whose text names a protected path
(`.claude/settings`, `weftwork.yaml`): read those files with the Read tool,
and only the owner changes them.

## Architecture

`docs/ARCHITECTURE.md` is the map of `src/`, folder by folder, and says where
new code goes. In short:

- The top of `src/` holds only the command files: `weftwork <command>` runs
  `src/<command>-cli.ts`, and `weftwork engine` runs `src/cli.ts`. Each is a
  thin shell over a library function; `weftwork-cli.ts` runs each one, with
  `--help` and `--version`.
- The library is in one folder per feature, each with its tests:
  `engine/` (the done gate, the loop and its stop rules, the ledger, the
  budget; `docs/BUDGET.md`), `claude/` (the Claude Code Stop hook adapter,
  the hook and guard installs, the live check; `docs/GUARD.md`), `guard/`
  (the PreToolUse guard and the ask triggers; `docs/ASK.md`), `state/` (the
  state file, handoff, resume and decision log; `docs/STATE.md`), `review/`
  (review rounds and UI screenshots; `docs/REVIEW.md`, `docs/UI.md`),
  `design/` (the design loop; `docs/DESIGN-LOOP.md`),
  `proof/` (the PR Proof block and the base check; `docs/PR-PROOF.md`,
  `docs/BASE-CHECK.md`), `setup/` (setup, init and update;
  `docs/SETUP.md`), `detect/` (`docs/DETECT.md`), `convert/`
  (`docs/CONVERT.md`), `install/` (finding and installing weftwork itself;
  `docs/INSTALL.md`), `history/` (`docs/HISTORY.md`), `measure/`
  (`docs/MEASURE.md`) and `parallel/` (`docs/PARALLEL.md`).
- `shared/` holds helpers with no feature, and imports from no other folder.
  `test-support/` holds the test helpers and fixtures; `repo-checks/` holds
  the tests of the repository itself, including the layout test that keeps
  this structure and `docs/ARCHITECTURE.md` in step.
- The package's bin is `bin/weftwork.js`: `src/` in a checkout, the build in
  `dist/` when installed from npm, where Node strips no types. Releases are
  cut by release-please and published with npm trusted publishing
  (`docs/RELEASING.md`).

## Rules

- Never commit to `main`. Never merge, land or push to `main` without the
  owner's go-ahead. "All in" on a task is the go-ahead to merge its PR once
  the `all-in` merge gate passes, never to push to `main`. Commit, push a feature branch and open a PR without asking.
- Ask the owner only when you cannot prove the change, a check cannot pass and
  you cannot fix it, the next step is destructive or outside this repository,
  the goal is ambiguous in a way that changes the result, or another PR makes
  this one obsolete. Decide everything else and list the decisions in the PR.
- Never read or write files in other projects without asking the owner.
- Never call a reproducible failure pre-existing or out of scope. Fix it, or
  stop and say so.
- Never state a research claim as a decision without a cited source. Research
  briefs follow `CONVENTIONS.md` § Evidence and must pass `tools/check-briefs.sh`.
- Never run more than 2 subagents at once.
- Write the least code that does the task. Check existing dependencies before
  adding one, and copy a validated pattern before inventing one.

`CONVENTIONS.md` has the code, test, commit and evidence rules.
