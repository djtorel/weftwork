# e06s05 — Add a one-shot, owner-authored, logged escape hatch

**type:** feat
**risk:** P1
**context:** engine
**bcps:** 3 (see Risks: the work grew from three tasks to six steps)
**epic:** e06 (Engine core and done gate, B1)
**research story:** none (B1 rests on R13, R14 and R15 through
docs/research/SYNTHESIS.md; the hatch is R13 H4)
**branch:** e06s05-one-shot-escape-hatch

## 1. Purpose

A gate that cannot be passed is a gate the owner will switch off. The
engine needs one way for the owner to say "let this run through, once, and
write it down", and it needs that way to be useless to the agent whose work
the gate checks. This story adds that hatch: a record the owner writes by
hand, for one exact command on one exact tree, that turns one failed run
into the answer `overridden`. Every use is logged, and the ledger counts
overrides and false alarms next to passes and failures (R13 H4 [S13][S14]).

The hatch never makes `done`. `done` still means the declared command
passed on an unchanged tree. `overridden` is a different answer with a
different exit code, so a caller can tell "verified" from "the owner let it
through".

Owner decisions (2026-11-12, plan-work, "use the recommendations" on four
questions; each followed the recommended option):

1. **An override answers a new state, `overridden`, exit code 7.** `done`
   stays false and exit 0 still means only "the engine ran the check and it
   passed". The alternative, `done` with a mark, was refused: a file would
   then be able to make `done`, which breaks threat model rule C4.
2. **The owner writes a JSON file by hand at
   `<git dir>/weftwork/override.json`**, next to the ledger. Git never lists
   the git dir, so the file does not change the tree fingerprint. It holds
   one exact command, one exact tree fingerprint, a reason, an author and a
   kind. The owner copies the fingerprint from the `fingerprint` field of
   the failed run's JSON line. **Limit: authorship is not proof.** The
   engine cannot tell who wrote the file, and an agent that can write files
   can forge one (T4). The design limits the damage to one run on one tree
   and leaves a trace. Do not describe the hatch as owner-authenticated.
   Real separation needs a path the agent cannot write (e07, e10).
3. **Only `failed` and `stalled` can become `overridden`.** Never `done`,
   `blocked`, `exhausted` (before or after the run) or `killed`. The ceiling
   stays outside the hatch. An overridden run still counts as a failed run
   in the ledger, so only a pass resets the failure count and the ceiling
   still trips.
4. **The same file, with a `kind`.** `override` means "the gate is right,
   go on anyway". `false-alarm` means "the gate is wrong". Both answer
   `overridden`, both are used once, and the ledger counts them apart (R13
   [S24]: count false alarms as well as overrides).

Two choices made while planning, inside the decisions above:

- **"A wildcard or a pattern" means nothing for the match, so the reader
  rejects a record that tries to be one.** The match is exact string
  equality on the command and on the fingerprint. A command may contain `*`
  or `?` as a literal (`ls *.ts`); the reader keeps it, and it matches only
  that exact string. The reader rejects an unknown key (so no `pattern`,
  `glob` or `regex` key can arrive later by accident), a fingerprint that is
  not 64 hex characters, and a command made only of glob or regex
  characters. This changes the wording of task 1 in the tasks file.
- **One shot is a rename.** The engine takes the record by renaming
  `override.json` to `override.used-<epoch ms>-<random>.json`. Rename is atomic, so
  two engines that race for one record get exactly one winner, and the
  record is kept for the owner. The reader never reads a `.used` file.

A rule that is not a decision: **no answer to a failed run may mention the
hatch.** In one study a self-service override ran in at least 48.0% of
decisions when the refusal named it, and in 0.0% of 416 decisions when it
did not (R13 [S56]). stdout and stderr of a run with no record, a bad
record or a record that does not match are byte for byte the same.

Reason for Depth, one line per new file:

- `src/override.ts`: the record rules and the one-shot take in one file,
  so the engine calls one function and tests reach the reader with no
  repository.

No other new abstraction. The other changes go into `states.ts`,
`ledger.ts` and `engine.ts`.

## 2. Zoom-out

The story adds one module and changes three.

- **Purpose of `src/engine.ts`:** decide how a run ends and log every
  terminal state (e06s04). It stays that. It gains one step after the
  classification: offer the record to `failed` and `stalled`.
- **Purpose of `src/ledger.ts`:** the plain-file log and its counts
  (e06s03, e06s04). It gains two optional fields on a state line and
  `overrideCounts`.
- **Purpose of `src/states.ts`:** one table of state names and exit codes.
  It gains `overridden` and code 7.
- **Callers:** `cli.ts` calls `runEngine` and maps the state to the exit
  code with `exitCodes`. `engine.ts` calls `runGate`, the ledger readers
  and `appendState`. `test-helpers.ts` and the test files call `ledger.ts`.
- **Contracts that must hold:** `done` is true only with reason `passed`
  and comes only from `runGate`, which never reads the ledger or the
  record (C4). `terminalStates` stays the five states. Exit 0, 1 and 2 to 6
  keep their meaning. stdout holds exactly one JSON line. The ledger write
  and the record never change the tree fingerprint. `readLedger` keeps its
  result shape, and a state line is neither a run nor a skipped line.
  `exhausted` outranks every other answer after a run.
- **What breaks on purpose:** `exitCodes` gains `overridden: 7`, so the
  e06s04 table test and its "seven codes" test change. The JSON line can
  now hold `state: "overridden"`.

Blast radius (inline, in place of a separate `assess-impact` run): new file
`src/override.ts` and tests `override.test.ts`, `override.once.test.ts`,
`ledger.override.test.ts`, `engine.override.test.ts`,
`cli.override.test.ts`; changed `src/states.ts`, `src/ledger.ts`
(two optional fields, `overrideCounts`), `src/engine.ts` (the override
step; `logState` returns whether it wrote), `src/cli.ts` (header comment
only) and `src/states.test.ts` (the table and the count). No change to
`gate.ts`, `package.json`, `tsconfig.json`, CI, `.gitignore` or AGENTS.md.
Every other existing test keeps passing unchanged.

## 3. Requirements

#### MODIFIED: states and exit codes, `src/states.ts`
**Before:** `State` is `TerminalState | 'failed'`. `exitCodes` has six
entries (done 0, failed 1, blocked 3, stalled 4, exhausted 5, killed 6).
Seven codes are distinct, counting the bad-input code 2.
**After:** `State` is `TerminalState | 'failed' | 'overridden'`.
`exitCodes` also has `overridden: 7`. Eight codes are distinct. `terminalStates`
is unchanged: `overridden` is an answer to a run that failed, not a seventh
ending of the loop. Only `done` maps to 0.

#### ADDED: the override record, `src/override.ts`
- `OverrideKind` is `'override' | 'false-alarm'`.
- `Override` is `{ command, fingerprint, reason, author, kind }`, all strings.
- `parseOverride(text)` returns `{ ok: true, override } | { ok: false, error }`
  and never throws. It accepts exactly those five keys. It rejects: text that
  is not JSON; JSON that is not one object; any other key; a missing key or a
  value that is not a string; a `command`, `reason` or `author` that is empty
  or only spaces; a `reason` over 1000 characters; an `author` over 200; a
  `kind` that is not one of the two; a `fingerprint` that is not 64
  lowercase hex characters; a `command` made only of `*`, `?`, `.`, `+`, `[`,
  `]`, `(`, `)`, `^`, `$`, `|` and spaces.
- `readOverride(path)` reads at most 64 KiB, and returns
  `{ ok: true, override: Override | null } | { ok: false, error }`. A file
  that does not exist is `override: null`. A file over 64 KiB, a symlink, a
  directory, or anything that is not a regular file is not ok. The open uses
  `O_NOFOLLOW` and `O_NONBLOCK`, and `fstat` on the open handle checks the
  type, so a FIFO can never block the read, even if one is swapped in at the
  last moment (changed after review round 1; `lstat` was dropped because it
  left a gap before the open). Never throws.
- `takeOverride(path, run, now)`, where `run` is `{ command, fingerprint }`,
  returns the `Override` it
  took, or null. It reads the record; it matches only when `command` and
  `fingerprint` equal the record's strings exactly, and `fingerprint` is not
  null; it then renames the file to `override.used-<now epoch ms>-<random>.json` in
  the same directory. It returns the record only when the rename succeeds,
  so a lost race, a rename error, a missing file, a bad record and a record
  for another command or tree all give null. Never throws. A record that
  does not match stays where it is.
- It writes nothing to stdout or stderr.

#### ADDED: state lines for overrides, `src/ledger.ts`
- `StateEntry` gains optional `kind` (`OverrideKind`) and optional `author`
  (string). `toState` accepts a line with neither (every e06s04 line) and
  skips and counts a line whose `kind` or `author` has the wrong type.
  `knownStates` includes `overridden`.
- `overrideCounts(states, command)` returns `{ overrides, falseAlarms }`:
  the `overridden` state lines for that exact command string, by `kind`.
  A line with no kind counts in neither.

#### ADDED: the override step in `runEngine` (`src/engine.ts`)
- After a run, if the classified state is `failed` or `stalled`, and the
  verdict's fingerprint is not null, and the ledger path is known, the engine
  calls `takeOverride` with the verdict's command and fingerprint.
- On a record taken: the answer is the verdict (`done` false, the command's
  own `exitCode` and `reason` kept) with `state: 'overridden'` and `detail`
  set to the record's reason. The engine writes one state line: state
  `overridden`, `runs` and `failStreak` from the ledger as read, `threshold`
  null, `detail` the reason, `kind` and `author` from the record. It does not
  also write the `stalled` line.
- If that line cannot be written, the record is spent (the rename already
  happened), the answer stays `failed` or `stalled` with its normal line, and
  stderr holds the existing line "state line not written". `logState`
  returns whether it wrote.
- No other state looks at the record: pre-run `exhausted`, `blocked`,
  post-run `exhausted`, `killed` and `done` never take it.
- The overridden run was logged by `runGate` as a failed run, so
  `failingRun`, `checkCeiling` and `checkStall` count it.
- Nothing about the record goes to stdout or stderr unless it is taken.
- `runGate` and `gate.ts` are not changed and never read the record (C4).

#### MODIFIED: CLI JSON line and exit codes, `src/cli.ts`
**Before:** the exit code is `exitCodes[state]` for done, failed, blocked,
stalled, exhausted and killed, and 2 for unreadable input.
**After:** the same, and `overridden` exits 7. The JSON line holds
`state: "overridden"` and `detail` (the reason) for it. Only the header
comment changes; the code is the same, because it reads the table.

## 17. Acceptance criteria (Gherkin)

These IDs are local to this story. Every scenario that runs a command does
so in a temporary git repository, never in the real one. Files: the table in
`src/states.test.ts`; state lines and counts in `src/ledger.override.test.ts`;
the reader in `src/override.test.ts`; the take in `src/override.once.test.ts`;
the engine in `src/engine.override.test.ts`; the process in
`src/cli.override.test.ts`. In the engine and CLI scenarios the failing
command is `exit 9`, so the command's exit code is not mistaken for the
engine's exit code 7.

```gherkin
Scenario: AC-e06s05-01 the table
  Then exitCodes is done 0, failed 1, blocked 3, stalled 4, exhausted 5,
    killed 6, overridden 7 and badInputExitCode is 2
  And only done maps to 0
  And the eight codes are all different
  And terminalStates is still exactly done, blocked, stalled, exhausted,
    killed

Scenario: AC-e06s05-02 a state line with a kind and an author
  Given a ledger path in a temporary git repository
  When appendState writes an overridden line with kind "false-alarm",
    author "dom" and a detail
  Then readLedgerTail has one state with those fields and skipped 0
  And a state line with no kind and no author (an e06s04 line) is still read
    with skipped 0

Scenario Outline: AC-e06s05-03 a bad override field on a state line
  Given a ledger with one good entry and an overridden line with <bad>
  When readLedgerTail reads it
  Then it has the good entry and skipped is 1

  Examples:
    | bad                       |
    | kind as the number 1      |
    | author as the number 1    |

Scenario: AC-e06s05-04 the counts
  Given state lines for "a": two overridden with kind override, one
    overridden with kind false-alarm, one overridden with no kind, one
    stalled; and one overridden override line for "b"
  Then overrideCounts for "a" is overrides 2 and falseAlarms 1
  And overrideCounts for "b" is overrides 1 and falseAlarms 0
  And overrideCounts for "c" is overrides 0 and falseAlarms 0

Scenario Outline: AC-e06s05-05 a good record
  When parseOverride reads a record with kind <kind>
  Then the result is ok and every field has the value written

  Examples:
    | kind        |
    | override    |
    | false-alarm |

Scenario Outline: AC-e06s05-06 a bad record is a value, not a throw
  When parseOverride reads <bad>
  Then the result is not ok, with an error text, and nothing throws

  Examples:
    | bad                                                          |
    | text that is not JSON                                        |
    | a JSON array                                                 |
    | a record with no reason                                      |
    | a record with a reason of only spaces                        |
    | a record with an empty command                               |
    | a record with an empty author                                |
    | a record with a reason of 1001 characters                    |
    | a record with an author of 201 characters                    |
    | a record whose command is the number 5                       |
    | a record with an extra key "pattern"                         |
    | a record with an extra key "glob"                            |
    | a record with kind "always"                                  |
    | a record with fingerprint "*"                                |
    | a record with a 63-character fingerprint                     |
    | a record with an upper-case fingerprint                      |
    | a record whose command is "*"                                |
    | a record whose command is ".*"                               |

Scenario: AC-e06s05-07 a star inside a real command is a literal
  Given a record whose command is "ls *.ts" and a good fingerprint
  Then parseOverride is ok
  And takeOverride for the command "ls *.ts" at that fingerprint takes it
  And takeOverride for the command "ls a.ts" at that fingerprint gives null

Scenario Outline: AC-e06s05-08 reading the record when the file is odd
  When readOverride reads <path>
  Then the result is <result>

  Examples:
    | path                          | result                       |
    | a path that does not exist    | ok, override null            |
    | a directory                   | not ok, no throw             |
    | a symlink to a good record    | not ok, no throw             |
    | a FIFO                        | not ok, returns at once      |
    | a file of 65537 bytes         | not ok, no throw             |

Scenario: AC-e06s05-09 one shot
  Given a good record for command "c" at fingerprint F
  When takeOverride runs for "c" at F
  Then it returns the record
  And override.json no longer exists
  And one file named override.used-<number>-<hex>.json holds the same record
  When takeOverride runs again for "c" at F
  Then it returns null

Scenario Outline: AC-e06s05-10 a record for another run does nothing
  Given a good record for command "c" at fingerprint F
  When takeOverride runs for <command> at <fingerprint>
  Then it returns null
  And override.json is unchanged and no used file exists

  Examples:
    | command     | fingerprint            |
    | "d"         | F                      |
    | "c "        | F                      |
    | "c"         | another fingerprint    |
    | "c"         | null                   |

Scenario: AC-e06s05-11 two takers, one record
  Given a good record for "c" at F
  When two takeOverride calls run at once
  Then exactly one returns the record and the other returns null

Scenario: AC-e06s05-12 a failed run becomes overridden
  Given a temporary repository where "exit 9" failed once
  And a record for "exit 9" at that run's fingerprint, kind override,
    author "dom", reason "flaky network"
  When runEngine runs "exit 9" again
  Then the state is "overridden", done false, reason "exit-nonzero",
    exit code 9 and detail "flaky network"
  And the ledger holds one overridden state line with kind "override",
    author "dom", detail "flaky network", threshold null and failStreak 2
  And no stalled line is written

Scenario: AC-e06s05-13 a stalled run becomes overridden
  Given "exit 9" failed twice on an unchanged tree, and a good record
  When runEngine runs it a third time
  Then the state is "overridden", and the ledger holds an overridden line
    and no stalled line

Scenario Outline: AC-e06s05-14 the other states never take the record
  Given a good record for the command and its tree
  When <situation>
  Then the state is <state>
  And override.json is unchanged and no used file exists

  Examples:
    | situation                                           | state     |
    | the run reaches the ceiling (maxFailures 2)         | exhausted |
    | the ledger is already at the ceiling before the run | exhausted |
    | the request has a blocked text                      | blocked   |
    | the signal aborts while the command runs            | killed    |
    | the command passes                                  | done      |

Scenario: AC-e06s05-15 one shot at the engine
  Given the overridden answer of AC-e06s05-12, with stallAfter 9 (the
    overridden run counts as a failed run, so without it the third
    identical run would answer stalled)
  When runEngine runs "exit 9" again on the same tree
  Then the state is "failed" and no second overridden line is written

Scenario: AC-e06s05-16 an override does not reset the failure count
  Given maxFailures 3 and a tree that does not change
  When "exit 9" fails once, is overridden on the second run, and runs a
    third time
  Then the third answer is "exhausted"

Scenario: AC-e06s05-17 a record that cannot be logged does not apply
  Given the ledger file is made read-only after the first failed run
  And a good record for that run's tree
  When runEngine runs "exit 9" again
  Then the state is not "overridden" and done is false
  And stderr holds a line saying the state line was not written
  And no line was added to the ledger

Scenario: AC-e06s05-18 the record never makes done
  Given a record for "false" at the current fingerprint, and a forged done
    run entry and a forged overridden state line for it in the ledger
  When runEngine runs "false"
  Then done is false whatever the state
  And for the command "true" with the record present the state is "done"
    and the record is not used

Scenario Outline: AC-e06s05-19 the answer to a failed run does not name the hatch
  Given a repository where "exit 9" fails and <record>
  When the real CLI runs "exit 9" with stallAfter 9
  Then stdout and stderr are byte for byte the same as for the run with no
    record at all
  And neither contains "overrid" or "hatch" in any letter case

  Examples:
    | record                                                    |
    | there is no record                                        |
    | the record is not JSON                                    |
    | the record is for another command                         |
    | the record is for another tree                            |
    | the record has no reason                                  |

Scenario: AC-e06s05-20 the real CLI overrides once
  Given a temporary repository
  When the real CLI runs {"command":"exit 9","stallAfter":9} and exits 1
  And the owner writes a record with the fingerprint from that line
  And the real CLI runs the same input again
  Then the exit code is 7
  And stdout is one JSON line whose state is "overridden" and whose done is
    false
  And the ledger holds an overridden state line
  When the real CLI runs the same input a third time
  Then the exit code is 1 and the state is "failed"

Scenario: AC-e06s05-21 the counts through the real CLI
  Given a temporary repository and the input {"command":"exit 9","stallAfter":9}
  When the CLI runs it (fail), then with an override record (overridden),
    then plain (fail), then with a false-alarm record (overridden)
  Then the exit codes are 1, 7, 1, 7
  And countsFor has runs 4, passes 0 and failures 4
  And overrideCounts has overrides 1 and falseAlarms 1

Scenario: AC-e06s05-22 the old scenarios still hold
  Then every e06s01 to e06s04 test passes, with only states.test.ts
    changed for the new row
  And Preflight passes
```

## Steps

1. RED: change `src/states.test.ts` (AC-01), write
   `src/ledger.override.test.ts` (AC-02 to AC-04), and record the failures.
   GREEN: add `overridden` and exit 7 to `src/states.ts`; add `kind`,
   `author`, the known state and `overrideCounts` to `src/ledger.ts`
   → verify: `node --test src/states.test.ts src/ledger.override.test.ts src/ledger.states.test.ts src/ledger.test.ts && npm run typecheck`
2. RED: write `src/override.test.ts` (AC-05 to AC-08), record the failures.
   GREEN: write `parseOverride` and `readOverride` in `src/override.ts`
   (ref: threat model T4)
   → verify: `node --test src/override.test.ts && npm run typecheck && ! grep -nE 'shell:|execSync|[^a-zA-Z]exec\(' src/override.ts` (no new security findings in the affected paths: no shell, a size cap, no FIFO open)
3. RED: write `src/override.once.test.ts` (AC-09 to AC-11), record the
   failures. GREEN: add `takeOverride` to `src/override.ts`
   → verify: `node --test src/override.once.test.ts src/override.test.ts && npm run typecheck && ! grep -nE 'readLedger|countsFor|process\.std' src/override.ts`
4. RED: write `src/engine.override.test.ts` (AC-12 to AC-19), record the
   failures. GREEN: add the override step to `src/engine.ts` and make
   `logState` return whether it wrote
   → verify: `node --test src/engine.override.test.ts src/engine.test.ts src/blocked.test.ts && npm run typecheck && ! grep -nE 'override' src/gate.ts`
5. RED: write `src/cli.override.test.ts` (AC-19 to AC-22), record the
   failures. GREEN: update the header of `src/cli.ts` (the code needs no
   change)
   → verify: `node --test src/cli.override.test.ts && npm run typecheck && npm test`
6. Run the Preflight line from AGENTS.md, then `security-review` on the
   diff (the override reader and the take, T4). Mutation checks from the
   Verification Script
   → verify: `yamllint specs && bash tools/validate-specs-yaml.sh && bash tools/check-gate-ignores.sh && npm run typecheck && npm test`

## 4. Dependencies (slopcheck)

- `node:fs/promises` (`open`, `rename`), `node:fs` (`constants`),
  `node:crypto` (`randomBytes`),
  `node:path`: built into Node 26. `[OK]`.
- No new npm package and no new program.

## 5. Out of scope

- A command or a flag that writes the record for the owner, and any command
  that shows why a record did not match. The engine is silent about a bad
  or non-matching record on purpose (AC-19); an owner-facing check belongs
  to e11 (skills and the entry command).
- Owner authentication of the record, a signature, or a path the agent
  cannot write (e07, e10; threat model T4 residual).
- A record that covers more than one run, a time limit on a record, a
  pattern or a list of commands. The reader rejects them by design.
- Retirement logic for gates and any rule on how many overrides are too
  many (R13 H4: no overrides to count yet).
- Marking a past run as a false alarm after the fact. A false alarm is a
  record, kind `false-alarm`, used once like an override.
- Reading counts from the CLI, ledger rotation, a run id (e08, e09).
- A lock between two engines beyond the atomic rename of the record.
- Redaction of a secret in a command or reason stored in the ledger (e10).

## 6. Risks

- **The agent can forge the record (threat model T4).** It can write
  `override.json` for a failing gate, once per tree. It cannot make `done`
  (C4, AC-18), cannot pass the ceiling (AC-14, AC-16) and leaves an
  `overridden` line with a reason and an author it chose. A forged author
  is not evidence. Do not call the hatch owner-authenticated. Detect: an
  `overridden` line the owner did not write.
- **A bad record fails silently.** The engine says nothing about a record
  that is invalid or for another tree (AC-19), so the owner may not learn
  why it did not apply. The common cause is a tree that changed since the
  fingerprint was copied. Detect: exit 1 or 4 where 7 was expected. The
  check command belongs to e11.
- **A spent record can be lost.** The record is renamed before the state
  line is written. If the line cannot be written, the answer stays
  `failed` and the owner must write the record again (AC-17). The used file
  is still on disk.
- **A stale record waits.** A record that matches no run stays until its
  command runs on its exact tree. It cannot fire on another tree.
- **A tree-changed run prints a fingerprint the owner cannot use.** The
  record matches the tree a run started on. A run whose command changed the
  tree (reason `tree-changed`) prints the tree it started on, and the next
  run starts on a different one, so a record copied from that line never
  matches. Copy the fingerprint from a run that left the tree as it found
  it. The CLI header says so.
- **An overridden run still counts as failed.** The owner who overrides the
  fifth failure in a row does not get past the ceiling and must delete the
  ledger (R15). The alternative, resetting the count, would let a hatch
  forged by the agent undo the ceiling.
- **A command over 64 KiB cannot be overridden.** The record file is capped
  at 64 KiB (CWE-400), and a command can be up to the 1 MiB input cap.
- **Sizing.** The epic gives this story 3 BCPs for three tasks. The plan has
  six steps, one new module and four changed ones. Sized by the e06s04
  yardstick (5 BCPs, eight steps), this is nearer 4. Not rescored here;
  record the real cycle time in the ledger and rescore with
  `change-request` if it runs long.
- **Re-review trigger.** Run `security-review` on this diff (the reader, the
  take, the silence rule). The threat model T4 section now records the
  decision.

## Changes after audit and review round 1

- **New files:** `src/ledger-state.ts` (the state-line shape, validation and
  `overrideCounts`, moved out of `ledger.ts` for the 300-line rule) and
  `src/errors.ts` (`messageOf` and `isMissing`, shared by two readers).
- **Engine:** the state-line writer takes one `StateWrite` object, and
  `takeOverride` takes `(path, run, now)`, to stay within three parameters.
- **Reader:** opens without blocking and checks the type with `fstat` (see the
  requirement above); strips a leading UTF-8 byte order mark.
- **Spent name:** `override.used-<epoch ms>-<random>.json`, so a rename never
  overwrites an earlier spent record.
- **Not changed, by decision:** the gap between reading a record and renaming
  it (a swapped-in file is used up unvalidated) stays inside the T4 limit and is
  recorded in specs/security/REVIEW.md.

## Verification Script (human)

1. In a scratch git repository, an override:
   `R=$(pwd); cd $(mktemp -d) && git init -q && echo a > f && git add f && git -c user.name=t -c user.email=t@e.invalid commit -qm i && echo '{"command":"exit 9","stallAfter":9}' | node $R/src/cli.ts; echo "exit=$?"`
   prints a JSON line with `"state":"failed"` and `exit=1`. Copy its
   `fingerprint`.
2. Write the record by hand:
   `printf '{"command":"exit 9","fingerprint":"<paste>","reason":"flaky network","author":"dom","kind":"override"}' > "$(git rev-parse --absolute-git-dir)/weftwork/override.json"`
   Run the same line again. It prints `"state":"overridden"`,
   `"detail":"flaky network"`, `"done":false` and `exit=7`.
3. `ls "$(git rev-parse --absolute-git-dir)/weftwork"` shows
   `override.used-<number>-<hex>.json` and no `override.json`. Run the line a
   third time: `"state":"failed"`, `exit=1`.
4. `tail -3 "$(git rev-parse --absolute-git-dir)/weftwork/ledger.jsonl"`
   shows the `overridden` line with `kind`, `author`, `detail`, `runs` and
   `failStreak`.
5. Write a record for the wrong tree (change one fingerprint character) and
   run the line: `"state":"failed"`, `exit=1`, and the record file is still
   there. Compare stdout and stderr with step 1: nothing mentions the
   hatch.
6. Ceiling: `rm` the ledger and the record. Run
   `{"command":"exit 9","maxFailures":2}` once, write a record, run it
   again: it prints `"state":"overridden"` (the second failure counts). Run
   it a third time: `"state":"exhausted"`, `exit=5`.
7. Mutation checks (anti-vacuity): copy `src` to a scratch directory (with
   `package.json` and `tsconfig.json`), then in the copy (a) make
   `takeOverride` skip the rename and run `src/override.once.test.ts`; (b)
   let `exhausted` take the record in `engine.ts` and run
   `src/engine.override.test.ts`; (c) make `parseOverride` accept an unknown
   key and run `src/override.test.ts`. Each must fail. Delete the copy.
