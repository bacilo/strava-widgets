---
phase: 03-advanced-analytics-widget-library
plan: 01
subsystem: analytics
tags: [tdd, streak-calculation, testing, date-handling]

dependency-graph:
  requires:
    - src/analytics/date-utils.ts (getWeekStart for ISO week grouping)
  provides:
    - calculateDailyStreaks (consecutive day streak detection)
    - calculateWeeklyConsistency (weekly threshold-based streak tracking)
  affects:
    - Future advanced stats computation (03-02+)

tech-stack:
  added:
    - vitest (v4.0.18) - test framework
    - vitest.config.ts - TypeScript test configuration
  patterns:
    - TDD (RED-GREEN-REFACTOR cycle)
    - UTC-only date operations for timezone safety
    - Set-based deduplication for same-day activities
    - ISO 8601 week grouping (Monday start)

key-files:
  created:
    - src/analytics/streak-utils.ts (217 lines)
    - src/analytics/streak-utils.test.ts (236 lines)
    - vitest.config.ts (7 lines)
  modified:
    - package.json (added test scripts and vitest dependency)
    - package-lock.json (vitest installation)

decisions:
  - Use vitest for testing framework (lightweight, TypeScript native, fast)
  - TDD approach for streak logic (complex edge cases benefit from test-first)
  - MS_PER_DAY constant for millisecond calculations (86400000 → clarity)
  - withinCurrentStreak true only if last activity was today or yesterday UTC
  - Weekly consistency uses ISO weeks (Monday start) via existing date-utils.ts
  - Same-day activities deduplicated (multiple runs on one day = one streak day)

metrics:
  duration: 209 seconds
  completed: 2026-02-14T10:41:30Z
  commits: 3
  tests: 18 passing
  files_created: 3
  lines_added: 460+

issues: []
blockers: []
---

# Phase 03 Plan 01: Streak Calculation Algorithms Summary

TDD implementation of daily running streaks and weekly consistency streaks with comprehensive edge case coverage.

## What Was Built

Implemented two core streak calculation functions using test-driven development:

1. **calculateDailyStreaks** - Detects consecutive day running streaks
   - Normalizes all dates to UTC midnight
   - Deduplicates same-day activities
   - Tracks current streak, longest streak, and streak date ranges
   - Determines `withinCurrentStreak` (true only if last activity was today or yesterday)

2. **calculateWeeklyConsistency** - Tracks weeks meeting a run threshold
   - Groups activities by ISO week (Monday start)
   - Configurable threshold (default 3 runs/week)
   - Tracks consecutive consistent weeks and overall totals

## TDD Execution

### RED Phase (commit 616f09c)
- Installed vitest test framework
- Created 18 comprehensive test cases covering edge cases:
  - Empty input, single dates, consecutive days, gaps, month boundaries
  - Same-day deduplication, multiple streaks, weekly thresholds
- All tests failing as expected (stub implementation)

### GREEN Phase (commit 80dbb82)
- Implemented full streak calculation logic
- All 18 tests passing
- UTC methods exclusively (no local timezone operations)
- Key algorithms:
  - Date normalization → deduplication → sorting → consecutive day detection
  - ISO week grouping → threshold checking → consecutive week tracking

### REFACTOR Phase (commit 443548a)
- Extracted `MS_PER_DAY` constant (86400000) for clarity
- Simplified redundant conditional logic in weekly consistency
- All tests still passing

## Edge Cases Handled

**Daily Streaks:**
- Empty array → all zeros
- Same-day duplicates → deduplicated before streak counting
- Month boundary crossings (Jan 31 → Feb 1) → correctly consecutive
- Current streak resets to 0 if last run > 1 day ago
- Tracks both current and longest streak with date ranges

**Weekly Consistency:**
- Configurable threshold (default 3, supports 1+ for any run counts)
- Non-consecutive weeks handled (gap weeks don't contribute to streak)
- Current streak = last consecutive run of threshold-meeting weeks
- Total consistent weeks vs. total weeks tracked separately

## Verification

All plan verification criteria met:

- [x] All test cases pass: `npm test` → 18/18 passing
- [x] No local timezone methods used: `grep` verification shows only UTC methods
- [x] calculateDailyStreaks handles all edge cases per spec
- [x] calculateWeeklyConsistency handles threshold variations and gaps
- [x] withinCurrentStreak is true only if last activity was today or yesterday UTC
- [x] All date operations use UTC methods exclusively

## Test Coverage

```typescript
// Sample test case (month boundary crossing)
const jan30 = new Date('2024-01-30T10:00:00Z');
const jan31 = new Date('2024-01-31T10:00:00Z');
const feb1 = new Date('2024-02-01T10:00:00Z');
const result = calculateDailyStreaks([jan30, jan31, feb1]);
expect(result.longestStreak).toBe(3); // ✓ Passes
```

All edge cases have explicit test coverage:
- 11 daily streak tests (empty, single date, consecutive, gaps, dedup, boundaries)
- 7 weekly consistency tests (thresholds, gaps, non-consecutive weeks)

## Deviations from Plan

None - plan executed exactly as written. TDD cycle (RED-GREEN-REFACTOR) followed precisely.

## Key Technical Decisions

**UTC Date Handling:**
- All dates normalized to UTC midnight before comparison
- Prevents timezone-related bugs (DST, user location differences)
- Uses existing `getWeekStart` from date-utils.ts for consistency

**Deduplication Strategy:**
- Convert dates to `YYYY-MM-DD` strings → Set → unique days
- Multiple runs on same day count as single streak day
- Matches typical streak definition (running every day, not multiple times/day)

**Current Streak Definition:**
- Active if last run was today or yesterday UTC
- "Yesterday counts" aligns with common streak UX (rest day allowed)
- Clear true/false flag for widget display

**Test Framework Choice:**
- Vitest over Jest: faster, native TypeScript, Vite ecosystem integration
- Minimal config (7-line vitest.config.ts)
- Inline with project's existing Vite usage (widget building)

## Integration Points

**Inputs:**
- Array of Date objects (from synced Strava activities)
- Optional threshold for weekly consistency (default 3)

**Outputs:**
- StreakResult interface (current/longest streaks + date ranges)
- WeeklyConsistencyResult interface (consistency streaks + totals)

**Dependencies:**
- date-utils.ts: `getWeekStart()` for ISO week grouping
- No external libraries (pure TypeScript + standard Date API)

## Next Steps (Plan 03-02)

These functions are now ready for integration into:
- Advanced stats computation pipeline (03-02)
- Widget rendering (later plans)
- JSON data exports for embeddable widgets

The streak algorithms provide the foundation for gamification features (badges, progress tracking, consistency insights).

## Self-Check: PASSED

**Created files verified:**
- [FOUND] src/analytics/streak-utils.ts
- [FOUND] src/analytics/streak-utils.test.ts
- [FOUND] vitest.config.ts

**Commits verified:**
- [FOUND] 616f09c - test(03-01): add failing test for streak calculation
- [FOUND] 80dbb82 - feat(03-01): implement streak calculation algorithms
- [FOUND] 443548a - refactor(03-01): clean up streak calculation code

**Test execution:**
- [PASSED] npm test → 18/18 tests passing
- [PASSED] No local timezone methods (grep verification clean)

All deliverables present and functional.
