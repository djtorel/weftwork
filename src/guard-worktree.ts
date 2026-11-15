// story: e11s04
// The worktree the guard's ask triggers hold an agent to (docs/ASK.md): its
// root, the paths outside it that stay writable (the temp folder, and the
// clone's backlog in the common git dir) and the current branch. Git runs by
// argument array, with core.fsmonitor off, as in ledger.ts. Never throws.
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Worktree } from './guard.ts';
import { currentBranch, repositoryRoot } from './tree.ts';

const run = promisify(execFile);

async function commonDir(cwd: string): Promise<string | null> {
  try {
    const args = ['-c', 'core.fsmonitor=false', 'rev-parse', '--path-format=absolute', '--git-common-dir'];
    const { stdout } = await run('git', args, { cwd, encoding: 'utf8' });
    return stdout.replace(/\n$/, '');
  } catch {
    return null;
  }
}

/** The worktree that holds `dir`, or null outside a git repository: then the
 * ask triggers are off and the guard protects its own paths only. */
export async function guardWorktree(dir: string, env: NodeJS.ProcessEnv): Promise<Worktree | null> {
  let root: string;
  try {
    root = (await repositoryRoot(dir)).toString('utf8');
  } catch {
    return null;
  }
  const common = await commonDir(dir);
  const branch = await currentBranch(dir);
  const temp = [env.TMPDIR, tmpdir()].filter((path): path is string => typeof path === 'string' && path !== '');
  const backlog = common === null ? [] : [join(common, 'weftwork', 'BACKLOG.md')];
  return { root, allowed: [...temp, ...backlog], branch: branch.ok ? branch.branch : null };
}
