---
phase: quick-1
plan: 01
subsystem: infra
tags: [github-actions, sqlite, offline-geocoder, ci, lazy-init, dynamic-import]

# Dependency graph
requires: []
provides:
  - "Lazy singleton getGeo() in geocoder.ts — SQLite only loads on first geocode call"
  - "Dynamic import of compute-geo-stats module in non-geo CLI commands"
affects: [ci, daily-refresh-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy singleton for heavy native modules (SQLite, large DBs)"
    - "Dynamic import() for CLI commands with optional heavy dependencies"

key-files:
  created: []
  modified:
    - src/geo/geocoder.ts
    - src/index.ts

key-decisions:
  - "Lazy-initialize offline-geocoder via getGeo() singleton instead of eager module-level init"
  - "Dynamic import() of compute-geo-stats in index.ts so non-geo commands never touch SQLite"

patterns-established:
  - "Lazy init pattern: let singleton = null; function get() { if (!singleton) singleton = init(); return singleton; }"
  - "Dynamic import for CLI command isolation: const { fn } = await import('./module.js') inside command handler"

requirements-completed: [FIX-CI-01]

# Metrics
duration: 2min
completed: 2026-02-18
---

# Quick Task 1: Fix Daily Widget Refresh GitHub Actions Summary

**Lazy-initialized offline-geocoder via getGeo() singleton and dynamic import() for geo module, eliminating SQLITE_CANTOPEN on non-geo CI commands**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-18T09:18:18Z
- **Completed:** 2026-02-18T09:19:33Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Converted eager module-level offline-geocoder initialization to a lazy singleton — SQLite database only opens when `geocodeCoordinate()` is actually called
- Removed static top-level import of `compute-geo-stats` from `index.ts`, replacing with `await import()` inside each geo command handler
- `node dist/index.js compute-stats` and `node dist/index.js compute-advanced-stats` now run without loading SQLite, fixing the SQLITE_CANTOPEN error in the Daily Widget Refresh workflow's "Process statistics" step

## Task Commits

Each task was committed atomically:

1. **Task 1: Lazy-initialize offline-geocoder in geocoder.ts** - `ae50fb5` (fix)
2. **Task 2: Dynamic-import geo module in index.ts** - `6995ef0` (fix)

**Plan metadata:** (this SUMMARY commit)

## Files Created/Modified

- `src/geo/geocoder.ts` - Replaced eager `const geo = geocoder()` with lazy `getGeo()` singleton; updated `geocodeCoordinate` call site
- `src/index.ts` - Removed static `import { computeGeoStats }` from top-level; added `await import('./geo/compute-geo-stats.js')` inside `computeGeoStatsCommand()` and `computeAllStatsCommand()`

## Decisions Made

- Used function-scoped `createRequire` inside `getGeo()` rather than module-level to keep the require factory creation deferred alongside the SQLite initialization
- Dynamic import placed inside the `try` block so import errors surface through existing error handling and produce sensible messages

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Daily Widget Refresh CI should now succeed for `compute-stats` and `compute-advanced-stats` steps
- `compute-geo-stats` remains unchanged in behavior when explicitly invoked; the `continue-on-error: true` in the workflow handles any geocoder failures gracefully
- No regressions in any CLI command

---

## Self-Check

**Files modified exist:**
- `src/geo/geocoder.ts` - FOUND
- `src/index.ts` - FOUND

**Commits exist:**
- `ae50fb5` - fix(quick-1-01): lazy-initialize offline-geocoder in geocoder.ts
- `6995ef0` - fix(quick-1-01): dynamic-import geo module in index.ts

## Self-Check: PASSED

---
*Phase: quick-1*
*Completed: 2026-02-18*
