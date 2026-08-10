---
phase: 03-advanced-analytics-widget-library
plan: 02
subsystem: analytics-computation
tags: [advanced-stats, year-over-year, time-of-day, seasonal-trends, cli]

dependency_graph:
  requires:
    - 02-01-compute-stats # Weekly/monthly/yearly base stats
  provides:
    - advanced-stats-computation # Year-over-year, time-of-day, seasonal trends
    - compute-advanced-stats-cli # CLI command for advanced stats
  affects:
    - 03-03 # Time-of-day widget (consumes time-of-day.json)
    - 03-04 # Year-over-year widget (consumes year-over-year.json)

tech_stack:
  added: []
  patterns:
    - UTC-based date grouping (year + month)
    - Time-of-day bucketing (6-hour windows)
    - 3-year historical window
    - Pre-filled monthly data (all 12 months with zeros)

key_files:
  created:
    - src/analytics/compute-advanced-stats.ts # Advanced stats computation engine
    - data/stats/year-over-year.json # 12 months × 3 years comparison data
    - data/stats/time-of-day.json # 4 time buckets with percentages
    - data/stats/seasonal-trends.json # Monthly volume across years
    - data/stats/streaks.json # Placeholder for future streak integration
  modified:
    - src/types/analytics.types.ts # Added YearOverYearMonth, TimeOfDayPattern, SeasonalTrendMonth, StreakData
    - src/index.ts # Added compute-advanced-stats, compute-all-stats CLI commands
    - package.json # Added npm scripts for advanced stats

decisions:
  - decision: "Pre-fill all 12 months with zeros for each year"
    rationale: "Prevents Chart.js axis misalignment when months have no data"
    alternatives: "Sparse data with client-side filling"
  - decision: "Show 3 most recent years in year-over-year data"
    rationale: "Balances historical context with readability"
    alternatives: "All years (too cluttered), configurable limit (overkill for v1)"
  - decision: "Use UTC hours for time-of-day bucketing (not local time)"
    rationale: "Consistent with all other date utilities, avoids timezone complexity"
    alternatives: "Local time conversion (adds timezone dependency)"
  - decision: "4 time buckets: Morning 6-12, Afternoon 12-18, Evening 18-22, Night 22-6"
    rationale: "Natural activity pattern windows, radar chart friendly (4 axes)"
    alternatives: "Hourly breakdown (too granular), 6 buckets (odd radar chart)"
  - decision: "Write placeholder streaks.json now"
    rationale: "Establishes file structure for Plan 03+, prevents missing file errors"
    alternatives: "Wait for streak-utils integration (breaks compute-all-stats)"

metrics:
  duration_minutes: 3
  tasks_completed: 2
  files_created: 5
  files_modified: 3
  commits: 2
  completed_date: 2026-02-14
---

# Phase 03 Plan 02: Advanced Statistics Computation Summary

**One-liner:** Year-over-year, time-of-day, and seasonal trend JSON generation with combined CLI command (compute-all-stats)

## What Was Built

Implemented advanced statistics computation engine that processes 1,808 run activities and generates 3 new JSON files for widget consumption:

1. **Year-over-year comparison data** (year-over-year.json):
   - 12 months with per-year breakdowns (totalKm, totalRuns, totalHours)
   - 3 most recent years with data (2024, 2025, 2026)
   - All 12 months pre-filled with zeros to prevent Chart.js misalignment
   - Ready for comparison bar/line charts

2. **Time-of-day pattern data** (time-of-day.json):
   - 4 buckets: Morning (6am-12pm), Afternoon (12pm-6pm), Evening (6pm-10pm), Night (10pm-6am)
   - UTC hour-based bucketing (consistent with all date utilities)
   - Percentages sum to exactly 100%
   - Ready for radar/polar charts

3. **Seasonal trends data** (seasonal-trends.json):
   - Monthly volume (km, runs, hours) grouped by year and month
   - 26 entries across 3 most recent years
   - Ready for multi-year line charts

4. **CLI integration**:
   - `compute-advanced-stats` command (generates 3 advanced stats files)
   - `compute-all-stats` command (generates all 8+ stats files in one run)
   - Updated help text and npm scripts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed missing .js extension in streak-utils test import**
- **Found during:** Task 2 build step
- **Issue:** TypeScript ES module resolution error - relative import missing .js extension
- **Fix:** Changed `from './streak-utils'` to `from './streak-utils.js'` in streak-utils.test.ts
- **Files modified:** src/analytics/streak-utils.test.ts
- **Commit:** (included in plan commits)

No other deviations. Plan executed exactly as written.

## Verification Results

All success criteria met:

- ✅ TypeScript compiles without errors (`npx tsc --noEmit`)
- ✅ year-over-year.json contains 12 entries (all months 1-12)
- ✅ Each month has `years` object with 3 year keys (2024, 2025, 2026)
- ✅ time-of-day.json contains 4 entries
- ✅ Time-of-day percentages sum to exactly 100%
- ✅ seasonal-trends.json contains 26 monthly entries
- ✅ All date operations use UTC methods (no local time)
- ✅ CLI commands work: `npm run compute-advanced-stats` and `npm run compute-all-stats`

**Sample output:**
```
Generated advanced statistics:
- Year-over-year: 12 months across 3 years
- Time-of-day: 4 buckets
- Seasonal trends: 26 month entries
- Streaks: placeholder (will be computed in Plan 03+)
```

## Integration Points

**Consumed by future plans:**
- Plan 03-03 (Time-of-day widget) will visualize time-of-day.json as radar chart
- Plan 03-04 (Year-over-year widget) will visualize year-over-year.json as comparison chart

**Requires from previous plans:**
- Plan 02-01: compute-stats.ts pattern (same directory structure, same CLI integration style)
- Phase 01: Activity data in data/activities/

## Implementation Notes

**Why pre-fill all 12 months with zeros?**
Chart.js requires consistent axis labels across datasets. If January 2024 has data but January 2025 doesn't, sparse data causes axis misalignment. Pre-filling ensures all years show all 12 months, even if zero.

**Why UTC hours instead of local time?**
- Consistent with date-utils.ts (all functions use UTC)
- Avoids timezone complexity (user activities from different timezones)
- Simpler implementation (no TZ library needed)
- Local time conversion can be done client-side if needed

**Why 4 time buckets?**
- Natural activity patterns (morning/afternoon/evening/night)
- Works well with radar charts (4 axes)
- Percentages easier to interpret than 24 hourly buckets

**Why 3 most recent years?**
- Balances historical context with readability
- Most users care about recent trends
- Chart.js performance better with fewer datasets
- Easy to change limit if needed

## Self-Check

**Created files:**
```bash
✓ FOUND: src/analytics/compute-advanced-stats.ts
✓ FOUND: data/stats/year-over-year.json
✓ FOUND: data/stats/time-of-day.json
✓ FOUND: data/stats/seasonal-trends.json
✓ FOUND: data/stats/streaks.json
```

**Commits:**
```bash
✓ FOUND: 3b2d000 (Task 1: advanced analytics types and computation)
✓ FOUND: d7dea6d (Task 2: CLI integration)
```

**Modified files:**
```bash
✓ VERIFIED: src/types/analytics.types.ts (4 new interfaces)
✓ VERIFIED: src/index.ts (2 new CLI commands)
✓ VERIFIED: package.json (2 new npm scripts)
```

## Self-Check: PASSED
