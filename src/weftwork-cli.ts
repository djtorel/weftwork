#!/usr/bin/env node
// story: e12s02
// The `weftwork` command: `weftwork <command> [args]` runs src/<command>-cli.ts
// (and `weftwork engine` runs src/cli.ts) with the same stdin and arguments,
// so a project's skills name the command, not this checkout. `weftwork path`
// prints the checkout, where the docs are. Installed with `npm link` from the
// checkout: Node strips types only from files outside node_modules, and npm
// link points the bin at this folder. docs/GETTING-STARTED.md.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = join(import.meta.dirname, '..');

/** Each command and the file it runs. */
function commands(): Map<string, string> {
  const found = new Map([['engine', 'cli.ts']]);
  for (const name of readdirSync(import.meta.dirname)) {
    const command = /^([a-z][a-z0-9-]*)-cli\.ts$/.exec(name)?.[1];
    if (command !== undefined && command !== 'weftwork') found.set(command, name);
  }
  return found;
}

const [command] = process.argv.splice(2, 1);
const known = commands();
if (command === 'path') {
  process.stdout.write(`${root}\n`);
} else if (command === undefined || !known.has(command)) {
  const list = ['path', ...[...known.keys()].sort()].join(', ');
  process.stderr.write(`weftwork: ${command === undefined ? 'name a command' : `no command ${JSON.stringify(command)}`}\ncommands: ${list}\n`);
  process.exitCode = 2;
} else {
  await import(pathToFileURL(join(import.meta.dirname, known.get(command) ?? '')).href);
}
