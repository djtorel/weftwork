---
name: setup-project
description: Use when the user asks to set up weftwork in a project folder, new or plain (no other planning system).
---

# Setup Project

Put weftwork into a project folder the user names. Never read another project
without the user's say-so: the folder they name is that say-so.
`docs/SETUP.md` has the details.

1. **Detect and ask.** Run, from this repository,
   `echo '{"path":"<folder>"}' | node src/setup-cli.ts`. It runs the
   project's test, lint, typecheck and build commands once each. If the user
   does not trust the project, add `"run":false`. Ask the user its
   `questions` with the question tool, each with its `recommended` answer
   first, and only those.
2. **Show the plan.** Run it again with `"answers"` (and `"stopHook":true`
   if the user wants the Claude Code Stop hook). Show the user every change:
   its path, its action and its `diff`, and the `notes`. Change nothing yet.
3. **Ask once.** Ask whether to apply it. For each `conflict` (a file that
   exists and differs), ask whether to overwrite it; an overwrite moves the
   old file to `<path>.weftwork-old`, it never deletes it.
4. **Apply** only on a yes: the same request with `"apply":true` and the
   paths to overwrite in `"overwrite"`. Report `written`, `kept` and `notes`.
