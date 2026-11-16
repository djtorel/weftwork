// `weftwork upgrade`: install the latest weftwork from npm when it is newer
// than the one running. It asks npm for the latest version, then installs
// exactly that version globally, so the hooks and skills of every project,
// which run `weftwork` from PATH, get it too. A project's copied skills are
// brought up after that with `weftwork update` (update.ts). The npm calls are
// passed in; upgrade-cli.ts makes them. docs/GETTING-STARTED.md § 1.
import type { Failure } from './errors.ts';

/** The two npm calls: the latest published version, and a global install of
 * one version (null when it worked). */
export type Npm = {
  latest: () => { ok: true; version: string } | Failure;
  install: (version: string) => Failure | null;
};

/** `installed` the newer version; `current` it was already running; `newer`
 * the running one is newer than npm's latest; `checked` a newer one exists
 * and nothing was installed (--check). */
export type Upgraded = { ok: true; from: string; to: string; did: 'installed' | 'current' | 'newer' | 'checked' } | Failure;

const versionPattern = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

/** Below 0 when `a` is older than `b`, 0 when the same, above 0 when newer.
 * The numbers compare as numbers; a pre-release is older than its release,
 * and two pre-releases compare as text. */
export function compareVersions(a: string, b: string): number {
  const [, ...pa] = versionPattern.exec(a) ?? [];
  const [, ...pb] = versionPattern.exec(b) ?? [];
  for (let i = 0; i < 3; i++) {
    const diff = Number(pa[i]) - Number(pb[i]);
    if (diff !== 0) return diff;
  }
  if (pa[3] === pb[3]) return 0;
  if (pa[3] === undefined) return 1;
  if (pb[3] === undefined) return -1;
  return pa[3] < pb[3] ? -1 : 1;
}

/** Upgrade from `current`: install npm's latest when it is newer, unless
 * `check`. */
export function upgrade(current: string, npm: Npm, check: boolean): Upgraded {
  const latest = npm.latest();
  if (!latest.ok) return latest;
  const to = latest.version;
  if (!versionPattern.test(to)) return { ok: false, error: `npm gave ${JSON.stringify(to.slice(0, 100))} as the latest weftwork, which is not a version` };
  const order = compareVersions(current, to);
  if (order === 0) return { ok: true, from: current, to, did: 'current' };
  if (order > 0) return { ok: true, from: current, to, did: 'newer' };
  if (check) return { ok: true, from: current, to, did: 'checked' };
  const failed = npm.install(to);
  return failed ?? { ok: true, from: current, to, did: 'installed' };
}
