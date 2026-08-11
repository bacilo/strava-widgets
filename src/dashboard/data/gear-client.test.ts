import { describe, expect, it } from 'vitest';

import type { FetchLike } from './index-client.js';
import { createGearClient, parseGearDocument, resolveGearLabel } from './gear-client.js';

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

describe('resolveGearLabel — resolution ladder', () => {
  it('mapped gear wins over device name', () => {
    expect(resolveGearLabel({ g1: 'Pegasus 40' }, 'g1', 'Forerunner 255')).toBe('Pegasus 40');
  });

  it('unmapped gear id falls through to device name, never leaking the raw id', () => {
    expect(resolveGearLabel({ g1: 'Pegasus 40' }, 'g2', 'Forerunner 255')).toBe('Forerunner 255');
  });

  it('an empty-string mapping is treated exactly as absent', () => {
    expect(resolveGearLabel({ g1: '' }, 'g1', 'Forerunner 255')).toBe('Forerunner 255');
  });

  it('a null gear map (failed load) still allows the device fallback to work', () => {
    expect(resolveGearLabel(null, 'g1', 'Forerunner 255')).toBe('Forerunner 255');
  });

  it('both gear id and device name absent omits the tile (returns null)', () => {
    expect(resolveGearLabel({}, undefined, undefined)).toBeNull();
  });

  it('a blank device name (empty string) never produces an empty-labelled tile', () => {
    expect(resolveGearLabel({}, 'g1', '')).toBeNull();
  });

  it('a whitespace-only device name never produces an empty-labelled tile', () => {
    expect(resolveGearLabel({}, 'g1', '   ')).toBeNull();
  });

  it('non-string inputs never throw and resolve to null', () => {
    expect(resolveGearLabel({ g1: 'X' }, 42 as unknown, 7 as unknown)).toBeNull();
  });

  it('never returns the raw gear id for any input combination', () => {
    const rawGearId = 'g16649854';
    const cases: Array<[Record<string, string> | null, unknown, unknown]> = [
      [{ [rawGearId]: 'Mapped Shoe' }, rawGearId, 'Device'],
      [{}, rawGearId, 'Device'],
      [{}, rawGearId, undefined],
      [null, rawGearId, undefined],
      [{ [rawGearId]: '' }, rawGearId, undefined],
      [{ [rawGearId]: '' }, rawGearId, rawGearId],
    ];
    for (const [gearMap, gearId, deviceName] of cases) {
      const result = resolveGearLabel(gearMap, gearId, deviceName);
      expect(result).not.toBe(rawGearId);
    }
  });
});

describe('parseGearDocument', () => {
  it('returns a plain map for a well-formed document', () => {
    const doc = { schemaVersion: 1, note: 'test', gear: { g1: 'Pegasus 40', g2: 'Vaporfly' } };
    expect(parseGearDocument(doc)).toEqual({ g1: 'Pegasus 40', g2: 'Vaporfly' });
  });

  it('returns null for null', () => {
    expect(parseGearDocument(null)).toBeNull();
  });

  it('returns null for a string', () => {
    expect(parseGearDocument('not an object')).toBeNull();
  });

  it('returns null for a number', () => {
    expect(parseGearDocument(42)).toBeNull();
  });

  it('returns null for an array', () => {
    expect(parseGearDocument([])).toBeNull();
  });

  it('returns null for a missing gear key', () => {
    expect(parseGearDocument({ schemaVersion: 1, note: 'test' })).toBeNull();
  });

  it('returns null when gear is not an object', () => {
    expect(parseGearDocument({ schemaVersion: 1, gear: 'nope' })).toBeNull();
  });

  it('returns null when gear is an array', () => {
    expect(parseGearDocument({ schemaVersion: 1, gear: [] })).toBeNull();
  });

  it('drops individual entries whose value is not a string, keeping the rest', () => {
    const doc = { schemaVersion: 1, gear: { g1: 'Pegasus 40', g2: 42, g3: null, g4: 'Vaporfly' } };
    expect(parseGearDocument(doc)).toEqual({ g1: 'Pegasus 40', g4: 'Vaporfly' });
  });
});

describe('createGearClient — fetch-once and caching', () => {
  it('load() resolves to the map on a 200', async () => {
    const { fetchImpl } = fakeFetch([
      { ok: true, status: 200, statusText: 'OK', body: { schemaVersion: 1, gear: { g1: 'Pegasus 40' } } },
    ]);
    const client = createGearClient({ fetchImpl });
    const map = await client.load();
    expect(map).toEqual({ g1: 'Pegasus 40' });
  });

  it('calls fetchImpl exactly once across three concurrent load() calls', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { ok: true, status: 200, statusText: 'OK', body: { schemaVersion: 1, gear: { g1: 'Pegasus 40' } } },
    ]);
    const client = createGearClient({ fetchImpl });
    await Promise.all([client.load(), client.load(), client.load()]);
    expect(calls.length).toBe(1);
  });

  it('requests baseUrl + config/gear.json, defaulting baseUrl to data/', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { ok: true, status: 200, statusText: 'OK', body: { schemaVersion: 1, gear: {} } },
    ]);
    const client = createGearClient({ fetchImpl });
    await client.load();
    expect(calls[0]).toBe('data/config/gear.json');
  });
});

describe('createGearClient — degrade-to-null failure handling', () => {
  it('load() resolves to null (never rejects) on a 404', async () => {
    const { fetchImpl } = fakeFetch([{ ok: false, status: 404, statusText: 'Not Found' }]);
    const client = createGearClient({ fetchImpl });
    await expect(client.load()).resolves.toBeNull();
  });

  it('load() resolves to null when json() throws (an HTML 404 page served with 200)', async () => {
    const { fetchImpl } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', throwOnJson: true }]);
    const client = createGearClient({ fetchImpl });
    await expect(client.load()).resolves.toBeNull();
  });

  it('load() resolves to null for a well-formed-JSON-but-wrong-shape body', async () => {
    const { fetchImpl } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: { foo: 'bar' } }]);
    const client = createGearClient({ fetchImpl });
    await expect(client.load()).resolves.toBeNull();
  });

  it('after a rejected/failed load, a subsequent load() issues a genuine new fetch', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { ok: false, status: 404, statusText: 'Not Found' },
      { ok: true, status: 200, statusText: 'OK', body: { schemaVersion: 1, gear: { g1: 'Pegasus 40' } } },
    ]);
    const client = createGearClient({ fetchImpl });
    const first = await client.load();
    expect(first).toBeNull();
    const second = await client.load();
    expect(second).toEqual({ g1: 'Pegasus 40' });
    expect(calls.length).toBe(2);
  });
});

describe('createGearClient — reset', () => {
  it('reset() clears the cache so the next load() fetches again', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { ok: true, status: 200, statusText: 'OK', body: { schemaVersion: 1, gear: { g1: 'A' } } },
      { ok: true, status: 200, statusText: 'OK', body: { schemaVersion: 1, gear: { g1: 'B' } } },
    ]);
    const client = createGearClient({ fetchImpl });
    await client.load();
    client.reset();
    await client.load();
    expect(calls.length).toBe(2);
  });
});
