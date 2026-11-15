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
handoff note. Everything else is light: short tasks, a reviewer from another
model family, a pull request that says what it proved.

It is TypeScript on Node 26 or later, one package that is both a CLI and a
library, tested with the built-in `node:test` runner. Claude Code is the first
host. The next big piece of work is the auto run (backlog item e11), which turns
the way we work here into a product.

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

- Tracked: `src/`, `docs/` (research briefs, bug reports, the security review,
  `STATE.md`, `BUDGET.md`), `tools/`, `.claude/skills/`, `weftwork.yaml` when
  present.
- Local, never committed:
  - The backlog: `"$(git rev-parse --git-common-dir)/weftwork/BACKLOG.md"`,
    shared by every worktree of this clone.
  - The engine's state, ledger and handoff: `"$(git rev-parse --absolute-git-dir)/weftwork/"`,
    one per worktree (`docs/STATE.md`).
  - `.specs/`: the old bigpowers planning tree, read-only history. The tag
    `bigpowers-era` holds the last tracked copy.

## How work happens

1. The owner names a task, often with "full stop" (finish to a ready PR) and a
   backlog id or a sentence. Run `node src/resume-cli.ts` first when picking up
   earlier work.
2. Branch from an up-to-date `main`: `git checkout -b <type>/<short-name>`. A
   git worktree is fine; each worktree has its own engine state.
3. Make the smallest change that does the task. For behaviour, write the test
   first and watch it fail, then make it pass.
4. Prove it: run the task's check and Preflight, and keep the output.
5. Review with the `review-loop` skill (Codex, read-only, at most 3 rounds).
6. File the PR with the `file-pr` skill, wait for CI, fix real failures. Stop
   when it is ready. The owner merges.
7. Update the backlog: tick the task and add any follow-ups you found.

The `full-stop` skill runs steps 2 to 7 for you.

## Commands

| Action | Command |
| ------ | ------- |
| Run the engine | `echo '{"command":"npm test"}' \| node src/cli.ts` |
| Test | `npm test` |
| Typecheck | `npm run typecheck` (no emit; Node runs `.ts` directly) |
| Lint | `yamllint .` |
| Preflight | `yamllint . && bash tools/check-briefs.sh && npm run typecheck && npm test` |
| Setup | `bash tools/setup.sh` (fresh clone; Preflight needs `node_modules`) |
| CI | `.github/workflows/ci.yml` |

## Preflight

```bash
yamllint . && bash tools/check-briefs.sh && npm run typecheck && npm test
```

## Architecture

`src/` holds the gate library (`gate.ts`), the working-tree fingerprint
(`tree.ts`) and the thin CLI (`cli.ts`); `engine.ts` runs the loop, with the
stop rules (`engine-rules.ts`), the ledger (`ledger.ts`), the no-progress
breaker (`breaker.ts`), the budget setting (`budget.ts`) and the budget report
on every answer (`budget-report.ts`; all in `docs/BUDGET.md`). The Claude Code
adapter is `claude-hook.ts` and its thin CLI `claude-hook-cli.ts`, which adds
the session's tokens from the transcript (`transcript-usage.ts`);
`claude-install.ts` installs the Stop hook. The state writer is `state-file.ts` (set one field of a
YAML file and keep every other byte), with the file half in `state-write.ts`
and the mapping edit in `state-mapping.ts`. `state-fields.ts` and its CLI
`state-cli.ts` own the engine's state file in `<git dir>/weftwork/`;
`handoff.ts` and `handoff-cli.ts` write the handoff block; `resume.ts` and
`resume-cli.ts` check it at session start (`docs/STATE.md`). Every CLI is a
thin shell over a library function.

## Rules

- Never commit to `main`. Never merge, land or push to `main` without the
  owner's go-ahead. Commit, push a feature branch and open a PR without asking.
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
