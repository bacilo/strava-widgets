import { describe, expect, it } from 'vitest';

import type { DashboardIndexRow } from '../../analytics/dashboard-index.types.js';
import {
  activityDayKey,
  buildMonthGrid,
  formatMonthParam,
  monthLabel,
  parseMonthParam,
  shiftMonth,
  tintStepForDistance,
} from './calendar-logic.js';

/** Minimal fixture row builder — only the fields buildMonthGrid reads matter for these tests. */
function fixtureRow(overrides: Partial<DashboardIndexRow> & { id: string; startDateLocal: string }): DashboardIndexRow {
  return {
    startDate: overrides.startDateLocal,
    name: 'Test Run',
    distanceM: 5000,
    movingTimeSec: 1800,
    paceSecPerKm: 360,
    elevationGainM: null,
    avgHr: null,
    maxHr: null,
    avgCadenceRpm: null,
    location: null,
    sportType: 'Run',
    streams: { available: false, hr: false, cadence: false, elevation: false },
    lowConfidence: false,
    excludedFromRecords: false,
    prCount: 0,
    gearName: null,
    ...overrides,
  };
}

describe('parseMonthParam — valid values', () => {
  it('parseMonthParam("2024-03", now) returns { year: 2024, month: 3 }', () => {
    const now = new Date('2026-08-11T00:00:00Z');
    expect(parseMonthParam('2024-03', now)).toEqual({ year: 2024, month: 3 });
  });

  it('parseMonthParam(null, now) falls back to now\'s UTC year/month', () => {
    const now = new Date('2026-08-11T00:00:00Z');
    expect(parseMonthParam(null, now)).toEqual({ year: 2026, month: 8 });
  });
});

describe('parseMonthParam — hostile input falls back to now, never throws', () => {
  const now = new Date('2026-08-11T00:00:00Z');
  const expected = { year: 2026, month: 8 };

  it('parseMonthParam("2024-13", now) falls back (month out of range)', () => {
    expect(parseMonthParam('2024-13', now)).toEqual(expected);
  });

  it('parseMonthParam("2024-00", now) falls back (month out of range)', () => {
    expect(parseMonthParam('2024-00', now)).toEqual(expected);
  });

  it('parseMonthParam("abcd-ef", now) falls back (non-numeric)', () => {
    expect(parseMonthParam('abcd-ef', now)).toEqual(expected);
  });

  it('parseMonthParam("../../etc", now) falls back (traversal-looking value)', () => {
    expect(parseMonthParam('../../etc', now)).toEqual(expected);
  });

  it('parseMonthParam("99999-01", now) falls back (year out of range)', () => {
    expect(parseMonthParam('99999-01', now)).toEqual(expected);
  });

  it('parseMonthParam("", now) falls back (empty string)', () => {
    expect(parseMonthParam('', now)).toEqual(expected);
  });
});

describe('formatMonthParam', () => {
  it('formatMonthParam({ year: 2024, month: 3 }) returns "2024-03" (zero-padded)', () => {
    expect(formatMonthParam({ year: 2024, month: 3 })).toBe('2024-03');
  });

  it('formatMonthParam({ year: 2024, month: 11 }) returns "2024-11" (no extra padding)', () => {
    expect(formatMonthParam({ year: 2024, month: 11 })).toBe('2024-11');
  });
});

describe('shiftMonth — year rollover', () => {
  it('shiftMonth({ year: 2024, month: 12 }, 1) rolls into January of the next year', () => {
    expect(shiftMonth({ year: 2024, month: 12 }, 1)).toEqual({ year: 2025, month: 1 });
  });

  it('shiftMonth({ year: 2024, month: 1 }, -1) rolls back into December of the prior year', () => {
    expect(shiftMonth({ year: 2024, month: 1 }, -1)).toEqual({ year: 2023, month: 12 });
  });

  it('shiftMonth({ year: 2024, month: 6 }, 1) stays within the same year', () => {
    expect(shiftMonth({ year: 2024, month: 6 }, 1)).toEqual({ year: 2024, month: 7 });
  });
});

describe('monthLabel', () => {
  it('monthLabel({ year: 2024, month: 3 }) returns "March 2024"', () => {
    expect(monthLabel({ year: 2024, month: 3 })).toBe('March 2024');
  });

  it('monthLabel({ year: 2026, month: 1 }) returns "January 2026"', () => {
    expect(monthLabel({ year: 2026, month: 1 })).toBe('January 2026');
  });

  it('monthLabel({ year: 2026, month: 12 }) returns "December 2026"', () => {
    expect(monthLabel({ year: 2026, month: 12 })).toBe('December 2026');
  });
});

describe('activityDayKey — Strava-era (Z-suffixed) and intervals.icu-era (no Z) shapes', () => {
  it('activityDayKey("2024-01-15T09:00:00Z") returns "2024-01-15"', () => {
    expect(activityDayKey('2024-01-15T09:00:00Z')).toBe('2024-01-15');
  });

  it('activityDayKey("2026-08-06T07:28:22") (no Z, intervals.icu shape) returns "2026-08-06" — not shifted by the runner\'s UTC offset', () => {
    expect(activityDayKey('2026-08-06T07:28:22')).toBe('2026-08-06');
  });

  it('activityDayKey("2024-01-15T23:59:00Z") stays on its own local day', () => {
    expect(activityDayKey('2024-01-15T23:59:00Z')).toBe('2024-01-15');
  });

  it('activityDayKey("not-a-date") returns null', () => {
    expect(activityDayKey('not-a-date')).toBeNull();
  });

  it('activityDayKey(undefined) returns null', () => {
    expect(activityDayKey(undefined as unknown as string)).toBeNull();
  });
});

describe('tintStepForDistance — explicit metre boundaries', () => {
  it('tintStepForDistance(0) returns 0 (rest day)', () => {
    expect(tintStepForDistance(0)).toBe(0);
  });

  it('tintStepForDistance(4_999) returns 1', () => {
    expect(tintStepForDistance(4_999)).toBe(1);
  });

  it('tintStepForDistance(5_000) returns 2', () => {
    expect(tintStepForDistance(5_000)).toBe(2);
  });

  it('tintStepForDistance(9_999) returns 2', () => {
    expect(tintStepForDistance(9_999)).toBe(2);
  });

  it('tintStepForDistance(10_000) returns 3', () => {
    expect(tintStepForDistance(10_000)).toBe(3);
  });

  it('tintStepForDistance(14_999) returns 3', () => {
    expect(tintStepForDistance(14_999)).toBe(3);
  });

  it('tintStepForDistance(15_000) returns 4', () => {
    expect(tintStepForDistance(15_000)).toBe(4);
  });

  it('tintStepForDistance(60_000) returns 4 (capped, never a fifth step)', () => {
    expect(tintStepForDistance(60_000)).toBe(4);
  });
});

describe('buildMonthGrid — weekday offset and week-row shape (Sunday-start)', () => {
  it('every week row has exactly 7 entries for all five fixture months (Sunday-start)', () => {
    const fixtures: Array<{ year: number; month: number }> = [
      { year: 2024, month: 3 }, // March 2024 — starts Friday
      { year: 2024, month: 9 }, // September 2024 — starts Sunday
      { year: 2024, month: 2 }, // February 2024 — leap
      { year: 2023, month: 2 }, // February 2023 — non-leap
      { year: 2024, month: 6 }, // June 2024 — starts Saturday, 30 days
    ];

    for (const month of fixtures) {
      const grid = buildMonthGrid([], month, 'sunday');
      expect(grid.weeks.every((w) => w.length === 7)).toBe(true);
    }
  });

  it('March 2024 (starts Friday, Sunday-start) produces 5 leading null cells (Sun-Thu) in week 0', () => {
    const grid = buildMonthGrid([], { year: 2024, month: 3 }, 'sunday');
    expect(grid.weeks[0].slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(grid.weeks[0][5]?.dayOfMonth).toBe(1);
  });

  it('September 2024 (September 1 is a Sunday, Sunday-start) produces zero leading null padding', () => {
    const grid = buildMonthGrid([], { year: 2024, month: 9 }, 'sunday');
    expect(grid.weeks[0][0]?.dayOfMonth).toBe(1);
    expect(grid.weeks[0].some((cell) => cell === null)).toBe(false);
  });

  it('February 2024 (leap year, Sunday-start) produces 29 non-null day cells', () => {
    const grid = buildMonthGrid([], { year: 2024, month: 2 }, 'sunday');
    const nonNull = grid.weeks.flat().filter((cell) => cell !== null);
    expect(nonNull).toHaveLength(29);
  });

  it('February 2023 (non-leap, Sunday-start) produces 28 non-null day cells', () => {
    const grid = buildMonthGrid([], { year: 2023, month: 2 }, 'sunday');
    const nonNull = grid.weeks.flat().filter((cell) => cell !== null);
    expect(nonNull).toHaveLength(28);
  });

  it('June 2024 (starts Saturday, 30 days, Sunday-start) spans 6 week rows; every row still has 7 entries', () => {
    const grid = buildMonthGrid([], { year: 2024, month: 6 }, 'sunday');
    expect(grid.weeks).toHaveLength(6);
    expect(grid.weeks.every((w) => w.length === 7)).toBe(true);
  });

  it('padding cells are null, never a DayCell with a zero distance (Sunday-start)', () => {
    const grid = buildMonthGrid([], { year: 2024, month: 3 }, 'sunday');
    for (const cell of grid.weeks[0].slice(0, 5)) {
      expect(cell).toBeNull();
    }
  });
});

describe('buildMonthGrid — per-day aggregation (Sunday-start)', () => {
  it('a day with two runs produces one DayCell with runCount 2, summed distance, and newest-first activityIds (Sunday-start)', () => {
    const rows = [
      fixtureRow({ id: 'newer', startDateLocal: '2024-03-10T18:00:00Z', distanceM: 3000 }),
      fixtureRow({ id: 'older', startDateLocal: '2024-03-10T07:00:00Z', distanceM: 4000 }),
    ];
    const grid = buildMonthGrid(rows, { year: 2024, month: 3 }, 'sunday');
    const cell = grid.weeks.flat().find((c) => c?.dateKey === '2024-03-10');
    expect(cell).toBeDefined();
    expect(cell?.runCount).toBe(2);
    expect(cell?.totalDistanceM).toBe(7000);
    expect(cell?.activityIds).toEqual(['newer', 'older']);
  });

  it('a day with no runs produces a rest-day DayCell (Sunday-start)', () => {
    const grid = buildMonthGrid([], { year: 2024, month: 3 }, 'sunday');
    const cell = grid.weeks.flat().find((c) => c?.dayOfMonth === 15);
    expect(cell).toEqual({
      dateKey: '2024-03-15',
      dayOfMonth: 15,
      totalDistanceM: 0,
      totalTimeSec: 0,
      runCount: 0,
      activityIds: [],
      tintStep: 0,
    });
  });

  it('monthTotalM sums in-month day cells and runCount counts in-month activities (Sunday-start)', () => {
    const rows = [
      fixtureRow({ id: 'a', startDateLocal: '2024-03-05T09:00:00Z', distanceM: 5000 }),
      fixtureRow({ id: 'b', startDateLocal: '2024-03-20T09:00:00Z', distanceM: 10000 }),
    ];
    const grid = buildMonthGrid(rows, { year: 2024, month: 3 }, 'sunday');
    expect(grid.monthTotalM).toBe(15000);
    expect(grid.runCount).toBe(2);
  });

  it('a month with zero matching rows returns a full grid of rest-day cells, no throw (Sunday-start)', () => {
    const rows = [fixtureRow({ id: 'other-month', startDateLocal: '2024-04-05T09:00:00Z' })];
    const grid = buildMonthGrid(rows, { year: 2024, month: 3 }, 'sunday');
    expect(grid.monthTotalM).toBe(0);
    expect(grid.runCount).toBe(0);
    const nonNull = grid.weeks.flat().filter((cell) => cell !== null);
    expect(nonNull).toHaveLength(31);
    expect(nonNull.every((cell) => cell?.runCount === 0)).toBe(true);
  });

  it('rows with an unparseable startDateLocal are skipped, not counted, and do not throw (Sunday-start)', () => {
    const rows = [
      fixtureRow({ id: 'bad', startDateLocal: 'not-a-date' }),
      fixtureRow({ id: 'good', startDateLocal: '2024-03-05T09:00:00Z', distanceM: 2000 }),
    ];
    expect(() => buildMonthGrid(rows, { year: 2024, month: 3 }, 'sunday')).not.toThrow();
    const grid = buildMonthGrid(rows, { year: 2024, month: 3 }, 'sunday');
    expect(grid.runCount).toBe(1);
    expect(grid.monthTotalM).toBe(2000);
  });
});

describe('buildMonthGrid — weekday offset (Monday-start)', () => {
  it('March 2024 (starts Friday, Monday-start) produces 4 leading null cells (Mon-Thu) in week 0', () => {
    const grid = buildMonthGrid([], { year: 2024, month: 3 }, 'monday');
    expect(grid.weeks[0].slice(0, 4)).toEqual([null, null, null, null]);
    expect(grid.weeks[0][4]?.dayOfMonth).toBe(1);
  });

  it('September 2024 (September 1 is a Sunday, Monday-start) produces 6 leading null cells', () => {
    const grid = buildMonthGrid([], { year: 2024, month: 9 }, 'monday');
    expect(grid.weeks[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(grid.weeks[0][6]?.dayOfMonth).toBe(1);
  });

  it('February 2024 (leap year, Monday-start) produces 3 leading null cells', () => {
    const grid = buildMonthGrid([], { year: 2024, month: 2 }, 'monday');
    expect(grid.weeks[0].slice(0, 3)).toEqual([null, null, null]);
    expect(grid.weeks[0][3]?.dayOfMonth).toBe(1);
  });

  it('February 2023 (non-leap, Monday-start) produces 2 leading null cells', () => {
    const grid = buildMonthGrid([], { year: 2023, month: 2 }, 'monday');
    expect(grid.weeks[0].slice(0, 2)).toEqual([null, null]);
    expect(grid.weeks[0][2]?.dayOfMonth).toBe(1);
  });

  it('June 2024 (starts Saturday, Monday-start) produces 5 leading null cells; every row still has 7 entries and at least MIN_WEEK_ROWS week rows', () => {
    const grid = buildMonthGrid([], { year: 2024, month: 6 }, 'monday');
    expect(grid.weeks[0].slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(grid.weeks[0][5]?.dayOfMonth).toBe(1);
    expect(grid.weeks.every((w) => w.length === 7)).toBe(true);
    expect(grid.weeks.length).toBeGreaterThanOrEqual(4);
  });

  it('the same month built with both week starts places day 1 at different grid indices — fails loudly if a default or stale offset sneaks back in', () => {
    const sundayGrid = buildMonthGrid([], { year: 2024, month: 3 }, 'sunday');
    const mondayGrid = buildMonthGrid([], { year: 2024, month: 3 }, 'monday');
    const sundayIndex = sundayGrid.weeks[0].findIndex((cell) => cell?.dayOfMonth === 1);
    const mondayIndex = mondayGrid.weeks[0].findIndex((cell) => cell?.dayOfMonth === 1);
    expect(sundayIndex).not.toBe(mondayIndex);
  });
});

describe('buildMonthGrid — weekTotals derivation', () => {
  it('weekTotals.length always equals weeks.length', () => {
    const grid = buildMonthGrid([], { year: 2024, month: 6 }, 'sunday');
    expect(grid.weekTotals.length).toBe(grid.weeks.length);
  });

  it('a full in-month week sums distance/time/runCount over its non-null cells, daysShown 7, isPartial false', () => {
    // September 2024: Sept 1 is a Sunday, so week 0 under Sunday-start is
    // Sep 1-7, entirely in-month — a full week.
    const rows = [
      fixtureRow({ id: 'sep1', startDateLocal: '2024-09-01T09:00:00Z', distanceM: 5000, movingTimeSec: 1800 }),
      fixtureRow({ id: 'sep3', startDateLocal: '2024-09-03T09:00:00Z', distanceM: 8000, movingTimeSec: 2400 }),
    ];
    const grid = buildMonthGrid(rows, { year: 2024, month: 9 }, 'sunday');
    expect(grid.weekTotals[0]).toEqual({
      totalDistanceM: 13000,
      totalTimeSec: 4200,
      runCount: 2,
      daysShown: 7,
      isPartial: false,
    });
  });

  it('D-13: a boundary week sums ONLY its in-month cells — a fixture run in the previous month, though inside the row\'s true calendar week, is excluded from both the week total and monthTotalM', () => {
    const rows = [
      // Feb 27, 2024 falls inside week 0's true 7-day calendar week (Sun Feb 25 - Sat Mar 2)
      // under a Sunday-start March grid, but it is in February, not March.
      fixtureRow({ id: 'feb-boundary', startDateLocal: '2024-02-27T09:00:00Z', distanceM: 9999 }),
      fixtureRow({ id: 'mar1', startDateLocal: '2024-03-01T09:00:00Z', distanceM: 3000 }),
    ];
    const grid = buildMonthGrid(rows, { year: 2024, month: 3 }, 'sunday');
    expect(grid.weekTotals[0].daysShown).toBe(2); // only Mar 1 (Fri) and Mar 2 (Sat)
    expect(grid.weekTotals[0].isPartial).toBe(true);
    expect(grid.weekTotals[0].totalDistanceM).toBe(3000); // the Feb 27 run is excluded
    expect(grid.monthTotalM).toBe(3000); // and excluded from the month total too
  });

  it('a rest week (no runs, daysShown 7) yields real zero values, not a sentinel, isPartial consistent with daysShown', () => {
    // February 2023: Feb 1 is a Wednesday, Sunday-start padding is 3.
    // Week 1 (Feb 5-11) is entirely in-month — a full rest week.
    const grid = buildMonthGrid([], { year: 2023, month: 2 }, 'sunday');
    expect(grid.weekTotals[1]).toEqual({
      totalDistanceM: 0,
      totalTimeSec: 0,
      runCount: 0,
      daysShown: 7,
      isPartial: false,
    });
  });

  it('multiple runs on one day roll into that day\'s totalTimeSec and into its week\'s totalTimeSec', () => {
    const rows = [
      fixtureRow({ id: 'am', startDateLocal: '2024-09-05T06:00:00Z', movingTimeSec: 1200 }),
      fixtureRow({ id: 'pm', startDateLocal: '2024-09-05T18:00:00Z', movingTimeSec: 2400 }),
    ];
    const grid = buildMonthGrid(rows, { year: 2024, month: 9 }, 'sunday');
    const cell = grid.weeks.flat().find((c) => c?.dateKey === '2024-09-05');
    expect(cell?.totalTimeSec).toBe(3600);
    // Sep 5 falls in week 0 (Sep 1-7 under Sunday-start), the only week with any runs.
    expect(grid.weekTotals[0].totalTimeSec).toBe(3600);
  });

  it('reconciliation: weekTotals distance sum equals monthTotalM and runCount sum equals runCount, for the same month under both week starts', () => {
    const rows = [
      fixtureRow({ id: 'r1', startDateLocal: '2024-03-03T09:00:00Z', distanceM: 4000 }),
      fixtureRow({ id: 'r2', startDateLocal: '2024-03-15T09:00:00Z', distanceM: 6000 }),
      fixtureRow({ id: 'r3', startDateLocal: '2024-03-28T09:00:00Z', distanceM: 8000 }),
    ];
    for (const weekStart of ['sunday', 'monday'] as const) {
      const grid = buildMonthGrid(rows, { year: 2024, month: 3 }, weekStart);
      const distanceSum = grid.weekTotals.reduce((sum, w) => sum + w.totalDistanceM, 0);
      const runCountSum = grid.weekTotals.reduce((sum, w) => sum + w.runCount, 0);
      expect(distanceSum).toBe(grid.monthTotalM);
      expect(runCountSum).toBe(grid.runCount);
    }
  });

  it('a NaN movingTimeSec still produces a finite totalTimeSec — the || 0 coercion keeps buildMonthGrid total', () => {
    const rows = [
      fixtureRow({ id: 'nan-time', startDateLocal: '2024-03-10T09:00:00Z', movingTimeSec: NaN }),
    ];
    const grid = buildMonthGrid(rows, { year: 2024, month: 3 }, 'sunday');
    const cell = grid.weeks.flat().find((c) => c?.dateKey === '2024-03-10');
    expect(cell?.totalTimeSec).toBe(0);
    expect(Number.isFinite(cell?.totalTimeSec)).toBe(true);
    const weekTotal = grid.weekTotals.find((w) => w.runCount > 0);
    expect(weekTotal).toBeDefined();
    expect(Number.isFinite(weekTotal?.totalTimeSec)).toBe(true);
  });
});
