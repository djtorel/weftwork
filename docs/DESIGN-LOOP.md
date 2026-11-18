# The design loop

<!-- story: e16s02 -->

A UI task gets design review rounds as well as code review rounds. In each
round, reviewers grade screenshots of the design as a UI and UX designer
would, against a fixed rubric, and mark each problem with a numbered box on
the image. The agent changes the design for the marks and runs the next
round. The loop goes on until every criterion meets the pass mark, or until
it reaches its ceiling or the grades stop rising. Each round is kept as a
Markdown page with its marked images, in an untracked folder that the owner
can read.

The grade decides only whether the design loop goes on. It never gates a
merge: vision models judge design weakly in absolute terms
(`docs/research/R18-vision-design-judging.md` [S1][S3][S5]), so the code
review (`docs/REVIEW.md`, `docs/UI.md`) and its must-fix rule stay the merge
gate. A design that ends below the pass mark is listed in the pull request
for the owner. It does not make the pull request a draft.

## When it runs

The `all-ready` and `all-in` skills run the loop for a task that adds or
changes a screen, a component or a style:

1. **Canvas loop (optional).** When the session has a design canvas tool
   (for example the Doop MCP server), the agent designs the screen in the
   canvas first and runs rounds on the frames with `"loop": "canvas"`.
   Changing a design in a canvas is cheaper than changing it in code.
2. **App loop.** The agent builds the design, takes screenshots of the
   running app (`weftwork ui` when `weftwork.yaml` sets `ui`, otherwise the
   project's own tool, such as Playwright), and runs rounds with
   `"loop": "app"`, the default.
3. **Code review** follows as usual, with the after screenshots.

## A round

```bash
echo '{"images":["/tmp/shots/home.desktop.png","/tmp/shots/home.mobile.png"],"brief":"The home screen of a notes app: people open it many times a day to find a recent note.","loop":"app"}' \
  | node src/design-cli.ts
```

| Field | What it is |
| --- | --- |
| `images` | 1 to 20 PNG files, as paths from the current folder: regular files (not symlinks), each at most 20 MiB, with distinct file names and no comma in the name. Name each one `<screen>.<viewport>.<state>.png`, as in `docs/UI.md`. |
| `brief` | What the screen is for, who uses it, in what context, and what changed. The reviewers grade fit to purpose against it, so write it as a designer's brief. At most 20,000 characters. |
| `loop` | The loop's name, for example `canvas` or `app`. Rounds are counted per branch and loop. Optional, `app` by default. |

The engine copies the images into the round's folder, and the reviewers read
the copies. So the record keeps what was reviewed, even when the canvas or
the app changes later. Each reviewer gets the prompt on stdin, with
`WEFTWORK_IMAGES` set to the copies (joined by commas) and
`WEFTWORK_IMAGES_DIR` set to their folder. The prompt holds the brief, each
image with its size in pixels, the design reference (`ui.design`, when it is
set), the newest lessons (below), the rubric and, from round 2 on, the last
round's grades and marks.

| Exit | First line | Meaning |
| --- | --- | --- |
| 0 | `weftwork design: pass` | Every criterion meets the pass mark and no reviewer found an objective break |
| 1 | `weftwork design: changes` | Change the design for each mark, take new images and run the next round |
| 3 | `weftwork design: no-verdict` | Every reviewer failed, or the tree changed during the round (a reviewer must be read-only) |
| 5 | `weftwork design: stopped`, or a round's report that ends with `stop:` | The ceiling, or the grades stopped rising. Run no more rounds; list what is still below the mark in the pull request. |
| 2 | none | Bad input, a detached HEAD, or a setting or file that cannot be used. The reason is on stderr. |

`{"status": true, "loop": "app"}` prints the loop's rounds and where its
record is. `{"lesson": "...", "from": "..."}` keeps a lesson (below).

## The rubric

Each reviewer grades eight criteria from 1 to 5. The criteria come from
Nielsen's ten usability heuristics
(https://www.nngroup.com/articles/ten-usability-heuristics/) and the design
checklist in `docs/UI.md`:

| Criterion | What it asks |
| --- | --- |
| `purpose` | The screen does the job in the brief, for its user, in that context |
| `hierarchy` | The most important thing is seen first, and the primary action is clear |
| `layout` | Grid alignment, consistent spacing, grouping, nothing overlaps, clips or overflows |
| `typography` | A clear type scale, readable line length and height, no text cut off |
| `colour` | A restrained palette with meaning, readable text, no state shown by colour alone |
| `consistency` | The design reference, its tokens and components, and the other screens |
| `interaction` | Affordance, labels, feedback, states (hover, focus, disabled, error, empty, loading) |
| `accessibility` | Visible focus, touch targets of about 44px, text alternatives, readable sizes |

Each grade has a written anchor: 1 broken, 2 poor, 3 acceptable with clear
problems, 4 good with only polish left, 5 ready to ship as it is. A reviewer
gives `n/a` only when the images cannot show the criterion. A reply that
leaves a criterion out fails, and counts as neither a pass nor a block.

The round passes when the lowest grade of each criterion, across the
reviewers that answered, meets the pass mark (4 by default), and no reviewer
found an objective break. An objective break is a `MUST-FIX`: a layout that
is broken at a viewport shown, a design reference rule that is broken, or a
screen that cannot do its job. As in `docs/UI.md`, a contrast or exact-colour
problem seen only in pixels is a mark and not a must-fix.

From round 2 on, each reviewer also says with a `COMPARE` line whether the
round is better, the same or worse than the last one. A comparison between
two screens is the judgement that vision models make best (R18 [S1][S5]).
The report shows it. It does not decide the round.

## The marks

A reviewer marks each problem that costs a grade point, with a box in the
image's pixels:

```text
MARK home.desktop.png 120,340,600,80 hierarchy: Save and Cancel have the same weight. Fix: make Save the filled primary button.
MARK home.desktop.png - colour: The palette has four accent colours. Fix: keep the brand blue only.
MUST-FIX home.mobile.png 0,600,390,40 layout: The footer covers the last card at 390px. Fix: pad the list by the footer height.
```

The engine numbers the marks of a round from 1, and draws each box with its
number in red on a copy of the image (`<name>.marked.png`). Coordinates
drawn on a screenshot made model critiques better in R18 [S3]. A box is only
a pointer, because vision models misplace fine detail (R18 [S6]), so the text
of each mark must make sense without the box. A box on an image that the
round did not show is dropped, and the text stays. Only 8-bit PNG files that
are grey, RGB or RGBA and not interlaced get boxes drawn on them. Screenshot
tools write these. For any other kind of PNG, the record lists the marks with
their boxes as text.

## The record

The record is kept in `<git common dir>/weftwork/design/`. This is the same
folder as the clone's backlog: it is untracked, every worktree of the clone
writes to it, and it stays when a worktree is removed. Nothing in it is
committed, so no repository gets more files from it.

```text
design/
  README.md                 every loop in the clone, newest first
  LESSONS.md                lessons kept for later rounds
  <branch>/<loop>/
    loop.md                 every round's grades, round by round
    loop.json               the engine's record of the loop
    round-01/
      round.md              the brief, the grades, the marks by image, the replies
      home.desktop.png      the image as reviewed
      home.desktop.marked.png
      reply-1.txt           each reviewer's reply as it came
```

To find the folder in the main checkout:
`echo "$(git rev-parse --path-format=absolute --git-common-dir)/weftwork/design"`.
Open `README.md` there in any Markdown viewer.

## Lessons: from a round into the project

A lesson is a rule learned in a round that later work should follow, for
example "primary buttons are 44px tall" or "cards use the 16px radius
token":

```bash
echo '{"lesson":"Primary buttons are 44px tall.","from":"feat/login app round 2"}' | node src/design-cli.ts
```

The engine adds it as one line to `LESSONS.md`, with where it came from and
the date. Every later round, on any branch and in any worktree of the clone,
reads the newest 32 KiB of lessons in its prompt. No commit is needed. To
make a lesson part of the project's design system, add it to the design
reference that `ui.design` names, in the pull request of the task that
learned it. That change is tracked and reviewed like any other.

## The setting

A `design` mapping in the same two files as the budget (`docs/BUDGET.md`).
`weftwork.yaml` at the repository root wins over the user file, key by key.
With no mapping, the loop runs with the built-in values.

```yaml
---
design:
  max_rounds: 5
  pass: 4
  stall_after: 2
  timeout_seconds: 1200
  reviewers:
    - codex exec --ignore-user-config --sandbox read-only --ephemeral ${WEFTWORK_IMAGES:+--image "$WEFTWORK_IMAGES"} -
```

| Key | What it is | Range | Built-in |
| --- | --- | --- | --- |
| `max_rounds` | Rounds per branch and loop | 1 to 10 | 5 |
| `pass` | The pass mark for every criterion | 1 to 5 | 4 |
| `stall_after` | Stop when this many rounds in a row did not beat the best mean grade before them (rounds with no verdict do not count) | 1 to 10 | 2 |
| `timeout_seconds` | Time for one reviewer | 1 to 3600 | `review.timeout_seconds` |
| `reviewers` | Reviewer commands, read-only, at most 2 run at once | 1 to 5 | `review.reviewers` |

A Claude Code reviewer reads the images with its file tool, so it needs
their folder:

```bash
claude -p --setting-sources "" --tools Read,Grep,Glob,Bash --permission-mode dontAsk ${WEFTWORK_IMAGES_DIR:+--add-dir "$WEFTWORK_IMAGES_DIR"}
```

An unknown key, or a value out of its range, is an error that names the file
and the key.

## Limits

- The grades are a model's judgement. They are consistent enough to steer
  the loop, but not to gate a merge (R18). The stall rule stops a loop that
  goes round without getting better.
- The reviewers see the images and the brief, not the running app. They
  judge interaction and states only from the states the images show. Take a
  screenshot of each state that the change touches.
- A canvas design and the built app can differ. The app loop reviews what
  ships.
