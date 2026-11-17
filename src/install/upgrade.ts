// `weftwork upgrade`: install the latest weftwork from npm when it is newer
// than the one running. It asks npm for the latest version, then installs
// exactly that version globally, so the hooks and skills of every project,
// which run `weftwork` from PATH, get it too. A project's copied skills are
// brought up after that with `weftwork update` (update.ts). The npm calls are
// passed in; upgrade-cli.ts makes them. docs/GETTING-STARTED.md § 1.
import type { Failure } from '../shared/errors.ts';

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

/** A semver 2.0.0 version without build metadata: no leading zeros, and no
 * empty pre-release part (review r1s2). */
const part = '(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)';
export const versionPattern = new RegExp(`^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-(${part}(?:\\.${part})*))?$`);

/** Two pre-release parts, by semver: numbers as numbers, a number before text. */
function comparePart(a: string, b: string): number {
  const na = /^\d+$/.test(a);
  const nb = /^\d+$/.test(b);
  if (na && nb) return Number(a) - Number(b);
  if (na !== nb) return na ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Below 0 when `a` is older than `b`, 0 when the same, above 0 when newer,
 * by semver precedence: a pre-release is older than its release. */
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
  const xa = pa[3].split('.');
  const xb = pb[3].split('.');
  for (let i = 0; i < Math.min(xa.length, xb.length); i++) {
    const diff = comparePart(xa[i] ?? '', xb[i] ?? '');
    if (diff !== 0) return diff;
  }
  return xa.length - xb.length;
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
