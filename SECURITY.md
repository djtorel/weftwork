# Security policy

## Supported versions

weftwork is before 1.0. Only the latest release gets security fixes.

## Reporting a vulnerability

Report it privately through GitHub: open the repository's **Security** tab
and choose **Report a vulnerability**
(<https://github.com/djtorel/weftwork/security/advisories/new>). Do not open
a public issue, pull request or discussion for it.

Say what an attacker can do, the version or commit, and the steps to
reproduce it. The maintainer aims to answer within 7 days. When a fix is ready, it ships
in a release with an advisory that credits you, unless you ask not to be
named.

## What is in scope

weftwork runs commands and installs Claude Code hooks in your projects, so
these matter most:

- A way for the agent that weftwork holds to turn off, edit or get around
  the Stop hook or the guard ([`docs/GUARD.md`](docs/GUARD.md)).
- A way for a project's files (a settings file, a ledger, a plan to convert)
  to make weftwork run a command or write a file the owner did not ask for.
- A way for weftwork to write outside the folder it was given.

The known limits of the guard are listed in `docs/GUARD.md` under "What it
does not stop"; a report that only restates one of them is not a new
vulnerability, but a practical way to exploit one is welcome.

The threat model and past reviews are in
[`docs/security/`](docs/security/).
