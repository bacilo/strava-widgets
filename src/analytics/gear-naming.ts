/**
 * Deterministic gear id → human label resolution for the build-time index
 * and aggregate steps (D-17, D-18, D-19).
 *
 * `data/config/gear.json` is hand-maintained and, as of this writing, has
 * all 16 entries blank (`""`). Per 18-UI-SPEC.md § 12, a blank (or missing)
 * name falls back to a stable, build-time-assigned anonymous ordinal —
 * `"Shoe 1"`…`"Shoe N"` — ordered by each shoe's first-use date, so the
 * feature works correctly today and the ordinal is superseded automatically
 * once a real name is filled in.
 *
 * This module is pure — no I/O — mirroring `streak-utils.ts`'s
 * pure-function/typed-result idiom and UTC date discipline.
 *
 * Hard rule (17-D32/D33, restated here as the reason ordinals exist): under
 * no input does `buildGearLabelMap` ever return the raw `gearId` as a
 * label.
 */

/** The literal label used identically by the index-adjacent code and the aggregate (D-18). */
export const UNKNOWN_GEAR_LABEL = 'Unknown';

/** One activity's gear usage, as needed to compute first-use ordering. */
export interface GearUsage {
  gearId: string;
  startDate: string;
}

/**
 * Normalizes a `startDate` string to a comparable UTC epoch millisecond
 * value. Appends `Z` when the string does not already end in one — the
 * archive carries both Strava (Z-suffixed) and intervals.icu (non-Z) date
 * shapes, per the repo-wide Z-suffix rule documented on `list.ts`'s
 * `formatActivityDate`. An unparseable value sorts as `Infinity` so it
 * never wins a "first use" comparison against a valid date.
 */
function startDateSortKey(startDate: string): number {
  const normalized = startDate.endsWith('Z') ? startDate : `${startDate}Z`;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? Infinity : parsed;
}

/**
 * Builds a deterministic `gearId -> label` map.
 *
 * Algorithm:
 * 1. Collect each distinct `gearId`'s earliest `startDate` (UTC comparison,
 *    Z-suffix normalized).
 * 2. Sort distinct ids ascending by that earliest date, breaking ties by
 *    `gearId` string comparison so the result is fully deterministic across
 *    runs.
 * 3. Assign each id a 1-based ordinal in that order. The ordinal numbering
 *    counts every shoe, including ones with a real name already filled in —
 *    this is what keeps the numbering stable across config edits.
 * 4. Label = the trimmed non-empty value from `gearMap[gearId]` when
 *    present, otherwise `Shoe ${ordinal}`.
 *
 * A `null` `gearMap` (missing/malformed config) still yields the full
 * ordinal labelling for every id — this is not an error state (D-19).
 */
export function buildGearLabelMap(
  usages: readonly GearUsage[],
  gearMap: Record<string, string> | null
): Map<string, string> {
  const earliestByGearId = new Map<string, number>();

  for (const usage of usages) {
    const key = startDateSortKey(usage.startDate);
    const existing = earliestByGearId.get(usage.gearId);
    if (existing === undefined || key < existing) {
      earliestByGearId.set(usage.gearId, key);
    }
  }

  const distinctIds = Array.from(earliestByGearId.keys()).sort((a, b) => {
    const dateA = earliestByGearId.get(a) as number;
    const dateB = earliestByGearId.get(b) as number;
    if (dateA !== dateB) return dateA - dateB;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  const result = new Map<string, string>();

  distinctIds.forEach((gearId, index) => {
    const ordinal = index + 1;
    const mapped = gearMap !== null ? gearMap[gearId] : undefined;
    const trimmed = typeof mapped === 'string' ? mapped.trim() : '';
    const label = trimmed.length > 0 ? trimmed : `Shoe ${ordinal}`;
    result.set(gearId, label);
  });

  return result;
}
