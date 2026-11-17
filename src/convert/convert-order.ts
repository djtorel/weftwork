// story: e12s03
// The order a conversion writes the open work in: the old system's own
// order (bigpowers' release-plan.yaml, GSD 2's QUEUE-ORDER.json) first, then
// what that order does not list, by the system's default. Pure.
// docs/CONVERT.md.
import { isRecord } from '../shared/json.ts';

/** `items` with those `order` lists first, in its order, then the rest by
 * `fallback`. `matches` says whether an item is the one `order` names. */
export function inPlanOrder<T>(items: T[], order: string[], matches: (item: T, id: string) => boolean, fallback: (a: T, b: T) => number): T[] {
  const rank = (item: T): number => {
    const index = order.findIndex((id) => matches(item, id));
    return index === -1 ? order.length : index;
  };
  return [...items].sort((a, b) => rank(a) - rank(b) || fallback(a, b));
}

/** The string ids in `value[key]`, a list of ids or of records with an
 * `id`, or none. */
export function idsIn(value: unknown, key: string): string[] {
  const list = isRecord(value) && Array.isArray(value[key]) ? value[key] : [];
  return list.flatMap((item) => {
    const id = isRecord(item) ? item.id : item;
    return typeof id === 'string' && id.trim() !== '' ? [id.trim()] : [];
  });
}
