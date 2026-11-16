#!/usr/bin/env node
// The `weftwork` bin. In a checkout (npm link) it runs src/weftwork-cli.ts,
// which Node runs by stripping types, so a change needs no build. In the npm
// package there is no src/: Node does not strip types under node_modules, so
// it runs the build in dist/ (docs/RELEASING.md).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = join(import.meta.dirname, '..');
const source = join(root, 'src', 'weftwork-cli.ts');
const entry = existsSync(source) ? source : join(root, 'dist', 'weftwork-cli.js');
await import(pathToFileURL(entry).href);
