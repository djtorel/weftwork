# Architecture

This page is the map of `src/`: where each part of weftwork lives, and where
new code goes. Each feature has its own doc in `docs/`; this page links to it.

## The layout

```text
src/
  cli.ts                 weftwork engine
  <command>-cli.ts       weftwork <command>, one file per command
  weftwork-cli.ts        the `weftwork` command itself: finds and runs the others
  engine/                the done gate, the loop, the ledger and the budget
  claude/                the Claude Code adapter: Stop hook, install, live check
  guard/                 the PreToolUse guard and its ask triggers
  ...                    one folder per feature (the table below)
  shared/                small helpers every feature uses
  test-support/          test helpers and fixtures
  repo-checks/           tests of the repository itself
```

Two rules hold it together, and `src/repo-checks/layout.test.ts` checks both:

1. **The top of `src/` holds only command files.** `weftwork <command>` runs
   `src/<command>-cli.ts`, and `weftwork engine` runs `src/cli.ts`.
   `weftwork-cli.ts` finds the commands by listing that folder. Each command
   file is a thin shell: it reads the input, calls a library function and
   prints the result (`CONVENTIONS.md` § TypeScript code style). No library
   file imports a command file.
2. **The library lives in feature folders.** A feature folder holds the
   modules of one feature and their tests. `shared/` is the bottom layer and
   imports from no other folder.

The command files stay at the top of `src/` and are not in a folder of their
own, because the paths are part of how weftwork runs: this repository's
`.claude/settings.json` runs `src/claude-hook-cli.ts` and `src/guard-cli.ts`,
the live check matches a hook by that path, and the skills and `AGENTS.md`
name `node src/<command>-cli.ts`.

## The folders

| Folder | What it holds | Doc |
| ------ | ------------- | --- |
| `src/engine/` | The done gate (`gate.ts`) and the working-tree fingerprint (`tree.ts`); the loop (`engine.ts`) with its stop rules (`engine-rules.ts`), the no-progress breaker (`breaker.ts`) and the override (`override.ts`); the ledger (`ledger.ts`, with `ledger-file.ts` and `ledger-state.ts`); the budget setting and report (`budget.ts`, `budget-report.ts`); the run states (`states.ts`); the child process runner (`process.ts`); the Stop hook's reuse of a pass (`reuse.ts`); the session's tokens (`transcript-usage.ts`). | `BUDGET.md` |
| `src/claude/` | The Claude Code adapter (`claude-hook.ts`) and the Stop entry's host timeout it fits under (`claude-hook-timeout.ts`); the installs of the Stop hook, the guard and the SessionStart entry (`claude-install.ts`, `claude-guard-install.ts`, `claude-env-install.ts`); reading the settings file (`claude-settings-file.ts`); the live check (`claude-live.ts`, `claude-live-guard.ts`) and the call record it reads (`last-call.ts`). | `GUARD.md`, `SETUP.md`, `BUDGET.md` |
| `src/guard/` | The guard (`guard.ts`), the owner's protected paths (`guard-setting.ts`), and the mechanical ask triggers: a write outside the worktree (`guard-worktree.ts`) and a push to main (`guard-push.ts`). | `GUARD.md`, `ASK.md` |
| `src/state/` | The engine's state file: the format-preserving writer (`state-file.ts`, `state-write.ts`, `state-mapping.ts`) and its fields (`state-fields.ts`); the handoff (`handoff.ts`) and the resume check (`resume.ts`); the decision log (`decision.ts`). | `STATE.md`, `ASK.md` |
| `src/review/` | One review round (`review.ts`), its setting (`review-setting.ts`), its ledger lines (`review-ledger.ts`), what a round is of (`review-scope.ts`) and what became of each finding (`review-outcome.ts`); UI screenshots for the review (`ui.ts`, `ui-setting.ts`); the copies of a round's images the reviewers read, outside the git dir (`reviewer-images.ts`); which reviewers rest after they ran out of usage or hung (`reviewer-rest.ts`). | `REVIEW.md`, `UI.md` |
| `src/design/` | The design loop: the rubric, one round's reply and the loop's stop rules (`design.ts`), its setting (`design-setting.ts`), the record in the clone's design folder (`design-store.ts`, `design-record.ts`, `design-round.ts`), and the numbered boxes drawn on a screenshot (`png-mark.ts`). | `DESIGN-LOOP.md` |
| `src/proof/` | The pull request's Proof block (`pr-proof.ts`) and the base check (`base-check.ts`, `base-check-setting.ts`, `base-check-tap.ts`). | `PR-PROOF.md`, `BASE-CHECK.md` |
| `src/setup/` | Setting up a project (`setup.ts`, `setup-text.ts`, `setup-diff.ts`, `setup-about.ts`, `setup-undo.ts`), `weftwork init` (`init.ts`), and `weftwork update` with the hashes of every skill text weftwork shipped (`update.ts`, `skill-hashes.ts`). | `SETUP.md`, `GETTING-STARTED.md` |
| `src/detect/` | The report of a project's stack, commands, CI and agent files (`detect.ts`, `detect-stacks.ts`, `detect-packages.ts`), and the check that each command resolves (`detect-check.ts`). | `DETECT.md` |
| `src/convert/` | Converting a bigpowers, GSD (1 or 2), spec-kit or BMAD project (`convert.ts`), one module per planning system for its backlog section, and the old plan's order (`convert-order.ts`). | `CONVERT.md` |
| `src/install/` | Finding and installing weftwork itself: the one lookup for the `weftwork` command (`launcher.ts`), handing a command to the project's own weftwork (`delegate.ts`), `weftwork install` (`install.ts`) and `weftwork upgrade` (`upgrade.ts`). | `INSTALL.md` |
| `src/history/` | The opt-in local history: one record per task (`history.ts`, `history-store.ts`), its setting, its report of recurring failures, and accepted improvements. | `HISTORY.md` |
| `src/measure/` | The measurement harness: a fixture repository with planted defects and a held-out oracle (`measure-fixture.ts`), and the experiments (`measure.ts`). | `MEASURE.md` |
| `src/parallel/` | The file-overlap check before parallel work (`overlap.ts`). | `PARALLEL.md` |
| `src/shared/` | Helpers with no feature of their own: JSON input and output for the CLIs (`cli-io.ts`), safe file reads (`regular-file.ts`), error text (`errors.ts`), JSON checks (`json.ts`), Markdown escaping (`markdown-text.ts`), and the path of a command file (`sibling.ts`). | |
| `src/test-support/` | Test helpers (`test-helpers.ts`: temporary folders and git repositories, child runs) and the fixtures in `fixtures/`. Never in the package. | `CONVENTIONS.md` § Tests |
| `src/repo-checks/` | Tests of the repository, not of one feature: the layout on this page, retired names, this repository's own hooks, agent worktrees. | |

## Where new code goes

- **A new command:** `src/<command>-cli.ts`, a thin shell, and a line for it
  in the `--help` table of `src/weftwork-cli.ts`. Its logic goes in the
  feature folder.
- **A new module:** in the folder of the feature it serves. When it starts a
  new feature, add a folder and a row to the table above; the layout test
  fails until the row is there.
- **A test:** `<name>.test.ts` next to the module it tests. The process tests
  of a command (they start `src/<command>-cli.ts`) go in the feature folder
  of the library it shells, named for the command: `src/engine/cli.test.ts`
  tests `src/cli.ts`.
- **A helper two features need:** `src/shared/` when it needs no feature;
  otherwise in the feature that owns it, imported from there.

## The build

Node runs the `.ts` files in a checkout by stripping types, so there is no
build step in the repository. The npm package ships `dist/`, which
`tsconfig.build.json` compiles with the same folders and without the tests,
`src/test-support/` or `src/repo-checks/` (`RELEASING.md`). `bin/weftwork.js`
runs `src/weftwork-cli.ts` in a checkout and `dist/weftwork-cli.js` when
installed.
