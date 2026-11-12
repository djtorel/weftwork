---
type: audit-report
context: engine
story_id: e06s01
audited_at: "2026-11-12"
mode: default (full checklist)
scope: branch e06s01-gate-tracer against main 4975ebb. Story commits
  afcea3e (RED) and 5370002 (GREEN), then the NUL-byte fix
  (GAP-e06s01-01) in 495f252 (RED) and b69ecf0 (GREEN).
---

# Audit: e06s01 (run a declared command and answer with its verdict)

Gate result: **PASS** (re-run after the fix commits). The first run failed
on one item: the fix reference lacked a commit SHA. The fix is now in
495f252 (RED) and b69ecf0 (GREEN), cited in the evidence file. No code
defect was found.

## Mechanical checks

- Typecheck: pass (`npm run typecheck`).
- Tests: 33 of 33 pass.
- Secret patterns (`sk-`, `ghp_`, `AKIA`, `.env`) in the diff: none.
- `any`, `@ts-ignore`, `eslint-disable`, `as unknown as`: none.
- Commented-out code: none.
- File sizes: `gate.ts` 62 lines, `cli.ts` 51, tests under 120.
- Churn ranking (`bp-churn-rank.sh`): no history for these new files. All
  are reviewed in full.

## Checklist

### Supply Chain & Security

- ✓ slopcheck: not applicable, no new dependency (node built-ins only).
- ✓ No `[SLOP]` packages.
- ✓ No secrets in the diff.
- ✓ OWASP spot-check: via `security-review`, see below.
- ✓ Security: diff scanned, no finding at confidence 8 or above.
  Report: `specs/security/REVIEW.md`, section for e06s01. The one
  suppressed item (command injection by design, confidence 7) is
  explained there and re-opens at e07.

### Provenance & Metadata

- ✓ New plan artefacts carry `type:` and `context:`. Fixed in this
  audit: `specs/security/epics/e06/THREAT_MODEL.md` and
  `specs/verifications/e06s01-verify.yaml` now have both.
- ✓ Implementation steps reference a commit SHA where a decision was
  made. The NUL-byte decision (try/catch around spawn, GAP-e06s01-01) is
  cited with its commits, 495f252 (RED) and b69ecf0 (GREEN), in
  `specs/verifications/e06s01-verify.yaml`. First run: ✗, no SHA yet.

### Law of Demeter

- ✓ No chains through unrelated objects. `child.on(...)` acts on the
  local child; `parsed.request` is one level deep.

### CONVENTIONS.md Compliance

- ✓ Output files are in `specs/`.
- ✓ No `gh issue create` in the diff.
- ✓ No `gh` use in the diff.
- ✓ No GitHub REST call in the diff.

### Scope

- ✓ Changes are limited to the story and the gap it found.
- ✓ No speculative feature. The NUL-byte fix comes from the security scan
  of the story's own threat model (T7, C10).
- ✓ No files outside the stated scope. `state.yaml` changes are process
  metadata written by the flow skills.
- ✓ **Discovered defects:** Preflight is green, so there is no red gate
  to route.
- ✓ Boy Scout: the `cli.ts` exit-2 block was merged into one helper.

### Boy Scout Rule

- ✓ Every file touched is cleaner than before.
- ✓ No dead code. `notStarted` and `maxInputBytes` are both used.
- ✓ No commented-out code.

### Types and Safety

- ✓ No `any` introduced.
- ✓ No suppression comments.
- ✓ No `as unknown as` casts. The one cast, `data as Record<string,
  unknown>` in `parseRequest`, follows a type check on the same value.

### Test Coverage

- ✓ Every new function has a test. `readInput`, `print` and
  `failUnreadable` are covered through the real CLI in `cli.test.ts`,
  since they are process I/O.
- ✓ The bug fix has regression tests: the NUL-byte cases in
  `gate.test.ts` and `cli.test.ts`, written as RED first.
- ✓ Tests call the public interfaces: `runGate`, `parseRequest` and the
  CLI process.
- ✓ F.I.R.S.T, checked by hand. Each test runs on its own and cleans up
  its temp directories. **Not run:** `enforce-first` skill. One caveat:
  the `runGate` tests use `process.cwd()` as the repo root, so they
  assume `npm test` runs from the repo root. Everything here runs that way.

### SOLID and Heuristics

- ✓ Single Responsibility: `gate.ts` holds parsing and running. `cli.ts`
  only reads, calls and prints.
- ✓ Open/Closed: later stories add keys and states through new functions.
- ✓ Dependency Inversion: `runGate` spawns directly. No injection is needed
  at this size. Recorded as a deliberate choice, not a gap.
- ✓ Heuristics:
  - G29 (positive conditionals): the `cli.ts` check is now positive. Four
    negated guards remain in `gate.ts` (`typeof … !== 'object'`, etc.).
    They are early-return guards, which CONVENTIONS asks for, and they
    reject bad input. **Judgement call:** I kept them. The owner can
    override this.
  - G34 (stepdown): `cli.ts` reads top-down, one level per step.
  - G25 (magic numbers): the 1 MiB cap is a named constant. Exit codes 0,
    1 and 2 are the documented contract, not magic numbers.

### Refactoring Smells (Fowler)

- Duplicated Code: the exit-2 block appeared twice in `cli.ts`. Fixed with
  `failUnreadable`.
- Mysterious Name: none found.
- Feature Envy, Data Clumps, Primitive Obsession, Message Chains, Middle
  Man: none found.

### Code Style (CONVENTIONS.md)

- ✓ Functions: 12 to 19 lines (`parseRequest` is the longest).
- ✓ Stepdown: one level of abstraction per function.
- ✓ Files: under 300 lines.
- ✓ Names: each is unique in its definition. **Reading of the rule:**
  the grep counts call sites and tests too, so `runGate` gives 13 hits.
  Only one definition exists for each name. The rule's wording
  ("< 5 hits") would fail any function that is used. **Flag to the owner:**
  the rule should count definitions, not uses.
- ✓ No duplication left in the story's code.
- ✓ Early returns over nesting, two levels at most in `cli.ts`.
- See G29 above for the one negated-conditional exception.
- ✓ Comments explain WHY: the NUL comment in `gate.ts`, the "command is
  code" note in `cli.ts`.

### Red Flags (rationalizations caught while auditing)

- I was tempted to pass the `< 5 hits` name rule without checking
  definitions. I checked, and the reading is stated above.
- I was tempted to skip the security-review item on the grounds that the
  threat model had already covered it. The hard gate says to run the
  review, so I ran it.
- I was tempted to pass the G29 negations silently. I named them instead.

## Verdict

`--gate` exit: 0. Every section passes. Summary:

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

Next: `commit-message`, then `release-branch`.
