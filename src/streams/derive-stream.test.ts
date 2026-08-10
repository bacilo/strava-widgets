import { describe, expect, it } from 'vitest';

import { deriveFromIntervalsStreams, deriveFromSamples } from './derive-stream.js';
import type { RawSample } from './stream.types.js';

describe('deriveFromSamples — cadence normalization', () => {
  it('normalizes FIT half-cadence with fractional precision (87 + 0.5 -> 175 spm)', () => {
    const result = deriveFromSamples(
      'x',
      [
        { tEpochS: 0, distanceM: 0, cadenceRawRpm: 87, fractionalCadence: 0.5 },
        { tEpochS: 1, distanceM: 3, cadenceRawRpm: 87, fractionalCadence: 0.5 },
      ],
      'fit'
    );

    expect(result?.cadence?.[0]).toBe(175);
  });

  it('omits the cadence channel when zero samples in the file carry the field (2017 device-generation gap)', () => {
    const samples: RawSample[] = [
      { tEpochS: 0, distanceM: 0, hr: 100 },
      { tEpochS: 1, distanceM: 5, hr: 101 },
    ];
    const result = deriveFromSamples('x', samples, 'fit');

    expect(result?.channels.cadence).toBe(false);
    expect(result && 'cadence' in result).toBe(false);
  });

  it('omits the hr channel identically when no sample carries heart rate (extension-free GPX)', () => {
    const samples: RawSample[] = [
      { tEpochS: 0, distanceM: 0 },
      { tEpochS: 1, distanceM: 5 },
    ];
    const result = deriveFromSamples('x', samples, 'gpx');

    expect(result?.channels.hr).toBe(false);
    expect(result && 'hr' in result).toBe(false);
  });
});

describe('deriveFromSamples — bounds guards', () => {
  it('drops out-of-bounds HR (255, 0), cadence (200) and altitude (60000) sentinels, carrying forward the last valid value', () => {
    const samples: RawSample[] = [
      { tEpochS: 0, distanceM: 0, hr: 60, cadenceRawRpm: 80, altM: 100 },
      { tEpochS: 1, distanceM: 5, hr: 255, cadenceRawRpm: 200, altM: 60000 },
      { tEpochS: 2, distanceM: 10, hr: 0, cadenceRawRpm: 80, altM: 100 },
    ];
    const result = deriveFromSamples('x', samples, 'fit');

    expect(result?.hr).toEqual([60, 60, 60]);
    expect(result?.cadence).toEqual([160, 160, 160]);
    expect(result?.alt).toEqual([100, 100, 100]);
  });
});

describe('deriveFromSamples — distance', () => {
  it('uses native cumulative distance when present and sets distanceSource: native', () => {
    const samples: RawSample[] = [
      { tEpochS: 0, distanceM: 0 },
      { tEpochS: 1, distanceM: 5 },
    ];
    const result = deriveFromSamples('x', samples, 'fit');

    expect(result?.distanceSource).toBe('native');
    expect(result?.d).toEqual([0, 5]);
  });

  it('falls back to cumulative haversine over lat/lng when no distance field exists (the GPX case)', () => {
    const samples: RawSample[] = [
      { tEpochS: 0, lat: 55.0, lng: 12.0 },
      { tEpochS: 1, lat: 55.001, lng: 12.001 },
    ];
    const result = deriveFromSamples('x', samples, 'gpx');

    expect(result?.distanceSource).toBe('geo');
    expect(result?.d[1]).toBeGreaterThan(0);
  });

  it('clamps non-monotonic distance so d is non-decreasing', () => {
    const samples: RawSample[] = [
      { tEpochS: 0, distanceM: 0 },
      { tEpochS: 1, distanceM: 100 },
      { tEpochS: 2, distanceM: 90 },
      { tEpochS: 3, distanceM: 200 },
    ];
    const result = deriveFromSamples('x', samples, 'fit');

    expect(result?.d).toEqual([0, 100, 100, 200]);
  });

  it('returns null when fewer than 2 usable samples exist', () => {
    const result = deriveFromSamples('x', [{ tEpochS: 0, distanceM: 0 }], 'fit');

    expect(result).toBeNull();
  });

  it('returns null when neither a distance field nor lat/lng is available', () => {
    const samples: RawSample[] = [
      { tEpochS: 0, hr: 100 },
      { tEpochS: 1, hr: 101 },
    ];
    const result = deriveFromSamples('x', samples, 'fit');

    expect(result).toBeNull();
  });
});

describe('deriveFromSamples — time', () => {
  it('emits t as integer seconds since the first sample, starting at 0', () => {
    const samples: RawSample[] = [
      { tEpochS: 1000, distanceM: 0 },
      { tEpochS: 1005, distanceM: 5 },
    ];
    const result = deriveFromSamples('x', samples, 'fit');

    expect(result?.t).toEqual([0, 5]);
  });

  it('decimates to a minimum 1s spacing and never exceeds 3000 samples', () => {
    const samples: RawSample[] = [];
    for (let i = 0; i < 4000; i++) {
      samples.push({ tEpochS: i, distanceM: i });
    }
    const result = deriveFromSamples('x', samples, 'fit');

    expect(result).not.toBeNull();
    expect(result!.sampleCount).toBeLessThanOrEqual(3000);
    expect(result!.t.length).toBe(result!.sampleCount);
    expect(result!.t[0]).toBe(0);
    expect(result!.t[result!.t.length - 1]).toBe(3999);
  });
});

describe('deriveFromSamples — no position data', () => {
  it('contains no lat, lng or latlng key in the returned object', () => {
    const samples: RawSample[] = [
      { tEpochS: 0, distanceM: 0 },
      { tEpochS: 1, distanceM: 5 },
    ];
    const result = deriveFromSamples('x', samples, 'fit');

    expect(result && 'lat' in result).toBe(false);
    expect(result && 'lng' in result).toBe(false);
    expect(result && 'latlng' in result).toBe(false);
  });
});

describe('deriveFromIntervalsStreams', () => {
  it('normalizes intervals.icu integer cadence with no fractional component (87 -> 174 spm)', () => {
    const streams = { time: [0, 1], distance: [0, 3], cadence: [87, 87] };
    const result = deriveFromIntervalsStreams('x', streams);

    expect(result?.cadence).toEqual([174, 174]);
  });

  it('treats an intervals.icu cadence 0 as a pause/dropout, never a real 0 spm entry', () => {
    const streams = { time: [0, 1, 2], distance: [0, 3, 6], cadence: [86, 0, 88] };
    const result = deriveFromIntervalsStreams('x', streams);

    expect(result?.cadence).toEqual([172, 172, 176]);
    expect(result?.cadence).not.toContain(0);
  });

  it('falls back to geo distance using the data/data2 latlng quirk when the streams response carries no distance field', () => {
    const streams = {
      time: [0, 1, 2],
      latlng: { data: [55.0, 55.001, 55.002], data2: [12.0, 12.001, 12.002] },
    };
    const result = deriveFromIntervalsStreams('x', streams);

    expect(result?.distanceSource).toBe('geo');
  });
});
