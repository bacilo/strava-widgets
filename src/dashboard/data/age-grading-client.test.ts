import { describe, expect, it } from 'vitest';

import type { FetchLike } from './index-client.js';
import { createAgeGradingClient, parseAgeGradingDocument } from './age-grading-client.js';

/** Minimal fake response shape matching `FetchLike`'s return type. */
interface FakeResponseSpec {
  ok: boolean;
  status: number;
  statusText: string;
  body?: unknown;
  throwOnJson?: boolean;
  rejectFetch?: boolean;
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
    if (spec.rejectFetch) {
      throw new Error('network error');
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

const enabledDoc = {
  schemaVersion: 1,
  generatedAt: '2026-08-11T00:00:00Z',
  note: 'test',
  enabled: true,
  disabledReason: null,
  editions: { road: '2025', track: '2023' },
  rankings: {},
  activities: {},
};

const disabledDoc = {
  schemaVersion: 1,
  generatedAt: '2026-08-11T00:00:00Z',
  note: 'test',
  enabled: false,
  disabledReason: 'Missing birthDate/sex in data/config/athlete.json',
  editions: { road: '2025', track: '2023' },
  rankings: {},
  activities: {},
};

describe('parseAgeGradingDocument', () => {
  it('returns the document for a well-formed enabled body', () => {
    expect(parseAgeGradingDocument(enabledDoc)).toEqual(enabledDoc);
  });

  it('returns the document for a well-formed enabled: false body, preserving disabledReason', () => {
    const result = parseAgeGradingDocument(disabledDoc);
    expect(result).not.toBeNull();
    expect(result?.enabled).toBe(false);
    expect(result?.disabledReason).toBe('Missing birthDate/sex in data/config/athlete.json');
  });

  it('returns null for null', () => {
    expect(parseAgeGradingDocument(null)).toBeNull();
  });

  it('returns null for a string', () => {
    expect(parseAgeGradingDocument('not an object')).toBeNull();
  });

  it('returns null for an array', () => {
    expect(parseAgeGradingDocument([])).toBeNull();
  });

  it('returns null when schemaVersion is missing or not a number', () => {
    expect(parseAgeGradingDocument({ ...enabledDoc, schemaVersion: '1' })).toBeNull();
    const { schemaVersion: _drop, ...rest } = enabledDoc;
    expect(parseAgeGradingDocument(rest)).toBeNull();
  });

  it('returns null when enabled is missing or not a boolean', () => {
    expect(parseAgeGradingDocument({ ...enabledDoc, enabled: 'true' })).toBeNull();
  });

  it('returns null when rankings is missing, an array, or not an object', () => {
    expect(parseAgeGradingDocument({ ...enabledDoc, rankings: [] })).toBeNull();
    expect(parseAgeGradingDocument({ ...enabledDoc, rankings: 'nope' })).toBeNull();
  });

  it('returns null when activities is missing, an array, or not an object', () => {
    expect(parseAgeGradingDocument({ ...enabledDoc, activities: [] })).toBeNull();
    expect(parseAgeGradingDocument({ ...enabledDoc, activities: 'nope' })).toBeNull();
  });

  it('a __proto__-keyed activities entry is not reachable as a prototype-polluting key', () => {
    const poisoned = JSON.parse(
      '{"schemaVersion":1,"enabled":true,"disabledReason":null,"rankings":{},"activities":{"__proto__":{"polluted":true}}}'
    );
    const result = parseAgeGradingDocument(poisoned);
    expect(result).not.toBeNull();
    // JSON.parse creates "__proto__" as an own data property, never as the
    // actual prototype — Object.prototype itself must stay clean.
    expect((Object.prototype as unknown as { polluted?: boolean }).polluted).toBeUndefined();
    expect(({} as unknown as { polluted?: boolean }).polluted).toBeUndefined();
  });
});

describe('createAgeGradingClient — fetch-once and caching', () => {
  it('load() resolves to the document on a 200', async () => {
    const { fetchImpl } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: enabledDoc }]);
    const client = createAgeGradingClient({ fetchImpl });
    const doc = await client.load();
    expect(doc).toEqual(enabledDoc);
  });

  it('calls fetchImpl exactly once across three concurrent load() calls', async () => {
    const { fetchImpl, calls } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: enabledDoc }]);
    const client = createAgeGradingClient({ fetchImpl });
    await Promise.all([client.load(), client.load(), client.load()]);
    expect(calls.length).toBe(1);
  });

  it('requests baseUrl + stats/age-grading.json, defaulting baseUrl to data/', async () => {
    const { fetchImpl, calls } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: enabledDoc }]);
    const client = createAgeGradingClient({ fetchImpl });
    await client.load();
    expect(calls[0]).toBe('data/stats/age-grading.json');
  });

  it('a disabled document loads successfully and is memoized like an enabled one', async () => {
    const { fetchImpl, calls } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: disabledDoc }]);
    const client = createAgeGradingClient({ fetchImpl });
    const first = await client.load();
    const second = await client.load();
    expect(first?.enabled).toBe(false);
    expect(second).toBe(first);
    expect(calls.length).toBe(1);
  });
});

describe('createAgeGradingClient — degrade-to-null failure handling', () => {
  it('load() resolves to null (never rejects) on a 404', async () => {
    const { fetchImpl } = fakeFetch([{ ok: false, status: 404, statusText: 'Not Found' }]);
    const client = createAgeGradingClient({ fetchImpl });
    await expect(client.load()).resolves.toBeNull();
  });

  it('load() resolves to null when json() throws (an HTML 404 page served with 200)', async () => {
    const { fetchImpl } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', throwOnJson: true }]);
    const client = createAgeGradingClient({ fetchImpl });
    await expect(client.load()).resolves.toBeNull();
  });

  it('load() resolves to null for a well-formed-JSON-but-wrong-shape body', async () => {
    const { fetchImpl } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: { foo: 'bar' } }]);
    const client = createAgeGradingClient({ fetchImpl });
    await expect(client.load()).resolves.toBeNull();
  });

  it('load() resolves to null (never rejects) when fetchImpl itself rejects', async () => {
    const { fetchImpl } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', rejectFetch: true }]);
    const client = createAgeGradingClient({ fetchImpl });
    await expect(client.load()).resolves.toBeNull();
  });

  it('after a rejected/failed load, a subsequent load() issues a genuine new fetch', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { ok: false, status: 404, statusText: 'Not Found' },
      { ok: true, status: 200, statusText: 'OK', body: enabledDoc },
    ]);
    const client = createAgeGradingClient({ fetchImpl });
    const first = await client.load();
    expect(first).toBeNull();
    const second = await client.load();
    expect(second).toEqual(enabledDoc);
    expect(calls.length).toBe(2);
  });
});

describe('createAgeGradingClient — reset', () => {
  it('reset() clears the cache so the next load() fetches again', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { ok: true, status: 200, statusText: 'OK', body: enabledDoc },
      { ok: true, status: 200, statusText: 'OK', body: disabledDoc },
    ]);
    const client = createAgeGradingClient({ fetchImpl });
    await client.load();
    client.reset();
    await client.load();
    expect(calls.length).toBe(2);
  });
});
