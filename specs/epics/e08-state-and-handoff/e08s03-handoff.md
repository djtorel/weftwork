# e08s03 — The engine writes the handoff note for a session with no memory

**type:** feat
**risk:** P1
**context:** engine
**bcps:** 7
**epic:** e08 (State and handoff, B2)
**research story:** none (SYNTHESIS candidate epic B2; R12: write the
handoff for a session with no memory, keep it bounded, and have it carry
what resume can verify [S12][S13][S36])
**branch:** e08s03-handoff-note

## 1. Purpose

Today an agent writes the `handoff` block of `specs/state.yaml` by hand.
Nothing checks it, the agent can get its facts wrong, and the global
scripts reflow it. This story has the engine write the block. The caller
gives the parts only it knows (the next skill, the note, the branch to
start on, the files the note names). The engine adds the facts it can
measure itself (when it wrote the block, and which paths were uncommitted
then), so e08s04 can check the block against the repository at resume.

Owner decisions (2026-11-13, plan-work; all five recommendations taken):

1. **The block holds** `next_skill`, `next_epic`, `next_story`, `note`,
   `branch` and `files`, given by the caller, and `written_at` and
   `uncommitted`, filled by the engine. `next_skill`, `note` and `branch`
   are required. `next_epic` and `next_story` may be null. `files` may be
   empty. A caller who sends `written_at` or `uncommitted` has them
   ignored.
2. **The note is capped at 4000 characters.** Existing notes run 1300 to
   2500. The one handoff study put 10k characters of structured notes in
   the first prompt (R12, S36), so 4000 is inside what was tested. A
   longer note is refused, not cut.
3. **No commit hash is recorded.** This repository squash-merges every PR,
   so a hash written on a story branch does not exist on `main`, where the
   next session starts. e08s04 checks the branch and the files instead.
4. **One file, not two.** The block stays in `specs/state.yaml`. R12 calls
   HANDOFF.json plus a `.continue-here` file ceremony until one file is
   shown to be not enough.
5. **The writer gets one more edit: replace one top-level mapping.**
   `setField` of e08s01 changes an existing scalar and never adds a key,
   but the block needs new keys and two lists. The new edit replaces the
   whole value of one top-level key and keeps every other byte, with the
   same checks as `setField`. The block loses its hand-written style; the
   engine owns it from now on. Rejected: one-line strings for the lists
   (fragile to read), and a separate handoff file (bigpowers skills read
   `handoff.next_skill` from `specs/state.yaml`). This raised the story
   from 5 to 7 BCPs.

## 2. Zoom-out

- **`src/state-file.ts`** (e08s01). Purpose: set one scalar field of a
  YAML file and keep every other byte (CST edit, re-parse check,
  refusals). Callers: `src/state-fields.ts` (`writeStateField`,
  `insideRoot`, `parseOne`) and its tests. Contracts: `setField` returns
  the new text or a failure and never adds a key; `writeStateField`
  writes atomically under the root and returns every failure as a value.
  This story adds `setMapping` and `writeStateMapping` beside them and
  changes no existing behaviour. Reason for depth: lists and new keys
  cannot go through a scalar edit, and the byte-keeping checks must stay
  in the one module that owns them.
- **`src/state-fields.ts`** (e08s02). Purpose: the table of fields the
  engine writes. Callers: `src/state-cli.ts`. Contract: `setStateField`
  refuses every key outside `stateFields`. This story keeps that and adds
  `handoff` as a mapping the engine writes only through `writeHandoff`;
  the state CLI still refuses `handoff.*`.
- **`src/tree.ts`** (e06). Purpose: the working-tree fingerprint. It holds
  the one git helper (`gitOutput`, run with `core.fsmonitor=false`). This
  story exports a function that lists uncommitted paths through that
  helper, so there is no second way to call git.
- **`docs/STATE.md`** (e08s02): the `handoff` row changes owner from
  "owner (the engine from e08s03)" to "engine".

`assess-impact` is not run as a separate skill. Each changed module gains
an export and keeps its contracts; the existing suites of `state-file`,
`state-fields` and `tree` cover them.

## 3. Requirements

#### ADDED: replace one mapping, `src/state-file.ts`

- `setMapping(text, key, value)` takes a top-level key and a mapping of
  plain data (strings, null, and lists of strings). The key must exist; a
  missing key is a failure that names it (the writer never adds a
  top-level key). Its old value, of any style, is replaced by the new
  mapping in block style. Every other byte stays.
- The result is kept only when it parses as one document, its data equals
  the old data with that key replaced, no new warning appears, and every
  string passes the PyYAML check of `refusalForValue`. Otherwise it is a
  failure and no text comes back.
- `writeStateMapping(root, file, key, value)` reads, edits and writes as
  `writeStateField` does (inside the root, regular file, 1 MiB, atomic,
  `written` or `unchanged`).

#### ADDED: the handoff writer, `src/handoff.ts`

- `checkHandoff(input)` returns the caller's part of the block or a
  failure that names the field: `next_skill` and `branch` one line of 200
  code points or fewer; `next_epic` and `next_story` the same or null;
  `note` text of 1 to 4000 code points; `files` a list of repository
  paths. A path is refused when it is absolute, leaves the root (`..`),
  holds a line break, or does not exist. A key the block does not have is
  refused and named, so a typo such as `next_stroy` is not read as null.
- `writeHandoff(root, input)` checks the input, then sets `written_at` to
  the time now (ISO 8601, UTC, to the second) and `uncommitted` to the
  paths `git status` lists, sorted, without `specs/state.yaml`, and writes
  the block with
  `writeStateMapping`. A refused input writes nothing.

#### ADDED: the handoff CLI, `src/handoff-cli.ts`

- A thin shell: one JSON object on stdin with the caller's fields, one
  JSON line on stdout. Exit codes as in the state CLI: 0 written or
  unchanged, 1 the engine refused, 2 input it cannot read or not in a git
  repository. It always writes `specs/state.yaml` under the repository
  root.

#### MODIFIED: the `handoff` row, `docs/STATE.md`

- **Before:** `handoff` is a mapping written by "owner (the engine from
  e08s03)".
- **After:** `handoff` is a mapping written by `engine (handoff CLI)`,
  and a short list names its eight keys and which ones the engine fills.
  `stateFields` does not change. The e08s02 drift test (AC-e08s02-05)
  counts only rows whose cell is exactly `engine`, so it stays green and
  the state CLI still refuses `handoff.*`.

## 17. Acceptance criteria (Gherkin)

```gherkin
Feature: The engine writes the handoff note

  # AC-e08s03-01
  Scenario: A mapping replaces the old block and nothing else changes
    Given the fixture state.yaml with a four-key handoff block
    When setMapping replaces handoff with a mapping that holds a list
    Then the file reads back as the old data with handoff replaced
    And every byte before and after the block is the same

  # AC-e08s03-02
  Scenario Outline: setMapping refuses what it cannot keep
    Given the fixture state.yaml
    When setMapping is called with <input>
    Then the answer is a failure and no text comes back
    Examples:
      | input                                   |
      | a top-level key that does not exist     |
      | a nested mapping inside the value       |
      | a string that holds NEL                 |

  # AC-e08s03-03
  Scenario: A complete input writes the block with engine facts
    Given a test repository with one uncommitted file
    When the engine writes a handoff with next_skill, note and branch
    Then the block holds the caller's fields
    And written_at is the time of the write
    And uncommitted lists the file and not specs/state.yaml

  # AC-e08s03-04
  Scenario Outline: A bad input is refused and the file is unchanged
    Given a test repository
    When the engine writes a handoff with <fault>
    Then the answer is a failure that names the problem
    And specs/state.yaml is the same bytes
    Examples:
      | fault                                   |
      | no next_skill                           |
      | no note                                 |
      | no branch                               |
      | a note of 4001 code points              |
      | a file path that does not exist         |
      | a file path outside the repository      |
      | a file path with a newline              |

  # AC-e08s03-05
  Scenario: A note of exactly 4000 code points is accepted
    When the engine writes a handoff with a 4000 code point note
    Then the answer is written

  # AC-e08s03-06
  Scenario: Engine facts sent by the caller are ignored
    When the caller sends written_at and uncommitted
    Then the block holds the engine's values, not the caller's

  # AC-e08s03-07
  Scenario: The CLI writes the block and keeps the rest of the file
    Given a test repository with the fixture specs/state.yaml
    When the handoff CLI reads a complete input
    Then it exits 0
    And the waivers, metrics and the other keys are byte-identical

  # AC-e08s03-08
  Scenario Outline: The CLI exit codes
    Given a test repository
    When the handoff CLI reads <request>
    Then it exits <code> and the file is unchanged when <code> is not 0
    Examples:
      | request                     | code |
      | a note of 4001 code points  | 1    |
      | text that is not JSON       | 2    |
      | a JSON list, not an object  | 2    |
```

## Steps

1. RED then GREEN (ref: §1 decision 5): write the `setMapping` tests in
   `src/state-file.mapping.test.ts` for AC-01 and AC-02 and record the
   failure; then add `setMapping` and `writeStateMapping` to
   `src/state-file.ts` → verify: `node --test src/state-file*.test.ts &&
   npm run typecheck`
2. RED then GREEN (ref: §1 decisions 1 to 3): write `src/handoff.test.ts`
   for AC-03 to AC-06 in `makeTestRepo()` repositories and record the
   failure; then write `src/handoff.ts` and export the uncommitted-paths
   function from `src/tree.ts` → verify: `node --test src/handoff.test.ts
   src/tree.test.ts && npm run typecheck`
3. RED then GREEN (ref: §3 handoff CLI): write `src/handoff-cli.test.ts`
   for AC-07 and AC-08 and record the failure; then write
   `src/handoff-cli.ts` → verify: `node --test src/handoff.test.ts
   src/handoff-cli.test.ts && npm run typecheck`
4. Change the `handoff` row in `docs/STATE.md`, name `handoff.ts` and
   `handoff-cli.ts` in the AGENTS.md Architecture section, then run
   Preflight (ref: §3 MODIFIED) → verify: `grep -q 'handoff-cli' AGENTS.md
   && grep -q 'written_at' docs/STATE.md && yamllint specs && bash
   tools/validate-specs-yaml.sh && bash tools/check-gate-ignores.sh && npm
   run typecheck && npm test`

Red-flag check: I caught two. First, I nearly kept "a thin shell on the
state writer of e08s01" from the tasks file. That writer cannot add a key
or a list, so the story would have failed at the first write; decision 5
names the missing edit. Second, I nearly added a cap on the number of
`files`. No fault asks for it, and the 1 MiB file limit already bounds
the block, so it stays out.

## 4. Dependencies (slopcheck)

- No new package. `yaml` 2.9.1 `[OK]` (e08s01) renders the mapping.

## 5. Out of scope

- Checking the handoff at resume: e08s04.
- Calling the handoff CLI from a host or a skill (e11, or a later story).
- A commit hash in the block (decision 3).
- Adding a `handoff` key to a state file that has none: the writer
  refuses, and the error names the key.
- The e08s02 review notes left for later (readStateFields value check,
  one shared readStateText, a union type for stateFields, the NEL error
  that does not name the key). They are not needed here.
- The global scripts that rewrite `specs/state.yaml`.

## 6. Risks

- **The new edit is the riskiest code in e08.** It edits the CST like
  `setField` does. The same read-back check guards it: text whose data is
  not the old data with one key replaced never reaches the disk (AC-01,
  AC-02).
- **`git status` paths in odd encodings.** Paths are read with `-z`, so
  spaces and newlines in names are kept; a path that is not valid UTF-8
  is refused with an error that names it, not written as broken text.
- **The note is free text in YAML.** It may hold line breaks and quotes.
  The yaml package picks the scalar style, and the read-back and PyYAML
  checks refuse any text that would read back differently.
