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

describe('buildMonthGrid — weekday offset and week-row shape', () => {
  it('every week row has exactly 7 entries for all five fixture months', () => {
    const fixtures: Array<{ year: number; month: number }> = [
      { year: 2024, month: 3 }, // March 2024 — starts Friday
      { year: 2024, month: 9 }, // September 2024 — starts Sunday
      { year: 2024, month: 2 }, // February 2024 — leap
      { year: 2023, month: 2 }, // February 2023 — non-leap
      { year: 2024, month: 6 }, // June 2024 — starts Saturday, 30 days
    ];

    for (const month of fixtures) {
      const grid = buildMonthGrid([], month);
      expect(grid.weeks.every((w) => w.length === 7)).toBe(true);
    }
  });

  it('March 2024 (starts Friday) produces 5 leading null cells (Sun-Thu) in week 0', () => {
    const grid = buildMonthGrid([], { year: 2024, month: 3 });
    expect(grid.weeks[0].slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(grid.weeks[0][5]?.dayOfMonth).toBe(1);
  });

  it('September 2024 (September 1 is a Sunday) produces zero leading null padding', () => {
    const grid = buildMonthGrid([], { year: 2024, month: 9 });
    expect(grid.weeks[0][0]?.dayOfMonth).toBe(1);
    expect(grid.weeks[0].some((cell) => cell === null)).toBe(false);
  });

  it('February 2024 (leap year) produces 29 non-null day cells', () => {
    const grid = buildMonthGrid([], { year: 2024, month: 2 });
    const nonNull = grid.weeks.flat().filter((cell) => cell !== null);
    expect(nonNull).toHaveLength(29);
  });

  it('February 2023 (non-leap) produces 28 non-null day cells', () => {
    const grid = buildMonthGrid([], { year: 2023, month: 2 });
    const nonNull = grid.weeks.flat().filter((cell) => cell !== null);
    expect(nonNull).toHaveLength(28);
  });

  it('June 2024 (starts Saturday, 30 days) spans 6 week rows; every row still has 7 entries', () => {
    const grid = buildMonthGrid([], { year: 2024, month: 6 });
    expect(grid.weeks).toHaveLength(6);
    expect(grid.weeks.every((w) => w.length === 7)).toBe(true);
  });

  it('padding cells are null, never a DayCell with a zero distance', () => {
    const grid = buildMonthGrid([], { year: 2024, month: 3 });
    for (const cell of grid.weeks[0].slice(0, 5)) {
      expect(cell).toBeNull();
    }
  });
});

describe('buildMonthGrid — per-day aggregation', () => {
  it('a day with two runs produces one DayCell with runCount 2, summed distance, and newest-first activityIds', () => {
    const rows = [
      fixtureRow({ id: 'newer', startDateLocal: '2024-03-10T18:00:00Z', distanceM: 3000 }),
      fixtureRow({ id: 'older', startDateLocal: '2024-03-10T07:00:00Z', distanceM: 4000 }),
    ];
    const grid = buildMonthGrid(rows, { year: 2024, month: 3 });
    const cell = grid.weeks.flat().find((c) => c?.dateKey === '2024-03-10');
    expect(cell).toBeDefined();
    expect(cell?.runCount).toBe(2);
    expect(cell?.totalDistanceM).toBe(7000);
    expect(cell?.activityIds).toEqual(['newer', 'older']);
  });

  it('a day with no runs produces a rest-day DayCell', () => {
    const grid = buildMonthGrid([], { year: 2024, month: 3 });
    const cell = grid.weeks.flat().find((c) => c?.dayOfMonth === 15);
    expect(cell).toEqual({
      dateKey: '2024-03-15',
      dayOfMonth: 15,
      totalDistanceM: 0,
      runCount: 0,
      activityIds: [],
      tintStep: 0,
    });
  });

  it('monthTotalM sums in-month day cells and runCount counts in-month activities', () => {
    const rows = [
      fixtureRow({ id: 'a', startDateLocal: '2024-03-05T09:00:00Z', distanceM: 5000 }),
      fixtureRow({ id: 'b', startDateLocal: '2024-03-20T09:00:00Z', distanceM: 10000 }),
    ];
    const grid = buildMonthGrid(rows, { year: 2024, month: 3 });
    expect(grid.monthTotalM).toBe(15000);
    expect(grid.runCount).toBe(2);
  });

  it('a month with zero matching rows returns a full grid of rest-day cells, no throw', () => {
    const rows = [fixtureRow({ id: 'other-month', startDateLocal: '2024-04-05T09:00:00Z' })];
    const grid = buildMonthGrid(rows, { year: 2024, month: 3 });
    expect(grid.monthTotalM).toBe(0);
    expect(grid.runCount).toBe(0);
    const nonNull = grid.weeks.flat().filter((cell) => cell !== null);
    expect(nonNull).toHaveLength(31);
    expect(nonNull.every((cell) => cell?.runCount === 0)).toBe(true);
  });

  it('rows with an unparseable startDateLocal are skipped, not counted, and do not throw', () => {
    const rows = [
      fixtureRow({ id: 'bad', startDateLocal: 'not-a-date' }),
      fixtureRow({ id: 'good', startDateLocal: '2024-03-05T09:00:00Z', distanceM: 2000 }),
    ];
    expect(() => buildMonthGrid(rows, { year: 2024, month: 3 })).not.toThrow();
    const grid = buildMonthGrid(rows, { year: 2024, month: 3 });
    expect(grid.runCount).toBe(1);
    expect(grid.monthTotalM).toBe(2000);
  });
});
