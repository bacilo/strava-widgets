import { describe, it, expect } from 'vitest';
import {
  CHANNEL_KEYS,
  PACE_SMOOTHING_WINDOW_SEC,
  DEFAULT_OVERLAY_CONFIG,
  MAX_OVERLAYS_PER_BAND,
  OVERLAY_STORAGE_KEY,
  availableChannels,
  derivePaceSeries,
  buildChannelSeries,
  distanceFractionAtX,
  pointAtDistanceFraction,
  parseOverlayConfig,
  readStoredOverlayConfig,
  writeStoredOverlayConfig,
} from './detail-charts-logic.js';
import type { CanonicalStream } from '../../streams/stream.types.js';

function makeStream(partial: Partial<CanonicalStream> & { t: number[]; d: number[] }): CanonicalStream {
  return {
    schemaVersion: 1,
    id: 'test',
    source: 'fit',
    distanceSource: 'native',
    sampleCount: partial.t.length,
    channels: {
      time: true,
      distance: true,
      hr: !!partial.hr,
      cadence: !!partial.cadence,
      elevation: !!partial.alt,
    },
    ...partial,
  };
}

function makeUniformStream(speedMps: number, durationSec: number, extra: Partial<CanonicalStream> = {}): CanonicalStream {
  const t: number[] = [];
  const d: number[] = [];
  for (let s = 0; s <= durationSec; s++) {
    t.push(s);
    d.push(s * speedMps);
  }
  return makeStream({ t, d, ...extra });
}

describe('availableChannels', () => {
  it('returns [pace, hr, elevation] in fixed order for a stream with hr and alt but no cadence', () => {
    const stream = makeUniformStream(5, 100, { hr: new Array(101).fill(150), alt: new Array(101).fill(10) });
    expect(availableChannels(stream)).toEqual(['pace', 'hr', 'elevation']);
  });

  it('returns [] when the series fails validateStreamSeries', () => {
    const stream = makeStream({ t: [0, 1], d: [0] });
    expect(availableChannels(stream)).toEqual([]);
  });

  it('always includes pace when the series validates, even with no other channels', () => {
    const stream = makeUniformStream(5, 100);
    expect(availableChannels(stream)).toEqual(['pace']);
  });

  it('CHANNEL_KEYS is the fixed band order pace, hr, cadence, elevation', () => {
    expect(CHANNEL_KEYS).toEqual(['pace', 'hr', 'cadence', 'elevation']);
  });
});

describe('derivePaceSeries', () => {
  it('returns ≈200 s/km for every entry on a constant 5 m/s stream with a 20s window', () => {
    const stream = makeUniformStream(5, 200);
    const pace = derivePaceSeries(stream.t, stream.d, PACE_SMOOTHING_WINDOW_SEC);
    for (const p of pace) {
      expect(p).not.toBeNull();
      expect(p as number).toBeCloseTo(200, 0);
    }
  });

  it('weights by real Δt: a 60-second 10 m/s burst inside a 3 m/s stretch moves the window pace much more than a 1-second burst', () => {
    // Baseline: 3 m/s throughout, sampled once per second for 200s.
    function buildWithBurst(burstStartSec: number, burstDurationSec: number): CanonicalStream {
      const t: number[] = [];
      const d: number[] = [];
      let dist = 0;
      for (let s = 0; s <= 200; s++) {
        t.push(s);
        d.push(dist);
        const inBurst = s >= burstStartSec && s < burstStartSec + burstDurationSec;
        dist += inBurst ? 10 : 3;
      }
      return makeStream({ t, d });
    }

    const shortBurst = buildWithBurst(100, 1);
    const longBurst = buildWithBurst(100, 60);

    const paceShort = derivePaceSeries(shortBurst.t, shortBurst.d, 20);
    const paceLong = derivePaceSeries(longBurst.t, longBurst.d, 20);

    const baselinePace = 1000 / 3; // s/km at 3 m/s

    const shortDeviation = Math.abs((paceShort[100] as number) - baselinePace);
    const longDeviation = Math.abs((paceLong[100] as number) - baselinePace);

    expect(shortDeviation).toBeLessThan(longDeviation);
  });

  it('returns null (not NaN, not Infinity) for a standstill window (zero distance)', () => {
    const t = [0, 5, 10, 15, 20];
    const d = [0, 0, 0, 0, 0]; // standstill
    const pace = derivePaceSeries(t, d, 20);
    for (const p of pace) {
      expect(p).toBeNull();
    }
  });

  it('never returns NaN or Infinity for any window', () => {
    const t = [0, 5, 10, 15, 20];
    const d = [0, 0, 0, 0, 0];
    const pace = derivePaceSeries(t, d, 20);
    for (const p of pace) {
      if (p !== null) {
        expect(Number.isFinite(p)).toBe(true);
      }
    }
  });
});

describe('buildChannelSeries', () => {
  it('returns {x, y} points with x as cumulative km for distance axis, length equal to stream.t.length, for hr', () => {
    const stream = makeUniformStream(5, 50, { hr: new Array(51).fill(140) });
    const series = buildChannelSeries(stream, 'hr', 'distance');
    expect(series).not.toBeNull();
    expect(series!.length).toBe(stream.t.length);
    expect(series![10].x).toBeCloseTo(stream.d[10] / 1000, 9);
    expect(series![10].y).toBe(140);
  });

  it('returns the same y values with x in seconds for time axis', () => {
    const stream = makeUniformStream(5, 50, { hr: new Array(51).fill(140) });
    const distanceSeries = buildChannelSeries(stream, 'hr', 'distance')!;
    const timeSeries = buildChannelSeries(stream, 'hr', 'time')!;
    expect(timeSeries.map((p) => p.y)).toEqual(distanceSeries.map((p) => p.y));
    expect(timeSeries[10].x).toBe(stream.t[10]);
  });

  it('returns null when the stream has no cadence array (band omitted, not empty — D-17)', () => {
    const stream = makeUniformStream(5, 50);
    expect(buildChannelSeries(stream, 'cadence', 'distance')).toBeNull();
  });
});

describe('distanceFractionAtX', () => {
  it('returns 0.25 for distance axis at 2.5 km on a 10 km stream', () => {
    const stream = makeUniformStream(10, 1000); // 1000s * 10m/s = 10,000m = 10km
    expect(distanceFractionAtX(stream, 'distance', 2.5)).toBeCloseTo(0.25, 6);
  });

  it('returns the DISTANCE fraction (not the time fraction) for time axis, on a stream whose pace changes mid-run', () => {
    // First half: 10 m/s for 100s (1000m). Second half: 2 m/s for 400s (800m). Total 1800m over 500s.
    const t: number[] = [];
    const d: number[] = [];
    for (let s = 0; s <= 100; s++) {
      t.push(s);
      d.push(s * 10);
    }
    for (let s = 1; s <= 400; s++) {
      t.push(100 + s);
      d.push(1000 + s * 2);
    }
    const stream = makeStream({ t, d });

    const totalTime = t[t.length - 1] - t[0]; // 500
    const totalDist = d[d.length - 1] - d[0]; // 1800

    const tMid = totalTime / 2; // 250
    const timeFraction = tMid / totalTime; // 0.5

    const distanceFraction = distanceFractionAtX(stream, 'time', tMid);
    expect(distanceFraction).not.toBeCloseTo(timeFraction, 2);

    // At t=250, distance covered = 1000 (first 100s) + 150*2 (150s of the second stretch) = 1300
    const expectedDist = 1000 + 150 * 2;
    expect(distanceFraction).toBeCloseTo(expectedDist / totalDist, 3);
  });

  it('clamps to [0, 1] for out-of-range x values', () => {
    const stream = makeUniformStream(5, 100);
    expect(distanceFractionAtX(stream, 'distance', -5)).toBe(0);
    expect(distanceFractionAtX(stream, 'distance', 9999)).toBe(1);
    expect(distanceFractionAtX(stream, 'time', -100)).toBe(0);
    expect(distanceFractionAtX(stream, 'time', 999999)).toBe(1);
  });
});

describe('pointAtDistanceFraction', () => {
  it('returns null for an empty coordinate array', () => {
    expect(pointAtDistanceFraction([], 0.5)).toBeNull();
  });

  it('returns the sole coordinate for a single-point route', () => {
    expect(pointAtDistanceFraction([[1, 2]], 0.5)).toEqual([1, 2]);
  });

  it('returns the first coordinate at fraction 0', () => {
    const coords: [number, number][] = [[0, 0], [10, 0], [20, 0]];
    expect(pointAtDistanceFraction(coords, 0)).toEqual([0, 0]);
  });

  it('returns the last coordinate at fraction 1', () => {
    const coords: [number, number][] = [[0, 0], [10, 0], [20, 0]];
    expect(pointAtDistanceFraction(coords, 1)).toEqual([20, 0]);
  });

  it('returns the midpoint at fraction 0.5 on a straight 2-point line', () => {
    const coords: [number, number][] = [[0, 0], [10, 0]];
    const result = pointAtDistanceFraction(coords, 0.5);
    expect(result![0]).toBeCloseTo(5, 6);
    expect(result![1]).toBeCloseTo(0, 6);
  });
});

describe('parseOverlayConfig', () => {
  it('caps a band at MAX_OVERLAYS_PER_BAND entries', () => {
    const config = parseOverlayConfig({ pace: ['hr', 'cadence', 'elevation'] });
    expect(config.pace.length).toBe(MAX_OVERLAYS_PER_BAND);
    expect(config.pace).toEqual(['hr', 'cadence']);
  });

  it('drops a self-overlay, yielding an empty array for that band', () => {
    const config = parseOverlayConfig({ pace: ['pace'] });
    expect(config.pace).toEqual([]);
  });

  it('drops unknown channel names without throwing', () => {
    const config = parseOverlayConfig({ pace: ['__proto__', 'bogus'] });
    expect(config.pace).toEqual([]);
  });

  it('returns DEFAULT_OVERLAY_CONFIG semantics for a non-object input, without throwing', () => {
    expect(parseOverlayConfig('nonsense')).toEqual(DEFAULT_OVERLAY_CONFIG);
    expect(parseOverlayConfig(null)).toEqual(DEFAULT_OVERLAY_CONFIG);
    expect(parseOverlayConfig(42)).toEqual(DEFAULT_OVERLAY_CONFIG);
  });

  it('de-duplicates repeated entries', () => {
    const config = parseOverlayConfig({ hr: ['pace', 'pace', 'cadence'] });
    expect(config.hr).toEqual(['pace', 'cadence']);
  });
});

describe('readStoredOverlayConfig', () => {
  it('returns the default when getItem throws', () => {
    const storage = {
      getItem() {
        throw new Error('SecurityError');
      },
    };
    expect(readStoredOverlayConfig(storage)).toEqual(DEFAULT_OVERLAY_CONFIG);
  });

  it('returns the default when getItem returns null', () => {
    const storage = { getItem: () => null };
    expect(readStoredOverlayConfig(storage)).toEqual(DEFAULT_OVERLAY_CONFIG);
  });

  it('returns the default when getItem returns invalid JSON', () => {
    const storage = { getItem: () => '{not valid json' };
    expect(readStoredOverlayConfig(storage)).toEqual(DEFAULT_OVERLAY_CONFIG);
  });

  it('parses and validates a well-formed stored value', () => {
    const storage = { getItem: () => JSON.stringify({ pace: ['hr'] }) };
    expect(readStoredOverlayConfig(storage).pace).toEqual(['hr']);
  });

  it('reads from OVERLAY_STORAGE_KEY', () => {
    const calls: string[] = [];
    const storage = {
      getItem: (key: string) => {
        calls.push(key);
        return null;
      },
    };
    readStoredOverlayConfig(storage);
    expect(calls).toEqual([OVERLAY_STORAGE_KEY]);
  });

  it('returns the default without throwing when storage is null (BL-03)', () => {
    expect(() => readStoredOverlayConfig(null)).not.toThrow();
    expect(readStoredOverlayConfig(null)).toEqual(DEFAULT_OVERLAY_CONFIG);
  });
});

describe('writeStoredOverlayConfig', () => {
  it('swallows a throwing setItem without propagating', () => {
    const storage = {
      setItem() {
        throw new Error('QuotaExceededError');
      },
    };
    expect(() => writeStoredOverlayConfig(storage, DEFAULT_OVERLAY_CONFIG)).not.toThrow();
  });

  it('writes the config as JSON under OVERLAY_STORAGE_KEY', () => {
    const written: Record<string, string> = {};
    const storage = {
      setItem: (key: string, value: string) => {
        written[key] = value;
      },
    };
    writeStoredOverlayConfig(storage, { pace: ['hr'], hr: [], cadence: [], elevation: [] });
    expect(JSON.parse(written[OVERLAY_STORAGE_KEY])).toEqual({
      pace: ['hr'],
      hr: [],
      cadence: [],
      elevation: [],
    });
  });

  it('does not throw and performs no observable work when storage is null (BL-03)', () => {
    expect(() =>
      writeStoredOverlayConfig(null, DEFAULT_OVERLAY_CONFIG)
    ).not.toThrow();
  });
});
