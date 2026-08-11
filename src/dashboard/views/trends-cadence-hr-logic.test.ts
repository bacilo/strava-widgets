import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

import type { DashboardIndexRow } from '../../analytics/dashboard-index.types.js';
import type { DashboardIndexDocument } from '../../analytics/dashboard-index.types.js';
import { buildMonthlyChannelSeries, channelLabel, MONTHLY_CHANNELS } from './trends-cadence-hr-logic.js';

/**
 * Live dashboard index, read at test time via `node:fs` (relative to CWD) —
 * same convention as `trends-yoy-logic.test.ts`, since `data/dashboard/index.json`
 * is a gitignored, generated artifact and cannot be assumed present at
 * TypeScript compile time.
 */
const liveIndex: DashboardIndexDocument = JSON.parse(
  fs.readFileSync('data/dashboard/index.json', 'utf-8')
);

/** Minimal fixture row builder — only the fields buildMonthlyChannelSeries reads matter here. */
function fixtureRow(
  overrides: Partial<DashboardIndexRow> & { id: string; startDateLocal: string }
): DashboardIndexRow {
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

describe('MONTHLY_CHANNELS', () => {
  it('is [cadence, hr]', () => {
    expect(MONTHLY_CHANNELS).toEqual(['cadence', 'hr']);
  });
});

describe('buildMonthlyChannelSeries — time-weighted mean', () => {
  it('three rows in one month with differing movingTimeSec produce a time-weighted mean, not a plain row mean', () => {
    const rows = [
      fixtureRow({
        id: 'a',
        startDateLocal: '2024-03-01T09:00:00Z',
        movingTimeSec: 600, // 10 min
        avgCadenceRpm: 70,
      }),
      fixtureRow({
        id: 'b',
        startDateLocal: '2024-03-15T09:00:00Z',
        movingTimeSec: 7200, // 2 hours
        avgCadenceRpm: 90,
      }),
      fixtureRow({
        id: 'c',
        startDateLocal: '2024-03-20T09:00:00Z',
        movingTimeSec: 1800, // 30 min
        avgCadenceRpm: 80,
      }),
    ];

    const series = buildMonthlyChannelSeries(rows, 'cadence');
    expect(series).toHaveLength(1);

    const plainMean = (70 + 90 + 80) / 3; // 80
    const weightedMean =
      (70 * 600 + 90 * 7200 + 80 * 1800) / (600 + 7200 + 1800); // ~86.67

    expect(series[0].value).not.toBeCloseTo(plainMean, 1);
    expect(series[0].value).toBeCloseTo(weightedMean, 5);
  });
});

describe('buildMonthlyChannelSeries — null vs zero for an all-absent-channel month', () => {
  it('a month whose every row has avgHr === null yields value: null with runs > 0 and contributing === 0', () => {
    const rows = [
      fixtureRow({ id: 'a', startDateLocal: '2024-03-01T09:00:00Z', avgHr: null }),
      fixtureRow({ id: 'b', startDateLocal: '2024-03-15T09:00:00Z', avgHr: null }),
    ];

    const series = buildMonthlyChannelSeries(rows, 'hr');
    expect(series).toHaveLength(1);
    expect(series[0].value).toBeNull();
    expect(series[0].runs).toBe(2);
    expect(series[0].contributing).toBe(0);
  });
});

describe('buildMonthlyChannelSeries — continuous month spine', () => {
  it('a month with no activity at all, between two active months, appears with value: null and runs: 0', () => {
    const rows = [
      fixtureRow({ id: 'jan', startDateLocal: '2024-01-05T09:00:00Z', avgCadenceRpm: 80 }),
      // February has no rows at all.
      fixtureRow({ id: 'mar', startDateLocal: '2024-03-05T09:00:00Z', avgCadenceRpm: 85 }),
    ];

    const series = buildMonthlyChannelSeries(rows, 'cadence');
    expect(series.map((p) => p.monthKey)).toEqual(['2024-01', '2024-02', '2024-03']);

    const feb = series.find((p) => p.monthKey === '2024-02')!;
    expect(feb.value).toBeNull();
    expect(feb.runs).toBe(0);
    expect(feb.contributing).toBe(0);
  });
});

describe('buildMonthlyChannelSeries — ascending order', () => {
  it('is ascending by x regardless of input row order', () => {
    const rows = [
      fixtureRow({ id: 'c', startDateLocal: '2024-03-05T09:00:00Z', avgCadenceRpm: 80 }),
      fixtureRow({ id: 'a', startDateLocal: '2024-01-05T09:00:00Z', avgCadenceRpm: 75 }),
      fixtureRow({ id: 'b', startDateLocal: '2024-02-05T09:00:00Z', avgCadenceRpm: 78 }),
    ];

    const series = buildMonthlyChannelSeries(rows, 'cadence');
    const xs = series.map((p) => p.x);
    const sorted = [...xs].sort((a, b) => a - b);
    expect(xs).toEqual(sorted);
  });
});

describe('buildMonthlyChannelSeries — Z and non-Z date shapes', () => {
  it('both Z-suffixed and non-Z startDateLocal shapes bucket into the correct month', () => {
    const rows = [
      fixtureRow({ id: 'z', startDateLocal: '2024-05-10T09:00:00Z', avgCadenceRpm: 80 }),
      fixtureRow({ id: 'nz', startDateLocal: '2024-05-20T09:00:00', avgCadenceRpm: 82 }),
    ];

    const series = buildMonthlyChannelSeries(rows, 'cadence');
    expect(series).toHaveLength(1);
    expect(series[0].monthKey).toBe('2024-05');
    expect(series[0].runs).toBe(2);
  });
});

describe('buildMonthlyChannelSeries — unparseable date', () => {
  it('a row with an unparseable startDateLocal is skipped without throwing and creates no bogus month', () => {
    const rows = [
      fixtureRow({ id: 'bad', startDateLocal: 'not-a-date', avgCadenceRpm: 80 }),
      fixtureRow({ id: 'good', startDateLocal: '2024-06-05T09:00:00Z', avgCadenceRpm: 82 }),
    ];

    expect(() => buildMonthlyChannelSeries(rows, 'cadence')).not.toThrow();
    const series = buildMonthlyChannelSeries(rows, 'cadence');
    expect(series).toHaveLength(1);
    expect(series[0].monthKey).toBe('2024-06');
  });
});

describe('buildMonthlyChannelSeries — live dashboard index', () => {
  it('cadence and HR series span the same months, at least one month has value: null for cadence, and no value is NaN/Infinity', () => {
    const cadence = buildMonthlyChannelSeries(liveIndex.activities, 'cadence');
    const hr = buildMonthlyChannelSeries(liveIndex.activities, 'hr');

    expect(cadence.length).toBe(hr.length);
    expect(cadence.map((p) => p.monthKey)).toEqual(hr.map((p) => p.monthKey));

    expect(cadence.some((p) => p.value === null)).toBe(true);

    for (const p of cadence) {
      if (p.value !== null) {
        expect(Number.isFinite(p.value)).toBe(true);
      }
    }
    for (const p of hr) {
      if (p.value !== null) {
        expect(Number.isFinite(p.value)).toBe(true);
      }
    }
  });
});

describe('buildMonthlyChannelSeries — empty input', () => {
  it('returns [] without throwing', () => {
    expect(() => buildMonthlyChannelSeries([], 'cadence')).not.toThrow();
    expect(buildMonthlyChannelSeries([], 'cadence')).toEqual([]);
  });
});

describe('channelLabel', () => {
  it('states the single-leg unit for cadence', () => {
    expect(channelLabel('cadence')).toBe('Average cadence (rpm, single-leg)');
  });

  it('states bpm for hr', () => {
    expect(channelLabel('hr')).toBe('Average heart rate (bpm)');
  });
});
