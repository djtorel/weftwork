# Contributing

Thank you for helping. This page says how to set up a checkout, what a
change needs before review, and how a pull request is merged.

## Set up

You need git, Node 26 or later with npm, and Python 3 (for `yamllint`).

```bash
git clone https://github.com/djtorel/weftwork.git
cd weftwork
bash tools/setup.sh
```

`setup.sh` prints `setup: OK` when every tool is there. It never installs
Node.

## Make a change

1. Open an issue first for anything larger than a small fix, so we agree on
   the goal before you write code.
2. Branch from an up-to-date `main`: `git checkout -b <type>/<short-name>`.
3. Make the smallest change that does the task. For behaviour, write the
   test first and watch it fail, then make it pass.
4. Run Preflight:

   ```bash
   yamllint . && bash tools/check-briefs.sh && npm run typecheck && npm test
   ```

   CI runs the same checks, and also the shell selftests and the package
   test: `bash tools/check-brief.sh --selftest`, `bash tools/test-setup.sh`
   and `bash tools/test-package.sh`.

5. Open a pull request with the template. Say what was wrong, what you
   changed, and paste the output that proves it.

[`CONVENTIONS.md`](CONVENTIONS.md) has the code, test, commit and evidence
rules. [`AGENTS.md`](AGENTS.md) has the architecture and the commands; it is
also what a coding agent reads in this repository.

## Commit and pull request titles

Pull requests are squash-merged, so the title becomes the commit on `main`,
and the release tooling reads it to choose the next
[semantic version](https://semver.org/). Write it as a
[Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/):

| Title | Release |
| --- | --- |
| `fix(engine): ...` or `perf(engine): ...` | patch |
| `feat(engine): ...` | minor |
| `feat(engine)!: ...` or a `BREAKING CHANGE:` footer | major (minor before 1.0) |
| `docs:`, `chore:`, `style:`, `refactor:`, `test:` | none |

A CI check fails a pull request whose title is not a Conventional Commit.

## Reporting a security problem

Do not open a public issue. See [`SECURITY.md`](SECURITY.md).

## Conduct

Everyone who takes part follows the
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Licence

By contributing, you agree that your contribution is licensed under the
[MIT licence](LICENSE) of this project.
