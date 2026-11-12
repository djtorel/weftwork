# e06s03 — Log every verdict in a plain-file counts ledger

**type:** feat
**risk:** P1
**context:** engine
**bcps:** 3
**epic:** e06 (Engine core and done gate, B1)
**research story:** none (B1 rests on R13, R14 and R15 through
docs/research/SYNTHESIS.md)
**branch:** e06s03-counts-ledger

## 1. Purpose

Each verdict from e06s02 is lost when the process ends. The breaker in
e06s04 needs the failures in a row for one command, and the escape hatch
in e06s05 needs counts, so something must remember. This story logs every
verdict in a plain file that only the engine writes, and reads it back as
counts. It is a log, not a source of truth: the gate never takes `done`
from it (threat model C4).

- One line per verdict, written by `runGate` for every verdict it gives.
- Counts per command: runs, passes, failures, the failures in a row since
  the last pass, and whether the last done still matches the tree.
- A ledger that cannot be written never turns into a false done.

Owner decisions (2026-11-12, plan-work, "approve" to the five
recommendations):

1. The ledger lives at `<git dir>/weftwork/ledger.jsonl`, with the git
   dir from `git rev-parse --absolute-git-dir`. git never lists files
   inside the git dir, so a write never changes the tree fingerprint, and
   a linked worktree gets its own ledger.
2. It is neither committed nor part of the tree. It is a plain file the
   agent can still edit (see Risks); it is not tamper proof.
3. One `JSON.stringify` object per line (threat model C3), no version
   field. The reader ignores keys it does not know, so e06s04 and e06s05
   can add keys.
4. Counts are plain history per command. A separate `fresh` flag says
   whether the last entry is a done that matches the current tree.
5. A `passed` verdict that cannot be logged becomes not done with the new
   reason `no-ledger`. A verdict that is already not done is kept as it is,
   with a note on stderr.

Reason for Depth: one new module, `src/ledger.ts`, with one job: write
and read the ledger file. `gate.ts` calls it once per run, and e06s04 and
e06s05 call it for counts, so the format lives in one place. No other new
abstraction.

## 2. Zoom-out

The story adds one module and changes one.

- **Purpose of `src/gate.ts`:** run a declared command and say whether it
  is done (e06s01, e06s02). `src/cli.ts` is the thin shell around it.
- **Callers:** `src/cli.ts` calls `parseRequest` and `runGate`; the test
  files call them. Nothing else imports `gate.ts`.
- **Contracts that must hold:** `runGate` resolves and never rejects.
  `done` is true only with reason `passed`, which needs exit code 0 and an
  unchanged tree. stdout holds exactly one JSON line. The ledger write
  never changes the tree fingerprint and never changes stdout.
- **What breaks on purpose:** `Reason` gains `no-ledger`. A tree whose git
  dir cannot take a write, which was done before, is now not done.

Blast radius (inline, in place of a separate `assess-impact` run): new
files `src/ledger.ts`, `src/ledger.test.ts`, `src/gate.ledger.test.ts` and
`src/cli.ledger.test.ts`; changed files `src/gate.ts` (one call and one
`Reason` value) and `src/cli.ts` (comment only). No change to
`package.json`, `tsconfig.json`, CI, `.gitignore` or AGENTS.md. Every
existing test runs in a temporary git repository, so each now also writes
a ledger inside that repository's git dir, and `cleanupTempDirs` removes it.

## 3. Requirements

#### ADDED: ledger file and path, `ledgerPath(cwd)` in `src/ledger.ts`
- Takes a directory and returns `Promise<string | null>`: the path
  `<absolute git dir>/weftwork/ledger.jsonl`, or `null` when `cwd` is not
  inside a git working tree, does not exist, holds a NUL byte, or git is
  missing. It never throws.
- Runs `git -c core.fsmonitor=false rev-parse --absolute-git-dir` by
  `execFile` with an argument array and no shell (threat model C5). git
  2.56.1 docs: `--absolute-git-dir` is "like `--git-dir`, but its output is
  always the canonicalized absolute path" (ctx7 `/git/git/v2.56.1`,
  git-rev-parse.adoc, accessed 2026-11-12). In a linked worktree the path
  is that worktree's own git dir.

#### ADDED: `appendEntry(path, verdict, at)` in `src/ledger.ts`
- Takes the ledger path, a `Verdict` and a time, and returns
  `Promise<{ ok: true } | { ok: false; error: string }>`. It never throws.
- Creates the directory (`mkdir` with `recursive`), then appends with one
  write of `"\n" + JSON.stringify(entry) + "\n"`, where `entry` is
  `{ at, done, exitCode, reason, command, fingerprint }` and `at` is
  `at.toISOString()`. The leading newline ends any torn line left by a
  crashed writer, so the new entry always starts on its own line. Blank
  lines are not entries and are not counted as skipped (C3).
- `JSON.stringify` escapes a newline in `command`, so a command cannot
  start a second entry.

#### ADDED: `readLedger(path)` in `src/ledger.ts`
- Returns `Promise<LedgerRead>`, where `LedgerRead` is
  `{ ok: true; entries: LedgerEntry[]; skipped: number }` or
  `{ ok: false; error: string }`. It never throws.
- A path that does not exist is `ok` with no entries. Any other read
  error is `ok: false`.
- Each non-blank line is one entry only if it parses as a JSON object with
  `at` (string), `done` (boolean), `exitCode` (integer or null), `reason`
  (string), `command` (string) and `fingerprint` (string or null). Any other
  line, including a torn last line, is skipped and counted in `skipped`.
  Other keys are ignored.

#### ADDED: `countsFor(entries, command, fingerprint)` in `src/ledger.ts`
- Pure. Takes the entries, one command and the current tree fingerprint,
  and returns `{ runs, passes, failures, failStreak, fresh }`, over the
  entries whose `command` equals the given string exactly:
  - `runs`: how many; `passes`: how many with `done` true; `failures`: how
    many with `done` false;
  - `failStreak`: the not-done entries after the last done one (all of
    them when there is none);
  - `fresh`: true only when the last entry is done and its `fingerprint`
    equals the given one. A done entry whose fingerprint differs is stale:
    it still counts in `passes` and never makes `fresh` true.
- Counts never feed the gate's own verdict (C4). `fresh` is information for
  later stories.

#### MODIFIED: `Reason` in `src/gate.ts`
**Before:** `passed`, `exit-nonzero`, `not-started`, `signal`, `timeout`,
`no-tree`, `tree-changed`.
**After:** the same, plus `no-ledger`: the command passed and the tree was
unchanged, but the verdict could not be written to the ledger.

#### MODIFIED: `runGate(request)` in `src/gate.ts`
**Before:** resolves with the verdict and keeps no record of it.
**After:** after the verdict is settled, appends one entry for it to the
ledger of `request.cwd`, for every reason, done or not.
- Append failed, verdict `passed`: the verdict becomes `done` false, reason
  `no-ledger`, exit code and fingerprint kept (as `tree-changed` keeps
  its own).
- Append failed, verdict not `passed`: the verdict is kept, and the engine
  writes one line about it to stderr.
- No ledger path (no git working tree): there is nothing to write to. The
  engine writes one line to stderr and treats it as a failed append, so a
  `passed` verdict is `no-ledger` (in practice `no-tree` comes first).
- The write comes after the second fingerprint. It is inside the git dir,
  so it does not change what the first fingerprint measured.
- The gate never reads the ledger. Resolves, never rejects.

#### MODIFIED: the CLI header in `src/cli.ts`
**Before:** the comment lists the JSON fields.
**After:** the comment also says the ledger holds each verdict's command
string, so a secret in a declared command is stored on disk (threat model
T8). No change to the JSON line, to the exit codes or to stdout.

## 17. Acceptance criteria (Gherkin)

These IDs are local to this story. Ledger scenarios run in
`src/ledger.test.ts`, gate scenarios in `src/gate.ledger.test.ts` and
process scenarios in `src/cli.ledger.test.ts`. Every scenario runs in a
temporary git repository, never in the real one.

```gherkin
Scenario Outline: AC-e06s03-01 where the ledger path is
  When ledgerPath reads <place>
  Then the result is <result>

  Examples:
    | place                                  | result                           |
    | the root of a repository               | <git dir>/weftwork/ledger.jsonl  |
    | a subdirectory of a repository         | the same path as the root        |
    | a linked worktree                      | that worktree's own path         |
    | a directory that is not in a git repo  | null, no throw                   |
    | a directory that does not exist        | null, no throw                   |
    | a path with a NUL byte                 | null, no throw                   |

Scenario: AC-e06s03-02 the ledger does not change the fingerprint
  Given a temporary git repository
  When appendEntry writes an entry
  Then fingerprintTree gives the same fingerprint as before

Scenario: AC-e06s03-03 an entry is written and read back
  Given a ledger path in a temporary git repository
  When appendEntry writes two verdicts
  Then readLedger is ok with two entries in order
  And each holds at, done, exitCode, reason, command and fingerprint
  And skipped is 0

Scenario: AC-e06s03-04 a command with a newline is one entry
  When appendEntry writes a verdict whose command holds "\n" and a
    fake entry as text
  Then the file has one non-blank line for it
  And readLedger returns one entry whose command is that exact string

Scenario Outline: AC-e06s03-05 the reader skips what it cannot use
  Given a ledger file that holds one good entry and <bad>
  When readLedger reads it
  Then it is ok, has the good entry and skipped is <skipped>

  Examples:
    | bad                                              | skipped |
    | a torn last line with no newline                 | 1       |
    | a line that is not JSON                          | 1       |
    | a JSON array                                     | 1       |
    | an object with done as the string "true"         | 1       |
    | an object with no command                        | 1       |
    | a blank line                                     | 0       |
    | an object with one extra key                     | 0       |

Scenario: AC-e06s03-06 a torn line does not spoil the next entry
  Given a ledger file that ends in a torn line with no newline
  When appendEntry writes a verdict
  Then readLedger has the new entry intact and skipped is 1

Scenario Outline: AC-e06s03-07 reading when there is no ledger
  When readLedger reads <path>
  Then the result is <result>

  Examples:
    | path                                   | result                      |
    | a path that does not exist             | ok, no entries, skipped 0   |
    | a path that is a directory             | not ok, no throw            |

Scenario Outline: AC-e06s03-08 the counts
  Given entries for command "a" and one entry for command "b", every
    entry at the fingerprint F unless a row names another
  When countsFor reads them for "a" and the current fingerprint F
  Then the counts are <runs> runs, <passes> passes, <failures> failures,
    a streak of <streak> and fresh <fresh>

  Examples:
    | entries for "a", oldest first          | runs | passes | failures | streak | fresh |
    | none                                   | 0    | 0      | 0        | 0      | false |
    | fail                                   | 1    | 0      | 1        | 1      | false |
    | fail, fail, pass                       | 3    | 1      | 2        | 0      | true  |
    | pass, fail, fail                       | 3    | 1      | 2        | 2      | false |
    | pass at F, fail, pass at G             | 3    | 2      | 1        | 0      | false |

Scenario: AC-e06s03-09 the gate logs every verdict
  Given a temporary git repository
  When runGate runs "true", "false" and "sleep 30" with timeoutMs 300
  Then the ledger holds three entries whose reasons are passed,
    exit-nonzero and timeout, and whose commands and fingerprints equal
    those of the verdicts

Scenario: AC-e06s03-10 a verdict with no tree is not logged
  When runGate runs "true" in a directory that is not a git repository
  Then the verdict is not done with reason "no-tree"
  And stderr holds one line about the ledger

Scenario: AC-e06s03-11 a ledger that cannot be written
  Given a temporary git repository where "<git dir>/weftwork" is a file
  When runGate runs <case>
  Then the verdict is <done> with reason "<reason>" and exit code <code>
  And stderr holds a line about the ledger

  Examples:
    | case                          | done     | reason       | code |
    | "true"                        | not done | no-ledger    | 0    |
    | "false"                       | not done | exit-nonzero | 1    |

Scenario: AC-e06s03-12 the gate never reads done from the ledger
  Given a ledger that holds a forged done entry for "false" at the
    current fingerprint
  When runGate runs "false"
  Then the verdict is not done with reason "exit-nonzero"

Scenario: AC-e06s03-13 a stale done does not count as fresh
  Given a ledger with a done entry for "true"
  When a tracked file is edited and countsFor reads it with the new
    fingerprint
  Then passes is 1 and fresh is false

Scenario: AC-e06s03-14 the real CLI logs each run
  Given a temporary git repository as the cwd
  When the real CLI runs {"command":"true"} then {"command":"exit 7"}
  Then the exits are 0 and 1 and stdout of each is one JSON line
  And readLedger holds two entries
  And countsFor gives 2 runs, 1 pass, 1 failure, a streak of 1, fresh false
  And the repository's git status shows no change

Scenario: AC-e06s03-15 the e06s01 and e06s02 scenarios still hold
  Then their tests pass unchanged
  And Preflight passes
```

## Steps

1. RED: write `src/ledger.test.ts` for AC-01 to AC-08 and record the
   failure, since `src/ledger.ts` does not exist. GREEN: write
   `ledgerPath`, `appendEntry`, `readLedger` and `countsFor`
   → verify: `node --test src/ledger.test.ts && npm run typecheck && ! grep -nE 'shell:|execSync|[^a-zA-Z]exec\(' src/ledger.ts && grep -q 'JSON.stringify' src/ledger.ts`
2. RED: write `src/gate.ledger.test.ts` for AC-09 to AC-13 and record the
   failures. GREEN: add `no-ledger` to `Reason` and the append to `runGate`;
   update the `cli.ts` comment
   → verify: `node --test src/gate.ledger.test.ts src/gate.test.ts && npm run typecheck && grep -q "'no-ledger'" src/gate.ts`
3. Write `src/cli.ledger.test.ts` for AC-14: the real CLI, run twice in a
   temporary git repository
   → verify: `node --test src/cli.ledger.test.ts`
4. Run the Preflight line from AGENTS.md and `security-review` on the diff
   (AC-15)
   → verify: `yamllint specs && bash tools/validate-specs-yaml.sh && bash tools/check-gate-ignores.sh && npm run typecheck && npm test`

## 4. Dependencies (slopcheck)

- `node:child_process` (`execFile`), `node:fs/promises` (`mkdir`,
  `appendFile`, `readFile`), `node:util` (`promisify`), `node:path`: built
  into Node 26. `[OK]`.
- The `git` program on the PATH, as in e06s02. Not a package.
- No new npm package.

## 5. Out of scope

- The terminal states, their exit codes and the no-progress breaker
  (e06s04), and the escape hatch and override counts (e06s05). They read
  the ledger; they are not written here.
- A cap on the size of the ledger, rotation, and a cap on the length of a
  line (e09). The command string is stored whole.
- A lock between two engines that run at once in one repository. Each
  entry is one write call; a very long entry could interleave with another
  and would then be skipped by the reader as a bad line.
- Redaction of secrets in a stored command (e10).
- Reading the ledger from the CLI, and any CLI flag for its path.
- A `reason` detail string for `no-tree` (carried over from e06s02).

## 6. Risks

- **The agent can edit the ledger (threat model T3).** The file is plain
  and sits in `.git`, where the agent can write too. It can append a fake
  done line or erase failures, which would hide a stuck run from the
  breaker in e06s04 and fake the counts. The design limits the harm: the
  gate never takes `done` from the ledger (C4, AC-12), and a done entry for
  another tree is stale (AC-13). It does not stop erasure. Do not describe
  the ledger as tamper proof. Real protection needs a path the agent cannot
  write, for e07 and e10.
- **A secret in a command is stored on disk (T8).** The ledger holds the
  command string. Do not put secrets in a declared command. e10 owns
  redaction.
- **A failed write blocks work.** A read-only `.git` makes every passing run
  `no-ledger`. That is the intended direction of the failure (T7). Detect:
  a gate that always says `no-ledger` points at the git dir permissions.
- **The ledger grows without a limit.** One line per run, for ever, until e09
  adds a cap. Detect: a ledger of many megabytes.
- **Counts are only as good as the file.** `skipped` is reported by the
  reader so a caller can see lost lines. e06s04 should treat a nonzero
  `skipped` as a reason to look, not as a count of failures.
- **Two writers at once.** See Out of scope. The leading newline keeps a
  torn or interleaved line from spoiling the next entry.
- **A second pointer to the tree.** `git rev-parse --absolute-git-dir` is
  one more git call per run, on top of the two fingerprints. Cheap next to
  the hashing.
- **Re-review trigger.** Run `security-review` on this diff (T3 trigger).

## Verification Script (human)

1. In a scratch git repository:
   `R=$(pwd); cd $(mktemp -d) && git init -q && echo a > f && git add f && git -c user.name=t -c user.email=t@e.invalid commit -qm i && echo '{"command":"true"}' | node $R/src/cli.ts; echo '{"command":"exit 7"}' | node $R/src/cli.ts; cat .git/weftwork/ledger.jsonl`
   prints two verdict lines and then two ledger lines, one `"done":true`
   and one `"done":false` with `"reason":"exit-nonzero"`.
2. In the same repository, `git status --short` prints nothing: the ledger
   is not part of the tree.
3. `printf 'torn' >> .git/weftwork/ledger.jsonl; echo '{"command":"true"}' | node $R/src/cli.ts`
   still answers, and the new entry is on its own line.
4. `rm -r .git/weftwork && touch .git/weftwork; echo '{"command":"true"}' | node $R/src/cli.ts; echo "exit=$?"`
   prints `"done":false` and `"reason":"no-ledger"`, then `exit=1`.
5. Mutation check (anti-vacuity): copy `src` to a scratch directory, change
   the append in the copy so it writes nothing, and run
   `node --test src/gate.ledger.test.ts` there. It must fail. Delete the
   copy.
