# e08s01 — A caller sets one field of a state file and nothing else changes

**type:** feat
**risk:** P1
**context:** engine
**bcps:** 5
**epic:** e08 (State and handoff, B2)
**research story:** none (SYNTHESIS candidate epic B2: workflow state is plain
files written only by the engine through a format-preserving writer [S12][S13])
**branch:** e08s01-state-writer

## 1. Purpose

Three times a tool rewrote a state file in another style: the global
scripts dropped the `---` line, the comments and the folded scalars of
`specs/state.yaml` and `specs/execution-status.yaml` (BUG-001, BUG-004,
BUG-005). `tools/restore-yaml-style.py` puts the old text back after the
fact. This story makes the rewrite not happen for the engine: a caller names
one field and a value, the engine changes that field on disk, and every
other byte of the file stays as it was.

Library facts, read 2026-11-13 through Context7 `/eemeli/yaml/v2.9.1`
(docs/05_content_nodes.md, docs/07_parsing_yaml.md, tag v2.9.1):

- **The Document API does not keep the text.** "Due to implementation
  details, the library's comment handling is not completely stable"
  (05_content_nodes.md, "Comments and Blank Lines").
- **The CST keeps it.** `CST.stringify` "simply concatenates the sources in
  their logical order" (07_parsing_yaml.md, `CST.stringify`).
- **`CST.setScalarValue(token, value, context?)`** "Sets the value of
  `token` to the given string `value`, overwriting any previous contents and
  type", keeping comments where it can. `context.type` defaults to "the
  previous type of the `token`". It "does not support any schema operations
  and won't check for such conflicts" (07_parsing_yaml.md).

Spike, 2026-11-13, yaml 2.9.1 in the scratchpad, on this repository's files
at `aac82fa`:

- `Parser` then `CST.stringify` gave back the same bytes for
  `specs/state.yaml`, `specs/execution-status.yaml`,
  `specs/release-plan.yaml` and `specs/epics/e08-state-and-handoff/epic.yaml`.
  `parseDocument(...).toString()` changed 495 lines of `state.yaml`, 138 of
  `release-plan.yaml`, 26 of `epic.yaml` and 12 of `execution-status.yaml`.
- `setScalarValue` on `handoff.next_skill`, `active_story` and `vcs.branch`
  changed one line each.
- The string `"true"`, written with the old PLAIN type, read back as the
  boolean `true`; `"123"` as a number; `"null"` as null. With
  `type: 'QUOTE_DOUBLE'` it read back as the string.
- A 200-character value was written on one 209-column line: the CST layer
  never folds.

Owner decisions (2026-11-13, plan-work; all four recommendations taken):

1. **Use yaml 2.9.1 and its CST layer**, not the Document API and not a
   hand-written line editor. Only documented functions: `Parser`,
   `CST.isScalar`, `CST.resolveAsScalar`, `CST.setScalarValue`,
   `CST.stringify`, and `parseDocument` for the check after the edit.
2. **No folding in this story.** A long value goes on one line. `.yamllint`
   already skips line length for `specs/state.yaml` only. e08s03, which
   writes the long handoff note, decides folding if it needs it.
3. **Extract the file helpers into one shared module.** The non-blocking,
   regular-file-only read (BUG-007) and the temp-file-then-rename write move
   unchanged from `src/claude-settings-file.ts` to `src/regular-file.ts`,
   and the install and the state writer both use them.
4. **Waivers for e08 only, as for e07:** plan-consistency-check missing-spec
   findings for e08s02 to e08s04, and gate-trace R1 for undone e08 stories
   with no code tags (state.yaml `waivers`).

## 2. Zoom-out

- **`src/claude-settings-file.ts`** (e07s03, e07s04; 169 lines). Purpose:
  the file half of the Stop-hook install, and the settings reads of the live
  check. Callers: `claude-install-cli.ts` (`installInProject`) and
  `claude-live-cli.ts` (`readSettings`, `userSettingsPath`, `isGitRoot`),
  and `claude-settings-file.test.ts`. Contracts:
  `readSettings` opens without blocking, follows a symlink only when told,
  reads only a regular file of at most 1 MiB, and returns its mode; a write
  goes through a temp file in the same directory and a rename, keeps the
  mode, and leaves no temp file behind; every failure is a returned value.
  This story moves the generic half out and keeps every contract and every
  exported name.
- **`src/tree.ts`** (e06s02). Purpose: the working-tree fingerprint.
  Callers: the gate and the engine. Contract: `repositoryRoot(cwd)` is the
  output of `git rev-parse --show-toplevel`. This story exports it for the
  state CLI; nothing else changes.

`assess-impact` is not run as a separate skill: the only existing module
that changes is `claude-settings-file.ts`, its callers do not change, and
its tests and the install CLI tests run through the real file system.

## 3. Requirements

#### MODIFIED: where the regular-file read and the atomic write live

- **Before:** `src/claude-settings-file.ts` held `openIfExists`,
  `closeQuietly`, `removeQuietly` and `writeAtomic` as private functions,
  and `readSettings` read with the 1 MiB settings cap. The temp file was
  named `settings.json.<hex>.tmp`.
- **After:** `src/regular-file.ts` exports
  `readRegularFile(path, { follow, maxBytes })` and
  `writeAtomic(path, text, mode)`, with the same rules and messages. The
  temp file is named `<base name>.<hex>.tmp`, which is the same name for
  `settings.json`. `claude-settings-file.ts` keeps `readSettings(path,
  follow)` as a call to `readRegularFile` with `maxSettingsBytes`, and every
  name it exports today. No behaviour changes.
- **Reason for Depth:** two writers must keep the same BUG-007 and
  crash-safety rules; a copy would drift.

#### MODIFIED: the shared read refuses invalid UTF-8 (review round 3)

- **Before:** `readSettings` decoded with `readFileSync(fd, 'utf8')`, which
  turns each invalid byte into U+FFFD. The install would then write those
  replacement characters back, changing bytes it never meant to touch.
- **After:** `readRegularFile` decodes strictly and returns
  `{ ok: false, error: '<path> is not valid UTF-8' }`. A leading BOM is kept
  as text, as before. This applies to the settings read of the Stop-hook
  install and the live check too: a `settings.json` with invalid UTF-8 is now
  refused instead of silently rewritten. The owner approved this on
  2026-11-13 (review round 3, A2 and B2).

#### ADDED: the field writer, `src/state-file.ts`

- `setField(text, path, value)` is a pure function. `path` is a non-empty
  list of keys; `value` is a string, a finite number, a boolean or null.
  It returns `{ ok: true, text }` or `{ ok: false, error }`, never throws
  for bad input.
- The text must be exactly one YAML document that `parseDocument` reads
  with no errors. Each key of `path` must name an entry of a block mapping,
  matched by its resolved key (`CST.resolveAsScalar`); the last one must
  hold a scalar. A missing key, a flow mapping, a sequence, a mapping as the
  last value, or an alias is an error. The writer never adds a key.
- A string is written with the scalar's old type. A number, a boolean or
  null is written PLAIN as YAML text (`null`, `true`, `42`).
- After the edit the writer parses the new text. It is accepted only when
  there are no errors and the data equals the old data with that one field
  set to `value`. A string that fails this is written again with
  `QUOTE_DOUBLE` and checked again. A value that still fails is an error,
  and no text is returned.
- A field that already holds `value` gives back the same text.
- Every line before and after the lines of the edited value is byte for
  byte the same.

#### ADDED: the file operation, in `src/state-file.ts`

- `writeStateField(root, file, path, value)` resolves `file` against
  `root`. The parent directory, after resolving symlinks, must be inside
  `root`, after resolving symlinks. The file itself must not be a symlink
  (`follow: false`), must be a regular file, and must be at most 1 MiB.
- It reads through `readRegularFile`, calls `setField`, and writes through
  `writeAtomic` with the old mode, only when the text changed. It returns
  `{ ok: true, action: 'written' | 'unchanged', file }` or
  `{ ok: false, error }`. A file that cannot be read or parsed is never
  written.

#### ADDED: the CLI, `src/state-cli.ts`

- A thin shell. It reads one JSON object from stdin,
  `{ "file": string, "path": string[], "value": string | number | boolean
  | null }`, finds the repository root of its working directory
  (`repositoryRoot`), and calls `writeStateField`.
- It prints one JSON line on stdout: the result object. Exit 0 when the file
  was written or already held the value; 1 when the engine refused (not a
  regular file, outside the root, invalid YAML, path not found, value not
  kept); 2 for input it cannot read (not JSON, wrong shape, not in a git
  repository).

## 17. Acceptance criteria (Gherkin)

```gherkin
Feature: Set one field of a state file

  # AC-e08s01-01
  Scenario: The file helpers move with no change in behaviour
    Given the file helpers in src/regular-file.ts
    When the claude-settings-file, claude-install-cli and claude-live tests run
    Then every one of them passes unchanged
    And a settings write still leaves no temp file behind

  # AC-e08s01-02
  Scenario Outline: Setting a field to the value it holds changes nothing
    Given the fixture <file>
    When setField sets <path> to the value it already holds
    Then the text that comes back is the same bytes
    Examples:
      | file                         | path               |
      | state.yaml                   | handoff.next_skill |
      | execution-status.yaml        | development_status.e08s01 |
      | epic.yaml                    | done_when          |

  # AC-e08s01-03
  Scenario Outline: One field changes and nothing else does
    Given the fixture <file>: state.yaml is in the PyYAML style with long
      quoted scalars that wrap over lines; execution-status.yaml has the
      leading ---; epic.yaml has the leading ---, comments and a folded
      scalar (>-)
    When setField sets <path> to <value>
    Then only the lines of that value differ from the fixture
    And parsing the new text gives <value> at <path>
    And every other field has its old value
    And the leading ---, the comments and the other folded scalars stay
    Examples:
      | file                  | path                      | value          |
      | state.yaml            | active_story              | "next-story"   |
      | state.yaml            | handoff.next_skill        | "verify-work"  |
      | state.yaml            | vcs.branch                | "main"         |
      | state.yaml            | active_story              | null           |
      | state.yaml            | handoff.note              | "Short note."  |
      | execution-status.yaml | development_status.e08s01 | "done"         |
      | epic.yaml             | wsjf                      | 4.2            |
      | epic.yaml             | done_when                 | a short string |

  # AC-e08s01-04
  Scenario Outline: A string that would read as another type is quoted
    Given the fixture state.yaml
    When setField sets active_story to the string <value>
    Then the line is active_story: <written>
    And parsing it gives the string <value>
    Examples:
      | value                 | written                 |
      | "true"                | "true"                  |
      | "123"                 | "123"                   |
      | "null"                | "null"                  |
      | "needs: quotes # yes" | "needs: quotes # yes"   |
      | ""                    | ""                      |

  # AC-e08s01-05
  Scenario Outline: What the writer refuses
    Given <text>
    When setField runs
    Then the result is an error that names the problem
    And no text comes back
    Examples:
      | text                                                   |
      | text that is not valid YAML                            |
      | two YAML documents                                     |
      | a path whose key does not exist                        |
      | a path whose last value is a mapping                   |
      | a path that goes through a sequence                    |
      | an empty path                                          |
      | a flow mapping on the path                             |
      | an alias as the last value                             |
      | a value that is not a string, finite number, boolean or null |

  # AC-e08s01-06
  Scenario: The live state file round-trips
    Given this repository's specs/state.yaml, read when the test runs
    When setField sets handoff.next_skill to the value it holds
    Then the text that comes back is the same bytes

  # AC-e08s01-07
  Scenario Outline: The CLI writes one field in a repository
    Given a temporary git repository with a copy of the state.yaml fixture
    When the state CLI runs there with <input>
    Then it prints one JSON line with action <action>
    And it exits 0
    And the file's mode is unchanged
    And no temp file is left in the directory
    Examples:
      | input                                               | action    |
      | file specs/state.yaml, handoff.next_skill, "x"      | written   |
      | file specs/state.yaml, handoff.next_skill, its value | unchanged |

  # AC-e08s01-08
  Scenario Outline: The CLI refuses and leaves the file as it was
    Given a temporary git repository
    When the state CLI runs there with <case>
    Then it exits <code> and prints one JSON line with an error
    And no file in the repository changed
    Examples:
      | case                                               | code |
      | a state file that is a symlink                     | 1    |
      | a file outside the repository root                 | 1    |
      | a FIFO in place of the state file                  | 1    |
      | a state file that is not valid YAML                | 1    |
      | a key path that does not exist                     | 1    |
      | stdin that is not JSON                             | 2    |
      | a path that is not a list of strings               | 2    |
      | a working directory that is not in a git repository | 2   |
```

## Steps

1. Refactor, no behaviour change: move `openIfExists`, `closeQuietly`,
   `removeQuietly` and `writeAtomic` to `src/regular-file.ts`, export
   `readRegularFile` and `writeAtomic`, and point
   `claude-settings-file.ts` at them (AC-01) → verify: `node --test
   src/claude-settings-file.test.ts src/claude-install-cli.test.ts
   src/claude-live.test.ts src/claude-live-cli.test.ts && npm run typecheck`
2. RED then GREEN: add `yaml` 2.9.1 as an exact runtime dependency; copy
   `specs/state.yaml`, `specs/execution-status.yaml` and the e08
   `epic.yaml` to `src/fixtures/`; write `src/state-file.test.ts` for
   AC-02 to AC-06 and record the failure; then write `setField` in
   `src/state-file.ts` → verify: `node --test src/state-file.test.ts && npm
   run typecheck`
3. RED then GREEN: `src/state-cli.test.ts` for AC-07 and AC-08 through the
   real CLI in `makeTestRepo()` repositories; then `writeStateField`, the
   `repositoryRoot` export and `src/state-cli.ts` → verify: `node --test
   src/state-file.test.ts src/state-cli.test.ts && npm run typecheck`
4. Name `regular-file.ts`, `state-file.ts` and `state-cli.ts` in the
   AGENTS.md Architecture section, then run Preflight → verify: `grep -q
   'state-file' AGENTS.md && yamllint specs && bash
   tools/validate-specs-yaml.sh && bash tools/check-gate-ignores.sh && npm
   run typecheck && npm test`

Red-flag check: I caught three. First, I nearly took the Document API from
the slice note ("its Document API"); the spike showed it rewrites 495 lines,
so the plan uses the CST layer. Second, I nearly trusted
`setScalarValue` to quote as needed; its docs say it checks nothing, and the
spike turned `"true"` into a boolean, so the writer checks every edit by
parsing the result. Third, I nearly wrote a second copy of the
regular-file read; the owner chose to share it.

## 4. Dependencies (slopcheck)

- **yaml 2.9.1** `[OK]`. Author Eemeli Aro (eemeli/yaml), ISC licence, no
  dependencies, published 2026-09-11 (npm registry `time`), 686 kB unpacked.
  Context7 lists it with source reputation High. It is the first runtime
  dependency of this repository; pin the exact version with no caret, as the
  dev dependencies are.

## 5. Out of scope

- Folding long values within 80 columns (owner decision 2). e08s03 decides.
- Adding a key, removing one, or writing a mapping or a sequence.
- Which fields the engine may change: e08s02.
- Writing or checking the handoff note: e08s03 and e08s04.
- Replacing `tools/restore-yaml-style.py`. The global scripts
  (`bp-timing.sh`, `record-cycle-time.sh`) still rewrite these files.
- A lock between two writers, and the read-then-write race: the engine is
  the only writer this story adds. A lock is a later story if two engine
  writers appear.
- Residual F5 (an unreadable ledger turns the stop rules off): owned by e09
  (owner decision, 2026-11-13, plan-work). e09 decides whether an unreadable
  ledger answers exhausted.

## 5a. Known limits (review rounds 1 to 3)

These change only the edited value's own text, so the byte-span check
allows them. e08s03, which writes the multi-line handoff note, decides
whether to handle them.

- A `|+` (keep) block scalar counts its trailing blank lines as part of
  its value. Setting it removes those lines with the old value, so a
  blank line before the next entry can go.
- A block scalar at the end of a file with no final newline gets one.
- A multi-line value is refused in a file with CRLF line endings,
  because the library writes LF inside it.
- yaml's YAML 1.1 schema reads a few strings as numbers that PyYAML
  reads as strings (`e01`), so such a value written as a plain string is
  double-quoted. That only adds quotes.
- A string is written plain only when it is printable ASCII with no
  space at either end and is not `=` or `<<`; anything else is
  double-quoted. A value holding NEL, LS or PS, or any character outside
  PyYAML's printable set (control characters other than tab, LF and CR,
  DEL, C1 controls, U+FFFE, U+FFFF, a lone surrogate), is refused (review
  rounds 2 and 3).
- A file whose data holds anything other than mappings, sequences and
  scalars (a `%YAML 1.1` directive with dates, or a tag such as
  `!!binary`) is refused with that reason (review round 3).
- The writer does not repair text it does not change. When a field
  already holds the value under YAML 1.2, the file is left as it is, even
  if PyYAML reads that text as another type (`a: yes` and the string
  `yes`). Review round 2, items A7 and B5.

## 6. Risks

- **A future YAML construct the writer garbles.** AC-06 round-trips the live
  `specs/state.yaml` on every test run, so a new construct fails a test
  before it fails a write. The check after each edit refuses any change to
  another field.
- **The library's CST type is internal-looking.** Only the documented `CST`
  functions are used, and the exact version is pinned. An upgrade runs the
  fixture tests first.
- **The parent directory can be swapped between the check and the write.**
  The agent can replace a directory after `realpath` and before the rename.
  It errs toward a refused or misplaced write, not a write outside the
  repository through the file name, which `follow: false` covers. The git-dir
  and path hardening is e10's, as for the ledger.
- **A crash between the temp file and the rename** leaves a `.tmp` file
  beside the state file, never a torn state file. No fsync: a power loss can
  lose the write (same as the install).
