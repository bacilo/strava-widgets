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
 * grid math — `resolveStorage` (imported from `../storage.js`, the app-wide
 * resolver this module's `resolveWeekStartStorage` delegates to) returns a
 * handle, never a value, and performs no parsing, normalisation, repair or
 * write-back. Defence in depth: `calendar-logic.ts`'s offset lookup is
 * itself total (WR-01), so an off-union value that somehow bypassed
 * `parseWeekStart` degrades to the Monday default rather than reaching
 * `new Array(NaN)`.
 *
 * Security note (threat T-22-WK-02, CR-01, BL-03): the read and the write
 * are wrapped against a throwing `getItem`/`setItem` (Safari private mode,
 * quota exceeded). Separately — and this is the part Round 1 got wrong —
 * the storage global's property GETTER throws before either `getItem` or
 * `setItem` is ever called, when site data is blocked (Firefox "Block
 * cookies and site data", Chrome "Don't allow sites to save data", a
 * storage-partitioned iframe). That property access is now guarded in
 * exactly ONE place app-wide: `src/dashboard/storage.ts`'s `resolveStorage`,
 * which `resolveWeekStartStorage` below delegates to in one line.
 *
 * As shipped in Rounds 1 and 2, this note claimed a calendar-scoped guard
 * closed an app-level threat. That claim was FALSE: `main.ts:19` and
 * `nav.ts:186` ran the same unguarded property access at MODULE SCOPE, so
 * under blocked site data the entire dashboard module graph failed to
 * evaluate and the page rendered BLANK — before the Calendar's own working
 * guard was ever reached, and before any router, any view or any error
 * panel existed. This module's own guard is, and always was, correct in
 * isolation; the false claim was about what it closed at the app level.
 *
 * The closure claim is only true once plan `22-11` has wired `main.ts`,
 * `nav.ts`, `theme.ts` and `detail-charts.ts` to `resolveStorage` too — that
 * dependency is named here rather than asserting a closure this module
 * cannot deliver alone.
 */

import type { WeekStart } from './calendar-logic.js';
import { resolveStorage, type WebStorage } from '../storage.js';

export const WEEK_START_STORAGE_KEY = 'dashboard-calendar-week-start';

/**
 * The shape is declared once, in `storage.ts`, rather than restated per
 * module (GC-5c) — the exported NAME survives so `calendar.ts` and this
 * file's own tests keep compiling unchanged.
 */
export type WeekStartStorage = WebStorage;

/**
 * The Calendar's named entry point into the shared storage-handle resolver
 * (BL-03, CR-01). D-06 keeps the whole week-start persistence contract in
 * this module, so the Calendar reaches storage through its own name rather
 * than importing `resolveStorage` directly — but this function performs no
 * guarding of its own: it is a one-line delegation, and `storage.ts`'s
 * `resolveStorage` is where the storage global's property getter is
 * actually wrapped in try/catch. Round 2 shipped a parallel try/catch
 * here; Round 3 removed it so exactly one storage guard exists app-wide.
 */
export function resolveWeekStartStorage(override?: WeekStartStorage): WeekStartStorage | null {
  return resolveStorage(override);
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
