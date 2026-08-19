/**
 * In-memory theme-toggle mode controller (CR-01).
 *
 * The mode is session state, seeded ONCE by the caller and reassigned on
 * each `toggle()` call — the same `let weekStart = readStoredWeekStart(storage)`
 * shape `calendar.ts:443` already uses, which is exactly why the week-start
 * toggle never had this defect. Re-deriving the mode from storage on every
 * click is CR-01: under a null handle `readStoredMode(null)` is a constant
 * `'auto'` and `cycleThemeMode('auto')` is a constant `'light'`, so the
 * toggle was stranded on light forever. This module never reads storage
 * itself — seeding is the caller's job.
 */

import { cycleThemeMode, type ThemeMode, type ApplyThemeOptions } from './theme.js';

export interface ThemeToggleControllerDeps {
  initialMode: ThemeMode;
  apply: (mode: ThemeMode, options?: ApplyThemeOptions) => void;
  render: (mode: ThemeMode, prefersDark?: boolean) => void;
}

export interface ThemeToggleController {
  mode(): ThemeMode;
  isAuto(): boolean;
  toggle(): ThemeMode;
  syncSystemTheme(prefersDark: boolean): void;
}

export function createThemeToggleController(deps: ThemeToggleControllerDeps): ThemeToggleController {
  let currentMode: ThemeMode = deps.initialMode;

  function mode(): ThemeMode {
    return currentMode;
  }

  function isAuto(): boolean {
    return currentMode === 'auto';
  }

  function toggle(): ThemeMode {
    currentMode = cycleThemeMode(currentMode);
    deps.apply(currentMode);
    deps.render(currentMode);
    return currentMode;
  }

  function syncSystemTheme(prefersDark: boolean): void {
    deps.apply('auto', { prefersDark });
    deps.render('auto', prefersDark);
  }

  return { mode, isAuto, toggle, syncSystemTheme };
}
