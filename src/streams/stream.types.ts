/**
 * Locked contracts for the committed per-activity stream store (`data/streams/`).
 *
 * This schema is locked BEFORE the backfill runs (CONTEXT.md D-01) — changing
 * it after ~1,850 files are committed means re-deriving and re-committing all
 * of them. Every write path to `data/streams/` (backfill CLI, daily sync,
 * intervals reconciliation) funnels through `derive-stream.ts`, which produces
 * exactly this shape.
 *
 * Deliberately excluded:
 * - `pace`: fully recoverable as `Δd/Δt` from `t`+`d`; persisting it duplicates
 *   thousands of floats per activity and creates a second place for
 *   normalization bugs to hide (RESEARCH.md Anti-Patterns).
 * - `lat`/`lng`: committed stream files carry no position data at all
 *   (RESEARCH.md Security Domain, Information Disclosure row).
 */

/** Bump only via an explicit, coordinated re-backfill of every committed file. */
export const STREAM_SCHEMA_VERSION = 1;

/** Where a stream's raw samples originated. */
export type StreamSource = 'fit' | 'gpx' | 'intervals';

/**
 * How the committed `d` (distance) array was produced.
 *
 * `'native'` = the source's own cumulative distance field.
 * `'geo'` = recomputed via cumulative haversine over lat/lng because no
 * distance field existed (the 38 archive GPX files). Recorded so Phase 15
 * can distinguish native from recomputed distance rather than silently
 * mixing the two provenances.
 */
export type DistanceSource = 'native' | 'geo';

/**
 * Per-channel availability, computed from ACTUAL per-file field presence —
 * never inferred from source format (RESEARCH.md Pitfall 4: a 2017 FIT file
 * has no cadence field at all, independent of whether the source was FIT or
 * GPX).
 */
export interface StreamChannels {
  time: true;
  distance: boolean;
  hr: boolean;
  cadence: boolean;
  elevation: boolean;
}

/** The canonical, committed shape every producer converges on. */
export interface CanonicalStream {
  schemaVersion: 1;
  id: string;
  source: StreamSource;
  distanceSource: DistanceSource;
  sampleCount: number;
  channels: StreamChannels;
  /** Seconds since the first sample, integer, starting at 0. */
  t: number[];
  /** Cumulative meters, non-decreasing, rounded to 0.1m. */
  d: number[];
  /** Beats per minute, bounds-checked. Omitted entirely when no sample carries it. */
  hr?: number[];
  /** Steps per minute (normalized from raw half-cadence). Omitted entirely when no sample carries it. */
  cadence?: number[];
  /** Meters, rounded to 0.1m, bounds-checked. Omitted entirely when no sample carries it. */
  alt?: number[];
}

/**
 * Source-agnostic per-record input shape. `geometry-readers.ts` produces
 * arrays of these in plan 02 (FIT/GPX); `deriveFromIntervalsStreams` builds
 * them internally from an intervals.icu streams response.
 */
export interface RawSample {
  tEpochS: number;
  distanceM?: number;
  hr?: number;
  /**
   * RAW half-cadence (single-leg rpm) value, deliberately NOT doubled here.
   * Both FIT and intervals.icu report cadence in this raw convention
   * (RESEARCH.md Pitfall 1, empirically confirmed). Doubling to
   * steps-per-minute happens only inside `derive-stream.ts`, per CONTEXT.md's
   * requirement that cadence-unit logic live in exactly one place.
   */
  cadenceRawRpm?: number;
  /** FIT-only 0.5-step precision on top of `cadenceRawRpm`. */
  fractionalCadence?: number;
  altM?: number;
  lat?: number;
  lng?: number;
}

/**
 * Why a stream is unavailable for an activity.
 *
 * - `manual`: user-typed Strava entry, no recording ever existed (23 archive instances).
 * - `no-original`: archive record with no file in `export_data/` and no live source.
 * - `treadmill`: reserved, zero current instances (RESEARCH.md Open Question 2).
 * - `unreadable-original`: the file exists but decode threw.
 * - `no-samples`: the file parsed but yielded no usable time+distance series.
 */
export type StreamUnavailableReason =
  | 'manual'
  | 'no-original'
  | 'treadmill'
  | 'unreadable-original'
  | 'no-samples';

export interface StreamManifestEntryAvailable {
  available: true;
  source: StreamSource;
  distanceSource: DistanceSource;
  sampleCount: number;
  channels: StreamChannels;
}

export interface StreamManifestEntryUnavailable {
  available: false;
  reason: StreamUnavailableReason;
}

export type StreamManifestEntry = StreamManifestEntryAvailable | StreamManifestEntryUnavailable;

/** Single central availability index — `data/streams/manifest.json` (CONTEXT.md D-04). */
export interface StreamManifest {
  schemaVersion: 1;
  generated_at: string;
  note: string;
  totals: {
    activities: number;
    with_streams: number;
    without_streams: number;
    by_reason: Record<string, number>;
  };
  activities: Record<string, StreamManifestEntry>;
}
