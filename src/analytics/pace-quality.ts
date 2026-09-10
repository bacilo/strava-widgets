/**
 * Per-activity data-quality signals (Phase 27: ERA-01, ERA-02, QUAL-02, PACE-08).
 *
 * Pure, client-safe module — no `fs`, no `fetch`, no DOM. It is imported by
 * both the dashboard render path (browser) and the CI compute chain (Node),
 * mirroring the discipline `pace-derivation.ts:1-29` states for the same
 * reason: this module cannot take a Node-only or browser-only dependency.
 *
 * Total (T-26-01): every exported function accepts any array-shaped or
 * loosely-typed input, including malformed/adversarial data, and returns a
 * not-computable or zeroed result rather than throwing.
 *
 * No `?? 0` / `|| 0` coercion (T-26-02): "insufficient data" is always an
 * explicit not-computable/null result, never a plausible-looking computed
 * zero.
 *
 * D-06 extends T-26-02 to metadata: an activity with no stream (24 of them
 * in the live archive) reports `notComputableReason`, never a zeroed tier
 * that reads as a genuine `'none'`. `notComputableSignals` below is the
 * single constructor for that state — see its own doc comment.
 */

// ---------------------------------------------------------------------------
// Quality tier
// ---------------------------------------------------------------------------

/**
 * Severity tier shared by the three stream-derived tiering signals
 * (decimation, gapProfile, impossibleSamples — D-05).
 *
 * `'not-computable'` is deliberately a FOURTH member of this union rather
 * than modelled as `tier: QualityTier | null`. A nullable tier would let a
 * reader write `tier ?? 'none'` and silently reintroduce exactly the
 * fabricated-zero T-26-02 forbids — a stream-less activity would read as
 * "clean" instead of "unknown". Keeping `'not-computable'` IN the union
 * forces every switch/comparison to handle it explicitly.
 */
export type QualityTier = 'none' | 'minor' | 'severe' | 'not-computable';

// ---------------------------------------------------------------------------
// Device family taxonomy (ERA-01, ERA-02, D-11, D-12)
// ---------------------------------------------------------------------------

/**
 * Family-level device taxonomy (D-11). Exactly seven members — no eighth
 * `bulk-recovery`-style member exists. `'unrecognized-device'` and
 * `'no-device-name'` are two DISTINCT explicit categories (D-12): the
 * former is a non-blank `device_name` absent from the lookup table (keeps
 * the raw string); the latter is the genuine no-device-name cohort
 * (ERA-02). There is exactly one taxonomy name for the unrecognized-device
 * concept across `src/` — the stale `'unknown-device'` annotation
 * previously pinned in `pace-fixtures.ts` was a mislabelled slot for
 * `'no-device-name'`, not a second concept (see `resolveDeviceFamily`'s
 * step-3 comment and Task 2 of this plan).
 */
export type DeviceFamilyKind =
  | 'garmin-fenix-6-pro'
  | 'suunto-9'
  | 'garmin-vivoactive-4'
  | 'strava-app-gpx'
  | 'intervals-icu'
  | 'no-device-name'
  | 'unrecognized-device';

/**
 * Untiered fact (D-13): device era carries no severity — it is a labelled
 * fact, always disclosed, never badged on a list row, contributing nothing
 * to `ActivityQualitySignals.anySevere`.
 */
export interface DeviceEraSignal {
  family: DeviceFamilyKind;
  /**
   * The verbatim, untrimmed-of-meaning `device_name`. Non-null ONLY for
   * `'unrecognized-device'`. This is untrusted athlete/device free text
   * reaching a public GitHub Pages artifact for the first time (D-12) —
   * every DOM consumer MUST use `textContent`, never `innerHTML`, matching
   * the rule `dashboard-index.types.ts`'s header already states for `name`.
   * Stored unescaped at rest deliberately: escaping here would corrupt the
   * datum, escaping belongs at the single DOM boundary (plans 27-07/27-09).
   */
  rawDeviceName: string | null;
}

// ---------------------------------------------------------------------------
// Stream-derived tiering signals
// ---------------------------------------------------------------------------

/** Decimation/aliasing signal — fraction of samples with zero distance advance. */
export interface DecimationSignal {
  tier: QualityTier;
  zeroAdvanceFraction: number | null;
  sampleCount: number | null;
}

/** Non-covered-time signal — recording gaps and pauses over the stream's own span. */
export interface GapProfileSignal {
  tier: QualityTier;
  gapFraction: number | null; // (recordingGapSec + pauseSec) / spanSec
  recordingGapSec: number | null;
  pauseSec: number | null;
  spanSec: number | null;
}

/** Per-sample-pair implausible-speed signal. */
export interface ImpossibleSampleSignal {
  tier: QualityTier;
  count: number | null;
  maxImpliedSpeedMps: number | null;
  /**
   * How many of `count` fall inside a zero-advance run — the per-activity
   * face of the measured decimation/impossible-sample correlation. Never
   * used to reduce `count`; purely additional evidence.
   */
  countInsideZeroAdvanceRun: number | null;
}

// ---------------------------------------------------------------------------
// Untiered facts (D-13, D-14)
// ---------------------------------------------------------------------------

/**
 * Untiered fact (D-14): elapsed-vs-moving divergence carries no severity
 * tier. `ratio` is `elapsed_time / moving_time` — a signal whose high
 * values cannot be separated into "deliberate rest" and "forgotten stop"
 * (PROJECT.md's non-goals) has no defensible severe threshold.
 */
export interface ElapsedVsMovingSignal {
  ratio: number | null; // elapsed_time / moving_time — untiered (D-14)
  elapsedSec: number | null;
  movingSec: number | null;
}

// ---------------------------------------------------------------------------
// Composite
// ---------------------------------------------------------------------------

/** Full per-activity quality signal bundle. */
export interface ActivityQualitySignals {
  decimation: DecimationSignal;
  gapProfile: GapProfileSignal;
  impossibleSamples: ImpossibleSampleSignal;
  deviceEra: DeviceEraSignal;
  elapsedVsMoving: ElapsedVsMovingSignal;
  /**
   * True iff ANY of the three TIERING signals (decimation, gapProfile,
   * impossibleSamples — D-01/D-05/D-16) is `'severe'`. `deviceEra` and
   * `elapsedVsMoving` are untiered facts (D-13/D-14) and contribute
   * NOTHING to this field. This is the SAME composite the calibration
   * report (27-03), the recount script (27-05) and the list filter (27-08)
   * all measure — one definition, three readers.
   */
  anySevere: boolean;
  /**
   * Non-null exactly when the three stream-derived signals could not be
   * computed (D-06) — e.g. no stream committed, or the stream failed
   * `validateStreamSeries`. One of `NOT_COMPUTABLE_NO_STREAM` /
   * `NOT_COMPUTABLE_UNUSABLE_STREAM` (this phase's closed set of reasons).
   */
  notComputableReason: string | null;
}

/**
 * Loosely-typed metadata slice this module reads off `StravaActivity`.
 * `StravaActivity` carries these fields only via its `[key: string]:
 * unknown` index signature, so every field here is `unknown` and is
 * narrowed inside the function that consumes it, never at this boundary.
 */
export interface ActivityQualityMetadata {
  deviceName: unknown;
  sourceProvider: unknown;
  elapsedTimeSec: unknown;
  movingTimeSec: unknown;
}

// ---------------------------------------------------------------------------
// Not-computable reasons — closed set (D-06)
// ---------------------------------------------------------------------------

/** No stream file exists at all for this activity (24 of 1,890 in the live archive). */
export const NOT_COMPUTABLE_NO_STREAM = 'no stream committed for this activity';

/** A stream file exists but failed `validateStreamSeries` (malformed/unusable). */
export const NOT_COMPUTABLE_UNUSABLE_STREAM = 'stream failed validateStreamSeries';
