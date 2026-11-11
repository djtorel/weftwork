# e05s02 — One command sets up the Python and Node toolchains

**type:** chore (tooling)
**risk:** P2
**context:** infra
**bcps:** 3
**epic:** e05 (Repository and environment setup, wave 5)
**research story:** none
**branch:** e05s02-toolchain-setup

## 1. Purpose

A fresh clone needs yamllint and PyYAML to run Preflight. e06 needs a
TypeScript toolchain. Today CI installs the Python tools with its own
`pip install` line, and nothing sets up Node. This story adds one
command, `bash tools/setup.sh`, that a person and CI both run. It also
adds the TypeScript package skeleton that e06 builds on.

Reason for Depth: one script, `tools/setup.sh`, with a `--check` mode,
plus its selftest. It exists so CI and a person set up the same way.
No new abstraction: the script runs commands in a fixed order.

## 2. Zoom-out

The story changes one existing module, the CI workflow.

- **Purpose:** `.github/workflows/ci.yml` runs the repository's gates
  on every pull request and on every push to `main`.
- **Callers:** GitHub Actions. e05s04 makes its `checks` job a required
  status check, so the job name must stay `checks`.
- **Contracts:** the job keeps every existing gate step and its order
  after setup. `permissions: contents: read` stays. Only the Python
  setup line changes, and new steps are added.

Blast radius (inline, in place of a separate `assess-impact` run):
the change touches `ci.yml` and adds new files. No existing tool
script changes. Preflight is unchanged (e05s03 adds the typecheck and
tests to it). `.gitignore` already ignores `node_modules/`.

## 3. Requirements

#### MODIFIED: e05s02 scope (epic e05, change-request 2026-11-11)
**Before:** one command installs yamllint and PyYAML.
**After:** one command also sets up the Node and TypeScript toolchain.

#### ADDED: `tools/setup.sh`
- Installs PyYAML and yamllint with `python3 -m pip install` only when
  one is missing. If pip refuses (PEP 668, an externally managed
  Python), exit 1 and print the fix: use a mise or venv Python.
- Does not install Node. It checks that `node` and `npm` exist and
  that the `node` major version meets `engines.node` in
  `package.json`, then runs `npm ci`.
- Safe to run twice: a second run changes nothing and exits 0.
- `--check` installs nothing. It exits 0 when every tool is present,
  else exits 1 with one line per missing tool. Tools: `python3`,
  PyYAML (`import yaml`), `yamllint`, `node` (version), `npm`, and
  the local `tsc` in `node_modules/.bin`.

#### ADDED: `tools/test-setup.sh`
A selftest in `mktemp -d`, removed on exit. It runs `setup.sh --check`
against stub tools on a reduced `PATH`. The all-present case must pass
first (anti-vacuity). Then each case removes or breaks one tool and
must exit 1 and name that tool.

#### ADDED: TypeScript package skeleton
- `package.json`: `private`, `"type": "module"`, `engines.node`
  `">=26"`, scripts `typecheck` (`tsc --noEmit`) and `test`
  (`node --test`). Dev dependencies, exact versions:
  `typescript` 7.0.2 and `@types/node` 26.
- `package-lock.json`, committed.
- `tsconfig.json`: `strict`, `module` `nodenext`, `noEmit`,
  `erasableSyntaxOnly`, `verbatimModuleSyntax`,
  `allowImportingTsExtensions`, `types` `["node"]`.
- `src/smoke.ts` and `src/smoke.test.ts`: one function and one test.
  They prove the compiler and the runner run. e06 replaces them.
- Tests run as `.ts` through Node's type stripping. No build step and
  no `tsx` or `ts-node`. A spike on 2026-11-11 (Node 26.7.0,
  TypeScript 7.0.2) passed the test and failed a bad type with TS2322.

#### MODIFIED: CI workflow
**Before:** `actions/setup-python@v7`, then
`pip install pyyaml yamllint`, then the gate steps.
**After:** `actions/setup-python@v7` and `actions/setup-node@v7` with
`node-version-file: package.json` and `cache: npm`, then
`bash tools/setup.sh`, then the gate steps, then
`bash tools/test-setup.sh`, `npm run typecheck` and `npm test`.
setup-node reads `engines.node` from `package.json` (ctx7
`/actions/setup-node`, `getNodeVersionFromFile`, accessed 2026-11-11).

## Acceptance criteria (Gherkin)

These IDs are local to this story.

```gherkin
Scenario: AC-e05s02-01 setup is idempotent
  Given a machine with Python and Node 26 or later
  When tools/setup.sh runs twice
  Then both runs exit 0 and setup.sh --check exits 0

Scenario: AC-e05s02-02 all tools present passes (anti-vacuity)
  Given stub tools for every checked tool on PATH
  When setup.sh --check runs
  Then it exits 0

Scenario Outline: AC-e05s02-03 one missing tool fails
  Given the stub tools with <break>
  When setup.sh --check runs
  Then it exits 1 and the output names <tool>

  Examples:
    | break                          | tool     |
    | no yamllint                    | yamllint |
    | python3 cannot import yaml     | PyYAML   |
    | no node                        | node     |
    | node reports v24.0.0           | node     |
    | no npm                         | npm      |
    | no node_modules/.bin/tsc       | tsc      |

Scenario Outline: AC-e05s02-07 setup stops before npm on a hard miss
  Given the stub tools with <break>
  When setup.sh runs with no flag
  Then it exits 1, the output names <fix>, and npm is not run

  Examples:
    | break                          | fix          |
    | pip refuses the install        | PEP 668      |
    | no node                        | install Node |

Scenario: AC-e05s02-04 the TypeScript toolchain runs
  Given a fresh npm ci
  When npm run typecheck and npm test run
  Then both exit 0 and one test passes

Scenario: AC-e05s02-05 a clean copy sets up from scratch
  Given every tracked and unignored file copied to a temp directory
  When tools/setup.sh, the typecheck and the test run there
  Then all exit 0

Scenario: AC-e05s02-06 CI uses the setup command
  Given the workflow on a PR branch
  Then it runs tools/setup.sh, not pip install
  And the selftest, typecheck and test steps conclude success
```

## 4. Dependencies (slopcheck)

- `typescript` 7.0.2: Microsoft, released 2026-07-08, native
  compiler, `tsc` binary. `[OK]`.
- `@types/node` 26: DefinitelyTyped, types for `node:test` and
  `node:assert`. `[OK]`.
- `PyYAML`, `yamllint`: already used locally and in CI. `[OK]`.
- `actions/setup-node@v7`: official GitHub action, v7.1.0 released
  2026-10-08. Same major as the checkout and setup-python actions
  already in use. `[OK]`.
- Package manager `npm` and runner `node:test`: owner decision
  2026-11-11. Both ship with Node.

## 5. Out of scope

- Installing Node or Python. setup.sh checks them and names the fix.
- Pinning PyYAML and yamllint versions. CI does not pin them today.
- Adding the typecheck and tests to Preflight and to the AGENTS.md
  commands table (e05s03).
- CONVENTIONS.md code-style and test sections (e05s03).
- Real engine code (e06). The smoke files are placeholders.

## 6. Risks

- **Type stripping limits syntax.** `erasableSyntaxOnly` bans `enum`,
  `namespace` and parameter properties. e06 must use plain unions and
  objects. Detect: `tsc` fails on such syntax.
- **`npm ci` needs the network.** The clean-tree proof and CI download
  packages. Detect: the step fails with a fetch error, not a gate
  error.
- **Unpinned Python tools drift.** A new yamllint release can change
  rules. Detect: CI fails on lint while the local run passes.
- **Opening the PR is outward-facing.** It needs the owner's go-ahead.

## Verification Script (human)

1. `bash tools/setup.sh` exits 0. Run it again: it exits 0 and
   installs nothing.
2. `bash tools/setup.sh --check` exits 0.
3. `bash tools/test-setup.sh` prints one line per case and exits 0.
4. `npm run typecheck && npm test` shows one passing test.
5. On the PR, the CI `checks` job is green with the new steps.
