// Thin shell for `weftwork upgrade`: install the latest weftwork from npm.
// A checkout (npm link) is not upgraded: it is updated with git. Logic lives in
// upgrade.ts. docs/GETTING-STARTED.md § 1.
//
// Exit 0 installed, already the latest, or checked; 1 when npm fails or this
// is a checkout; 2 for bad options. The reason is on stderr.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { terminalSafe } from './cli-io.ts';
import { messageOf } from './errors.ts';
import { upgrade, type Npm } from './upgrade.ts';

const root = join(import.meta.dirname, '..');

const usage = `Usage: weftwork upgrade [options]

Install the latest weftwork from npm (npm install -g weftwork@<latest>). The
hooks of every project run weftwork from PATH, so they get it at once. Then
run weftwork update in each project to bring its skills up too.

  --check      Only say whether a newer version is out.
  -h, --help   Show this help.
`;

const npm: Npm = {
  latest: () => {
    const run = spawnSync('npm', ['view', 'weftwork', 'version'], { encoding: 'utf8', timeout: 60_000 });
    if (run.error !== undefined) return { ok: false, error: `npm could not run: ${messageOf(run.error)}` };
    if (run.status !== 0) return { ok: false, error: `npm view weftwork version failed: ${run.stderr.trim().split('\n').at(-1) ?? ''}` };
    return { ok: true, version: run.stdout.trim() };
  },
  install: (version) => {
    const run = spawnSync('npm', ['install', '-g', `weftwork@${version}`], { stdio: 'inherit' });
    if (run.error !== undefined) return { ok: false, error: `npm could not run: ${messageOf(run.error)}` };
    return run.status === 0 ? null : { ok: false, error: `npm install -g weftwork@${version} failed (exit ${run.status ?? 'none'}); its output is above` };
  },
};

function main(args: string[]): number {
  let parsed;
  try {
    parsed = parseArgs({ args, options: { check: { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h', default: false } } });
  } catch (error) {
    process.stderr.write(`weftwork upgrade: ${terminalSafe(messageOf(error))}\n\n${usage}`);
    return 2;
  }
  if (parsed.values.help) {
    process.stdout.write(usage);
    return 0;
  }
  if (existsSync(join(root, 'src', 'weftwork-cli.ts'))) {
    process.stderr.write(`weftwork upgrade: this weftwork runs from a checkout at ${terminalSafe(root)} (npm link). Update it there: git pull, then bash tools/setup.sh.\n`);
    return 1;
  }
  const { version: current } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string };
  const result = upgrade(current, npm, parsed.values.check);
  if (!result.ok) {
    process.stderr.write(`weftwork upgrade: ${terminalSafe(result.error)}\n`);
    return 1;
  }
  const said = {
    current: `weftwork ${result.from} is the latest.`,
    newer: `weftwork ${result.from} is newer than the latest on npm (${result.to}); nothing to do.`,
    checked: `weftwork ${result.to} is out (you have ${result.from}). Run weftwork upgrade to install it.`,
    installed: `Installed weftwork ${result.to} (was ${result.from}).\nNext: in each project, run weftwork update to bring its skills up to ${result.to}.`,
  }[result.did];
  process.stdout.write(`${said}\n`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
