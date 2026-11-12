# Audit (latest)

Story: e06s05
Branch: e06s05-one-shot-escape-hatch
Diff: git diff main...HEAD -- src specs (working tree was clean, so the
  branch diff stands in for "uncommitted changes"; the refactor below is
  uncommitted until this audit's commit)
Mode: default (full checklist)
Churn: bp-churn-rank.sh ranked spec and state files first. The code files
  were read in full, starting with src/override.ts and src/engine.ts.
Result: PASS with one accepted deviation (G29, below)

VERDICT: PASS

## What the audit found and fixed

The first pass failed these items. Each is fixed and the suite is green
(248 of 248, `npm run typecheck` clean).

1. **File length.** src/ledger.ts was 332 lines (limit 300; it was 295
   before this story). The state-line code moved to src/ledger-state.ts,
   and ledger.ts is now 256 lines. ledger.ts re-exports the moved names, so
   the callers did not change.
2. **Function length.** toState (29 lines), logState (26), overrideAnswer
   (25), parseOverride (24), readOverride (24) and takeOverride (24) were
   over the 20-line limit. Each is now split, and every changed function is
   20 lines or fewer.
3. **Duplication (G5).** messageOf and isMissing were copied into ledger.ts
   and override.ts. They are now in src/errors.ts. The kind check was
   written twice; it is now isKind in src/ledger-state.ts.
4. **Argument count (F1).** stateLine and logState took five arguments, and
   takeOverride took four. They now take one StateWrite object, and
   takeOverride takes (path, run, now).
5. **Names (N4).** `bad` is now `rejected`, and `keys` is now `recordKeys`.
   The override helper `isFingerprint` clashed with the ledger helper of the
   same name, with different meaning, so it is now `isTreeFingerprint`.
6. **Boy Scout.** A double blank line in ledger.ts was removed.
7. **A bug caught during the refactor.** Passing the whole record as the
   state-line extra would have written the record's fingerprint and reason
   into the line. Only kind and author are passed now. The AC-12 test
   compares the whole state line, so it would fail on that bug.

## Checklist

### Supply Chain & Security
- ✓ slopcheck: no new package (package.json unchanged)
- ✓ No `[SLOP]` package
- ✓ No secrets in the diff (sk-, ghp_, AKIA, PRIVATE KEY): grep clean
- ✓ OWASP spot-check: done by security-review (see specs/security/REVIEW.md,
  e06s05 addendum). No finding at 8 or above.
- ✓ No unaddressed HIGH finding

### Provenance & Metadata
- ✓ The story spec and tasks file carry type and context
- ✓ Steps cite the threat model (T3, T4) and the owner decisions of
  2026-11-12

### Law of Demeter
- ✓ No method chains through unrelated objects in the added code (grep)

### CONVENTIONS.md Compliance
- ✓ Output is in specs/ and specs/verifications/
- ✓ No `gh issue create`; no scripts changed in this story
- ✓ No direct GitHub REST call

### Scope
- ✓ Changes follow the stated scope. The ledger split was needed for the
  300-line rule and touches only the state-line code.
- ✓ No speculative feature
- ✓ No file outside the stated scope (state.yaml, execution-status,
  epic.yaml and the security review are the handoff and evidence files)
- ✓ No reproducible gate failure (Preflight 248 of 248)
- ✓ Boy Scout applied to ledger.ts

### Boy Scout Rule
- ✓ Every touched file is cleaner than before (see fixes 1 to 6)
- ✓ No dead code: `tsc --noUnusedLocals --noUnusedParameters` is clean
- ✓ No commented-out code

### Types and Safety
- ✓ No `any`
- ✓ No `@ts-ignore` or `eslint-disable`
- ✓ No `as unknown as`. The `state as State` cast in ledger-state.ts is
  older than this story and remains.

### Test Coverage
- ✓ Every new function has a test: parseOverride, readOverride, takeOverride
  (with isForRun), overrideCounts, overrideAnswer and takeRecord (engine
  tests), stateLine and logState (the AC-12 and AC-02 state-line tests),
  errors.ts (the ledger error-path and missing-file tests)
- ✓ Boundaries are tested: 64 KiB cap, 65537 bytes, 1000 and 1001 characters,
  63 and 64 hex characters, and a 201-character author
- ✓ Tests call public functions, not internals
- ✓ F.I.R.S.T: temporary repositories and directories; a FIFO test that
  cannot hang (2-second race)
- ✓ Not a bug fix, so no regression test was required

### SOLID and Heuristics
- ✓ SRP: each new module has one reason to change. ledger-state.ts holds
  the state-line shape, override.ts the record, errors.ts the error reading.
- ✓ OCP and DIP: the clock is injected (`now`) into takeOverride, so tests
  control it
- ✗→accepted **G29 (avoid negative conditionals).** The new guards use early
  returns such as `if (!isForRun(...)) return null`. The positive form
  would nest the rename and the state write. Early returns are the style of
  the existing validators (gate.ts, ledger.ts). The owner accepted this
  deviation on 2026-11-12.
- ✓ F1 (arguments): no function takes more than three now. takeOverride has
  three. classify was already three.
- ✓ F2 (output arguments) and F3 (flag arguments): none
- ✓ F4 (dead function): none
- ✓ G25 (magic numbers): the cap is named (overrideFileCap), and so are the
  reason and author limits
- ✓ G30 and G34 (one thing; stepdown): readOverride hands the open file to
  readRecord, and takeOverride calls readOverride
- ✓ G31 (temporal coupling): the order of the checks is explicit in the
  calls to classify and overrideAnswer
- ✓ C1 to C5: the header comments hold story tags and design rules, not
  history; no commented-out code
- ✓ N1, N4 and N7: the names say what they do (see fix 5)
- ✓ T1 and T5: boundaries as listed above
- ✓ T9: the suite runs in about 3 seconds

### Refactoring Smells (Fowler)
- Duplicated Code: fixed (fix 3)
- Long Function: fixed (fix 2)
- Primitive Obsession: none new (the extra object, OverrideFields, is a
  record of two fields)
- Data Clumps: `command` and `fingerprint` travel together as RunKey,
  and the record's own fields are in Override. Both are named types.
- Mysterious Name: fixed (fix 5)
- Feature Envy, Message Chains, Middle Man: none found

### Code Style (CONVENTIONS.md)
- ✓ Functions: 20 lines or fewer for every changed function
- ✓ Files: under 300 lines (ledger.ts 256, engine.ts 208, override.ts 173)
- ✓ Names: specific; no name has five or more definitions in src
- ✓ No duplication left in the changed code
- ✓ Early returns over nesting; no function nests more than two levels
- ✗→accepted Conditionals as positives (G29): see above
- ✓ Comments explain why (the threat-model references and the reasons for
  the cap and the silence rule)

### Red Flags (rationalizations caught)
- "The working tree is clean, so there is nothing to audit." That is not
  true of the story. The branch diff was reviewed against main instead, and
  this is recorded above.
- "The 300-line limit was already nearly reached, so the overage is not
  mine." It is mine: the story pushed the file from 295 to 332, so I fixed
  it rather than deferring it.
- "The ledger split is outside the story." The 300-line rule is part of the
  checklist, so the split is in scope.
- "G29 is style only." Recorded as a deviation for the owner to decide. It
  was not silently passed.

## Result

VERDICT: PASS. All items pass, except G29, which the owner accepted as a
documented deviation.

## Notes for the next skills

- **Evidence is now stale.** specs/verifications/e06s05-verify.yaml records
  the terminal verdict at df6c6ea, and the mutation checks used code that
  this refactor changed. The rename, the no-match path and the record-leak
  guard are still covered by the suite. The mutation patterns in the verify
  script no longer match the engine text (the `answer.state !== 'failed'`
  guard was rewritten), so re-run the mutation checks with new patterns and
  update the evidence file.
- request-review should see the 2 files that moved (ledger-state.ts,
  errors.ts) and the StateWrite change in engine.ts.
