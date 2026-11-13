# e07s04 verify script (owner run, AC-e07s04-10)

Written for the owner. It spends model tokens, so CI does not run it. It
needs Claude Code and two terminals. It takes about ten minutes.

Two folders are used:

- **The weftwork folder**: `/home/domtorr/Dev/personal_projects/weftwork`,
  on the branch `e07s04-live-check`. The check command exists only on
  that branch. This is the main checkout, not a worktree.
- **The scratch copy**: a throw-away clone at `/tmp/weftwork-e07s04`. The
  hook is installed there, so the real checkout's settings never change.
  Step 8 deletes it.

The check prints one of three answers on its first line:
`weftwork live check: live`, `weftwork live check: registered, not seen`
or `weftwork live check: not registered`. Each step below names the line
to expect. `exit=` shows the exit code: 0 only for `live`.

## Steps

1. In terminal 1, make the scratch copy and go there:

   ```bash
   cd /home/domtorr/Dev/personal_projects/weftwork
   git branch --show-current
   rm -rf /tmp/weftwork-e07s04
   git clone /home/domtorr/Dev/personal_projects/weftwork /tmp/weftwork-e07s04
   cd /tmp/weftwork-e07s04
   ```

   Expect `e07s04-live-check` from the second command, then `Cloning
   into '/tmp/weftwork-e07s04'...`.

2. Run the check before any install:

   ```bash
   node /home/domtorr/Dev/personal_projects/weftwork/src/claude-live-cli.ts; echo "exit=$?"
   ```

   Expect `weftwork live check: not registered`, a `Next:` line that
   names the install command, five notes, and `exit=1`.

3. Install a hook whose command always passes, then check again:

   ```bash
   node /home/domtorr/Dev/personal_projects/weftwork/src/claude-install-cli.ts -- 'true'
   node /home/domtorr/Dev/personal_projects/weftwork/src/claude-live-cli.ts; echo "exit=$?"
   ```

   Expect `added: Stop hook in /tmp/weftwork-e07s04/.claude/settings.json`,
   then `weftwork live check: registered, not seen`, the reason `no call
   recorded yet`, and `exit=1`.

4. In terminal 1, start Claude Code in the scratch copy:

   ```bash
   cd /tmp/weftwork-e07s04 && claude
   ```

   If it shows the workspace trust dialog, accept it. Type `Reply with
   one word.` and press Enter. The command is `true`, so the stop goes
   ahead and nothing is blocked. Keep this session open.

5. In terminal 2, run the check:

   ```bash
   cd /tmp/weftwork-e07s04
   node /home/domtorr/Dev/personal_projects/weftwork/src/claude-live-cli.ts; echo "exit=$?"
   ```

   Expect `weftwork live check: live`, the reason `Claude Code last called
   this hook for 'true' at <time> (<n> s ago)` with the time of step 4,
   and `exit=0`.

6. In terminal 2, turn hooks off in the personal settings, check, then
   turn them back on and check again:

   ```bash
   echo '{"disableAllHooks": true}' > .claude/settings.local.json
   node /home/domtorr/Dev/personal_projects/weftwork/src/claude-live-cli.ts; echo "exit=$?"
   rm .claude/settings.local.json
   node /home/domtorr/Dev/personal_projects/weftwork/src/claude-live-cli.ts; echo "exit=$?"
   ```

   Expect first `weftwork live check: registered, not seen`, a reason
   that starts `disableAllHooks is true in` and names
   `settings.local.json`, and `exit=1`. Then `weftwork live check: live`
   and `exit=0`.

7. Does the open session see a changed hook? In terminal 2, change the
   hook's command and check:

   ```bash
   node /home/domtorr/Dev/personal_projects/weftwork/src/claude-install-cli.ts -- 'test -d .git'
   node /home/domtorr/Dev/personal_projects/weftwork/src/claude-live-cli.ts; echo "exit=$?"
   ```

   Expect `replaced`, then `weftwork live check: registered, not seen`,
   the reason `the last call ... ran another command or adapter`, and
   `exit=1`. Wait ten seconds. In terminal 1, in the session that is
   still open from step 4, type `Reply with one word.` again. Then in
   terminal 2 run the check line once more. Either answer is a pass:
   - `weftwork live check: live`: the running session picked up the
     change.
   - `weftwork live check: registered, not seen`: it did not.

8. Clean up. In terminal 1, type `/exit` to leave Claude Code. Then:

   ```bash
   cd /home/domtorr/Dev/personal_projects/weftwork
   rm -rf /tmp/weftwork-e07s04
   ```

## Pass

Steps 2, 3, 5 and 6 show the lines and exit codes above. Step 7 passes
with either answer: it records a fact about the host.

## What to send back

For each step, say whether it matched. For step 7, say which answer the
last check gave. If any step differs, paste the full output of the
check from that step. The agent records the result in
`specs/verifications/e07s04-verify.yaml`.

## If something goes wrong

- `git branch --show-current` does not print `e07s04-live-check`: stop
  and say so. The check command is not on other branches.
- Step 5 says `registered, not seen` with `no call recorded yet`: run
  `/hooks` in the Claude Code session and say whether the Stop entry is
  listed, and whether you accepted the trust dialog.
- Claude Code edits `.claude/settings.json` itself: say so; it is a
  finding for e10.
