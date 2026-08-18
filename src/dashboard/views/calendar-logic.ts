/**
 * Calendar training log — pure, DOM-free date math and per-day aggregation
 * (BROWSE-05). This module imports nothing from the activity list's pure
 * query-parsing module (D-16): the calendar's data derivation is
 * deliberately independent of the list's filters and has its own URL
 * contract, `#/calendar?month=YYYY-MM`.
 *
 * `now` is always injected by the caller, never constructed fresh
 * inside this module — keeps every function here total and deterministic.
 *
 * Phase 22 (D-15 scope fence): this module's `weekStart` parameter governs
 * the Calendar grid ONLY. `trends-logic.ts`'s `weekStartKey`,
 * `records-logic.ts`'s biggest-week selection and
 * `src/types/analytics.types.ts`'s `weekStartISO` all stay Monday-fixed and
 * are deliberately NOT unified with this module's week-start math.
 */

import type { DashboardIndexRow } from '../../analytics/dashboard-index.types.js';

/** A calendar month. `month` is 1-based (1 = January, 12 = December). */
export interface CalendarMonth {
  year: number;
  month: number;
}

const MONTH_PARAM_PATTERN = /^(\d{4})-(\d{2})$/;
const MIN_YEAR = 1900;
const MAX_YEAR = 2999;

const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Parses a `?month=YYYY-MM` URL parameter into a `CalendarMonth`. Total
 * function: any value that isn't strictly `/^\d{4}-\d{2}$/` with a month in
 * 1-12 and a year in 1900-2999 falls back to `now`'s UTC year/month —
 * including `null`, empty strings, and traversal-looking values
 * (T-17-URL-04). Never throws.
 */
export function parseMonthParam(raw: string | null, now: Date): CalendarMonth {
  const fallback: CalendarMonth = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };

  if (typeof raw !== 'string') return fallback;

  const match = MONTH_PARAM_PATTERN.exec(raw);
  if (!match) return fallback;

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) return fallback;
  if (!Number.isInteger(month) || month < 1 || month > 12) return fallback;

  return { year, month };
}

/** Formats a `CalendarMonth` back into its `YYYY-MM` URL representation. */
export function formatMonthParam(m: CalendarMonth): string {
  return `${m.year}-${String(m.month).padStart(2, '0')}`;
}

/** Shifts a month by `delta` months, correctly rolling the year in both directions. */
export function shiftMonth(m: CalendarMonth, delta: number): CalendarMonth {
  const zeroBased = m.month - 1 + delta;
  const year = m.year + Math.floor(zeroBased / 12);
  const month = ((zeroBased % 12) + 12) % 12 + 1;
  return { year, month };
}

/** Full month name plus year, e.g. "March 2024". Locale-independent — no locale-formatting API. */
export function monthLabel(m: CalendarMonth): string {
  return `${FULL_MONTH_NAMES[m.month - 1]} ${m.year}`;
}

/**
 * Returns the `YYYY-MM-DD` local day key for a `startDateLocal` value, or
 * null when unparseable. Applies the SAME normalization rule as
 * `formatActivityDate` in `list.ts`: append a `Z` when the string does not
 * already end in one, then read the `getUTC*` components — so both archive
 * shapes (Strava-era Z-suffixed, intervals.icu-era no-Z) yield
 * wall-clock-correct days regardless of the viewer's timezone (WR-02; see
 * `list.ts`'s header comment on `formatActivityDate` for the origin of this
 * rule).
 */
export function activityDayKey(startDateLocal: string): string | null {
  if (typeof startDateLocal !== 'string') return null;

  const normalized = startDateLocal.endsWith('Z') ? startDateLocal : `${startDateLocal}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;

  const year = String(d.getUTCFullYear()).padStart(4, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const MIN_WEEK_ROWS = 4;

/** Which weekday starts a Calendar week row. Injected by the caller — see D-08. */
export type WeekStart = 'sunday' | 'monday';

/** Offset (in days) from Sunday to the chosen week-start weekday. */
const WEEK_START_OFFSET: Record<WeekStart, number> = { sunday: 0, monday: 1 };

/** One day cell in a rendered month grid. */
export interface DayCell {
  dateKey: string;
  dayOfMonth: number;
  totalDistanceM: number;
  totalTimeSec: number;
  runCount: number;
  activityIds: string[];
  tintStep: 0 | 1 | 2 | 3 | 4;
}

/**
 * One week row's total (CAL-02). D-13: sums ONLY the visible in-month
 * `DayCell`s in that row — never the true 7-day calendar week across a
 * month boundary. `daysShown` is the count of non-null cells in the row;
 * `isPartial` is `daysShown < 7`, D-14's accessible-name disclosure
 * trigger. A row with zero runs still yields real zero values, never a
 * sentinel — the `–` en-dash rendering is the view's job, not this
 * module's.
 */
export interface WeekTotal {
  totalDistanceM: number;
  totalTimeSec: number;
  runCount: number;
  daysShown: number;
  isPartial: boolean;
}

/** A full month grid, column order determined by the injected `weekStart`, plus month-level totals. */
export interface MonthGrid {
  month: CalendarMonth;
  weeks: (DayCell | null)[][];
  weekTotals: WeekTotal[];
  monthTotalM: number;
  runCount: number;
}

/**
 * Maps a day's total distance to a 0-4 tint step per the 17-UI-SPEC
 * Calendar Distance Tint Scale. `0` metres is step 0 (rest); the top step
 * (`>= 15000`) is capped — it never produces a fifth step regardless of how
 * large the distance is.
 */
export function tintStepForDistance(totalDistanceM: number): 0 | 1 | 2 | 3 | 4 {
  if (totalDistanceM <= 0) return 0;
  if (totalDistanceM < 5_000) return 1;
  if (totalDistanceM < 10_000) return 2;
  if (totalDistanceM < 15_000) return 3;
  return 4;
}

/** Number of days in `month` (1-based), computed via UTC-safe date arithmetic. */
function daysInMonth(m: CalendarMonth): number {
  return new Date(Date.UTC(m.year, m.month, 0)).getUTCDate();
}

/** Weekday (0 = Sunday) of the 1st of `month`, computed via UTC components. */
function firstWeekdayOfMonth(m: CalendarMonth): number {
  return new Date(Date.UTC(m.year, m.month - 1, 1)).getUTCDay();
}

/**
 * Number of leading `null` cells before day 1, relative to `weekStart`.
 * `weekStart` is injected by the caller, exactly as `now` is elsewhere in
 * this module — never read from storage or a clock here.
 */
function leadingPaddingFor(m: CalendarMonth, weekStart: WeekStart): number {
  return (firstWeekdayOfMonth(m) - WEEK_START_OFFSET[weekStart] + 7) % 7;
}

/**
 * Groups `rows` by local day, lays out a 7-column month grid — column
 * order determined by the injected `weekStart` — with leading/trailing
 * `null` padding so every week row has exactly 7 entries, and computes
 * per-day, per-week and month-level distance/time/run totals. Total
 * function: never throws, never returns fewer than 4 week rows. Rows whose
 * `startDateLocal` doesn't parse (`activityDayKey` returns null) or that
 * fall outside the requested month are skipped, not counted
 * (T-17-CAL-02). `activityIds` within a day preserves the input array's
 * ordering (the published index is newest-first; this function does not
 * re-sort — see `dashboard-index.types.ts`). `weekStart` is a REQUIRED
 * parameter (D-08) — never read from `localStorage` or a clock inside this
 * module, injected by the caller exactly as `now` already is elsewhere.
 */
export function buildMonthGrid(
  rows: readonly DashboardIndexRow[],
  month: CalendarMonth,
  weekStart: WeekStart
): MonthGrid {
  const monthPrefix = formatMonthParam(month);
  const byDay = new Map<string, DashboardIndexRow[]>();

  for (const row of rows) {
    const dayKey = activityDayKey(row.startDateLocal);
    if (dayKey === null) continue;
    if (!dayKey.startsWith(`${monthPrefix}-`)) continue;

    const existing = byDay.get(dayKey);
    if (existing) {
      existing.push(row);
    } else {
      byDay.set(dayKey, [row]);
    }
  }

  const totalDays = daysInMonth(month);
  const padding = leadingPaddingFor(month, weekStart);
  const cellCount = padding + totalDays;
  const weekCount = Math.max(MIN_WEEK_ROWS, Math.ceil(cellCount / 7));
  const totalSlots = weekCount * 7;

  const flatCells: (DayCell | null)[] = new Array(totalSlots).fill(null);

  let monthTotalM = 0;
  let runCount = 0;

  for (let day = 1; day <= totalDays; day++) {
    const dateKey = `${monthPrefix}-${String(day).padStart(2, '0')}`;
    const dayRows = byDay.get(dateKey) ?? [];
    const totalDistanceM = dayRows.reduce((sum, r) => sum + (r.distanceM || 0), 0);
    const totalTimeSec = dayRows.reduce((sum, r) => sum + (r.movingTimeSec || 0), 0);

    monthTotalM += totalDistanceM;
    runCount += dayRows.length;

    flatCells[padding + day - 1] = {
      dateKey,
      dayOfMonth: day,
      totalDistanceM,
      totalTimeSec,
      runCount: dayRows.length,
      activityIds: dayRows.map((r) => r.id),
      tintStep: tintStepForDistance(totalDistanceM),
    };
  }

  const weeks: (DayCell | null)[][] = [];
  for (let i = 0; i < totalSlots; i += 7) {
    weeks.push(flatCells.slice(i, i + 7));
  }

  const weekTotals: WeekTotal[] = weeks.map((week) => {
    const cells = week.filter((c): c is DayCell => c !== null);
    const totalDistanceM = cells.reduce((sum, c) => sum + c.totalDistanceM, 0);
    const totalTimeSec = cells.reduce((sum, c) => sum + c.totalTimeSec, 0);
    const runCount = cells.reduce((sum, c) => sum + c.runCount, 0);
    return { totalDistanceM, totalTimeSec, runCount, daysShown: cells.length, isPartial: cells.length < 7 };
  });

  return { month, weeks, weekTotals, monthTotalM, runCount };
}
