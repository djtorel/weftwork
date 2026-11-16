// Thin shell for `weftwork install`: install weftwork into this clone only, at
// the project's pinned version. Logic lives in install.ts. docs/INSTALL.md.
//
// Exit 0 installed or already there, 1 when npm or the pin fails or this is
// not a git repository, 2 for bad options. The reason is on stderr.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { terminalSafe } from './cli-io.ts';
import { repoOf } from './delegate.ts';
import { messageOf } from './errors.ts';
import { install, runNpm } from './install.ts';
import { engineDir } from './launcher.ts';

const root = join(import.meta.dirname, '..');

const usage = `Usage: weftwork install [options]

Install weftwork into this clone only: npm puts it under the git common dir
(<git common dir>/weftwork/engine), which git never tracks and every worktree
shares, and the project's dependencies do not change. The hooks, the skills
and a global weftwork then run this one. The version is the one pinned in
weftwork.yaml (engine: <version>); with no pin, it is this weftwork's version,
and install pins it. Run it in a new clone, and again after the pin changes.

  --version <v>   Install this version and pin it.
  --from <spec>   Install from this npm spec instead (a tarball, a folder, or
                  a package on a private registry), and pin its version.
  -h, --help      Show this help.

npm reads your .npmrc as for any install. Without npx: npm exec weftwork install.
`;

function main(args: string[]): number {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: { version: { type: 'string' }, from: { type: 'string' }, help: { type: 'boolean', short: 'h', default: false } },
    });
  } catch (error) {
    process.stderr.write(`weftwork install: ${terminalSafe(messageOf(error))}\n\n${usage}`);
    return 2;
  }
  if (parsed.values.help) {
    process.stdout.write(usage);
    return 0;
  }
  const repo = repoOf(process.cwd());
  if (repo === null) {
    process.stderr.write('weftwork install: this is not a git repository; the install goes under its git common dir.\n');
    return 1;
  }
  const { version: running } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string };
  const { version, from } = parsed.values;
  const result = install({ root: repo.top, commonDir: repo.commonDir, running, ...(version === undefined ? {} : { version }), ...(from === undefined ? {} : { from }) }, runNpm);
  if (!result.ok) {
    process.stderr.write(`weftwork install: ${terminalSafe(result.error)}\n`);
    return 1;
  }
  const where = terminalSafe(engineDir(repo.commonDir));
  const lines = [result.did === 'installed' ? `Installed weftwork ${result.version} in ${where}.` : `weftwork ${result.version} is already installed in ${where}.`];
  if (result.pinned) lines.push(`Pinned it in weftwork.yaml (engine: ${result.version}); commit that file so every clone installs the same version.`);
  process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
