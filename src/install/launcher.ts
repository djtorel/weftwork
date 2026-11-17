// The one resolver that finds the weftwork command for a project, so weftwork
// does not have to be installed globally (docs/INSTALL.md). Its order:
//
// 1. WEFTWORK_BIN, when set (the owner's override);
// 2. this clone's own install, `<git common dir>/weftwork/engine`
//    (`weftwork install`, install.ts);
// 3. the project's `node_modules/.bin/weftwork` (a dev dependency);
// 4. `weftwork` on PATH (a global install, npm link, mise, volta);
// 5. none: say how to install it and fail with 2, so a hook blocks.
//
// The hooks run it as a shell function (claude-install.ts), the SessionStart
// hook hands the same function to every Bash command of the session
// (claude-env-install.ts), and a weftwork run by hand hands its command to the
// first of 1 to 3 that is not itself (delegate.ts).
import { join } from 'node:path';

/** The folder of a clone's own install, under its git common dir: shared by
 * every worktree, never tracked, and inside the guard's protected `.git/`. */
export function engineDir(commonDir: string): string {
  return join(commonDir, 'weftwork', 'engine');
}

/** The weftwork bin of a clone's own install. */
export function engineBin(commonDir: string): string {
  return join(engineDir(commonDir), 'node_modules', '.bin', 'weftwork');
}

/** The package folder of a clone's own install. */
export function enginePackage(commonDir: string): string {
  return join(engineDir(commonDir), 'node_modules', 'weftwork');
}

/** The bin of a project's dev dependency, from the repository root. */
export function devDependencyBin(top: string): string {
  return join(top, 'node_modules', '.bin', 'weftwork');
}

/** What the resolver prints when it finds no weftwork. claude-live-guard.ts
 * tells this block from a block by the guard by its start. */
export const missingWeftwork =
  'weftwork: the weftwork command is not installed for this project, so this cannot run. ' +
  'Install it in this clone with npx weftwork install, or for every project with npm install -g weftwork.';

/** The start every message for a missing weftwork has had, this one and the
 * older "is not on PATH". */
export const missingPrefix = 'weftwork: the weftwork command is not';

/** The resolver as a POSIX shell function named `weftwork`, on one line. It
 * works in sh, bash and zsh. It looks from CLAUDE_PROJECT_DIR when Claude Code
 * sets it, else from the current folder. A later candidate is tried only when
 * an earlier one is not an executable regular file (a folder would exit 126,
 * which does not block a hook; review r1s1); PATH is searched without the
 * function itself. */
export const weftworkFunction =
  'weftwork() { ' +
  '_ww_d="${CLAUDE_PROJECT_DIR:-.}"; ' +
  '_ww_g=$(git -C "$_ww_d" rev-parse --path-format=absolute --git-common-dir 2>/dev/null); ' +
  '_ww_t=$(git -C "$_ww_d" rev-parse --show-toplevel 2>/dev/null); ' +
  'for _ww in "${WEFTWORK_BIN:-}" "${_ww_g:+$_ww_g/weftwork/engine/node_modules/.bin/weftwork}" ' +
  '"${_ww_t:+$_ww_t/node_modules/.bin/weftwork}"; do ' +
  'if [ -n "$_ww" ] && [ -f "$_ww" ] && [ -x "$_ww" ]; then "$_ww" "$@"; return; fi; ' +
  'done; ' +
  'if (unset -f weftwork; command -v weftwork) >/dev/null 2>&1; then command weftwork "$@"; return; fi; ' +
  `echo '${missingWeftwork}' >&2; return 2; }`;

/** A shell command that defines the resolver, then runs `weftwork <rest>`. */
export function resolved(rest: string): string {
  return `${weftworkFunction}; weftwork ${rest}`;
}
