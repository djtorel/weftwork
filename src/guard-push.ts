// story: e11s04
// A push to main is a mechanical ask trigger (docs/ASK.md): the owner lands
// work on main, the agent never does. pushToMain reads a Bash command as text
// and says whether a `git push` in it would update main or master. It splits
// the command at `;`, `&&`, `||`, `|`, `&` and newlines, drops quotes, and
// reads each part that starts with git. That is a text match, like the rest of
// the guard: a push from a script, an alias or a variable is not seen.
const mainBranches = new Set(['main', 'master']);

/** git's global options that take the next word as their value. */
const gitValueOptions = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path']);

/** git push's options that take the next word as their value. */
const pushValueOptions = new Set(['--repo', '-o', '--push-option', '--receive-pack', '--exec']);

/** Options that push every branch, main too. */
const pushAll = new Set(['--all', '--mirror']);

const isEnvAssignment = (word: string) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(word);

/** The words of each simple command in `command`, quotes removed. */
function commands(command: string): string[][] {
  return command
    .split(/&&|\|\||[;|&\n]/)
    .map((part) => part.replace(/["']/g, '').trim().split(/\s+/).filter((word) => word !== ''))
    .map((words) => words.slice(words.findIndex((word) => !isEnvAssignment(word))))
    .filter((words) => words.length > 0);
}

/** The git subcommand and its arguments, or null when `words` is not git. */
function gitArgs(words: string[]): { sub: string; args: string[] } | null {
  const [program, ...rest] = words;
  if (program !== 'git' && !program?.endsWith('/git')) return null;
  for (let i = 0; i < rest.length; i += 1) {
    const word = rest[i] as string;
    if (gitValueOptions.has(word)) i += 1;
    else if (!word.startsWith('-')) return { sub: word, args: rest.slice(i + 1) };
  }
  return null;
}

/** The branch a refspec updates on the remote, given the current branch. */
function destination(refspec: string, branch: string | null): string | null {
  const spec = refspec.replace(/^\+/, '');
  const colon = spec.lastIndexOf(':');
  const dst = colon === -1 ? spec : spec.slice(colon + 1);
  const name = dst.replace(/^refs\/heads\//, '');
  return name === 'HEAD' || name === '@' ? branch : name;
}

/** Why a `git push` with `args` updates main, or null when it does not. */
function pushReason(args: string[], branch: string | null): string | null {
  const positional: string[] = [];
  let repoOption = false;
  for (let i = 0; i < args.length; i += 1) {
    const word = args[i] as string;
    if (pushAll.has(word)) return `${word} pushes every branch, main too`;
    if (word === '--repo' || word.startsWith('--repo=')) repoOption = true;
    if (pushValueOptions.has(word)) i += 1;
    else if (!word.startsWith('-')) positional.push(word);
  }
  if (positional.length <= (repoOption ? 0 : 1)) {
    return branch !== null && mainBranches.has(branch) ? `a push with no refspec from ${branch} pushes ${branch}` : null;
  }
  // Every word is read as a refspec, the remote too: with --repo the first
  // word may be a refspec, and a remote named main is rare enough to block.
  const target = positional.map((spec) => destination(spec, branch)).find((name) => name !== null && mainBranches.has(name));
  return target === undefined || target === null ? null : `the push updates ${target}`;
}

/** Why `command` pushes to main or master, or null when it does not.
 * `branch` is the current branch (null on a detached HEAD); a `git checkout`
 * or `git switch` earlier in the command changes it for the parts after. */
export function pushToMain(command: string, branch: string | null): string | null {
  let current = branch;
  for (const words of commands(command)) {
    const git = gitArgs(words);
    if (git === null) continue;
    if (git.sub === 'checkout' || git.sub === 'switch') {
      const name = git.args.find((word) => !word.startsWith('-'));
      if (name !== undefined) current = name;
    } else if (git.sub === 'push') {
      const reason = pushReason(git.args, current);
      if (reason !== null) return reason;
    }
  }
  return null;
}
