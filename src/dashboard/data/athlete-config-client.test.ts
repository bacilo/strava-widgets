import { describe, expect, it } from 'vitest';

import type { FetchLike } from './index-client.js';
import { createAthleteConfigClient } from './athlete-config-client.js';

/** Minimal fake response shape matching `FetchLike`'s return type. */
interface FakeResponseSpec {
  ok: boolean;
  status: number;
  statusText: string;
  body?: unknown;
  throwOnJson?: boolean;
}

/**
 * Records every requested URL and returns queued fake responses in order.
 * Each `fetchImpl` call shifts the next queued response; calling past the
 * end of the queue throws (a test bug, not production behavior).
 */
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

interface ValidAthleteConfigBody {
  schemaVersion: number;
  note: string;
  maxHr: number;
  hrZones: Array<{ zone: number; minBpm: number; maxBpm: number | null }>;
}

function makeValidAthleteConfigBody(): ValidAthleteConfigBody {
  return {
    schemaVersion: 1,
    note: 'test fixture',
    maxHr: 190,
    hrZones: [
      { zone: 1, minBpm: 95, maxBpm: 123 },
      { zone: 2, minBpm: 124, maxBpm: 142 },
      { zone: 3, minBpm: 143, maxBpm: 161 },
      { zone: 4, minBpm: 162, maxBpm: 180 },
      { zone: 5, minBpm: 181, maxBpm: null },
    ],
  };
}

describe('createAthleteConfigClient — success path', () => {
  it('load() resolves to a validated AthleteConfig for a well-formed 200 body', async () => {
    const { fetchImpl } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: makeValidAthleteConfigBody() }]);
    const client = createAthleteConfigClient({ fetchImpl });
    const config = await client.load();
    expect(config).not.toBeNull();
    expect(config?.maxHr).toBe(190);
    expect(config?.hrZones.length).toBe(5);
  });

  it('requests the exact URL data/config/athlete.json relative to baseUrl', async () => {
    const { fetchImpl, calls } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: makeValidAthleteConfigBody() }]);
    const client = createAthleteConfigClient({ fetchImpl });
    await client.load();
    expect(calls[0]).toBe('data/config/athlete.json');
  });

  it('three concurrent load() calls invoke fetchImpl exactly once', async () => {
    const { fetchImpl, calls } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: makeValidAthleteConfigBody() }]);
    const client = createAthleteConfigClient({ fetchImpl });
    await Promise.all([client.load(), client.load(), client.load()]);
    expect(calls.length).toBe(1);
  });
});

describe('createAthleteConfigClient — degrade-to-null failure handling', () => {
  it('load() resolves to null on a 404', async () => {
    const { fetchImpl } = fakeFetch([{ ok: false, status: 404, statusText: 'Not Found' }]);
    const client = createAthleteConfigClient({ fetchImpl });
    await expect(client.load()).resolves.toBeNull();
  });

  it('load() resolves to null when json() throws (an HTML 404 page served with a 200 status)', async () => {
    const { fetchImpl } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', throwOnJson: true }]);
    const client = createAthleteConfigClient({ fetchImpl });
    await expect(client.load()).resolves.toBeNull();
  });

  it('load() resolves to null for a 200 body that parses but fails parseAthleteConfig (four zones)', async () => {
    const body = { ...makeValidAthleteConfigBody(), hrZones: (makeValidAthleteConfigBody() as { hrZones: unknown[] }).hrZones.slice(0, 4) };
    const { fetchImpl } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body }]);
    const client = createAthleteConfigClient({ fetchImpl });
    await expect(client.load()).resolves.toBeNull();
  });

  it('load() resolves to null for a 200 body with non-ascending zone boundaries', async () => {
    const body = {
      schemaVersion: 1,
      maxHr: 190,
      hrZones: [
        { zone: 1, minBpm: 95, maxBpm: 200 },
        { zone: 2, minBpm: 124, maxBpm: 142 },
        { zone: 3, minBpm: 143, maxBpm: 161 },
        { zone: 4, minBpm: 162, maxBpm: 180 },
        { zone: 5, minBpm: 181, maxBpm: null },
      ],
    };
    const { fetchImpl } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body }]);
    const client = createAthleteConfigClient({ fetchImpl });
    await expect(client.load()).resolves.toBeNull();
  });

  it('load() resolves to null for maxHr: 0', async () => {
    const body = { ...makeValidAthleteConfigBody(), maxHr: 0 };
    const { fetchImpl } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body }]);
    const client = createAthleteConfigClient({ fetchImpl });
    await expect(client.load()).resolves.toBeNull();
  });

  it('load() never rejects for any of the above failure modes', async () => {
    const { fetchImpl } = fakeFetch([{ ok: false, status: 404, statusText: 'Not Found' }]);
    const client = createAthleteConfigClient({ fetchImpl });
    await expect(client.load()).resolves.not.toThrow;
  });

  it('after a failed load, a subsequent load() issues a genuine new fetch', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { ok: false, status: 404, statusText: 'Not Found' },
      { ok: true, status: 200, statusText: 'OK', body: makeValidAthleteConfigBody() },
    ]);
    const client = createAthleteConfigClient({ fetchImpl });
    const first = await client.load();
    expect(first).toBeNull();
    const second = await client.load();
    expect(second).not.toBeNull();
    expect(calls.length).toBe(2);
  });
});

describe('createAthleteConfigClient — reset', () => {
  it('reset() clears the cache so the next load() fetches again', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { ok: true, status: 200, statusText: 'OK', body: makeValidAthleteConfigBody() },
      { ok: true, status: 200, statusText: 'OK', body: makeValidAthleteConfigBody() },
    ]);
    const client = createAthleteConfigClient({ fetchImpl });
    await client.load();
    client.reset();
    await client.load();
    expect(calls.length).toBe(2);
  });
});
