/**
 * Fetch-once-per-id, memoized browser client for one activity's pace-quality
 * evidence shard (Phase 27: QUAL-03, D-17, D-18). Reads the per-activity
 * shard file `compute-dashboard-index.ts` writes alongside the archive-wide
 * `data/dashboard/index.json` (`<statsDir>/pace-quality/{id}.json`) — the
 * detail view's quality section needs exactly one activity's evidence
 * (classified gap intervals, impossible-sample list, zero-advance run
 * profile, adaptive window width, resolved device family), never the whole
 * archive.
 *
 * Structural mirror of `best-efforts-client.ts` (Criterion 2's "mirroring
 * the existing `best-efforts/{id}.json` pattern" clause) — same
 * fetch-once/memoize/degrade-to-null shape, same per-id `Map` cache key,
 * same never-reject contract for a missing/malformed shard. Differs only in
 * the URL path, the parse function's field set, and the exported type
 * names. Constructing this client (or merely having this module in the
 * bundle) issues ZERO fetches — a fetch happens only when `load(activityId)`
 * is called, matching the list view never calling `load` and the detail
 * view calling it exactly once per opened activity (D-18).
 */

import type { FetchLike } from './index-client.js';
import type {
  ActivityQualitySignals,
  DecimationSignal,
  DeviceEraSignal,
  DeviceFamilyKind,
  ElapsedVsMovingSignal,
  GapProfileSignal,
  ImpossibleSampleSignal,
  PaceQualityShard,
  QualityTier,
} from '../../analytics/pace-quality.js';
import type { GapInterval, GapKind } from '../../analytics/pace-derivation.js';

/** Own-property read only — no prototype key is ever reachable through the parsed document. */
function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const VALID_TIERS: ReadonlySet<string> = new Set<QualityTier>(['none', 'minor', 'severe', 'not-computable']);

const VALID_DEVICE_FAMILIES: ReadonlySet<string> = new Set<DeviceFamilyKind>([
  'garmin-fenix-6-pro',
  'suunto-9',
  'garmin-vivoactive-4',
  'strava-app-gpx',
  'intervals-icu',
  'no-device-name',
  'unrecognized-device',
]);

const VALID_GAP_KINDS: ReadonlySet<string> = new Set<GapKind>(['recording-gap', 'pause']);

function parseTier(raw: unknown): QualityTier | null {
  return typeof raw === 'string' && VALID_TIERS.has(raw) ? (raw as QualityTier) : null;
}

function nullableNumber(raw: unknown): number | null {
  return typeof raw === 'number' ? raw : null;
}

/** Total, never-throwing parse of one tiering signal's shared numeric fields. Returns null on structural failure. */
function parseDecimationSignal(raw: unknown): DecimationSignal | null {
  if (!isPlainObject(raw)) return null;
  const tier = parseTier(raw.tier);
  if (tier === null) return null;
  return {
    tier,
    zeroAdvanceFraction: nullableNumber(raw.zeroAdvanceFraction),
    sampleCount: nullableNumber(raw.sampleCount),
  };
}

function parseGapProfileSignal(raw: unknown): GapProfileSignal | null {
  if (!isPlainObject(raw)) return null;
  const tier = parseTier(raw.tier);
  if (tier === null) return null;
  return {
    tier,
    gapFraction: nullableNumber(raw.gapFraction),
    recordingGapSec: nullableNumber(raw.recordingGapSec),
    pauseSec: nullableNumber(raw.pauseSec),
    spanSec: nullableNumber(raw.spanSec),
  };
}

function parseImpossibleSampleSignal(raw: unknown): ImpossibleSampleSignal | null {
  if (!isPlainObject(raw)) return null;
  const tier = parseTier(raw.tier);
  if (tier === null) return null;
  return {
    tier,
    count: nullableNumber(raw.count),
    maxImpliedSpeedMps: nullableNumber(raw.maxImpliedSpeedMps),
    countInsideZeroAdvanceRun: nullableNumber(raw.countInsideZeroAdvanceRun),
  };
}

/**
 * `rawDeviceName` is deliberately passed through UNMODIFIED here — no HTML
 * transform of any kind. It is untrusted athlete/device free text
 * (`pace-quality.ts`'s `DeviceEraSignal` doc comment) that must reach the
 * DOM through `textContent` only (plan 27-09). Transforming it in this
 * client would corrupt it before it ever reaches that single DOM boundary,
 * where the one legitimate transform for on-screen safety belongs, not here.
 */
function parseDeviceEraSignal(raw: unknown): DeviceEraSignal | null {
  if (!isPlainObject(raw)) return null;
  const { family, rawDeviceName } = raw;
  if (typeof family !== 'string' || !VALID_DEVICE_FAMILIES.has(family)) return null;
  if (rawDeviceName !== null && typeof rawDeviceName !== 'string') return null;
  return { family: family as DeviceFamilyKind, rawDeviceName };
}

function parseElapsedVsMovingSignal(raw: unknown): ElapsedVsMovingSignal | null {
  if (!isPlainObject(raw)) return null;
  return {
    ratio: nullableNumber(raw.ratio),
    elapsedSec: nullableNumber(raw.elapsedSec),
    movingSec: nullableNumber(raw.movingSec),
  };
}

/**
 * Total, never-throwing parse of the `ActivityQualitySignals` composite. A
 * shard whose `signals` object is present but missing (or malformed on) one
 * sub-signal parses with that sub-signal `null` rather than returning `null`
 * for the whole shard — the detail view (plan 27-09) then renders "not
 * reported" for that one row rather than losing the whole section. Returns
 * null only when `raw` itself is not a plain object.
 */
function parseActivityQualitySignals(raw: unknown): ActivityQualitySignals | null {
  if (!isPlainObject(raw)) return null;
  return {
    decimation: parseDecimationSignal(raw.decimation) ?? {
      tier: 'not-computable',
      zeroAdvanceFraction: null,
      sampleCount: null,
    },
    gapProfile: parseGapProfileSignal(raw.gapProfile) ?? {
      tier: 'not-computable',
      gapFraction: null,
      recordingGapSec: null,
      pauseSec: null,
      spanSec: null,
    },
    impossibleSamples: parseImpossibleSampleSignal(raw.impossibleSamples) ?? {
      tier: 'not-computable',
      count: null,
      maxImpliedSpeedMps: null,
      countInsideZeroAdvanceRun: null,
    },
    deviceEra: parseDeviceEraSignal(raw.deviceEra) ?? { family: 'no-device-name', rawDeviceName: null },
    elapsedVsMoving: parseElapsedVsMovingSignal(raw.elapsedVsMoving) ?? {
      ratio: null,
      elapsedSec: null,
      movingSec: null,
    },
    anySevere: typeof raw.anySevere === 'boolean' ? raw.anySevere : false,
    notComputableReason: typeof raw.notComputableReason === 'string' ? raw.notComputableReason : null,
  };
}

/** Total, never-throwing parse of one `gapIntervals` entry. Returns null on any structural failure. */
function parseGapInterval(raw: unknown): GapInterval | null {
  if (!isPlainObject(raw)) return null;
  const { startSec, endSec, kind } = raw;
  if (typeof startSec !== 'number' || typeof endSec !== 'number') return null;
  if (typeof kind !== 'string' || !VALID_GAP_KINDS.has(kind)) return null;
  return { startSec, endSec, kind: kind as GapKind };
}

/** Total, never-throwing parse of one `impossibleSamples` entry. Returns null on any structural failure. */
function parseImpossibleSampleEntry(
  raw: unknown
): { index: number; impliedSpeedMps: number; dtSec: number; ddM: number } | null {
  if (!isPlainObject(raw)) return null;
  const { index, impliedSpeedMps, dtSec, ddM } = raw;
  if (typeof index !== 'number' || typeof impliedSpeedMps !== 'number') return null;
  if (typeof dtSec !== 'number' || typeof ddM !== 'number') return null;
  return { index, impliedSpeedMps, dtSec, ddM };
}

function parseZeroAdvanceRunProfile(raw: unknown): PaceQualityShard['zeroAdvanceRunProfile'] {
  if (raw === null) return null;
  if (!isPlainObject(raw)) return null;
  const { runCount, longestRunSamples, longestRunSec, medianRunSamples, p90RunSec } = raw;
  if (typeof runCount !== 'number' || typeof longestRunSamples !== 'number') return null;
  if (typeof longestRunSec !== 'number' || typeof medianRunSamples !== 'number') return null;
  if (typeof p90RunSec !== 'number') return null;
  return { runCount, longestRunSamples, longestRunSec, medianRunSamples, p90RunSec };
}

/**
 * Total, never-throwing parse of one `<statsDir>/pace-quality/{id}.json`
 * shard body. Requires a non-array object with a string `activityId` and a
 * `signals` object — a shard whose `signals` object is present but missing
 * a sub-signal still parses (see `parseActivityQualitySignals`). Individual
 * malformed elements of `gapIntervals` or `impossibleSamples` are dropped
 * (tolerant, entry-level), never invalidating the whole shard. Returns null
 * on any top-level structural failure (missing/non-string `activityId`,
 * missing `signals` object).
 */
export function parsePaceQualityShard(raw: unknown): PaceQualityShard | null {
  if (!isPlainObject(raw)) return null;
  if (!hasOwn(raw, 'activityId') || typeof raw.activityId !== 'string') return null;
  if (!hasOwn(raw, 'signals') || !isPlainObject(raw.signals)) return null;

  const signals = parseActivityQualitySignals(raw.signals);
  if (signals === null) return null;

  const gapIntervals: GapInterval[] = [];
  if (Array.isArray(raw.gapIntervals)) {
    for (const item of raw.gapIntervals) {
      const parsed = parseGapInterval(item);
      if (parsed) gapIntervals.push(parsed);
    }
  }

  const impossibleSamples: { index: number; impliedSpeedMps: number; dtSec: number; ddM: number }[] = [];
  if (Array.isArray(raw.impossibleSamples)) {
    for (const item of raw.impossibleSamples) {
      const parsed = parseImpossibleSampleEntry(item);
      if (parsed) impossibleSamples.push(parsed);
    }
  }

  return {
    activityId: raw.activityId,
    signals,
    gapIntervals,
    impossibleSamples,
    impossibleSamplesTruncated: typeof raw.impossibleSamplesTruncated === 'boolean' ? raw.impossibleSamplesTruncated : false,
    zeroAdvanceRunProfile: parseZeroAdvanceRunProfile(raw.zeroAdvanceRunProfile ?? null),
    adaptiveWindowSec: nullableNumber(raw.adaptiveWindowSec),
    notComputableReason: typeof raw.notComputableReason === 'string' ? raw.notComputableReason : null,
  };
}

export interface PaceQualityClientOptions {
  /** Defaults to `'data/'`, relative to the published site root. */
  baseUrl?: string;
  /** Defaults to the global `fetch`, resolved lazily inside the call. */
  fetchImpl?: FetchLike;
}

export interface PaceQualityClient {
  load(activityId: string): Promise<PaceQualityShard | null>;
  /** Test-support only: clears the per-id cache so the next `load()` fetches again. */
  reset(): void;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
}

export function createPaceQualityClient(options: PaceQualityClientOptions = {}): PaceQualityClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? 'data/');

  const inFlight = new Map<string, Promise<PaceQualityShard | null>>();

  async function fetchPaceQualityShard(activityId: string): Promise<PaceQualityShard | null> {
    try {
      const doFetch = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
      const url = `${baseUrl}stats/pace-quality/${activityId}.json`;
      const response = await doFetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
      }
      const body = await response.json();
      return parsePaceQualityShard(body);
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  function load(activityId: string): Promise<PaceQualityShard | null> {
    const existing = inFlight.get(activityId);
    if (existing) {
      return existing;
    }

    const promise = fetchPaceQualityShard(activityId).then((result) => {
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
