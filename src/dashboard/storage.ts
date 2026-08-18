/**
 * Shared storage-handle resolver (BL-03).
 *
 * This module owns the ONLY dereference of a storage global in
 * `src/dashboard/` — every other module that needs `localStorage` resolves
 * its handle through `resolveStorage` rather than reading
 * `globalThis.localStorage` (or a bare `localStorage`) itself.
 *
 * The throwing operation under blocked site data (Firefox "Block cookies
 * and site data", Chrome "Don't allow sites to save data", a
 * storage-partitioned iframe) is the `localStorage` PROPERTY GETTER, which
 * throws before any `getItem`/`setItem` call could even run — so wrapping
 * `getItem`/`setItem` alone (what every per-key module already did) is not
 * sufficient on its own. `resolveStorage` wraps the property access itself.
 *
 * Why this is app-wide rather than calendar-scoped (BL-03): `main.ts:19`,
 * `nav.ts:186`, `nav.ts:206`, `theme.ts:93`, `theme.ts:130` and
 * `detail-charts.ts:218` all dereferenced the global unguarded, and
 * `main.ts:19`/`nav.ts:186` run at module scope — so under that
 * configuration the whole dashboard module graph failed to evaluate and the
 * page rendered BLANK, before any router, any view and any error panel
 * existed.
 *
 * D-06 fence: this module resolves a HANDLE. It declares no storage key,
 * calls no `getItem`/`setItem`, parses no value and holds no key registry.
 * Per-key contracts (`calendar-preferences.ts` for the week start,
 * `theme.ts` for the theme mode, `detail-charts-logic.ts` for the overlay
 * config) stay where they are; the shared view-preference facility
 * 22-CONTEXT.md defers is deliberately NOT built here.
 */

export interface WebStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Resolves the storage handle a caller should use. Returns `override`
 * immediately when one is supplied — the override path never touches
 * `globalThis.localStorage` at all, so a caller-injected fake (tests, or a
 * future non-browser host) is never at the mercy of the global's
 * accessibility. Otherwise reads `globalThis.localStorage` **inside a
 * `try` block**, returning that handle or `null` when it is absent, and
 * returning `null` from the `catch` when the property getter throws.
 */
export function resolveStorage(override?: WebStorage): WebStorage | null {
  if (override) return override;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
