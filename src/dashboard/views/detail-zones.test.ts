import { describe, it, expect } from 'vitest';
import type { CanonicalStream } from '../../streams/stream.types.js';
import { PACE_BUCKET_WIDTH_SEC, computePaceDistribution } from './detail-zones.js';

/** Builds a minimal valid `CanonicalStream` fixture for pure-function tests. */
function makeStream(t: number[], d: number[], hr?: number[]): CanonicalStream {
  return {
    schemaVersion: 1,
    id: 'test-activity',
    source: 'intervals',
    distanceSource: 'native',
    sampleCount: t.length,
    channels: {
      time: true,
      distance: true,
      hr: hr !== undefined,
      cadence: false,
      elevation: false,
    },
    t,
    d,
    ...(hr !== undefined ? { hr } : {}),
  };
}

describe('PACE_BUCKET_WIDTH_SEC', () => {
  it('is 15 seconds per the UI-SPEC § 4e bucket width', () => {
    expect(PACE_BUCKET_WIDTH_SEC).toBe(15);
  });
});

describe('computePaceDistribution — Δt-weighted pace-distribution histogram', () => {
  it('buckets a constant 5 m/s, 1000 s stream into a single 3:15–3:30/km bucket containing ~1000 s', () => {
    const stream = makeStream([0, 1000], [0, 5000]);
    const buckets = computePaceDistribution(stream);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].label).toBe('3:15–3:30/km');
    expect(buckets[0].minSecPerKm).toBe(195);
    expect(buckets[0].maxSecPerKm).toBe(210);
    expect(buckets[0].timeSec).toBeCloseTo(1000, 2);
  });

  it('sums bucket timeSec to the stream elapsed time within 0.01 s on an irregular fixture', () => {
    const stream = makeStream([0, 1, 5, 10, 14, 16, 18, 20], [0, 5, 25, 50, 70, 80, 90, 100]);
    const buckets = computePaceDistribution(stream);
    const total = buckets.reduce((sum, b) => sum + b.timeSec, 0);
    expect(total).toBeCloseTo(stream.t[stream.t.length - 1] - stream.t[0], 2);
  });

  it('weights a 60 s segment as 60 s and a 1 s segment as 1 s — never one sample-count unit each', () => {
    // Segment A: dt=60, dd=300m -> pace 200 s/km (bucket 195-210).
    // Segment B: dt=1, dd=1000/305 m -> pace ~305 s/km (bucket 300-315).
    const stream = makeStream([0, 60, 61], [0, 300, 300 + 1000 / 305]);
    const buckets = computePaceDistribution(stream);
    expect(buckets).toHaveLength(2);
    const bucketA = buckets.find((b) => b.minSecPerKm === 195);
    const bucketB = buckets.find((b) => b.minSecPerKm === 300);
    expect(bucketA?.timeSec).toBeCloseTo(60, 2);
    expect(bucketB?.timeSec).toBeCloseTo(1, 2);
  });

  it('returns buckets in ascending pace order and omits empty buckets', () => {
    // Three 1 s segments at paces 400, 200, 600 s/km (out of ascending time order).
    const stream = makeStream(
      [0, 1, 2, 3],
      [0, 1000 / 400, 1000 / 400 + 1000 / 200, 1000 / 400 + 1000 / 200 + 1000 / 600]
    );
    const buckets = computePaceDistribution(stream);
    expect(buckets).toHaveLength(3);
    const mins = buckets.map((b) => b.minSecPerKm);
    expect(mins).toEqual([...mins].sort((a, b) => a - b));
    expect(mins).toEqual([195, 390, 600]);
  });

  it('formats an exact 4:00/km bucket boundary as the literal label 4:00–4:15/km', () => {
    const stream = makeStream([0, 240], [0, 1000]);
    const buckets = computePaceDistribution(stream);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].label).toBe('4:00–4:15/km');
  });

  it('excludes a zero-distance (standstill) segment rather than bucketing an Infinity pace', () => {
    const stream = makeStream([0, 10, 20], [0, 50, 50]);
    const buckets = computePaceDistribution(stream);
    expect(buckets).toHaveLength(1);
    for (const b of buckets) {
      expect(Number.isFinite(b.minSecPerKm)).toBe(true);
      expect(Number.isFinite(b.maxSecPerKm)).toBe(true);
    }
  });

  it('returns [] without throwing for a stream failing validateStreamSeries', () => {
    const stream = makeStream([0, 1, 0.5], [0, 5, 10]); // t decreases at index 2
    expect(() => computePaceDistribution(stream)).not.toThrow();
    expect(computePaceDistribution(stream)).toEqual([]);
  });

  it('returns [] without throwing for a stream with fewer than 2 samples', () => {
    const stream = makeStream([0], [0]);
    expect(() => computePaceDistribution(stream)).not.toThrow();
    expect(computePaceDistribution(stream)).toEqual([]);
  });
});
