# Install

weftwork does not have to be installed globally. A project's hooks and skills
call the `weftwork` command, and they find it in any of these places. Use
the one that fits your machine and your team:

| Way | Command | Good for |
| --- | --- | --- |
| Global | `npm install -g weftwork` | Your own machine, many projects |
| This clone only | `npx weftwork install` | No global install, no change to the project's dependencies (company machines, any language) |
| Dev dependency | `npm install -D weftwork` | A JavaScript project whose team wants it in `package.json` and the lockfile |
| A version manager | `mise use node@26 npm:weftwork@0.2.0` | A team that already pins its tools with mise or volta |

You can mix them. In a project that has its own weftwork (this clone's
install or a dev dependency), a global `weftwork` or `npx weftwork` runs
the project's version (see [Hand-off](#hand-off)).

You need Node 26 or later for every way.

## How the command is found

The hooks, the skills and the hand-off look in this order, and use the
first one that is there:

1. `WEFTWORK_BIN`, when you set it: the full path of a `weftwork` to run.
2. This clone's own install: `<git common dir>/weftwork/engine/`.
3. The project's dev dependency: `node_modules/.bin/weftwork` at the
   repository root.
4. `weftwork` on PATH: a global install, `npm link`, mise or volta.

When none is there, a hook blocks (exit 2) and says how to install it. A
hook that cannot start does not block in Claude Code, so this check is
what keeps a missing weftwork from letting every stop and tool call
through.

The Stop hook and the guard hold this lookup in their command
(`docs/GUARD.md`). A third entry, under `SessionStart`, gives the same
lookup to the Bash commands of each Claude Code session: it writes it as a
shell function named `weftwork` to `CLAUDE_ENV_FILE`, which Claude Code
runs before each Bash command (Claude Code hooks docs, "Persist
environment variables", read 2026-11-16). So the skills' `weftwork review`
and `$(weftwork path)` work the same way in every install. Setup writes it
with the hooks, and with `--local`.

## This clone only

```bash
cd /path/to/project
npx weftwork install
```

npm installs weftwork under the git common dir, in `weftwork/engine/`:

- git never tracks it, and `.gitignore` does not change;
- every worktree of the clone shares it;
- it goes when the clone goes;
- the guard protects it, since it is inside `.git/` (`docs/GUARD.md`).

The install has its own `package.json` and lockfile with the exact
version. npm reads your user and global `.npmrc` as for any install, so a
private registry, a proxy or a CA set there applies. A `.npmrc` in the
project does not apply, since the install is not in the project folder.
The package's install scripts never run (`--ignore-scripts`).

To set up a new project this way in one step:

```bash
npx weftwork init --local --stop-hook
```

`--local` installs into the clone first, then lets that install set up the
project, and adds the SessionStart entry even without `--stop-hook`.

### The pin

The project pins its version in `weftwork.yaml`:

```yaml
engine: 0.2.0
```

The first install writes it when there is none. Commit it. After that,
`weftwork install` in any clone installs the pinned version, and does
nothing when the clone already has it. Run it in a new clone, and again
after a pull that changes the pin.

| Option | What it does |
| --- | --- |
| `--version <v>` | Install this version and move the pin to it |
| `--from <spec>` | Install from an npm spec (a tarball, a folder, or a package on a private registry), and pin the version it holds. For a machine with no access to the public registry |

`weftwork upgrade`, run where this clone's install is the one in use,
installs the latest version into the clone and moves the pin. Then run
`weftwork update` for the skills, and commit both.

Without npx: `npm exec weftwork install`, or install once globally from a
tarball your company mirrors.

### Undo

Delete the `weftwork/engine/` folder under the git common dir
(`git rev-parse --git-common-dir` prints where that is), and the `engine`
line of `weftwork.yaml`.

## Dev dependency

```bash
npm install -D weftwork
```

Nothing else is needed: the lookup finds `node_modules/.bin/weftwork`.
Your lockfile pins the version, and Dependabot or Renovate updates it.
Upgrade it with npm, not `weftwork upgrade`. A team on an older Node with
`engine-strict` set will see the install fail, since weftwork needs Node
26.

## A version manager

mise installs npm packages with its `npm:` backend and writes them to the
project's `mise.toml` (mise docs, "npm backend", read 2026-11-16):

```bash
mise use node@26 npm:weftwork@0.2.0
```

Commit `mise.toml`. With mise activated in your shell, or its shims on
PATH, `weftwork` is on PATH in that folder, so the lookup finds it at step
4. Start Claude Code from that shell, so its hooks get the same PATH. volta
(`volta install weftwork`) puts it on PATH the same way.

## Hand-off

A `weftwork` that is not the project's own hands each command to the one
that is, with the same arguments, input and exit code, as turbo and eslint
do. It looks at steps 1 to 3 above. So in a project with its own install,
`weftwork path` prints that install, and `weftwork init` or `weftwork
update` use its skills. A run that was handed off never hands off again.

## Security

The hooks run the `weftwork` the lookup finds, so whoever can replace it
can replace the guard. The clone's own install is inside `.git/`, and the
guard blocks the agent from writing there. A dev dependency's
`node_modules/.bin/weftwork` and `node_modules/weftwork/` are on the
guard's protected-paths list too. A Bash command such as `npm install` can
still change them; `docs/GUARD.md` lists what the guard does not stop.
`WEFTWORK_BIN` comes from the environment Claude Code starts with, which
the agent cannot change for hooks.
