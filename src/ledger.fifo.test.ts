// story: e07s02
// BUG-007: a FIFO in place of the ledger must not hold the engine. Opening a
// FIFO blocks in a thread nothing can abort, so each case runs the ledger
// function in a child process that is killed after a limit (see inChild).
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { isRecord } from './json.ts';
import { cleanupTempDirs, inChild, makeFifo, makeTempDir } from './test-helpers.ts';

after(cleanupTempDirs);

const verdict = '{ done: false, exitCode: 1, reason: "exit-nonzero", command: "x", fingerprint: null }';

const calls = {
  readLedger: 'm.readLedger(path)',
  readLedgerTail: 'm.readLedgerTail(path, 1024)',
  appendEntry: `m.appendEntry(path, ${verdict}, new Date())`,
};

const on = (path: string) => `const path = ${JSON.stringify(path)};`;

for (const [name, call] of Object.entries(calls)) {
  test(`BUG-007 ${name} on a FIFO answers, and the answer is not ok`, () => {
    const out = inChild('ledger.ts', call, on(makeFifo()));
    assert.equal(out.finished, true, `it hung (killed after 8 s): ${out.stderr}`);
    const result: unknown = JSON.parse(out.stdout);
    assert.ok(isRecord(result));
    assert.equal(result.ok, false);
    assert.equal(typeof result.error, 'string');
  });
}

test('BUG-007 a FIFO that has a reader is refused by the file-type check, not by the open', () => {
  // With a reader attached, a write open on the FIFO succeeds, so only the
  // regular-file check stands between the engine and the pipe.
  const setup = `${on(makeFifo())}\nfs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);`;
  const out = inChild('ledger.ts', calls.appendEntry, setup);
  assert.equal(out.finished, true, `it hung: ${out.stderr}`);
  assert.match(out.stdout, /"ok":false/);
  assert.match(out.stdout, /not a regular file/);
});

test('BUG-007 a directory in place of the ledger is not ok either', () => {
  const out = inChild('ledger.ts', calls.readLedgerTail, on(makeTempDir()));
  assert.equal(out.finished, true);
  assert.match(out.stdout, /"ok":false/);
});

test('BUG-007 a regular ledger is still written and read', () => {
  const path = join(makeTempDir(), 'weftwork', 'ledger.jsonl');
  const wrote = inChild('ledger.ts', calls.appendEntry, on(path));
  assert.equal(wrote.finished, true);
  assert.match(wrote.stdout, /"ok":true/);
  const read = inChild('ledger.ts', calls.readLedger, on(path));
  assert.match(read.stdout, /"ok":true/);
  assert.match(read.stdout, /"command":"x"/);
});
