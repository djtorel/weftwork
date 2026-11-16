# Conventions

Shared rules for every agent working in weftwork.
The stack is TypeScript on Node 26 or later, with npm and `node:test` (owner decision, e04 checkpoint, 2026-11-11).

## Conventional Commits

- ALWAYS write commits as [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).
- Format: `<type>(<scope>): <description>` with a space after the colon.
- Types: `feat` (minor), `fix` and `perf` (patch), `docs`, `chore`, `style`, `refactor`, `test` (no bump).
- Research and planning work uses `docs`. Tooling uses `chore`.
- NEVER add `Co-authored-by` or any AI attribution footer to a commit.
- PRs are squash-merged, so the PR title becomes the commit title. Write it
  as a Conventional Commit.

## Git

- NEVER work on `main`. Start every task on a feature branch.
- GitHub branch protection on `main` requires a pull request and a green
  `checks` job. No local hook stops a commit to `main`, so check the branch
  before you commit.
- Commit, push a feature branch and open a PR without asking (owner
  decision, 2026-11-15).
- NEVER merge, land, or push to `main` without the owner's go-ahead.
  Landing is a decision for the owner.

## Boundaries

- NEVER read or write files outside this repository without asking the owner.
- Exception: the owner names a path. A download for research goes in the
  session scratchpad and is never run.
- NEVER run more than 2 subagents at once.

## Evidence

- Every task has a runnable check. Run it after the last edit and show its
  output.
- A self-report is not evidence.
- Research briefs (`docs/research/R<n>-<slug>.md`) cite dated sources:
  access date and publication date. `tools/check-brief.sh` checks them against
  `docs/research/planning-context.yaml`.
- Cite papers wherever literature exists. Practitioner opinion alone is not enough there.
- Secondary sources (blogs, comparison pages, curated lists) find candidates. They prove nothing.
- Every hypothesis a brief tests gets a verdict: confirmed, refined, or refuted.
- NEVER state a claim as a decision without a cited source.

## Always Green and Discovered Defects

- Preflight is `yamllint . && bash tools/check-briefs.sh && npm run
  typecheck && npm test`.
- On a fresh clone, run `bash tools/setup.sh` first. Preflight needs
  `node_modules`.
- Preflight MUST pass before forward work.
- A reproducible failure is fixed, in its own commit, or reported. A bug
  worth a write-up goes in `docs/bugs/BUG-<n>-<slug>.md`.
- Banned dismissive phrases: "pre-existing", "unrelated to this session", "not introduced by my changes", "out of scope".

## TypeScript code style

Only rules that the toolchain enforces or that a reviewer can check.

- `tsconfig.json` is strict. NEVER weaken it to make code compile.
- ESM only (`"type": "module"`, module `nodenext`). Import local files
  with their `.ts` extension. Use `import type` for type-only imports
  (`verbatimModuleSyntax`).
- Erasable syntax only: no `enum`, `namespace` or parameter
  properties (`erasableSyntaxOnly`). Node runs `.ts` files by type
  stripping, with no build step in the repository; only the npm package
  is compiled to `dist/` (`docs/RELEASING.md`).
- No explicit `any` without a comment that says why. Use `unknown` and
  a check instead. A reviewer checks this rule; no linter enforces it
  yet.
- Errors: an expected failure (a gate fails, a file is missing) is a
  returned value that the caller must check. Throw only for bugs and
  for states the program cannot recover from. Throw `Error` instances,
  never strings.
- The CLI is a thin shell. It parses arguments, calls a library
  function and prints the result. Logic lives in the library, so tests
  call it without starting a process.

## Tests

- Runner: the built-in `node:test` with `node:assert/strict`. `npm test`
  runs `node --test`. Use no other runner.
- Put each test in `<name>.test.ts` next to the code it tests. Node 26
  finds `**/*.test.ts` by default.
- Red first: write the test, run it, and see it fail before the code
  exists.
- Every test asserts. A test that cannot fail is not a test.
- Every test that starts a CLI isolates `XDG_CONFIG_HOME`, so the
  owner's own budget file never changes a result.
- Preflight and CI run `npm run typecheck` and `npm test`. CI also runs
  the shell selftests in `tools/`.

## Docs and files

- `docs/research/` holds one brief per research question; `docs/bugs/`
  holds bug write-ups; `docs/security/REVIEW.md` holds the security
  review that code comments cite.
- Plans, tasks and agent state are local and untracked (AGENTS.md,
  "Where things are"). The pull request is the shared record of a task.
- `docs/SEED-SPEC.md` is provisional. Archive it to `docs/archive/` when the v1 spec replaces it.
- Write YAML with a `---` start and lines of 80 columns or fewer.
- `CLAUDE.md` is a symlink to `AGENTS.md`. NEVER edit it separately.
- Every command written into `AGENTS.md` MUST resolve in this repository today.
- A rename of a skill, a command or a setting key adds the old name to
  `src/retired-names.test.ts`, so work on an older branch cannot bring it
  back.

## Provisional Rules

- Add gates only after an observed failure justifies them.
- Each gate needs a logged, one-shot escape hatch.
