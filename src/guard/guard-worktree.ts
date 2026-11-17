// story: e11s04
// The worktree the guard's ask triggers hold an agent to (docs/ASK.md): its
// root, the paths outside it that stay writable (the temp folder, and the
// clone's backlog in the common git dir), the current branch and the branches
// the push check reads. Git runs by argument array, with core.fsmonitor off,
// as in ledger.ts. Never throws.
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Refs, Worktree } from './guard.ts';
import { currentBranch, repositoryRoot } from '../engine/tree.ts';

const run = promisify(execFile);

/** The absolute common git dir of the clone that holds `cwd`, or null. */
export async function commonDir(cwd: string): Promise<string | null> {
  try {
    const args = ['-c', 'core.fsmonitor=false', 'rev-parse', '--path-format=absolute', '--git-common-dir'];
    const { stdout } = await run('git', args, { cwd, encoding: 'utf8' });
    return stdout.replace(/\n$/, '');
  } catch {
    return null;
  }
}

/** The local and remote-tracking branches, and the protected ones: main,
 * master and the branch each `refs/remotes/<remote>/HEAD` points to, which
 * is the remote's default branch as the clone last saw it (no network). Null
 * when git fails, and then the guard blocks every push. */
async function readRefs(cwd: string): Promise<Refs | null> {
  let stdout: string;
  try {
    const format = '--format=%(refname)%00%(symref)';
    const args = ['-c', 'core.fsmonitor=false', 'for-each-ref', format, 'refs/heads', 'refs/remotes'];
    ({ stdout } = await run('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  } catch {
    return null;
  }
  const refs: Refs = { protected: ['main', 'master'], local: [], remote: [] };
  for (const line of stdout.split('\n')) {
    const [name = '', target = ''] = line.split('\0');
    if (name.startsWith('refs/heads/')) refs.local.push(name.slice('refs/heads/'.length));
    else if (!name.startsWith('refs/remotes/')) continue;
    else if (!name.endsWith('/HEAD')) refs.remote.push(name.slice('refs/remotes/'.length));
    else {
      // refs/remotes/origin/HEAD points to refs/remotes/origin/<default>.
      const prefix = name.slice(0, -'HEAD'.length);
      const branch = target.startsWith(prefix) ? target.slice(prefix.length) : '';
      if (branch !== '' && !refs.protected.includes(branch)) refs.protected.push(branch);
    }
  }
  return refs;
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
  const refs = await readRefs(dir);
  const temp = [env.TMPDIR, tmpdir()].filter((path): path is string => typeof path === 'string' && path !== '');
  const backlog = common === null ? [] : [join(common, 'weftwork', 'BACKLOG.md')];
  return { root, allowed: [...temp, ...backlog], branch: branch.ok ? branch.branch : null, refs };
}
