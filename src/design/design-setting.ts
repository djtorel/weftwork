// story: e16s02
// The design loop setting, from the `design` mapping of the same two setting
// files as the budget (docs/DESIGN-LOOP.md). The repository file wins over the
// user file key by key. With no mapping the loop still runs, with built-in
// values and the review's reviewers, and two of them answer a round
// (`panel`, 2 by default: both run at once, docs/DESIGN-LOOP.md).
// `max_images` caps the images of one round, since every reviewer reads each
// one.
import type { Failure } from '../shared/errors.ts';
import { isInteger } from '../shared/json.ts';
import { clip, isMapping, readSettingFile, repoSettingPath, userSettingPath, yamlData, type SettingFile } from '../engine/budget.ts';
import { loadReview, type ReviewSetting } from '../review/review-setting.ts';

export type DesignSetting = { reviewers: string[]; panel: number; maxRounds: number; pass: number; stallAfter: number; timeoutSeconds: number; slowSeconds: number; maxImages: number };
export type DesignSettingResult = { ok: true; design: DesignSetting } | Failure;

const integerKeys = {
  panel: { field: 'panel', max: 5 },
  max_rounds: { field: 'maxRounds', max: 10 },
  pass: { field: 'pass', max: 5 },
  stall_after: { field: 'stallAfter', max: 10 },
  timeout_seconds: { field: 'timeoutSeconds', max: 3600 },
  slow_seconds: { field: 'slowSeconds', max: 3600 },
  // WEFTWORK_IMAGES holds this round's and the last round's paths in one
  // variable, which Linux caps at 128 KiB: 400 paths fit while each is under
  // about 320 bytes (review rounds 1 and 2).
  max_images: { field: 'maxImages', max: 200 },
} as const;
const knownKeys = ['reviewers', ...Object.keys(integerKeys)];
const maxReviewers = 5;

function checkDesign(design: Record<string, unknown>): { ok: true; set: Partial<DesignSetting> } | Failure {
  const unknown = Object.keys(design).find((key) => !knownKeys.includes(key));
  if (unknown !== undefined) return { ok: false, error: `design.${clip(unknown)} is not a known key (known: ${knownKeys.join(', ')})` };
  const set: Partial<DesignSetting> = {};
  const reviewers = design['reviewers'];
  if (reviewers !== undefined) {
    const valid = Array.isArray(reviewers) && reviewers.length >= 1 && reviewers.length <= maxReviewers && reviewers.every((command) => typeof command === 'string' && command.trim() !== '' && !command.includes('\0'));
    if (!valid) return { ok: false, error: `design.reviewers must be a list of 1 to ${maxReviewers} commands` };
    set.reviewers = reviewers as string[];
  }
  for (const [key, { field, max }] of Object.entries(integerKeys)) {
    const value = design[key];
    if (value === undefined) continue;
    if (!isInteger(value) || value < 1 || value > max) return { ok: false, error: `design.${key} must be an integer from 1 to ${max}` };
    set[field] = value;
  }
  return { ok: true, set };
}

function readDesignKeys(file: SettingFile): { ok: true; set: Partial<DesignSetting> } | Failure {
  const parsed = yamlData(file);
  if (!parsed.ok) return { ok: false, error: `${file.path}: ${parsed.error}` };
  const data = parsed.data;
  if (data === null || data === undefined) return { ok: true, set: {} };
  if (!isMapping(data)) return { ok: false, error: `${file.path}: the top level must be a mapping` };
  if (!('design' in data)) return { ok: true, set: {} };
  const design = data['design'];
  if (!isMapping(design)) return { ok: false, error: `${file.path}: design must be a mapping` };
  const checked = checkDesign(design);
  return checked.ok ? checked : { ok: false, error: `${file.path}: ${checked.error}` };
}

/** The design setting from the two files, over the review's reviewers and times. */
export function resolveDesign(files: { user: SettingFile | null; repo: SettingFile | null }, review: Pick<ReviewSetting, 'reviewers' | 'timeoutSeconds' | 'slowSeconds'>): DesignSettingResult {
  const design: DesignSetting = { reviewers: [...review.reviewers], panel: 2, maxRounds: 5, pass: 4, stallAfter: 2, timeoutSeconds: review.timeoutSeconds, slowSeconds: review.slowSeconds, maxImages: 50 };
  for (const file of [files.user, files.repo]) {
    if (file === null) continue;
    const read = readDesignKeys(file);
    if (!read.ok) return read;
    Object.assign(design, read.set);
  }
  return { ok: true, design };
}

/** The design setting for the repository that holds `cwd`. */
export async function loadDesign(cwd: string, env: NodeJS.ProcessEnv): Promise<DesignSettingResult> {
  const review = await loadReview(cwd, env);
  if (!review.ok) return review;
  const user = readSettingFile(userSettingPath(env), true);
  if (!user.ok) return user;
  const repo = readSettingFile(await repoSettingPath(cwd), false);
  if (!repo.ok) return repo;
  return resolveDesign({ user: user.file, repo: repo.file }, review.review);
}
