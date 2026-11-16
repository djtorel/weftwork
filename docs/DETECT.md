# Detect a project

<!-- story: e12s01 -->

The first step of setting up or converting a project (backlog e12) is a
report of what is already there. Facts come from files and from runs, never
from a model (H2), and every command the report names has been run once, so
a command written into a project's AGENTS.md resolves today (H3).

## Run it

```bash
echo '{"path":"/path/to/project"}' | node src/detect-cli.ts
```

Every key is optional:

| Key | Default | Meaning |
| --- | --- | --- |
| `path` | the current folder | The project folder |
| `run` | `true` | Run each test, lint, typecheck and build command once |
| `timeoutSeconds` | `120` | The most one command may take, 1 to 3600 |

It prints one JSON line, `{"ok":true,"report":{...}}`, and exits 0. It exits
2, with the reason on stderr, for bad input or a path that is not a folder.

**The run executes the project's own scripts.** Run it only on a project
you trust, or pass `"run": false` for a report from the files alone.

## What it reads

Only the top folder and a few fixed paths. A monorepo's packages are not
walked.

| Field | From |
| --- | --- |
| `languages`, `packageManagers`, `frameworks`, `commands` | `package.json` and its lock file, `tsconfig.json`; `pyproject.toml`, `requirements.txt`, `setup.cfg`, `Pipfile`, `setup.py`, `uv.lock`, `poetry.lock`, `pytest.ini`; `go.mod`; `Cargo.toml`; `Makefile` |
| `ci` | `.github/workflows/*.yml`, `.gitlab-ci.yml`, `.circleci/config.yml`, `Jenkinsfile`, `azure-pipelines.yml`, `.travis.yml`, `bitbucket-pipelines.yml` |
| `agentFiles` | `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.cursor/rules`, `.windsurfrules`, `.clinerules`, `.github/copilot-instructions.md` |
| `planning` | bigpowers `specs/state.yaml`, GSD `.planning`, spec-kit `.specify`, BMAD `_bmad`, `bmad` or `.bmad-core` |
| `notes` | A manifest that cannot be read or parsed; the rest of the report still holds |

Commands come from `package.json` scripts (`test`, `lint`, `typecheck`,
`build`, and `start`, `dev` or `serve` as run commands), Makefile targets
with the same names, and each toolchain's own commands (`go test ./...`,
`cargo test`). Python tools are found by name in the manifests (`pytest`,
`ruff`, `mypy`) and run through the package manager (`poetry run pytest`).
TOML is matched as text, not parsed.

## The check

Each command gets a `check`:

| `status` | Meaning | Resolves |
| --- | --- | --- |
| `passed` | It exited 0 | yes |
| `failed` | It ran and exited non-zero | yes |
| `missing` | Exit 126 or 127, or the shell did not start | no |
| `timeout` | It ran past `timeoutSeconds`; its process group was killed | no |
| `skipped` | Not run, with `why` | not checked |

Run commands are skipped, since a server does not exit. A command whose
name, text or `body` says `deploy` or `publish` is skipped too. The `body`
is the command's own script or recipe, then, each under a `# name` line,
every script or target it can reach: npm's `pre` and `post` hooks and
scripts it names, or a target's prerequisites and their recipes. A
Makefile's `include`d makefiles inside the folder count as part of it, and a
recipe is matched again with its `$(VARIABLES)` expanded, once for each value
a variable is given anywhere in the Makefile, and a prerequisite named by a
variable is followed. A target whose variables can take more than 64 values
is skipped too, since not all it runs was read. Each file in the project folder that
the command or its body names (`./scripts/check.sh`), and each file those
name, is read too, up to 50 files of at most 1 MiB; a path outside the
folder is not. The match is on text, so it is still a partial guard: a
deploy built at run time, in an environment variable or a program outside
the folder, is not seen. The
commands run one at a time in the project folder, in their own process
group, with stdin empty and `CI=1`, so watch-mode test runners exit.
