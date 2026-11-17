# The base check

<!-- story: e13s04 -->

A passing test does not show that it tests the change: in one 2026 study,
of the LLM-written tests that failed on a changed program, more than 99
percent passed on the original program, so they checked the old behaviour
(R19). The base check runs each test file the change adds or edits against
the base commit, where it should fail. It reports, and never gates.

```bash
echo '{}' | node src/base-check-cli.ts
```

| Field | What it is |
| --- | --- |
| `base` | The commit to run the tests on. Optional; by default the merge base of `HEAD` with `origin/HEAD`, `origin/main` or `main`. |

## The setting

A `proof` mapping in the same two files as the budget (`docs/BUDGET.md`):
`weftwork.yaml` at the repository root wins over the user file, key by key.
No `proof` mapping means the check is off.

```yaml
---
proof:
  tests:
    - 'src/**/*.test.ts'
  run: 'node --test "$@"'
  share:
    - node_modules
  timeout_seconds: 600
```

| Key | What it is | Range | Built-in |
| --- | --- | --- | --- |
| `tests` | Glob patterns of test files, from the repository root | 1 to 50 | none; required |
| `run` | The command that runs the test files it gets as `"$@"`, in a shell | text | none; required |
| `share` | Paths linked from the working tree into the base worktree, such as an ignored dependency folder | 1 to 50 paths inside the repository | none |
| `timeout_seconds` | Time for one file's run | 1 to 3600 | 600 |

## How it runs

1. It lists the files changed from the base (tracked and untracked, not
   ignored) that match `tests` and are still files in the working tree.
2. It makes a temporary git worktree of the base, outside the repository,
   with git hooks off (`core.hooksPath=/dev/null`), links each `share`
   path into it, and copies the changed test files into it.
3. It runs `run` once per file, with the file as `"$@"`, in the worktree,
   and keeps what the run prints on stdout (the first 1 MiB).
4. It removes the worktree, whatever happened. The working tree and its
   index are not touched.

```text
weftwork base check: 1 of 2 changed test files fail on the base
base: 3db5d780a99f16c4588fa5266bc2791e4ad33c0d
fails on base: src/review/review-scope.test.ts
passes on base: src/old.test.ts (it does not show the change)
```

## Each test, with TAP

When the run of a file prints TAP (a `TAP version` line or a `1..<n>`
plan line), the check also reads each test in it. A test is new when its
name is not in the base version of the file; in a new file, every test is
new. Each new test that passes on the base gets its own line under the
file:

```text
weftwork base check: 1 of 1 changed test files fail on the base
base: 3db5d780a99f16c4588fa5266bc2791e4ad33c0d
fails on base: src/proof/base-check.test.ts
  new test passes on base: output that is not TAP: one outcome per file, no test names (it does not show the change)
```

There is no setting for this: the output says if it is TAP. To turn it on,
make `run` print TAP. For `node:test`:

```yaml
  run: 'node --test --test-reporter=tap "$@"'
```

Only leaf tests count. A suite, or a test with subtests, is left out, and
so are `SKIP` and `TODO` tests. When the output is not TAP, each file has
one outcome, as before.

| Exit | First line | Meaning |
| --- | --- | --- |
| 0 | `weftwork base check: <n> of <m> ...` | It ran; each file is `fails on base`, `passes on base`, `timed out on base` or `did not start on base` |
| 0 | `weftwork base check: no changed tests` | The change adds or edits no file in `proof.tests` |
| 0 | `weftwork base check: off` | No `proof` mapping |
| 2 | none | Bad input, a bad setting file, no base, or a worktree git could not make; the reason is on stderr |

Paste the output into the PR's Proof block. A file that passes on the base
needs a reason in the PR, or a test that fails without the change.

## Limits

- Without TAP, one outcome per file. A file with one new test and ten old
  ones fails on the base when the new test does, but one weak test in a
  file that also has a strong one is not seen.
- With TAP, a test is new only by its name. An old test that the change
  edits but does not rename is seen only by its file's outcome. A name
  that the base file holds in another place, or writes with other quotes
  or escapes, can make a test look old or new when it is not.
- A new test file fails on the base when it imports code the base does not
  have. That is a failure without the change, and also the weakest one.
- A deleted test is not run. A change with no test file in `tests` shows
  `no changed tests`; for a behaviour change that is itself worth a line
  in the PR.
- `run` is a command from the setting files, with the same trust as the
  verify command.
