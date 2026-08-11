import { describe, expect, it } from 'vitest';
import type { AthleteHrZone } from '../dashboard/views/detail-zones.js';
import type { CanonicalStream } from '../streams/stream.types.js';
import { banisterTrimp, computeActivityTrimp, edwardsTrimp, zoneForHr } from './trimp.js';

const ZONES: readonly AthleteHrZone[] = [
  { zone: 1, minBpm: 100, maxBpm: 120 },
  { zone: 2, minBpm: 121, maxBpm: 140 },
  { zone: 3, minBpm: 141, maxBpm: 150 },
  { zone: 4, minBpm: 151, maxBpm: 160 },
  { zone: 5, minBpm: 161, maxBpm: null },
];

function makeStream(overrides: Partial<CanonicalStream> & { t: number[] }): CanonicalStream {
  return {
    schemaVersion: 1,
    id: 'test',
    source: 'intervals',
    distanceSource: 'native',
    sampleCount: overrides.t.length,
    channels: { time: true, distance: true, hr: true, cadence: false, elevation: false },
    d: overrides.t.map((v) => v * 3),
    ...overrides,
  };
}

describe('zoneForHr', () => {
  it('places exact minBpm and maxBpm boundaries in their own zone', () => {
    expect(zoneForHr(100, ZONES)).toBe(1);
    expect(zoneForHr(120, ZONES)).toBe(1);
    expect(zoneForHr(121, ZONES)).toBe(2);
    expect(zoneForHr(160, ZONES)).toBe(4);
    expect(zoneForHr(161, ZONES)).toBe(5);
  });

  it('treats a null maxBpm (zone 5) as open-ended for any high value', () => {
    expect(zoneForHr(161, ZONES)).toBe(5);
    expect(zoneForHr(500, ZONES)).toBe(5);
  });

  it('returns zone 1 for a value below zone 1s floor rather than throwing or dropping it', () => {
    expect(zoneForHr(50, ZONES)).toBe(1);
    expect(zoneForHr(99, ZONES)).toBe(1);
  });
});

describe('edwardsTrimp', () => {
  it('is decimation-invariant: same 30 minutes at the same constant HR, sampled every 1s vs every 60s, agree within 1%', () => {
    const CONSTANT_HR = 150; // zone 3

    const t1: number[] = [];
    const hr1: number[] = [];
    for (let i = 0; i <= 1800; i++) {
      t1.push(i);
      hr1.push(CONSTANT_HR);
    }

    const t2: number[] = [];
    const hr2: number[] = [];
    for (let i = 0; i <= 1800; i += 60) {
      t2.push(i);
      hr2.push(CONSTANT_HR);
    }

    const fine = edwardsTrimp(t1, hr1, ZONES);
    const coarse = edwardsTrimp(t2, hr2, ZONES);

    expect(fine).toBeGreaterThan(0);
    expect(Math.abs(fine - coarse) / fine).toBeLessThan(0.01);
  });

  it('weights by real Δt, not sample count: 60s in zone 1 + 600s in zone 5 = 51, and swapping which zone gets which duration changes the result', () => {
    // zone1 value for the [0,60] segment, zone5 value for the [60,660] segment.
    const t = [0, 60, 660];
    const hrA = [110, 170, 170]; // 60s zone1, 600s zone5
    const original = edwardsTrimp(t, hrA, ZONES);
    expect(original).toBeCloseTo(60 / 60 * 1 + 600 / 60 * 5, 10);

    // Swap the durations between the two zones: 600s in zone1, 60s in zone5.
    const tSwapped = [0, 600, 660];
    const hrB = [110, 170, 170]; // 600s zone1, 60s zone5
    const swapped = edwardsTrimp(tSwapped, hrB, ZONES);
    expect(swapped).not.toBeCloseTo(original, 5);
    expect(swapped).toBeCloseTo(600 / 60 * 1 + 60 / 60 * 5, 10);
  });

  it('returns 0 (never NaN, never throws) for degenerate inputs', () => {
    expect(edwardsTrimp([], [], ZONES)).toBe(0);
    expect(edwardsTrimp([0, 60], [150], ZONES)).toBe(0); // mismatched lengths
    expect(edwardsTrimp([0], [150], ZONES)).toBe(0); // single sample
    expect(edwardsTrimp([0, 0, 0], [150, 150, 150], ZONES)).toBe(0); // all-zero Δt
  });
});

describe('banisterTrimp', () => {
  const RESTING = 50;
  const MAX = 190;

  function constantStream(hrValue: number, durationSec = 1800) {
    return { t: [0, durationSec], hr: [hrValue, hrValue] };
  }

  it('is monotonic in HR: higher constant HR over the same duration yields a strictly larger value', () => {
    const low = constantStream(120);
    const high = constantStream(170);
    const lowValue = banisterTrimp(low.t, low.hr, RESTING, MAX, 'male');
    const highValue = banisterTrimp(high.t, high.hr, RESTING, MAX, 'male');
    expect(highValue).toBeGreaterThan(lowValue);
  });

  it('yields ~0 when hr === restingHr', () => {
    const s = constantStream(RESTING);
    expect(banisterTrimp(s.t, s.hr, RESTING, MAX, 'male')).toBeCloseTo(0, 6);
  });

  it('clamps HR above maxHr and does not exceed the value at exactly maxHr', () => {
    const atMax = constantStream(MAX);
    const aboveMax = constantStream(250);
    const atMaxValue = banisterTrimp(atMax.t, atMax.hr, RESTING, MAX, 'male');
    const aboveMaxValue = banisterTrimp(aboveMax.t, aboveMax.hr, RESTING, MAX, 'male');
    expect(aboveMaxValue).toBeLessThanOrEqual(atMaxValue);
  });

  it('produces different, finite, positive values for male vs female coefficients on identical inputs', () => {
    const s = constantStream(160);
    const male = banisterTrimp(s.t, s.hr, RESTING, MAX, 'male');
    const female = banisterTrimp(s.t, s.hr, RESTING, MAX, 'female');
    expect(male).not.toBeCloseTo(female, 6);
    expect(Number.isFinite(male)).toBe(true);
    expect(Number.isFinite(female)).toBe(true);
    expect(male).toBeGreaterThan(0);
    expect(female).toBeGreaterThan(0);
  });

  it('returns 0 (never NaN, never throws) for degenerate inputs, including maxHr === restingHr', () => {
    expect(banisterTrimp([], [], RESTING, MAX, 'male')).toBe(0);
    expect(banisterTrimp([0, 60], [150], RESTING, MAX, 'male')).toBe(0); // mismatched lengths
    expect(banisterTrimp([0], [150], RESTING, MAX, 'male')).toBe(0); // single sample
    expect(banisterTrimp([0, 0, 0], [150, 150, 150], RESTING, MAX, 'male')).toBe(0); // all-zero Δt
    expect(banisterTrimp([0, 60], [150, 150], RESTING, RESTING, 'male')).toBe(0); // maxHr === restingHr
  });
});

describe('computeActivityTrimp', () => {
  it('returns null for a CanonicalStream with no hr field', () => {
    const stream = makeStream({ t: [0, 60, 120] });
    delete stream.hr;
    expect(computeActivityTrimp(stream, ZONES, null)).toBeNull();
  });

  it('returns banister: null when banisterInputs is null while edwards is still positive', () => {
    const stream = makeStream({ t: [0, 60, 120], hr: [150, 150, 150] });
    const result = computeActivityTrimp(stream, ZONES, null);
    expect(result).not.toBeNull();
    expect(result?.banister).toBeNull();
    expect(result?.edwards).toBeGreaterThan(0);
  });

  it('computes both models when banisterInputs is provided', () => {
    const stream = makeStream({ t: [0, 60, 120], hr: [150, 150, 150] });
    const result = computeActivityTrimp(stream, ZONES, {
      restingHr: 50,
      maxHr: 190,
      sex: 'male',
    });
    expect(result).not.toBeNull();
    expect(result?.edwards).toBeGreaterThan(0);
    expect(result?.banister).not.toBeNull();
    expect(result?.banister as number).toBeGreaterThan(0);
  });
});
