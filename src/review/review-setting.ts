// story: e11s03
// The review setting: the reviewer commands and the round ceilings,
// from the `review` mapping of the same two setting files as the budget
// (docs/REVIEW.md). The repository file wins over the user file key by key; a
// file that cannot be used is an error that names the file and the key, never
// a silent fall back to the defaults.
import type { Failure } from '../shared/errors.ts';
import { isInteger } from '../shared/json.ts';
import { clip, isMapping, readSettingFile, repoSettingPath, userSettingPath, yamlData, type SettingFile } from '../engine/budget.ts';

export type ReviewSetting = { reviewers: string[]; panel: number; maxRounds: number; maxRoundsSensitive: number; timeoutSeconds: number; sensitivePaths: string[] };
export type ReviewSettingResult = { ok: true; review: ReviewSetting } | Failure;

/** Three reviewers from three model families, in the order a round tries
 * them: Gemini Neon through the Antigravity CLI, then Codex (GPT Sol, its
 * default model), then Claude Opus at high effort, last because the owner
 * writes code with Opus and a review gains most from another family. A
 * round needs `review.panel` of them to answer (1 by default); one that
 * fails, such as one out of quota or not installed, is replaced by the next
 * (docs/REVIEW.md § The panel). Each is read-only: Claude and Codex with the
 * user's own settings off, agy by deny rules that win over the user's
 * settings. Each prints only its answer on stdout. Claude and Codex read the
 * prompt on stdin; agy does not read stdin, so the prompt is its `-p`
 * argument. For a UI change Codex gets the screenshots as images and the
 * others open the folder that holds them (e11s06, docs/UI.md). agy runs no
 * shell command, so it reads the change from the diff file (WEFTWORK_DIFF). */
export const defaultReviewers: readonly string[] = [
  `agy --model gemini-4-neon-high --mode plan --settings '{"permissions":{"deny":["command(*)","write_file(*)","read_url(*)","execute_url(*)","mcp(*)"]}}' \${WEFTWORK_IMAGES_DIR:+--add-dir "$WEFTWORK_IMAGES_DIR"} \${WEFTWORK_DIFF:+--add-dir "\${WEFTWORK_DIFF%/*}"} -p "$(cat)"`,
  'codex exec --ignore-user-config --sandbox read-only --ephemeral ${WEFTWORK_IMAGES:+--image "$WEFTWORK_IMAGES"} -',
  'claude -p --model opus --effort high --setting-sources "" --tools Read,Grep,Glob,Bash --permission-mode dontAsk ${WEFTWORK_IMAGES_DIR:+--add-dir "$WEFTWORK_IMAGES_DIR"}',
];

const builtIn: ReviewSetting = { reviewers: [...defaultReviewers], panel: 1, maxRounds: 3, maxRoundsSensitive: 5, timeoutSeconds: 1200, sensitivePaths: [] };

const maxReviewers = 5;

const maxSensitivePaths = 100;

/** Each integer key: its field and its range. */
const integerKeys = {
  panel: { field: 'panel', max: 5 },
  max_rounds: { field: 'maxRounds', max: 10 },
  max_rounds_sensitive: { field: 'maxRoundsSensitive', max: 10 },
  timeout_seconds: { field: 'timeoutSeconds', max: 3600 },
} as const;

const knownKeys = ['reviewers', 'sensitive_paths', ...Object.keys(integerKeys)];

function isReviewers(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= maxReviewers &&
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
  if ('council' in review) return { ok: false, error: 'review.council was renamed to review.reviewers; rename the key' };
  const unknown = Object.keys(review).find((key) => !knownKeys.includes(key));
  if (unknown !== undefined) return { ok: false, error: `review.${clip(unknown)} is not a known key (known: ${knownKeys.join(', ')})` };
  const set: Partial<ReviewSetting> = {};
  if (review['reviewers'] !== undefined) {
    if (!isReviewers(review['reviewers'])) return { ok: false, error: `review.reviewers must be a list of 1 to ${maxReviewers} commands` };
    set.reviewers = review['reviewers'];
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
  const review: ReviewSetting = { ...builtIn, reviewers: [...builtIn.reviewers], sensitivePaths: [...builtIn.sensitivePaths] };
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
