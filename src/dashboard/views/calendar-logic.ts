/**
 * Calendar training log — pure, DOM-free date math and per-day aggregation
 * (BROWSE-05). No import from `list-logic.ts` (D-16): the calendar's data
 * derivation is deliberately independent of the list's filters and has its
 * own URL contract, `#/calendar?month=YYYY-MM`.
 *
 * `now` is always injected by the caller, never constructed fresh
 * inside this module — keeps every function here total and deterministic.
 */

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
