/**
 * Document-level theme engine for the dashboard shell.
 *
 * Mirrors the semantics of the widget system's Shadow-DOM theme class
 * (light/dark/auto resolution against `prefers-color-scheme`), but applies the
 * result to `document.documentElement` via a `data-theme` attribute instead of a
 * Shadow DOM host attribute, and persists the chosen MODE (not the resolved
 * theme) to localStorage under `THEME_STORAGE_KEY`.
 *
 * This module owns the entire theme contract for the dashboard: nothing else in
 * `src/dashboard/` may read or write `localStorage` for theming.
 *
 * Security note (threat T-16-TH-01): `localStorage` is user/extension-writable in a
 * way a Shadow-DOM host attribute is not, so `parseThemeMode` allow-lists exactly
 * `'light' | 'dark' | 'auto'` and falls back to `'auto'` for anything else — a
 * tampered or unrecognised stored value can never reach `setAttribute('data-theme', ...)`.
 *
 * BL-03: the storage HANDLE (not the theme contract) is now resolved by
 * `storage.ts`'s `resolveStorage`. The `localStorage` PROPERTY GETTER throws
 * under blocked site data, and the previous `options.storage ?? localStorage`
 * form threw during module evaluation when reached from `main.ts`'s module
 * scope — `resolveStorage` wraps that property access in try/catch instead.
 */

import { resolveStorage, type WebStorage } from './storage.js';

export type Theme = 'light' | 'dark';
export type ThemeMode = Theme | 'auto';

export const THEME_STORAGE_KEY = 'dashboard-theme';

export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'auto'];

/**
 * Parses an arbitrary value (typically read from localStorage) into a valid
 * ThemeMode. Anything other than the exact strings 'light', 'dark', or 'auto'
 * falls back to 'auto' — this is the tamper guard the widget ThemeManager analog
 * deliberately omits, because its input is a developer-set host attribute.
 */
export function parseThemeMode(raw: unknown): ThemeMode {
  if (raw === 'light' || raw === 'dark' || raw === 'auto') return raw;
  return 'auto';
}

/**
 * Resolves a ThemeMode plus the current system preference into a concrete Theme.
 * Explicit 'light'/'dark' modes always win; 'auto' defers to prefersDark.
 */
export function resolveEffectiveTheme(mode: ThemeMode, prefersDark: boolean): Theme {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return prefersDark ? 'dark' : 'light';
}

/** Cycles light -> dark -> auto -> light, matching the header toggle's UI-SPEC behavior. */
export function cycleThemeMode(mode: ThemeMode): ThemeMode {
  if (mode === 'light') return 'dark';
  if (mode === 'dark') return 'auto';
  return 'light';
}

/** The shape is declared once, in `storage.ts` (BL-03/GC-5l); the exported
 * NAME survives so `theme.test.ts` and `nav.ts` keep compiling unchanged. */
export type ThemeStorage = WebStorage;

/**
 * Reads the persisted theme mode from storage, tolerating a missing handle
 * (BL-03, `storage` is `null` when `resolveStorage` could not obtain one)
 * and a throwing `getItem` (e.g. Safari private-mode) by falling back to
 * 'auto' rather than propagating.
 */
export function readStoredMode(storage: ThemeStorage | null): ThemeMode {
  if (!storage) return 'auto';
  try {
    return parseThemeMode(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'auto';
  }
}

export interface ApplyThemeOptions {
  prefersDark?: boolean;
  doc?: Document;
  storage?: ThemeStorage | null;
  persist?: boolean;
}

/**
 * Resolves the effective theme for `mode`, writes it to `data-theme` on
 * `doc.documentElement` (always 'light' or 'dark' — never 'auto', since the
 * global stylesheet selects on the concrete attribute value with no
 * prefers-color-scheme fallback branch), and persists the MODE string (unless
 * `persist === false` or no storage handle could be resolved) under
 * THEME_STORAGE_KEY. Storage write failures are swallowed so a throwing
 * setItem never prevents the DOM update, and the `data-theme` write itself is
 * unconditional — it never depends on a usable storage handle. Returns the
 * effective theme that was applied.
 *
 * Defaults are resolved lazily inside the function body (not as parameter
 * defaults) so this module stays importable in a Node test environment with no
 * `document`/`window`/`localStorage` globals. The storage handle specifically
 * is resolved via `resolveStorage` (BL-03), which returns `null` rather than
 * throwing when the storage global's property getter itself throws (blocked
 * site data) or when no override and no global are available.
 */
export function applyThemeMode(mode: ThemeMode, options: ApplyThemeOptions = {}): Theme {
  const doc = options.doc ?? document;
  const storage = resolveStorage(options.storage ?? undefined);
  const prefersDark =
    options.prefersDark ?? window.matchMedia('(prefers-color-scheme: dark)').matches;
  const persist = options.persist ?? true;

  const effective = resolveEffectiveTheme(mode, prefersDark);
  doc.documentElement.setAttribute('data-theme', effective);

  if (persist && storage) {
    try {
      storage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Swallow storage write failures (e.g. Safari private mode) — the DOM
      // attribute is already applied, which is the behavior that matters.
    }
  }

  return effective;
}

export interface ThemeMediaQuery {
  matches: boolean;
  addEventListener(type: 'change', l: (e: { matches: boolean }) => void): void;
  removeEventListener(type: 'change', l: (e: { matches: boolean }) => void): void;
}

/**
 * Registers a 'change' listener on the system color-scheme media query that
 * invokes `callback` only when the currently stored mode is 'auto', mirroring
 * ThemeManager.listenForChanges' auto-only guard. Returns an unsubscribe function.
 */
export function watchSystemTheme(
  callback: (prefersDark: boolean) => void,
  options: { mediaQuery?: ThemeMediaQuery; storage?: ThemeStorage | null } = {}
): () => void {
  const mediaQuery =
    options.mediaQuery ?? window.matchMedia('(prefers-color-scheme: dark)');
  const storage = resolveStorage(options.storage ?? undefined);

  const listener = (e: { matches: boolean }) => {
    if (readStoredMode(storage) === 'auto') {
      callback(e.matches);
    }
  };

  mediaQuery.addEventListener('change', listener);

  return () => {
    mediaQuery.removeEventListener('change', listener);
  };
}
