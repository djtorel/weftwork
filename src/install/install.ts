// `weftwork install`: install weftwork into one clone, with no global install
// and no change to the project's dependencies. npm installs it under the git
// common dir (launcher.ts, engineDir): untracked, shared by every worktree,
// gone with the clone, and inside the guard's protected `.git/`. npm reads the
// user's and the global .npmrc as for any install, so a private registry,
// proxy or CA set there applies; the package's scripts never run.
//
// The project pins the version in weftwork.yaml (`engine: <version>`), so each
// clone installs the same one. install-cli.ts is the thin shell; the npm call
// is passed in. docs/INSTALL.md.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { isMapping, readSettingFile, yamlData } from '../engine/budget.ts';
import { messageOf, type Failure } from '../shared/errors.ts';
import { engineDir, enginePackage } from './launcher.ts';
import { readRegularFile, writeAtomic } from '../shared/regular-file.ts';
import { writeStateField } from '../state/state-write.ts';
import { versionPattern } from './upgrade.ts';

/** Run npm with `args`; null when it exited 0. */
export type RunNpm = (args: string[]) => Failure | null;

/** The real npm, with its output on stderr so the command's own lines stay apart. */
export const runNpm: RunNpm = (args) => {
  const run = spawnSync('npm', args, { stdio: ['ignore', 2, 2] });
  if (run.error !== undefined) return { ok: false, error: `npm could not run: ${messageOf(run.error)}` };
  return run.status === 0 ? null : { ok: false, error: `npm ${args.join(' ')} failed (exit ${run.status ?? 'none'}); its output is above` };
};

/** The setting file that holds the pin, at the repository root. */
export const pinFile = 'weftwork.yaml';

/** The key of the pin in weftwork.yaml. */
export const pinKey = 'engine';

/** The pinned version in `root`'s weftwork.yaml, or null when there is no
 * file or no `engine` key. A value that is not a version is refused. */
export function readPin(root: string): { ok: true; pin: string | null } | Failure {
  const read = readSettingFile(join(root, pinFile), false);
  if (!read.ok) return read;
  if (read.file === null) return { ok: true, pin: null };
  const parsed = yamlData(read.file);
  if (!parsed.ok) return { ok: false, error: `${pinFile}: ${parsed.error}` };
  const data = parsed.data;
  if (data === null || data === undefined) return { ok: true, pin: null };
  if (!isMapping(data)) return { ok: false, error: `${pinFile}: the top level must be a mapping` };
  if (!(pinKey in data)) return { ok: true, pin: null };
  const pin = data[pinKey];
  if (typeof pin !== 'string' || !versionPattern.test(pin)) {
    return { ok: false, error: `${pinFile}: ${pinKey} must be a weftwork version such as 0.3.0` };
  }
  return { ok: true, pin };
}

/** Set the pin in `root`'s weftwork.yaml to `version`, keeping every other
 * byte; a missing file is created with the pin alone. */
export function writePin(root: string, version: string): Failure | null {
  const path = join(root, pinFile);
  const read = readRegularFile(path, { follow: false, maxBytes: 64 * 1024 });
  if (!read.ok) return read;
  if (read.file === null) return writeAtomic(path, `${pinKey}: ${version}\n`, undefined);
  const written = writeStateField(root, pinFile, [pinKey], version);
  return written.ok ? null : written;
}

/** The version of the clone's own install, or null when there is none. */
export function installedVersion(commonDir: string): string | null {
  try {
    const text = readFileSync(join(enginePackage(commonDir), 'package.json'), 'utf8');
    const { version } = JSON.parse(text) as { version?: unknown };
    return typeof version === 'string' ? version : null;
  } catch {
    return null;
  }
}

/** True when the weftwork at `root` is the clone's own install. */
export function isCloneInstall(root: string, commonDir: string): boolean {
  try {
    return realpathSync(root) === realpathSync(enginePackage(commonDir));
  } catch {
    return false;
  }
}

/** The npm arguments that install `spec` into the clone's own folder: an
 * exact version in its own package.json and lockfile, no install scripts. */
export function npmArgs(commonDir: string, spec: string): string[] {
  return ['install', '--prefix', engineDir(commonDir), '--save-exact', '--ignore-scripts', '--no-audit', '--no-fund', spec];
}

/** Install `spec` into the clone's own folder; the version installed. */
export function installEngine(commonDir: string, spec: string, npm: RunNpm): { ok: true; version: string } | Failure {
  const dir = engineDir(commonDir);
  // Its own package.json, so npm never takes a parent folder as the project.
  const manifest = join(dir, 'package.json');
  const read = readRegularFile(manifest, { follow: false, maxBytes: 64 * 1024 });
  if (!read.ok) return read;
  if (read.file === null) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch (error) {
      return { ok: false, error: `${dir} could not be made: ${messageOf(error)}` };
    }
    const failed = writeAtomic(manifest, `${JSON.stringify({ name: 'weftwork-engine', private: true }, null, 2)}\n`, undefined);
    if (failed !== null) return failed;
  }
  const failed = npm(npmArgs(commonDir, spec));
  if (failed !== null) return failed;
  const version = installedVersion(commonDir);
  return version === null ? { ok: false, error: `npm installed ${spec}, but ${enginePackage(commonDir)} holds no weftwork` } : { ok: true, version };
}

/** What `weftwork install` was asked: the repository root and its git common
 * dir, the version asked for (--version), an npm spec to install from
 * (--from), and the version of the weftwork that runs. */
export type InstallRequest = { root: string; commonDir: string; version?: string; from?: string; running: string };

/** `installed` npm ran; `current` the clone already had the version. `pinned`
 * the pin was written (it was missing, or moved by --version or --from). */
export type Installed = { ok: true; version: string; did: 'installed' | 'current'; pinned: boolean } | Failure;

/** Bring the clone's own install to the pin, or to the version asked for, and
 * pin that version when the project has no pin or a version was asked for. */
export function install(request: InstallRequest, npm: RunNpm): Installed {
  if (request.version !== undefined && !versionPattern.test(request.version)) {
    return { ok: false, error: `${JSON.stringify(request.version)} is not a weftwork version such as 0.3.0` };
  }
  const pin = readPin(request.root);
  if (!pin.ok) return pin;
  const asked = request.version !== undefined || request.from !== undefined;
  const want = request.version ?? pin.pin ?? request.running;
  let version = want;
  let did: 'installed' | 'current' = 'current';
  if (request.from !== undefined || installedVersion(request.commonDir) !== want) {
    const installed = installEngine(request.commonDir, request.from ?? `weftwork@${want}`, npm);
    if (!installed.ok) return installed;
    if (request.from === undefined && installed.version !== want) {
      return { ok: false, error: `npm left weftwork ${installed.version} in ${engineDir(request.commonDir)}, not ${want}` };
    }
    version = installed.version;
    did = 'installed';
  }
  if (!asked && pin.pin !== null) return { ok: true, version, did, pinned: false };
  if (pin.pin === version) return { ok: true, version, did, pinned: false };
  const failed = writePin(request.root, version);
  return failed ?? { ok: true, version, did, pinned: true };
}
