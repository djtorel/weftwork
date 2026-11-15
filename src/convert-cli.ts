// story: e12s03
// Thin shell for converting a bigpowers project: JSON on stdin, every key
// optional, `{"path", "tag", "apply"}`, and one JSON line on stdout. Without
// "apply" it prints the plan, a dry run that writes nothing; with
// "apply": true it converts. Logic lives in convert.ts. docs/CONVERT.md.
//
// Exit 0 with an answer, 1 when the conversion is refused, 2 for bad input;
// the reason is on stderr.
import { resolve } from 'node:path';
import { printAnswer, readJsonObject, terminalSafe } from './cli-io.ts';
import { applyConvert, planConvert } from './convert.ts';

const defaultTag = 'bigpowers-era';

function fail(error: string, code = 2): void {
  process.stderr.write(`convert: ${terminalSafe(error)}\n`);
  process.exitCode = code;
}

/** Why the request is bad, or null. */
function badRequest(input: Record<string, unknown>): string | null {
  const { path, tag, apply } = input;
  if (path !== undefined && (typeof path !== 'string' || path === '' || path.includes('\0'))) return '"path" must be a non-empty string';
  if (tag !== undefined && (typeof tag !== 'string' || tag === '' || tag.startsWith('-'))) return '"tag" must be a tag name';
  if (apply !== undefined && typeof apply !== 'boolean') return '"apply" must be true or false';
  return null;
}

async function main(): Promise<void> {
  const read = await readJsonObject();
  if (read.kind === 'refused') return fail(read.error);
  const input = read.input;
  const bad = badRequest(input);
  if (bad !== null) return fail(bad);
  const dir = resolve(typeof input.path === 'string' ? input.path : process.cwd());
  const planned = planConvert(dir, { tag: typeof input.tag === 'string' ? input.tag : defaultTag });
  if (!planned.ok) return fail(planned.error, 1);
  const { tag, moves, changes, notes } = planned.plan;
  if (input.apply !== true) {
    return printAnswer({ ok: true, plan: { tag, moves, changes: changes.map(({ path, action, diff }) => ({ path, action, diff })), notes } }, 0);
  }
  const applied = applyConvert(dir, planned.plan);
  if (!applied.ok) return fail(applied.error, 1);
  printAnswer({ ...applied, notes }, 0);
}

await main();
