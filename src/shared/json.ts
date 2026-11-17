// story: e06s04
/** True for a JSON object: not null, not an array, not a scalar. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True for an integer that is a JSON number, not a string or a float. */
export function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}
