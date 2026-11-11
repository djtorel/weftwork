# e05s03 — TypeScript code-style and test conventions, and real commands

**type:** docs (conventions and agent context)
**risk:** P3
**context:** infra
**bcps:** 2
**epic:** e05 (Repository and environment setup, wave 5)
**research story:** none
**branch:** e05s03-typescript-conventions

## 1. Purpose

e05s02 added a TypeScript toolchain, but the project documents do not
mention it yet. CONVENTIONS.md line 4 says to add the code-style and
test sections "when the stack is chosen". The stack is chosen. The
AGENTS.md commands still say N/A, and Preflight does not run the
typecheck or the tests. e06 writes the first engine code and needs
these rules and commands first.

Reason for Depth: none needed. This story adds no abstraction. It
edits two Markdown files.

## 2. Zoom-out

The story changes two existing modules, CONVENTIONS.md and AGENTS.md.

- **Purpose:** CONVENTIONS.md holds the rules every agent follows.
  AGENTS.md (with `CLAUDE.md` as a symlink) holds project context and
  the commands.
- **Callers:** every agent session reads both files. The bigpowers
  script `scripts/bp-read-agents.sh` reads AGENTS.md. Its output feeds
  `kickoff-branch`, `verify-work` and other skills as `BP_PREFLIGHT`,
  `BP_TEST`, `BP_BUILD` and `BP_LINT`.
- **Contracts:**
  - Every command in AGENTS.md resolves in this repository today
    (CONVENTIONS.md, Generated and Managed Files).
  - AGENTS.md is edited inside or outside its `bigpowers:` fences,
    never across a fence marker.
  - `bp-read-agents.sh` takes the first line that starts with a letter,
    or the first line in a code fence, under `## Test`, `## Build`,
    `## Lint` and `## Preflight`. Read on 2026-11-11, it returned
    "N/A until product code exists." for Test and Build, and nothing
    for Lint (the line starts with a backtick) or Preflight (AGENTS.md
    has no `## Preflight` section).
  - The Preflight text in CONVENTIONS.md and in AGENTS.md stays the
    same.

Blast radius (inline, in place of a separate `assess-impact` run):
Preflight becomes longer, so every gate that runs Preflight now needs
`node_modules` (`bash tools/setup.sh`). CI already runs the typecheck
and the tests (e05s02), so CI does not change. No code changes.

## 3. Requirements

#### REMOVED: the "add the sections later" line in CONVENTIONS.md
**Before:** line 4 says to add the code-style and test sections when
the stack is chosen, as an open question for e04s02.
**After:** (removed). The sections exist. Line 3 no longer says the
project has no product code.

#### ADDED: "TypeScript code style" section in CONVENTIONS.md
Only rules that the e05s02 toolchain enforces or that a reviewer can
check:
- `tsconfig.json` is strict. Do not weaken it to make code compile.
- ESM only (`"type": "module"`, `nodenext`). Import local files with
  their `.ts` extension. Use `import type` for type-only imports
  (`verbatimModuleSyntax`).
- Erasable syntax only: no `enum`, `namespace` or parameter
  properties (`erasableSyntaxOnly`; Node runs `.ts` by type
  stripping).
- No explicit `any` without a comment that says why. `unknown` plus a
  check is the default. A reviewer checks this rule; no linter enforces
  it yet (owner decision 2026-11-11).
- Errors: an expected failure (a gate fails, a file is missing) is a
  returned value that the caller must check. Throw only for bugs and
  states the program cannot recover from, and throw `Error` instances,
  never strings (owner decision 2026-11-11).
- The CLI is a thin shell. It parses arguments, calls a library
  function, and prints the result. Logic lives in the library, so
  tests call it without a process.

#### ADDED: "Tests" section in CONVENTIONS.md
- Runner: the built-in `node:test` with `node:assert/strict`. `npm
  test` runs `node --test`. No other runner.
- Location and naming: `<name>.test.ts` next to the code it tests.
  Node 26 matches `**/*.test.ts` by default when type stripping is on
  (nodejs/node v26.0.0 `doc/api/test.md`, via ctx7, accessed
  2026-11-11).
- Red first: write the test, run it, and see it fail before the code
  exists. Record the failure as RED evidence.
- Every test asserts. A test that cannot fail is not a test.
- What runs where: Preflight and CI run `npm run typecheck` and
  `npm test`. CI also runs the shell selftests in `tools/`.

#### MODIFIED: Preflight
**Before:** `yamllint specs && bash tools/validate-specs-yaml.sh &&
bash tools/check-gate-ignores.sh`.
**After:** the same, then `&& npm run typecheck && npm test` (owner
decision 2026-11-11). Same text in CONVENTIONS.md and AGENTS.md.

#### MODIFIED: AGENTS.md commands table
**Before:** Run, Test and Build are N/A. Lint is `yamllint specs`.
**After:**

| Row | Command |
| --- | ------- |
| Run | N/A until e06 ships the CLI (owner decision 2026-11-11) |
| Test | `npm test` |
| Build | `npm run typecheck` (no emit; Node runs `.ts` directly) |
| Lint | `yamllint specs` (no TypeScript linter; owner decision 2026-11-11) |
| Preflight | the new Preflight |

#### MODIFIED: AGENTS.md sections read by `bp-read-agents.sh`
**Before:** `## Test` and `## Build` say "N/A until product code
exists." `## Lint` starts with a backtick, so the script reads nothing.
There is no `## Preflight` section.
**After:** `## Test`, `## Build`, `## Lint` and a new `## Preflight`
each start with a code fence that holds the command, then the notes.
`bp-read-agents.sh --print` prints all four commands.

#### MODIFIED: AGENTS.md project description
**Before:** "Stack: none yet. The project is in a research phase and
contains no product code." The Architecture section says no code
exists.
**After:** the stack is TypeScript on Node 26 or later, npm and
`node:test`, one package that is a CLI and a library. `src/` holds
only the e05s02 smoke files until e06.

## Acceptance criteria (Gherkin)

These IDs are local to this story.

```gherkin
Scenario: AC-e05s03-01 code-style section exists
  Given CONVENTIONS.md
  Then it has a "TypeScript code style" section
  And the section names strict mode, ESM, any, and errors
  And the "add the sections later" line is gone

Scenario: AC-e05s03-02 tests section exists
  Given CONVENTIONS.md
  Then it has a "Tests" section that names node:test, red first,
    and assert

Scenario: AC-e05s03-03 Preflight runs the typecheck and the tests
  Given CONVENTIONS.md and AGENTS.md
  Then both Preflight lines end with npm run typecheck && npm test
  And the two lines are the same
  And the full Preflight exits 0

Scenario: AC-e05s03-04 skills read real commands
  When bash scripts/bp-read-agents.sh --print runs
  Then it prints Preflight, Test (npm test), Build
    (npm run typecheck) and Lint (yamllint specs)
  And no printed command says N/A
```

## 4. Dependencies (slopcheck)

None added. The owner chose no TypeScript linter for now
(2026-11-11): adding ESLint or Biome would add a dependency and a gate
before any failure justifies it.

## 5. Out of scope

- A TypeScript linter. Revisit when an observed failure justifies it.
- Changes to `tsconfig.json`, `package.json` or CI.
- A real build with emitted JavaScript, and a Run command (e06).
- Changes to the global `bp-read-agents.sh`. AGENTS.md is shaped to
  fit it.
- The PR template and branch protection (e05s04).

## 6. Risks

- **Preflight now needs `node_modules`.** A fresh clone fails
  Preflight until `bash tools/setup.sh` runs. Detect: `tsc: not
  found`. AGENTS.md names setup.sh next to Preflight.
- **Two Preflight copies drift.** CONVENTIONS.md and AGENTS.md hold
  the same line. Detect: task 3 verify compares them.
- **`bp-read-agents.sh` is machine-local.** Task 4 verify needs the
  `scripts/` symlink, so CI cannot run it. Detect: the verify fails
  with "No such file".

## Verification Script (human)

1. Read the "TypeScript code style" and "Tests" sections in
   CONVENTIONS.md. Each rule is one a reviewer can check.
2. Run the Preflight line from AGENTS.md. It exits 0 and shows one
   passing test.
3. Run `bash scripts/bp-read-agents.sh --print`. It prints four
   commands, none N/A.
