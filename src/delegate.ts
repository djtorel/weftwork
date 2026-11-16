// A weftwork that is not the project's own hands its command to the one that
// is, as turbo and eslint do: in a project with its own weftwork (a clone's
// install or a dev dependency), a global `weftwork` or `npx weftwork` runs the
// version the project uses, so the hooks, the skills and a person at the
// terminal never run two versions. The candidates and their order are the
// resolver's (launcher.ts); PATH is left out, since this weftwork came from
// there. weftwork-cli.ts runs the target. docs/INSTALL.md.
import { spawnSync } from 'node:child_process';
import { accessSync, constants, realpathSync } from 'node:fs';
import { devDependencyBin, engineBin } from './launcher.ts';

/** The environment variable a handed-off run gets, so it never hands off again. */
export const delegatedVar = 'WEFTWORK_DELEGATED';

/** The repository that holds a folder: its root and its git common dir. */
export type Repo = { top: string; commonDir: string };

/** The repository that holds `cwd`, or null outside one. */
export function repoOf(cwd: string): Repo | null {
  const run = spawnSync('git', ['rev-parse', '--path-format=absolute', '--show-toplevel', '--git-common-dir'], { cwd, encoding: 'utf8', timeout: 10000 });
  if (run.status !== 0) return null;
  const [top, commonDir] = run.stdout.split('\n');
  return top && commonDir ? { top, commonDir } : null;
}

function executable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function real(path: string): string | null {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}

/** The weftwork to hand the command to, or null to run it here: the first
 * executable of WEFTWORK_BIN, the clone's own install and the dev dependency,
 * unless that one is `ownBin` itself or this run was handed off already. */
export function delegateTarget(env: NodeJS.ProcessEnv, repo: Repo | null, ownBin: string): string | null {
  if (env[delegatedVar] === '1') return null;
  const candidates = [env.WEFTWORK_BIN || null, repo && engineBin(repo.commonDir), repo && devDependencyBin(repo.top)];
  const found = candidates.find((path): path is string => path !== null && executable(path));
  if (found === undefined) return null;
  return real(found) === real(ownBin) ? null : found;
}

/** Run `target` with `args` and this process's stdin and output, marked as
 * handed off; its exit code, or 1 when it could not start or was killed. */
export function handOff(target: string, args: string[]): number {
  const run = spawnSync(target, args, { stdio: 'inherit', env: { ...process.env, [delegatedVar]: '1' } });
  if (run.error !== undefined) {
    process.stderr.write(`weftwork: could not run the project's weftwork at ${target}: ${run.error.message}\n`);
    return 1;
  }
  return run.status ?? 1;
}
