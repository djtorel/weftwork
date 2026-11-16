# The PR proof

<!-- story: e11s02 -->

The proof in a pull request comes from the engine, not from the agent's
report. The agent runs the verify command through the engine, then asks
the engine for the proof block:

```bash
echo '{"command":"npm test"}' | node src/cli.ts
echo '{"command":"npm test"}' | node src/pr-proof-cli.ts
```

The proof CLI never runs the command and never writes. It reads the ledger
in `<git dir>/weftwork/` and fingerprints the working tree, then prints
plain lines for the Proof block of the PR template:

```text
weftwork done gate: ready
command: npm test
last run: done, exit 0, passed, at 2026-11-15T10:00:00.000Z
budget: 3 runs in this loop, 1 failed run of this command before the pass, tokens 7 input, 222 output, 74918 cache read, 22705 cache write
```

| Exit | First line | Meaning | What to do |
| ---- | ---------- | ------- | ---------- |
| 0 | `ready` | The last run of the command is done, no stop state after it, and the tree is the one that run saw | Open the PR for review |
| 1 | `draft` | No run, a last run that is not done (failed, blocked, stalled, exhausted, killed, overridden), or a tree that changed after the run; a `why:` line says which | Write the handoff, open a draft PR with the block |
| 2 | none | Bad input, no git working tree, or a ledger it cannot read; the reason is on stderr | Fix the cause and run it again |

The command must be the exact string the engine ran: the ledger matches
commands by text. When the engine logged a stop state for the
command after its last run (blocked, stalled, exhausted, killed,
overridden), a `stopped:` line names it and a `detail:` line shows the
stop rule's detail, such as the ceiling that was reached. A refusal logs a
state and no run, so the two lines are never merged.

Each engine call writes a run id (`runId`) on its run line and its state
line. A refusal writes no run line, so its state line also names the last
run of the command that the engine read before it (`after`). The proof
pairs the last run with a stop state by these ids: the run's own state
line, or a refusal that names the run. A ledger line from before run ids
has no `runId`, so for such a run the proof uses time: a state at or after
the run's time. A wall clock that steps back can make that pairing wrong;
the ids do not depend on the clock. On `ready`, `budget:`
counts the runs of any command since the `done` before the pass, and the
failed runs of this command before it; on `draft`, it counts up to now.
It reads the last 1 MiB of the ledger, as the stop rules do (F3).

## Tokens

The budget line ends with the session's token use when the input names
the Claude Code session transcript in `transcript`, an absolute path:

```json
{"command": "npm test", "transcript": "/home/me/.claude/projects/-home-me-app/<session-id>.jsonl"}
```

The proof sums the transcript as the Stop hook does (`docs/BUDGET.md`,
Tokens in Claude Code): input, output, cache read and cache write, each
assistant message once. With no `transcript`, or `""`, the line ends with
`tokens not counted (no transcript given)`. A transcript it cannot read
(not absolute, no file, a symlink, too large) gives `tokens not counted`
with the reason. The tokens are a report: they never change `ready` or
`draft` or the exit code. A `transcript` that is not a string is bad input
(exit 2).

Claude Code writes the transcript to
`~/.claude/projects/<project>/<session-id>.jsonl` and sets
`CLAUDE_CODE_SESSION_ID` in the environment of each Bash command (Claude
Code docs, sessions and env-vars, read 2026-11-15). So an agent in Claude
Code finds its own transcript, and the `full-stop` skill passes it:

```bash
node -e 'console.log(JSON.stringify({ command: process.argv[1], transcript: process.argv[2] }))' \
  "npm test" \
  "$(ls "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/projects/*/"$CLAUDE_CODE_SESSION_ID".jsonl 2>/dev/null | head -n 1)" \
  | node src/pr-proof-cli.ts
```

The glob matches the session id in any project folder, so it does not
depend on how Claude Code names the folder. When nothing matches, the
path is `""` and the tokens are not counted. The host writes the
transcript while the session runs, so the count can miss the last turn.

A commit does not change the fingerprint: it covers file contents, not
HEAD. Any edit to a tracked or untracked file after the run does, so the
proof is `draft` until the engine runs again.

The ledger is the agent's to read and the guard's to protect: the guard
blocks tool calls that write it (`docs/GUARD.md`). Its Bash match is by
path text, so this proof is as strong as that guard.
