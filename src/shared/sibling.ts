// The path of an engine command file, for code that hands a file to `node`
// (a hook entry, a message that says what to run). In a checkout the modules
// are `.ts` files that Node runs by stripping types; in the npm package they
// are the `.js` files of the build, since Node does not strip types under
// node_modules (docs/RELEASING.md). The command files (`<name>-cli`, and
// `cli` for the engine) are at the top of src/, one folder up from this one
// (docs/ARCHITECTURE.md).
import { extname, join } from 'node:path';

/** The command file `name` (no extension) at the top of the engine's source,
 * with this module's own extension: `src/<name>.ts` in a checkout,
 * `dist/<name>.js` installed. */
export function sibling(name: string): string {
  return join(import.meta.dirname, '..', `${name}${extname(import.meta.filename)}`);
}
