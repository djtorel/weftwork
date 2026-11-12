---
type: audit-report
context: engine
story_id: e06s03
audited_at: "2026-11-12"
mode: default (full checklist)
scope: branch e06s03-counts-ledger against main 15df17e. Story commits
  47c784a (plan) and c59e330 (ledger), plus the audit fixes in the
  working tree (uncommitted, see Verdict).
---

# Audit: e06s03 (log every verdict in a counts ledger)

## Look-here-first

`bp-churn-rank.sh` ranks the spec and state files highest. The engine
files are small and changed once, so the ranking gave no code hotspot.
The review went through the changed source files directly: src/ledger.ts,
src/gate.ts, src/cli.ts and the three new test files.

## Checklist

### Supply Chain & Security
- [x] No new dependencies. No slopcheck needed.
- [x] No secrets in the diff (grep for sk-, ghp_, AKIA and key blocks: none).
- [x] OWASP spot-check: see specs/security/REVIEW.md (addendum e06s03).
- [x] Security: no HIGH findings. Three LOW (F1 symlink, F2 default mode,
      F3 no size cap), documented, none blocking.

### Provenance & Metadata
- [x] Spec and tasks file carry type, context and risk.
- [x] Steps reference the threat model controls (C3, C4, C5, C10) and the
      plan commit 47c784a. Fixed in this audit: the steps cited none.

### Law of Demeter
- [x] No chains through unrelated objects. `result?.ok`, `mine.at(-1)`
      and `process.stderr.write` are one level each.

### CONVENTIONS.md Compliance
- [x] Outputs are in specs/ and specs/verifications/.
- [x] No `gh issue create`, no direct GitHub API call in the diff.

### Scope
- [x] Changed only what the spec asks. gate.ts was split into `decide`
      (the verdict) and `record` (the log) so the log could be added
      without changing the verdict logic.
- [x] No speculative features. The F2 mode change (0700 directory, 0600
      file) was applied after the owner's go-ahead, with a test (AC-02).
- [x] No files outside the stated scope.
- [x] No discovered defects: Preflight is green.
- [x] Boy Scout: no dead code, no commented-out code. The `held` variable
      in gate.ledger.test.ts was removed.

### Boy Scout Rule
- [x] Each touched file is cleaner than before.
- [x] No dead code. `tsc --noUnusedLocals --noUnusedParameters` is clean.
- [x] No commented-out code.

### Types and Safety
- [x] No `any`.
- [x] No `@ts-ignore` or `eslint-disable`.
- [x] No `as unknown as`.
- [x] The one `as` cast in cli.ledger.test.ts is removed. The remaining
      `path as string` casts follow an `assert.notEqual` that proves the
      value is set. Accepted: the checklist bans only `as unknown as`.

### Test Coverage
- [x] Every new function has a test: ledgerPath, appendEntry,
      readLedger, countsFor. `record`, `decide` and `note` are reached
      through runGate in gate.ledger.test.ts.
- [x] Story has no bug fix, so no regression test is needed.
- [x] Tests run through public interfaces (runGate, the CLI, the exported
      readers). The stderr mock is I/O only.
- [x] F.I.R.S.T: each test builds its own temporary repository, so tests
      are independent. Mutation check: the append changed to write
      nothing fails 4 of 8 gate-ledger tests.

### SOLID and Heuristics
- [x] SRP: ledger.ts only reads and writes the ledger; gate.ts decides and
      then logs.
- [x] OCP: readLedger ignores unknown keys, so later stories add keys
      without changing the reader.
- [x] DIP: gate.ts imports ledgerPath and appendEntry directly. Accepted:
      the tests use a real temporary git repository, so nothing needs
      injecting.
- [x] Heuristics: no new smell found.

### Refactoring Smells (Fowler)
- Duplicated Code: found three copies of "read the ledger or fail the
  test" (gate.ledger.test.ts, cli.ledger.test.ts). Fixed in this audit:
  extracted `readRepoLedger` into src/test-helpers.ts.
- Nothing else named.

### Code Style
- [x] Functions 4 to 20 lines. Found one test body of 28 lines in
      cli.ledger.test.ts. Fixed in this audit: split into three tests.
- [x] Files under 300 lines (largest changed: gate.ts at 220).
- [x] Names specific. grep counts: appendEntry 13, readLedger 14,
      countsFor 11, ledgerPath 15, record 2, note 2, decide 2.
- [x] Early returns; no nested ternaries. (Correction to the earlier
      hand-off: the ternaries in `record` are not nested.)
- [x] Conditionals are positive.
- [x] Comments explain why (the header comments and the threat-model
      controls).

### Red Flags
- I considered skipping the Demeter and CONVENTIONS checks as obviously
  clean. I ran the greps for each, so none was skipped.
- I found my own `Write` had replaced the whole of
  specs/security/REVIEW.md. It was restored from HEAD, with the e06s03
  review appended as an addendum. The e05s04 review and the e06s02
  addendum are back.

## Findings fixed in this audit

1. Duplicated ledger-read helper in two test files (Fowler, DRY).
2. A 28-line test body (function length).
3. The spec's steps cited no ADR or commit (Provenance).
4. An `as` cast in the CLI test (type safety).
5. The lost review history in REVIEW.md (process error, not code).

## Verification after the fixes

- `npm run typecheck` and `tsc --noUnusedLocals --noUnusedParameters`: clean.
- `npm test`: 111 of 111 pass (110 plus the F2 mode test).
- `yamllint specs`, `validate-specs-yaml`, `check-gate-ignores`: OK.
- Mutation check: 4 of 8 gate-ledger tests fail when the append writes nothing.

## Verdict

VERDICT: PASS

The uncommitted fixes need a commit (`refactor(engine)` or `test(engine)`,
with a `Story: e06s03` trailer) before merge.
