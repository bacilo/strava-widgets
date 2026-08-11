/**
 * Fetch-once-per-id, memoized browser client for one activity's best-efforts
 * entry (18-13, T-18-AVAIL-04). Reads the per-activity shard file
 * `compute-best-efforts.ts` writes alongside the archive-wide document
 * (`<statsDir>/best-efforts/{id}.json`) — the detail view's best-efforts
 * panel and PR badges need exactly one activity's efforts, and must never
 * fetch the multi-MB archive-wide `best-efforts.json` in a browser.
 *
 * Follows `detail-client.ts`'s per-id `Map`-memoization shape for the cache
 * key, and `gear-client.ts`'s degrade-to-null-never-reject contract for a
 * missing/malformed shard (a 404 here is a legitimate degraded state — an
 * activity too short to produce any effort has no shard file at all, or the
 * archive simply predates this feature).
 */

import type { FetchLike } from './index-client.js';
import type { ActivityBestEfforts, BestEffort, TargetDistanceKey } from '../../analytics/best-effort.types.js';

/** Own-property read only — no prototype key is ever reachable through the parsed document. */
function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const VALID_DISTANCES: ReadonlySet<string> = new Set<TargetDistanceKey>([
  '400m',
  '1k',
  '1mi',
  '5k',
  '10k',
  'half',
  'marathon',
]);

/** Total, never-throwing parse of one effort entry. Returns null on any structural failure. */
function parseEffort(raw: unknown): BestEffort | null {
  if (!isPlainObject(raw)) return null;
  const { distance, durationSec, paceSecPerKm, startOffsetSec, endOffsetSec, lowConfidence, wasPRAtTheTime, excludedFromRecords } = raw;
  if (typeof distance !== 'string' || !VALID_DISTANCES.has(distance)) return null;
  if (typeof durationSec !== 'number' || typeof paceSecPerKm !== 'number') return null;
  if (typeof startOffsetSec !== 'number' || typeof endOffsetSec !== 'number') return null;
  if (typeof lowConfidence !== 'boolean' || typeof wasPRAtTheTime !== 'boolean' || typeof excludedFromRecords !== 'boolean') {
    return null;
  }
  return {
    distance: distance as TargetDistanceKey,
    durationSec,
    paceSecPerKm,
    startOffsetSec,
    endOffsetSec,
    lowConfidence,
    wasPRAtTheTime,
    excludedFromRecords,
  };
}

/**
 * Total, never-throwing parse of one `<statsDir>/best-efforts/{id}.json`
 * shard body. Requires a non-array object with a string `activityId` and
 * `startDate`, a `distanceSource`, an `efforts` array, and a boolean
 * `excludedFromRecords`. Individually malformed effort entries are dropped
 * (tolerant, entry-level), never invalidating the whole document. Returns
 * null on any top-level structural failure.
 */
export function parseActivityBestEfforts(raw: unknown): ActivityBestEfforts | null {
  if (!isPlainObject(raw)) return null;
  if (!hasOwn(raw, 'activityId') || typeof raw.activityId !== 'string') return null;
  if (!hasOwn(raw, 'startDate') || typeof raw.startDate !== 'string') return null;
  if (!hasOwn(raw, 'distanceSource') || (raw.distanceSource !== 'native' && raw.distanceSource !== 'geo')) return null;
  if (!hasOwn(raw, 'efforts') || !Array.isArray(raw.efforts)) return null;
  if (!hasOwn(raw, 'excludedFromRecords') || typeof raw.excludedFromRecords !== 'boolean') return null;

  const efforts: BestEffort[] = [];
  for (const item of raw.efforts) {
    const parsed = parseEffort(item);
    if (parsed) efforts.push(parsed);
  }

  return {
    activityId: raw.activityId,
    startDate: raw.startDate,
    distanceSource: raw.distanceSource,
    efforts,
    excludedFromRecords: raw.excludedFromRecords,
  };
}

export interface BestEffortsClientOptions {
  /** Defaults to `'data/'`, relative to the published site root. */
  baseUrl?: string;
  /** Defaults to the global `fetch`, resolved lazily inside the call. */
  fetchImpl?: FetchLike;
}

export interface BestEffortsClient {
  load(activityId: string): Promise<ActivityBestEfforts | null>;
  /** Test-support only: clears the per-id cache so the next `load()` fetches again. */
  reset(): void;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
}

export function createBestEffortsClient(options: BestEffortsClientOptions = {}): BestEffortsClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? 'data/');

  const inFlight = new Map<string, Promise<ActivityBestEfforts | null>>();

  async function fetchActivityBestEfforts(activityId: string): Promise<ActivityBestEfforts | null> {
    try {
      const doFetch = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
      const url = `${baseUrl}stats/best-efforts/${activityId}.json`;
      const response = await doFetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
      }
      const body = await response.json();
      return parseActivityBestEfforts(body);
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  function load(activityId: string): Promise<ActivityBestEfforts | null> {
    const existing = inFlight.get(activityId);
    if (existing) {
      return existing;
    }

    const promise = fetchActivityBestEfforts(activityId).then((result) => {
      // A null result — 404, malformed body, wrong shape — must not be
      // memoized: a subsequent load() for the same id issues a genuine new
      // fetch rather than replaying the cached failure. Only a successful
      // entry is cached for the rest of the page session.
      if (result === null) {
        inFlight.delete(activityId);
      }
      return result;
    });

    inFlight.set(activityId, promise);
    return promise;
  }

  function reset(): void {
    inFlight.clear();
  }

  return { load, reset };
}
