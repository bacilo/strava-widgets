/**
 * Fetch-once, memoized browser client for the committed gear map
 * (`data/config/gear.json`), plus the pure gear/device_name/omit resolution
 * ladder DETAIL-01's Gear tile depends on (17-UI-SPEC.md § 4a).
 *
 * Follows `index-client.ts`'s fetch-once/memoize shape, but changes the
 * caller contract: per D-31/D-33, a missing or malformed config file is a
 * legitimate degraded state, not an error — `load()` resolves to `null`
 * rather than rejecting, mirroring `overview.ts`'s `fetchStatsJson` idiom.
 */

import type { FetchLike } from './index-client.js';

export interface GearMapDocument {
  schemaVersion: number;
  note: string;
  gear: Record<string, string>;
}

/** Own-property read only — no prototype key is ever reachable through the parsed map. */
function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Total, never-throwing parse of the committed `data/config/gear.json` body.
 * Requires a non-array object with an own `gear` property that is itself a
 * non-array object; copies only own string-valued entries into a fresh
 * literal map (tolerant, entry-level — a single malformed entry does not
 * invalidate the rest). Returns null on any structural failure.
 */
export function parseGearDocument(raw: unknown): Record<string, string> | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  if (!hasOwn(obj, 'gear')) return null;
  const rawGear = obj.gear;
  if (typeof rawGear !== 'object' || rawGear === null || Array.isArray(rawGear)) return null;
  const gearObj = rawGear as Record<string, unknown>;

  const map: Record<string, string> = {};
  for (const key of Object.keys(gearObj)) {
    if (!hasOwn(gearObj, key)) continue;
    const value = gearObj[key];
    if (typeof value === 'string') {
      map[key] = value;
    }
  }

  return map;
}

/**
 * Three-step gear resolution ladder (17-UI-SPEC § 4a, most-common-case
 * first): (1) `gearId` maps to a non-empty trimmed name in `gearMap`, return
 * it; (2) otherwise `deviceName` is a non-empty trimmed string, return it
 * (D-33); (3) otherwise return null so the caller omits the tile entirely
 * (D-33: never an empty-labelled tile). Pure, total, never throws. Under no
 * input does this function return the raw `gearId` (D-32).
 */
export function resolveGearLabel(
  gearMap: Record<string, string> | null,
  gearId: unknown,
  deviceName: unknown
): string | null {
  if (gearMap !== null && typeof gearId === 'string' && gearId.length > 0) {
    const mapped = gearMap[gearId];
    if (typeof mapped === 'string' && mapped.trim().length > 0) {
      return mapped;
    }
  }

  if (typeof deviceName === 'string' && deviceName.trim().length > 0) {
    return deviceName;
  }

  return null;
}

export interface GearClientOptions {
  /** Defaults to `'data/'`, relative to the published site root. */
  baseUrl?: string;
  /** Defaults to the global `fetch`, resolved lazily inside the call. */
  fetchImpl?: FetchLike;
}

export interface GearClient {
  load(): Promise<Record<string, string> | null>;
  /** Test-support only: clears the cache so the next `load()` fetches again. */
  reset(): void;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
}

export function createGearClient(options: GearClientOptions = {}): GearClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? 'data/');
  const url = `${baseUrl}config/gear.json`;

  let inFlight: Promise<Record<string, string> | null> | null = null;

  async function fetchGearMap(): Promise<Record<string, string> | null> {
    try {
      const doFetch = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
      const response = await doFetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
      }
      const body = await response.json();
      return parseGearDocument(body);
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  function load(): Promise<Record<string, string> | null> {
    if (inFlight) {
      return inFlight;
    }

    inFlight = fetchGearMap().then((result) => {
      // fetchGearMap never throws (it degrades to null internally), but a
      // null result — 404, malformed body, wrong shape — must not be
      // memoized: the next load() has to issue a genuine new fetch rather
      // than replaying the cached failure. Only a successful map is cached
      // for the rest of the page session.
      if (result === null) {
        inFlight = null;
      }
      return result;
    });

    return inFlight;
  }

  function reset(): void {
    inFlight = null;
  }

  return { load, reset };
}
