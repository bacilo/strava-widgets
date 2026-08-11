import { describe, expect, it, vi } from 'vitest';

import type { DashboardIndexDocument } from '../../analytics/dashboard-index.types.js';
import { DASHBOARD_INDEX_SCHEMA_VERSION } from '../../analytics/dashboard-index.types.js';
import { createIndexClient } from './index-client.js';
import type { FetchLike } from './index-client.js';

/** Minimal fake response shape matching `FetchLike`'s return type. */
interface FakeResponseSpec {
  ok: boolean;
  status: number;
  statusText: string;
  body: unknown;
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
      json: async () => spec.body,
    };
  };

  return { fetchImpl, calls };
}

function makeDocument(overrides: Partial<DashboardIndexDocument> = {}): DashboardIndexDocument {
  return {
    schemaVersion: DASHBOARD_INDEX_SCHEMA_VERSION,
    generatedAt: '2026-08-10T00:00:00.000Z',
    note: 'test fixture',
    totals: {
      activities: 2,
      withStreams: 2,
      withoutStreams: 0,
      withHr: 2,
      withCadence: 2,
      lowConfidence: 0,
      excludedFromRecords: 0,
      skippedUnreadable: 0,
      withGear: 0,
    },
    activities: [
      {
        id: '3475726256',
        startDate: '2026-01-01T00:00:00Z',
        startDateLocal: '2026-01-01T00:00:00',
        name: 'Morning Run',
        distanceM: 5000,
        movingTimeSec: 1500,
        paceSecPerKm: 300,
        elevationGainM: 50,
        avgHr: 150,
        maxHr: 170,
        avgCadenceRpm: 85,
        location: 'Copenhagen',
        sportType: 'Run',
        streams: { available: true, hr: true, cadence: true, elevation: true },
        lowConfidence: false,
        excludedFromRecords: false,
        prCount: 0,
        gearName: null,
      },
      {
        id: '1234',
        startDate: '2026-01-02T00:00:00Z',
        startDateLocal: '2026-01-02T00:00:00',
        name: 'Evening Run',
        distanceM: 8000,
        movingTimeSec: 2400,
        paceSecPerKm: 300,
        elevationGainM: 20,
        avgHr: 145,
        maxHr: 165,
        avgCadenceRpm: 82,
        location: 'Aarhus',
        sportType: 'Run',
        streams: { available: true, hr: true, cadence: true, elevation: true },
        lowConfidence: false,
        excludedFromRecords: false,
        prCount: 1,
        gearName: null,
      },
    ],
    ...overrides,
  };
}

describe('createIndexClient — construction', () => {
  it('performs zero fetches at construction time', () => {
    const { fetchImpl, calls } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: makeDocument() }]);
    createIndexClient({ fetchImpl });
    expect(calls.length).toBe(0);
  });
});

describe('createIndexClient — fetch-once and caching', () => {
  it('fetches exactly once on the first loadIndex() call, from data/dashboard/index.json', async () => {
    const { fetchImpl, calls } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: makeDocument() }]);
    const client = createIndexClient({ fetchImpl });
    await client.loadIndex();
    expect(calls.length).toBe(1);
    expect(calls[0]).toBe('data/dashboard/index.json');
  });

  it('a second loadIndex() call returns the same document and leaves fetch count at 1', async () => {
    const doc = makeDocument();
    const { fetchImpl, calls } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: doc }]);
    const client = createIndexClient({ fetchImpl });
    const first = await client.loadIndex();
    const second = await client.loadIndex();
    expect(second).toBe(first);
    expect(calls.length).toBe(1);
  });

  it('two concurrent loadIndex() calls produce exactly 1 fetch (in-flight promise memoized)', async () => {
    const { fetchImpl, calls } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: makeDocument() }]);
    const client = createIndexClient({ fetchImpl });
    const [first, second] = await Promise.all([client.loadIndex(), client.loadIndex()]);
    expect(first).toBe(second);
    expect(calls.length).toBe(1);
  });
});

describe('createIndexClient — failure handling', () => {
  it('a non-ok response rejects with a widget-style error message', async () => {
    const { fetchImpl } = fakeFetch([{ ok: false, status: 404, statusText: 'Not Found', body: null }]);
    const client = createIndexClient({ fetchImpl });
    await expect(client.loadIndex()).rejects.toThrow('Failed to fetch data: 404 Not Found');
  });

  it('a failed load does not memoize the failure: a subsequent loadIndex() retries and can succeed', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { ok: false, status: 404, statusText: 'Not Found', body: null },
      { ok: true, status: 200, statusText: 'OK', body: makeDocument() },
    ]);
    const client = createIndexClient({ fetchImpl });
    await expect(client.loadIndex()).rejects.toThrow();
    const doc = await client.loadIndex();
    expect(doc.activities.length).toBe(2);
    expect(calls.length).toBe(2);
  });
});

describe('createIndexClient — row access', () => {
  it('getRows() after a successful load returns the activities array', async () => {
    const { fetchImpl } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: makeDocument() }]);
    const client = createIndexClient({ fetchImpl });
    await client.loadIndex();
    expect(client.getRows().length).toBe(2);
  });

  it("getRow('3475726256') returns the matching row", async () => {
    const { fetchImpl } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: makeDocument() }]);
    const client = createIndexClient({ fetchImpl });
    await client.loadIndex();
    expect(client.getRow('3475726256')?.name).toBe('Morning Run');
  });

  it("getRow('999') returns undefined", async () => {
    const { fetchImpl } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: makeDocument() }]);
    const client = createIndexClient({ fetchImpl });
    await client.loadIndex();
    expect(client.getRow('999')).toBeUndefined();
  });

  it('getRow on a client that has not loaded yet returns undefined rather than throwing', () => {
    const { fetchImpl } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: makeDocument() }]);
    const client = createIndexClient({ fetchImpl });
    expect(() => client.getRow('3475726256')).not.toThrow();
    expect(client.getRow('3475726256')).toBeUndefined();
  });
});

describe('createIndexClient — reset', () => {
  it('reset() clears the cache so the next loadIndex() fetches again', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { ok: true, status: 200, statusText: 'OK', body: makeDocument() },
      { ok: true, status: 200, statusText: 'OK', body: makeDocument() },
    ]);
    const client = createIndexClient({ fetchImpl });
    await client.loadIndex();
    client.reset();
    await client.loadIndex();
    expect(calls.length).toBe(2);
  });
});

describe('createIndexClient — schema version mismatch', () => {
  it('a mismatched schemaVersion still resolves but logs one console.warn naming both versions', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const staleDoc = { ...makeDocument(), schemaVersion: 999 } as unknown as DashboardIndexDocument;
    const { fetchImpl } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: staleDoc }]);
    const client = createIndexClient({ fetchImpl });
    const doc = await client.loadIndex();
    expect(doc.activities.length).toBe(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = warnSpy.mock.calls[0].join(' ');
    expect(message).toContain('999');
    expect(message).toContain(String(DASHBOARD_INDEX_SCHEMA_VERSION));
    warnSpy.mockRestore();
  });
});
