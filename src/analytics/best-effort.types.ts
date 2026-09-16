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
 * must name the offending numbers. The failing variant also names WHICH
 * absolute guard fired (Phase 28 D-08) via `guard`, so a single shared
 * demotion path can record the guard without re-matching on `reason`'s
 * prose — coupling the data model to a string would break the moment the
 * wording changed. `guard` is optional on the failing variant rather than
 * required because `validateStreamSeries` also returns this type for
 * malformed-series failures that correspond to no absolute guard at all;
 * `isPlausible`'s two rejection branches always set it. The passing variant
 * deliberately carries no `guard` field; TypeScript narrows the union on
 * `ok`.
 */
export type PlausibilityResult =
  | { ok: true }
  | { ok: false; reason: string; guard?: 'max-speed' | 'world-record' };

/** Which plausibility guard produced a demotion (Phase 28 D-08). `'ceiling'` is the new
 * personal-plausibility-ceiling guard; `'world-record'` and `'max-speed'` are the
 * pre-existing absolute guards, now routed through demotion instead of deletion. */
export type EffortDemotionGuard = 'world-record' | 'max-speed' | 'ceiling';

/**
 * One demoted effort's machine judgment (Phase 28 D-08/D-10): which guard
 * rejected it and why. `reason` follows the house register `isPlausible`
 * already established — a named condition with its measured numbers, never
 * an adjective (Phase 27 D-09).
 */
export interface EffortDemotion {
  guard: EffortDemotionGuard;
  reason: string;
}

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
  /**
   * The MACHINE's judgment that this effort should not rank — distinct from
   * `BestEffort.excludedFromRecords`, the OWNER's stated intent (Phase 28
   * D-10). The two are never collapsed into one field: Phase 29's review
   * queue must be able to tell "you excluded this" from "a guard rejected
   * this", and collapsing them would leave `resolveExcluded`'s
   * live-vs-precomputed contract (Phase 24 WR-05/WR-17) with a second,
   * conflicting meaning. `null` is the correct PERMANENT value for an
   * effort no guard rejected — it is not an unset placeholder waiting to be
   * filled in later. Declared here, on the base type, rather than invented
   * later by a `.map()` onto `BestEffort`, so the field is set exactly once
   * at the point of computation. A demotion can coexist with
   * `excludedFromRecords: true` on `BestEffort` below — the two claims are
   * recorded independently (D-10), neither overwrites the other, and an
   * absolute-guard demotion (world-record/max-speed) always takes
   * precedence over the ceiling: once `demotion` is non-null, no later pass
   * re-evaluates it.
   */
  demotion: EffortDemotion | null;
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
  /**
   * Every computed distance the stream covered, ordered by `TARGET_ORDER` —
   * including demoted efforts (D-08). A demoted effort is retained here,
   * flagged via `demotion`, never removed.
   */
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

/**
 * One target distance's derived personal plausibility ceiling (Phase 28
 * PR-02, D-01, D-02). `ceilingMps: null` paired with a non-null
 * `failOpenReason` is D-02's auditable "no personal ceiling was derivable
 * at this distance" state — below the stated minimum population, no
 * personal ceiling is derived and the distance keeps only the pre-existing
 * world-record and max_speed guards.
 */
export interface CeilingDerivation {
  distance: TargetDistanceKey;
  populationN: number;
  p90Mps: number | null;
  multiplier: number;
  ceilingMps: number | null;
  failOpenReason: string | null;
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
    /**
     * Efforts demoted by any guard (world-record, max-speed or ceiling —
     * Phase 28 D-08), across every distance and regardless of
     * `excludedFromRecords` — an owner-excluded effort that also exceeds
     * its ceiling is counted here too (Phase 28 CR-01). Purely additive:
     * does not require a `BEST_EFFORTS_SCHEMA_VERSION` bump per that
     * constant's own comment, matching Phase 26 D-14's precedent for
     * additive fields.
     */
    effortsDemoted: number;
  };
  rankings: Record<TargetDistanceKey, PRRankingEntry[]>;
  rejected: RejectedEffort[];
  activities: Record<string, ActivityBestEfforts>;
  /**
   * Per-distance ceiling derivation, persisted for audit (Phase 28 D-06):
   * "the ceiling is re-derived on every run, persisted into the output, and
   * any movement is reported." Purely additive, same schema-version
   * reasoning as `totals.effortsDemoted` above.
   */
  ceilings: Record<TargetDistanceKey, CeilingDerivation>;
}

/**
 * The full contract of the committed `data/best-effort-ceiling.json`
 * (Phase 28 D-07): the previous run's derived ceilings, committed so CI has
 * something durable to diff the next run's re-derivation against —
 * `data/stats/` is gitignored and starts empty on every CI run, so there is
 * nowhere else durable to compare against. Mirrors
 * `BestEffortExclusionsFile`'s `schemaVersion` + `note` pair.
 */
export interface BestEffortCeilingStateFile {
  schemaVersion: 1;
  note: string;
  generatedAt: string;
  ceilings: Record<
    TargetDistanceKey,
    { ceilingMps: number | null; p90Mps: number | null; populationN: number }
  >;
}
