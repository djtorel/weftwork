# Releasing

weftwork is published to npm as `weftwork`, with
[semantic versioning](https://semver.org/). Versions come from the commit
titles on `main`, and nobody edits a version number by hand.

## How a release happens

1. Every pull request is squash-merged, so its title becomes one commit on
   `main`. The `pr-title` check makes the title a Conventional Commit
   (`CONTRIBUTING.md`).
2. On each push to `main`, and when run by hand on `main`, the `release`
   workflow (`.github/workflows/release.yml`) runs
   [release-please](https://github.com/googleapis/release-please-action).
   It keeps one open **Release PR** that sets the next version in
   `package.json`, `package-lock.json` and `.release-please-manifest.json`,
   and adds the new section of `CHANGELOG.md`.
3. The owner merges the Release PR when they want to ship. That merge tags
   `vX.Y.Z` and makes the GitHub release with the changelog section.
4. The same workflow's `publish` job checks out the tag, runs the typecheck,
   the tests and `tools/test-package.sh`, then runs `npm publish`. npm
   trusted publishing signs it in with the workflow's OIDC token, so there is
   no npm token anywhere, and npm adds a provenance statement.

Nothing is published until the owner merges a Release PR.

## Which version

| Commits since the last release | Before 1.0 | From 1.0 |
| --- | --- | --- |
| a `feat!:` or a `BREAKING CHANGE:` footer | minor (0.3.0 → 0.4.0) | major |
| a `feat:` | minor | minor |
| only `fix:` or `perf:` | patch | patch |
| only `docs:`, `chore:`, `style:`, `refactor:`, `test:` | no release | no release |

`bump-minor-pre-major` in `release-please-config.json` gives the "before
1.0" column. The first release is 0.1.0, from `initial-version`: with no
release tag yet, release-please does not bump the manifest's `0.0.0` but
uses `initial-version`, and its own default for that is 1.0.0
(`initialReleaseVersion()` in release-please v17.6.0,
`src/strategies/base.ts`, read 2026-11-16). Release 1.0.0 when the public
interface below has settled; to cut it, merge a commit with the footer
`Release-As: 1.0.0`.

### The public interface

A change to any of these is breaking and needs `!` in the title:

- The names of the `weftwork` commands and the options of `weftwork init`.
- The JSON a command reads on stdin, the JSON or text it prints for a
  program to read, and its exit codes (each is in the command's doc in
  `docs/`).
- The keys of `weftwork.yaml` and of the budget file (`docs/BUDGET.md`).
- The files setup writes into a project and the hook entries it registers.
- The skills' commands and the steps they promise.

The package exports no library API yet (`exports` lists only
`package.json`); the modules in `dist/` are internal and can change in any
release.

## Why the package ships JavaScript

Node runs this repository's `.ts` files directly, but it refuses to strip
types from a file under `node_modules`: Node 26.7.0 stops with
`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` (run on 2026-11-15). So
`npm pack` runs `npm run build` first (`prepack`), which compiles `src/`
without the tests into `dist/` (`tsconfig.build.json`). `bin/weftwork.js`
runs `src/weftwork-cli.ts` when `src/` is there (a checkout, `npm link`),
else `dist/weftwork-cli.js` (the installed package). A module that names
another engine file for `node` to run finds it with `sibling()`
(`src/sibling.ts`), so it gets `.ts` in a checkout and `.js` when installed.

`tools/test-package.sh` packs the tarball, installs it into a temporary
global prefix, and uses it as a user would (`--version`, `--help`, `path`,
`detect`, `init --yes` in a new repository, the engine). CI runs it on every
pull request, and the publish job runs it before `npm publish`.

## One-time setup (owner)

Until step 1 is done the `release` workflow skips itself, so merging to
`main` publishes nothing.

### 1. A GitHub App for the Release PR

A pull request opened with the workflow's own `GITHUB_TOKEN` starts no other
workflow, so the required `checks` job would never run on the Release PR and
branch protection would block it. release-please's README says to give it
another token for this (source below). A GitHub App gives a token that is
scoped to this repository and expires in an hour.

1. GitHub → Settings → Developer settings → GitHub Apps → **New GitHub
   App**. Name it, for example, `weftwork-release`. Homepage URL: the
   repository. Turn **Webhook** off.
2. Repository permissions: **Contents** read and write, **Pull requests**
   read and write, **Issues** read and write (release-please labels its
   PR). Nothing else.
3. **Create GitHub App**, then note its **Client ID** and, under **Private
   keys**, **Generate a private key** (a `.pem` file downloads).
4. **Install App** → only the `weftwork` repository.
5. Store both on the repository:

   ```bash
   cd /path/to/weftwork
   gh variable set RELEASE_APP_CLIENT_ID --body '<the Client ID>'
   gh secret set RELEASE_APP_PRIVATE_KEY < /path/to/the-key.pem
   ```

   Then delete the `.pem` file.

The next push to `main` opens the Release PR. To open it now, run the
workflow by hand (Actions → **release** → **Run workflow** on `main`):

```bash
gh workflow run release.yml --repo djtorel/weftwork --ref main
```

### 2. The first npm publish, by hand

npm sets up trusted publishing on the package's own settings page, so the
package must exist first (source below). Publish the current `main` once
from your machine, before you merge the first Release PR:

```bash
cd /path/to/weftwork
git checkout main && git pull
npm ci
npm login
npm publish --access public
```

This publishes `weftwork@0.0.0` and claims the name.

### 3. Trusted publishing

On npmjs.com, open the `weftwork` package → **Settings** → **Trusted
Publisher** → **GitHub Actions**, and enter: organization or user
`djtorel`, repository `weftwork`, workflow filename `release.yml`, no
environment, and allow `npm publish`. Then, under **Publishing access**,
choose **Require two-factor authentication and disallow tokens**.

### 4. The first release

Merge the Release PR (`chore(main): release 0.1.0`). Check:

```bash
gh release view v0.1.0
npm view weftwork version        # 0.1.0
npm install -g weftwork && weftwork --version
```

Then mark the placeholder:

```bash
npm deprecate weftwork@0.0.0 "Placeholder; install 0.1.0 or later."
```

### 5. Optional: require the title check

In the branch protection of `main`, add `title` (the `pr-title` job) to the
required status checks, so a PR with a bad title cannot be merged.

## If a publish fails

The tag and the GitHub release already exist. Fix the cause on a branch and
merge it; the fix starts a new Release PR with the next patch version. To
publish the same version again, run the steps of the `publish` job by hand
from the tag, with `npm login` instead of trusted publishing.

## Sources

- release-please-action README, "Other Actions on Release Please PRs" and
  "Publish to npm": <https://github.com/googleapis/release-please-action>,
  v5.0.0 (2026-04-22), read 2026-11-15.
- npm Docs, "Trusted publishing for npm packages" (needs npm CLI 11.5.1 and
  Node 22.14.0 or later; configured on the package's settings page;
  provenance is automatic): <https://docs.npmjs.com/trusted-publishers/>,
  read 2026-11-15.
- actions/create-github-app-token v3.3.0 (`client-id` replaces `app-id`):
  <https://github.com/actions/create-github-app-token>, read 2026-11-15.
