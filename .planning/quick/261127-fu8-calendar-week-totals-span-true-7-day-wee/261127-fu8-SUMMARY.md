---
phase: quick-261127-fu8
plan: 01
status: complete
tags: [calendar, week-totals, a11y]
key-files:
  modified:
    - src/dashboard/views/calendar-logic.ts
    - src/dashboard/views/calendar-logic.test.ts
    - src/dashboard/views/calendar.ts
    - src/dashboard/views/calendar.test.ts
decisions:
  - "Phase 17 D-13 SUPERSEDED: week totals sum the row's true 7 calendar dates"
  - "Phase 17 D-14 REVISED: daysShown/isPartial dropped; startDateKey..endDateKey is the disclosure"
---

# Quick 261127-fu8: Calendar week totals span the true 7-day week

Week-total column now sums all 7 real dates of each row, including out-of-month dates, following the injected weekStart. DayCells, monthTotalM and grid runCount stay in-month only; the DOM is unchanged.

## Commits
- Task 1 (logic + tests): see `git log` (feat(quick-261127-fu8): calendar week totals span the true 7-day week)
- Task 2 (view + tests): feat(quick-261127-fu8): week-total accessible name states the true week range

## What changed
- `WeekTotal` is now { totalDistanceM, totalTimeSec, runCount, startDateKey, endDateKey }.
- `buildMonthGrid` keeps the in-month `byDay` map for cells/month totals and adds an unfiltered `allByDay` map; a private `slotDateKey` (Date.UTC + getUTC*) gives each slot's date. `utcDateKey` extracted and shared with `activityDayKey` (behaviour unchanged).
- `weekTotalAccessibleName(total)` builds the range from the keys: `October 13–19, 2025`, `September 29 – October 5, 2025`, `December 28, 2025 – January 3, 2026`. "Partial week" prefix and "Empty week" branch removed.
- Phase 17 D-13 is superseded and D-14 revised by this quick task.

## Verification
- Probe (old HEAD calendar-logic.ts + new test file in a mkdtemp dir under the scratchpad, node_modules symlinked): 5 failed, 55 passed (60). Leading-week failed on value (expected 3000 to be 12999), sunday weekStart on value (expected 3000 to be 10000), trailing-week on toEqual (totalDistanceM 4000 vs 10000), plus the two toEqual shape tests (missing startDateKey/endDateKey). The monday-branch weekStart assertions are in the same test as the sunday ones and sit after the failing sunday assertion, so were not reached on old code; they pass on new code (all their runs are in-month, so old code would also satisfy them).
- No `-t` filtered runs were used.
- `calendar-logic.test.ts` on new code: 60 passed (60).
- `npm run test:logic`: 125 files, 4442 tests passed.
- `npx tsc --noEmit`: clean.
- Remaining grep hits for "Partial week" are an explanatory JSDoc line and the negative assertion `not.toContain('Partial week')`; no `daysShown` references remain in the view/logic files besides none.
- No changes under data/ or dist/.

## Deviations from Plan
None. (The grep done-criterion for logic.ts initially matched my own JSDoc wording; reworded.)

## Known Stubs
None.

## Self-Check: PASSED
