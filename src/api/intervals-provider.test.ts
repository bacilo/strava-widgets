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

  // The live API returns latlng as one flat numeric series, not pairs.
  it('pairs a flat interleaved series, as the live API returns it', () => {
    const flat = [55.715, 12.44, 55.716, 12.441, 55.717, 12.442];

    expect(IntervalsProvider.extractCoordinates([{ type: 'latlng', data: flat }])).toEqual([
      [55.715, 12.44],
      [55.716, 12.441],
      [55.717, 12.442],
    ]);
  });

  it('drops a truncated trailing sample from an odd-length flat series', () => {
    const flat = [55.715, 12.44, 55.716, 12.441, 55.717];

    expect(IntervalsProvider.extractCoordinates([{ type: 'latlng', data: flat }])).toEqual([
      [55.715, 12.44],
      [55.716, 12.441],
    ]);
  });

  /**
   * Reproduces the live shape: 'latlng' as concatenated halves, odd length, and
   * a null dropout. An earlier guard demanded every element be numeric, so one
   * null silently disqualified the whole series and the route vanished.
   */
  it('reads concatenated halves containing a dropout', () => {
    const flat = [55.715, 55.716, null, 55.718, 12.44, 12.441, null, 12.443, 0];

    expect(IntervalsProvider.extractCoordinates([{ type: 'latlng', data: flat }])).toEqual([
      [55.715, 12.44],
      [55.716, 12.441],
      [55.718, 12.443],
    ]);
  });

  /**
   * The confirmed live shape: latlng arrives as two parallel arrays on the
   * same stream object — `data` latitudes, `data2` longitudes.
   */
  it('zips data/data2 parallel arrays, as the live API returns them', () => {
    const stream = {
      type: 'latlng',
      data: [55.71525, 55.71525, 55.715305],
      data2: [12.44, 12.4401, 12.4402],
    };

    expect(IntervalsProvider.extractCoordinates([stream])).toEqual([
      [55.71525, 12.44],
      [55.71525, 12.4401],
      [55.715305, 12.4402],
    ]);
  });

  it('keeps data/data2 aligned across dropout nulls', () => {
    const stream = {
      type: 'latlng',
      data: [55.715, null, 55.717],
      data2: [12.44, null, 12.442],
    };

    expect(IntervalsProvider.extractCoordinates([stream])).toEqual([
      [55.715, 12.44],
      [55.717, 12.442],
    ]);
  });

  it('prefers data/data2 over misreading data as a flat series', () => {
    // With data2 present, data alone is only latitudes — the flat-series
    // fallback must not fire on it.
    const lats = [55.715, 55.716, 55.717, 55.718];
    const lngs = [12.44, 12.441, 12.442, 12.443];
    const out = IntervalsProvider.extractCoordinates([{ type: 'latlng', data: lats, data2: lngs }]);

    expect(out).toEqual(lats.map((lat, i) => [lat, lngs[i]]));
  });

  it('rejects out-of-range values in data/data2 pairs', () => {
    const stream = { type: 'latlng', data: [55.715, 999], data2: [12.44, 12.441] };

    expect(IntervalsProvider.extractCoordinates([stream])).toEqual([[55.715, 12.44]]);
  });

  it('ignores a series of nested objects rather than treating it as flat', () => {
    expect(
      IntervalsProvider.extractCoordinates([{ type: 'latlng', data: [{ nope: 1 }, { nope: 2 }] }])
    ).toEqual([]);
  });
});

/**
 * A flat series could be interleaved or two concatenated halves. Latitudes and
 * longitudes each cluster tightly along a real route, so the wrong split is
 * detectable by its much wider spread.
 */
describe('IntervalsProvider.pairFlatSeries', () => {
  const lats = [55.715, 55.716, 55.717, 55.718];
  const lngs = [12.44, 12.441, 12.442, 12.443];
  const expected = lats.map((lat, i) => [lat, lngs[i]]);

  it('detects an interleaved layout', () => {
    const interleaved = lats.flatMap((lat, i) => [lat, lngs[i]]);

    expect(IntervalsProvider.pairFlatSeries(interleaved)).toEqual(expected);
  });

  it('detects a concatenated-halves layout', () => {
    expect(IntervalsProvider.pairFlatSeries([...lats, ...lngs])).toEqual(expected);
  });

  it('rejects samples outside valid coordinate ranges', () => {
    expect(IntervalsProvider.pairFlatSeries([55.7, 12.4, 999, 12.5])).toEqual([[55.7, 12.4]]);
  });

  /**
   * GPS dropouts put nulls in the series. Discarding them before splitting
   * would shift the halves out of alignment and bend the route, so alignment
   * is preserved and incomplete pairs are dropped instead.
   */
  it('keeps halves aligned when a dropout nulls one sample', () => {
    const withGap = [55.715, 55.716, null, 55.718, 12.44, 12.441, null, 12.443];

    expect(IntervalsProvider.pairFlatSeries(withGap)).toEqual([
      [55.715, 12.44],
      [55.716, 12.441],
      [55.718, 12.443],
    ]);
  });

  it('does not slide longitudes onto the wrong latitudes around a dropout', () => {
    // Null only on the latitude side: index 2 must be dropped entirely rather
    // than pulling 55.718 forward onto longitude 12.442.
    const asymmetric = [55.715, 55.716, null, 55.718, 12.44, 12.441, 12.442, 12.443];
    const pairs = IntervalsProvider.pairFlatSeries(asymmetric);

    expect(pairs).toEqual([
      [55.715, 12.44],
      [55.716, 12.441],
      [55.718, 12.443],
    ]);
    expect(pairs).not.toContainEqual([55.718, 12.442]);
  });

  it('still identifies the layout when nulls are present', () => {
    const interleavedWithGap = [55.715, 12.44, null, null, 55.717, 12.442];

    expect(IntervalsProvider.pairFlatSeries(interleavedWithGap)).toEqual([
      [55.715, 12.44],
      [55.717, 12.442],
    ]);
  });
});

/**
 * Mis-paired coordinates still encode into a structurally valid polyline, so
 * "a polyline came back" is not evidence of a correct route. Walking the track
 * and comparing its length to the device's own distance is.
 */
describe('IntervalsProvider.validateGeometry', () => {
  // ~1 km due north from Herlev, sampled every ~100 m.
  const northward: [number, number][] = Array.from(
    { length: 11 },
    (_, i) => [55.715 + i * 0.0009, 12.44]
  );

  it('accepts a track whose length matches the reported distance', () => {
    const result = IntervalsProvider.validateGeometry(northward, 1000);

    expect(result.ok).toBe(true);
    expect(result.ratio).toBeGreaterThan(0.9);
    expect(result.ratio).toBeLessThan(1.1);
  });

  it('rejects a latitude series paired against another latitude series', () => {
    // Both components on the same axis — the failure that reached a false pass.
    const latAgainstLat: [number, number][] = Array.from(
      { length: 11 },
      (_, i) => [55.715 + i * 0.0009, 55.72 + i * 0.0009]
    );

    const result = IntervalsProvider.validateGeometry(latAgainstLat, 1000);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/same axis/);
  });

  it('rejects a track far shorter than the reported distance', () => {
    expect(IntervalsProvider.validateGeometry(northward, 50_000).ok).toBe(false);
  });

  it('rejects a track far longer than the reported distance', () => {
    expect(IntervalsProvider.validateGeometry(northward, 100).ok).toBe(false);
  });

  it('rejects a degenerate track', () => {
    expect(IntervalsProvider.validateGeometry([[55.7, 12.4]], 1000).ok).toBe(false);
  });
});

describe('IntervalsProvider.resolveAxes', () => {
  // An east-west route: at 55.7°N a degree of longitude covers only ~56% of a
  // degree of latitude, so mirroring this one changes its length by ~1.8x. A
  // north-south route has no such asymmetry and survives a swap intact — which
  // is precisely why a passing reading is never overturned.
  const eastWest: [number, number][] = Array.from(
    { length: 11 },
    (_, i) => [55.715, 12.44 + i * 0.002]
  );
  const EAST_WEST_METERS = 1254;

  it('leaves a valid reading untouched', () => {
    const result = IntervalsProvider.resolveAxes(eastWest, EAST_WEST_METERS);

    expect(result.swapped).toBe(false);
    expect(result.coordinates).toEqual(eastWest);
  });

  it('rescues a clearly failing reading by flipping the axes', () => {
    const swapped = eastWest.map(([lat, lng]) => [lng, lat] as [number, number]);
    const result = IntervalsProvider.resolveAxes(swapped, EAST_WEST_METERS);

    expect(result.swapped).toBe(true);
    expect(result.coordinates).toEqual(eastWest);
  });

  it('leaves a north-south route alone, since a swap is undetectable there', () => {
    // Documents the known limit: distance cannot arbitrate this case, so the
    // extracted order stands rather than being guessed at.
    const northSouth: [number, number][] = Array.from(
      { length: 11 },
      (_, i) => [55.715 + i * 0.0009, 12.44]
    );

    expect(IntervalsProvider.resolveAxes(northSouth, 1000).swapped).toBe(false);
  });

  it('does not guess when there is no distance to measure against', () => {
    expect(IntervalsProvider.resolveAxes(eastWest, 0).swapped).toBe(false);
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

/**
 * Confirms the bug this plan corrects: a filtered `getStreams` request
 * discards every non-coordinate channel before the HTTP call is made, so
 * persisting streams from the sync path requires bypassing that narrowing at
 * the request itself, not merely widening the argument. The fake below
 * honors `types` the way the live API does — a fake that ignores it would
 * pass against the broken implementation.
 */
describe('IntervalsProvider.fetchGeometry allChannels', () => {
  // Matches the haversine distance of the five latlng points below almost
  // exactly, so validateGeometry passes without a second (widening) request.
  const EXPECTED_METERS = 510;

  const FULL_STREAMS_PAYLOAD: Record<string, unknown>[] = [
    {
      type: 'latlng',
      data: [55.70, 55.701, 55.702, 55.703, 55.704],
      data2: [12.50, 12.501, 12.502, 12.503, 12.504],
    },
    { type: 'time', data: [0, 10, 20, 30, 40] },
    { type: 'distance', data: [0, 120, 250, 380, 510] },
    { type: 'heartrate', data: [120, 125, 130, 128, 126] },
    { type: 'cadence', data: [80, 82, 81, 83, 80] },
    { type: 'altitude', data: [10, 11, 12, 11, 10] },
  ];

  function makeFakeClient() {
    const getStreamsCalls: string[][] = [];
    const state = { getAllStreamsCalls: 0 };
    const client = {
      async getStreams(_activityId: string, types: string[]) {
        getStreamsCalls.push(types);
        return FULL_STREAMS_PAYLOAD.filter(s => types.includes(s.type as string));
      },
      async getAllStreams(_activityId: string) {
        state.getAllStreamsCalls++;
        return FULL_STREAMS_PAYLOAD;
      },
    };
    return { client, getStreamsCalls, state };
  }

  it('bypasses the coordinate narrowing at the request when allChannels is true', async () => {
    const { client, getStreamsCalls, state } = makeFakeClient();
    const provider = new IntervalsProvider(client as never);

    await provider.fetchGeometry('1', { allChannels: true, expectedMeters: EXPECTED_METERS });

    expect(getStreamsCalls).toEqual([]);
    expect(state.getAllStreamsCalls).toBe(1);
  });

  it('returns raw and rawAll both carrying heartrate and cadence when allChannels is true', async () => {
    const { client } = makeFakeClient();
    const provider = new IntervalsProvider(client as never);

    const geometry = await provider.fetchGeometry('1', {
      allChannels: true,
      expectedMeters: EXPECTED_METERS,
    });

    const rawEntries = geometry.raw as Record<string, unknown>[];
    const rawAllEntries = geometry.rawAll as Record<string, unknown>[];
    expect(rawEntries.some(s => s.type === 'heartrate')).toBe(true);
    expect(rawEntries.some(s => s.type === 'cadence')).toBe(true);
    expect(rawAllEntries.some(s => s.type === 'heartrate')).toBe(true);
    expect(rawAllEntries.some(s => s.type === 'cadence')).toBe(true);
  });

  it('still produces valid geometry when allChannels is true — widening the request did not regress geometry', async () => {
    const { client } = makeFakeClient();
    const provider = new IntervalsProvider(client as never);

    const geometry = await provider.fetchGeometry('1', {
      allChannels: true,
      expectedMeters: EXPECTED_METERS,
    });

    expect(geometry.validation?.ok).toBe(true);
    expect(geometry.summaryPolyline).toBeTruthy();
    expect(geometry.startLatLng).toEqual([55.70, 12.50]);
  });

  it('pins the default path: without allChannels, only coordinate names reach getStreams and getAllStreams is not called when validation passes', async () => {
    const { client, getStreamsCalls, state } = makeFakeClient();
    const provider = new IntervalsProvider(client as never);

    await provider.fetchGeometry('1', {
      streamTypes: ['latlng', 'heartrate', 'cadence'],
      expectedMeters: EXPECTED_METERS,
    });

    expect(getStreamsCalls).toHaveLength(1);
    expect(getStreamsCalls[0]).toEqual(['latlng']);
    expect(state.getAllStreamsCalls).toBe(0);
  });
});
