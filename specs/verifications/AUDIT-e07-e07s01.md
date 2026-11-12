# Audit (latest)

Story: e07s01
Branch: e07s01-claude-stop-hook
Diff: git diff main...HEAD -- src specs AGENTS.md (the branch was clean, so
  the branch diff stands in for "uncommitted changes"; the fixes below are
  uncommitted until this audit's commit)
Mode: default (full checklist)
Churn: bp-churn-rank.sh ranked spec and state files first. The four new
  code files are new and have no churn; they were read in full.
Result: PASS (no deviation)

VERDICT: PASS

## What the audit found and fixed

The first pass failed these items. Each is fixed and the suite is green
(271 of 271, `npm run typecheck` clean).

1. **Function length.** hookAnswer was 21 lines (limit 20). The failed
   answer moved to blockWith (4 lines); hookAnswer is now 15. Every
   function in the two source files is 15 lines or fewer.
2. **Casts.** `chunk as Buffer` in the CLI is gone: stdin is read with
   `setEncoding('utf8')` and joined as text, which also keeps a multi-byte
   character that spans two chunks whole. The test helper `parsed as {...}`
   is gone: it uses isRecord from src/json.ts.
3. **Test gaps (T1).** The spec says the failed stderr asks Claude to make
   the command pass, and the overridden message names the command. No test
   asserted either. Both assertions are added.
4. **Names.** Test names read "a exhausted run". They now read "a run that
   ends <state> allows the stop".

## Checklist

- **Supply chain and security: PASS.** No new dependency (spec section 4).
  No secret in the diff (grep for `sk-`, `ghp_`, `AKIA`, `api key`: none).
  No `exec`, `spawn`, `eval` or file access in the new files. Security
  scan is in specs/security/REVIEW.md (e07s01 addendum): no finding at
  confidence 8 or above.
- **Provenance and metadata: PASS.** Verification evidence has `type:` and
  `context:`. Each new file carries a `// story: e07s01` tag. The owner
  decisions are recorded in the spec and the tasks file.
- **Law of Demeter: PASS.** No chain through unrelated objects.
- **CONVENTIONS.md: PASS.** Output is in specs/ and src/. No `gh issue
  create`, no GitHub REST call. Commits are Conventional Commits with a
  `Story: e07s01` trailer and no attribution footer.
- **Scope: PASS.** Two source files, two test files, one AGENTS.md line.
  No existing module changed. Nothing speculative: the fault list, the
  stdin cap and the hook timeout are left to e07s02 and e07s03 and are
  written down in the spec and the review addendum.
- **Boy Scout: PASS.** No dead code and no commented-out code.
- **Types and safety: PASS.** No `any`, no `@ts-ignore`, no cast after
  fix 2. `tsc` strict is clean. The `switch` in hookAnswer is exhaustive,
  so a ninth state fails the typecheck.
- **Test coverage: PASS.** Every function is tested through its public
  interface. The CLI is tested as a real child process in temporary
  repositories, so no run touches this repository's ledger. The tests are
  F.I.R.S.T: fast (about 0.2 s for the CLI file), independent (each case
  makes its own repository) and self-validating.
- **SOLID and heuristics: PASS.** claude-hook.ts maps; the CLI only reads,
  calls and writes. The engine is the one dependency and it is called
  through its public function.
- **Fowler smells: none named.** The CLI reads stdin in its own few lines
  rather than reusing src/cli.ts readInput. That one has a size cap and
  signal handling that e07s02 will need; reusing it now would pull that
  scope in early. Not duplication (G5) in effect: the two have different
  contracts.
- **Code style: PASS with a note.** Files are 42 to 110 lines. Names are
  specific. Guard clauses return early. The two `=== undefined` and
  `!input.ok` guards read as negatives (G29); they are guard clauses,
  where the positive form would nest the main path, so they stay.

## Red flags caught

- I nearly left hookAnswer at 21 lines as "one line over, not worth a
  helper". The limit is 20, so I split it.
- I nearly kept `as Buffer` because `for await` over stdin types chunks as
  `any`. Setting the encoding removes the need for the cast.
