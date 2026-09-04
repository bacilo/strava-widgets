import { describe, expect, it } from 'vitest';

import type { DashboardIndexRow } from './dashboard-index.types.js';
import { buildGearAggregate, buildGearCoverage } from './gear-aggregate-logic.js';
import { UNKNOWN_GEAR_LABEL } from './gear-naming.js';

/** Minimal fixture row builder — only the fields the aggregate reads matter for these tests. */
function makeRow(overrides: Partial<DashboardIndexRow> & { id: string }): DashboardIndexRow {
  return {
    startDate: '2024-06-01T09:00:00Z',
    startDateLocal: '2024-06-01T09:00:00Z',
    name: 'Test Run',
    distanceM: 10000,
    movingTimeSec: 3000,
    paceSecPerKm: 300,
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

/**
 * Builds a row with the `gearName` key entirely absent — the shape a row
 * parsed from `data/dashboard/index.json` can produce once `gearName` is
 * optional on `DashboardIndexRow` (D-13). `makeRow`'s spread contract can
 * only ever *set* `gearName` to a valid value or `undefined`, never omit
 * the key, so this helper destructure-omits it after construction.
 */
function makeRowWithoutGearName(overrides: Omit<Partial<DashboardIndexRow>, 'gearName'> & { id: string }): DashboardIndexRow {
  const row = makeRow(overrides);
  const { gearName: _omitted, ...rowWithoutGearName } = row;
  return rowWithoutGearName as DashboardIndexRow;
}

describe('buildGearAggregate', () => {
  it('produces correct per-shoe sums for a mixed set', () => {
    const rows = [
      makeRow({ id: 'a', gearName: 'Pegasus 40', distanceM: 5000, movingTimeSec: 1500 }),
      makeRow({ id: 'b', gearName: 'Pegasus 40', distanceM: 3000, movingTimeSec: 900 }),
      makeRow({ id: 'c', gearName: 'Vaporfly', distanceM: 10000, movingTimeSec: 2500 }),
    ];

    const shoes = buildGearAggregate(rows);
    const pegasus = shoes.find((s) => s.label === 'Pegasus 40');
    const vaporfly = shoes.find((s) => s.label === 'Vaporfly');

    expect(pegasus?.runs).toBe(2);
    expect(pegasus?.distanceM).toBe(8000);
    expect(pegasus?.movingTimeSec).toBe(2400);
    expect(vaporfly?.runs).toBe(1);
    expect(vaporfly?.distanceM).toBe(10000);
  });

  it('ungeared rows land in Unknown rather than being dropped (total runs across buckets equals input row count)', () => {
    const rows = [
      makeRow({ id: 'a', gearName: 'Pegasus 40' }),
      makeRow({ id: 'b', gearName: null }),
      makeRow({ id: 'c', gearName: null }),
    ];

    const shoes = buildGearAggregate(rows);
    const totalRuns = shoes.reduce((sum, s) => sum + s.runs, 0);
    expect(totalRuns).toBe(rows.length);

    const unknown = shoes.find((s) => s.isUnknown);
    expect(unknown).toBeDefined();
    expect(unknown?.runs).toBe(2);
    expect(unknown?.label).toBe(UNKNOWN_GEAR_LABEL);
    expect(unknown?.key).toBe('unknown');
  });

  it('Unknown is sorted last even when it has the most distance', () => {
    const rows = [
      makeRow({ id: 'a', gearName: 'Pegasus 40', distanceM: 1000 }),
      makeRow({ id: 'b', gearName: null, distanceM: 999999 }),
    ];

    const shoes = buildGearAggregate(rows);
    expect(shoes[shoes.length - 1].isUnknown).toBe(true);
  });

  it('avgHr is null when no row in a bucket has HR, and time-weighted (not row-mean) when some do', () => {
    const rowsNoHr = [makeRow({ id: 'a', gearName: 'Shoe X', avgHr: null })];
    const noHrShoes = buildGearAggregate(rowsNoHr);
    expect(noHrShoes[0].avgHr).toBeNull();

    // Two rows with very different durations: a naive row-mean of avgHr
    // (100+200)/2 = 150 differs from the time-weighted mean.
    const rowsWithHr = [
      makeRow({ id: 'short', gearName: 'Shoe Y', avgHr: 100, movingTimeSec: 100, distanceM: 500 }),
      makeRow({ id: 'long', gearName: 'Shoe Y', avgHr: 200, movingTimeSec: 900, distanceM: 4500 }),
    ];
    const weightedShoes = buildGearAggregate(rowsWithHr);
    const bucket = weightedShoes.find((s) => s.label === 'Shoe Y');
    // time-weighted: (100*100 + 200*900) / 1000 = 190
    expect(bucket?.avgHr).toBe(190);
    expect(bucket?.avgHr).not.toBe(150);
    expect(bucket?.runsWithHr).toBe(2);
  });

  it('a zero-distance row does not produce Infinity or NaN pace', () => {
    const rows = [makeRow({ id: 'a', gearName: 'Shoe Z', distanceM: 0, movingTimeSec: 0 })];
    const shoes = buildGearAggregate(rows);
    expect(shoes[0].avgPaceSecPerKm).toBeNull();
    expect(Number.isFinite(shoes[0].avgPaceSecPerKm ?? 0)).toBe(true);
  });

  it('slug collision between two labels produces distinct keys', () => {
    const rows = [
      makeRow({ id: 'a', gearName: 'Shoe #1' }),
      makeRow({ id: 'b', gearName: 'Shoe  1' }),
    ];
    const shoes = buildGearAggregate(rows);
    const keys = shoes.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('an empty input returns an empty shoes array without throwing', () => {
    expect(buildGearAggregate([])).toEqual([]);
  });

  it('no bucket key equals a raw gear id shape', () => {
    const rows = [makeRow({ id: 'a', gearName: 'Shoe 1' })];
    const shoes = buildGearAggregate(rows);
    for (const shoe of shoes) {
      expect(/^g\d+$/.test(shoe.key)).toBe(false);
    }
  });

  it('absent gearName key lands in the Unknown bucket instead of crashing slugify (FIX-02, D-12)', () => {
    const rows = [makeRowWithoutGearName({ id: 'a' })];
    const shoes = buildGearAggregate(rows);
    const unknown = shoes.find((s) => s.isUnknown);
    expect(unknown?.label).toBe(UNKNOWN_GEAR_LABEL);
    expect(unknown?.key).toBe('unknown');
    expect(unknown?.runs).toBe(1);
  });

  it('gearName: undefined lands in the Unknown bucket instead of crashing slugify (FIX-02, D-12)', () => {
    const rows = [makeRow({ id: 'a', gearName: undefined })];
    const shoes = buildGearAggregate(rows);
    const unknown = shoes.find((s) => s.isUnknown);
    expect(unknown?.label).toBe(UNKNOWN_GEAR_LABEL);
    expect(unknown?.key).toBe('unknown');
    expect(unknown?.runs).toBe(1);
  });

  it('gearName: empty string lands in the Unknown bucket rather than the shoe fallback key (FIX-02, D-12)', () => {
    const rows = [makeRow({ id: 'a', gearName: '' })];
    const shoes = buildGearAggregate(rows);
    const unknown = shoes.find((s) => s.isUnknown);
    expect(unknown?.label).toBe(UNKNOWN_GEAR_LABEL);
    expect(unknown?.key).toBe('unknown');
    expect(unknown?.runs).toBe(1);
  });

  it('non-string gearName lands in the Unknown bucket instead of crashing slugify (FIX-02, D-12)', () => {
    const rows = [makeRow({ id: 'a', gearName: 123 as unknown as string })];
    const shoes = buildGearAggregate(rows);
    const unknown = shoes.find((s) => s.isUnknown);
    expect(unknown?.label).toBe(UNKNOWN_GEAR_LABEL);
    expect(unknown?.key).toBe('unknown');
    expect(unknown?.runs).toBe(1);
  });
});

describe('buildGearCoverage', () => {
  it('computes per-year coverage over rows spanning 2019 (0%), 2023 (100%), and 2026 (partial)', () => {
    const rows = [
      makeRow({ id: '2019a', startDateLocal: '2019-05-01T09:00:00Z', gearName: null }),
      makeRow({ id: '2019b', startDateLocal: '2019-06-01T09:00:00Z', gearName: null }),
      makeRow({ id: '2023a', startDateLocal: '2023-05-01T09:00:00Z', gearName: 'Shoe A' }),
      makeRow({ id: '2023b', startDateLocal: '2023-06-01T09:00:00Z', gearName: 'Shoe A' }),
      makeRow({ id: '2026a', startDateLocal: '2026-01-01T09:00:00Z', gearName: 'Shoe A' }),
      makeRow({ id: '2026b', startDateLocal: '2026-02-01T09:00:00Z', gearName: null }),
      makeRow({ id: '2026c', startDateLocal: '2026-03-01T09:00:00Z', gearName: null }),
      makeRow({ id: '2026d', startDateLocal: '2026-04-01T09:00:00Z', gearName: null }),
      makeRow({ id: '2026e', startDateLocal: '2026-05-01T09:00:00Z', gearName: null }),
    ];

    const { byYear } = buildGearCoverage(rows);
    const y2019 = byYear.find((y) => y.year === 2019);
    const y2023 = byYear.find((y) => y.year === 2023);
    const y2026 = byYear.find((y) => y.year === 2026);

    expect(y2019?.percentWithGear).toBe(0);
    expect(y2023?.percentWithGear).toBe(100);
    expect(y2026?.percentWithGear).toBe(20);
    expect(byYear.map((y) => y.year)).toEqual([2019, 2023, 2026]);
  });

  it('an empty input returns empty byYear and percentWithGear: 0 without throwing', () => {
    const result = buildGearCoverage([]);
    expect(result.byYear).toEqual([]);
    expect(result.totals.percentWithGear).toBe(0);
    expect(result.totals.runs).toBe(0);
  });

  it('totals.percentWithGear reflects overall coverage rounded to 1 decimal', () => {
    const rows = [
      makeRow({ id: 'a', gearName: 'Shoe A' }),
      makeRow({ id: 'b', gearName: null }),
      makeRow({ id: 'c', gearName: null }),
    ];
    const { totals } = buildGearCoverage(rows);
    expect(totals.runs).toBe(3);
    expect(totals.runsWithGear).toBe(1);
    expect(totals.runsWithoutGear).toBe(2);
    expect(totals.percentWithGear).toBeCloseTo(33.3, 1);
    expect(totals.distinctShoes).toBe(1);
  });

  it('absent gearName key is not counted in runsWithGear (FIX-02, D-12)', () => {
    const rows = [makeRowWithoutGearName({ id: 'a' })];
    const { totals } = buildGearCoverage(rows);
    expect(totals.runsWithGear).toBe(0);
    expect(totals.distinctShoes).toBe(0);
  });

  it('gearName: undefined is not counted in runsWithGear (FIX-02, D-12)', () => {
    const rows = [makeRow({ id: 'a', gearName: undefined })];
    const { totals } = buildGearCoverage(rows);
    expect(totals.runsWithGear).toBe(0);
    expect(totals.distinctShoes).toBe(0);
  });

  it('gearName: empty string is not counted in runsWithGear (FIX-02, D-12)', () => {
    const rows = [makeRow({ id: 'a', gearName: '' })];
    const { totals } = buildGearCoverage(rows);
    expect(totals.runsWithGear).toBe(0);
    expect(totals.distinctShoes).toBe(0);
  });

  it('non-string gearName is not counted in runsWithGear (FIX-02, D-12)', () => {
    const rows = [makeRow({ id: 'a', gearName: 123 as unknown as string })];
    const { totals } = buildGearCoverage(rows);
    expect(totals.runsWithGear).toBe(0);
    expect(totals.distinctShoes).toBe(0);
  });
});
