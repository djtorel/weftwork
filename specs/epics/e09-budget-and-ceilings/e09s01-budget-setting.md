# e09s01 — The owner sets the engine's limits in a budget setting file

**type:** feat
**risk:** P1
**context:** engine
**bcps:** 5
**epic:** e09 (Budget and ceilings, B5)
**research story:** none (SYNTHESIS candidate epic B5, budget setting:
a per-repository setting in a plain file and a user-level default that
a repository overrides; the owner's candidate requirement of 2026-11-11
[S15][S9])
**branch:** e09s01-budget-setting

## 1. Purpose

The engine has two stop rules: `maxFailures` (failed runs in a row of
one command, default 5, answer `exhausted`) and `stallAfter` (failed
runs on the same tree, default 3, answer `stalled`). Today only the JSON
request can set them. The Claude Code hook builds its request from the
command alone (`src/claude-hook.ts`, `hookRequest`), so every hook run
uses the built-in defaults and the owner has no way to change them.

This story adds the budget setting: a plain file in the repository and
a user-level default. The engine reads both and uses them for every run,
from the CLI and from the hook. It is the tracer bullet for B5: the
owner writes a file and the engine's answer changes. Later stories add
keys to the same file (e09s02 `maxRuns`, e09s03 `reserveRuns`).

Decisions recorded at plan-work (2026-11-14). The owner took all four
recommendations:

1. Files. The repository file is `weftwork.yaml` at the repository
   root, with a top-level `budget` mapping. The user file is
   `$XDG_CONFIG_HOME/weftwork/config.yaml`, or
   `$HOME/.config/weftwork/config.yaml` when `XDG_CONFIG_HOME` is unset,
   empty or not absolute (as the XDG Base Directory spec says), with the
   same `budget` mapping.
2. Precedence. Built-in, then the user file, then the repository file;
   each overrides the one before. A request value is used only when it
   is lower than the value from the files, so an agent that writes the
   request cannot raise the owner's limit.
3. A bad file is refused: the engine does not run, and the answer names
   the file and the key. The CLI exits 2 (bad input); the hook blocks
   the stop with that text, as it does for any input it cannot use.
4. Keys are camelCase, the names the JSON request uses: `maxFailures`,
   `stallAfter`.

## 2. Zoom-out

- `src/gate.ts`. Purpose: run the declared command and give the
  verdict; `parseRequest` reads and checks the request. Callers:
  `src/cli.ts`, `src/claude-hook.ts`. Contract: `stallAfter` is an
  integer from 2 to 1000, `maxFailures` from 1 to 1000; other keys are
  ignored. This story exports the range check so both readers use one
  rule.
- `src/engine.ts`. Purpose: the stop rules and the terminal states.
  Callers: `src/cli.ts`, `src/claude-hook-cli.ts`. Contract: it reads
  `request.maxFailures ?? defaultMaxFailures` and the same for
  `stallAfter`. Unchanged: the budget is applied to the request before
  `runEngine`, which then always gets both values.
- `src/cli.ts` and `src/claude-hook-cli.ts`. Purpose: thin shells.
  Each gains one call, `applyBudget`, between reading the request and
  `runEngine`, and maps its error to its own bad-input path.
- `src/regular-file.ts`. `readRegularFile(path, { follow, maxBytes })`
  reads the files, with the size cap and the symlink rule.

## 3. Requirements

- **MODIFIED R1, where the limits come from.**
  **Before:** `maxFailures` and `stallAfter` come from the request, or
  the built-in defaults (5 and 3).
  **After:** they come from the built-in defaults, overridden by the
  user file, overridden by the repository file; a request value is used
  only when it is lower.
- **ADDED R2.** With neither file present, every answer is the same as
  before this story.
- **ADDED R3.** A file that exists but cannot be used is refused before
  anything runs and before anything is logged: unreadable, larger than
  64 KiB, not valid UTF-8, not YAML (duplicate keys count), a top-level
  value that is not a mapping, a `budget` that is not a mapping, a key
  under `budget` that is not known, or a value out of its range. The
  error names the file and, where there is one, the key.
- **ADDED R4.** Top-level keys other than `budget` are ignored, since
  later stories add them.
- **ADDED R5.** The repository file must be a regular file and not a
  symlink. The user file may be a symlink (dotfile managers link it);
  it must resolve to a regular file.
- **ADDED R6.** Tests never read the real user file: every test that
  starts a CLI sets `XDG_CONFIG_HOME` to an empty temporary directory.

## 17. Acceptance criteria (Gherkin)

```gherkin
AC-e09s01-01  Given no weftwork.yaml and no user file
              When the CLI runs a failing command on an unchanged tree
              Then the third answer is stalled, as before (stallAfter
              3 trips before maxFailures 5) (R2)

AC-e09s01-02  Given weftwork.yaml with budget.maxFailures 2
              When the CLI runs a failing command twice
              Then the second answer is exhausted (exit 5)
              And a third call is refused without running

AC-e09s01-03  Given only a user file with budget.maxFailures 2
              Then the user value is used
              And given weftwork.yaml with budget.maxFailures 4 as well
              Then the repository value, 4, is used

AC-e09s01-04  Given weftwork.yaml with budget.maxFailures 4
              When the request sets maxFailures 2, the limit is 2
              When the request sets maxFailures 9, the limit is 4

              (AC-03 and AC-04 are checked on resolveLimits and
              applyBudget, since stallAfter 3 hides a maxFailures of 4
              in a CLI run on one tree.)

AC-e09s01-05  Given weftwork.yaml with budget.maxFailures 0, or an
              unknown key budget.maxFailure, or text that is not YAML
              When the CLI runs
              Then it exits 2, the error names weftwork.yaml and the key
              And the command did not run and the ledger has no new line

AC-e09s01-06  Given weftwork.yaml is a symlink to a good file
              Then the CLI exits 2
              And given the user file is a symlink to a good file
              Then its values are used

AC-e09s01-07  Given weftwork.yaml with a top-level key other: 1 and a
              good budget mapping
              Then the budget is used and other is ignored

AC-e09s01-08  Given weftwork.yaml with budget.maxFailures 2
              When the Claude Code hook runs a failing command twice
              Then the second answer is the exhausted one
              And given a bad weftwork.yaml, the hook blocks the stop
              with text that names the file

AC-e09s01-09  Given weftwork.yaml larger than 64 KiB
              Then the CLI exits 2 and names the size cap
```

## Steps

1. RED, then GREEN. Write `src/budget.test.ts` and record the failure.
   Write `resolveLimits(sources)` in `src/budget.ts`: a pure function
   over the user text, the repository text (each null when absent) and
   the request; it parses the YAML, checks every rule of R3, R4 and the
   ranges, and returns the merged limits or an error value. Export the
   range check from `src/gate.ts` and use it.
   → verify: `node --test src/budget.test.ts && npm run typecheck`
2. RED, then GREEN. `applyBudget(request, env)`: find the repository
   root and the user path, read both through `readRegularFile` (64 KiB,
   follow false for the repository file, true for the user file), and
   return the request with both limits set, or an error. Tests in
   `src/budget.files.test.ts` use `makeTestRepo()` and a temporary
   `XDG_CONFIG_HOME`.
   → verify: `node --test src/budget.test.ts src/budget.files.test.ts && npm run typecheck`
3. RED, then GREEN. `src/cli.ts` calls `applyBudget` after
   `parseRequest`; an error goes to the bad-input path (exit 2). Every
   CLI test helper sets `XDG_CONFIG_HOME` to an empty temporary
   directory (R6). Tests in `src/cli.budget.test.ts` cover AC-01 to 07
   and 09.
   → verify: `node --test src/cli.budget.test.ts src/cli.test.ts src/cli.ledger.test.ts src/cli.states.test.ts && npm run typecheck`
4. RED, then GREEN. `src/claude-hook-cli.ts` calls `applyBudget` after
   `hookRequest`; an error blocks the stop. Tests in
   `src/claude-hook-cli.budget.test.ts` cover AC-08; the hook test
   helpers isolate `XDG_CONFIG_HOME` too.
   → verify: `node --test src/claude-hook-cli.budget.test.ts src/claude-hook-cli.test.ts && npm run typecheck`
5. Write `docs/BUDGET.md` (files, keys, ranges, precedence, the bad-file
   rule, an example) and name `src/budget.ts` in the AGENTS.md
   Architecture section. Run the Preflight line.
   → verify: `grep -q 'budget.ts' AGENTS.md && test -f docs/BUDGET.md && yamllint specs && bash tools/validate-specs-yaml.sh && bash tools/check-gate-ignores.sh && npm run typecheck && npm test`

## Verification Script (Step-by-Step)

1. `cd /home/domtorr/Dev/personal_projects/weftwork`
2. `printf 'budget:\n  maxFailures: 2\n' > weftwork.yaml`
3. Run `echo '{"command":"false"}' | node src/cli.ts; echo $?` twice.
   The first answer is `failed` (exit 1); the second is `exhausted`
   (exit 5).
4. `printf 'budget:\n  maxFailures: 0\n' > weftwork.yaml` and run the
   command again: exit 2, and the error names `weftwork.yaml` and
   `maxFailures`.
5. `rm weftwork.yaml` and clear the ledger lines this test wrote, or
   run it in a scratch clone.

## 4. Dependencies (slopcheck)

- `yaml` 2.9.1 [OK]: already a pinned runtime dependency (e08s01). No
  new package.

## 5. Out of scope

- `maxRuns` (e09s02), `reserveRuns` (e09s03), the budget report
  (e09s04).
- Protecting `weftwork.yaml` from the agent: the agent can edit it,
  the T3 class in `specs/security/REVIEW.md`. Protected paths are e10.
- A `timeoutMs` key: the hook fixes its timeout to fit the host's hook
  deadline, so a file value could break it. A later story can add it.
- Writing the file from the engine; the owner edits it by hand.

## 6. Risks

- Existing tests read the owner's real user file and change behaviour
  when one exists. Detect: step 3 and step 4 isolate `XDG_CONFIG_HOME`
  in every helper; a test sets a user file with `maxFailures 1` and
  the old suites still pass with it present in the real home.
- The hook now reads two more files on every Stop. Both are capped at
  64 KiB; the hook's deadline still applies.
- `repositoryRoot` fails outside a git repository. Then there is no
  repository file; only the user file and the built-ins apply. A test
  covers it.
