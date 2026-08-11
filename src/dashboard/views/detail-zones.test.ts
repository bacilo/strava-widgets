import { describe, it, expect } from 'vitest';
import type { CanonicalStream } from '../../streams/stream.types.js';
import {
  PACE_BUCKET_WIDTH_SEC,
  computePaceDistribution,
  parseAthleteConfig,
  computeHrZoneTimes,
  type AthleteConfig,
} from './detail-zones.js';

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

const VALID_CONFIG_RAW = {
  schemaVersion: 1,
  maxHr: 190,
  hrZones: [
    { zone: 1, minBpm: 0, maxBpm: 114 },
    { zone: 2, minBpm: 115, maxBpm: 133 },
    { zone: 3, minBpm: 134, maxBpm: 152 },
    { zone: 4, minBpm: 153, maxBpm: 171 },
    { zone: 5, minBpm: 172, maxBpm: null },
  ],
};

/** A variant with a finite (non-open-ended) top zone, for above-range clamp tests. */
const FINITE_TOP_CONFIG_RAW = {
  schemaVersion: 1,
  maxHr: 190,
  hrZones: [
    { zone: 1, minBpm: 0, maxBpm: 114 },
    { zone: 2, minBpm: 115, maxBpm: 133 },
    { zone: 3, minBpm: 134, maxBpm: 152 },
    { zone: 4, minBpm: 153, maxBpm: 171 },
    { zone: 5, minBpm: 172, maxBpm: 190 },
  ],
};

describe('parseAthleteConfig — tolerant all-or-nothing gate (D-31)', () => {
  it('parses a well-formed document with five ascending zones', () => {
    const config = parseAthleteConfig(VALID_CONFIG_RAW);
    expect(config).not.toBeNull();
    expect(config?.hrZones).toHaveLength(5);
    expect(config?.maxHr).toBe(190);
  });

  const malformedCases: Array<[string, unknown]> = [
    ['null', null],
    ['a bare string', 'nonsense'],
    ['a bare number', 42],
    ['an empty object', {}],
    ['maxHr with no zones', { maxHr: 190 }],
    ['non-finite maxHr', { ...VALID_CONFIG_RAW, maxHr: NaN }],
    ['zero maxHr', { ...VALID_CONFIG_RAW, maxHr: 0 }],
    ['negative maxHr', { ...VALID_CONFIG_RAW, maxHr: -5 }],
    ['maxHr above 260', { ...VALID_CONFIG_RAW, maxHr: 261 }],
    [
      'zones not strictly ascending',
      {
        ...VALID_CONFIG_RAW,
        hrZones: [
          { zone: 1, minBpm: 0, maxBpm: 114 },
          { zone: 2, minBpm: 100, maxBpm: 133 }, // overlaps zone 1
          { zone: 3, minBpm: 134, maxBpm: 152 },
          { zone: 4, minBpm: 153, maxBpm: 171 },
          { zone: 5, minBpm: 172, maxBpm: null },
        ],
      },
    ],
    [
      'a non-finite zone bound',
      {
        ...VALID_CONFIG_RAW,
        hrZones: [
          { zone: 1, minBpm: 0, maxBpm: 114 },
          { zone: 2, minBpm: 115, maxBpm: NaN },
          { zone: 3, minBpm: 134, maxBpm: 152 },
          { zone: 4, minBpm: 153, maxBpm: 171 },
          { zone: 5, minBpm: 172, maxBpm: null },
        ],
      },
    ],
    [
      'fewer than 5 zones',
      { ...VALID_CONFIG_RAW, hrZones: VALID_CONFIG_RAW.hrZones.slice(0, 4) },
    ],
    [
      'more than 5 zones',
      {
        ...VALID_CONFIG_RAW,
        hrZones: [...VALID_CONFIG_RAW.hrZones, { zone: 6, minBpm: 200, maxBpm: null }],
      },
    ],
    [
      'a non-final zone with a null maxBpm',
      {
        ...VALID_CONFIG_RAW,
        hrZones: [
          { zone: 1, minBpm: 0, maxBpm: null },
          { zone: 2, minBpm: 115, maxBpm: 133 },
          { zone: 3, minBpm: 134, maxBpm: 152 },
          { zone: 4, minBpm: 153, maxBpm: 171 },
          { zone: 5, minBpm: 172, maxBpm: null },
        ],
      },
    ],
  ];

  it.each(malformedCases)('rejects: %s', (_name, raw) => {
    expect(parseAthleteConfig(raw)).toBeNull();
  });

  it('rejects a config carrying maxHr only via a polluted prototype (own-property read only)', () => {
    const tainted = Object.create({ maxHr: 190 }) as Record<string, unknown>;
    tainted.schemaVersion = 1;
    tainted.hrZones = VALID_CONFIG_RAW.hrZones;
    expect(parseAthleteConfig(tainted)).toBeNull();
  });
});

describe('computeHrZoneTimes — Δt-weighted HR zone times, D-31 absence gate', () => {
  const config = parseAthleteConfig(VALID_CONFIG_RAW) as AthleteConfig;

  it('returns null when the stream has no HR channel', () => {
    const stream = makeStream([0, 300], [0, 0]);
    expect(computeHrZoneTimes(stream, config)).toBeNull();
  });

  it('returns null when config is null', () => {
    const stream = makeStream([0, 300], [0, 0], [120, 120]);
    expect(computeHrZoneTimes(stream, null)).toBeNull();
  });

  it('returns exactly 5 ZoneTime entries in ascending zone order, including zero-time zones', () => {
    const stream = makeStream([0, 300], [0, 0], [120, 120]);
    const zones = computeHrZoneTimes(stream, config);
    expect(zones).toHaveLength(5);
    expect(zones?.map((z) => z.zone)).toEqual([1, 2, 3, 4, 5]);
  });

  it('is Δt-weighted: 300 s at 120 bpm assigns to zone 2, 60 s at 170 bpm assigns to zone 4', () => {
    const stream = makeStream([0, 300, 360], [0, 0, 0], [120, 170, 170]);
    const zones = computeHrZoneTimes(stream, config) ?? [];
    const zone2 = zones.find((z) => z.zone === 2);
    const zone4 = zones.find((z) => z.zone === 4);
    expect(zone2?.timeSec).toBeCloseTo(300, 2);
    expect(zone4?.timeSec).toBeCloseTo(60, 2);
  });

  it('sums zone timeSec to the HR-covered elapsed time within 0.01 s', () => {
    const stream = makeStream([0, 300, 360], [0, 0, 0], [120, 170, 170]);
    const zones = computeHrZoneTimes(stream, config) ?? [];
    const total = zones.reduce((sum, z) => sum + z.timeSec, 0);
    expect(total).toBeCloseTo(360, 2);
  });

  it('computes percent as timeSec / total * 100, summing to 100 within 0.01', () => {
    const stream = makeStream([0, 300, 360], [0, 0, 0], [120, 170, 170]);
    const zones = computeHrZoneTimes(stream, config) ?? [];
    const zone2 = zones.find((z) => z.zone === 2);
    expect(zone2?.percent).toBeCloseTo((300 / 360) * 100, 2);
    const totalPercent = zones.reduce((sum, z) => sum + z.percent, 0);
    expect(totalPercent).toBeCloseTo(100, 2);
  });

  it('returns percent 0 (never NaN) for every zone when total zone time is 0', () => {
    // A single-sample HR stream produces no segments at all -> zero total time.
    const stream = makeStream([0], [0], [120]);
    const zones = computeHrZoneTimes(stream, config) ?? [];
    expect(zones).toHaveLength(5);
    for (const z of zones) {
      expect(z.percent).toBe(0);
      expect(Number.isNaN(z.percent)).toBe(false);
    }
  });

  it('clamps an HR sample below zone 1 to zone 1 and above the final zone to zone 5', () => {
    const finiteConfig = parseAthleteConfig(FINITE_TOP_CONFIG_RAW) as AthleteConfig;
    const stream = makeStream([0, 10, 20], [0, 0, 0], [-10, 250, 250]);
    const zones = computeHrZoneTimes(stream, finiteConfig) ?? [];
    const zone1 = zones.find((z) => z.zone === 1);
    const zone5 = zones.find((z) => z.zone === 5);
    expect(zone1?.timeSec).toBeCloseTo(10, 2);
    expect(zone5?.timeSec).toBeCloseTo(10, 2);
  });
});
