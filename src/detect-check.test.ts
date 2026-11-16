// story: e12s01
// Each detected command runs once, with a timeout, to check that it resolves:
// passed, failed (it ran and exited non-zero), missing (exit 126 or 127),
// timeout. A run command and a deploy or publish command never run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { checkCommands } from './detect-check.ts';
import type { FoundCommand } from './detect.ts';

const cwd = tmpdir();

async function statusOf(found: FoundCommand, timeoutMs = 20000) {
  const [checked] = await checkCommands([found], cwd, timeoutMs);
  return checked?.check;
}

test('AC-e12s01-07 a command that exits 0 passed, non-zero failed, not found is missing', async () => {
  assert.deepEqual(await statusOf({ kind: 'test', command: 'true', source: 'Makefile' }), { status: 'passed', exitCode: 0 });
  assert.deepEqual(await statusOf({ kind: 'lint', command: 'exit 3', source: 'Makefile' }), { status: 'failed', exitCode: 3 });
  assert.deepEqual(await statusOf({ kind: 'build', command: 'weftwork-no-such-command-xyz', source: 'Makefile' }), { status: 'missing', exitCode: 127 });
});

test('AC-e12s01-08 a command past the timeout is stopped and reported', async () => {
  const checked = await statusOf({ kind: 'test', command: 'sleep 5', source: 'Makefile' }, 200);
  assert.deepEqual(checked, { status: 'timeout', exitCode: null, why: 'stopped after 200 ms' });
});

test('AC-e12s01-09 run, deploy and publish commands are skipped, never run', async () => {
  const marker = `${cwd}/weftwork-detect-should-not-exist-${process.pid}`;
  const commands: FoundCommand[] = [
    { kind: 'run', command: `touch ${marker}`, source: 'package.json', body: 'vite' },
    { kind: 'build', command: 'npm run build', source: 'package.json', body: `touch ${marker} && npm publish` },
    { kind: 'test', command: 'make deploy-test', source: 'Makefile', body: `touch ${marker}` },
  ];
  const checked = await checkCommands(commands, cwd, 20000);
  assert.deepEqual(
    checked.map((found) => found.check.status),
    ['skipped', 'skipped', 'skipped'],
  );
  assert.match(checked[0]?.check.why ?? '', /does not exit/);
  assert.match(checked[1]?.check.why ?? '', /deploy or publish/);
  const { existsSync } = await import('node:fs');
  assert.equal(existsSync(marker), false);
});

test('AC-e12s01-13 a deploy behind an npm hook, a called script, a make prerequisite or an inline recipe is skipped', async () => {
  const { mkdtempSync, writeFileSync, existsSync, rmSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { detectProject } = await import('./detect.ts');
  const dir = mkdtempSync(join(tmpdir(), 'weftwork-detect-'));
  const marker = join(dir, 'shipped');
  const scripts = { build: 'echo build', prebuild: `touch ${marker}; npm publish`, test: 'npm run ship', ship: `touch ${marker}; npm publish` };
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts }));
  writeFileSync(join(dir, 'Makefile'), `test: ship\n\techo test\n\nship:\n\ttouch ${marker}; ./deploy.sh\n\nlint: ; touch ${marker}; npm publish\n\nbuild: prep\nbuild:\n\ttouch ${marker}; npm publish\n`);
  const detected = await detectProject(dir);
  assert.ok(detected.ok);
  const checked = await checkCommands(detected.report.commands, dir, 20000);
  assert.deepEqual(
    checked.map((found) => [found.command, found.check.status]),
    [
      ['npm run test', 'skipped'],
      ['npm run build', 'skipped'],
      ['make test', 'skipped'],
      ['make lint', 'skipped'],
      ['make build', 'skipped'],
    ],
  );
  assert.equal(existsSync(marker), false);
  rmSync(dir, { recursive: true, force: true });
});

test('AC-e12s01-14 a deploy inside a called shell script, an included Makefile or a make variable is skipped', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { detectProject } = await import('./detect.ts');
  const dir = mkdtempSync(join(tmpdir(), 'weftwork-detect-'));
  const marker = join(dir, 'shipped');
  mkdirSync(join(dir, 'scripts'));
  writeFileSync(join(dir, 'scripts', 'check.sh'), `touch ${marker}\nsh scripts/ship.sh\n`);
  writeFileSync(join(dir, 'scripts', 'ship.sh'), 'npm publish\n');
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'sh ./scripts/check.sh' } }));
  writeFileSync(join(dir, 'targets.mk'), `lint:\n\ttouch ${marker}; npm publish\n`);
  writeFileSync(join(dir, 'Makefile'), `include targets.mk\nSHIP = npm pub$(SUFFIX)\nSUFFIX := lish\n\nbuild:\n\ttouch ${marker}; $(SHIP)\n\ntypecheck:\n\ttrue\n`);
  const detected = await detectProject(dir);
  assert.ok(detected.ok);
  const checked = await checkCommands(detected.report.commands, dir, 20000);
  assert.deepEqual(
    checked.map((found) => [found.command, found.check.status]),
    [
      ['npm run test', 'skipped'],
      ['make build', 'skipped'],
      ['make typecheck', 'passed'],
      ['make lint', 'skipped'],
    ],
  );
  assert.equal(existsSync(marker), false);
  rmSync(dir, { recursive: true, force: true });
});

test('AC-e12s01-15 a publish behind a reassigned variable or a variable prerequisite is skipped, and an include through a symlinked folder is not read', async () => {
  const { mkdtempSync, writeFileSync, symlinkSync, existsSync, rmSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { detectProject } = await import('./detect.ts');
  const dir = mkdtempSync(join(tmpdir(), 'weftwork-detect-'));
  const outside = mkdtempSync(join(tmpdir(), 'weftwork-outside-'));
  const marker = join(dir, 'shipped');
  writeFileSync(join(outside, 'rules.mk'), 'lint:\n\ttrue\n');
  symlinkSync(outside, join(dir, 'linked'));
  const makefile = `include linked/rules.mk\nSUFFIX = check\nSUFFIX = lish\nSTEPS = release\nPART = li\nSHIP := npm pub$(PART)sh\nPART += x\nPART += x\nPART += x\nPART += x\nPART += x\nPART += x\nPART += x\n\ntest:\n\ttouch ${marker}; npm pub$(SUFFIX)\n\nlint:\n\ttouch ${marker}; $(SHIP)\n\nbuild: $(STEPS)\n\ttrue\n\nrelease:\n\ttouch ${marker}; npm publish\n`;
  writeFileSync(join(dir, 'Makefile'), makefile);
  const detected = await detectProject(dir);
  assert.ok(detected.ok);
  const checked = await checkCommands(detected.report.commands, dir, 20000);
  assert.deepEqual(
    checked.map((found) => [found.command, found.check.status]),
    [
      ['make test', 'skipped'],
      ['make lint', 'skipped'],
      ['make build', 'skipped'],
    ],
  );
  assert.equal(existsSync(marker), false);
  rmSync(dir, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

test('AC-e12s01-16 a deep or self-referring chain of make variables expands in bounded time', async () => {
  const { makeStack } = await import('./detect-stacks.ts');
  let makefile = 'V12 = z\nLOOP = $(LOOP)x\n';
  for (let level = 0; level < 12; level++) makefile += `V${level} = a$(V${level + 1})$(V${level + 1})\n`.repeat(64);
  makefile += `test:\n\techo $(LOOP) ${'$(V0)'.repeat(50)}\n`;
  const started = Date.now();
  const found = makeStack({ text: new Map([['Makefile', makefile]]), present: new Set() });
  assert.ok(Date.now() - started < 5000, `took ${Date.now() - started} ms`);
  assert.match(found?.commands[0]?.body ?? '', /echo \$\(LOOP\)x aaaaaaaaaaaaz/);
});

test('AC-e12s01-17 a make target whose variables have too many values to read is skipped, not run', async () => {
  const { makeStack } = await import('./detect-stacks.ts');
  const appends = Array.from({ length: 7 }, (_, index) => `FLAGS += -f${index}\n`).join('');
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'weftwork-detect-'));
  const makefile = `FLAGS = -a\n${appends}test:\n\ttrue $(FLAGS)\n\nlint:\n\ttrue\n`;
  writeFileSync(join(dir, 'Makefile'), makefile);
  const found = makeStack({ text: new Map([['Makefile', makefile]]), present: new Set() });
  const checked = await checkCommands(found?.commands ?? [], dir, 20000);
  rmSync(dir, { recursive: true, force: true });
  assert.deepEqual(
    checked.map((each) => [each.command, each.check.status]),
    [
      ['make test', 'skipped'],
      ['make lint', 'passed'],
    ],
  );
  assert.match(checked[0]?.check.why ?? '', /more than 64 values/);
});
