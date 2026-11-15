# UI changes checked from screenshots

<!-- story: e11s05 -->

A change to the UI is reviewed from screenshots as well as from the diff.
The engine runs the owner's screenshot command, keeps the PNG files it
wrote, and the review council reads them under the same must-fix rule as
the code (`docs/REVIEW.md`). A model's score is reported, never a gate.

## The setting

A `ui` mapping in the same two files as the budget (`docs/BUDGET.md`):
`weftwork.yaml` at the repository root wins over the user file, key by key.
With no `ui` mapping in either file, UI checks are off.

```yaml
---
ui:
  screenshot: npx playwright test e2e/screenshots.spec.ts
  paths:
    - 'web/**'
    - '**/*.css'
  timeout_seconds: 600
```

| Key | What it is | Range | Built-in |
| --- | --- | --- | --- |
| `screenshot` | A command that writes PNG files into the folder named by `$WEFTWORK_SHOTS` | a non-empty command | none |
| `paths` | Glob patterns from the repository root (`path.matchesGlob`); a change that touches one is a UI change | 1 to 50 | none |
| `timeout_seconds` | Time for the screenshot command | 1 to 3600 | 600 |

`screenshot` and `paths` go together: a file that leaves one unset is an
error. The guard blocks the agent from editing either setting file
(`docs/GUARD.md`).

## Taking screenshots

```bash
echo '{"phase":"before"}' | node src/ui-cli.ts
echo '{"phase":"after"}' | node src/ui-cli.ts
```

`base` is optional in both: the commit the change is measured from. By
default it is the merge base of HEAD with `origin/HEAD`, `origin/main` or
`main`, the first that exists.

The engine empties `<git dir>/weftwork/ui/<phase>/`, runs `screenshot` in
the working tree with `WEFTWORK_SHOTS` set to that folder, and checks what
it wrote: at least one and at most 20 `.png` files, each with the PNG
signature and at most 20 MiB. It keeps a manifest with each file's size and
SHA-256, the branch, the base commit, and the fingerprint of the tree they show.

| Exit | First line | Meaning |
| --- | --- | --- |
| 0 | `weftwork ui: taken` | The screenshots are kept; one line each, with its path and hash |
| 0 | `weftwork ui: off` | No `ui` mapping; nothing ran |
| 1 | `weftwork ui: refused` | Before screenshots, but the tree already changes `ui.paths`, so they would show the change. The command does not run. |
| 1 | `weftwork ui: failed` | The command failed or timed out, wrote no PNG, wrote a file that is not one, or changed the tree |
| 2 | none | Bad input, no git working tree, a bad setting file; the reason is on stderr |

Take the before screenshots before the first edit to a UI file, and the
after ones once the done gate passed on the final tree.

## In the review

When `ui` is set and the change from the base touches `ui.paths`, the review
needs after screenshots of this branch and this exact tree. Without them it
answers `weftwork review: not run` (exit 4) and no reviewer runs. With them,
the engine adds the screenshot paths to the brief, before and after, and
asks each reviewer to open them. A reviewer may reply with one
`UI-SCORE: <0 to 10>` line. The report shows each score as
`ui score (<reviewer>): <n> of 10, reported, not a gate`, and lists every
screenshot with its path and hash, so the pull request shows them when the
report is pasted in. Only a must-fix blocks.

Before screenshots are optional in the review. When none were taken on this
branch and base, the brief says so and the council reads the after ones alone.

## A programmatic check wins

Where a test can check the UI (a visual regression test with a stored
baseline, an accessibility check, a layout assertion), put it in the verify
command. The done gate runs it and it gates; a model's view of a screenshot
does not.

## Limits

- The images stay in the engine's folder; the pull request lists them by
  path and hash, it does not embed them.
- A reviewer must be able to open a local image file. One that cannot
  reviews the diff alone, and should say so.
- The screenshot command comes from the setting files, so a repository's
  `weftwork.yaml` can name any command, as it can for the review council.
