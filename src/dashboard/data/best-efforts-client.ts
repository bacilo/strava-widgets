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
import type {
  ActivityBestEfforts,
  BestEffort,
  EffortContamination,
  EffortDemotion,
  EffortDemotionGuard,
  TargetDistanceKey,
} from '../../analytics/best-effort.types.js';

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

/**
 * Typed by `EffortDemotionGuard` — an omitted member here returns `null` from
 * `parseDemotion` below, so a guard missing from this Set vanishes in the
 * browser with no type error. This is the SECOND of the value's three
 * required homes (Phase 36 D-06); the union itself and the per-guard switch
 * in `records-logic.ts` are the other two, and plan 36-09's lockstep audit
 * enforces all three stay in sync.
 */
const VALID_DEMOTION_GUARDS: ReadonlySet<string> = new Set<EffortDemotionGuard>([
  'world-record',
  'max-speed',
  'ceiling',
  'unreliable-segment',
]);

/**
 * Total, never-throwing parse of one effort's `demotion` field (Phase 28
 * T-28-02-A): a stale shard written before this field existed carries no
 * `demotion` key at all, and a hand-edited one could carry a malformed
 * value. Both degrade to `null` — "not demoted" — rather than a fabricated
 * demotion or a thrown error; `parseEffort` below never treats an absent
 * key as anything other than this same total-parse path.
 */
function parseDemotion(raw: unknown): EffortDemotion | null {
  if (raw === null || raw === undefined) return null;
  if (!isPlainObject(raw)) return null;
  const { guard, reason } = raw;
  if (typeof guard !== 'string' || !VALID_DEMOTION_GUARDS.has(guard)) return null;
  if (typeof reason !== 'string') return null;
  return { guard: guard as EffortDemotionGuard, reason };
}

/**
 * Total, never-throwing parse of one effort's `contaminated` field (Phase 36
 * D-05, mirroring `parseDemotion`'s T-28-02-A discipline exactly): a stale
 * shard written before this field existed carries no `contaminated` key at
 * all, and a hand-edited one could carry a malformed value. Both degrade to
 * `null` rather than a fabricated record or a thrown error. `guard` is
 * checked against the single literal `'unreliable-segment'` directly — NOT
 * `VALID_DEMOTION_GUARDS` — because only this one guard can ever produce a
 * contamination record; consulting the demotion allowlist here would admit a
 * shape no code constructs. The four numeric fields use `Number.isFinite` in
 * addition to `typeof x === 'number'`, deliberately STRONGER than
 * `parseEffort`'s own numeric checks below: these four numbers are rendered
 * beside a ranked figure, and a `NaN` reaching the render path would read as
 * a measurement. This strengthens the NEW field only; it changes nothing
 * about `parseEffort`'s existing checks. Any failure returns `null` — the
 * whole record, never a half-populated object.
 */
function parseContaminated(raw: unknown): EffortContamination | null {
  if (raw === null || raw === undefined) return null;
  if (!isPlainObject(raw)) return null;
  const { guard, reason, durationSec, paceSecPerKm, startOffsetSec, endOffsetSec } = raw;
  if (guard !== 'unreliable-segment') return null;
  if (typeof reason !== 'string') return null;
  if (
    typeof durationSec !== 'number' ||
    !Number.isFinite(durationSec) ||
    typeof paceSecPerKm !== 'number' ||
    !Number.isFinite(paceSecPerKm) ||
    typeof startOffsetSec !== 'number' ||
    !Number.isFinite(startOffsetSec) ||
    typeof endOffsetSec !== 'number' ||
    !Number.isFinite(endOffsetSec)
  ) {
    return null;
  }
  return { guard, reason, durationSec, paceSecPerKm, startOffsetSec, endOffsetSec };
}

/** Total, never-throwing parse of one effort entry. Returns null on any structural failure. */
function parseEffort(raw: unknown): BestEffort | null {
  if (!isPlainObject(raw)) return null;
  const { distance, durationSec, paceSecPerKm, startOffsetSec, endOffsetSec, lowConfidence, wasPRAtTheTime, excludedFromRecords, demotion, contaminated } = raw;
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
    demotion: parseDemotion(demotion),
    contaminated: parseContaminated(contaminated),
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
    // Phase 37 D-07, fail-closed: NaN, Infinity, negative, non-number or absent
    // all become 0, which sorts last in the review queue, so a stale or
    // malformed value can never inflate queue priority.
    contaminatedMetres:
      typeof raw.contaminatedMetres === 'number' &&
      Number.isFinite(raw.contaminatedMetres) &&
      raw.contaminatedMetres >= 0
        ? raw.contaminatedMetres
        : 0,
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
