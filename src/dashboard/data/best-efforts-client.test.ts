import { describe, expect, it } from 'vitest';

import type { FetchLike } from './index-client.js';
import { createBestEffortsClient, parseActivityBestEfforts } from './best-efforts-client.js';

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
  startDate: '2026-01-01T00:00:00Z',
  distanceSource: 'native',
  efforts: [
    {
      distance: '5k',
      durationSec: 1200,
      paceSecPerKm: 240,
      startOffsetSec: 0,
      endOffsetSec: 1200,
      lowConfidence: false,
      wasPRAtTheTime: true,
      excludedFromRecords: false,
    },
  ],
  excludedFromRecords: false,
};

describe('parseActivityBestEfforts', () => {
  it('returns the document for a well-formed body', () => {
    expect(parseActivityBestEfforts(validShard)).toEqual(validShard);
  });

  it('returns null for null/array/non-object', () => {
    expect(parseActivityBestEfforts(null)).toBeNull();
    expect(parseActivityBestEfforts([])).toBeNull();
    expect(parseActivityBestEfforts('nope')).toBeNull();
  });

  it('returns null when a required top-level field is missing or wrong-typed', () => {
    expect(parseActivityBestEfforts({ ...validShard, activityId: undefined })).toBeNull();
    expect(parseActivityBestEfforts({ ...validShard, distanceSource: 'gps' })).toBeNull();
    expect(parseActivityBestEfforts({ ...validShard, efforts: 'nope' })).toBeNull();
    expect(parseActivityBestEfforts({ ...validShard, excludedFromRecords: 'false' })).toBeNull();
  });

  it('drops an individually malformed effort entry, keeping the rest', () => {
    const doc = {
      ...validShard,
      efforts: [validShard.efforts[0], { distance: 'not-a-distance', durationSec: 1 }],
    };
    const result = parseActivityBestEfforts(doc);
    expect(result?.efforts.length).toBe(1);
  });
});

describe('createBestEffortsClient — fetch-once-per-id and caching', () => {
  it('load(id) resolves to the parsed entry on a 200', async () => {
    const { fetchImpl } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: validShard }]);
    const client = createBestEffortsClient({ fetchImpl });
    const result = await client.load('a1');
    expect(result).toEqual(validShard);
  });

  it('requests baseUrl + stats/best-efforts/{id}.json, defaulting baseUrl to data/', async () => {
    const { fetchImpl, calls } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: validShard }]);
    const client = createBestEffortsClient({ fetchImpl });
    await client.load('a1');
    expect(calls[0]).toBe('data/stats/best-efforts/a1.json');
  });

  it('calls fetchImpl exactly once across two concurrent load() calls for the SAME id', async () => {
    const { fetchImpl, calls } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: validShard }]);
    const client = createBestEffortsClient({ fetchImpl });
    await Promise.all([client.load('a1'), client.load('a1')]);
    expect(calls.length).toBe(1);
  });

  it('a different id issues its own fetch (no cross-id cache collision)', async () => {
    const other = { ...validShard, activityId: 'a2' };
    const { fetchImpl, calls } = fakeFetch([
      { ok: true, status: 200, statusText: 'OK', body: validShard },
      { ok: true, status: 200, statusText: 'OK', body: other },
    ]);
    const client = createBestEffortsClient({ fetchImpl });
    const first = await client.load('a1');
    const second = await client.load('a2');
    expect(first?.activityId).toBe('a1');
    expect(second?.activityId).toBe('a2');
    expect(calls).toEqual(['data/stats/best-efforts/a1.json', 'data/stats/best-efforts/a2.json']);
  });
});

describe('createBestEffortsClient — degrade-to-null failure handling', () => {
  it('load(id) resolves to null (never rejects) on a 404 — the activity produced no shard', async () => {
    const { fetchImpl } = fakeFetch([{ ok: false, status: 404, statusText: 'Not Found' }]);
    const client = createBestEffortsClient({ fetchImpl });
    await expect(client.load('unknown')).resolves.toBeNull();
  });

  it('load(id) resolves to null when json() throws', async () => {
    const { fetchImpl } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', throwOnJson: true }]);
    const client = createBestEffortsClient({ fetchImpl });
    await expect(client.load('a1')).resolves.toBeNull();
  });

  it('after a failed load, a subsequent load() for the SAME id issues a genuine new fetch', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { ok: false, status: 404, statusText: 'Not Found' },
      { ok: true, status: 200, statusText: 'OK', body: validShard },
    ]);
    const client = createBestEffortsClient({ fetchImpl });
    const first = await client.load('a1');
    expect(first).toBeNull();
    const second = await client.load('a1');
    expect(second).toEqual(validShard);
    expect(calls.length).toBe(2);
  });
});

describe('createBestEffortsClient — reset', () => {
  it('reset() clears the whole per-id cache', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { ok: true, status: 200, statusText: 'OK', body: validShard },
      { ok: true, status: 200, statusText: 'OK', body: validShard },
    ]);
    const client = createBestEffortsClient({ fetchImpl });
    await client.load('a1');
    client.reset();
    await client.load('a1');
    expect(calls.length).toBe(2);
  });
});
