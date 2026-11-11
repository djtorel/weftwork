# Audit: e05s02 (one command sets up the Python and Node toolchains)

Story: e05s02
Mode: default (full checklist). Diff: branch `e05s02-toolchain-setup`,
`main` (ea172b4) to HEAD (3d433cf). Files reviewed (churn rank,
`scripts/bp-churn-rank.sh --since 90.days`): `.github/workflows/ci.yml`
(the story's churn hotspot, read first), then `tools/setup.sh`,
`tools/test-setup.sh`, `package.json`, `package-lock.json`,
`tsconfig.json`, `src/smoke.ts`, `src/smoke.test.ts`, the story spec and
the tasks file.

VERDICT: PASS

One gap was found and fixed in the audit (commit 3d433cf): the selftest
ran only `--check`, so the install path had no automated test. Open low
items are listed at the end.

## Checklist

### Supply Chain & Security
- ✓ slopcheck in spec §4: `typescript` 7.0.2 `[OK]`, `@types/node` 26
  `[OK]`, `actions/setup-node@v7` `[OK]`. PyYAML and yamllint are already
  in use.
- ✓ No `[SLOP]` or `[SUS]` packages.
- ✓ No secrets in the diff (scanned for `sk-`, `ghp_`, `AKIA`, private
  keys). No matches.
- ✓ OWASP spot-check. `setup.sh` takes one fixed flag and no other input.
  It reads only `package.json` in the repository. Every expansion is
  quoted. No eval. The lockfile resolves all 23 packages from
  `registry.npmjs.org`, each with an `integrity` hash, and CI uses
  `npm ci`.
- ✓ No HIGH findings. The security scan is skipped at P2
  (verify-work); no user data, auth or external API is touched.

### Provenance & Metadata
- ✓ The spec and the tasks file carry `type: chore` and `context: infra`.
- ✓ Decisions cite the owner's dated choices (2026-11-11) and the spike;
  the commits are listed in the verify evidence.

### Law of Demeter
- ✓ No method chains. Shell functions call tools directly.

### CONVENTIONS.md Compliance
- ✓ Planning output is in `specs/`. The new root files (`package.json`,
  `tsconfig.json`, lockfile) are tool config the stack needs.
- ✓ No `gh issue create`, no `gh api`, no call to `api.github.com`. The
  only `gh api` text in the diff is prose in the state note about e05s04.
- ✓ Every commit is a Conventional Commit with a `Story: e05s02` trailer
  and no attribution footer.

### Scope
- ✓ Changes match the six tasks. The audit fix adds tests only.
- ✓ No speculative features. `src/smoke.ts` is the placeholder the plan
  names.
- ✓ No files touched outside scope, apart from `specs/` bookkeeping.
- ✓ No reproducible gate failure. Preflight is green.

### Boy Scout Rule
- ✓ `ci.yml` keeps every gate step; only the setup line changed.
- ✓ No dead code. The audit removed three unused utility links (`cat`,
  `grep`, `tr`) from the selftest's good tree.
- ✓ No commented-out code.

### Types and Safety
- ✓ No `any`, `@ts-ignore`, `eslint-disable` or `as unknown as`.
  `tsconfig.json` is `strict`.

### Test Coverage
- ✓ After the audit fix, every function in `setup.sh` has a test:
  `find_missing` and `report` through 7 `--check` cases, `is_missing`
  and the install path through 2 no-flag cases. Two mutations (a changed
  PEP 668 message, a removed Node guard) each turned the selftest red.
- ✓ `src/smoke.ts` has a test for both outcomes (exit code 0 and 1).
- ✓ Tests use the public interface: the script's flag, exit code and
  output; the module's export.
- ✓ F.I.R.S.T: the selftest runs in under a second, each case builds its
  own temp tree, stubs remove host dependence, every case asserts its
  exit code and output, and the tests were written first (RED commits
  2301537, 0709f07, 2f3f876).

### SOLID and Heuristics
- ✓ Single responsibility: `find_missing` detects, `report` prints and
  exits, `is_missing` queries. The install sequence is top-level script
  flow.
- ✓ No smells from HEURISTICS.md found.

### Refactoring Smells (Fowler)
- ✓ None found. `run_case` and `run_install` share three lines of
  assertion; merging them would add a mode flag, so they stay apart.

### Code Style
- ✓ Functions are 4 to 20 lines (`find_missing` is 20).
- ✓ Files are under 300 lines (`setup.sh` 92, `test-setup.sh` 106).
- ✓ Names are specific (`find_missing`, `run_install`, `passed`).
- ✓ At most two levels of indentation.
- ✓ Comments say why: the header of each script states its contract.

## Red Flags

- I nearly passed Test Coverage because the hand test of the pip
  refusal had worked. A hand run is not a regression test, so the audit
  added the two install cases.
- Security scan: skipped at P2 by verify-work, not by choice here. The
  OWASP spot-check above still ran.

## Open low items (not blocking)

- `engines.node` is `>=26`, so `actions/setup-node` may pick a newer
  major (for example 27, a non-LTS line) when one ships. If CI should
  stay on 26, pin it with `node-version: 26` or `devEngines`. Owner
  decision; the spec chose `>=26`.
- If `node --version` itself fails, `set -e` stops `setup.sh` with no
  message. Rare; a broken Node install shows its own error.
- PyYAML and yamllint stay unpinned, as in CI before (spec §5).
