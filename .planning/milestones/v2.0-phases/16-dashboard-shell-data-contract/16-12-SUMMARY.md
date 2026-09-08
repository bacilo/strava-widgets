---
phase: 16-dashboard-shell-data-contract
plan: 12
subsystem: ui
tags: [typescript, vitest, timezone, dashboard, dates]

# Dependency graph
requires:
  - phase: 16-dashboard-shell-data-contract
    provides: list/overview/detail views, compute-dashboard-index generator (plans 06-09)
provides:
  - Timezone-independent formatActivityDate serving list, overview, and detail views
  - NaN-safe, timezone-normalized dashboard index sort key
  - Stale-container guards on the list and overview error paths, matching detail.ts
affects: [17-activity-browser, 18-records-trends]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Normalize before parse: append Z to no-Z timestamps before new Date()/Date.parse() so wall-clock local time reads consistently regardless of viewer/build-machine TZ"
    - "NaN-safe sort comparator: fall back to a sentinel (0) instead of letting Date.parse's NaN propagate into an unspecified sort order"

key-files:
  created:
    - src/dashboard/views/list.test.ts
  modified:
    - src/dashboard/views/list.ts
    - src/dashboard/views/overview.ts
    - src/analytics/compute-dashboard-index.ts
    - src/analytics/compute-dashboard-index.test.ts

key-decisions:
  - "formatActivityDate normalizes by appending Z to no-Z timestamps rather than parsing wall-clock components manually — keeps the existing getUTC* read path and MONTH_NAMES output shape unchanged for well-formed input"
  - "WR-07 (bestEfforts?.activities[id] throw and pre-push counter increments in compute-dashboard-index.ts) deliberately left out of scope for this gap-closure pass, per plan instruction — diff to compute-dashboard-index.ts touches only the sort comparator, the new startDateSortKey helper, and their comments"
  - "list.ts and overview.ts get a container-only guard (no per-mount request token) since they read the shared memoized index client and don't re-fetch per route param; detail.ts's token is Phase 17 scope, deliberately not backported"

requirements-completed: [DASH-02]

# Metrics
duration: 4min
completed: 2026-08-11
---

# Phase 16 Plan 12: Timezone-Safe Dates and Index Ordering Summary

**Normalized formatActivityDate and the dashboard index sort key to append Z before parsing no-Z intervals.icu timestamps, plus stale-container guards on list/overview error paths matching detail.ts's existing pattern.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-11T11:15:23Z
- **Completed:** 2026-08-11T11:17:12Z
- **Tasks:** 3 completed
- **Files modified:** 5 (2 created/modified test files, 3 source files)

## Accomplishments

- `formatActivityDate` (src/dashboard/views/list.ts) now normalizes both archive timestamp shapes — Z-suffixed Strava records and no-Z intervals.icu records — to the same UTC-parseable form before reading `getUTC*` components, eliminating the viewer's-browser-timezone date shift (WR-02). Verified identical output across `TZ=UTC`, `TZ=America/New_York`, `TZ=Europe/Copenhagen`, `TZ=Pacific/Auckland`.
- `compute-dashboard-index.ts`'s row-order comparator now uses a new `startDateSortKey` helper that normalizes the same way and falls back to `0` on an unparseable timestamp, fixing build-machine-timezone-dependent index ordering (WR-03) and preventing one malformed row from corrupting the whole sort.
- `list.ts` and `overview.ts` error (`catch`) paths now return early when `mountedContainer !== ctx.container`, matching `detail.ts`'s existing guard, so a late-arriving rejection can no longer paint over a view the user has already navigated away from (WR-01).

## Load-Bearing Mutation Check (Task 1, required by plan)

Reverted the `endsWith('Z')` normalization to a bare `new Date(isoLocal)` and ran `TZ=America/New_York npx vitest run src/dashboard/views/list.test.ts`:

- **Before restoring the fix:** 2 tests failed — the 22:30 no-Z case produced `'Aug 7, 2026'` (expected `'Aug 6, 2026'`), and the Dec-31 year-boundary case produced `'Jan 1, 2025'` (expected `'Dec 31, 2024'`). This reproduces the exact WR-02 defect described in the plan.
- **After restoring the fix:** all 8 tests passed again under the same `TZ=America/New_York`.

This confirms the test suite is load-bearing — it fails without the normalization and passes with it.

## Task Commits

Each task was committed atomically:

1. **Task 1: Normalize formatActivityDate and prove it timezone-independent** - `d70dcf6` (fix)
2. **Task 2: Normalize and NaN-proof the dashboard index sort key** - `d59f0d6` (fix)
3. **Task 3: Guard the list and overview error paths against painting into a container they no longer own** - `b01e551` (fix)

**Plan metadata:** committed alongside this SUMMARY.md (worktree mode — orchestrator finalizes shared-file commit after wave merge)

## Files Created/Modified

- `src/dashboard/views/list.ts` - `formatActivityDate` normalizes no-Z timestamps before parsing, returns em dash on NaN/non-string input; catch-path guard added
- `src/dashboard/views/list.test.ts` - New: 8 timezone-independence cases for `formatActivityDate`, describe block named after the WR-02 defect
- `src/dashboard/views/overview.ts` - Catch-path guard added (imports `formatActivityDate` from list.ts, unchanged)
- `src/analytics/compute-dashboard-index.ts` - New `startDateSortKey` module-level helper; sort comparator now uses it instead of raw `Date.parse`
- `src/analytics/compute-dashboard-index.test.ts` - Two new sibling `it` cases: mixed-suffix boundary ordering and malformed-timestamp resilience

## Decisions Made

- Kept the normalization approach (append `Z`, keep `getUTC*` reads) rather than switching to manual wall-clock component parsing, per the plan's interface contract — minimizes the diff and preserves the existing `MONTH_NAMES`/output-shape code untouched.
- `startDateSortKey` returns `0` (Unix epoch) on NaN rather than throwing or filtering the row out — this confines a malformed timestamp's damage to sorting it last (all real archive dates are positive epoch values) without dropping the row from the index or aborting the run.
- Did not add a per-mount request token to `list.ts`/`overview.ts` — the plan explicitly scoped that to Phase 17 and the container-identity check alone is sufficient since these views don't re-fetch per route param the way `detail.ts` does.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `npm run verify-dashboard` initially reported 2 failures (`data/stats/all-time-totals.json` and `data/stats/streaks.json` 404) because those gitignored stats files didn't exist yet in this worktree — they're generated by `compute-stats` and `compute-advanced-stats`, both out of scope for this plan. Ran both generators (pre-existing pipeline commands, no code changes) and re-ran `build-widgets`/`verify-dashboard`, which then reported the plan's target of 15 checks passed, 0 failures. No source changes were needed; this was purely a local data-generation prerequisite, not a defect in this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WR-01, WR-02, WR-03 all closed and verified with committed regression tests.
- WR-07 (`bestEfforts?.activities[id]` throw risk and pre-push counter increments in `compute-dashboard-index.ts`) remains open, deliberately out of scope for this plan — flagged for a future gap-closure or Phase 17/18 pass.
- `npx tsc --noEmit`, `npm test` (344 tests across 19 files), and the full suite under `TZ=UTC`/`TZ=America/New_York`/`TZ=Europe/Copenhagen` all pass identically.
- `npm run build && npm run compute-dashboard-index` regenerates `data/dashboard/index.json` with 1,867 rows, first row `i`-prefixed (newest is an intervals.icu-migrated activity).
- `npm run build-widgets && npm run verify-dashboard` reports 15 checks passed, 0 failures — matches the plan's `<verification>` step 5 target exactly.

---
*Phase: 16-dashboard-shell-data-contract*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: src/dashboard/views/list.ts
- FOUND: src/dashboard/views/list.test.ts
- FOUND: src/dashboard/views/overview.ts
- FOUND: src/analytics/compute-dashboard-index.ts
- FOUND: src/analytics/compute-dashboard-index.test.ts
- FOUND: .planning/phases/16-dashboard-shell-data-contract/16-12-SUMMARY.md
- FOUND commit: d70dcf6 (Task 1)
- FOUND commit: d59f0d6 (Task 2)
- FOUND commit: b01e551 (Task 3)
