---
phase: 02-core-analytics-first-widget
plan: 01
subsystem: analytics
tags: [typescript, statistics, analytics, date-utils, aggregations]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: "1,808 activity JSON files in data/activities/ with Strava Run data"
provides:
  - "Statistics computation engine that processes 1,808 activities into weekly/monthly/yearly aggregations"
  - "5 static JSON files (weekly-distance.json, all-time-totals.json, monthly-stats.json, yearly-stats.json, metadata.json)"
  - "Analytics type definitions (WeeklyStats, AllTimeTotals, PeriodStats, StatsMetadata)"
  - "UTC-safe date utilities for week/month/year boundary calculations"
  - "CLI command to regenerate statistics: npm run compute-stats"
affects: [02-02-embeddable-widget, 03-advanced-analytics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UTC-only date calculations for timezone-safe aggregations (ISO 8601 Monday-start weeks)"
    - "Correct average pace computation using total_time/total_distance (not averaging individual paces)"
    - "Map-based aggregation pattern for grouping by time periods"

key-files:
  created:
    - src/types/analytics.types.ts
    - src/analytics/date-utils.ts
    - src/analytics/compute-stats.ts
  modified:
    - src/index.ts
    - package.json

key-decisions:
  - "Monday-start weeks (ISO 8601 standard) using UTC day-of-week calculations"
  - "Average pace computed as total_time/total_distance (not averaging individual paces per research findings)"
  - "Generated stats stored as static JSON files in data/stats/ (excluded from git)"
  - "All date utilities use UTC methods exclusively (getUTCDay, getUTCMonth, etc) for timezone safety"

patterns-established:
  - "Date utilities pattern: All date functions use UTC methods exclusively, never local timezone methods"
  - "Statistics aggregation pattern: Group by period start (week/month/year), accumulate totals, compute averages from totals"
  - "CLI command pattern: Add command function, integrate into switch statement, add npm script"

# Metrics
duration: 3min
completed: 2026-02-14
---

# Phase 02 Plan 01: Core Analytics & First Widget - Statistics Computation

**Statistics computation engine processes 1,808 Strava activities into 465 weeks, 118 months, and 14 years of aggregated data with UTC-safe date boundaries and correct pace calculations**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-14T09:21:39Z
- **Completed:** 2026-02-14T09:24:32Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created analytics type definitions for all statistical data structures (WeeklyStats, AllTimeTotals, PeriodStats, StatsMetadata)
- Built UTC-safe date utilities with Monday-start week calculations (ISO 8601 standard)
- Implemented statistics computation engine that processes 1,808 activities into weekly/monthly/yearly aggregations
- Generated 5 static JSON files with correct average pace calculations (total_time/total_distance method)
- Added compute-stats CLI command to regenerate statistics from activity files
- Verified with real data: 465 weeks, 118 months, 14 years, 21,774 km total distance, 5.7 min/km average pace

## Task Commits

Each task was committed atomically:

1. **Task 1: Analytics types and date utilities** - `2a2c34d` (feat)
   - Created TypeScript interfaces for WeeklyStats, AllTimeTotals, PeriodStats, StatsMetadata
   - Added UTC-safe date utility functions (getWeekStart, getMonthStart, getYearStart)
   - Added date formatting functions (formatWeekLabel, formatMonthLabel)

2. **Task 2: Statistics computation engine and CLI integration** - `50fc2b6` (feat)
   - Built computeAllStats function with Map-based aggregation
   - Integrated compute-stats command into CLI
   - Generated and verified statistics from 1,808 real activities
   - Created 5 static JSON files in data/stats/

## Files Created/Modified

- `src/types/analytics.types.ts` - TypeScript interfaces for all analytics data structures (WeeklyStats, AllTimeTotals, PeriodStats, StatsMetadata)
- `src/analytics/date-utils.ts` - UTC-safe date utilities for week/month/year boundary calculations with Monday-start weeks
- `src/analytics/compute-stats.ts` - Statistics computation engine that reads activities, groups by periods, computes aggregations, writes JSON files
- `src/index.ts` - Added computeStatsCommand function and 'compute-stats' case to switch statement
- `package.json` - Added "compute-stats": "node dist/index.js compute-stats" npm script

## Decisions Made

**1. Monday-start weeks using UTC calculations**
- Used ISO 8601 standard (weeks start Monday) for international consistency
- All date utilities use UTC methods exclusively (getUTCDay, getUTCMonth, etc) to eliminate timezone-dependent bugs
- Monday offset calculation: `dayOfWeek === 0 ? -6 : 1 - dayOfWeek` handles Sunday edge case correctly

**2. Correct average pace computation**
- Implemented total_time/total_distance method (not averaging individual paces) per research findings
- Prevents statistical bias from weighting short and long runs equally
- Formula: `(total_moving_time_sec / 60) / (total_distance_meters / 1000)` gives minutes per kilometer

**3. Generated stats as static JSON files**
- Output files written to data/stats/ (excluded from git via .gitignore)
- Users regenerate stats by running `npm run compute-stats` after syncing activities
- Enables fast widget loading (pre-computed data) without runtime computation

**4. Map-based aggregation pattern**
- Used `Map<string, AccumulatorObject>` for grouping by period (week/month/year)
- Key = ISO date string of period start, Value = accumulator with totals
- Sorted final arrays by period start for consistent chronological ordering

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed successfully without errors.

## User Setup Required

None - no external service configuration required.

Users only need to run `npm run compute-stats` after syncing activities to generate statistics.

## Next Phase Readiness

**Ready for Plan 02 (Embeddable Widget):**
- All 5 static JSON files generated and verified
- Weekly distance data available for bar chart visualization
- All-time totals available for stats display
- Data format matches plan specifications

**Statistics Generated:**
- 465 weeks of data (2011-2026)
- 118 months of data
- 14 years of data
- All-time totals: 1,808 runs, 21,774 km, 5.7 min/km average pace

**No blockers or concerns.**

## Self-Check: PASSED

All claims verified:
- ✓ All created files exist (src/types/analytics.types.ts, src/analytics/date-utils.ts, src/analytics/compute-stats.ts)
- ✓ All modified files exist (src/index.ts, package.json)
- ✓ All commits exist (2a2c34d, 50fc2b6)
- ✓ All generated stats files exist (weekly-distance.json, all-time-totals.json, monthly-stats.json, yearly-stats.json, metadata.json)

---
*Phase: 02-core-analytics-first-widget*
*Completed: 2026-02-14*
