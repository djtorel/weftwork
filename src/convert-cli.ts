// story: e12s03, e12s03b, e12s03c
// Thin shell for converting a bigpowers, GSD (1 or 2), spec-kit or BMAD project: JSON on stdin, every
// key optional, `{"path", "system", "tag", "apply"}`, and one JSON line on
// stdout. "system" is found from the folder when only one is there. Without
// "apply" it prints the plan, a dry run that writes nothing; with
// "apply": true it converts. Logic lives in convert.ts. docs/CONVERT.md.
//
// Exit 0 with an answer, 1 when the conversion is refused, 2 for bad input;
// the reason is on stderr.
import { resolve } from 'node:path';
import { printAnswer, readJsonObject, terminalSafe } from './cli-io.ts';
import { applyConvert, planConvert, systemsIn, type SystemName } from './convert.ts';

const defaultTags: Record<SystemName, string> = { bigpowers: 'bigpowers-era', gsd: 'gsd-era', gsd2: 'gsd2-era', 'spec-kit': 'speckit-era', bmad: 'bmad-era' };
const isSystem = (value: unknown): value is SystemName => typeof value === 'string' && Object.hasOwn(defaultTags, value);

function fail(error: string, code = 2): void {
  process.stderr.write(`convert: ${terminalSafe(error)}\n`);
  process.exitCode = code;
}

/** Why the request is bad, or null. */
function badRequest(input: Record<string, unknown>): string | null {
  const { path, system, tag, apply } = input;
  if (system !== undefined && !isSystem(system)) return '"system" must be "bigpowers", "gsd", "gsd2", "spec-kit" or "bmad"';
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
  const found = isSystem(input.system) ? [input.system] : systemsIn(dir);
  if (found.length > 1) return fail(`the folder has plans of ${found.join(' and ')}; pass "system"`, 1);
  // With neither, bigpowers gives the refusal that names what is missing.
  const system = found[0] ?? 'bigpowers';
  const planned = planConvert(dir, { system, tag: typeof input.tag === 'string' ? input.tag : defaultTags[system] });
  if (!planned.ok) return fail(planned.error, 1);
  const { tag, moves, changes, notes } = planned.plan;
  if (input.apply !== true) {
    return printAnswer({ ok: true, plan: { system, tag, moves, changes: changes.map(({ path, action, diff }) => ({ path, action, diff })), notes } }, 0);
  }
  const applied = applyConvert(dir, planned.plan);
  if (!applied.ok) return fail(applied.error, 1);
  printAnswer({ ...applied, notes }, 0);
}

await main();
