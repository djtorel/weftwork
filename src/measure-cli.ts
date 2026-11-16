// story: B7
// Thin shell for the measurement harness: JSON `{"out": "<file>"}` on stdin
// runs the zero-cost first experiment (R10 E1); with `"arms"` it runs each
// arm's agent command, and then `"maxSpend"` is required. One row per run is
// appended to `out`; the summary goes to stdout. Logic lives in measure.ts.
// docs/MEASURE.md.
//
// Exit 0 when it ran (a stop at the spend cap is said on stdout), 2 when it
// cannot run, with the reason on stderr.
import { appendFile } from 'node:fs/promises';
import { messageOf } from './errors.ts';
import { readJsonObject, terminalSafe } from './cli-io.ts';
import { parseMeasureRequest, runArms, runSeeded, summaryText, type Row } from './measure.ts';

const agentTimeoutMs = 1800000;

function fail(error: string): void {
  process.stderr.write(`measure: ${terminalSafe(error)}\n`);
  process.exitCode = 2;
}

async function main(): Promise<void> {
  const read = await readJsonObject();
  if (read.kind === 'refused') return fail(read.error);
  const parsed = parseMeasureRequest(read.input, process.cwd());
  if (!parsed.ok) return fail(parsed.error);
  const { out, arms, maxSpend, timeoutMs } = parsed.request;
  try {
    await appendFile(out, '');
  } catch (error) {
    return fail(`cannot write ${out}: ${messageOf(error)}`);
  }
  const write = (row: Row) => appendFile(out, `${JSON.stringify(row)}\n`);
  if (arms === undefined || maxSpend === undefined) {
    const rows = await runSeeded(write);
    process.stdout.write(summaryText('e1-seeded', rows));
  } else {
    const result = await runArms(arms, maxSpend, timeoutMs ?? agentTimeoutMs, write);
    process.stdout.write(summaryText('agent', result.rows));
    process.stdout.write(`spent: ${result.spentUsd} of ${maxSpend} USD (as the agents reported)\n`);
    if (result.stopped !== null) process.stdout.write(`stopped: ${result.stopped}\n`);
  }
  process.stdout.write(`rows: ${terminalSafe(out)}\n`);
}

await main();
