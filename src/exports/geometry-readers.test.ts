import { describe, expect, it } from 'vitest';

import { fitRecordsToSamples, readGpxText, readOriginal } from './geometry-readers.js';

describe('fitRecordsToSamples', () => {
  it('maps a fully-populated record into a RawSample', () => {
    const samples = fitRecordsToSamples([
      {
        timestamp: new Date(1000 * 1000),
        distance: 123.4,
        heartRate: 150,
        cadence: 87,
        fractionalCadence: 0.5,
        enhancedAltitude: 42.1,
        positionLat: 100000000,
        positionLong: 200000000,
      },
    ]);

    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({
      tEpochS: 1000,
      distanceM: 123.4,
      hr: 150,
      cadenceRawRpm: 87,
      fractionalCadence: 0.5,
      altM: 42.1,
    });
    expect(samples[0].lat).toBeCloseTo(100000000 * (180 / 2 ** 31));
    expect(samples[0].lng).toBeCloseTo(200000000 * (180 / 2 ** 31));
  });

  it('prefers enhancedAltitude over altitude when both are present', () => {
    const samples = fitRecordsToSamples([
      { timestamp: new Date(0), enhancedAltitude: 100, altitude: 50 },
    ]);
    expect(samples[0].altM).toBe(100);
  });

  it('falls back to altitude when enhancedAltitude is absent', () => {
    const samples = fitRecordsToSamples([{ timestamp: new Date(0), altitude: 50 }]);
    expect(samples[0].altM).toBe(50);
  });

  it('omits cadenceRawRpm entirely for records with no cadence field', () => {
    const samples = fitRecordsToSamples([{ timestamp: new Date(0), heartRate: 150 }]);
    expect(samples[0].cadenceRawRpm).toBeUndefined();
  });

  it('skips records with no usable timestamp', () => {
    const samples = fitRecordsToSamples([
      { heartRate: 150 },
      { timestamp: 'not-a-date', heartRate: 140 },
      { timestamp: new Date(0), heartRate: 130 },
    ]);
    expect(samples).toHaveLength(1);
    expect(samples[0].hr).toBe(130);
  });

  it('passes cadence through undoubled — the x2 belongs to derive-stream', () => {
    const samples = fitRecordsToSamples([
      { timestamp: new Date(0), cadence: 87, fractionalCadence: 0.5 },
    ]);
    expect(samples).toEqual([{ tEpochS: 0, cadenceRawRpm: 87, fractionalCadence: 0.5 }]);
  });

  it('converts semicircle positions using SEMICIRCLE', () => {
    const samples = fitRecordsToSamples([
      { timestamp: new Date(0), positionLat: 2 ** 31, positionLong: 2 ** 30 },
    ]);
    expect(samples[0].lat).toBeCloseTo(180);
    expect(samples[0].lng).toBeCloseTo(90);
  });

  it('omits distanceM, hr, altM, lat, lng when absent — no default substitution', () => {
    const samples = fitRecordsToSamples([{ timestamp: new Date(0) }]);
    expect(samples[0]).toEqual({ tEpochS: 0 });
  });
});

describe('readGpxText', () => {
  it('extracts lat/lng and tEpochS per trkpt from synthetic GPX text', () => {
    const gpx =
      '<trkpt lat="55.7" lon="12.5"><ele>12.3</ele><time>2020-01-01T10:00:00Z</time></trkpt>' +
      '<trkpt lat="55.71" lon="12.51"><ele>12.5</ele><time>2020-01-01T10:00:01Z</time></trkpt>';
    const result = readGpxText(gpx);

    expect(result.coordinates).toEqual([
      [55.7, 12.5],
      [55.71, 12.51],
    ]);
    expect(result.samples).toHaveLength(2);
    expect(result.samples[0].tEpochS).toBe(Math.floor(Date.UTC(2020, 0, 1, 10, 0, 0) / 1000));
    expect(result.samples[1].tEpochS).toBe(Math.floor(Date.UTC(2020, 0, 1, 10, 0, 1) / 1000));
  });

  it('extracts <ele> into altM when present and omits altM when absent', () => {
    const withEle = readGpxText(
      '<trkpt lat="1" lon="2"><ele>10</ele><time>2020-01-01T00:00:00Z</time></trkpt>'
    );
    expect(withEle.samples[0].altM).toBe(10);

    const withoutEle = readGpxText(
      '<trkpt lat="1" lon="2"><time>2020-01-01T00:00:00Z</time></trkpt>'
    );
    expect(withoutEle.samples[0].altM).toBeUndefined();
  });

  it('yields no distanceM on any sample — archive GPX carries no distance field', () => {
    const result = readGpxText(
      '<trkpt lat="1" lon="2"><time>2020-01-01T00:00:00Z</time></trkpt>'
    );
    expect(result.samples[0].distanceM).toBeUndefined();
  });

  it('returns an empty samples array for text with no trkpt elements rather than throwing', () => {
    expect(() => readGpxText('<gpx></gpx>')).not.toThrow();
    const result = readGpxText('<gpx></gpx>');
    expect(result.coordinates).toEqual([]);
    expect(result.samples).toEqual([]);
  });

  it('returns one sample with lat, lng, altM, and a numeric tEpochS, and distanceM undefined', () => {
    const result = readGpxText(
      '<trkpt lat="55.7" lon="12.5"><ele>12.3</ele><time>2020-01-01T10:00:00Z</time></trkpt>'
    );
    expect(result.samples).toHaveLength(1);
    const [sample] = result.samples;
    expect(sample.lat).toBe(55.7);
    expect(sample.lng).toBe(12.5);
    expect(sample.altM).toBe(12.3);
    expect(typeof sample.tEpochS).toBe('number');
    expect(sample.distanceM).toBeUndefined();
  });

  it('falls back to the first point time plus index in seconds when a point has no <time>', () => {
    const gpx =
      '<trkpt lat="1" lon="1"><time>2020-01-01T00:00:00Z</time></trkpt>' +
      '<trkpt lat="2" lon="2"></trkpt>' +
      '<trkpt lat="3" lon="3"></trkpt>';
    const result = readGpxText(gpx);
    expect(result.samples).toHaveLength(3);
    const base = Math.floor(Date.UTC(2020, 0, 1, 0, 0, 0) / 1000);
    expect(result.samples[0].tEpochS).toBe(base);
    expect(result.samples[1].tEpochS).toBe(base + 1);
    expect(result.samples[2].tEpochS).toBe(base + 2);
  });

  it('handles the self-closing trkpt form', () => {
    const result = readGpxText('<trkpt lat="1" lon="2" />');
    expect(result.coordinates).toEqual([[1, 2]]);
  });
});

describe('readOriginal', () => {
  it('no longer throws "not implemented" for a .gpx.gz path', async () => {
    let message = '';
    try {
      await readOriginal('nonexistent-file-for-error-check.gpx.gz');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toMatch(/not implemented/);
  });
});
