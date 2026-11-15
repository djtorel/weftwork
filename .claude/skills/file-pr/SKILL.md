---
name: file-pr
description: File a concise pull request. Use when the user asks to file, open, or create a PR, and as the filing step of full-stop.
---

# File PR

Check whether a PR for this branch already exists. Review the diff against
`origin/main` and make sure it matches the goal and nothing else.

The title becomes the squash commit, so write it as a Conventional Commit
(`CONVENTIONS.md`) that says why the change matters:

BAD

> perf(server): negotiate permessage-deflate on the websocket

GOOD

> perf(server): cut websocket frame size by 70%+ with gzipping

Lead the description with the problem in plain words, from the user's request,
then the solution in a sentence or two. Do not lead with an inventory of
changed files. Use the template in `.github/pull_request_template.md`:
Problem, Change, Proof, Review, Decisions.

- Proof: the commands you ran and what they showed; screenshots for UI.
- Review: the `review-loop` line and any declined findings with reasons.
- Decisions: each choice you made alone, one line each.

Add no model or harness line and no AI attribution: a squash merge can carry
the description into the commit, and `CONVENTIONS.md` bans that.

Before you submit, check the title and description for secrets and private
details. Open a real PR, not a draft, unless `full-stop` says to stop early:

```bash
gh pr create --base main --head "$(git branch --show-current)" --title "<title>" --body-file <file>
```

Write the body file in a temporary folder outside the repository (the
session's scratchpad when the host gives one, else `mktemp -d`), and leave it
there: do not `rm -rf` a path held in a variable, which Claude Code's safety
check blocks.
