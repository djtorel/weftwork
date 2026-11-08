# R14 — pi-flow-legacy retrospective

Research story R14, wave 1. Hypotheses H4 and H6.
Question: what worked, what was ceremony, which gates caught real
failures, why the project was archived.

Method: read the nine inputs named in `specs/planning-context.yaml` in
read-only mode, then check each claim against the ledger and the tree
where a file can show it. "Published" for a legacy file is the date of
its last commit in `../pi-flow-legacy` (git, not file mtime).

## Sources

- [S1] pi-flow-legacy DECISIONS.md, `../pi-flow-legacy/specs/DECISIONS.md` (D001–D193) - accessed: 2026-11-07 published: 2026-10-25
- [S2] pi-flow-legacy OPEN-QUESTIONS.md, `../pi-flow-legacy/specs/OPEN-QUESTIONS.md` - accessed: 2026-11-07 published: 2026-10-21
- [S3] pi-flow-legacy VERIFICATION.md, `../pi-flow-legacy/specs/VERIFICATION.md` (1298 lines; read §E07 l.880–1006 and §E08 l.1007–1298) - accessed: 2026-11-07 published: 2026-10-25
- [S4] pi-flow-legacy SPEC-01-stack-profile.md, `../pi-flow-legacy/specs/SPEC-01-stack-profile.md` (header and problem only) - accessed: 2026-11-07 published: 2026-10-18
- [S5] pi-flow-legacy SPEC-02-evidence-gates.md, `../pi-flow-legacy/specs/SPEC-02-evidence-gates.md` (§2, §4.1, §6) - accessed: 2026-11-07 published: 2026-10-18
- [S6] pi-flow-legacy SPEC-03-delegation.md, `../pi-flow-legacy/specs/SPEC-03-delegation.md` (§1 claim) - accessed: 2026-11-07 published: 2026-10-18
- [S7] pi-flow-legacy SPEC-04-context-ledger.md, `../pi-flow-legacy/specs/SPEC-04-context-ledger.md` (§1 claim) - accessed: 2026-11-07 published: 2026-10-22
- [S8] pi-flow-legacy spikes, `../pi-flow-legacy/specs/spikes/SPIKE-child-extension-injection.md` and `agent-spike-fg.md` - accessed: 2026-11-07 published: 2026-10-18
- [S9] pi-flow-legacy spikes, `../pi-flow-legacy/specs/spikes/SPIKE-q19-nested-usage.md` - accessed: 2026-11-07 published: 2026-10-21
- [S10] pi-flow-legacy event ledger, `../pi-flow-legacy/.flow/ledger.yaml` (counted by `kind:`; excludes 4 events dated 2026-11-08 written by the live guard about weftwork files) - accessed: 2026-11-07 published: 2026-10-25
- [S11] pi-flow-legacy STATE.md, `../pi-flow-legacy/specs/STATE.md` (resume point, not on the planning-context list; read for why-archived and review-finding counts) - accessed: 2026-11-07 published: 2026-10-25
- [S12] Huang et al., "Large Language Models Cannot Self-Correct Reasoning Yet", ICLR 2024, arXiv:2310.01798, https://arxiv.org/abs/2310.01798 - accessed: 2026-11-07 published: 2023-10-03
- [S14] Owner statement (dom), given in session; not a file - accessed: 2026-11-07 published: 2026-11-07
- [S13] Wang, Pradel, Liu, "Are 'Solved Issues' in SWE-bench Really Solved Correctly?", ICSE 2026, arXiv:2503.15223, https://arxiv.org/abs/2503.15223 - accessed: 2026-11-07 published: 2025-03-19

## Gate review

Scope: the five tier-2 rules, the evidence and phase gates, the
bounded repair loop, the review verdict gate, the child guard and gate
retirement ([S1] D019–D024, [S3] §E07, [S5]).

Window caveat: the guard landed on 2026-10-24 ([S3] §E07) and the
ledger ends 2026-10-26 ([S10]). Every "never-fired" below is a claim
about about two days in one repo, with one owner. It is also weak
evidence by design: tier 2 arms only in a repo with `.flow/` and an
open story ([S1] D028, D034).

Live ledger counts ([S10]): 204 `command`, 76 `source_edit`, 8
`ctx_sample`, 4 `child_run`, 1 `guard_block`, 0 `guard_override`.

| ID | Gate | Outcome | Evidence |
| -- | ---- | ------- | -------- |
| G1 | `irreversible_git` (tier 2) | never-fired | no `guard_block` with this rule in [S10]; fixtures only ([S3] S07.2) |
| G2 | `irreversible_fs` (tier 2) | never-fired | same |
| G3 | `model_load` (tier 2) | never-fired | shipped disabled ([S1] D028, [S3] S07.3); dark by design |
| G4 | `publish` (tier 2) | never-fired | no event in [S10] |
| G5 | `unevidenced_done` | caught | one `guard_block`, story S08.5, 2026-10-25T01:00:56Z: the last passing run (00:47:46Z) came before the last edit (00:48:38Z) ([S10]); this is the stale-evidence failure the rule exists for |
| G6 | bounded repair, max 2 attempts (D024) | never-fired | no repair event in [S10] (two `repair` hits are test-file commands); fixtures only ([S3] S07.7) |
| G7 | tier-3 phase gates (`deep` dial) | never-fired | "no session has yet run the `deep` dial" ([S3] §E07 "Not verified") |
| G8 | typed review verdict gate (S08.5) | never-fired | the one live reviewer child hit its 900000 ms deadline; no verdict was ever recorded ([S3] §E08 round three) |
| G9 | guard injected into children | never-fired | guard reached a live child (digest match) but the child never completed, so no block was observable ([S3] §E08; [S8] proves injection on a hand-written agent) |
| G10 | retirement after 3 overrides, 0 catches (D023) | never-fired | zero `guard_override` events ([S10]); the loop is built and unit-tested ([S3] S07.6) but nothing has ever flowed through it |

Overridden: none. Every gate that fired once was not overridden.

Findings behind the table:

- The only live catch is a status-claim gate (G5), not a tool-call
  gate. That matches the project's own reframe: gate "irreversible
  actions and status claims", not process steps ([S1] D019).
- The rest of the enforcement surface (G1–G4, G6–G10) is verified by
  fixtures and by removing each control and re-running tests ([S3]
  mutation tables). That proves the code does what it says. It does not
  prove the gates earn their keep.
- Enforcement limits were known at design time: `denyExtensions`
  silences the guard; foreground children share process state; external
  CLI profiles are opaque; a child that calls no tool cannot be hooked
  ([S5] §4.1). The spike measured that a project-level setting injects
  the guard into children that declare nothing ([S8]).
- The same ledger shows accounting limits the owner accepted:
  repo-writable `.flow/` can be forged; accounting is "a claim about
  the harness, not a measurement of it" ([S11] limits table).
- Delegation, the half most tied to enforcement, never completed a
  live run: four delegated reviews across E09 and E07 returned nothing
  usable (three timeouts, one unknown-provider rejection), and the
  third live check timed out ([S3] §E07, §E08). Each reviewer costs
  about 95K input tokens ([S3] round three).

## Why archived

Owner's reason [S14]: the project was started with local LLMs; the
owner then had better ideas for the approach and more they wanted, so
they chose to start fresh. It was not dropped because the gates failed.
The repo itself records no reason (no archive note, no deprecation
text, no mention of weftwork), so [S14] is the only source.

State at the last commit (2026-10-25, [S11]), for context:

- E01-E07 and E09 landed; E08 (delegation) core landed with six
  stories open: fan-out, worktree isolation, model routing, workflow
  lint, external-runner refusal, dispatch.
- 682 tests green, 193 decisions, 104 review findings recorded.
- One proof outstanding: a live delegated child that completes.

Consequence: the gate review above is not a verdict that enforcement
failed. It shows enforcement was mostly unexercised when work stopped.
The local-model origin also matters: slow children and tight context
(timeouts, 95K-input reviewers) may be partly a local-model effect.

## Verdicts

- H4: refined — the escape hatch (`/flow allow`, one-shot) and retirement rule (3 overrides, 0 catches) were designed and unit-tested, but the live ledger holds 0 overrides and 1 catch, so "overridden gates retired" is untested, and the project itself built five rules from gap analysis rather than from an observed failure, against its own D021; keep the escape hatch and the log, drop the idea that retirement can be validated from one repo [S1][S3][S10]
- H6: refined — the order held loosely (profile, ledger and research stages landed before the guard) but the end-to-end loop never ran: no session took a story from profiled to shipped under the `deep` dial, and a live delegated child never completed, so enforcement (E07) was verified against fixtures with no workflow to enforce; the cost shows in 104 review findings, mostly in guard and ledger plumbing [S3][S11]
- Supporting, not assigned: intrinsic self-correction without external feedback is unreliable, which backs gating "done" on an observed command rather than an agent's claim [S12]; passing a test suite is weak evidence of a correct patch (7.8% of SWE-bench Verified patches counted correct while failing the developer tests), so the gate must pick commands carefully [S13]

## Implications for weftwork

1. Keep exactly one gate at first: evidence freshness ("a passing run
   of a declared command after the last edit"). It is the only gate with
   a live catch ([S10]), and it matches the literature on external
   feedback over self-report ([S12]).
2. Ship the one-shot override and the event log with that gate, so
   evidence on overrides accumulates. Do not build retirement logic
   until there are overrides to count.
3. Run the workflow loop end to end before adding enforcement. The
   legacy project could not say whether any gate helped because no
   full cycle existed to measure against.
4. Treat delegation as unproven. Budget for reviewer children that time
   out, and do not make a gate depend on a child returning ([S3]).
5. Test-pass evidence needs a check on what the command proves
   (decorative commands, [S11] finding 62; plausible-but-wrong patches,
   [S13]).
6. The ledger idea is cheap and useful (counts of `command`,
   `guard_block`, `guard_override`). The rotation and archive-chain
   machinery (D132–D147, [S1]) cost many decisions for a file that
   reached 299 lines.

## Earns its place vs ceremony

| Item | Verdict | Reason |
| ---- | ------- | ------ |
| `unevidenced_done` freshness gate | earns its place | one real catch in two days [S10] |
| one-shot `/flow allow` plus override event | earns its place | cheap; needed to measure any gate [S1] D023 |
| append-only event ledger (basic) | earns its place | the only source of the numbers in this brief [S10] |
| dial micro/standard/deep | ceremony until measured | no `deep` session ever ran [S3] |
| tier-2 command rules G1–G4 | ceremony until measured | zero fires, one guarded repo [S10] |
| retirement after 3 overrides | ceremony | zero overrides to count [S10] |
| ledger rotation and archive chain | ceremony | 193 decisions, 299-line ledger [S1][S10] |
| bounded repair loop | unproven | fixtures only [S3] |
| typed review verdict gate | unproven | never read back from a live child [S3] |
| child guard injection | earns its place as a mechanism | spike measured it works without restart [S8]; live use unproven |
| design-by-spec before first live use | ceremony | SPEC-01..04 and 193 decisions preceded one live delegated run [S4][S6][S11] |

## Open questions

- How much of the delegation trouble (timeouts, cost per reviewer)
  came from running on local models rather than from the design? [S14]
  only says the project began on local LLMs. Relevant to R13 and R5.
- Did any real, non-fixture override ever happen outside this repo?
  The ledger covers one repo and about two days of guard use.
- Which of G1–G4 would have fired over a longer window? Needs a
  second repo or a longer log.
- Do plausible-but-wrong passes ([S13]) show up in agent-written
  verify commands? Candidate story for R13 or R9.
- Candidate new story: a measured study of how often an agent's
  "done" claim is stale against its own last edit, using the legacy
  ledger as a first data set.
