// story: e07s04
// readSettings, the settings read the install and the live check share. The
// live check follows symlinks, so a settings file may be any regular file the
// agent links; a read past the cap is refused, never loaded whole (review
// B-F10).
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { maxSettingsBytes, readSettings } from './claude-settings-file.ts';
import { cleanupTempDirs, makeTempDir } from './test-helpers.ts';

after(cleanupTempDirs);

test('a settings file past the size cap is refused, followed or not', () => {
  const path = join(makeTempDir(), 'settings.json');
  writeFileSync(path, `{"pad":"${'x'.repeat(maxSettingsBytes)}"}`);
  for (const follow of [false, true]) {
    const read = readSettings(path, follow);
    assert.ok(!read.ok, `follow=${follow}`);
    assert.match(read.error, /larger than/);
  }
});

test('a settings file at the cap is read', () => {
  const path = join(makeTempDir(), 'settings.json');
  const text = `{"pad":"${'x'.repeat(maxSettingsBytes - 10)}"}`;
  writeFileSync(path, text);
  const read = readSettings(path);
  assert.ok(read.ok && read.file !== null);
  assert.equal(read.file.text, text);
});
