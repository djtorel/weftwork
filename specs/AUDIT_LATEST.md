# Audit (latest)

Story: e06s02 (fail closed, and name the tree each verdict ran on)

VERDICT: PASS

Audit of story e06s02 on 2026-11-12. The first pass found two functions over
20 lines, a nested ternary, two casts, a bare-string kind and a test timing
risk. All are fixed and re-verified (73 tests, six mutation runs). The
security review found no HIGH finding and one documented MEDIUM residual
(a command that starts its own session leaves the process group). Judgement
calls named in the report: the guard negations in gate.ts (G29) and the
reading of the name-uniqueness rule.
Full report: specs/verifications/AUDIT-e06-e06s02.md
