import { describe, expect, it } from 'vitest';

import type { FetchLike } from './index-client.js';
import { createDetailClient, InvalidActivityIdError } from './detail-client.js';

interface FakeResponseSpec {
  ok: boolean;
  status: number;
  statusText: string;
  body: unknown;
}

/**
 * Records every requested URL and returns queued fake responses in order.
 * Extracted locally per file (this repo has no test-utils directory and
 * adding one is out of scope for this plan).
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

const fakeActivity = { id: 3475726256, name: 'Morning Run', distance: 5000 };
const fakeStream = { schemaVersion: 1, id: '3475726256', channels: {} };

describe('createDetailClient — construction', () => {
  it('performs zero fetches at construction time', () => {
    const { fetchImpl, calls } = fakeFetch([]);
    createDetailClient({ fetchImpl });
    expect(calls.length).toBe(0);
  });
});

describe('createDetailClient — happy path fetch order and shape', () => {
  it('fetches exactly two URLs in order: activity then stream', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { ok: true, status: 200, statusText: 'OK', body: fakeActivity },
      { ok: true, status: 200, statusText: 'OK', body: fakeStream },
    ]);
    const client = createDetailClient({ fetchImpl });
    await client.loadDetail('3475726256');
    expect(calls).toEqual(['data/activities/3475726256.json', 'data/streams/3475726256.json']);
  });

  it('resolves { id, activity, stream } from parsed JSON', async () => {
    const { fetchImpl } = fakeFetch([
      { ok: true, status: 200, statusText: 'OK', body: fakeActivity },
      { ok: true, status: 200, statusText: 'OK', body: fakeStream },
    ]);
    const client = createDetailClient({ fetchImpl });
    const result = await client.loadDetail('3475726256');
    expect(result.id).toBe('3475726256');
    expect(result.activity).toEqual(fakeActivity);
    expect(result.stream).toEqual(fakeStream);
  });
});

describe('createDetailClient — missing stream tolerance', () => {
  it('a 404 on the stream file resolves with stream: null and a populated activity', async () => {
    const { fetchImpl } = fakeFetch([
      { ok: true, status: 200, statusText: 'OK', body: fakeActivity },
      { ok: false, status: 404, statusText: 'Not Found', body: null },
    ]);
    const client = createDetailClient({ fetchImpl });
    const result = await client.loadDetail('3475726256');
    expect(result.stream).toBeNull();
    expect(result.activity).toEqual(fakeActivity);
  });
});

describe('createDetailClient — activity fetch failure', () => {
  it('a 404 on the activity file rejects with a widget-style error message', async () => {
    const { fetchImpl, calls } = fakeFetch([{ ok: false, status: 404, statusText: 'Not Found', body: null }]);
    const client = createDetailClient({ fetchImpl });
    await expect(client.loadDetail('3475726256')).rejects.toThrow('Failed to fetch data: 404 Not Found');
    // Sequential fetch: a failed activity load must not fire the stream request.
    expect(calls.length).toBe(1);
  });
});

describe('createDetailClient — id validation chokepoint', () => {
  const invalidIds = ['abc', '../../secrets', '12%2F..', '', '<script>'];

  for (const id of invalidIds) {
    it(`loadDetail(${JSON.stringify(id)}) rejects with InvalidActivityIdError and records zero fetches`, async () => {
      const { fetchImpl, calls } = fakeFetch([]);
      const client = createDetailClient({ fetchImpl });
      await expect(client.loadDetail(id)).rejects.toBeInstanceOf(InvalidActivityIdError);
      expect(calls.length).toBe(0);
    });
  }

  it('InvalidActivityIdError is an instanceof Error and exposes the offending id', async () => {
    const { fetchImpl } = fakeFetch([]);
    const client = createDetailClient({ fetchImpl });
    try {
      await client.loadDetail('<script>alert(1)</script>');
      expect.unreachable('loadDetail should have rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(InvalidActivityIdError);
      expect((error as InvalidActivityIdError).activityId).toBe('<script>alert(1)</script>');
    }
  });
});

describe('createDetailClient — per-id memoization', () => {
  it('two concurrent loadDetail calls for the SAME id produce 2 fetches, not 4', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { ok: true, status: 200, statusText: 'OK', body: fakeActivity },
      { ok: true, status: 200, statusText: 'OK', body: fakeStream },
    ]);
    const client = createDetailClient({ fetchImpl });
    const [a, b] = await Promise.all([client.loadDetail('3475726256'), client.loadDetail('3475726256')]);
    expect(calls.length).toBe(2);
    expect(a).toEqual(b);
  });

  it('loadDetail for a different id fetches that id\'s own files (no cross-id cache collision)', async () => {
    const otherActivity = { id: 1234, name: 'Evening Run', distance: 8000 };
    const otherStream = { schemaVersion: 1, id: '1234', channels: {} };
    const { fetchImpl, calls } = fakeFetch([
      { ok: true, status: 200, statusText: 'OK', body: fakeActivity },
      { ok: true, status: 200, statusText: 'OK', body: fakeStream },
      { ok: true, status: 200, statusText: 'OK', body: otherActivity },
      { ok: true, status: 200, statusText: 'OK', body: otherStream },
    ]);
    const client = createDetailClient({ fetchImpl });
    const first = await client.loadDetail('3475726256');
    const second = await client.loadDetail('1234');
    expect(first.id).toBe('3475726256');
    expect(second.id).toBe('1234');
    expect(calls).toEqual([
      'data/activities/3475726256.json',
      'data/streams/3475726256.json',
      'data/activities/1234.json',
      'data/streams/1234.json',
    ]);
  });

  it('a failed loadDetail is retryable (rejected promise evicted from the per-id cache)', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { ok: false, status: 404, statusText: 'Not Found', body: null },
      { ok: true, status: 200, statusText: 'OK', body: fakeActivity },
      { ok: true, status: 200, statusText: 'OK', body: fakeStream },
    ]);
    const client = createDetailClient({ fetchImpl });
    await expect(client.loadDetail('3475726256')).rejects.toThrow();
    const result = await client.loadDetail('3475726256');
    expect(result.activity).toEqual(fakeActivity);
    expect(calls.length).toBe(3);
  });
});

describe('createDetailClient — clear()', () => {
  it('clear() empties the per-id cache', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { ok: true, status: 200, statusText: 'OK', body: fakeActivity },
      { ok: true, status: 200, statusText: 'OK', body: fakeStream },
      { ok: true, status: 200, statusText: 'OK', body: fakeActivity },
      { ok: true, status: 200, statusText: 'OK', body: fakeStream },
    ]);
    const client = createDetailClient({ fetchImpl });
    await client.loadDetail('3475726256');
    client.clear();
    await client.loadDetail('3475726256');
    expect(calls.length).toBe(4);
  });
});
