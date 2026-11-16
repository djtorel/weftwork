// story: e11s04
// A push to main is a mechanical ask trigger (docs/ASK.md): the owner lands
// work on main, the agent never does. pushToMain reads a Bash command as text
// and says whether a `git push` in it would update a protected branch: main,
// master, or a remote's default branch. It splits the command at `;`, `&&`,
// `||`, `|`, `&` and newlines, drops quotes, and reads each part that starts
// with git. That is a text match, like the rest of the guard: a push from a
// script, an alias or a variable is not seen. A doubt blocks.
const mainBranches = new Set(['main', 'master']);

/** What the guard knows of the repository, read before the command runs. */
export type PushContext = {
  /** Branches a push must not update: main, master and each remote's default branch. */
  protected: ReadonlySet<string>;
  /** Local branches. */
  local: ReadonlySet<string>;
  /** Remote-tracking branches, as `origin/feat/x`. */
  remote: readonly string[];
  /** Whether `name` is a path in the command's cwd; true when in doubt. */
  isPath: (name: string) => boolean;
};

/** The context of a bare text match: main and master, and no branch is known. */
const textOnly: PushContext = { protected: mainBranches, local: new Set(), remote: [], isPath: () => true };

/** git's global options that take the next word as their value. */
const gitValueOptions = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path']);

/** git's global options that run it on another repository or worktree. */
const elsewhereOptions = ['-C', '--git-dir', '--work-tree'];

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

type GitCall = { sub: string; args: string[]; elsewhere: boolean };

/** The git subcommand and its arguments, or null when `words` is not git.
 * `elsewhere` is true when a global option points git at another repository. */
function gitArgs(words: string[]): GitCall | null {
  const [program, ...rest] = words;
  if (program !== 'git' && !program?.endsWith('/git')) return null;
  for (let i = 0; i < rest.length; i += 1) {
    const word = rest[i] as string;
    if (gitValueOptions.has(word)) i += 1;
    else if (!word.startsWith('-')) {
      const options = rest.slice(0, i);
      const named = (option: string) => elsewhereOptions.some((name) => option === name || option.startsWith(`${name}=`));
      return { sub: word, args: rest.slice(i + 1), elsewhere: options.some(named) };
    }
  }
  return null;
}

/** The branch a refspec updates on the remote, given the current branch. */
function destination(refspec: string, branch: string | null): string | null {
  const spec = refspec.replace(/^\+/, '');
  // A matching (`:`) or wildcard refspec may update main: read it as main.
  if (spec === ':' || spec.includes('*')) return 'main';
  const colon = spec.lastIndexOf(':');
  const dst = colon === -1 ? spec : spec.slice(colon + 1);
  const name = dst.replace(/^refs\/heads\//, '');
  return name === 'HEAD' || name === '@' ? branch : name;
}

/** Why a `git push` with `args` updates a protected branch, or null when it does not. */
function pushReason(args: string[], branch: string | null, protect: ReadonlySet<string>): string | null {
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
    return branch !== null && protect.has(branch) ? `a push with no refspec from ${branch} pushes ${branch}` : null;
  }
  // Every word is read as a refspec, the remote too: with --repo the first
  // word may be a refspec, and a remote named main is rare enough to block.
  const target = positional.map((spec) => destination(spec, branch)).find((name) => name !== null && protect.has(name));
  return target === undefined || target === null ? null : `the push updates ${target}`;
}

/** Options of checkout and switch that make a new branch, named next. */
const newBranch = new Set(['-b', '-B', '-c', '-C']);

/** Options that leave a plain checkout or switch of one branch a switch. Any
 * other option (`-p`, `--detach`, `--pathspec-from-file`) is a doubt. */
const plainOptions = new Set([
  ...['-q', '--quiet', '-f', '--force', '-m', '--merge', '--discard-changes'],
  ...['--guess', '--no-guess', '--progress', '--no-progress'],
]);

const isWord = (word: string) => !word.startsWith('-');

/** Whether `git checkout name` or `git switch name` switches to a branch:
 * a local branch, or a remote-tracking branch git makes a local one of
 * (`--guess`), found on one remote only. A name that ends a remote-tracking
 * name on two refs is a doubt. */
function isBranch(name: string, guess: boolean, context: PushContext): boolean {
  if (context.local.has(name)) return true;
  return guess && context.remote.filter((ref) => ref.endsWith(`/${name}`)).length === 1;
}

/** The branch after a checkout or switch (`git`), from `current`. A move to a
 * protected branch always counts. A move off one counts only when `sure`
 * (the switch must run and succeed before the parts after it) and git says
 * the word is a branch: a new branch (`-b name`), or one branch, no path, and
 * only plain options. Else the branch stays, so a doubt stays on the side
 * that blocks (review round 1). Real git (2.56): `git switch -- main` switches,
 * and so does `git checkout main --`, but `git checkout -- main` restores the
 * file main, and `git checkout name` of a remote branch that is also a file
 * stops as ambiguous. */
function afterCheckout(git: GitCall, current: string | null, context: PushContext, sure: boolean): string | null {
  const { sub, args } = git;
  const flag = args.findIndex((word) => newBranch.has(word));
  if (flag !== -1) {
    const name = args[flag + 1];
    return name !== undefined && (sure || context.protected.has(name)) ? name : current;
  }
  const dash = args.indexOf('--');
  const before = dash === -1 ? args : args.slice(0, dash);
  const after = dash === -1 ? [] : args.slice(dash + 1);
  // For switch `--` only ends the options; for checkout the words after it are paths.
  const names = sub === 'switch' ? [...before, ...after].filter(isWord) : before.filter(isWord);
  if (sub === 'checkout' && after.length > 0) return current;
  const name = names[0];
  if (name === undefined) return current;
  if (context.protected.has(name)) return name;
  const options = args.filter((word) => !isWord(word) && word !== '--');
  const plain = names.length === 1 && options.every((option) => plainOptions.has(option));
  const guess = !options.includes('--no-guess');
  const switches = isBranch(name, guess, context) && (sub === 'switch' || !context.isPath(name));
  return sure && plain && switches ? name : current;
}

/** Why `command` pushes to a protected branch, or null when it does not.
 * `branch` is the current branch (null on a detached HEAD); a `git checkout`
 * or `git switch` earlier in the command changes it for the parts after.
 * `context` null means the guard could not read the repository: every push
 * is then blocked. Without `context`, only main and master are known. */
export function pushToMain(command: string, branch: string | null, context: PushContext | null = textOnly): string | null {
  // A switch is sure to have run before the next part only in a chain of `&&`.
  const andOnly = !/\|\||[;|&\n]/.test(command.replace(/&&/g, ''));
  let current = branch;
  let moved = false;
  for (const words of commands(command)) {
    if (words[0] === 'cd' || words[0] === 'pushd') moved = true;
    const git = gitArgs(words);
    if (git === null) continue;
    if (git.sub === 'checkout' || git.sub === 'switch') {
      const sure = context !== null && andOnly && !moved && !git.elsewhere;
      current = afterCheckout(git, current, context ?? textOnly, sure);
    } else if (git.sub === 'push') {
      if (context === null) return 'the guard could not read the branches of this repository';
      const reason = pushReason(git.args, current, context.protected);
      if (reason !== null) return reason;
    }
  }
  return null;
}
