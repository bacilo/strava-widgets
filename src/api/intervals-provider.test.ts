import { describe, expect, it } from 'vitest';

import { IntervalsProvider } from './intervals-provider.js';

/**
 * intervals.icu returns no start_latlng and no encoded polyline on the activity
 * summary — both are rebuilt from the latlng stream. The exact stream encoding
 * is not pinned down by the public docs, so extractCoordinates accepts every
 * shape we know of. These cases lock that tolerance in.
 */
describe('IntervalsProvider.extractCoordinates', () => {
  const expected = [
    [55.7, 12.5],
    [55.71, 12.51],
  ];

  it('reads an array of {type, data} stream objects', () => {
    expect(
      IntervalsProvider.extractCoordinates([{ type: 'latlng', data: expected }])
    ).toEqual(expected);
  });

  it('reads {name, values} as an alias for {type, data}', () => {
    expect(
      IntervalsProvider.extractCoordinates([{ name: 'latlng', values: expected }])
    ).toEqual(expected);
  });

  it('reads a keyed object whose series nests under .data', () => {
    expect(
      IntervalsProvider.extractCoordinates({ latlng: { data: expected } })
    ).toEqual(expected);
  });

  it('reads a keyed object holding a bare array', () => {
    expect(IntervalsProvider.extractCoordinates({ latlng: expected })).toEqual(expected);
  });

  it('reads samples encoded as {lat, lng} objects', () => {
    expect(
      IntervalsProvider.extractCoordinates([
        { type: 'latlng', data: [{ lat: 55.7, lng: 12.5 }, { lat: 55.71, lng: 12.51 }] },
      ])
    ).toEqual(expected);
  });

  it('zips parallel lat and lng series', () => {
    expect(
      IntervalsProvider.extractCoordinates([
        { type: 'lat', data: [55.7, 55.71] },
        { type: 'lng', data: [12.5, 12.51] },
      ])
    ).toEqual(expected);
  });

  it('truncates a split series to the shorter of the two', () => {
    expect(
      IntervalsProvider.extractCoordinates([
        { type: 'lat', data: [55.7, 55.71, 55.72] },
        { type: 'lng', data: [12.5] },
      ])
    ).toEqual([[55.7, 12.5]]);
  });

  it('returns nothing for an activity with no GPS', () => {
    expect(
      IntervalsProvider.extractCoordinates([{ type: 'heartrate', data: [140, 141] }])
    ).toEqual([]);
  });

  it('discards malformed samples rather than emitting NaN coordinates', () => {
    expect(
      IntervalsProvider.extractCoordinates([
        { type: 'latlng', data: [[55.7, 12.5], null, ['x', 'y'], [55.71, 12.51]] },
      ])
    ).toEqual(expected);
  });

  it('tolerates junk input', () => {
    expect(IntervalsProvider.extractCoordinates(null)).toEqual([]);
    expect(IntervalsProvider.extractCoordinates(undefined)).toEqual([]);
    expect(IntervalsProvider.extractCoordinates('nope')).toEqual([]);
  });
});

/**
 * The canonical mapping is what keeps analytics, geo and all ten widgets
 * working unchanged across a provider switch.
 */
describe('IntervalsProvider.toCanonical', () => {
  const provider = new IntervalsProvider({} as never);

  // Trimmed from a real payload returned by the live API.
  const raw = {
    id: 'i174109943',
    name: 'Herlev Running',
    type: 'Run',
    start_date: '2026-08-08T05:14:17Z',
    start_date_local: '2026-08-08T07:14:17',
    distance: 23007.32,
    moving_time: 7839,
    elapsed_time: 7945,
    total_elevation_gain: 48.09916,
    average_speed: 2.932,
    max_speed: 3.779,
    average_heartrate: 151,
    max_heartrate: 176,
    strava_id: 9876543210,
  };

  it('maps the fields analytics and geo depend on', () => {
    const activity = provider.toCanonical(raw);

    expect(activity.id).toBe('i174109943');
    expect(activity.name).toBe('Herlev Running');
    expect(activity.type).toBe('Run');
    expect(activity.start_date).toBe('2026-08-08T05:14:17Z');
    expect(activity.distance).toBe(23007.32);
    expect(activity.moving_time).toBe(7839);
    expect(activity.total_elevation_gain).toBe(48.09916);
  });

  it('preserves strava_id as the join key against the archived activities', () => {
    expect(provider.toCanonical(raw).strava_id).toBe(9876543210);
  });

  it('derives average_speed when the provider omits it', () => {
    const { average_speed: _omitted, ...withoutSpeed } = raw;
    const activity = provider.toCanonical(withoutSpeed);

    expect(activity.average_speed).toBeCloseTo(23007.32 / 7839, 6);
  });

  it('leaves the polyline empty for the streams pass to fill', () => {
    expect(provider.toCanonical(raw).map?.summary_polyline).toBe('');
  });

  it('falls back to local time when start_date is absent', () => {
    const { start_date: _omitted, ...localOnly } = raw;

    expect(provider.toCanonical(localOnly).start_date).toBe('2026-08-08T07:14:17');
  });

  it('does not invent values for a sparse payload', () => {
    const activity = provider.toCanonical({ id: 'i1' });

    expect(activity.distance).toBe(0);
    expect(activity.moving_time).toBe(0);
    expect(activity.average_heartrate).toBeUndefined();
  });
});
