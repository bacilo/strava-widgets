/**
 * Calendar week-start persistence module.
 *
 * This module owns the entire week-start persistence contract for the
 * Calendar view (D-06): nothing else in `src/dashboard/` may read or write
 * `localStorage` under `WEEK_START_STORAGE_KEY`. It is calendar-scoped and
 * has exactly one importer (`calendar.ts`), deliberately narrower than a
 * generic view-preference facility — see 22-CONTEXT.md D-06.
 *
 * Security note (threat T-22-WK-01): `localStorage` is user- and
 * extension-writable, so `parseWeekStart` allow-lists exactly
 * `'sunday' | 'monday'` and falls back to `'monday'` for anything else —
 * a tampered or unrecognised stored value can never reach the grid math.
 *
 * Security note (threat T-22-WK-02): both the read and the write are
 * wrapped against a throwing storage (Safari private mode, disabled
 * cookies, quota exceeded), matching `theme.ts`'s `readStoredMode` /
 * `applyThemeMode` discipline exactly.
 */

import type { WeekStart } from './calendar-logic.js';

export const WEEK_START_STORAGE_KEY = 'dashboard-calendar-week-start';

export interface WeekStartStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Parses an arbitrary value (typically read from localStorage) into a valid
 * WeekStart. Anything other than the exact strings 'sunday' or 'monday'
 * falls back to 'monday' (D-03/D-07) — no normalisation, no repair, no
 * write-back, no console output.
 */
export function parseWeekStart(raw: unknown): WeekStart {
  if (raw === 'sunday' || raw === 'monday') return raw;
  return 'monday';
}

/**
 * Reads the persisted week-start preference from storage, tolerating a
 * throwing `getItem` (e.g. Safari private-mode) by falling back to
 * 'monday' rather than propagating (T-22-WK-02).
 */
export function readStoredWeekStart(storage: WeekStartStorage): WeekStart {
  try {
    return parseWeekStart(storage.getItem(WEEK_START_STORAGE_KEY));
  } catch {
    return 'monday';
  }
}

/**
 * Persists `value` under WEEK_START_STORAGE_KEY, tolerating a throwing
 * `setItem` (e.g. Safari private-mode, quota exceeded) by swallowing the
 * failure (T-22-WK-02). Does ONLY the write — no DOM side effect, since the
 * grid rebuild is `calendar.ts`'s job (D-04).
 */
export function writeWeekStart(storage: WeekStartStorage, value: WeekStart): void {
  try {
    storage.setItem(WEEK_START_STORAGE_KEY, value);
  } catch {
    // Swallow storage write failures (e.g. Safari private mode) — the grid
    // is already rebuilt in memory, which is the behavior that matters.
  }
}
