import { describe, expect, it } from 'vitest';

import type { FetchLike } from './index-client.js';
import { createPaceQualityClient, parsePaceQualityShard } from './pace-quality-client.js';

interface FakeResponseSpec {
  ok: boolean;
  status: number;
  statusText: string;
  body?: unknown;
  throwOnJson?: boolean;
}

function fakeFetch(responses: FakeResponseSpec[]): { fetchImpl: FetchLike; calls: string[] } {
  const calls: string[] = [];
  const queue = [...responses];

  const fetchImpl: FetchLike = async (url: string) => {
    calls.push(url);
    const spec = queue.shift();
    if (!spec) {
      throw new Error('fakeFetch: no more queued responses');
    }
    return {
      ok: spec.ok,
      status: spec.status,
      statusText: spec.statusText,
      json: async () => {
        if (spec.throwOnJson) {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        }
        return spec.body;
      },
    };
  };

  return { fetchImpl, calls };
}

const validShard = {
  activityId: 'a1',
  signals: {
    decimation: { tier: 'none', zeroAdvanceFraction: 0.01, sampleCount: 900 },
    gapProfile: { tier: 'none', gapFraction: 0.02, recordingGapSec: 10, pauseSec: 0, spanSec: 500 },
    impossibleSamples: { tier: 'none', count: 0, maxImpliedSpeedMps: null, countInsideZeroAdvanceRun: 0 },
    deviceEra: { family: 'garmin-fenix-6-pro', rawDeviceName: null },
    elapsedVsMoving: { ratio: 1.02, elapsedSec: 510, movingSec: 500 },
    anySevere: false,
    notComputableReason: null,
  },
  gapIntervals: [{ startSec: 100, endSec: 110, kind: 'recording-gap' }],
  impossibleSamples: [],
  impossibleSamplesTruncated: false,
  zeroAdvanceRunProfile: { runCount: 0, longestRunSamples: 0, longestRunSec: 0, medianRunSamples: 0, p90RunSec: 0 },
  adaptiveWindowSec: 20,
  notComputableReason: null,
};

describe('parsePaceQualityShard', () => {
  it('returns the document for a well-formed body', () => {
    expect(parsePaceQualityShard(validShard)).toEqual(validShard);
  });

  it('returns null for null/array/non-object', () => {
    expect(parsePaceQualityShard(null)).toBeNull();
    expect(parsePaceQualityShard([])).toBeNull();
    expect(parsePaceQualityShard('nope')).toBeNull();
  });

  it('returns null when activityId is missing or non-string', () => {
    expect(parsePaceQualityShard({ ...validShard, activityId: undefined })).toBeNull();
    expect(parsePaceQualityShard({ ...validShard, activityId: 42 })).toBeNull();
  });

  it('returns null when signals is missing or not an object', () => {
    expect(parsePaceQualityShard({ ...validShard, signals: undefined })).toBeNull();
    expect(parsePaceQualityShard({ ...validShard, signals: 'nope' })).toBeNull();
  });

  it('a structurally valid shard round-trips activityId and signals', () => {
    const result = parsePaceQualityShard(validShard);
    expect(result?.activityId).toBe('a1');
    expect(result?.signals).toEqual(validShard.signals);
  });

  it('drops an individually malformed impossibleSamples entry, keeping the rest', () => {
    const doc = {
      ...validShard,
      impossibleSamples: [
        { index: 5, impliedSpeedMps: 50, dtSec: 1, ddM: 50 },
        { index: 'not-a-number' },
      ],
    };
    const result = parsePaceQualityShard(doc);
    expect(result?.impossibleSamples.length).toBe(1);
    expect(result?.impossibleSamples[0]).toEqual({ index: 5, impliedSpeedMps: 50, dtSec: 1, ddM: 50 });
  });

  it('drops an individually malformed gapIntervals entry, keeping the rest', () => {
    const doc = {
      ...validShard,
      gapIntervals: [
        { startSec: 0, endSec: 10, kind: 'pause' },
        { startSec: 'nope', endSec: 20, kind: 'pause' },
      ],
    };
    const result = parsePaceQualityShard(doc);
    expect(result?.gapIntervals.length).toBe(1);
    expect(result?.gapIntervals[0]).toEqual({ startSec: 0, endSec: 10, kind: 'pause' });
  });

  it('a shard whose signals is missing one sub-signal parses to a non-null shard with that sub-signal not-computable, not the whole shard invalidated', () => {
    const doc = {
      ...validShard,
      signals: { ...validShard.signals, decimation: undefined },
    };
    const result = parsePaceQualityShard(doc);
    expect(result).not.toBeNull();
    expect(result?.signals.decimation).toEqual({ tier: 'not-computable', zeroAdvanceFraction: null, sampleCount: null });
    expect(result?.signals.gapProfile).toEqual(validShard.signals.gapProfile);
  });

  it('rawDeviceName containing markup survives the parse byte-for-byte unescaped', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const doc = {
      ...validShard,
      signals: {
        ...validShard.signals,
        deviceEra: { family: 'unrecognized-device', rawDeviceName: payload },
      },
    };
    const result = parsePaceQualityShard(doc);
    expect(result?.signals.deviceEra.rawDeviceName).toBe(payload);
  });
});

describe('createPaceQualityClient — fetch count', () => {
  it('constructing the client performs ZERO fetches', () => {
    const { fetchImpl, calls } = fakeFetch([]);
    createPaceQualityClient({ fetchImpl });
    expect(calls.length).toBe(0);
  });

  it('one load("a1") issues exactly one fetch to data/stats/pace-quality/a1.json', async () => {
    const { fetchImpl, calls } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: validShard }]);
    const client = createPaceQualityClient({ fetchImpl });
    await client.load('a1');
    expect(calls.length).toBe(1);
    expect(calls[0]).toBe('data/stats/pace-quality/a1.json');
  });

  it('two concurrent load("a1") calls issue exactly one fetch', async () => {
    const { fetchImpl, calls } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: validShard }]);
    const client = createPaceQualityClient({ fetchImpl });
    await Promise.all([client.load('a1'), client.load('a1')]);
    expect(calls.length).toBe(1);
  });

  it('two sequential load("a1") calls issue exactly one fetch (memoized)', async () => {
    const { fetchImpl, calls } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: validShard }]);
    const client = createPaceQualityClient({ fetchImpl });
    await client.load('a1');
    await client.load('a1');
    expect(calls.length).toBe(1);
  });

  it('load("a1") then load("a2") issues two fetches with both urls in order', async () => {
    const other = { ...validShard, activityId: 'a2' };
    const { fetchImpl, calls } = fakeFetch([
      { ok: true, status: 200, statusText: 'OK', body: validShard },
      { ok: true, status: 200, statusText: 'OK', body: other },
    ]);
    const client = createPaceQualityClient({ fetchImpl });
    const first = await client.load('a1');
    const second = await client.load('a2');
    expect(first?.activityId).toBe('a1');
    expect(second?.activityId).toBe('a2');
    expect(calls).toEqual(['data/stats/pace-quality/a1.json', 'data/stats/pace-quality/a2.json']);
  });

  it('after reset(), a further load("a1") fetches again', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { ok: true, status: 200, statusText: 'OK', body: validShard },
      { ok: true, status: 200, statusText: 'OK', body: validShard },
    ]);
    const client = createPaceQualityClient({ fetchImpl });
    await client.load('a1');
    client.reset();
    await client.load('a1');
    expect(calls.length).toBe(2);
  });

  it('a 404 response resolves null (never rejects) and does not memoize the failure — a second load fetches again', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { ok: false, status: 404, statusText: 'Not Found' },
      { ok: true, status: 200, statusText: 'OK', body: validShard },
    ]);
    const client = createPaceQualityClient({ fetchImpl });
    const first = await client.load('a1');
    expect(first).toBeNull();
    const second = await client.load('a1');
    expect(second).toEqual(validShard);
    expect(calls.length).toBe(2);
  });

  it('a body that throws on .json() resolves null and does not memoize the failure — a second load fetches again', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { ok: true, status: 200, statusText: 'OK', throwOnJson: true },
      { ok: true, status: 200, statusText: 'OK', body: validShard },
    ]);
    const client = createPaceQualityClient({ fetchImpl });
    const first = await client.load('a1');
    expect(first).toBeNull();
    const second = await client.load('a1');
    expect(second).toEqual(validShard);
    expect(calls.length).toBe(2);
  });
});
