# Security review for branch e04s01-evaluation-design (e04s01, R10)
review_date: 2026-11-11
branch: e04s01-evaluation-design
head: a31d01a
base: main
scope: branch diff main...HEAD (7 files: docs/research/R10-evaluation.md (new),
  specs/epics/e04-evaluation-synthesis/e04s01-r10-evaluation-design.md (new),
  specs/epics/e04-evaluation-synthesis/e04s01-tasks.yaml,
  specs/execution-status.yaml, specs/state.yaml,
  specs/verifications/AUDIT-e04-e04s01.md (new),
  specs/verifications/e04s01-verify.yaml (new)) plus the uncommitted
  release changes to specs/state.yaml, the story files and the cycle-time
  ledger, and this file
supersedes: the e03s08 review on branch e03s08-run-termination (head
  2dd4b85), which did not cover this branch

method: manual review of every added line in the scope above, plus a
  pattern scan of the branch diff and the working tree for secret patterns
  (sk-, ghp_, AKIA, private-key headers, password and api-key assignments)
  and executable constructs (eval, curl piped into a shell, rm -rf, chmod,
  --no-verify). No product code was added or changed. Language and
  framework scope: none; the change set is Markdown and YAML, plus one
  python snippet inside the R10 brief.

## Findings

No findings at confidence 8 or above.

Two items reviewed and cleared:

- specs/epics/e04-evaluation-synthesis/e04s01-tasks.yaml: nine `verify:`
  strings are shell commands run with `bash -c` by verify-work and the
  brief checker. They are authored in this repository and use only local
  `grep`, `awk`, `python3`, `comm`, `sort` and `paste`. None makes a
  network request and none reads a path outside the repository. Same trust
  level as the repository's existing verify commands. Cleared.
- docs/research/R10-evaluation.md, section Sample size and variance: a
  fenced python block, run by task 6 with `python3 -I`. It imports `math`
  and `functools`, reads no file, opens no socket and takes no input.
  Cleared. Note for later: task 6 runs code that lives in a brief, so a
  change to that block runs on whoever runs the verify command; this has
  the same trust level as a change to the tasks file itself.

The one pattern-scan hit was prose in the audit file that lists the
patterns it scanned for. Cleared: false positive.

## Notes (below the reporting threshold)

- Untrusted input, not executed: the brief cites 35 arXiv papers whose
  titles and abstracts were fetched from arxiv.org during research, and
  seven full texts. The fetched text was read as data and was never run,
  evaluated or written into a command. Content from those pages is quoted
  in the brief only as evidence. No injection path into the repository was
  found.
- The arXiv API call was rejected with HTTP 429 and none of its output was
  used. One read-only `gh run list` call was made; it is recorded as an
  owner-accepted waiver in `specs/state.yaml` and sent no credentials
  beyond the existing `gh` login.
- No secrets, tokens or credentials appear in the diff, the quoted
  research text or the verification evidence.
- Research reviewers were told not to run `gh`, not to call the GitHub
  API and not to write in the repository; the working tree matches the
  committed state plus the release changes.

## Coverage

- Phase 1 (scope): done, 7 committed files and the release changes.
- Phase 2 (context): no product code, no auth model, no user input paths.
- Phase 3 (vulnerability assessment): no user input reaches a sink. No
  SQL, HTML, shell, deserialization, path or crypto code was added.
- Phase 4 (false-positive filtering): one scan hit and two reviewed items
  cleared above.
- Phase 5 (report): this file.
