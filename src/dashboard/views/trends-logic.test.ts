import { describe, expect, it } from 'vitest';

import type { DashboardIndexRow } from '../../analytics/dashboard-index.types.js';
import {
  computeRollingTotals,
  DEFAULT_TREND_TAB,
  parseTrendTab,
  serializeTrendQuery,
  TREND_TAB_KEYS,
} from './trends-logic.js';

/** Minimal fixture row builder — only the fields computeRollingTotals reads matter. */
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

describe('parseTrendTab — valid values round-trip', () => {
  for (const key of TREND_TAB_KEYS) {
    it(`parseTrendTab('${key}') returns '${key}'`, () => {
      expect(parseTrendTab(key)).toBe(key);
    });
  }
});

describe('parseTrendTab — hostile input falls back to volume, never throws', () => {
  const hostileValues = [null, '', 'Volume', '__proto__', 'constructor', 'volume;drop', 'x'.repeat(500)];

  for (const bad of hostileValues) {
    it(`parseTrendTab(${JSON.stringify(bad)}) falls back to 'volume'`, () => {
      expect(() => parseTrendTab(bad)).not.toThrow();
      expect(parseTrendTab(bad)).toBe('volume');
    });
  }

  it('DEFAULT_TREND_TAB is volume', () => {
    expect(DEFAULT_TREND_TAB).toBe('volume');
  });
});

describe('serializeTrendQuery', () => {
  it("serializeTrendQuery('volume') produces an empty query string", () => {
    expect(serializeTrendQuery('volume').toString()).toBe('');
  });

  it("serializeTrendQuery('gear') produces tab=gear", () => {
    expect(serializeTrendQuery('gear').toString()).toBe('tab=gear');
  });
});

describe('computeRollingTotals', () => {
  // now fixed mid-week: Wednesday 2026-08-12 (week starts Monday 2026-08-10).
  const now = new Date('2026-08-12T12:00:00.000Z');

  it('a run earlier the same week counts in all three windows', () => {
    const rows = [fixtureRow({ id: '1', startDateLocal: '2026-08-11T08:00:00', distanceM: 10000 })];
    const totals = computeRollingTotals(rows, now);
    expect(totals.week).toEqual({ km: 10, runs: 1 });
    expect(totals.month).toEqual({ km: 10, runs: 1 });
    expect(totals.yearToDate).toEqual({ km: 10, runs: 1 });
  });

  it('a run in the previous week counts in month and year only', () => {
    const rows = [fixtureRow({ id: '1', startDateLocal: '2026-08-03T08:00:00', distanceM: 5000 })];
    const totals = computeRollingTotals(rows, now);
    expect(totals.week).toEqual({ km: 0, runs: 0 });
    expect(totals.month).toEqual({ km: 5, runs: 1 });
    expect(totals.yearToDate).toEqual({ km: 5, runs: 1 });
  });

  it('a run in the previous month counts in year only', () => {
    const rows = [fixtureRow({ id: '1', startDateLocal: '2026-07-15T08:00:00', distanceM: 5000 })];
    const totals = computeRollingTotals(rows, now);
    expect(totals.week).toEqual({ km: 0, runs: 0 });
    expect(totals.month).toEqual({ km: 0, runs: 0 });
    expect(totals.yearToDate).toEqual({ km: 5, runs: 1 });
  });

  it('a run in the previous year counts in none', () => {
    const rows = [fixtureRow({ id: '1', startDateLocal: '2025-08-15T08:00:00', distanceM: 5000 })];
    const totals = computeRollingTotals(rows, now);
    expect(totals.week).toEqual({ km: 0, runs: 0 });
    expect(totals.month).toEqual({ km: 0, runs: 0 });
    expect(totals.yearToDate).toEqual({ km: 0, runs: 0 });
  });

  it('a run exactly on the week boundary (Monday 00:00 UTC) is included in the week total', () => {
    const rows = [fixtureRow({ id: '1', startDateLocal: '2026-08-10T00:00:00', distanceM: 5000 })];
    const totals = computeRollingTotals(rows, now);
    expect(totals.week).toEqual({ km: 5, runs: 1 });
  });

  it('the immediately preceding Sunday is not included in the week total', () => {
    const rows = [fixtureRow({ id: '1', startDateLocal: '2026-08-09T23:59:59', distanceM: 5000 })];
    const totals = computeRollingTotals(rows, now);
    expect(totals.week).toEqual({ km: 0, runs: 0 });
    // Still counted in month/year since it's within August 2026.
    expect(totals.month).toEqual({ km: 5, runs: 1 });
  });

  it('rows with an unparseable startDateLocal are skipped without throwing', () => {
    const rows = [
      fixtureRow({ id: '1', startDateLocal: 'not-a-date', distanceM: 5000 }),
      fixtureRow({ id: '2', startDateLocal: '2026-08-11T08:00:00', distanceM: 3000 }),
    ];
    expect(() => computeRollingTotals(rows, now)).not.toThrow();
    const totals = computeRollingTotals(rows, now);
    expect(totals.week).toEqual({ km: 3, runs: 1 });
  });

  it('an empty row array returns zeros for all three windows', () => {
    const totals = computeRollingTotals([], now);
    expect(totals.week).toEqual({ km: 0, runs: 0 });
    expect(totals.month).toEqual({ km: 0, runs: 0 });
    expect(totals.yearToDate).toEqual({ km: 0, runs: 0 });
  });
});
