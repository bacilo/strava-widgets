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

import { adaptiveWindowSec, classifyGapsWithSegments, quantile } from './pace-derivation.js';
import { WORLD_RECORD_100M_SPEED_MPS, validateStreamSeries } from './best-effort-utils.js';
import type { CoveredRun, GapInterval, PaceCoverage, UnreliableSegment, SegmentMechanism } from './pace-derivation.js';
import type { CanonicalStream } from '../streams/stream.types.js';
import {
  classifyForgottenStop,
  classifyPauses,
  classifyPauseSpeed,
  SHIPPED_PAUSE_BANDS,
  SHIPPED_STOP_PARAMS,
} from './pause-classification.js';
import type { ClassifiedPauseInterval, PauseClass, PauseInterval, PauseSource } from './pause-classification.js';

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
 * concept across `src/` — the stale pre-taxonomy "unknown device" annotation
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

/**
 * Non-covered-time signal — recording gaps, pauses AND unreliable time over
 * the stream's own span (widened 2026-09-21, 33-CONTEXT.md D-04). Only
 * `recordingGapSec` and `pauseSec` are echoed separately here —
 * `unreliableSec` is NOT a field on this interface (planner discretion,
 * 33-CONTEXT.md "Claude's Discretion"): the per-kind itemisation lives on
 * `PaceQualityShard.gapIntervals` (kind-tagged, includes `'unreliable'`) and
 * the per-activity unreliable-seconds total is SEG-06's own signal (D-08,
 * plan 33-09). A reader wanting the third term by name should look there,
 * not infer it by subtracting `recordingGapSec + pauseSec` from a
 * `gapFraction * spanSec` product.
 */
export interface GapProfileSignal {
  tier: QualityTier;
  gapFraction: number | null; // (recordingGapSec + pauseSec + unreliableSec) / spanSec (widened 2026-09-21, 33-CONTEXT.md D-04)
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

/**
 * Seventh signal (D-06/D-07/D-08, Phase 33 SEG-06, plan 33-09): the
 * detector's own segments (`detectUnreliableSegments`, reached exclusively
 * through `pace-derivation.ts`'s `classifyGapsWithSegments`), rolled up
 * per activity. `tier` is `'none'` with zero detected segments (a presence
 * fact, D-06's planner decision — never a magnitude judgement), `'minor'`
 * with at least one segment whose `excessFraction` is at or below
 * `UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION`, `'severe'` above it.
 *
 * DELIBERATELY EXCLUDED from `anySevere` (D-06) — see
 * `ActivityQualitySignals.unreliableSegments`'s own doc comment and the
 * `anySevere excludes unreliableSegments` test in `pace-quality.test.ts`.
 *
 * `count`/`totalMetres`/`totalExcessMetres`/`totalSeconds` are exact sums of
 * the detector's own per-segment `metres`/`excessMetres`/`seconds` fields —
 * this signal contains no excess arithmetic of its own (T-33-12b).
 * `excessFraction` is `totalExcessMetres / totalDistanceM` where
 * `totalDistanceM` is the activity's own `d[d.length - 1] - d[0]` (the same
 * denominator `33-CALIBRATION.md`'s own anchor check and archive-wide
 * finding use). `mechanisms` lists each DISTINCT `SegmentMechanism` present,
 * in the type's own fixed declaration order, never Set
 * iteration/insertion order.
 *
 * `not-computable` (T-26-02): every numeric field is `null` and
 * `mechanisms` is `null` — never zeroed — when `validateStreamSeries`
 * fails or `totalDistanceM` is not positive; a zeroed shape here would read
 * as a genuinely clean, zero-segment activity.
 */
export interface UnreliableSegmentsSignal {
  tier: QualityTier;
  count: number | null;
  totalMetres: number | null;
  totalExcessMetres: number | null;
  totalSeconds: number | null;
  excessFraction: number | null;
  mechanisms: SegmentMechanism[] | null;
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
// Pause classification & forgotten-stop signals (Phase 34: PAUSE-02, STOP-01,
// STOP-03, D-09, D-11, D-14) — two more untiered facts, on the
// `ElapsedVsMovingSignal`/`DeviceEraSignal` template.
// ---------------------------------------------------------------------------

/**
 * Ninth signal (PAUSE-02, D-11, D-14): per-class counts of every gap-bearing
 * interval `classifyPauses` (`pause-classification.ts`) classified for this
 * activity, using the shipped bands (`SHIPPED_PAUSE_BANDS`, D-20/D-21).
 * `intervalCount` is the sum of the four class counts. `notClassifiableCount`
 * covers `hidden-pause`/`isolated-jump` segments (D-01) — counted here, never
 * classified, never listed. Covered-creep stretches are NOT counted here —
 * they belong to `ForgottenStopSignal` below (D-09's own itemisation), never
 * double-counted between the two signals FOR THE COVERED-CREEP SOURCE (IN-08,
 * 2026-09-23): zero-advance pauses deliberately appear in BOTH signals —
 * `stationaryCount` here, `pauseCount` there — that overlap is D-09's own
 * itemisation, not a violation of this sentence.
 *
 * UNTIERED BY DESIGN (D-11): no `tier` field at all — not "a tier we chose
 * not to compute", but a field this type structurally does not have. This is
 * exactly why `hasAnySevereSignal`'s three-member `Pick<>` can never widen to
 * include this key: there is no `.tier` to read. See the
 * "anySevere excludes pauseClassification and forgottenStop" guard test in
 * `pace-quality.test.ts`.
 */
export interface PauseClassificationSignal {
  intervalCount: number | null;
  stationaryCount: number | null;
  walkedCount: number | null;
  ranThroughCount: number | null;
  transportedCount: number | null;
  notClassifiableCount: number | null;
}

/**
 * Tenth signal (STOP-01, STOP-03, D-09, D-10, D-11): the forgotten-stop flag,
 * itemised by its two sources (D-09) — `'covered-creep'` stretches inside
 * covered time (`findCreepStretches`) and the existing zero-advance `'pause'`
 * intervals. `count`/`totalSec`/`longestSec` are the COMBINED figures:
 * `count = creepCount + pauseCount`, `totalSec = creepTotalSec +
 * pauseTotalSec` (the two sources are disjoint by construction — creep is
 * covered time, pauses are not), `longestSec = max(creepLongestSec,
 * pauseLongestSec)`. Recording gaps are never counted (D-09 — the timer was
 * not running).
 *
 * `computable` is `false` — with every numeric field `null` — exactly when
 * `classifyForgottenStop`'s D-10 blind-spot signature says so (a
 * distance-triggered stream, or too few signature pairs): a clean
 * `computable: true` result with zero counts always means "looked and found
 * none", never "could not look" (T-26-02). `reason` is non-null exactly when
 * `computable` is `false`, and equals the top-level `notComputableReason` in
 * the whole-signal not-computable state (`notComputableSignals` below).
 *
 * UNTIERED BY DESIGN (D-11), same structural guarantee as
 * `PauseClassificationSignal` above — no `tier` field, so `hasAnySevereSignal`
 * cannot structurally read one. A behavioural fact about the athlete's
 * stream must never mark an activity's DATA "severe" (this file's own threat
 * register, T-34-26). See the
 * "anySevere excludes pauseClassification and forgottenStop" guard test.
 */
export interface ForgottenStopSignal {
  computable: boolean;
  reason: string | null;
  count: number | null;
  totalSec: number | null;
  longestSec: number | null;
  creepCount: number | null;
  creepTotalSec: number | null;
  creepLongestSec: number | null;
  pauseCount: number | null;
  pauseTotalSec: number | null;
  pauseLongestSec: number | null;
}

// ---------------------------------------------------------------------------
// Elevation signal (Phase 30, ELEV-01) — three independent altitude
// detectors: sub-ground-level readings, loop-gated barometric closure
// drift, and implausible vertical rate. See D-05..D-09 in
// 30-elevation-quality-signal/30-CONTEXT.md.
// ---------------------------------------------------------------------------

/**
 * Elevation's own three-member tier union (D-07) — deliberately NOT a reuse
 * of `QualityTier` (a four-member union that includes `'minor'`). D-07
 * rejects a minor band: each of the three thresholds below (-50 m, 60 m,
 * 5 m/s) is already the mechanism's own floor, so a minor band would be
 * three new knobs the requirement never names. Reusing `QualityTier` here
 * would let a future call site assign `'minor'` to `elevation.tier`,
 * silently reintroducing a band this phase explicitly rejected.
 */
export type ElevationTier = 'severe' | 'none' | 'not-computable';

/** Sub-ground-level-reading sub-signal (D-09). */
export interface SubGroundSignal {
  flagged: boolean;
  minAltM: number | null;
}

/**
 * Loop-gated barometric closure-drift sub-signal (D-01/D-02/D-03). Three
 * distinct, DISTINGUISHABLE outcomes — never collapsed into a bare
 * boolean:
 *   - `'not-computable'`: no usable start/end position (D-02) — sub-ground
 *     and vertical-rate still run; this state never falls back to the raw
 *     altitude difference.
 *   - `'clear'` with `deltaM: null`: the endpoints are farther apart than
 *     `loopRadiusM` — excluded BY DESIGN (D-01), not unknown. The measured
 *     `startEndDistM` is retained so the detail line and the calibration
 *     report can quote it.
 *   - `'flagged'` / `'clear'` with a real `deltaM`: a genuine loop whose
 *     signed altitude delta is over/under the threshold.
 */
export interface ClosureDriftSignal {
  state: 'flagged' | 'clear' | 'not-computable';
  /** Signed: alt[end] - alt[start]. The badge shows the absolute value. */
  deltaM: number | null;
  /** Retained on BOTH the loop and the excluded-by-design branches. */
  startEndDistM: number | null;
}

/** Implausible per-sample vertical-rate sub-signal (D-08). */
export interface VerticalRateSignal {
  flagged: boolean;
  worstRateMps: number | null;
  violatingSamples: number | null;
}

/**
 * Full elevation signal (D-07). `tier` is `'severe'` iff ANY of the three
 * sub-signals fires; `'not-computable'` ONLY for the whole-signal
 * stream-less/unusable-stream cohort (the same closed reason set
 * `notComputableSignals` uses) — a drift-only `'not-computable'` does NOT
 * make the rolled-up tier not-computable, since the other two modes still
 * ran (D-02).
 *
 * Deliberately excluded from `hasAnySevereSignal`'s `Pick<>` (D-06) — see
 * that function's own doc comment.
 */
export interface ElevationSignal {
  tier: ElevationTier;
  subGround: SubGroundSignal;
  closureDrift: ClosureDriftSignal;
  verticalRate: VerticalRateSignal;
}

/** Sub-ground threshold (D-09): the requirement's own figure. */
export const SUB_GROUND_MIN_ALT_M = -50;

/** Closure-drift severe threshold (D-09), applied to the ABSOLUTE signed delta. */
export const CLOSURE_DRIFT_SEVERE_DELTA_M = 60;

/** Vertical-rate severe threshold (D-09): the requirement's own figure. */
export const VERTICAL_RATE_SEVERE_MPS = 5;

/**
 * D-03's derived loop radius. The archive's start/end haversine-distance
 * distribution over the 1,658 positioned activities is bimodal with a
 * literal zero-width dead zone: every value sits at exactly 0 m or at
 * >= 552.44 m — nothing falls in (0, 552.4). Any radius in that gap
 * produces an IDENTICAL loop/non-loop partition on this archive; 100 m is
 * chosen for headroom against future archive growth, not because this
 * archive's own boundary is sensitive to the exact value (30-RESEARCH.md
 * § D-03).
 */
export const LOOP_RADIUS_M = 100;

/**
 * Earth radius (metres) and haversine great-circle distance — copied
 * VERBATIM from `src/streams/derive-stream.ts:30,42-50` (kept private
 * there). Importing that module instead of copying would pull
 * `IntervalsProvider`'s Node-only network client into this module's graph,
 * breaking this file's own client-safe contract (see the module header
 * above). A second implementation with a different Earth-radius constant
 * would silently move the loop-radius boundary 30-RESEARCH.md measured —
 * do not reimplement, and do not modify this constant independently of
 * `derive-stream.ts`'s copy.
 */
const EARTH_RADIUS_M = 6371000;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Normalizes a loosely-typed lat/lng pair (D-01/D-02, Pitfall 4). Strava's
 * own "no GPS" convention is an empty array, not a missing key — `[]` is
 * truthy, so a shallow presence check silently produces NaN through the
 * haversine formula. Returns `null` for anything that is not a finite
 * two-element array, matching `geocoder.ts`'s own
 * `!x || x.length !== 2`-style guard, extended with a finiteness check
 * since this module's inputs are `unknown`, not already-typed
 * `number[] | undefined`.
 */
function normalizeLatLng(value: unknown): [number, number] | null {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  ) {
    return [value[0] as number, value[1] as number];
  }
  return null;
}

/**
 * Sub-ground-level-reading detector (D-09, T-26-01/T-26-02 total). Absent,
 * non-array, or empty `alt` returns `{ flagged: false, minAltM: null }` —
 * never a fabricated `0` — driving a not-computable elevation tier at the
 * assembly level (Task 2). Non-finite entries are ignored rather than
 * poisoning the minimum.
 */
export function subGroundSignal(alt: readonly unknown[] | undefined): SubGroundSignal {
  if (!Array.isArray(alt) || alt.length === 0) {
    return { flagged: false, minAltM: null };
  }

  let minAltM: number | null = null;
  for (const value of alt) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (minAltM === null || value < minAltM) minAltM = value;
    }
  }

  if (minAltM === null) {
    return { flagged: false, minAltM: null };
  }

  return { flagged: minAltM < SUB_GROUND_MIN_ALT_M, minAltM };
}

/**
 * Loop-gated barometric closure-drift detector (D-01/D-02/D-03, T-26-01/
 * T-26-02 total). See `ClosureDriftSignal`'s own doc comment for the
 * three-outcome ladder this function implements, in order:
 *   1. Either position unnormalizable -> `'not-computable'`.
 *   2. Distance > `loopRadiusM` -> `'clear'`, excluded by design, distance
 *      retained, `deltaM` never computed (D-02 forbids the raw-difference
 *      fallback here).
 *   3. Otherwise a real loop: `deltaM` is the SIGNED `alt[last] - alt[0]`;
 *      flagged when its absolute value exceeds `CLOSURE_DRIFT_SEVERE_DELTA_M`.
 *      An `alt` array too short or absent returns `'not-computable'` with
 *      the distance retained.
 */
export function closureDriftSignal(
  alt: readonly unknown[] | undefined,
  startLatlng: unknown,
  endLatlng: unknown,
  loopRadiusM: number = LOOP_RADIUS_M
): ClosureDriftSignal {
  const start = normalizeLatLng(startLatlng);
  const end = normalizeLatLng(endLatlng);
  if (start === null || end === null) {
    return { state: 'not-computable', deltaM: null, startEndDistM: null };
  }

  const startEndDistM = haversineMeters(start[0], start[1], end[0], end[1]);

  if (startEndDistM > loopRadiusM) {
    return { state: 'clear', deltaM: null, startEndDistM };
  }

  if (!Array.isArray(alt) || alt.length < 2) {
    return { state: 'not-computable', deltaM: null, startEndDistM };
  }

  const first = alt[0];
  const last = alt[alt.length - 1];
  if (
    typeof first !== 'number' ||
    typeof last !== 'number' ||
    !Number.isFinite(first) ||
    !Number.isFinite(last)
  ) {
    return { state: 'not-computable', deltaM: null, startEndDistM };
  }

  const deltaM = last - first;
  return {
    state: Math.abs(deltaM) > CLOSURE_DRIFT_SEVERE_DELTA_M ? 'flagged' : 'clear',
    deltaM,
    startEndDistM,
  };
}

/**
 * Raw per-sample-pair vertical-rate scanner (D-08) — mirrors
 * `countImpossibleSamples`'s exact shape below: the guard, the linear
 * scan, the `if (!(dtSec > 0)) continue` skip, the capped 100-entry
 * evidence list, and the "count is always full, never the capped list's
 * length" discipline. `d` is replaced by `alt`, and implied speed is
 * replaced by `|alt[i+1] - alt[i]| / (t[i+1] - t[i])`. Does NOT exclude
 * pairs inside a classified gap and does NOT window the rate — D-08/D-09
 * lock the raw per-sample mechanism.
 */
function countVerticalRateSamples(
  t: readonly unknown[],
  alt: readonly unknown[]
): {
  violatingSamples: number;
  worstRateMps: number | null;
  samples: { index: number; rateMps: number; dtSec: number; dAltM: number }[];
} {
  const n = Math.min(t.length, alt.length);
  let violatingSamples = 0;
  let worstRateMps: number | null = null;
  const samples: { index: number; rateMps: number; dtSec: number; dAltM: number }[] = [];

  for (let i = 0; i < n - 1; i++) {
    const t1 = t[i];
    const t2 = t[i + 1];
    const a1 = alt[i];
    const a2 = alt[i + 1];
    if (
      typeof t1 !== 'number' ||
      typeof t2 !== 'number' ||
      typeof a1 !== 'number' ||
      typeof a2 !== 'number' ||
      !Number.isFinite(t1) ||
      !Number.isFinite(t2) ||
      !Number.isFinite(a1) ||
      !Number.isFinite(a2)
    ) {
      continue;
    }

    const dtSec = t2 - t1;
    if (!(dtSec > 0)) continue;

    const dAltM = a2 - a1;
    const rateMps = Math.abs(dAltM) / dtSec;
    if (worstRateMps === null || rateMps > worstRateMps) worstRateMps = rateMps;

    if (rateMps > VERTICAL_RATE_SEVERE_MPS) {
      violatingSamples++;
      if (samples.length < 100) {
        samples.push({ index: i + 1, rateMps, dtSec, dAltM });
      }
    }
  }

  return { violatingSamples, worstRateMps, samples };
}

/**
 * Implausible-vertical-rate tiering signal (D-08/D-09, T-26-01/T-26-02
 * total). Absent/short/non-array `alt` or `t` returns
 * `{ flagged: false, worstRateMps: null, violatingSamples: null }`.
 * `worstRateMps` reports the maximum observed rate even when NOTHING is
 * flagged, so a healthy activity's always-on detail line (D-11) can still
 * print a real number (e.g. "max vertical rate 1.2 m/s").
 */
export function verticalRateSignal(
  t: readonly unknown[] | undefined,
  alt: readonly unknown[] | undefined
): VerticalRateSignal {
  if (!Array.isArray(t) || !Array.isArray(alt) || t.length < 2 || alt.length < 2) {
    return { flagged: false, worstRateMps: null, violatingSamples: null };
  }

  const { violatingSamples, worstRateMps } = countVerticalRateSamples(t, alt);
  if (worstRateMps === null) {
    return { flagged: false, worstRateMps: null, violatingSamples: null };
  }

  return { flagged: violatingSamples > 0, worstRateMps, violatingSamples };
}

/**
 * Assembles the full `ElevationSignal` for one activity (D-05/D-07) by
 * calling the three independent detectors above against the SAME `stream`
 * and `metadata` `computePaceQualitySignals`/`buildPaceQualityShard`
 * already receive — no new parameter, no new read (D-05). `tier` is
 * `'severe'` iff ANY of the three sub-signals fires, `'none'` otherwise.
 *
 * This function is never called for the whole-signal not-computable
 * cohort (no stream / unusable stream) — `notComputableSignals` below
 * constructs that state directly. Per D-02/D-07, a drift-only
 * `'not-computable'` (e.g. no start/end position) does NOT roll up to a
 * not-computable TIER here — the other two modes still ran, and the
 * drift sub-object alone carries its own `'not-computable'` state.
 */
export function elevationSignal(
  stream: Pick<CanonicalStream, 't' | 'alt'>,
  metadata: Pick<ActivityQualityMetadata, 'startLatlng' | 'endLatlng'>
): ElevationSignal {
  const subGround = subGroundSignal(stream.alt);
  const closureDrift = closureDriftSignal(stream.alt, metadata.startLatlng, metadata.endLatlng);
  const verticalRate = verticalRateSignal(stream.t, stream.alt);

  const severe = subGround.flagged || closureDrift.state === 'flagged' || verticalRate.flagged;

  return {
    tier: severe ? 'severe' : 'none',
    subGround,
    closureDrift,
    verticalRate,
  };
}

// ---------------------------------------------------------------------------
// Composite
// ---------------------------------------------------------------------------

/** Full per-activity quality signal bundle. */
export interface ActivityQualitySignals {
  decimation: DecimationSignal;
  gapProfile: GapProfileSignal;
  impossibleSamples: ImpossibleSampleSignal;
  /**
   * Sixth signal (D-05, Phase 30 ELEV-01): altitude-implausibility
   * detection across three independent modes (sub-ground readings,
   * loop-gated closure drift, implausible vertical rate). Tiered (D-07),
   * but DELIBERATELY EXCLUDED from `anySevere` below (D-06) — bad
   * altitude says nothing about pace trust, since no grade-adjusted pace
   * ships this milestone. `hasAnySevereSignal`'s `Pick<>` is NEVER widened
   * to include this key; see that function's own doc comment and the
   * `anySevere excludes elevation` test in `pace-quality.test.ts`.
   */
  elevation: ElevationSignal;
  /**
   * Seventh signal (D-06/D-07/D-08, Phase 33 SEG-06, plan 33-09):
   * unreliable-segment detection rolled up per activity. Tiered
   * (`UnreliableSegmentsSignal.tier`), but DELIBERATELY EXCLUDED from
   * `anySevere` below (D-06) — 699 of 1,874 activities (37.3%,
   * 32-CALIBRATION.md) carry at least one segment, so folding presence
   * into the composite would roughly triple v2.2's figure of record (299
   * of 1,890, 15.8%) and break its comparability across milestones, the
   * exact Phase 30 D-06 elevation precedent restated for a second signal.
   * `hasAnySevereSignal`'s `Pick<>` is NEVER widened to include this key;
   * see that function's own doc comment and the
   * `anySevere excludes unreliableSegments` test in `pace-quality.test.ts`.
   */
  unreliableSegments: UnreliableSegmentsSignal;
  deviceEra: DeviceEraSignal;
  elapsedVsMoving: ElapsedVsMovingSignal;
  /**
   * Ninth signal (Phase 34, PAUSE-02, D-11, D-14): per-class pause-interval
   * counts. UNTIERED — no `tier` field exists on `PauseClassificationSignal`
   * at all, so `hasAnySevereSignal`'s `Pick<>` structurally CANNOT read one.
   * NEVER widen that `Pick<>` to include this key; see the
   * `anySevere excludes pauseClassification and forgottenStop` test in
   * `pace-quality.test.ts`.
   */
  pauseClassification: PauseClassificationSignal;
  /**
   * Tenth signal (Phase 34, STOP-01, STOP-03, D-09, D-11): the itemised
   * forgotten-stop flag. UNTIERED — no `tier` field exists on
   * `ForgottenStopSignal` at all, so `hasAnySevereSignal`'s `Pick<>`
   * structurally CANNOT read one — a behavioural fact about the athlete must
   * never mark the DATA "severe" (STOP-03). NEVER widen that `Pick<>` to
   * include this key; see the
   * `anySevere excludes pauseClassification and forgottenStop` test in
   * `pace-quality.test.ts`.
   */
  forgottenStop: ForgottenStopSignal;
  /**
   * True iff ANY of the three TIERING signals (decimation, gapProfile,
   * impossibleSamples — D-01/D-05/D-16) is `'severe'`. `deviceEra`,
   * `elapsedVsMoving` and `elevation` are all excluded from this field —
   * the first two as untiered facts (D-13/D-14), `elevation` as a
   * DELIBERATE exclusion of a tiered signal (Phase 30 D-06).
   * `unreliableSegments` is excluded the same deliberate way (Phase 33
   * D-06, see that field's own doc comment above). `pauseClassification`
   * and `forgottenStop` are excluded the same deliberate way (Phase 34
   * D-11, see each field's own doc comment above). This is the SAME
   * composite the calibration report (27-03), the recount script (27-05)
   * and the list filter (27-08) all measure — one definition, three
   * readers.
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
  /**
   * `activity.start_latlng` / `activity.end_latlng` (Phase 30 D-01) —
   * `unknown`, narrowed inside `closureDriftSignal`'s own
   * `normalizeLatLng` guard, matching this interface's existing
   * loosely-typed-slice convention. Strava's own "no GPS" convention is
   * an empty array, not a missing key (Pitfall 4).
   */
  startLatlng: unknown;
  endLatlng: unknown;
}

// ---------------------------------------------------------------------------
// Not-computable reasons — closed set (D-06)
// ---------------------------------------------------------------------------

/** No stream file exists at all for this activity (24 of 1,890 in the live archive). */
export const NOT_COMPUTABLE_NO_STREAM = 'no stream committed for this activity';

/** A stream file exists but failed `validateStreamSeries` (malformed/unusable). */
export const NOT_COMPUTABLE_UNUSABLE_STREAM = 'stream failed validateStreamSeries';

// ---------------------------------------------------------------------------
// Device family resolution (ERA-01, ERA-02, D-12)
// ---------------------------------------------------------------------------

/**
 * Exact `device_name` strings this archive carries, mapped to their family.
 * Keys carry the archive's exact Unicode (`fēnix` with U+0113, `vívoactive`
 * with U+00ED) and are matched against the TRIMMED raw string exactly —
 * never case-folded, never normalized — so a genuinely different string is
 * surfaced as `'unrecognized-device'` rather than silently absorbed into a
 * near-miss known family.
 */
export const KNOWN_DEVICE_FAMILIES: Readonly<Record<string, DeviceFamilyKind>> = {
  'Garmin fēnix 6 Pro': 'garmin-fenix-6-pro',
  'Suunto 9': 'suunto-9',
  'Garmin vívoactive 4': 'garmin-vivoactive-4',
  'Strava App': 'strava-app-gpx',
};

/**
 * Resolves an activity's device family from its `device_name` and
 * `source_provider` metadata (ERA-01, ERA-02, D-12). Total: any shape of
 * input returns a valid `DeviceEraSignal`, never throws.
 *
 * Three-outcome ladder (D-12), evaluated in order:
 *   1. `deviceName` is a string whose `.trim()` is non-empty — look it up
 *      in `KNOWN_DEVICE_FAMILIES`. A hit returns that family with
 *      `rawDeviceName: null`. A miss returns `'unrecognized-device'` with
 *      the trimmed raw string preserved verbatim — a growing count of
 *      `'unrecognized-device'` rows is itself a visible signal that the
 *      lookup table needs a new entry, not a defect to hide.
 *   2. else `sourceProvider === 'intervals'` — `'intervals-icu'`. THIS STEP
 *      IS LOAD-BEARING and is the whole reason this function takes two
 *      fields: `device_name` alone cannot separate the intervals.icu-
 *      migrated activities from the genuine no-device-name cohort, because
 *      BOTH have a blank `device_name`. The distinction is visible only in
 *      `source_provider`.
 *   3. else — `'no-device-name'`. `sourceProvider === 'strava-export'`
 *      DELIBERATELY falls through to this branch rather than getting a
 *      fourth family: those are genuinely Strava-recorded, device-less
 *      activities recovered through a different channel, and ERA-02 never
 *      names them as a separate population. Do not "fix" this by adding a
 *      `strava-export` family — it was considered and rejected.
 *
 * The old, hyphenated "unknown device" string is NOT a member of
 * `DeviceFamilyKind` and must never be reintroduced: it was a stale,
 * pre-taxonomy annotation for exactly this `'no-device-name'` slot (see
 * `pace-fixtures.ts`'s `real-pause` entry).
 */
export function resolveDeviceFamily(
  metadata: Pick<ActivityQualityMetadata, 'deviceName' | 'sourceProvider'>
): DeviceEraSignal {
  const { deviceName, sourceProvider } = metadata;

  if (typeof deviceName === 'string') {
    const trimmed = deviceName.trim();
    if (trimmed.length > 0) {
      const known = KNOWN_DEVICE_FAMILIES[trimmed];
      if (known !== undefined) {
        return { family: known, rawDeviceName: null };
      }
      return { family: 'unrecognized-device', rawDeviceName: trimmed };
    }
  }

  if (sourceProvider === 'intervals') {
    return { family: 'intervals-icu', rawDeviceName: null };
  }

  // sourceProvider === 'strava-export' deliberately falls through to here —
  // see step 3 of this function's JSDoc.
  return { family: 'no-device-name', rawDeviceName: null };
}

// ---------------------------------------------------------------------------
// Elapsed-vs-moving (untiered, D-14)
// ---------------------------------------------------------------------------

/**
 * Computes the untiered elapsed-vs-moving ratio (D-14). Total: any shape of
 * input, including non-finite or missing values, returns a valid
 * `ElapsedVsMovingSignal`, never throws.
 *
 * Deliberately carries NO tier. PROJECT.md's non-goals put stopped-watch
 * correction out of scope because nothing in the stored data distinguishes
 * a deliberate rest from a forgotten stop — a signal whose high values
 * cannot be separated into benign and broken has no defensible severe
 * threshold. A future reader adding a tier here must overturn that
 * non-goal first, not just add a threshold constant.
 *
 * `ratio` is `elapsedSec / movingSec`, rounded to two decimals, and is
 * `null` — NEVER `1`, NEVER `0` — whenever either value is absent,
 * non-finite, or `movingSec <= 0` (T-26-02: insufficient data is never a
 * plausible-looking computed zero or unity).
 */
export function elapsedVsMovingSignal(
  metadata: Pick<ActivityQualityMetadata, 'elapsedTimeSec' | 'movingTimeSec'>
): ElapsedVsMovingSignal {
  const { elapsedTimeSec, movingTimeSec } = metadata;

  const elapsedSec =
    typeof elapsedTimeSec === 'number' && Number.isFinite(elapsedTimeSec) ? elapsedTimeSec : null;
  const movingSec =
    typeof movingTimeSec === 'number' && Number.isFinite(movingTimeSec) ? movingTimeSec : null;

  const ratio =
    elapsedSec !== null && movingSec !== null && movingSec > 0
      ? Math.round((elapsedSec / movingSec) * 100) / 100
      : null;

  return { ratio, elapsedSec, movingSec };
}

// ---------------------------------------------------------------------------
// Explicit not-computable state (D-06)
// ---------------------------------------------------------------------------

/**
 * Constructs the explicit not-computable `ActivityQualitySignals` for an
 * activity whose three stream-derived signals could not be computed (D-06)
 * — e.g. no stream committed, or the stream failed `validateStreamSeries`.
 * This is the sibling of `compute-dashboard-index.ts`'s existing
 * `streams.available` / `streams.reason` stream-less state, applied to the
 * quality-signal tree.
 *
 * Returns a FRESH object on every call (never a shared mutable
 * module-level constant), mirroring `pace-derivation.ts`'s `zeroCoverage()`
 * pattern — a caller mutating one returned object must never affect
 * another.
 *
 * All three tiering signals carry `tier: 'not-computable'` and every
 * numeric evidence field is `null`. `anySevere` is `false` here, but that
 * means "not KNOWN to be severe", NOT "known to be clean" — every consumer
 * distinguishes the two by reading `notComputableReason`, which is
 * non-null exactly in this state.
 *
 * The two untiered facts (`deviceEra`, `elapsedVsMoving`) pass through
 * UNCHANGED from the caller's arguments: a stream-less activity still has
 * a device family and still has an elapsed/moving ratio (computed from
 * metadata alone, independent of the stream), and hiding them would be its
 * own fabrication.
 */
export function notComputableSignals(
  deviceEra: DeviceEraSignal,
  elapsedVsMoving: ElapsedVsMovingSignal,
  reason: string
): ActivityQualitySignals {
  return {
    decimation: { tier: 'not-computable', zeroAdvanceFraction: null, sampleCount: null },
    gapProfile: {
      tier: 'not-computable',
      gapFraction: null,
      recordingGapSec: null,
      pauseSec: null,
      spanSec: null,
    },
    impossibleSamples: {
      tier: 'not-computable',
      count: null,
      maxImpliedSpeedMps: null,
      countInsideZeroAdvanceRun: null,
    },
    // Whole-signal not-computable (Phase 30 D-07): this is the ONLY branch
    // where the rolled-up elevation tier is 'not-computable' — a
    // drift-only not-computable (D-02) is a property of closureDriftSignal
    // alone and never reaches this constructor.
    elevation: {
      tier: 'not-computable',
      subGround: { flagged: false, minAltM: null },
      closureDrift: { state: 'not-computable', deltaM: null, startEndDistM: null },
      verticalRate: { flagged: false, worstRateMps: null, violatingSamples: null },
    },
    // Seventh signal (Phase 33, SEG-06, plan 33-09): the whole-signal
    // not-computable literal, matching every other tiering signal's own
    // branch above — never zeroed (T-26-02).
    unreliableSegments: {
      tier: 'not-computable',
      count: null,
      totalMetres: null,
      totalExcessMetres: null,
      totalSeconds: null,
      excessFraction: null,
      mechanisms: null,
    },
    // Ninth signal (Phase 34, PAUSE-02, D-11): the whole-signal not-computable
    // literal — every count null, never zeroed (T-26-02: a zero here would
    // read as "genuinely no pauses classified" rather than "not looked").
    pauseClassification: {
      intervalCount: null,
      stationaryCount: null,
      walkedCount: null,
      ranThroughCount: null,
      transportedCount: null,
      notClassifiableCount: null,
    },
    // Tenth signal (Phase 34, STOP-01, STOP-03, D-09, D-10): the whole-signal
    // not-computable literal. `reason` echoes the SAME top-level `reason`
    // this constructor was given — a stream-less activity's forgotten-stop
    // flag is not-computable for the identical reason the rest of the
    // stream-derived signals are.
    forgottenStop: {
      computable: false,
      reason,
      count: null,
      totalSec: null,
      longestSec: null,
      creepCount: null,
      creepTotalSec: null,
      creepLongestSec: null,
      pauseCount: null,
      pauseTotalSec: null,
      pauseLongestSec: null,
    },
    deviceEra,
    elapsedVsMoving,
    anySevere: false,
    notComputableReason: reason,
  };
}

// ---------------------------------------------------------------------------
// Threshold overrides (Criterion 4's knob — plan 27-03 turns it)
// ---------------------------------------------------------------------------

/**
 * Threshold overrides — the SAME shape `classifyGaps`'s own pause-threshold
 * option already uses for its own demonstrable knob. Production callers pass
 * nothing; only the calibration script (27-03) passes overrides, so
 * Criterion 4's "move a threshold, watch the rate move" needs no source
 * edit and no test-only export.
 */
export interface QualityThresholdOverrides {
  decimationZeroAdvanceFraction?: number;
  decimationMinSamples?: number;
  gapProfileSevereFraction?: number;
  impossibleSevereCount?: number;
  impossibleFloorMps?: number;
  /** Overrides `UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION` (D-07). Production callers pass nothing. */
  unreliableSegmentsSevereExcessFraction?: number;
}

// ---------------------------------------------------------------------------
// Decimation signal (D-04) — Phase 26's cohort rule, reused verbatim
// ---------------------------------------------------------------------------

/**
 * Severe-tier threshold for the decimation signal (D-04): reused VERBATIM
 * from Phase 26's cohort rule. The exact same 0.15/50 pair lives in
 * `26-RESIDUAL.md` § Cohort Definition (the committed deliverable) and in
 * `scripts/compute-pace-residual.mjs`'s `SEVERE_STAIR_STEP_ZERO_ADVANCE_FRACTION`
 * / `isSevereStairStep` — this is the third place, not a second line: all
 * three must agree on the exact same 154-activity cohort by construction.
 * These are NOT this phase's to retune — D-04 locks them, and the
 * 154-activity cohort they select IS the severe-decimation set by
 * definition, full stop. The 50-sample floor below exists ONLY to exclude
 * one degenerate near-empty manual-entry stream (`11865310195`,
 * `26-RESIDUAL.md`'s own note); it is not a general quality bar on sample
 * density.
 */
export const DECIMATION_SEVERE_ZERO_ADVANCE_FRACTION = 0.15;

/** See `DECIMATION_SEVERE_ZERO_ADVANCE_FRACTION`'s doc comment — same D-04 lock, same three-place agreement. */
export const DECIMATION_SEVERE_MIN_SAMPLES = 50;

/**
 * Lower cut below which a decimated-but-not-severe stream reports `'minor'`
 * rather than `'none'` (yours-to-choose, per the action text, but carrying
 * the same mechanism-first reasoning the severe cut does): a stream whose
 * zero-advance fraction exceeds this floor still has an instantaneous pace
 * that is partly an artifact of its own emission interval — the same
 * mechanism the severe tier names — just not enough of the stream to
 * dominate its distribution the way the severe cohort's activities do.
 * `'minor'` NEVER affects `anySevere` (D-07 badges only `'severe'`); a
 * reader who conflates this cut with the severe one has mis-read the tier,
 * not the constant.
 */
export const DECIMATION_MINOR_ZERO_ADVANCE_FRACTION = 0.05;

/**
 * Decimation/aliasing tiering signal (D-04). Total: guarded by
 * `validateStreamSeries` first — a non-`ok` input returns
 * `{ tier: 'not-computable', zeroAdvanceFraction: null, sampleCount: null }`
 * rather than throwing (T-26-01).
 *
 * `zeroAdvanceFraction` is computed over the SAME denominator
 * `compute-pace-residual.mjs`'s `zeroAdvanceFraction` uses — the fraction of
 * consecutive pairs `[i-1, i]` with `d[i] <= d[i-1]`, over `n - 1` where `n`
 * is the shared sample count. A different denominator here would silently
 * fork D-04's cohort from the committed `26-RESIDUAL.md` deliverable, so
 * this must match that function exactly, not merely approximately.
 *
 * Tier `'severe'` when `zeroAdvanceFraction > DECIMATION_SEVERE_ZERO_ADVANCE_FRACTION`
 * AND `sampleCount >= DECIMATION_SEVERE_MIN_SAMPLES` (both resolved via
 * `options?.x ?? THE_CONSTANT`, mirroring `classifyGaps`'s own resolution of
 * its pause-threshold option); `'minor'` when the fraction exceeds
 * `DECIMATION_MINOR_ZERO_ADVANCE_FRACTION` but the severe rule does not
 * hold; `'none'` otherwise.
 */
export function decimationSignal(
  t: readonly number[],
  d: readonly number[],
  options?: QualityThresholdOverrides
): DecimationSignal {
  if (!validateStreamSeries(t as number[], d as number[]).ok) {
    return { tier: 'not-computable', zeroAdvanceFraction: null, sampleCount: null };
  }

  const n = Math.min(t.length, d.length);
  let zeroCount = 0;
  for (let i = 1; i < n; i++) {
    if (d[i] <= d[i - 1]) zeroCount++;
  }
  const zeroAdvanceFraction = zeroCount / (n - 1);
  const sampleCount = n;

  const severeFraction =
    options?.decimationZeroAdvanceFraction ?? DECIMATION_SEVERE_ZERO_ADVANCE_FRACTION;
  const minSamples = options?.decimationMinSamples ?? DECIMATION_SEVERE_MIN_SAMPLES;

  let tier: QualityTier;
  if (zeroAdvanceFraction > severeFraction && sampleCount >= minSamples) {
    tier = 'severe';
  } else if (zeroAdvanceFraction > DECIMATION_MINOR_ZERO_ADVANCE_FRACTION) {
    tier = 'minor';
  } else {
    tier = 'none';
  }

  return { tier, zeroAdvanceFraction, sampleCount };
}

// ---------------------------------------------------------------------------
// Gap-profile signal — non-covered time over the stream's own span
// ---------------------------------------------------------------------------

/**
 * Severe-tier threshold for the gap-profile signal (D-02). Choosing this
 * value is a deliverable in its own right, not a constant dropped in from
 * elsewhere.
 *
 * (1) WHAT IT MEASURES: `(recordingGapSec + pauseSec + unreliableSec) /
 * spanSec` (widened 2026-09-21, 33-CONTEXT.md D-04; was a two-term
 * numerator through v2.2), straight from `classifyGaps` — the fraction of a
 * stream's own recorded span in which no pace was actually measured (either
 * the device stopped recording entirely, the athlete's distance genuinely
 * froze for longer than that activity's own advance-interval distribution
 * justifies as a pause, or the sample-level detector found the recorded
 * distance untrustworthy — a gap-adjacent slew burst, a hidden pause with no
 * timestamp gap, or an isolated GPS jump).
 *
 * (2) MECHANISM ARGUMENT: a pace distribution, a splits table, or a
 * headline "average pace" figure all implicitly claim to describe the whole
 * run. Once a FIFTH or more of the stream's own recorded span carries no
 * measured pace at all, that claim stops being true of the activity as a
 * whole — the reported numbers increasingly describe only the covered
 * remainder, not the run the athlete actually did. This argument does not
 * depend on archive size: it is a statement about what fraction of a SINGLE
 * activity's own timeline a viewer can trust the displayed pace figures to
 * represent, and it would read the same if the archive were twice as large.
 *
 * (3) MEASURED COHORT AT THE CHOSEN CUT AND ITS TWO NEIGHBOURS — Phase 27
 * figures over the PRE-WIDENING two-term numerator (live archive,
 * `27-RESEARCH.md`'s sweep table, Phase 27 / v2.2 milestone, shipped
 * 2026-09-19; NOT re-measured against the three-term numerator this Phase
 * 33 docblock now describes — see (5) below):
 *   - >15% of span in gap: 197 activities (10.6%)
 *   - >20% of span in gap: 127 activities (6.8%)  <- CHOSEN CUT
 *   - >25% of span in gap:  88 activities (4.7%)
 *
 * (4) NOT CHOSEN TO LAND UNDER 5% (D-02): 20% was picked because "a fifth
 * of the recorded span" is the mechanism argument in (2) above, not because
 * 6.8% is closer to a target than 4.7% is — 25% would in fact clear ~5% on
 * this signal alone and was NOT chosen for that reason. The composite rate
 * this signal contributes to is reported honestly in 27-03's calibration
 * document, including if it lands above ~5% once unioned with the other two
 * tiering signals.
 *
 * (5) ANTI-QUOTA (widened 2026-09-21, 33-CONTEXT.md D-04/D-05): Phase 33
 * widened this signal's numerator to a three-term sum (unreliable time
 * added, see (1)) and deliberately did NOT re-derive this cut or
 * `GAP_PROFILE_MINOR_FRACTION` to compensate. The before/after per-tier
 * migration this widening causes is measured archive-wide and reported as a
 * finding in plan 33-07's artifact, including if the migration is zero.
 * Phase 27's own D-02 anti-quota rule — a constant is never moved to change
 * a count — is restated here because a reader meeting a changed numerator
 * on an unchanged threshold will be tempted to "recalibrate"; that
 * temptation is exactly what D-02/D-05 forbid. The cohort figures in (3)
 * above are NOT re-measured against this widened numerator — they remain
 * the Phase 27 figures they always were, now explicitly dated and sourced
 * as such.
 */
export const GAP_PROFILE_SEVERE_FRACTION = 0.2;

/**
 * Lower cut below which a stream with SOME non-covered time reports
 * `'minor'` rather than `'none'` — the same "not enough of the span to
 * threaten the claim the displayed numbers make" reasoning as
 * `DECIMATION_MINOR_ZERO_ADVANCE_FRACTION`, scaled to this signal's own
 * fraction.
 */
export const GAP_PROFILE_MINOR_FRACTION = 0.05;

/**
 * (1) WHAT IT MEASURES: the fraction of an activity's OWN distance carried
 * as excess metres beyond what the detector's speed limit allows over the
 * segments' own elapsed time — `sum(segment excessMetres) / (activity's own
 * total distance)`, tiered strictly-greater-than (`'severe'` above this
 * value, `'minor'` at or below it with at least one segment, `'none'` with
 * zero segments — a presence fact, not a magnitude judgement).
 *
 * (2) DERIVATION (D-16, plan 33-14): plan 33-08 measured that every outer
 * percentile of the FLAGGED cohort's own excess-fraction population fails
 * D-13 insensitivity by 50-4333% against a 1% tolerance — the percentiled
 * population IS the population the cut later judges, so "re-derive with
 * detected segments removed" collapses the population itself, and the
 * would-be q=0.99 candidate is literally the same computation as its own
 * deliberately circular strawman. Plan 33-14 closes that HALT by deriving
 * the cut from a reference population that is NOT the flagged set: four
 * shapes were pre-declared in the plan's own text before any measurement,
 * ordered by unit-match then independence then fewest inherited caveats,
 * arbitrated by first-clearing order. Shape **R1 — "accumulated ordinary
 * step noise"** was the first to clear: for each activity, every interior
 * folded covered step whose neighbours are index-contiguous contributes a
 * residual against the mean of its neighbours' implied speed; `sigma` is a
 * MEDIAN over thousands of such residuals per activity (50% breakdown
 * point), so a handful of burst steps cannot move it; `epsilon = sigma *
 * sqrt(step count) / activity distance`; the shipped cut is the R-7 90th
 * percentile of `epsilon` ACROSS ALL COMPUTABLE ACTIVITIES (flagged or not).
 * Non-circularity: nothing in the statistic references the speed limit, the
 * excess floor, a segment, or flagged membership — the population is every
 * activity's own ordinary sample-to-sample noise, not the excess-fraction
 * population this constant later tiers. Disclosed model assumption:
 * independent per-step errors accumulating as a random walk.
 *
 * (3) THE VALUE: raw 0.004229423790775019, rounded UP to 3 significant
 * figures (rounding up can only call FEWER activities severe than the raw
 * value would, and 3 s.f. is the coarsest precision whose quantum never
 * exceeds the 1% D-13 tolerance) to **0.00423** — D-13 insensitivity
 * deltas removedDelta 0.2848%, plantedDelta 0.5081%, both against the 1%
 * tolerance, all four quoted from
 * `.planning/milestones/v2.3-phases/33-coverage-integration-pace-clipping-segment-signal/33-CALIBRATION.md`
 * § "Chosen constant" / "Shape arbitration", the source of record for this
 * value.
 *
 * (4) 33-08's own shape (an outer percentile of the flagged cohort itself)
 * was MEASURED failing D-13 by 50-4333% against the 1% tolerance — kept in
 * the artifact under "Recorded negative finding", never deleted (evidence is
 * never deleted).
 *
 * (5) ANTI-QUOTA (Phase 27 D-02): the archive-wide severe rate this cut
 * produces (136 severe / 563 minor / 1175 none of 1874, per the artifact) is
 * a REPORTED FINDING, computed only after the shape was selected, never an
 * input to selection and never a reason to move this constant.
 *
 * (6) REJECTED (33-CONTEXT.md D-07): unreliable-seconds-over-span was
 * measured and rejected — it scores 3475734189's 199 m hidden pause at
 * about 0.2% of span, structurally unable to call the archive's worst
 * distance lie severe.
 *
 * (7) Shipped by plan 33-14 FROM the artifact above, and pinned to it by the
 * "shipped from 33-CALIBRATION" test in `pace-quality.test.ts` — that test
 * goes red under a seeded edit of either side. Plan 33-09 Task 2 step 1
 * CONSUMES this export and must not declare a second one.
 */
export const UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION = 0.00423;

/**
 * The SOLE call site of the shared gap classifier AND the unreliable-segment
 * detector in this module (widened 2026-09-21, Phase 33 plan 33-09 —
 * previously coverage-only; widened again 2026-09-23, Phase 34, to return
 * `coveredRuns` for the forgotten-stop core) — all three are called at most
 * once per activity and their result shared, never a second independent
 * invocation inviting drift. `gapProfileSignal`, `computePaceQualitySignals`
 * and `buildPaceQualityShard` all route through this one wrapper; the latter
 * two additionally share its `segments`/`coveredRuns` halves with
 * `unreliableSegmentsSignal`, `pauseClassificationSignal` and
 * `forgottenStopSignal` rather than resolving the detector a second time
 * (T-33-12c, extended by Phase 34's "one computation per producer" test).
 */
function resolveCoverage(
  t: readonly number[],
  d: readonly number[]
): { coverage: PaceCoverage; segments: UnreliableSegment[]; coveredRuns: CoveredRun[] } {
  return classifyGapsWithSegments(t as number[], d as number[]);
}

/**
 * Derives the gap-profile tier/fields from an ALREADY-COMPUTED coverage
 * result — pure, no classification of its own. Guard: a zeroed coverage
 * result (`spanSec === 0`, the classifier's own totality guard on invalid
 * input, or a degenerate single-timestamp stream) returns
 * `tier: 'not-computable'` with every numeric field `null` — never
 * `gapFraction: 0`, which would read as a genuinely clean stream (T-26-02).
 *
 * Otherwise `gapFraction = (recordingGapSec + pauseSec + unreliableSec) /
 * spanSec` (widened 2026-09-21, 33-CONTEXT.md D-04; was a two-term
 * numerator through v2.2); tier `'severe'` above the resolved severe cut,
 * `'minor'` above `GAP_PROFILE_MINOR_FRACTION`, `'none'` otherwise.
 * `recordingGapSec` and `pauseSec` are echoed separately (never only their
 * sum) so the badge and the shard can name those two categories
 * independently — `unreliableSec` is NOT echoed on this returned signal
 * (see `GapProfileSignal`'s own doc comment for where the third category is
 * itemised instead).
 */
function tierGapProfileFromCoverage(
  coverage: PaceCoverage,
  options?: QualityThresholdOverrides
): GapProfileSignal {
  if (coverage.spanSec === 0) {
    return {
      tier: 'not-computable',
      gapFraction: null,
      recordingGapSec: null,
      pauseSec: null,
      spanSec: null,
    };
  }

  // D-04 (33-CONTEXT.md, widened 2026-09-21): unreliable time enters the
  // numerator alongside recording gaps and pauses. Measured reason: under
  // D-01 the 63 gap-adjacent activities keep EXACTLY the fraction they have
  // today (unreliable time is re-labelled from an existing gap/pause, not
  // added on top), so no shipped badge is silently lost by this widening —
  // excluding unreliable time could only SHRINK the fraction for those 63
  // activities and drop severe/minor badges purely because of a re-label.
  // hidden-pause activities gain ~25s and isolated-jump activities gain
  // ~4.8s per activity, both fractions of a percent (figures cited to
  // 33-CONTEXT.md D-04, sourced from 32-CALIBRATION.md — reference values
  // to reconcile against in plan 33-07, never expected values).
  const gapFraction =
    (coverage.recordingGapSec + coverage.pauseSec + coverage.unreliableSec) / coverage.spanSec;
  const severeFraction = options?.gapProfileSevereFraction ?? GAP_PROFILE_SEVERE_FRACTION;

  let tier: QualityTier;
  if (gapFraction > severeFraction) {
    tier = 'severe';
  } else if (gapFraction > GAP_PROFILE_MINOR_FRACTION) {
    tier = 'minor';
  } else {
    tier = 'none';
  }

  return {
    tier,
    gapFraction,
    recordingGapSec: coverage.recordingGapSec,
    pauseSec: coverage.pauseSec,
    spanSec: coverage.spanSec,
  };
}

/**
 * Non-covered-time tiering signal (D-04/D-07's gap-profile half). Resolves
 * coverage with NO options — the shipped, scale-relative gap
 * classification Phase 26 ships, unmodified. This signal never substitutes
 * a second gap classifier and never overrides the classifier's own shipped
 * segmentation rule. See `tierGapProfileFromCoverage` for the tiering
 * logic itself.
 */
export function gapProfileSignal(
  t: readonly number[],
  d: readonly number[],
  options?: QualityThresholdOverrides
): GapProfileSignal {
  const { coverage } = resolveCoverage(t, d);
  return tierGapProfileFromCoverage(coverage, options);
}

// ---------------------------------------------------------------------------
// Unreliable-segments signal (D-06/D-07/D-08, Phase 33 SEG-06, plan 33-09)
// ---------------------------------------------------------------------------

/**
 * `SegmentMechanism`'s fixed declaration order — used to build
 * `UnreliableSegmentsSignal.mechanisms` deterministically, never via Set
 * iteration/insertion order (which would depend on detection order).
 */
const SEGMENT_MECHANISM_ORDER: readonly SegmentMechanism[] = [
  'gap-adjacent',
  'hidden-pause',
  'isolated-jump',
];

/** The shared `not-computable` literal both guard branches below return — never a shared mutable constant (T-26-02). */
function notComputableUnreliableSegmentsSignal(): UnreliableSegmentsSignal {
  return {
    tier: 'not-computable',
    count: null,
    totalMetres: null,
    totalExcessMetres: null,
    totalSeconds: null,
    excessFraction: null,
    mechanisms: null,
  };
}

/**
 * Seventh quality signal (D-06/D-07/D-08, Phase 33 SEG-06, plan 33-09): the
 * detector's own segments, rolled up per activity. Pure — takes the
 * ALREADY-RESOLVED `segments` list (`resolveCoverage`'s `segments` half,
 * Task 1's `classifyGapsWithSegments`) rather than running the detector
 * itself, so this signal costs no detector invocation beyond the one
 * `resolveCoverage` already performs per producer (T-33-12c).
 *
 * Guard (T-26-01/T-26-02, mirrors `tierGapProfileFromCoverage`'s
 * `spanSec === 0` branch): a non-`ok` `validateStreamSeries(t, d)` result,
 * OR a non-positive activity distance (`d[d.length - 1] - d[0]`, the same
 * denominator `33-CALIBRATION.md`'s anchor check and archive-wide finding
 * use), returns `tier: 'not-computable'` with every numeric field `null`
 * and `mechanisms: null` — never a zeroed shape, which would read as a
 * genuinely clean, zero-segment activity.
 *
 * `tier`: `'none'` with zero segments (D-06's presence-fact planner
 * decision); `'severe'` when `excessFraction` is STRICTLY GREATER than the
 * resolved severe cut (`options?.unreliableSegmentsSevereExcessFraction ??
 * UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION`); `'minor'` for any other
 * count > 0 — including an `excessFraction` of exactly 0
 * (3475724402's 16 segments, 33-08/33-14's own recorded finding: gap
 * dilution clamps every one of them to zero excess, but at least one
 * segment was still detected, so this reads `'minor'`, never `'none'`).
 *
 * `totalMetres`/`totalExcessMetres`/`totalSeconds` are exact sums of the
 * detector's own per-segment `metres`/`excessMetres`/`seconds` — this
 * function contains no excess arithmetic of its own (T-33-12b). `mechanisms`
 * lists each DISTINCT mechanism present, in `SEGMENT_MECHANISM_ORDER`.
 */
export function unreliableSegmentsSignal(
  t: readonly number[],
  d: readonly number[],
  segments: readonly UnreliableSegment[],
  options?: QualityThresholdOverrides
): UnreliableSegmentsSignal {
  if (!validateStreamSeries(t as number[], d as number[]).ok) {
    return notComputableUnreliableSegmentsSignal();
  }

  const totalDistanceM = d[d.length - 1] - d[0];
  if (!(totalDistanceM > 0)) {
    return notComputableUnreliableSegmentsSignal();
  }

  let totalMetres = 0;
  let totalExcessMetres = 0;
  let totalSeconds = 0;
  const mechanismsPresent = new Set<SegmentMechanism>();
  for (const seg of segments) {
    totalMetres += seg.metres;
    totalExcessMetres += seg.excessMetres;
    totalSeconds += seg.seconds;
    mechanismsPresent.add(seg.mechanism);
  }

  const count = segments.length;
  const excessFraction = totalExcessMetres / totalDistanceM;
  const severeCut =
    options?.unreliableSegmentsSevereExcessFraction ?? UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION;

  let tier: QualityTier;
  if (count === 0) {
    tier = 'none';
  } else if (excessFraction > severeCut) {
    tier = 'severe';
  } else {
    tier = 'minor';
  }

  const mechanisms = SEGMENT_MECHANISM_ORDER.filter((m) => mechanismsPresent.has(m));

  return { tier, count, totalMetres, totalExcessMetres, totalSeconds, excessFraction, mechanisms };
}

// ---------------------------------------------------------------------------
// Impossible-sample detector — raw, unsmoothed, per-consecutive-pair (D-02)
// ---------------------------------------------------------------------------

/**
 * Raw, per-consecutive-sample-pair implausible-speed detector (locked
 * mechanism, this task's own action text): for each pair with `dt > 0`,
 * computes `(d[i+1] - d[i]) / (t[i+1] - t[i])` and counts it when it
 * exceeds the resolved floor (`options?.floorMps ?? WORLD_RECORD_100M_SPEED_MPS`).
 *
 * RAW consecutive samples only. Deliberately NOT smoothed, NOT windowed, and
 * does NOT exclude pause-classified or zero-advance-run segments —
 * `27-RESEARCH.md`'s Common Pitfall 3 measured exclusion-by-classification
 * as ineffective: the coarse-emission-interval activities' flat runs mostly
 * classify as `covered` (not `pause`) under the scale-relative gap
 * classification (by design), so excluding `pause`-classified segments
 * leaves the aliasing jumps untouched. Windowing is explicitly out of scope
 * for this phase. A future reader must not "improve" this by adding either.
 *
 * Guard: `validateStreamSeries` first (T-26-01) — a non-`ok` input returns
 * the zeroed shape below; this function never invents a tier, only the
 * caller (`impossibleSampleSignal`) converts that into `'not-computable'`.
 *
 * `samples` records `{ index, impliedSpeedMps, dtSec, ddM }` per offending
 * pair, ordered by index, capped at 100 entries. `index` is the ARRIVAL
 * sample (`i + 1` for the offending pair `[i, i+1]`) — the sample the jump
 * lands on — matching `pace-fixtures.ts`'s own convention for naming an
 * offending pair by a single index. `count` is always the FULL count, never
 * the capped `samples.length` — the caller sets `impossibleSamplesTruncated`
 * when `count` exceeds `samples.length`.
 *
 * `countInsideZeroAdvanceRun` counts how many offending pairs are
 * immediately preceded by a run of two or more zero-advance pairs — the
 * per-activity disclosure of the measured decimation/impossible-sample
 * coupling (archive-wide: 139 of the 154 severe-decimation activities, 90%,
 * also carry >=1 raw impossible sample — `27-RESEARCH.md` Common Pitfall 3,
 * re-confirmed against the live archive by this module's own measurement).
 * It is reported, NEVER subtracted from `count` — the phase's locked
 * disposition (option 1, "accept the overlap") is to disclose the
 * correlation on the row, in the same spirit QUAL-02 already applies to
 * device era and decimation, not to engineer it away.
 */
export function countImpossibleSamples(
  t: readonly number[],
  d: readonly number[],
  options?: { floorMps?: number }
): {
  count: number;
  maxImpliedSpeedMps: number | null;
  countInsideZeroAdvanceRun: number;
  samples: { index: number; impliedSpeedMps: number; dtSec: number; ddM: number }[];
} {
  if (!validateStreamSeries(t as number[], d as number[]).ok) {
    return { count: 0, maxImpliedSpeedMps: null, countInsideZeroAdvanceRun: 0, samples: [] };
  }

  const floor = options?.floorMps ?? WORLD_RECORD_100M_SPEED_MPS;
  const n = Math.min(t.length, d.length);

  // Precompute, per pair index k (1..n-1), the length of the run of
  // consecutive zero-advance pairs ENDING at k — a single linear pass,
  // mirroring `pace-derivation.ts`'s `computeFlatRunDurations` shape.
  const zeroRunEndingAt: number[] = new Array(n).fill(0);
  for (let k = 1; k < n; k++) {
    zeroRunEndingAt[k] = d[k] <= d[k - 1] ? zeroRunEndingAt[k - 1] + 1 : 0;
  }

  let count = 0;
  let maxImpliedSpeedMps: number | null = null;
  let countInsideZeroAdvanceRun = 0;
  const samples: { index: number; impliedSpeedMps: number; dtSec: number; ddM: number }[] = [];

  for (let i = 0; i < n - 1; i++) {
    const dtSec = t[i + 1] - t[i];
    if (!(dtSec > 0)) continue;

    const ddM = d[i + 1] - d[i];
    const impliedSpeedMps = ddM / dtSec;
    if (!(impliedSpeedMps > floor)) continue;

    count++;
    if (maxImpliedSpeedMps === null || impliedSpeedMps > maxImpliedSpeedMps) {
      maxImpliedSpeedMps = impliedSpeedMps;
    }
    // Run ending at i is the run of zero-advance pairs immediately
    // preceding this offending pair (which starts at sample index i).
    if (zeroRunEndingAt[i] >= 2) countInsideZeroAdvanceRun++;

    if (samples.length < 100) {
      // `index` is the ARRIVAL sample (i + 1) — the sample the impossible
      // jump lands on — matching `pace-fixtures.ts`'s own convention
      // (`syntheticImpossibleSpeedStream`'s `idx`, the pinned
      // `impossible-speed-sample` fixture's `offendingIndex: 303`).
      samples.push({ index: i + 1, impliedSpeedMps, dtSec, ddM });
    }
  }

  return { count, maxImpliedSpeedMps, countInsideZeroAdvanceRun, samples };
}

/**
 * Lower cut above which an activity with SOME raw impossible samples
 * reports `'minor'` rather than `'none'`. Unlike decimation's or
 * gap-profile's "a small amount is a normal artifact" framing, an implied
 * speed exceeding the physical floor is never genuinely benign — even a
 * single occurrence is an anomaly worth naming. `'minor'` names that
 * anomaly without contributing to `anySevere`; `IMPOSSIBLE_SAMPLE_SEVERE_COUNT`
 * below is what distinguishes an isolated glitch from a chronic problem.
 */
export const IMPOSSIBLE_SAMPLE_MINOR_COUNT = 1;

/**
 * Severe-tier raw-count threshold for the impossible-sample signal (D-02).
 * Choosing and justifying this value is a deliverable of this task, in this
 * order:
 *
 * (1) THE PHYSICAL FLOOR AND ITS SOURCE: `WORLD_RECORD_100M_SPEED_MPS`
 * (`best-effort-utils.ts` — Usain Bolt's 100m world record, 9.58s, 2009). No
 * human being has ever sustained this speed for even a single 100m effort
 * under any recorded conditions,
 * let alone as an instantaneous implied speed inside a longer training run.
 * Exceeding it once is therefore a fact ABOUT THE RECORDING — a GPS jump, a
 * decimation-collapsed distance tick read as one short interval, or another
 * derivation artifact — never a fact about the runner.
 *
 * (2) FORM: RAW COUNT, not a fraction of the stream's samples. A fraction
 * treats a single catastrophic glitch inside a long, otherwise-clean
 * 2,500-sample stream as negligible (1/2500 = 0.04%), diluting exactly the
 * event this signal exists to surface. A raw count treats a 900-sample and
 * a 2,500-sample stream differently ON PURPOSE: an impossible sample is a
 * discrete EVENT (something specific happened at that one consecutive
 * pair), not a proportional descriptor of the whole stream's quality — a
 * raw count directly answers "how many distinct impossible events
 * occurred", which is exactly what element (3)'s discriminator needs.
 *
 * (3) THE MECHANISM ARGUMENT FOR THE SPECIFIC CUT: a single impossible
 * sample (count 1) is unremarkable — GPS multipath, a momentary satellite
 * dropout, or one decimation-collapsed tick can each produce exactly one
 * anomalous reading in an otherwise-healthy stream, and "every device
 * produces one of these occasionally" is a credible innocent explanation at
 * count 1. As the count climbs, that explanation stops being credible: TEN
 * independent impossible readings inside one activity is not what an
 * occasionally-noisy but otherwise-functioning distance channel produces —
 * it is the signature of a stream whose distance channel is not
 * trustworthy for that activity as a whole, whether from chronic GPS
 * multipath, a chronically degraded fix, or (per the measured coupling in
 * (5)) severe decimation aliasing. `>= 10` is the point at which "isolated,
 * forgivable glitch" stops being the more likely explanation than "this
 * channel is broken."
 *
 * (4) MEASURED COHORT AT THE CHOSEN CUT AND ITS TWO NEIGHBOURS (live
 * archive, re-measured against the actual implemented detector over the
 * committed `data/streams/` archive, 2026-09-10):
 *   - >=5  impossible samples:  71 activities (3.8%)
 *   - >=10 impossible samples:  31 activities (1.7%)  <- CHOSEN CUT
 *   - >=20 impossible samples:  10 activities (0.5%)
 *
 * (5) MEASURED OVERLAP WITH THE SEVERE-DECIMATION COHORT AT THE CHOSEN CUT
 * (re-measured against this file's own `decimationSignal` rule over the
 * live 1,865-stream archive, 2026-09-10): of the 31 activities at `>= 10`,
 * 4 (12.9%) are ALSO in the 154-activity severe-decimation cohort — a much
 * smaller overlap than the raw `>= 1` population's 139/154 (90%,
 * `27-RESEARCH.md` Common Pitfall 3), because the `>= 10` cut already
 * excludes the large population of single-glitch activities that drove
 * most of that 90% figure. The remaining overlap is ACCEPTED AND DISCLOSED
 * (`countInsideZeroAdvanceRun`, per-activity), never engineered away — the
 * phase's locked disposition (option 1 of `27-RESEARCH.md` Common Pitfall
 * 3) is that a severely decimated stream that ALSO trips this detector is
 * arguably a genuinely worse activity, and two badges naming two
 * distinct-but-correlated mechanisms is still informative, matching the
 * precedent QUAL-02 already accepts for device-era/decimation.
 *
 * (6) NOT CHOSEN TO LAND THE COMPOSITE UNDER 5% (D-02): `>= 10` was picked
 * because ten independent occurrences is the mechanism point in (3), not
 * because 1.7% keeps this signal's own marginal contribution small — `>= 5`
 * (3.8%) would still individually clear ~5% on its own and was NOT chosen
 * for producing a smaller number. 27-03's calibration document reports the
 * actual composite rate honestly, including if the union with decimation's
 * locked 8.3% floor lands materially above ~5%.
 */
export const IMPOSSIBLE_SAMPLE_SEVERE_COUNT = 10;

/**
 * Per-sample-pair implausible-speed tiering signal (D-02). Maps
 * `countImpossibleSamples`'s raw count to a tier: `'severe'` at or above the
 * resolved severe cut (`options?.impossibleSevereCount ?? IMPOSSIBLE_SAMPLE_SEVERE_COUNT`),
 * `'minor'` at or above `IMPOSSIBLE_SAMPLE_MINOR_COUNT` but below severe,
 * `'none'` at exactly zero, `'not-computable'` when `validateStreamSeries`
 * fails (T-26-01).
 */
export function impossibleSampleSignal(
  t: readonly number[],
  d: readonly number[],
  options?: QualityThresholdOverrides
): ImpossibleSampleSignal {
  if (!validateStreamSeries(t as number[], d as number[]).ok) {
    return {
      tier: 'not-computable',
      count: null,
      maxImpliedSpeedMps: null,
      countInsideZeroAdvanceRun: null,
    };
  }

  const { count, maxImpliedSpeedMps, countInsideZeroAdvanceRun } = countImpossibleSamples(t, d, {
    floorMps: options?.impossibleFloorMps,
  });

  const severeCut = options?.impossibleSevereCount ?? IMPOSSIBLE_SAMPLE_SEVERE_COUNT;

  let tier: QualityTier;
  if (count >= severeCut) {
    tier = 'severe';
  } else if (count >= IMPOSSIBLE_SAMPLE_MINOR_COUNT) {
    tier = 'minor';
  } else {
    tier = 'none';
  }

  return { tier, count, maxImpliedSpeedMps, countInsideZeroAdvanceRun };
}

// ---------------------------------------------------------------------------
// Pause classification & forgotten-stop core (Phase 34: PAUSE-02, STOP-01,
// STOP-03, D-09, D-11) — ninth/tenth signals, built from
// `pause-classification.ts`'s pure classifier/forgotten-stop core over an
// ALREADY-RESOLVED `{ coverage, segments, coveredRuns }` (never a second
// `classifyGapsWithSegments` call — T-33-12c, extended).
// ---------------------------------------------------------------------------

/**
 * Rolls up a `classifyPauses` result into the ninth signal's per-class
 * counts — pure arithmetic over an already-classified interval list, shared
 * between `pauseClassificationSignal` (computePaceQualitySignals's own call)
 * and `buildPaceQualityShard` (which additionally needs the classified
 * intervals themselves for the shard's `pauseIntervals` projection, so it
 * calls `classifyPauses` once and reuses this helper rather than calling
 * `pauseClassificationSignal` a second time).
 */
function pauseClassificationFromIntervals(
  intervals: readonly ClassifiedPauseInterval[],
  notClassifiableCount: number
): PauseClassificationSignal {
  let stationaryCount = 0;
  let walkedCount = 0;
  let ranThroughCount = 0;
  let transportedCount = 0;
  for (const interval of intervals) {
    switch (interval.pauseClass) {
      case 'stationary':
        stationaryCount++;
        break;
      case 'walked':
        walkedCount++;
        break;
      case 'ran-through':
        ranThroughCount++;
        break;
      case 'transported':
        transportedCount++;
        break;
    }
  }
  return {
    intervalCount: intervals.length,
    stationaryCount,
    walkedCount,
    ranThroughCount,
    transportedCount,
    notClassifiableCount,
  };
}

/**
 * Ninth quality signal (PAUSE-02, D-11): calls `classifyPauses` (imported
 * from `pause-classification.ts`, this module's own pre-allowed call site —
 * see `pace-single-source.test.ts`'s confinement guard) with the SHIPPED
 * bands (`SHIPPED_PAUSE_BANDS`, D-20/D-21), over the caller's
 * already-resolved `coverage`/`segments` (never re-resolves the detector
 * itself). Total, like `classifyPauses` itself — never a plausible-looking
 * zero where the value is unknown (T-26-02): this function is only ever
 * called from the computed (stream-present, validated) branch of its two
 * producers; the whole-signal not-computable literal lives in
 * `notComputableSignals` above, not here.
 */
export function pauseClassificationSignal(
  t: readonly number[],
  d: readonly number[],
  coverage: PaceCoverage,
  segments: readonly UnreliableSegment[]
): PauseClassificationSignal {
  const { intervals, notClassifiableCount } = classifyPauses(t, d, coverage, segments, SHIPPED_PAUSE_BANDS);
  return pauseClassificationFromIntervals(intervals, notClassifiableCount);
}

/**
 * Rolls up a `classifyForgottenStop` result into the tenth signal's itemised
 * totals (D-09) — pure arithmetic over an already-computed result, shared
 * between `forgottenStopSignal` and `buildPaceQualityShard` for the same
 * "call the core once, reuse the result" reason `pauseClassificationFromIntervals`
 * documents above.
 */
function forgottenStopFromResult(
  result: ReturnType<typeof classifyForgottenStop>
): ForgottenStopSignal {
  if (!result.computable) {
    return {
      computable: false,
      reason: result.reason,
      count: null,
      totalSec: null,
      longestSec: null,
      creepCount: null,
      creepTotalSec: null,
      creepLongestSec: null,
      pauseCount: null,
      pauseTotalSec: null,
      pauseLongestSec: null,
    };
  }

  const creepCount = result.creep.length;
  const creepTotalSec = result.creep.reduce((sum, iv) => sum + iv.seconds, 0);
  const creepLongestSec = result.creep.reduce((max, iv) => Math.max(max, iv.seconds), 0);
  const pauseCount = result.pauses.length;
  const pauseTotalSec = result.pauses.reduce((sum, iv) => sum + iv.seconds, 0);
  const pauseLongestSec = result.pauses.reduce((max, iv) => Math.max(max, iv.seconds), 0);

  return {
    computable: true,
    reason: null,
    count: creepCount + pauseCount,
    totalSec: creepTotalSec + pauseTotalSec,
    longestSec: Math.max(creepLongestSec, pauseLongestSec),
    creepCount,
    creepTotalSec,
    creepLongestSec,
    pauseCount,
    pauseTotalSec,
    pauseLongestSec,
  };
}

/**
 * Tenth quality signal (STOP-01, STOP-03, D-09, D-10): calls
 * `classifyForgottenStop` (this module's own pre-allowed call site) with the
 * SHIPPED params (`SHIPPED_STOP_PARAMS`, D-20's stationary bound + the
 * calibrated Family M minimum duration), over the caller's already-resolved
 * `coverage`/`coveredRuns`. `classifyForgottenStop` itself decides
 * computability via the D-10 recording-mechanism signature — this function
 * only rolls that result up, never re-derives the signature.
 */
export function forgottenStopSignal(
  t: readonly number[],
  d: readonly number[],
  coverage: PaceCoverage,
  coveredRuns: readonly CoveredRun[]
): ForgottenStopSignal {
  const result = classifyForgottenStop(t, d, coverage, coveredRuns, SHIPPED_STOP_PARAMS);
  return forgottenStopFromResult(result);
}

// ---------------------------------------------------------------------------
// Composite predicate (D-01) — the single "any severe" definition
// ---------------------------------------------------------------------------

/**
 * The single definition of the "any severe" composite (D-01) — true iff at
 * least one of the three TIERING signals (`decimation`, `gapProfile`,
 * `impossibleSamples` — D-05 excludes `deviceEra`/`elapsedVsMoving`, both
 * untiered facts) equals `'severe'`.
 *
 * FOUR consumers read this exact definition, and this JSDoc names all four
 * so a later reader cannot claim ignorance: D-01 calls it the calibrated
 * number; D-16's list filter toggles on it; 27-03's calibration report
 * measures the composite rate from it; and it is the field 27-05's
 * independent recount cross-checks against the shipped index. A second
 * implementation of this predicate ANYWHERE ELSE in `src/` is the exact
 * defect this function exists to prevent — with ONE deliberate, bounded
 * exception: plan 27-05's recount script is explicitly FORBIDDEN from
 * importing this module (D-03) and re-derives its own arithmetic reading
 * only the shipped `data/dashboard/index.json`. That is the one intended
 * second implementation, adversarial by design so it can catch a compute
 * step that silently stops emitting a field — it must never be "fixed" to
 * import this function instead, which would let it agree with itself by
 * construction.
 *
 * `'not-computable'` is NOT `'severe'` (D-06): a stream-less activity is
 * never counted toward this composite's numerator. The denominator
 * question therefore has two valid answers (all activities, or only those
 * with a computable stream) and every reported rate must state which one it
 * uses.
 */
export function hasAnySevereSignal(
  signals: Pick<ActivityQualitySignals, 'decimation' | 'gapProfile' | 'impossibleSamples'>
): boolean {
  return (
    signals.decimation.tier === 'severe' ||
    signals.gapProfile.tier === 'severe' ||
    signals.impossibleSamples.tier === 'severe'
  );
}

// ---------------------------------------------------------------------------
// Top-level assembly (D-01..D-06)
// ---------------------------------------------------------------------------

/**
 * Assembles the full `ActivityQualitySignals` for one activity. Resolves
 * the two untiered facts FIRST — `deviceEra` and `elapsedVsMoving` are both
 * computable from metadata alone, independent of whether a stream exists.
 *
 * If `stream` is `null`, returns `notComputableSignals(deviceEra,
 * elapsedVsMoving, NOT_COMPUTABLE_NO_STREAM)`. If the stream's `t`/`d` fail
 * `validateStreamSeries`, returns `notComputableSignals(...,
 * NOT_COMPUTABLE_UNUSABLE_STREAM)`. Otherwise assembles all five signals and
 * sets `anySevere = hasAnySevereSignal(...)`, `notComputableReason: null`.
 *
 * Never partially fills: an activity is either FULLY computed (all three
 * tiering signals real) or FULLY not-computable (all three
 * `'not-computable'`) — never a mix.
 */
export function computePaceQualitySignals(
  stream: CanonicalStream | null,
  metadata: ActivityQualityMetadata,
  options?: QualityThresholdOverrides
): ActivityQualitySignals {
  const deviceEra = resolveDeviceFamily(metadata);
  const elapsedVsMoving = elapsedVsMovingSignal(metadata);

  if (stream === null) {
    return notComputableSignals(deviceEra, elapsedVsMoving, NOT_COMPUTABLE_NO_STREAM);
  }

  const { t, d } = stream;
  if (!validateStreamSeries(t as number[], d as number[]).ok) {
    return notComputableSignals(deviceEra, elapsedVsMoving, NOT_COMPUTABLE_UNUSABLE_STREAM);
  }

  const decimation = decimationSignal(t, d, options);
  // Phase 33 plan 33-09 (T-33-12c): resolve coverage AND the detector's
  // segments exactly ONCE here, sharing all three halves between gapProfile,
  // the seventh signal, and (Phase 34) the ninth/tenth signals below — never
  // a second independent classifyGapsWithSegments call within this producer.
  const { coverage, segments, coveredRuns } = resolveCoverage(t, d);
  const gapProfile = tierGapProfileFromCoverage(coverage, options);
  const impossibleSamples = impossibleSampleSignal(t, d, options);
  const elevation = elevationSignal(stream, metadata);
  const unreliableSegments = unreliableSegmentsSignal(t, d, segments, options);
  // Phase 34 (PAUSE-02, STOP-01, STOP-03, D-11): the ninth/tenth signals,
  // sharing the SAME coverage/segments/coveredRuns this producer already
  // resolved above. `anySevere` below is textually UNCHANGED — its Pick<>
  // still names exactly the three tiering signals (see that function's own
  // doc comment and the never-widen guard test in pace-quality.test.ts).
  const pauseClassification = pauseClassificationSignal(t, d, coverage, segments);
  const forgottenStop = forgottenStopSignal(t, d, coverage, coveredRuns);
  const anySevere = hasAnySevereSignal({ decimation, gapProfile, impossibleSamples });

  return {
    decimation,
    gapProfile,
    impossibleSamples,
    elevation,
    unreliableSegments,
    deviceEra,
    elapsedVsMoving,
    pauseClassification,
    forgottenStop,
    anySevere,
    notComputableReason: null,
  };
}

// ---------------------------------------------------------------------------
// D-17 evidence shard
// ---------------------------------------------------------------------------

/**
 * Threshold overrides live on `QualityThresholdOverrides` above (Criterion
 * 4's knob). `PaceQualityShard` is the D-17 evidence-shard shape:
 * classified gap intervals straight from `classifyGaps`, the capped
 * impossible-sample list, a zero-advance-run PROFILE (never the full run
 * list — D-17 explicitly rejects full per-sample arrays for size), the
 * resolved adaptive window width, and `notComputableReason`. On a
 * not-computable activity every evidence field is `null`/empty and
 * `notComputableReason` is set — the shard still exists for every activity
 * (`activityId` is always populated), so the detail view has something
 * honest to render even when the three tiering signals could not be
 * computed.
 */
export interface PaceQualityShard {
  activityId: string;
  signals: ActivityQualitySignals;
  /** Straight from `classifyGaps` — start/end/kind, real seconds, never indices. */
  gapIntervals: GapInterval[];
  impossibleSamples: { index: number; impliedSpeedMps: number; dtSec: number; ddM: number }[];
  impossibleSamplesTruncated: boolean;
  /** A PROFILE, not the run list — D-17 rejects full per-sample arrays. */
  zeroAdvanceRunProfile: {
    runCount: number;
    longestRunSamples: number;
    longestRunSec: number;
    medianRunSamples: number;
    p90RunSec: number;
  } | null;
  adaptiveWindowSec: number | null;
  notComputableReason: string | null;
  /**
   * Elevation evidence (Phase 30 D-17): the capped vertical-rate violating
   * sample list — same 100-entry cap and `{ index, rateMps, dtSec, dAltM }`
   * shape convention as `impossibleSamples` above, from the SAME raw scan
   * `elevationSignal`'s `verticalRateSignal` call performs internally
   * (never a second independent detector run). `elevationLoopRadiusM` is
   * the resolved `LOOP_RADIUS_M` this shard's closure-drift measurement
   * used; `elevationStartEndDistM` echoes
   * `signals.elevation.closureDrift.startEndDistM` directly so the detail
   * view and calibration report have it without reaching into `signals`.
   */
  elevationVerticalRateSamples: { index: number; rateMps: number; dtSec: number; dAltM: number }[];
  elevationVerticalRateSamplesTruncated: boolean;
  elevationLoopRadiusM: number;
  elevationStartEndDistM: number | null;
  /**
   * SEG-06 evidence (Phase 33, D-08, plan 33-10): the per-segment list naming
   * WHERE in the run the detector's segments sit — same two-field shape as
   * `elevationVerticalRateSamples`/`elevationVerticalRateSamplesTruncated`
   * above, capped at 100 entries like `impossibleSamples`. Measured scale:
   * about 2 segments per flagged activity archive-wide (1,344 segments over
   * 699 flagged activities, `32-CALIBRATION.md`, cited as a reference, not
   * an expected value) — the cap is generous, not tight.
   *
   * `parts` is DELIBERATELY ABSENT: `UnreliableSegment.parts` is a
   * compute-time grouping shape (`SegmentPart[]`, the detector's internal
   * burst/gap bookkeeping) and letting it into the wire format would leak
   * an internal representation into a published document (D-08's own
   * rejected alternative — "full `UnreliableSegment` objects including
   * `parts`"). Each entry carries exactly `startSec`/`endSec`/`metres`/
   * `excessMetres`/`seconds`/`mechanism` — no `startIndex`/`endIndex`
   * either, since those are sample-array positions meaningless outside the
   * stream that produced them.
   */
  unreliableSegments: {
    startSec: number;
    endSec: number;
    metres: number;
    excessMetres: number;
    seconds: number;
    mechanism: SegmentMechanism;
  }[];
  unreliableSegmentsTruncated: boolean;
  /**
   * Phase 34 evidence (PAUSE-02, D-14, D-15): the per-interval pause/stop
   * list, feeding the detail view's Pauses section (plan 34-09). Capped at
   * 100 entries, same convention as `unreliableSegments`/`impossibleSamples`
   * above — no `startIndex`/`endIndex` (D-15 rejects them the same way D-08
   * did for the unreliable-segments shard). Membership (D-15): recording
   * gaps, gap-adjacent merged segments and zero-advance pauses (each with
   * its classified `pauseClass`), PLUS covered-creep stretches marked
   * `source: 'covered-creep'`, classified from the UNION's own metres/seconds
   * via `classifyPauseSpeed` (D-22, WR-01: a union of individually-bounded
   * windows is not itself bounded, so the class is measured from the same
   * figures this row renders, never hard-coded to `'stationary'`).
   * Isolated-jump and hidden-pause segments are NEVER in this list (D-01) —
   * they stay only in the Unreliable Segments row/list. Sorted by `startSec`.
   */
  pauseIntervals: {
    source: PauseSource;
    pauseClass: PauseClass;
    startSec: number;
    endSec: number;
    seconds: number;
    metres: number;
    startMetres: number;
  }[];
  pauseIntervalsTruncated: boolean;
}

/**
 * Builds the D-17 zero-advance-run PROFILE (never the full per-index run
 * list) from raw `t`/`d` — a single linear pass finding maximal runs of
 * consecutive zero-advance pairs (`d[i] <= d[i-1]`), summarized as run
 * count, longest run (in samples and in seconds), median run length (in
 * samples) and p90 run duration (in seconds). Percentiles use `quantile()`
 * imported from `pace-derivation.ts` — never a hand-rolled percentile.
 *
 * Returns a non-null, all-zero profile (not `null`) for a valid stream with
 * zero zero-advance runs — a clean stream still HAS a (empty) profile; only
 * a genuinely not-computable activity (handled by the caller before this
 * function is ever invoked) reports `null`.
 */
function computeZeroAdvanceRunProfile(
  t: readonly number[],
  d: readonly number[]
): PaceQualityShard['zeroAdvanceRunProfile'] {
  const n = Math.min(t.length, d.length);

  const runsSamples: number[] = [];
  const runsSec: number[] = [];

  let i = 1;
  while (i < n) {
    if (d[i] <= d[i - 1]) {
      const runStartPairIndex = i;
      let j = i;
      while (j < n && d[j] <= d[j - 1]) j++;
      // Run spans pair indices [runStartPairIndex, j - 1] — samples
      // (runStartPairIndex - 1) through (j - 1).
      runsSamples.push(j - runStartPairIndex);
      runsSec.push(t[j - 1] - t[runStartPairIndex - 1]);
      i = j;
    } else {
      i++;
    }
  }

  if (runsSamples.length === 0) {
    return { runCount: 0, longestRunSamples: 0, longestRunSec: 0, medianRunSamples: 0, p90RunSec: 0 };
  }

  const sortedSamples = [...runsSamples].sort((a, b) => a - b);
  const sortedSec = [...runsSec].sort((a, b) => a - b);

  return {
    runCount: runsSamples.length,
    longestRunSamples: Math.max(...runsSamples),
    longestRunSec: Math.max(...runsSec),
    medianRunSamples: quantile(sortedSamples, 0.5),
    p90RunSec: quantile(sortedSec, 0.9),
  };
}

/**
 * D-08's parts-free, capped per-segment projection (Phase 33, plan 33-10,
 * T-33-13): a PURE function over an already-resolved `segments` list — never
 * calls the detector or `resolveCoverage` itself, so it can be exercised
 * directly against a synthetic `UnreliableSegment[]` fixture (the 101-segment
 * truncation case needs this — building 101 genuinely detected segments from
 * a real/synthetic stream would be nondeterministic and slow). `buildPaceQualityShard`
 * is this function's one production call site, fed the SAME `segments`
 * `resolveCoverage` already resolved for that activity (T-33-12c) — this
 * function performs no detection of its own.
 *
 * Each projected entry carries exactly `startSec`/`endSec`/`metres`/
 * `excessMetres`/`seconds`/`mechanism` — no `parts`, `startIndex`, `endIndex`
 * or burst/gap sub-fields (D-08's rejected "full `UnreliableSegment` objects
 * including `parts`" alternative). Capped at 100, matching
 * `impossibleSamples`'s own cap — measured scale is about 2 segments per
 * flagged activity archive-wide (1,344 segments over 699 flagged activities,
 * `32-CALIBRATION.md`, cited as a reference, not an expected value), so the
 * cap is generous, not tight. `truncated` compares the full segment count
 * against the projected length, exactly as
 * `elevationVerticalRateSamplesTruncated` does for its own capped list.
 */
export function projectUnreliableSegments(
  segments: readonly UnreliableSegment[]
): { segments: PaceQualityShard['unreliableSegments']; truncated: boolean } {
  const projected: PaceQualityShard['unreliableSegments'] = [];
  for (const segment of segments) {
    if (projected.length >= 100) break;
    projected.push({
      startSec: segment.startSec,
      endSec: segment.endSec,
      metres: segment.metres,
      excessMetres: segment.excessMetres,
      seconds: segment.seconds,
      mechanism: segment.mechanism,
    });
  }
  return { segments: projected, truncated: segments.length > projected.length };
}

/**
 * D-15's parts-free, capped per-interval pause-list projection (Phase 34,
 * PAUSE-02, plan 34-08), the exact `projectUnreliableSegments` shape one
 * evidence field later: a PURE function over two already-resolved interval
 * lists — never calls the classifier, the forgotten-stop core, or
 * `resolveCoverage` itself, so it can be exercised directly against a
 * synthetic 101-entry fixture. `buildPaceQualityShard` is this function's
 * one production call site, fed the SAME `classified`/`creep` lists that
 * producer's own single `classifyPauses`/`classifyForgottenStop` calls
 * already resolved.
 *
 * Merges the classifier's own classified intervals with the forgotten-stop
 * core's covered-creep stretches (D-15's two named sources beyond the
 * classifier alone). WR-01/D-22 (2026-09-23): every creep entry's
 * `pauseClass` is classified from the union's OWN `metres`/`seconds` via
 * `classifyPauseSpeed`/`SHIPPED_PAUSE_BANDS`, never hard-coded — a union of
 * individually-bounded windows is not itself bounded in general (D-22), so
 * the class is measured from the same disclosed figures this row renders,
 * and the forgotten-stop marker on the row (not the class) is what makes it
 * a standstill disclosure. `source: 'covered-creep'` is already true on
 * every `PauseInterval` `creep` carries, per `pause-classification.ts`'s own
 * `findCreepStretches`. Sorts the merged list by `startSec`, and caps at
 * `SHARD_LIST_CAP` — same cap as `impossibleSamples`/`unreliableSegments`.
 * `truncated` compares the full merged count against the capped length.
 *
 * WR-07 (2026-09-23, plan 34-16): `SHARD_LIST_CAP` is the ONE exported
 * source of the cap number — this projection (write side), the read-side
 * `parsePaceQualityShard`'s `pauseIntervals` loop, and the rendered
 * truncation notice in `detail-sections.ts` all reference it directly, so
 * the disclosed "first N intervals" sentence can never drift away from the
 * number actually enforced on either side.
 */
export const SHARD_LIST_CAP = 100;

export function projectPauseIntervals(
  classified: readonly ClassifiedPauseInterval[],
  creep: readonly PauseInterval[]
): { entries: PaceQualityShard['pauseIntervals']; truncated: boolean } {
  const merged: PaceQualityShard['pauseIntervals'] = [];
  for (const iv of classified) {
    merged.push({
      source: iv.source,
      pauseClass: iv.pauseClass,
      startSec: iv.startSec,
      endSec: iv.endSec,
      seconds: iv.seconds,
      metres: iv.metres,
      startMetres: iv.startMetres,
    });
  }
  for (const iv of creep) {
    merged.push({
      source: 'covered-creep',
      // WR-01/D-22: a union of individually-bounded windows is NOT itself
      // bounded. Classify from the union's OWN metres/seconds — the same
      // disclosed numbers this row renders — never a hard-coded class. The
      // `?? 'stationary'` fallback is defensive (structurally unreachable in
      // practice, since `findCreepStretches` only ever emits `seconds > 0`
      // windows): "no motion inferred" is the safest total-function default.
      pauseClass: classifyPauseSpeed(iv.metres, iv.seconds, SHIPPED_PAUSE_BANDS) ?? 'stationary',
      startSec: iv.startSec,
      endSec: iv.endSec,
      seconds: iv.seconds,
      metres: iv.metres,
      startMetres: iv.startMetres,
    });
  }
  merged.sort((a, b) => a.startSec - b.startSec);

  const entries = merged.length > SHARD_LIST_CAP ? merged.slice(0, SHARD_LIST_CAP) : merged;
  return { entries, truncated: merged.length > entries.length };
}

/**
 * Builds the D-17 evidence shard for one activity. `gapIntervals` comes
 * straight from the SAME coverage result `gapProfileSignal`'s own tiering
 * derives from (`resolveCoverage`, the sole `classifyGapsWithSegments` call
 * site) — computed once here and shared, never a second independent call.
 * `resolveCoverage`'s `segments` half is likewise shared with
 * `unreliableSegmentsSignal` below (Phase 33 plan 33-09, T-33-12c), never
 * re-resolved.
 *
 * Not-computable activities (no stream, or a stream failing
 * `validateStreamSeries`) return a shard whose `activityId` is set, whose
 * `signals` is the same `notComputableSignals(...)` result
 * `computePaceQualitySignals` would produce, and whose evidence fields are
 * all `null`/empty with `notComputableReason` set — never a throw, never a
 * missing shard.
 */
export function buildPaceQualityShard(
  activityId: string,
  stream: CanonicalStream | null,
  metadata: ActivityQualityMetadata,
  options?: QualityThresholdOverrides
): PaceQualityShard {
  const deviceEra = resolveDeviceFamily(metadata);
  const elapsedVsMoving = elapsedVsMovingSignal(metadata);

  if (stream === null) {
    return {
      activityId,
      signals: notComputableSignals(deviceEra, elapsedVsMoving, NOT_COMPUTABLE_NO_STREAM),
      gapIntervals: [],
      impossibleSamples: [],
      impossibleSamplesTruncated: false,
      zeroAdvanceRunProfile: null,
      adaptiveWindowSec: null,
      notComputableReason: NOT_COMPUTABLE_NO_STREAM,
      elevationVerticalRateSamples: [],
      elevationVerticalRateSamplesTruncated: false,
      elevationLoopRadiusM: LOOP_RADIUS_M,
      elevationStartEndDistM: null,
      unreliableSegments: [],
      unreliableSegmentsTruncated: false,
      pauseIntervals: [],
      pauseIntervalsTruncated: false,
    };
  }

  const { t, d } = stream;
  if (!validateStreamSeries(t as number[], d as number[]).ok) {
    return {
      activityId,
      signals: notComputableSignals(deviceEra, elapsedVsMoving, NOT_COMPUTABLE_UNUSABLE_STREAM),
      gapIntervals: [],
      impossibleSamples: [],
      impossibleSamplesTruncated: false,
      zeroAdvanceRunProfile: null,
      adaptiveWindowSec: null,
      notComputableReason: NOT_COMPUTABLE_UNUSABLE_STREAM,
      elevationVerticalRateSamples: [],
      elevationVerticalRateSamplesTruncated: false,
      elevationLoopRadiusM: LOOP_RADIUS_M,
      elevationStartEndDistM: null,
      unreliableSegments: [],
      unreliableSegmentsTruncated: false,
      pauseIntervals: [],
      pauseIntervalsTruncated: false,
    };
  }

  // The sole coverage-and-segments computation for this activity — shared by
  // the gap-profile signal, this shard's own `gapIntervals`, the seventh
  // signal, and (Phase 34) the ninth/tenth signals plus the pause-interval
  // projection below (Phase 33 plan 33-09, T-33-12c, extended).
  const { coverage, segments, coveredRuns } = resolveCoverage(t, d);
  const gapProfile = tierGapProfileFromCoverage(coverage, options);
  const decimation = decimationSignal(t, d, options);
  const unreliableSegments = unreliableSegmentsSignal(t, d, segments, options);
  // Phase 34 (PAUSE-02, STOP-01, STOP-03): the classifier and forgotten-stop
  // core are each called ONCE here — their raw results feed both the
  // ninth/tenth row signals (via the shared `pauseClassificationFromIntervals`/
  // `forgottenStopFromResult` helpers, the same ones `pauseClassificationSignal`/
  // `forgottenStopSignal` use) and the shard's own `pauseIntervals` projection,
  // never a second independent classifyPauses/classifyForgottenStop call.
  const { intervals: classifiedPauseIntervals, notClassifiableCount: pauseNotClassifiableCount } =
    classifyPauses(t, d, coverage, segments, SHIPPED_PAUSE_BANDS);
  const pauseClassification = pauseClassificationFromIntervals(
    classifiedPauseIntervals,
    pauseNotClassifiableCount
  );
  const forgottenStopResult = classifyForgottenStop(t, d, coverage, coveredRuns, SHIPPED_STOP_PARAMS);
  const forgottenStop = forgottenStopFromResult(forgottenStopResult);

  const impossibleRaw = countImpossibleSamples(t, d, { floorMps: options?.impossibleFloorMps });
  const impossibleSevereCut = options?.impossibleSevereCount ?? IMPOSSIBLE_SAMPLE_SEVERE_COUNT;
  let impossibleTier: QualityTier;
  if (impossibleRaw.count >= impossibleSevereCut) {
    impossibleTier = 'severe';
  } else if (impossibleRaw.count >= IMPOSSIBLE_SAMPLE_MINOR_COUNT) {
    impossibleTier = 'minor';
  } else {
    impossibleTier = 'none';
  }
  const impossibleSignal: ImpossibleSampleSignal = {
    tier: impossibleTier,
    count: impossibleRaw.count,
    maxImpliedSpeedMps: impossibleRaw.maxImpliedSpeedMps,
    countInsideZeroAdvanceRun: impossibleRaw.countInsideZeroAdvanceRun,
  };

  const anySevere = hasAnySevereSignal({
    decimation,
    gapProfile,
    impossibleSamples: impossibleSignal,
  });

  const elevation = elevationSignal(stream, metadata);
  // Same raw scan `elevationSignal`'s own `verticalRateSignal` call performs
  // internally — recomputed here (never a second detector, only a second
  // read of the same evidence) purely to recover the capped sample list for
  // the shard, matching `impossibleRaw` above's exact precedent.
  const elevationRaw = countVerticalRateSamples(t, stream.alt ?? []);

  const signals: ActivityQualitySignals = {
    decimation,
    gapProfile,
    impossibleSamples: impossibleSignal,
    elevation,
    unreliableSegments,
    deviceEra,
    elapsedVsMoving,
    pauseClassification,
    forgottenStop,
    anySevere,
    notComputableReason: null,
  };

  // D-08's parts-free, capped per-segment projection — reads the SAME
  // `segments` `resolveCoverage` already resolved above (T-33-12c), never a
  // second resolver or detector call.
  const { segments: projectedUnreliableSegments, truncated: unreliableSegmentsTruncated } =
    projectUnreliableSegments(segments);

  // D-15's parts-free, capped per-interval pause-list projection — reads the
  // SAME classified-interval/creep lists resolved once above; the not-
  // computable forgotten-stop path contributes no creep entries (its own
  // covered-creep source could not be looked at).
  const creepForProjection = forgottenStopResult.computable ? forgottenStopResult.creep : [];
  const { entries: projectedPauseIntervals, truncated: pauseIntervalsTruncated } = projectPauseIntervals(
    classifiedPauseIntervals,
    creepForProjection
  );

  return {
    activityId,
    signals,
    gapIntervals: coverage.gapIntervals,
    impossibleSamples: impossibleRaw.samples,
    impossibleSamplesTruncated: impossibleRaw.count > impossibleRaw.samples.length,
    zeroAdvanceRunProfile: computeZeroAdvanceRunProfile(t, d),
    adaptiveWindowSec: adaptiveWindowSec(t, d),
    notComputableReason: null,
    elevationVerticalRateSamples: elevationRaw.samples,
    elevationVerticalRateSamplesTruncated: elevationRaw.violatingSamples > elevationRaw.samples.length,
    elevationLoopRadiusM: LOOP_RADIUS_M,
    elevationStartEndDistM: elevation.closureDrift.startEndDistM,
    unreliableSegments: projectedUnreliableSegments,
    unreliableSegmentsTruncated,
    pauseIntervals: projectedPauseIntervals,
    pauseIntervalsTruncated,
  };
}
