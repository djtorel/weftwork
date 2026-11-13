# e07s03 verify script (owner run, AC-e07s03-11)

Written for the owner. It spends model tokens, so CI does not run it.
It needs Claude Code and two terminals.

Two folders are used:

- **The weftwork folder**: your own checkout of this repository, the
  folder that holds `package.json`. Keep it on the branch
  `e07s03-install-stop-hook` while you test, because the install
  command exists only on that branch.
- **The scratch copy**: a throw-away clone at `/tmp/weftwork-e07s03`.
  The hook is installed there, so your real checkout's settings never
  change. Delete it when you are done.

No URL is needed. `git clone` can copy a folder on your disk.

1. In a terminal, go to the weftwork folder. Print its full path and
   keep it for step 2:
   `pwd`
   Then make the scratch copy (the `.` means "this folder"):
   `git clone . /tmp/weftwork-e07s03`
2. Go to the scratch copy and install a hook whose command always
   fails. Put the path from step 1 in front of `/src/...`:
   `cd /tmp/weftwork-e07s03`
   `node <path from step 1>/src/claude-install-cli.ts -- 'false'`
   Expect `added: Stop hook in /tmp/weftwork-e07s03/.claude/settings.json`
   and four notes. `cat .claude/settings.json` shows one Stop entry
   with `"timeout": 660`, and its command names the path from step 1.
3. Run the same `node ...` command again. Expect `unchanged`.
4. Still in `/tmp/weftwork-e07s03`, start `claude`. If it shows the
   workspace trust dialog, accept it. Run `/hooks` and see the Stop
   entry listed under project settings.
5. Ask Claude for a one-line reply, so it tries to stop. Expect the stop
   to be blocked, and Claude to receive the engine's reason, which ends
   "Make that command pass before you stop." The host's cap of eight
   blocks ends the loop. Press Esc to stop sooner.
6. Optional: does a running session see a change to the hook? Keep the
   session from step 4 open. In a second terminal, in
   `/tmp/weftwork-e07s03`, run the step 2 command with `-- 'true'`
   instead of `-- 'false'` (expect `replaced`). In the open session, ask
   for another one-line reply. Note whether the stop is now allowed
   (the session saw the change) or still blocked by `false` (it did
   not). The docs do not say which.
7. Record the results in `specs/verifications/e07s03-verify.yaml` in the
   weftwork folder, under `manual`. Then delete the scratch copy:
   `rm -rf /tmp/weftwork-e07s03`

Pass: steps 2 to 5 behave as written. Step 6 records a fact; either
answer passes. If step 5 does not block, check `/hooks`: either the
install is wrong or the trust dialog was not accepted.
