import { describe, it, expect } from 'vitest';
import { computeSplits } from './detail-splits.js';
import type { CanonicalStream } from '../../streams/stream.types.js';

function baseChannels(overrides: Partial<CanonicalStream['channels']> = {}) {
  return {
    time: true as const,
    distance: true,
    hr: false,
    cadence: false,
    elevation: false,
    ...overrides,
  };
}

function makeStream(partial: Partial<CanonicalStream> & { t: number[]; d: number[] }): CanonicalStream {
  return {
    schemaVersion: 1,
    id: 'test',
    source: 'fit',
    distanceSource: 'native',
    sampleCount: partial.t.length,
    channels: baseChannels({
      hr: !!partial.hr,
      cadence: !!partial.cadence,
      elevation: !!partial.alt,
    }),
    ...partial,
  };
}

/** 1 Hz uniform stream at `speedMps`, `durationSec` seconds long. */
function makeUniformStream(
  speedMps: number,
  durationSec: number,
  extra: Partial<CanonicalStream> = {}
): CanonicalStream {
  const t: number[] = [];
  const d: number[] = [];
  for (let s = 0; s <= durationSec; s++) {
    t.push(s);
    d.push(s * speedMps);
  }
  return makeStream({ t, d, ...extra });
}

describe('computeSplits — uniform pace', () => {
  it('yields 3 full splits of 200s each at exactly 5 m/s over 3000 m, no partial', () => {
    const stream = makeUniformStream(5, 600); // 600s * 5m/s = 3000m
    const splits = computeSplits(stream);

    expect(splits).toHaveLength(3);
    for (const [i, split] of splits.entries()) {
      expect(split.km).toBe(i + 1);
      expect(split.distanceM).toBeCloseTo(1000, 6);
      expect(split.durationSec).toBeCloseTo(200, 6);
      expect(split.isPartial).toBe(false);
    }
  });

  it('extended to 3400 m yields a 4th partial split with distanceM ≈ 400', () => {
    const stream = makeUniformStream(5, 680); // 680s * 5m/s = 3400m
    const splits = computeSplits(stream);

    expect(splits).toHaveLength(4);
    const last = splits[3];
    expect(last.km).toBe(4);
    expect(last.isPartial).toBe(true);
    expect(last.distanceM).toBeCloseTo(400, 6);
  });

  it('paceSecPerKm equals durationSec / (distanceM / 1000) for every split, full and partial', () => {
    const stream = makeUniformStream(5, 680);
    const splits = computeSplits(stream);
    for (const split of splits) {
      expect(split.paceSecPerKm).toBeCloseTo(split.durationSec / (split.distanceM / 1000), 9);
    }
  });

  it('sums split distances to d[last]-d[0] within 0.5 m and durations to t[last]-t[0] within 0.01 s (D-28)', () => {
    const stream = makeUniformStream(5, 680);
    const splits = computeSplits(stream);

    const totalDistance = splits.reduce((sum, s) => sum + s.distanceM, 0);
    const totalDuration = splits.reduce((sum, s) => sum + s.durationSec, 0);

    const expectedDistance = stream.d[stream.d.length - 1] - stream.d[0];
    const expectedDuration = stream.t[stream.t.length - 1] - stream.t[0];

    expect(Math.abs(totalDistance - expectedDistance)).toBeLessThan(0.5);
    expect(Math.abs(totalDuration - expectedDuration)).toBeLessThan(0.01);
  });
});

describe('computeSplits — irregular sampling (RESEARCH.md Pitfall 1)', () => {
  it('computes the 1000 m boundary crossing by hand-verified linear interpolation, not a sample snap', () => {
    // t = [0, 1, 5, 10, 14, 16, 18, 20, 22, 24] (real committed-stream shape)
    const t = [0, 1, 5, 10, 14, 16, 18, 20, 22, 24];
    const d = [0, 20, 100, 300, 700, 900, 1050, 1200, 1400, 1600];
    const stream = makeStream({ t, d });

    const splits = computeSplits(stream);
    expect(splits.length).toBeGreaterThanOrEqual(1);

    // Boundary falls between d[5]=900 (t=16) and d[6]=1050 (t=18).
    const segMeters = 1050 - 900;
    const frac = (1000 - 900) / segMeters; // 0.6666...
    const expectedCrossingTime = 16 + frac * (18 - 16); // 17.3333...

    expect(splits[0].durationSec).toBeCloseTo(expectedCrossingTime, 6);
    // Explicitly differs from both bracketing raw sample offsets.
    expect(splits[0].durationSec).not.toBeCloseTo(18 - 0, 3);
    expect(splits[0].durationSec).not.toBeCloseTo(16 - 0, 3);
  });

  it('sums split distances and durations correctly against the true irregular-stream totals', () => {
    const t = [0, 1, 5, 10, 14, 16, 18, 20, 22, 24];
    const d = [0, 20, 100, 300, 700, 900, 1050, 1200, 1400, 1600];
    const stream = makeStream({ t, d });

    const splits = computeSplits(stream);
    const totalDistance = splits.reduce((sum, s) => sum + s.distanceM, 0);
    const totalDuration = splits.reduce((sum, s) => sum + s.durationSec, 0);

    expect(Math.abs(totalDistance - (d[d.length - 1] - d[0]))).toBeLessThan(0.5);
    expect(Math.abs(totalDuration - (t[t.length - 1] - t[0]))).toBeLessThan(0.01);
  });
});

describe('computeSplits — Δt-weighted channel aggregation', () => {
  it('computes avgHr as Δt-weighted (150 for 30s, 100 for 170s -> ≈107.5), not the sample-count mean', () => {
    // A single 1000m split lasting exactly 200s: HR holds 150 for [0,30), then 100 for [30,200).
    const t = [0, 30, 200];
    const d = [0, 500, 1000];
    const hr = [150, 100, 100];
    const stream = makeStream({ t, d, hr });

    const splits = computeSplits(stream);
    expect(splits).toHaveLength(1);
    expect(splits[0].avgHr).toBeCloseTo(107.5, 6);

    const sampleCountMean = (150 + 100 + 100) / 3;
    expect(splits[0].avgHr).not.toBeCloseTo(sampleCountMean, 3);
  });

  it('avgHr is null when the stream has no hr array', () => {
    const stream = makeUniformStream(5, 200);
    const splits = computeSplits(stream);
    expect(splits[0].avgHr).toBeNull();
  });

  it('avgCadence is null when the stream has no cadence array', () => {
    const stream = makeUniformStream(5, 200);
    const splits = computeSplits(stream);
    expect(splits[0].avgCadence).toBeNull();
  });

  it('avgCadence is Δt-weighted when cadence is present', () => {
    const t = [0, 30, 200];
    const d = [0, 500, 1000];
    const cadence = [170, 160, 160];
    const stream = makeStream({ t, d, cadence });

    const splits = computeSplits(stream);
    expect(splits[0].avgCadence).toBeCloseTo((170 * 30 + 160 * 170) / 200, 6);
  });

  it('elevDeltaM is null when the stream has no alt array', () => {
    const stream = makeUniformStream(5, 200);
    const splits = computeSplits(stream);
    expect(splits[0].elevDeltaM).toBeNull();
  });

  it('elevDeltaM is the interpolated end-boundary altitude minus the interpolated start-boundary altitude, and may be negative', () => {
    const t = [0, 30, 200];
    const d = [0, 500, 1000];
    const alt = [100, 90, 40]; // net descent over the split
    const stream = makeStream({ t, d, alt });

    const splits = computeSplits(stream);
    // Split spans exactly [t=0 alt=100] to [t=200 alt=40] (crossing lands exactly on the last sample).
    expect(splits[0].elevDeltaM).toBeCloseTo(40 - 100, 6);
    expect(splits[0].elevDeltaM).toBeLessThan(0);
  });
});

describe('computeSplits — edge cases', () => {
  it('returns [] for a stream with fewer than 2 samples', () => {
    expect(computeSplits(makeStream({ t: [0], d: [0] }))).toEqual([]);
    expect(computeSplits(makeStream({ t: [], d: [] }))).toEqual([]);
  });

  it('returns exactly one partial split labelled km:1 when total distance is under 1000 m', () => {
    const stream = makeStream({ t: [0, 10, 20], d: [0, 300, 600] });
    const splits = computeSplits(stream);

    expect(splits).toHaveLength(1);
    expect(splits[0].km).toBe(1);
    expect(splits[0].isPartial).toBe(true);
    expect(splits[0].distanceM).toBeCloseTo(600, 6);
    expect(splits[0].durationSec).toBeCloseTo(20, 6);
  });

  it('returns [] and does not throw for a t/d length mismatch', () => {
    const stream = makeStream({ t: [0, 1, 2], d: [0, 10] });
    expect(() => computeSplits(stream)).not.toThrow();
    expect(computeSplits(stream)).toEqual([]);
  });

  it('returns [] and does not throw for a non-finite value', () => {
    const stream = makeStream({ t: [0, 1, 2], d: [0, 10, NaN] });
    expect(() => computeSplits(stream)).not.toThrow();
    expect(computeSplits(stream)).toEqual([]);
  });

  it('returns [] and does not throw for a decreasing distance series', () => {
    const stream = makeStream({ t: [0, 1, 2], d: [0, 100, 50] });
    expect(() => computeSplits(stream)).not.toThrow();
    expect(computeSplits(stream)).toEqual([]);
  });
});
