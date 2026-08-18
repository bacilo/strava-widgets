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
 * `'sunday' | 'monday'` and falls back to `'monday'` for anything else.
 * That allow-list is the ONLY path by which a stored value reaches the
 * grid math — the resolver below returns a handle, never a value, and
 * performs no parsing, normalisation, repair or write-back. Defence in
 * depth: `calendar-logic.ts`'s offset lookup is itself total (WR-01), so
 * an off-union value that somehow bypassed `parseWeekStart` degrades to
 * the Monday default rather than reaching `new Array(NaN)`.
 *
 * Security note (threat T-22-WK-02, CR-01): the read and the write are
 * wrapped against a throwing `getItem`/`setItem` (Safari private mode,
 * quota exceeded) — but that alone does NOT cover a browser configuration
 * where site data is blocked (Firefox "Block cookies and site data",
 * Chrome blocked-origin storage, a storage-partitioned iframe). In that
 * case the `globalThis.localStorage` GETTER ITSELF throws `SecurityError`
 * before `readStoredWeekStart`'s try/catch is ever entered. This claim was
 * false as originally shipped in Round 1 — `resolveWeekStartStorage` below
 * is the fix: it is the ONLY place in `src/dashboard/` allowed to touch a
 * storage global for this key, and it wraps that property access in its
 * own try/catch, separate from the `getItem`/`setItem` guards.
 */

import type { WeekStart } from './calendar-logic.js';

export const WEEK_START_STORAGE_KEY = 'dashboard-calendar-week-start';

export interface WeekStartStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Resolves the storage handle the Calendar view should use (CR-01).
 *
 * Returns `override` immediately when one is supplied — the override path
 * never touches `globalThis.localStorage` at all, so a caller-injected fake
 * (tests, or a future non-browser host) is never at the mercy of the
 * global's accessibility. Otherwise it reads `globalThis.localStorage`
 * **inside a `try` block**: with site data blocked, the property GETTER
 * throws `SecurityError` before any `getItem` call could run, which is why
 * `readStoredWeekStart`'s own try/catch (around `getItem` only) is not
 * sufficient on its own. Returns `null` when the global is absent (this
 * repo's default `environment: 'node'` test state) or when the getter
 * throws. This is the ONLY place in `src/dashboard/` allowed to touch a
 * storage global for `WEEK_START_STORAGE_KEY` (D-06).
 */
export function resolveWeekStartStorage(override?: WeekStartStorage): WeekStartStorage | null {
  if (override) return override;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
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
 * missing handle (CR-01/GC-2b, `storage` is `null` when
 * `resolveWeekStartStorage` could not obtain one) and a throwing `getItem`
 * (e.g. Safari private-mode) by falling back to 'monday' rather than
 * propagating (T-22-WK-02).
 */
export function readStoredWeekStart(storage: WeekStartStorage | null): WeekStart {
  if (!storage) return 'monday';
  try {
    return parseWeekStart(storage.getItem(WEEK_START_STORAGE_KEY));
  } catch {
    return 'monday';
  }
}

/**
 * Persists `value` under WEEK_START_STORAGE_KEY, tolerating a missing
 * handle (CR-01/GC-2b) and a throwing `setItem` (e.g. Safari private-mode,
 * quota exceeded) by swallowing the failure (T-22-WK-02). Does ONLY the
 * write — no DOM side effect, since the grid rebuild is `calendar.ts`'s job
 * (D-04).
 */
export function writeWeekStart(storage: WeekStartStorage | null, value: WeekStart): void {
  if (!storage) return;
  try {
    storage.setItem(WEEK_START_STORAGE_KEY, value);
  } catch {
    // Swallow storage write failures (e.g. Safari private mode) — the grid
    // is already rebuilt in memory, which is the behavior that matters.
  }
}
