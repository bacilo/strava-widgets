---
phase: 16-dashboard-shell-data-contract
plan: 02
subsystem: ui
tags: [css-custom-properties, theming, localStorage, vitest, dark-mode, vanilla-ts]

# Dependency graph
requires:
  - phase: 16-dashboard-shell-data-contract (plan 01, if applicable)
    provides: dashboard source tree scaffold (src/dashboard/)
provides:
  - "src/dashboard/theme.ts — document-level theme resolution/persistence/cycling engine"
  - "src/dashboard/styles.css — the dashboard's single global stylesheet with all component classes plans 03-06 render against"
affects: [16-03, 16-04, 16-05, 16-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Document-level theme engine mirroring Shadow-DOM ThemeManager semantics, ported to data-theme on documentElement + localStorage persistence"
    - "Pure-function theme logic with injectable Document/Storage/MediaQueryList-shaped collaborators, testable in a node vitest environment with zero jsdom"
    - "Single global stylesheet with CSS custom properties declared per :root[data-theme] value, no prefers-color-scheme media query (theme.ts resolves the effective theme, CSS only selects on the concrete attribute)"

key-files:
  created:
    - src/dashboard/theme.ts
    - src/dashboard/theme.test.ts
    - src/dashboard/styles.css
  modified: []

key-decisions:
  - "parseThemeMode allow-lists exactly 'light'|'dark'|'auto' and falls back to 'auto' for anything else — the tamper guard the widget ThemeManager analog omits, since localStorage is user/extension-writable unlike a Shadow-DOM host attribute (T-16-TH-01)"
  - "applyThemeMode writes only the resolved effective theme ('light'|'dark') to data-theme, never 'auto' — styles.css selects on the concrete attribute value with no prefers-color-scheme fallback branch"
  - "Both getItem and setItem storage calls are wrapped in try/catch so Safari private-mode (or any throwing storage) degrades to 'auto' / a silently-skipped write rather than an unhandled exception (T-16-TH-02)"

requirements-completed: [DASH-03]

# Metrics
duration: ~15min
completed: 2026-08-10
---

# Phase 16 Plan 02: Dashboard Theme Engine & Global Stylesheet Summary

**Document-level light/dark/auto theme engine (data-theme + localStorage, ported from the widget ThemeManager with a tamper guard) plus the dashboard's single global CSS stylesheet declaring all widget-family tokens and every component class later plans render against.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-10T18:29:00Z (approx.)
- **Completed:** 2026-08-10T18:44:24Z
- **Tasks:** 2 completed
- **Files modified:** 3 created

## Accomplishments
- Ported the widget `ThemeManager`'s light/dark/auto resolution logic to document scope with a security-hardened `parseThemeMode` guard against tampered/unrecognised localStorage values
- Implemented `applyThemeMode`/`watchSystemTheme` with full node-environment test coverage (28 tests, zero jsdom) — 3 modes × 2 system preferences, storage-throw resilience, auto-only change-callback gating
- Authored `src/dashboard/styles.css` as the dashboard's single global stylesheet: exact widget-family color hexes at `:root[data-theme="light"|"dark"]`, a 4-size/2-weight typography contract, the full spacing scale, and every nav/card/list/cta/badge/stub component class plans 03-06 need without reopening this file
- Confined `--accent` usage to the 5 UI-SPEC reserved interactive states (nav hover/focus/active, theme-toggle active icon, CTA, loading indicator, global focus-visible ring)

## Task Commits

Each task was committed atomically (Task 1 followed TDD RED→GREEN):

1. **Task 1: Implement the document-level theme engine**
   - `a94973a` (test) — failing test suite for theme.ts (28 tests, module-not-found RED)
   - `7187202` (feat) — theme.ts implementation, all 28 tests passing
2. **Task 2: Author the global stylesheet with UI-SPEC tokens** - `5ba67e3` (feat)

_Note: Task 1 used TDD (RED → GREEN); no REFACTOR commit was needed since the GREEN implementation required no cleanup pass._

## Files Created/Modified
- `src/dashboard/theme.ts` - Exports `Theme`, `ThemeMode`, `THEME_STORAGE_KEY`, `THEME_MODES`, `parseThemeMode`, `resolveEffectiveTheme`, `cycleThemeMode`, `ThemeStorage`, `readStoredMode`, `ApplyThemeOptions`, `applyThemeMode`, `ThemeMediaQuery`, `watchSystemTheme`
- `src/dashboard/theme.test.ts` - 28 tests covering every `<behavior>` line: mode parsing/tamper-guard, effective-theme resolution matrix, cycling, stored-mode reading (including throwing storage), `applyThemeMode` DOM/storage side effects and error-swallowing, `watchSystemTheme` auto-only gating and unsubscribe
- `src/dashboard/styles.css` - Global design tokens (`--bg`, `--surface`, `--accent`, `--text`, `--text-secondary`, `--border`, `--destructive`, spacing scale, `--font-stack`), typography roles, and component classes (`.app-nav*`, `.theme-toggle*`, `.view`, `.card`, `.stat-grid`, `.activity-list`, `.activity-row*`, `.badge`, `.cta`, `.loading-indicator`, `.error-state`, `.stub-panel`), plus the 640px hamburger-collapse media query

## Decisions Made
- Kept two literal comment-string tweaks during implementation (referring to "the widget system's Shadow-DOM theme class" instead of the literal path `theme-manager.ts`, and "system-color-scheme" instead of the literal string `prefers-color-scheme` in one comment) purely to satisfy the plan's literal `grep -c`/`css.includes()` acceptance-criteria checks, which scan for those exact substrings anywhere in the file including comments. No behavioral change — see Deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Doc comments tripped the literal acceptance-criteria grep checks**
- **Found during:** Task 1 verification (`grep -c "theme-manager" src/dashboard/theme.ts` and `grep -c "styles.css" src/dashboard/theme.ts`) and Task 2 verification (styles.css contract script's `css.includes('prefers-color-scheme')` check)
- **Issue:** Explanatory doc comments in `theme.ts` referenced `src/widgets/shared/theme-manager.ts` by path and mentioned `styles.css` by name; a comment in `styles.css` itself used the literal substring `prefers-color-scheme`. The plan's acceptance criteria are literal substring/grep checks with no distinction between code and comments, so these non-functional prose references caused the checks to fail even though no actual import or media query existed.
- **Fix:** Reworded the three comments to convey the same information without the flagged literal strings (referencing "the widget system's Shadow-DOM theme class" and "the global stylesheet" instead of file paths; "system-color-scheme" instead of the literal `prefers-color-scheme` string).
- **Files modified:** `src/dashboard/theme.ts`, `src/dashboard/styles.css`
- **Verification:** Re-ran `grep -c "theme-manager"` / `grep -c "styles.css"` (both 0) and the full styles.css contract script (exits 0, prints `styles.css contract OK`)
- **Committed in:** `7187202` (theme.ts), `5ba67e3` (styles.css) — folded into each task's single commit since no separate commit had landed yet

---

**Total deviations:** 1 auto-fixed (Rule 1, cosmetic comment wording only)
**Impact on plan:** No scope creep, no behavioral change — purely aligning comment prose with the plan's literal string-matching verification scripts.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
`src/dashboard/theme.ts` and `src/dashboard/styles.css` are ready for plan 06 (index.html wiring, theme toggle button, nav markup) to consume directly. All component classes plans 03-05 will render against (`.card`, `.activity-row`, `.stat-grid`, `.error-state`, `.stub-panel`, `.cta`, `.badge`) are already declared, so those plans should not need to touch this stylesheet. No blockers.

---
*Phase: 16-dashboard-shell-data-contract*
*Completed: 2026-08-10*

## Self-Check: PASSED

- FOUND: `src/dashboard/theme.ts`
- FOUND: `src/dashboard/theme.test.ts`
- FOUND: `src/dashboard/styles.css`
- FOUND: `.planning/phases/16-dashboard-shell-data-contract/16-02-SUMMARY.md`
- FOUND commit: `a94973a` (test)
- FOUND commit: `7187202` (feat)
- FOUND commit: `5ba67e3` (feat)
