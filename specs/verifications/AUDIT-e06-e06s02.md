---
type: audit-report
context: engine
story_id: e06s02
audited_at: "2026-11-12"
mode: default (full checklist)
scope: branch e06s02-fail-closed-tree against main 1fb4c2d. Story commits
  75fdc9f (plan), ab95435 and 9de1669 (tree), 8be7f00 and 9a4cf3d (gate),
  e16d76d and b8a316e (fixtures), 8bc267d and e30d3b4 (docs), plus the
  audit fixes in the working tree (uncommitted, see Verdict).
---

# Audit: e06s02 (fail closed, and name the tree each verdict ran on)

Gate result: **PASS** on the working tree. The audit found real issues in the
first pass and they are fixed in the working tree (see "Fixed during this
audit"). They are not committed yet: the owner's go-ahead is needed first.

## Mechanical checks

- Typecheck: pass. Tests: 73 of 73 pass. Preflight: green.
- Secret patterns in the diff: one grep hit, `process.env` in
  `src/test-helpers.ts`, matched by the `\.env` pattern. False positive: it
  reads the environment, it holds no value.
- `any`, `@ts-ignore`, `eslint-disable`, `as unknown as`: none. Casts in
  `tree.ts`, `gate.ts`, `cli.ts`: none after the fixes (two removed).
- Commented-out code: none.
- File sizes: largest is `gate.test.ts` at 214 lines. Churn ranking has no
  history for `src/`; every file is reviewed in full.
- Mutation checks: six scratch-copy breaks of `gate.ts` and `tree.ts` run
  after the refactor; each was caught by the intended tests.

## Fixed during this audit

1. Style: `parseRequest` was 21 lines and `runCommand` 24 (the limit is 20).
   Split `runCommand` into `runCommand` and `watchChild`, and shortened
   `parseRequest` with a `bad` helper and a `timeout` spread.
2. Clarity: `runGate` ended in a nested ternary on 118 characters with a
   negated condition. Split into `runAndCompare` and `settle`, with positive
   conditions. Three lines over 100 characters are now wrapped.
3. Types: two `as` casts removed (`isRecord` type guard in `gate.ts`, an
   `instanceof Error` check in `tree.ts`).
4. Primitive Obsession: `kind` in `tree.ts` was a bare `string`; it is now a
   union type, `Kind`. `describeStats` is one `async` function and no longer
   mixes `.then` with `async`.
5. Test reliability: AC-08 gave the shell 300 ms to write its pid file. On a
   slow runner the file could be missing and the test would fail for the
   wrong reason. Raised to 1000 ms, with a comment.

## Checklist

### Supply Chain & Security

- ✓ slopcheck: not applicable, no new dependency (node built-ins and git).
- ✓ No `[SLOP]` packages.
- ✓ No secrets in the diff (see the false positive above).
- ✓ OWASP spot-check: via `security-review`, see the next item.
- ✓ Security: diff scanned, no finding at confidence 8 or above. Report:
  `specs/security/REVIEW.md`, section for e06s02, with two probes. One MEDIUM
  residual, documented: a command that starts its own session (`setsid`)
  leaves the process group and the kill does not reach it. Recorded in the
  spec (Requirements and Risks) and the threat model (T6).

### Provenance & Metadata

- ✓ New plan artefacts carry `type:` and `context:`: the spec, the tasks
  file and `e06s02-verify.yaml`.
- ✓ Decisions reference a commit SHA. The six owner decisions: plan commit
  75fdc9f. GAP-e06s02-01 (the `setsid` limit, documented): e30d3b4.
  GAP-e06s02-02 (the AC-07 test change): 8be7f00.

### Law of Demeter

- ✓ No chains through unrelated objects. `child.pid` and `after.fingerprint`
  are one level deep.

### CONVENTIONS.md Compliance

- ✓ Output files are in `specs/`.
- ✓ No `gh issue create` in the diff.
- ✓ No `gh` use in the diff.
- ✓ No GitHub REST call in the diff.

### Scope

- ✓ Changes are limited to the story. `src/test-helpers.ts` is shared by four
  test files; the e06s01 test edits are the MODIFIED requirement.
- ✓ No speculative feature.
- ✓ No files outside the stated scope. `AGENTS.md` gets one line naming
  `tree.ts`.
- ✓ **Discovered defects:** Preflight is green, so there is no red gate to
  route.
- ✓ Boy Scout: the e06s01 test for stdout was adjusted, and the AC-08 flake
  risk was removed.

### Boy Scout Rule

- ✓ Every file touched is cleaner than before.
- ✓ No dead code.
- ✓ No commented-out code.

### Types and Safety

- ✓ No `any`, no suppressions, no casts.

### Test Coverage

- ✓ Every new function has a test: `fingerprintTree` (19 tests), `runGate`
  and `parseRequest` (gate tests), the helpers through use.
- ✓ The fixes in this audit need no new test: they keep behaviour, and the
  existing 73 tests plus six mutation runs prove it.
- ✓ Tests use the public interfaces (`fingerprintTree`, `runGate`,
  `parseRequest`, the CLI process).
- ✓ F.I.R.S.T, checked by hand: about 1.5 s for 73 tests; each test uses its
  own temporary repository, removed by `after`. Repeatable on a machine with
  git; the zombie check reads `/proc` only when it exists. **Not run:** the
  `enforce-first` skill.

### SOLID and Heuristics

- ✓ Single Responsibility: `tree.ts` fingerprints and nothing else; `gate.ts`
  parses, runs and names the verdict, in small functions.
- ✓ Open/Closed: a new reason is one union member and one branch.
- ✓ Dependency Inversion: `runGate` imports `spawn` and `fingerprintTree`
  directly. Tests use real temporary repositories, so no injection is
  needed. Recorded as a deliberate choice.
- ✓ Heuristics:
  - G29 (positive conditionals): `runGate`, `settle` and the CLI are
    positive. The guards in `parseRequest` and `isRecord` reject bad input
    as early returns, as CONVENTIONS asks. **Judgement call**, as in e06s01;
    the owner can override.
  - G34 (stepdown): `runGate` calls `runAndCompare`, which calls
    `runCommand` and `settle`.
  - G25 (magic numbers): the timeout limit and the listing cap are named;
    `0o111` is the POSIX execute bits and is commented by the `file-x` name.
  - G31 (temporal coupling): the order fingerprint, run, fingerprint is
    explicit in `runAndCompare`.

### Refactoring Smells (Fowler)

- Primitive Obsession: `kind` as `string`. Fixed with the `Kind` union.
- Long Function: `parseRequest` and `runCommand` over 20 lines. Fixed.
- Duplicated Code: AC-08 and AC-09 share three lines of setup. Left: a
  helper would hide what each test proves.
- Mysterious Name, Feature Envy, Data Clumps, Message Chains, Middle Man:
  none found.

### Code Style (CONVENTIONS.md)

- ✓ Functions: 3 to 18 lines.
- ✓ Stepdown: one level per function.
- ✓ Files: under 300 lines.
- ✓ Names: each has one definition. **Reading of the rule:** the "under 5
  hits" count includes call sites, so `runGate` (20) and `makeTestRepo` (26)
  exceed it. As in e06s01, I read it as definitions. **Flag to the owner:**
  the rule's wording should say so.
- ✓ No duplication left in production code.
- ✓ Early returns over nesting; two levels at most.
- ✓ Comments explain WHY.

### Red Flags (rationalizations caught while auditing)

- I was tempted to leave the two long functions because the tests pass. The
  limit is in the checklist, so I split them.
- I was tempted to call the `\.env` grep hit a real finding, then to ignore
  it. I read the line: it is `process.env`.
- I was tempted to skip a re-run of the mutations after refactoring. The
  anchors had changed, so I re-ran all six.
- I was tempted to commit the audit fixes along with the report. CONVENTIONS
  needs the owner's go-ahead first.

## Verdict

`--gate` exit: 0 on the working tree. Summary:

- PASS Supply Chain
- PASS Provenance
- PASS Law of Demeter
- PASS CONVENTIONS.md Compliance
- PASS Scope
- PASS Boy Scout Rule
- PASS Types and Safety
- PASS Test Coverage
- PASS SOLID and Heuristics
- PASS Refactoring Smells
- PASS Code Style
- PASS Red Flags

Next: commit the audit fixes (owner's go-ahead), then `commit-message`, then
`release-branch`.
