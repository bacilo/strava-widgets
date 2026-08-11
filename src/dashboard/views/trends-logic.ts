/**
 * Pure, DOM-free logic behind the Trends page shell: tab-state parsing and
 * the rolling-totals header strip (REC-05, TREND-01, TREND-02). `now` is
 * always injected by the caller and never constructed inside this module —
 * the same `calendar-logic.ts` discipline, stated in its own header comment
 * — so every function here stays total and deterministic under vitest's
 * `environment: 'node'` (no jsdom in this repo).
 */

import { activityDayKey } from './calendar-logic.js';
import type { DashboardIndexRow } from '../../analytics/dashboard-index.types.js';

// ---------------------------------------------------------------------------
// Tab state (D-01, D-02, D-03, D-04)
// ---------------------------------------------------------------------------

export type TrendTabKey = 'volume' | 'yoy' | 'cadence-hr' | 'training-load' | 'gear';

/** Rendered tab order (D-03 fixes Volume first; the rest follow CONTEXT.md). */
export const TREND_TAB_KEYS: readonly TrendTabKey[] = [
  'volume',
  'yoy',
  'cadence-hr',
  'training-load',
  'gear',
];

export const DEFAULT_TREND_TAB: TrendTabKey = 'volume';

/**
 * Total, never-throwing parse of the `?tab=` query value. V5 mitigation for
 * T-18-TAB-01: an unvalidated `?tab=` value must never reach a dispatch-table
 * lookup. Returns the matching key only on an EXACT match against
 * `TREND_TAB_KEYS` (an allow-list, not a fuzzy matcher) — any other value,
 * including `__proto__`, `constructor`, wrong-case, or oversized strings,
 * falls back to `DEFAULT_TREND_TAB`.
 */
export function parseTrendTab(raw: string | null): TrendTabKey {
  if (raw !== null && (TREND_TAB_KEYS as readonly string[]).includes(raw)) {
    return raw as TrendTabKey;
  }
  return DEFAULT_TREND_TAB;
}

/**
 * Inverse of `parseTrendTab` — omits the `tab` parameter entirely when it
 * equals the default, so the canonical URL for the default tab stays bare
 * `#/trends` (mirrors `list-logic.ts`'s `serializeListQuery` omit-defaults
 * behaviour).
 */
export function serializeTrendQuery(tab: TrendTabKey): URLSearchParams {
  const params = new URLSearchParams();
  if (tab !== DEFAULT_TREND_TAB) {
    params.set('tab', tab);
  }
  return params;
}

// ---------------------------------------------------------------------------
// Rolling totals (18-UI-SPEC § 13)
// ---------------------------------------------------------------------------

export interface RollingTotal {
  km: number;
  runs: number;
}

export interface RollingTotals {
  week: RollingTotal;
  month: RollingTotal;
  yearToDate: RollingTotal;
}

/** UTC-safe Monday-start week key, mirroring `date-utils.ts`'s `getWeekStart` weekday origin. */
function weekStartKey(dateKey: string): string {
  // dateKey is YYYY-MM-DD (activityDayKey's output shape) — safe to parse as UTC midnight.
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  const dayOfWeek = d.getUTCDay();
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setUTCDate(d.getUTCDate() + offset);
  const year = String(d.getUTCFullYear()).padStart(4, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

function yearKey(dateKey: string): string {
  return dateKey.slice(0, 4);
}

/**
 * Sums `distanceM / 1000` and counts runs over three windows derived from
 * `now` in UTC: the current ISO week (Monday-start), the current calendar
 * month, and January 1 of the current year through `now`. Buckets each row
 * by `activityDayKey(row.startDateLocal)`; rows whose key is `null` are
 * skipped — they are already surfaced as malformed elsewhere and must not be
 * silently counted into a total. `km` is rounded to 1 decimal.
 */
export function computeRollingTotals(rows: readonly DashboardIndexRow[], now: Date): RollingTotals {
  const nowKey = activityDayKey(now.toISOString());
  // activityDayKey never returns null for a valid Date's ISO string, but
  // guard defensively rather than assert.
  const safeNowKey = nowKey ?? now.toISOString().slice(0, 10);

  const currentWeekKey = weekStartKey(safeNowKey);
  const currentMonthKey = monthKey(safeNowKey);
  const currentYearKey = yearKey(safeNowKey);

  let weekKm = 0;
  let weekRuns = 0;
  let monthKm = 0;
  let monthRuns = 0;
  let yearKm = 0;
  let yearRuns = 0;

  for (const row of rows) {
    const dayKey = activityDayKey(row.startDateLocal);
    if (dayKey === null) continue;
    // Rows strictly after `now` (future-dated) are excluded from all three windows
    if (dayKey > safeNowKey) continue;

    const km = row.distanceM / 1000;

    if (yearKey(dayKey) === currentYearKey) {
      yearKm += km;
      yearRuns += 1;
    }
    if (monthKey(dayKey) === currentMonthKey) {
      monthKm += km;
      monthRuns += 1;
    }
    if (weekStartKey(dayKey) === currentWeekKey) {
      weekKm += km;
      weekRuns += 1;
    }
  }

  return {
    week: { km: Math.round(weekKm * 10) / 10, runs: weekRuns },
    month: { km: Math.round(monthKm * 10) / 10, runs: monthRuns },
    yearToDate: { km: Math.round(yearKm * 10) / 10, runs: yearRuns },
  };
}
