# UI changes checked from screenshots

<!-- story: e11s05, e11s06, e11s07 -->

A change to the UI is reviewed from screenshots as well as from the diff.
The engine runs the owner's screenshot command, keeps the PNG files it
wrote, and the review council reads them under the same must-fix rule as
the code (`docs/REVIEW.md`). The council reviews the change as a design
audit, against the project's design reference when one is set. A model's
score is reported, never a gate.

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
  design: DESIGN.md
```

| Key | What it is | Range | Built-in |
| --- | --- | --- | --- |
| `screenshot` | A command that writes PNG files into the folder named by `$WEFTWORK_SHOTS` | a non-empty command | none |
| `paths` | Glob patterns from the repository root (`path.matchesGlob`); a change that touches one is a UI change | 1 to 50 | none |
| `timeout_seconds` | Time for the screenshot command | 1 to 3600 | 600 |
| `design` | The design reference: a path from the repository root to a file of colours, type, spacing and component rules (a DESIGN.md; bigpowers `extract-design` can make one) | a path inside the repository | none |

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

Name each screenshot by screen, viewport and state, so a reviewer knows what
it shows: `<screen>.<viewport>.<state>.png`, for example `home.mobile.png`,
`home.desktop.png` or `login.mobile.error.png`. Take the viewports the
project supports and the states the change touches. A name may not hold a
comma, since `WEFTWORK_IMAGES` joins the paths with commas.

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

### The design audit

The brief for a UI change also holds a design checklist and a severity rule
(e11s06). The checklist: consistency with the design reference and the
existing screens; hierarchy; spacing and alignment; typography; colour and
contrast; states (hover, focus, disabled, error, empty, loading).

A design finding is MUST-FIX only for an objective break: the change breaks
the design reference, text fails WCAG 2 AA contrast, or the layout is broken
at a viewport the screenshots show. A judgement call is SHOULD-FIX: it is
listed in the pull request and does not block.

A design MUST-FIX names its evidence: the rule of the design reference and
the value that breaks it, the two colours and their ratio, or the screenshot
and the element that is broken. A contrast or exact-colour finding seen only
in a screenshot is SHOULD-FIX, and names the programmatic check that would
settle it, since a vision model does not measure colour from pixels
reliably (e11s07, `docs/research/R18-vision-design-judging.md`).

When `ui.design` is set, the engine reads that file and puts it in the brief
between two marker lines. It must be a regular file (not a symlink), inside
the repository once its folders are resolved, valid UTF-8, at most 64 KiB. A file that is missing or cannot be used stops the
review with exit 2, and no reviewer runs. Without `ui.design`, the brief says
there is no design reference, and the council judges consistency against the
existing screens.

### The images

For a UI change, each reviewer runs with `WEFTWORK_IMAGES` set to the
absolute paths of the screenshots, before then after, joined by commas. A
reviewer that can attach images uses it, so the model gets the images and
not only their paths. The built-in council does this:

```bash
codex exec --ignore-user-config --sandbox read-only --ephemeral ${WEFTWORK_IMAGES:+--image "$WEFTWORK_IMAGES"} -
```

`${WEFTWORK_IMAGES:+...}` adds `--image` only for a UI change. Write a
council entry in `weftwork.yaml` the same way. For a change that is not a UI
change, `WEFTWORK_IMAGES` is not set, even when the caller had set it. A
screenshot path with a comma of its own (in the git directory's path, say)
stops the review with exit 2.

## A programmatic check wins

Where a test can check the UI (a visual regression test with a stored
baseline, an accessibility check, a contrast ratio, a colour that is not a
design token, a layout assertion), put it in the verify command. The done gate runs it and it gates; a model's view of a screenshot
does not.

## Limits

- The images stay in the engine's folder; the pull request lists them by
  path and hash, it does not embed them.
- A reviewer that cannot take `WEFTWORK_IMAGES` must open the image files by
  path. One that can do neither reviews the diff alone, and should say so.
- Vision models judge visual design weakly: absolute scores rarely match
  people, zero-shot critiques are often wrong, and fine colour and spatial
  detail is misread; comparing two screens works better
  (`docs/research/R18-vision-design-judging.md`). Hence the severity rule
  above, and the score never gates. Those measurements are of 2024 and 2025
  models; none of today's council.
- The screenshot command comes from the setting files, so a repository's
  `weftwork.yaml` can name any command, as it can for the review council.
