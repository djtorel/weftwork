// story: e11s03
// The review setting: the council of reviewer commands and the round ceilings,
// from the `review` mapping of the same two setting files as the budget
// (docs/REVIEW.md). The repository file wins over the user file key by key; a
// file that cannot be used is an error that names the file and the key, never
// a silent fall back to the defaults.
import type { Failure } from './errors.ts';
import { isInteger } from './json.ts';
import { clip, isMapping, readSettingFile, repoSettingPath, userSettingPath, yamlData, type SettingFile } from './budget.ts';

export type ReviewSetting = { council: string[]; maxRounds: number; maxRoundsSensitive: number; timeoutSeconds: number; sensitivePaths: string[] };
export type ReviewSettingResult = { ok: true; review: ReviewSetting } | Failure;

/** One reviewer from another model family than Claude, read-only, with the
 * user's own Codex settings off (the review-loop skill). It prints only its
 * answer on stdout and reads the prompt from stdin. For a UI change it gets
 * the screenshots as images (e11s06, docs/UI.md). */
export const defaultCouncil: readonly string[] = ['codex exec --ignore-user-config --sandbox read-only --ephemeral ${WEFTWORK_IMAGES:+--image "$WEFTWORK_IMAGES"} -'];

const builtIn: ReviewSetting = { council: [...defaultCouncil], maxRounds: 3, maxRoundsSensitive: 5, timeoutSeconds: 1200, sensitivePaths: [] };

const maxCouncil = 5;

const maxSensitivePaths = 100;

/** Each integer key: its field and its range. */
const integerKeys = {
  max_rounds: { field: 'maxRounds', max: 10 },
  max_rounds_sensitive: { field: 'maxRoundsSensitive', max: 10 },
  timeout_seconds: { field: 'timeoutSeconds', max: 3600 },
} as const;

const knownKeys = ['council', 'sensitive_paths', ...Object.keys(integerKeys)];

function isCouncil(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= maxCouncil &&
    value.every((command) => typeof command === 'string' && command.trim() !== '' && !command.includes('\0'))
  );
}

/** e13s02: glob patterns, as `ui.paths`, whose files make a change sensitive. */
function isPatterns(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= maxSensitivePaths &&
    value.every((pattern) => typeof pattern === 'string' && pattern.trim() !== '' && !pattern.includes('\0'))
  );
}

/** The keys `review` sets, or the first unknown key or bad value. */
function checkReview(review: Record<string, unknown>): { ok: true; set: Partial<ReviewSetting> } | Failure {
  const unknown = Object.keys(review).find((key) => !knownKeys.includes(key));
  if (unknown !== undefined) return { ok: false, error: `review.${clip(unknown)} is not a known key (known: ${knownKeys.join(', ')})` };
  const set: Partial<ReviewSetting> = {};
  if (review['council'] !== undefined) {
    if (!isCouncil(review['council'])) return { ok: false, error: `review.council must be a list of 1 to ${maxCouncil} commands` };
    set.council = review['council'];
  }
  if (review['sensitive_paths'] !== undefined) {
    if (!isPatterns(review['sensitive_paths'])) return { ok: false, error: `review.sensitive_paths must be a list of 1 to ${maxSensitivePaths} glob patterns` };
    set.sensitivePaths = review['sensitive_paths'];
  }
  for (const [key, { field, max }] of Object.entries(integerKeys)) {
    const value = review[key];
    if (value === undefined) continue;
    if (!isInteger(value) || value < 1 || value > max) return { ok: false, error: `review.${key} must be an integer from 1 to ${max}` };
    set[field] = value;
  }
  return { ok: true, set };
}

/** The `review` keys one file sets; every error names the file. */
function readReview(file: SettingFile): { ok: true; set: Partial<ReviewSetting> } | Failure {
  const parsed = yamlData(file);
  if (!parsed.ok) return { ok: false, error: `${file.path}: ${parsed.error}` };
  const data = parsed.data;
  if (data === null || data === undefined) return { ok: true, set: {} };
  if (!isMapping(data)) return { ok: false, error: `${file.path}: the top level must be a mapping` };
  if (!('review' in data)) return { ok: true, set: {} };
  const review = data['review'];
  if (!isMapping(review)) return { ok: false, error: `${file.path}: review must be a mapping` };
  const checked = checkReview(review);
  return checked.ok ? checked : { ok: false, error: `${file.path}: ${checked.error}` };
}

/** The review setting from the two files (each null when it does not exist). */
export function resolveReview(files: { user: SettingFile | null; repo: SettingFile | null }): ReviewSettingResult {
  const review: ReviewSetting = { ...builtIn, council: [...builtIn.council], sensitivePaths: [...builtIn.sensitivePaths] };
  for (const file of [files.user, files.repo]) {
    if (file === null) continue;
    const read = readReview(file);
    if (!read.ok) return read;
    Object.assign(review, read.set);
  }
  return { ok: true, review };
}

/** The review setting for the repository that holds `cwd`, read under the
 * budget's file rules (the repository file may not be a symlink). */
export async function loadReview(cwd: string, env: NodeJS.ProcessEnv): Promise<ReviewSettingResult> {
  const user = readSettingFile(userSettingPath(env), true);
  if (!user.ok) return user;
  const repo = readSettingFile(await repoSettingPath(cwd), false);
  if (!repo.ok) return repo;
  return resolveReview({ user: user.file, repo: repo.file });
}
