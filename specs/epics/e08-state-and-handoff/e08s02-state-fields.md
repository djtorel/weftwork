# e08s02 — The engine changes only the documented state fields

**type:** feat
**risk:** P1
**context:** engine
**bcps:** 4
**epic:** e08 (State and handoff, B2)
**research story:** none (SYNTHESIS candidate epic B2; R12: "keep the field
set small and documented" [S12][S13])
**branch:** e08s02-state-fields

## 1. Purpose

e08s01 gave the engine a writer that changes one field of a YAML file and
keeps every other byte. That writer takes any file and any key. This story
puts a small, documented field table in front of it. The engine sets only
the fields in the table, it checks each value before it writes it, and the
state CLI reaches the writer only through the table. The rest of
`specs/state.yaml` (waivers, metrics, the owner's settings) belongs to the
owner and to the global scripts. The engine refuses to change it, so a
session with no memory finds the file in a shape it can read.

The story also adds a read. A host reads the documented fields through the
engine (`get`) and does not parse the YAML itself.

Owner decisions (2026-11-13, plan-work; all four recommendations taken):

1. **The engine owns five keys of `specs/state.yaml`:** `active_flow`,
   `active_epic`, `active_story`, `phase` and `vcs.branch`. The handoff
   block belongs to e08s03. `workflow_mode`, `test_plan`, `vcs.kind`,
   `waivers` and `metrics` belong to the owner or to the global scripts.
   The engine refuses to set them and keeps them byte for byte.
2. **Values are checked for type only:** text or null, one line, 200
   characters at most. The id patterns (`e08`, `e08s01`) and the phase
   names are bigpowers naming, not engine rules, so the engine does not
   check them.
3. **"Written only by the engine" means one exported write function,**
   `setStateField` in `src/state-fields.ts`, which the CLI calls. No test
   greps for other writers. The single-writer half of H24 rests on design
   precedent, not on a measured fault (R12), so no gate is added until a
   fault is seen.
4. **The state CLI no longer takes a `file`.** It always reads and writes
   `specs/state.yaml` under the repository root of its working directory.
   `writeStateField` of e08s01 stays a library function, but no CLI exposes
   it.

## 2. Zoom-out

- **`src/state-file.ts`** (e08s01). Purpose: set one scalar field of a YAML
  file and keep every other byte (CST edit, re-parse check, refusals).
  Callers before this story: `src/state-cli.ts` (`writeStateField`,
  `isFieldValue`) and `src/state-file.test.ts`. After it:
  `src/state-fields.ts` (`writeStateField`, and `insideRoot` and
  `parseOne`, now exported for the read); `isFieldValue` is private.
  Contracts: `setField(text, path, value)` returns the new text or a
  failure and never adds a key; `writeStateField(root, file, path, value)`
  writes atomically under the root, answers `written` or `unchanged`, and
  returns every failure as a value. This story calls it, exports
  `insideRoot` and `parseOne`, and changes no behaviour.
- **`src/state-cli.ts`** (e08s01). Purpose: the thin JSON shell over the
  writer. Callers: none in `src/`; `src/state-cli.test.ts` runs it as a
  process. Contract: one JSON object on stdin, one JSON line on stdout, exit
  0, 1 or 2. This story changes the request shape (see §3) and keeps the
  output line and the exit codes.

`assess-impact` is not run as a separate skill. The only existing module
that changes is `state-cli.ts`, nothing in `src/` calls it, and its tests
run it through the real file system.

## 3. Requirements

#### ADDED: the field table, `src/state-fields.ts`

- `stateFile` is `specs/state.yaml`.
- `stateFields` lists the five keys of owner decision 1 by their dotted
  names (`vcs.branch`). Each one is text or null.
- `checkStateField(key, value)` returns null when the key is in the table
  and the value is null or a string of one line (no `\n`, no `\r`) of 200
  code points or fewer. Otherwise it returns a failure whose error names the
  key.
- `setStateField(root, key, value)` checks first. A refused field writes
  nothing, and the file stays the same bytes. An accepted field goes to
  `writeStateField(root, stateFile, key.split('.'), value)`, and the answer
  comes back as it is.
- `readStateFields(root)` reads `specs/state.yaml` through
  `readRegularFile` (same limits as the writer: regular file, 1 MiB) and
  returns `{ ok: true, fields }` with one entry for each key in the table. A
  missing key, or a value that is not text or null, is a failure that names
  the key.

#### ADDED: the field document, `docs/STATE.md`

- One short table: key, type, and who writes it. It lists the five engine
  fields and the keys the engine does not write (`workflow_mode`,
  `test_plan`, `vcs.kind`, `handoff`, `waivers`, `metrics`), so a reader
  knows who owns each one.
- A test reads the table and fails when an engine field is in the code and
  not in the document, or the other way round.

#### MODIFIED: the state CLI request, `src/state-cli.ts`

- **Before:** stdin is `{ "file": string, "path": string[], "value": string
  | number | boolean | null }`. Any file under the root, any key that
  exists. The CLI calls `writeStateField`.
- **After:** stdin is `{ "op": "set", "key": string, "value": string |
  null }` or `{ "op": "get" }`. There is no `file`. `set` calls
  `setStateField`. `get` calls `readStateFields` and prints `{ "ok": true,
  "fields": { ... } }`. The exit codes stay: 0 written, unchanged or read;
  1 the engine refused (a key outside the table, a bad value, a file it
  cannot read or keep); 2 input it cannot read (not JSON, the wrong shape,
  an unknown `op`, not in a git repository).

## 17. Acceptance criteria (Gherkin)

```gherkin
Feature: The engine changes only the documented state fields

  # AC-e08s02-01
  Scenario Outline: Each documented field is accepted
    Given the fixture state.yaml
    When the engine sets <key> to <value>
    Then the answer is written
    And reading the file gives <value> at <key>
    Examples:
      | key          | value                 |
      | active_flow  | build_epic            |
      | active_epic  | e09                   |
      | active_story | null                  |
      | phase        | initiate              |
      | vcs.branch   | e08s02-state-fields   |

  # AC-e08s02-02
  Scenario Outline: A key outside the table is refused
    Given the fixture state.yaml
    When the engine sets <key>
    Then the answer is a failure whose error names <key>
    And the file is the same bytes
    Examples:
      | key                |
      | workflow_mode      |
      | vcs.kind           |
      | handoff.next_skill |
      | metrics            |
      | no_such_key        |

  # AC-e08s02-03
  Scenario Outline: A bad value is refused
    Given the fixture state.yaml
    When the engine sets active_story to <value>
    Then the answer is a failure whose error names active_story
    And the file is the same bytes
    Examples:
      | value                        |
      | the number 3                 |
      | the boolean true             |
      | text with a newline          |
      | text with a carriage return  |
      | text of 201 code points      |

  # AC-e08s02-04
  Scenario: A value of exactly 200 code points is accepted
    Given the fixture state.yaml
    When the engine sets active_story to text of 200 code points
    Then the answer is written

  # AC-e08s02-05
  Scenario: The code table and docs/STATE.md agree
    When the test reads the engine rows of the docs/STATE.md table
    Then they are the same keys as stateFields

  # AC-e08s02-06
  Scenario: get prints the documented fields
    Given a test repository with specs/state.yaml
    When the CLI gets the fields
    Then it exits 0 and prints one JSON line with the five fields
    And no other key of the file is in the answer

  # AC-e08s02-07
  Scenario: Setting every field keeps the rest of the file
    Given a test repository with the fixture specs/state.yaml
    When the CLI sets each of the five fields to a new value
    Then the waivers, metrics and handoff blocks are byte-identical

  # AC-e08s02-08
  Scenario Outline: The CLI refuses requests it cannot read
    Given a test repository
    When the CLI reads <request>
    Then it exits 2 and the file is the same bytes
    Examples:
      | request                                             |
      | a request with a "file" field                        |
      | a request with a "path" list in place of a "key"     |
      | an unknown op                                       |
```

## Steps

1. RED then GREEN (ref: §1 decisions 1 and 2): write `src/state-fields.test.ts`
   for AC-01 to AC-05 on a copy of `src/fixtures/state.yaml` in a temp
   repository and record the failure; then write `src/state-fields.ts` (`stateFile`, `stateFields`,
   `checkStateField`, `setStateField`, `readStateFields`) and
   `docs/STATE.md` → verify: `node --test src/state-fields.test.ts
   src/state-file.test.ts && npm run typecheck`
2. RED then GREEN (ref: §1 decision 4): rewrite `src/state-cli.test.ts` for the new request
   (AC-06 to AC-08, and the e08s01 exit-code cases that still apply) and
   record the failure; then change `src/state-cli.ts` to `op`, `key` and
   `value` → verify: `node --test src/state-fields.test.ts
   src/state-file.test.ts src/state-cli.test.ts && npm run typecheck`
3. Name `state-fields.ts` and `docs/STATE.md` in the AGENTS.md Architecture
   section (ref: §1 decision 3 and §3 field document), then run Preflight → verify: `grep -q 'state-fields' AGENTS.md
   && yamllint specs && bash tools/validate-specs-yaml.sh && bash
   tools/check-gate-ignores.sh && npm run typecheck && npm test`

Red-flag check: I caught two. First, I nearly kept `file` in the CLI
"for flexibility". That would keep the generic writer public and undo the
point of the story, so the owner chose to drop it. Second, I nearly added
an empty-text refusal and a control-character refusal. The owner chose a
type-only check, so the rule is one line and 200 code points, nothing more.

## 4. Dependencies (slopcheck)

- No new package. `yaml` 2.9.1 `[OK]` (e08s01) parses the file for `get`.

## 5. Out of scope

- The handoff block (`handoff.*`): e08s03 writes it, e08s04 checks it.
  Until e08s03, the CLI refuses `handoff.next_skill`, and handoff edits stay
  direct edits, as before e08s01.
- Checking id patterns or phase names (owner decision 2).
- A test or gate that looks for other writers of `specs/state.yaml` (owner
  decision 3).
- Other state files (`execution-status.yaml`, `epic.yaml`): no CLI writes
  them after this story. A later story adds a table for them if the engine
  needs to.
- The global scripts that rewrite `specs/state.yaml` (`bp-timing.sh`,
  `record-cycle-time.sh`). `tools/restore-yaml-style.py` stays for them.
- The e08s01 known limits (spec §5a) and the e10 risks (spec §6).

## 6. Risks

- **Code and document drift.** The table lives in two places. AC-05 fails
  the suite when they differ.
- **A value of a type the writer cannot keep.** The writer of e08s01
  already refuses a value that reads back as another type (`"true"`,
  `"123"`). The table adds no new path around that check; AC-01 covers
  text that looks like another type through the `null` row and the e08s01
  tests.
- **`get` reads a file the global scripts reflowed.** It parses data, not
  text, so a reflow does not change the answer.
