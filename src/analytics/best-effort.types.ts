/**
 * Contracts for the best-effort engine (Phase 15).
 *
 * Two invariants this whole subsystem rests on:
 * - Duration always comes from the stream's `t` array (a fractional crossing
 *   point is computed at the exact target-distance boundary), never from
 *   array-index arithmetic and never snapped to the next sample.
 * - Distance always comes from the stream's `d` array (native or
 *   geo-reconstructed, per `distanceSource`), never recomputed from GPS
 *   coordinates — the committed `CanonicalStream` carries no coordinate data at all.
 */

import type { DistanceSource } from '../streams/stream.types.js';

/** Bump only via an explicit, coordinated recomputation of `data/stats/best-efforts.json`. */
export const BEST_EFFORTS_SCHEMA_VERSION = 1;

/** Bump only via an explicit, coordinated migration of `data/best-effort-exclusions.json`. */
export const BEST_EFFORT_EXCLUSIONS_SCHEMA_VERSION = 1;

/** The seven standard racing distances this engine computes efforts for. */
export type TargetDistanceKey = '400m' | '1k' | '1mi' | '5k' | '10k' | 'half' | 'marathon';

/** Canonical meters for each target distance. */
export const TARGET_METERS: Record<TargetDistanceKey, number> = {
  '400m': 400,
  '1k': 1000,
  '1mi': 1609.344,
  '5k': 5000,
  '10k': 10000,
  half: 21097.5,
  marathon: 42195,
};

/**
 * Ascending distance order. Every emitted `efforts` array is ordered by this
 * constant so downstream consumers never need to re-sort.
 */
export const TARGET_ORDER: readonly TargetDistanceKey[] = [
  '400m',
  '1k',
  '1mi',
  '5k',
  '10k',
  'half',
  'marathon',
];

/**
 * The raw geometric result of the two-pointer sweep, all values in seconds
 * measured from the stream's first sample.
 */
export interface RawEffort {
  durationSec: number;
  /** Always coincides with a real sample. */
  startOffsetSec: number;
  /** Computed at the exact target-distance crossing, therefore fractional. */
  endOffsetSec: number;
}

/**
 * The result of an implausibility check. The `reason` string is user-facing
 * console output and is copied verbatim into the rejection report, so it
 * must name the offending numbers.
 */
export type PlausibilityResult = { ok: true } | { ok: false; reason: string };

/**
 * One plausible effort for one activity, before the archive-wide PR pass
 * has run.
 */
export interface ComputedEffort {
  distance: TargetDistanceKey;
  /** Rounded to 0.1. */
  durationSec: number;
  /** Rounded to 0.1. */
  paceSecPerKm: number;
  startOffsetSec: number;
  /** Rounded to 0.1. */
  endOffsetSec: number;
  /** True exactly when the source stream's `distanceSource` is `'geo'` (D-03). */
  lowConfidence: boolean;
}

/**
 * The same effort after the chronological PR pass. `wasPRAtTheTime` exists
 * so Phase 18's REC-03 (PR evolution) and REC-04 (PR badge) need no
 * recomputation (D-06).
 */
export interface BestEffort extends ComputedEffort {
  wasPRAtTheTime: boolean;
  /** True when this effort matched an entry in the exclusion list — computed but withheld from PR marking/ranking. */
  excludedFromRecords: boolean;
}

/** All best efforts for one activity. */
export interface ActivityBestEfforts {
  activityId: string;
  /** The activity record's ISO `start_date`. */
  startDate: string;
  distanceSource: DistanceSource;
  /** Only computed-and-plausible distances, ordered by `TARGET_ORDER`. */
  efforts: BestEffort[];
  /** True when this activity matched at least one entry in the exclusion list. */
  excludedFromRecords: boolean;
}

/**
 * One user-maintained entry in `data/best-effort-exclusions.json`. `distances:
 * null` excludes every target distance for the activity; a non-empty array
 * narrows the exclusion to those distances only.
 */
export interface BestEffortExclusion {
  activityId: string;
  distances: TargetDistanceKey[] | null;
  reason: string;
}

/** The full contract of the committed, hand-maintained `data/best-effort-exclusions.json`. */
export interface BestEffortExclusionsFile {
  schemaVersion: 1;
  note: string;
  exclusions: BestEffortExclusion[];
}

/** One row in a per-distance top-N PR ranking. `rank` is 1-based. */
export interface PRRankingEntry {
  rank: number;
  activityId: string;
  startDate: string;
  durationSec: number;
  paceSecPerKm: number;
  lowConfidence: boolean;
}

/** One row per dropped effort (D-04). */
export interface RejectedEffort {
  activityId: string;
  distance: TargetDistanceKey;
  reason: string;
}

/** The full output document written to `data/stats/best-efforts.json`. */
export interface BestEffortsDocument {
  schemaVersion: 1;
  generatedAt: string;
  note: string;
  totals: {
    activitiesConsidered: number;
    activitiesWithEfforts: number;
    effortsComputed: number;
    effortsRejected: number;
    /** Efforts computed and retained but withheld from PR marking and ranking. */
    effortsExcluded: number;
    lowConfidenceEfforts: number;
    skippedNoStream: number;
    skippedUnreadable: number;
  };
  rankings: Record<TargetDistanceKey, PRRankingEntry[]>;
  rejected: RejectedEffort[];
  activities: Record<string, ActivityBestEfforts>;
}
