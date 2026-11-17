// story: B8
// Thin shell for the file-overlap check (docs/PARALLEL.md). JSON on stdin:
// `{"tasks": [{"name": "a", "files": ["src/a.ts", "docs/*.md"]},
// {"name": "b", "branch": "feat/b"}], "base": "HEAD"}` (base optional). One
// JSON line on stdout: `{"result": "clear" | "overlap", "pairs": [...]}`.
// Logic lives in overlap.ts.
//
// Exit 0 clear, 1 overlap, 2 when it cannot run (bad input, a branch git
// cannot read), with the reason on stderr.
import { printAnswer, readJsonObject, terminalSafe } from './shared/cli-io.ts';
import { findOverlaps, resolveTasks, toPlannedTasks } from './parallel/overlap.ts';

function fail(error: string): void {
  process.stderr.write(`overlap: ${terminalSafe(error)}\n`);
  process.exitCode = 2;
}

async function main(): Promise<void> {
  const read = await readJsonObject();
  if (read.kind === 'refused') return fail(read.error);
  const planned = toPlannedTasks(read.input);
  if (!planned.ok) return fail(planned.error);
  const resolved = await resolveTasks(process.cwd(), planned.tasks, planned.base);
  if (!resolved.ok) return fail(resolved.error);
  const pairs = findOverlaps(resolved.tasks);
  printAnswer({ result: pairs.length === 0 ? 'clear' : 'overlap', pairs }, pairs.length === 0 ? 0 : 1);
}

await main();
