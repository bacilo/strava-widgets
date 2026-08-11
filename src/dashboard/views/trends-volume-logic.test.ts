import { describe, expect, it } from 'vitest';

import type { DashboardIndexRow } from '../../analytics/dashboard-index.types.js';
import {
  buildVolumeSeries,
  buildYearGrid,
  listActivityYears,
  yearGridSummary,
} from './trends-volume-logic.js';

/** Minimal fixture row builder — only the fields buildYearGrid/listActivityYears read matter. */
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

const weeklyFixture = [
  { weekStartISO: '2026-01-05T00:00:00.000Z', totalKm: 10.5, runCount: 2, avgPaceMinPerKm: 5.5, elevationGain: 20, totalMovingTimeMin: 60 },
  { weekStartISO: '2026-01-12T00:00:00.000Z', totalKm: 20.2, runCount: 3, avgPaceMinPerKm: 5.4, elevationGain: 30, totalMovingTimeMin: 90 },
];

const monthlyFixture = [
  { periodStart: '2026-01-01T00:00:00.000Z', periodLabel: 'Jan 2026', totalKm: 100.1, runCount: 8, avgPaceMinPerKm: 5.5, elevationGain: 100, totalMovingTimeMin: 400 },
  { periodStart: '2026-02-01T00:00:00.000Z', periodLabel: 'Feb 2026', totalKm: 90.3, runCount: 7, avgPaceMinPerKm: 5.6, elevationGain: 90, totalMovingTimeMin: 380 },
];

const yearlyFixture = [
  { periodStart: '2025-01-01T00:00:00.000Z', periodLabel: '2025', totalKm: 1200.0, runCount: 100, avgPaceMinPerKm: 5.5, elevationGain: 1000, totalMovingTimeMin: 5000 },
  { periodStart: '2026-01-01T00:00:00.000Z', periodLabel: '2026', totalKm: 800.0, runCount: 70, avgPaceMinPerKm: 5.6, elevationGain: 700, totalMovingTimeMin: 3500 },
];

describe('buildVolumeSeries — live field shapes', () => {
  it('weekly reads weekStartISO', () => {
    const series = buildVolumeSeries(weeklyFixture, null, null, 'weekly');
    expect(series).toHaveLength(2);
    expect(series[0].km).toBe(10.5);
    expect(series[0].x).toBe(Date.parse('2026-01-05T00:00:00.000Z'));
  });

  it('monthly reads periodStart (not weekStartISO)', () => {
    const series = buildVolumeSeries(null, monthlyFixture, null, 'monthly');
    expect(series).toHaveLength(2);
    expect(series[0].km).toBe(100.1);
    expect(series[0].label).toBe('Jan 2026');
  });

  it('yearly reads periodStart (not weekStartISO)', () => {
    const series = buildVolumeSeries(null, null, yearlyFixture, 'yearly');
    expect(series).toHaveLength(2);
    expect(series[0].km).toBe(1200.0);
    expect(series[0].label).toBe('2025');
  });
});

describe('buildVolumeSeries — null/malformed inputs return [] without throwing', () => {
  it('null weekly returns []', () => {
    expect(() => buildVolumeSeries(null, monthlyFixture, yearlyFixture, 'weekly')).not.toThrow();
    expect(buildVolumeSeries(null, monthlyFixture, yearlyFixture, 'weekly')).toEqual([]);
  });

  it('{} monthly returns []', () => {
    expect(buildVolumeSeries(weeklyFixture, {}, yearlyFixture, 'monthly')).toEqual([]);
  });

  it('{} yearly returns []', () => {
    expect(buildVolumeSeries(weeklyFixture, monthlyFixture, {}, 'yearly')).toEqual([]);
  });

  it('null yearly returns []', () => {
    expect(buildVolumeSeries(weeklyFixture, monthlyFixture, null, 'yearly')).toEqual([]);
  });
});

describe('buildVolumeSeries — sorted ascending even when shuffled', () => {
  it('weekly output is ascending by x', () => {
    const shuffled = [weeklyFixture[1], weeklyFixture[0]];
    const series = buildVolumeSeries(shuffled, null, null, 'weekly');
    expect(series[0].x).toBeLessThan(series[1].x);
  });
});

describe('buildYearGrid', () => {
  it('emits exactly 366 cells for 2024 (leap year)', () => {
    const grid = buildYearGrid([], 2024);
    expect(grid).toHaveLength(366);
  });

  it('emits exactly 365 cells for 2023', () => {
    const grid = buildYearGrid([], 2023);
    expect(grid).toHaveLength(365);
  });

  it('2024-01-01 (a Monday) lands at dow === 1', () => {
    const grid = buildYearGrid([], 2024);
    const jan1 = grid.find((c) => c.dateISO === '2024-01-01');
    expect(jan1?.dow).toBe(1);
  });

  it('the first Sunday of 2024 (2024-01-07) is at dow === 0 and week === 1', () => {
    const grid = buildYearGrid([], 2024);
    const jan7 = grid.find((c) => c.dateISO === '2024-01-07');
    expect(jan7?.dow).toBe(0);
    expect(jan7?.week).toBe(1);
  });

  it("the last cell's week is <= 52 for every year 2020-2026", () => {
    for (const year of [2020, 2021, 2022, 2023, 2024, 2025, 2026]) {
      const grid = buildYearGrid([], year);
      const maxWeek = Math.max(...grid.map((c) => c.week));
      expect(maxWeek).toBeLessThanOrEqual(52);
    }
  });

  it('no two cells share the same (week, dow) pair across the whole year', () => {
    const grid = buildYearGrid([], 2024);
    const seen = new Set<string>();
    for (const cell of grid) {
      const key = `${cell.week}-${cell.dow}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('a day with no activity has km === 0, runs === 0, tint === 0', () => {
    const grid = buildYearGrid([], 2024);
    const anyDay = grid[100];
    expect(anyDay.km).toBe(0);
    expect(anyDay.runs).toBe(0);
    expect(anyDay.tint).toBe(0);
  });

  it('a day with a long run has tint > 0', () => {
    const rows = [fixtureRow({ id: '1', startDateLocal: '2024-06-15T08:00:00', distanceM: 12_000 })];
    const grid = buildYearGrid(rows, 2024);
    const day = grid.find((c) => c.dateISO === '2024-06-15');
    expect(day?.km).toBe(12);
    expect(day?.runs).toBe(1);
    expect(day?.tint).toBeGreaterThan(0);
  });
});

describe('listActivityYears', () => {
  it('returns distinct years descending', () => {
    const rows = [
      fixtureRow({ id: '1', startDateLocal: '2024-06-15T08:00:00' }),
      fixtureRow({ id: '2', startDateLocal: '2026-01-01T08:00:00' }),
      fixtureRow({ id: '3', startDateLocal: '2024-03-01T08:00:00' }),
    ];
    expect(listActivityYears(rows)).toEqual([2026, 2024]);
  });

  it('ignores rows with an unparseable date', () => {
    const rows = [
      fixtureRow({ id: '1', startDateLocal: 'garbage' }),
      fixtureRow({ id: '2', startDateLocal: '2025-05-01T08:00:00' }),
    ];
    expect(listActivityYears(rows)).toEqual([2025]);
  });
});

describe('yearGridSummary', () => {
  it('counts only days with runs > 0 as active and sums km across the year', () => {
    const rows = [
      fixtureRow({ id: '1', startDateLocal: '2024-01-05T08:00:00', distanceM: 10_000 }),
      fixtureRow({ id: '2', startDateLocal: '2024-06-15T08:00:00', distanceM: 5_000 }),
    ];
    const grid = buildYearGrid(rows, 2024);
    const summary = yearGridSummary(grid);
    expect(summary.activeDays).toBe(2);
    expect(summary.totalKm).toBe(15);
    expect(summary.year).toBe(2024);
  });
});
