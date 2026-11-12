# e07s03 verify script (owner run, AC-e07s03-11)

Written for the owner. It spends model tokens, so CI does not run it.
It needs a Claude Code install and a scratch copy of this repository.
Replace `<weftwork>` with the path of your weftwork checkout.

1. Make a scratch copy:
   `git clone <weftwork> /tmp/weftwork-e07s03 && cd /tmp/weftwork-e07s03`
2. Install the hook with a command that always fails:
   `node <weftwork>/src/claude-install-cli.ts -- 'false'`
   Expect `added: Stop hook in .../.claude/settings.json` and four notes.
   `cat .claude/settings.json` shows one Stop entry with `"timeout": 660`.
3. Run step 2 again. Expect `unchanged`.
4. Start `claude` in the scratch copy. If it shows the workspace trust
   dialog, accept it. Run `/hooks` and see the Stop entry listed under
   project settings.
5. Ask Claude for a one-line reply, so it tries to stop. Expect the stop
   to be blocked, and Claude to receive the engine's reason, which ends
   "Make that command pass before you stop." The host's cap of eight
   blocks ends the loop. Press Esc to stop sooner.
6. Record the result in `specs/verifications/e07s03-verify.yaml`. Also
   record whether a session that was already running before step 2 saw
   the hook. The docs do not say, and the install tells you to start a
   new session.

Pass: steps 2 to 5 behave as written. If step 5 does not block, the
install is wrong or the trust dialog was not accepted; check `/hooks`.
