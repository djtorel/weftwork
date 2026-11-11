# Conventions
<!-- story: e05s03 -->

Shared rules for every agent working in weftwork. Written from the bigpowers base.
The stack is TypeScript on Node 26 or later, with npm and `node:test` (owner decision, e04 checkpoint, 2026-11-11).

## Conventional Commits

- ALWAYS write commits as [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).
- Format: `<type>(<scope>): <description>` with a space after the colon.
- Types: `feat` (minor), `fix` and `perf` (patch), `docs`, `chore`, `style`, `refactor`, `test` (no bump).
- Research and planning work uses `docs`. Tooling uses `chore`.
- NEVER add `Co-authored-by` or any AI attribution footer to a commit.
- Every commit on a story branch carries a `Story: <story-id>` trailer, for
  example `Story: e02s04`, after a blank line in the body. It is not an
  attribution footer. `scripts/record-cycle-time.sh` attributes effort by
  this trailer and refuses to record a story whose commits lack it.
- Run cycle-time recording through `tools/record-cycle-time.sh`: it calls
  `scripts/record-cycle-time.sh` and restores the `---` line that script
  removes from `specs/execution-status.yaml` (BUG-004).
- CI runs `tools/test-record-cycle-time.sh` (the BUG-004 regression test)
  on every push and pull request, so the marker fix stays enforced.
- Run the audit gate through `tools/assert-audit-story.sh`, not
  `scripts/lib/assert-epic-gate.sh`: the global gate passes any
  `VERDICT: PASS` in `specs/AUDIT_LATEST.md`, even one for an earlier
  story (BUG-006). The wrapper needs a `Story: <active story>` line in that
  file. audit-code must write it for every story. CI runs
  `tools/test-assert-audit-story.sh`.
- The cycle-time ledger is `specs/metrics/cycle-times.md`. Always pass
  `--file specs/metrics/cycle-times.md` to `record-cycle-time.sh`: its
  default name, `cycle-times.yaml`, holds front matter plus a Markdown
  body, which `validate-specs-yaml.sh` rejects. Take the branch SHA range
  before the squash merge; the merge hides it.

## Git

- NEVER work on `main`. Start every task on a feature branch.
- A guard hook blocks direct commits to `main`.
- NEVER commit, push, or land a branch without the owner's go-ahead.
- Landing is currently a decision for the owner.

## Boundaries

- NEVER read or write files outside this repository without asking the owner.
- Exception: the owner names a path, for example `../pi-flow-legacy` for R14.
- `scripts/` is a symlink to a global install. NEVER commit it. NEVER edit through it.
- NEVER run more than 2 subagents at once.

## Evidence

- Every task has a runnable `verify:` command.
- Run the command after the last edit. Show its output.
- A self-report is not evidence.
- Every brief cites dated sources: access date and publication date.
- Cite papers wherever literature exists. Practitioner opinion alone is not enough there.
- Secondary sources (blogs, comparison pages, curated lists) find candidates. They prove nothing.
- Every hypothesis gets a verdict: confirmed, refined, or refuted.
- NEVER state a claim as a decision without a cited source.

## Always Green and Discovered Defects

- Preflight is `yamllint specs && bash tools/validate-specs-yaml.sh &&
  bash tools/check-gate-ignores.sh && npm run typecheck && npm test`.
- On a fresh clone, run `bash tools/setup.sh` first. Preflight needs
  `node_modules`.
- Preflight MUST pass before forward work.
- A reproducible gate failure needs `quick-fix` or `fix-bug`, in a separate commit.
- Banned dismissive phrases: "pre-existing", "unrelated to this session", "not introduced by my changes", "out of scope".

## TypeScript code style

Only rules that the toolchain enforces or that a reviewer can check.

- `tsconfig.json` is strict. NEVER weaken it to make code compile.
- ESM only (`"type": "module"`, module `nodenext`). Import local files
  with their `.ts` extension. Use `import type` for type-only imports
  (`verbatimModuleSyntax`).
- Erasable syntax only: no `enum`, `namespace` or parameter
  properties (`erasableSyntaxOnly`). Node runs `.ts` files by type
  stripping, with no build step.
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
  exists. Record that failure as RED evidence.
- Every test asserts. A test that cannot fail is not a test.
- Preflight and CI run `npm run typecheck` and `npm test`. CI also runs
  the shell selftests in `tools/`.

## specs/ and docs/

- `specs/` holds planning output: scope, epics, release plan, state, checkpoints.
- `docs/research/` holds one brief per research story.
- `docs/SEED-SPEC.md` is provisional. Archive it to `docs/archive/` when the v1 spec replaces it.
- Write YAML with a `---` start and lines of 80 columns or fewer.
- Use `todo`, `in_progress`, `done` for task and story status.

## Generated and Managed Files

- The global scripts `record-cycle-time.sh` and `bp-timing.sh` rewrite YAML
  state files with `yaml.dump`, which drops comments, the `---` line and
  folded scalars (BUG-005, BUG-001). `tools/record-cycle-time.sh` restores
  the style of `specs/execution-status.yaml` itself. After the last
  `bp-timing.sh` call of a story, run `python3 tools/restore-yaml-style.py
  specs/state.yaml --base HEAD` before you commit. It puts back the text of
  every block whose data did not change and never changes data.

- Edit `AGENTS.md` only inside `bigpowers:` fences, or outside them.
- `CLAUDE.md` is a symlink to `AGENTS.md`. NEVER edit it separately.
- Every command written into `AGENTS.md` MUST resolve in this repository today.

## Provisional Rules

- The bigpowers workflow mandate applies now. Research stories R1 and R2 evaluate it.
- Add gates only after an observed failure justifies them.
- Each gate needs a logged, one-shot escape hatch.
