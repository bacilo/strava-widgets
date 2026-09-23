/**
 * Pure pause classifier and forgotten-stop core over the detector's own
 * merged output (PAUSE-01, PAUSE-02, STOP-01, STOP-02, STOP-03, D-01, D-02,
 * D-03, D-05, D-09, D-10; the Phase 34 half of SEG-05b).
 *
 * Pure, client-safe leaf module — no `fs`, no `fetch`, no DOM, mirroring
 * `pace-derivation.ts`'s own discipline. Its ONLY imports are from
 * `./pace-derivation.js`: the types `GapInterval`, `PaceCoverage`,
 * `CoveredRun`, `UnreliableSegment` and the values
 * `UNRELIABLE_SPEED_LIMIT_MPS` and `RECORDING_GAP_ABS_THRESHOLD_SEC`. This
 * module never imports the detector directly and never calls it — it only
 * consumes a `{ coverage, segments, coveredRuns }` result the caller already
 * computed via `classifyGapsWithSegments` (SEG-05b: the classifier READS
 * the detector's merged output through `pace-derivation.ts`, it never
 * re-derives a gap, a merge or a mechanism).
 *
 * D-01 — scope: only GAP-BEARING intervals are given a speed class.
 * Recording-gap and gap-adjacent merged-segment intervals get a class from
 * their own merged metres/seconds. Zero-advance `pause` intervals are
 * `'stationary'` by definition (distance does not move) with NO speed test.
 * `hidden-pause`/`isolated-jump` segments carry no off-clock time and sit
 * above the transport speed BY THE DETECTOR'S OWN DEFINITION, so a speed
 * class would call every GPS jump "transported" — they are
 * not-classifiable and counted, never listed.
 *
 * D-03 — no duration floor: every gap-bearing interval is classified
 * however short; it carries its own measured metres and seconds.
 *
 * D-05 — the transported boundary (`UNRELIABLE_SPEED_LIMIT_MPS`) is
 * IMPORTED from `pace-derivation.ts`'s value re-export, never copied as a
 * literal, and never assigned to a same-named detector-internal identifier
 * anywhere in this file — this file's own single-source audit guard
 * verifies both of those facts directly against this file's own source.
 *
 * T-26-01/T-26-02 total-function discipline, restated for this module: any
 * malformed input (`null`/`undefined` arrays, length mismatch, a boundary
 * time absent from `t`) returns an empty/not-computable result or counts
 * the mismatch in `joinViolations`, never throws. "Insufficient data" is
 * always a zeroed/neutral/not-computable result, never a plausible-looking
 * computed zero.
 */

import type { CoveredRun, GapInterval, PaceCoverage, UnreliableSegment } from './pace-derivation.js';
import { RECORDING_GAP_ABS_THRESHOLD_SEC, UNRELIABLE_SPEED_LIMIT_MPS } from './pace-derivation.js';

// ---------------------------------------------------------------------------
// Shared shapes (34-03-PLAN.md <interfaces>)
// ---------------------------------------------------------------------------

/** D-02: four classes, strict speed rungs (see `classifyPauseSpeed`'s docblock). */
export type PauseClass = 'stationary' | 'walked' | 'ran-through' | 'transported';

/** Where a classified/creep interval's metres and seconds came from. */
export type PauseSource = 'recording-gap' | 'merged-segment' | 'zero-advance-pause' | 'covered-creep';

/**
 * The walk/run and stationary/walk speed boundaries (D-06/D-07). Band-free
 * by design — every classifying function TAKES its bands as an argument,
 * since the real calibrated values do not exist until plans 34-04/34-06.
 * Tests use a disclosed synthetic `TEST_BANDS`, never a hand-picked value.
 */
export interface PauseBands {
  stationaryMaxMps: number;
  walkRunMps: number;
}

/** D-13's calibrated near-zero threshold and minimum sustained duration for the forgotten-stop core. */
export interface StopParams {
  stationaryMaxMps: number;
  minSec: number;
}

/** One gap-bearing or creep interval, band-free. */
export interface PauseInterval {
  source: PauseSource;
  startSec: number;
  endSec: number;
  seconds: number;
  metres: number;
  startMetres: number;
}

/** A `PauseInterval` with its speed class attached (D-02). */
export interface ClassifiedPauseInterval extends PauseInterval {
  pauseClass: PauseClass;
}

// ---------------------------------------------------------------------------
// Shipped calibrated constants (plan 34-06's fourth real-archive run)
//
// Every value below is SHIPPED FROM `34-CALIBRATION.md` — the
// "shipped from 34-CALIBRATION" test in `pause-classification.test.ts`
// parses that artifact's `## Chosen constants` lines and asserts each
// export below equal to it, numerically AND character-for-character
// against the artifact's own source-text literal, watched failing under a
// seeded edit of either side (33-14's ship-from-artifact precedent).
// ---------------------------------------------------------------------------

/**
 * D-06/D-07/D-08/D-20 — the stationary/walked class boundary AND (D-07)
 * STOP-02's near-zero forgotten-stop threshold: ONE constant, one
 * definition, never two that could disagree.
 *
 * DEVELOPER-DECLARED (D-20, 2026-09-22), NOT CALIBRATED. Plan 34-06's
 * second real-archive run measured Family G's re-declared shapes (G4
 * pooled, G5 per-activity — standstill-episode drift rate, R-7 p90) on an
 * almost-empty population: archive-wide there are 684 standstill episodes,
 * of which only 6 are chained (0.8772%); G4 and G5 both measured base
 * 0.029873 m/s over that n=6, and both FAILED D-13 insensitivity on both
 * axes (removedDelta 89.7455%, plantedDelta 3902.0881% / 1561.8912% at the
 * mandatory minimum of 1 plant) — a population too small for any shape to
 * clear, not a defensible-value failure. Strawman G FAILED first
 * (plantedDelta 3.6697%), as required before any row is trusted. The
 * developer declared 0.5 m/s (1.8 km/h) on physical grounds: far above the
 * measured drift (~0.03 m/s) and far below the slowest developer-confirmed
 * walking control (1.264 m/s). Family G still measures and renders G4/G5
 * as EVIDENCE for the drift-while-stationary MEASURED NON-ISSUE finding —
 * it never arbitrates a cut for this constant (D-20 narrows D-08 for this
 * ONE constant only). The `d20-basis` gate re-checks the declaration
 * against G4's live measured base on every run (0.029873 < 0.5, PASS).
 * Rejected on argument (never measured, D-19): a low percentile of all
 * pooled covered speeds (overlaps the walking cluster Family W judges);
 * HR-band stillness (HR stays elevated after a stop); pause-interval
 * interiors alone (zero-advance by definition, a degenerate zero base);
 * G3's population restricted outside every J neighbourhood (vacuous
 * REMOVED axis by construction); pre/post-activity stationary tails (no
 * speed-free rule distinguishes them from the pause rule itself); chained
 * plus single-pause standstills together (a single-pause standstill
 * accrues 0 by construction); drift-tick pair speeds inside bridges (wrong
 * unit — a single sample's jump, not a standing-time rate).
 */
export const STATIONARY_MAX_SPEED_MPS = 0.5;

/**
 * D-06/D-08/D-13/D-21 — the walked/ran-through class boundary.
 *
 * DEVELOPER-DECLARED (D-21, 2026-09-22), NOT CALIBRATED. Plan 34-06's
 * third real-archive run cleared Family W's D-13 arbitration for the first
 * time this phase (strawman W FAILED first as required; W1 time-weighted
 * selected first-clearing at 6.95 m/s, base=6.950000, removedDelta
 * 0.0000%, plantedDelta 0.0000%, n=2,612,365; W2 count-weighted also
 * passed at 6.85 m/s) — but the shipped value then FAILED the
 * post-selection `d12-anchor-ii` gate: the first confirmed walking-break
 * control's rest-of-activity covered speed (2.8257 m/s, an easy-running
 * pace) did not exceed 6.95 m/s. A live histogram dump showed W1's
 * population is UNIMODAL — one hump peaking at 3.0-3.1 m/s over 2.6M
 * covered seconds, with no dip anywhere near the developer-confirmed
 * walking speeds (1.26-1.80 m/s); the valley-picking rule (global-minimum
 * qualifying bin) landed instead in a sparse tail bin (6.90-7.00 m/s, 309
 * of 2.6M seconds) near the 7.35 m/s unreliable-speed ceiling — not a
 * genuine walk/run transition. D-06's premise (a walk/run valley exists in
 * this athlete's own covered-time speed distribution) is measured not to
 * hold on this archive. The developer declared 2.2 m/s (7:35/km): it sits
 * between the developer-confirmed walking controls (1.26-1.80 m/s) and the
 * measured running hump (3.0-3.1 m/s). Family W still measures and renders
 * strawman W/W1/W2 as EVIDENCE for the no-valley finding — it never
 * arbitrates a cut for this constant (D-21 narrows D-06 and D-08 for this
 * ONE constant only). The `d21-basis` gate re-checks the declaration
 * against live evidence on every run: strictly greater than every
 * confirmed control's own window aggregate speed (max 1.797 m/s) AND
 * strictly less than the covered-time histogram's modal bin centre
 * (3.050 m/s) — both PASS. Disclosed consequence, not a gate: at 2.2 m/s
 * every one of 3475724402's 18 merged intervals (2.307-4.065 m/s)
 * classifies `ran-through` rather than splitting, per D-21's own note;
 * criterion 1 is per-segment agreement with the independent table and
 * never a pinned class, so nothing fails. Rejected on argument: a
 * per-activity valley percentile (most activities contain no walking
 * hump, so the population would be selected by the property being
 * measured); a cadence-split anchor (needs its own uncalibrated cadence
 * constant).
 */
export const WALK_RUN_BOUNDARY_MPS = 2.2;

/**
 * D-06/D-07/D-08/D-09/D-13 — the minimum sustained near-zero-speed
 * duration for both `findCreepStretches` (STOP-02's covered-creep source)
 * and the shared zero-advance `pause` rule's own scale (D-07: one duration
 * definition for both D-09 sources).
 *
 * CALIBRATED (Family M, plan 34-06's fourth real-archive run, first time
 * this constant has ever been SELECTED by arbitration on the real
 * archive). Strawman M FAILED first (population emptied under removal, as
 * required before any row is trusted). Pre-declared shape **M1** — the
 * pause-rule scale, conservative (R-7 p90 of each activity's own P_a
 * across activities) — was the first-clearing shape: base=40.000000
 * (n=1873 activities), removedDelta=0.0000% (n=1870), plantedDelta=
 * 0.0000% (n=1873, plants=26276). M2 (the same population, typical/p50
 * scale, base 30.000000) also cleared but ranks second in the pre-declared
 * order. Non-circularity: P_a comes from each activity's full
 * advance-interval distribution (thousands of intervals) under the
 * already-calibrated `PAUSE_GAP_P90_MULTIPLIER` — no creep stretch, band
 * or class enters it. Rejected on argument: run lengths of pre-pause creep
 * (the same mixed population the retired G3 shape disclosed as
 * contaminated); any round-number duration, including the scoping
 * probe's 30s/120s figures, which are references only and never a shape.
 */
export const FORGOTTEN_STOP_MIN_SEC = 40;

/**
 * D-06/D-07 composed: the shipped `PauseClass` boundaries, built from the
 * two constants above — never a repeated `0.5`/`2.2` literal anywhere else
 * in this module or its consumers (D-07's one-definition rule, verified by
 * `grep -cE "stationaryMaxMps: [0-9]"` finding zero matches in this file).
 */
export const SHIPPED_PAUSE_BANDS: PauseBands = {
  stationaryMaxMps: STATIONARY_MAX_SPEED_MPS,
  walkRunMps: WALK_RUN_BOUNDARY_MPS,
};

/**
 * D-07/D-09/D-13 composed: the shipped `StopParams` for
 * `classifyForgottenStop`, built from the same stationary constant
 * `SHIPPED_PAUSE_BANDS` uses (D-07's one-constant rule) and the calibrated
 * minimum duration above — never a repeated literal.
 */
export const SHIPPED_STOP_PARAMS: StopParams = {
  stationaryMaxMps: STATIONARY_MAX_SPEED_MPS,
  minSec: FORGOTTEN_STOP_MIN_SEC,
};

// ---------------------------------------------------------------------------
// The mechanism-lookup join (D-01, 34-RESEARCH.md Pattern 1/Pitfall 1)
// ---------------------------------------------------------------------------

/**
 * Builds a `t`-value -> sample-index lookup once per activity (O(n)), so
 * every interval-boundary lookup below is O(1) rather than a repeated
 * `Array.indexOf` (O(n) each) — the production discipline
 * 34-RESEARCH.md Pattern 2 calls for.
 */
function buildIndexByTime(t: readonly number[]): Map<number, number> {
  const map = new Map<number, number>();
  for (let i = 0; i < t.length; i++) {
    map.set(t[i], i);
  }
  return map;
}

/**
 * Derives one `PauseInterval` from a `GapInterval` whose boundary times
 * must be real `t[i]` values (`classifyGapsWithSegments` only ever builds
 * interval boundaries from samples, never interpolated times). Returns
 * `null` — never throws — when a boundary time is not found in the
 * `t`-to-index map, so the caller can count it as a join violation rather
 * than crash on a corrupted/adversarial `coverage` object.
 */
function intervalFromGapInterval(
  d: readonly number[],
  indexByTime: ReadonlyMap<number, number>,
  gi: GapInterval,
  source: PauseSource
): PauseInterval | null {
  const startIdx = indexByTime.get(gi.startSec);
  const endIdx = indexByTime.get(gi.endSec);
  if (startIdx === undefined || endIdx === undefined) return null;

  return {
    source,
    startSec: gi.startSec,
    endSec: gi.endSec,
    seconds: gi.endSec - gi.startSec,
    metres: d[endIdx] - d[startIdx],
    startMetres: d[startIdx],
  };
}

/**
 * The exhaustive mechanism-lookup join (D-01, 34-RESEARCH.md Open Question
 * 1, RESOLVED). `coverage.gapIntervals` entries with `kind: 'unreliable'`
 * do NOT by themselves distinguish gap-adjacent (classifiable) from
 * hidden-pause/isolated-jump (not-classifiable) — the mechanism lives only
 * on the separate `segments` array. Pass-3 of `classifyGapsWithSegments`
 * can fold TWO OR MORE pair-adjacent segments into ONE merged `'unreliable'`
 * `gapIntervals` entry (34-RESEARCH.md Open Question 1) — this join
 * resolves every segment to the interval that structurally contains it via
 * a sorted two-pointer sweep, never an audit-banned linear re-scan of the
 * interval list for membership, and counts BOTH failure directions:
 *   - an `'unreliable'`-kind interval with no segment inside it
 *   - a segment that falls inside no `'unreliable'`-kind interval
 * Total: `null`/`undefined` `gapIntervals` or `segments` returns the zeroed
 * result rather than throwing.
 */
export function joinUnreliableIntervals(
  gapIntervals: readonly GapInterval[],
  segments: readonly UnreliableSegment[]
): { gapAdjacent: UnreliableSegment[]; notClassifiableCount: number; violations: number } {
  if (gapIntervals == null || segments == null) {
    return { gapAdjacent: [], notClassifiableCount: 0, violations: 0 };
  }

  const unreliableIntervals = gapIntervals
    .filter((gi) => gi.kind === 'unreliable')
    .slice()
    .sort((a, b) => a.startSec - b.startSec);
  const sortedSegments = segments.slice().sort((a, b) => a.startSec - b.startSec);

  const gapAdjacent: UnreliableSegment[] = [];
  let notClassifiableCount = 0;
  let violations = 0;

  // Sorted two-pointer sweep: `intervalIdx` only ever advances forward,
  // since both arrays are ascending and each is internally non-overlapping
  // (34-RESEARCH.md Open Question 1's own resolution recommendation).
  const intervalHasMatch: boolean[] = new Array(unreliableIntervals.length).fill(false);
  let intervalIdx = 0;
  for (const seg of sortedSegments) {
    while (
      intervalIdx < unreliableIntervals.length &&
      unreliableIntervals[intervalIdx].endSec < seg.startSec
    ) {
      intervalIdx++;
    }
    const interval = unreliableIntervals[intervalIdx];
    const contained =
      interval !== undefined && seg.startSec >= interval.startSec && seg.endSec <= interval.endSec;

    if (!contained) {
      violations++; // a segment inside no 'unreliable' interval
      continue;
    }

    intervalHasMatch[intervalIdx] = true;
    if (seg.mechanism === 'gap-adjacent') {
      gapAdjacent.push(seg);
    } else {
      // hidden-pause / isolated-jump — not-classifiable (D-01), stays only
      // in the existing Unreliable Segments disclosure.
      notClassifiableCount++;
    }
  }

  for (const hasMatch of intervalHasMatch) {
    if (!hasMatch) violations++; // an 'unreliable' interval with no segment inside it
  }

  return { gapAdjacent, notClassifiableCount, violations };
}

/**
 * Collects every gap-bearing `PauseInterval`, band-free (D-01, D-03). Three
 * sources: raw `recording-gap` intervals (metres derived via the
 * `t`-to-index map, since `GapInterval` itself carries no metres field —
 * 34-RESEARCH.md Pattern 2/Pitfall 2), zero-advance `pause` intervals
 * (source `'zero-advance-pause'`, metres derived the same way — normally 0
 * by construction, but never assumed to be), and `gap-adjacent` merged
 * segments via `joinUnreliableIntervals` (their OWN `metres`/`seconds`,
 * never re-derived from `gapIntervals`). No duration floor (D-03) — every
 * gap-bearing interval is included however short. Sorted by `startSec`.
 * Total: any malformed input returns the empty result rather than throwing.
 */
export function collectPauseIntervals(
  t: readonly number[],
  d: readonly number[],
  coverage: PaceCoverage,
  segments: readonly UnreliableSegment[]
): { intervals: PauseInterval[]; notClassifiableCount: number; joinViolations: number } {
  if (
    t == null ||
    d == null ||
    coverage == null ||
    coverage.gapIntervals == null ||
    t.length !== d.length
  ) {
    return { intervals: [], notClassifiableCount: 0, joinViolations: 0 };
  }

  const indexByTime = buildIndexByTime(t);
  const intervals: PauseInterval[] = [];
  let joinViolations = 0;

  for (const gi of coverage.gapIntervals) {
    if (gi.kind !== 'pause' && gi.kind !== 'recording-gap') continue;
    const source: PauseSource = gi.kind === 'pause' ? 'zero-advance-pause' : 'recording-gap';
    const interval = intervalFromGapInterval(d, indexByTime, gi, source);
    if (interval === null) {
      joinViolations++;
      continue;
    }
    intervals.push(interval);
  }

  const { gapAdjacent, notClassifiableCount, violations } = joinUnreliableIntervals(
    coverage.gapIntervals,
    segments
  );
  joinViolations += violations;
  for (const seg of gapAdjacent) {
    // WR-05: every other boundary lookup in this file routes through
    // `intervalFromGapInterval`, which counts a failed lookup as a
    // `joinViolation` rather than emitting `undefined`. This branch bypassed
    // that — an out-of-range `seg.startIndex` produced `startMetres:
    // undefined` (typed `number`, silently dropped by `JSON.stringify`).
    // Validate the same way every sibling path does.
    const startMetres = d[seg.startIndex];
    if (!Number.isFinite(startMetres)) {
      joinViolations++; // a segment whose startIndex does not address this stream
      continue;
    }
    intervals.push({
      source: 'merged-segment',
      startSec: seg.startSec,
      endSec: seg.endSec,
      seconds: seg.seconds,
      metres: seg.metres,
      startMetres,
    });
  }

  intervals.sort((a, b) => a.startSec - b.startSec);
  return { intervals, notClassifiableCount, joinViolations };
}

// ---------------------------------------------------------------------------
// Speed classification (D-02, D-05)
// ---------------------------------------------------------------------------

/**
 * The top speed rung, defined once (D-05) and reused by `classifyPauseSpeed`
 * — `speed = metres / seconds` strictly greater than the imported
 * `UNRELIABLE_SPEED_LIMIT_MPS`, matching the detector's own strict
 * "metres > limit x seconds" fast-step rule. `false` on `seconds <= 0` or a
 * non-finite input (never throws, never a plausible-looking computed
 * `false`-by-coercion).
 */
export function isTransported(metres: number, seconds: number): boolean {
  if (!Number.isFinite(metres) || !Number.isFinite(seconds) || seconds <= 0) return false;
  return metres / seconds > UNRELIABLE_SPEED_LIMIT_MPS;
}

/**
 * D-02's four-class speed ladder, inclusive/strict exactly as measured:
 *   - `speed <= bands.stationaryMaxMps` -> `'stationary'`
 *   - `speed <= bands.walkRunMps` -> `'walked'`
 *   - `speed <= UNRELIABLE_SPEED_LIMIT_MPS` -> `'ran-through'`
 *   - else (`isTransported`) -> `'transported'`
 * Returns `null` on `seconds <= 0` or a non-finite `metres`/`seconds` —
 * there is no basis to judge a speed for a zero-or-negative-duration or
 * corrupted interval, and `null` (never a coerced class) is the honest
 * total-function answer (T-26-02).
 */
export function classifyPauseSpeed(metres: number, seconds: number, bands: PauseBands): PauseClass | null {
  if (!Number.isFinite(metres) || !Number.isFinite(seconds) || seconds <= 0) return null;
  if (isTransported(metres, seconds)) return 'transported';

  const speed = metres / seconds;
  if (speed <= bands.stationaryMaxMps) return 'stationary';
  if (speed <= bands.walkRunMps) return 'walked';
  return 'ran-through';
}

/**
 * Composes `collectPauseIntervals` and `classifyPauseSpeed` (D-01, D-02).
 * `'zero-advance-pause'`-source intervals are fixed to `'stationary'`
 * WITHOUT calling the speed test at all (D-01/D-03 — distance does not
 * move, by definition, so no speed test is needed or wanted). Every other
 * source is classified via `classifyPauseSpeed`; the defensive
 * `'stationary'` fallback below is for the (structurally unreachable in
 * practice, given `collectPauseIntervals` only ever emits `seconds > 0`
 * gap-bearing intervals) case where `classifyPauseSpeed` returns `null` —
 * "no motion inferred" is the safest total-function default, never a
 * fabricated fast class.
 */
export function classifyPauses(
  t: readonly number[],
  d: readonly number[],
  coverage: PaceCoverage,
  segments: readonly UnreliableSegment[],
  bands: PauseBands
): { intervals: ClassifiedPauseInterval[]; notClassifiableCount: number; joinViolations: number } {
  const { intervals, notClassifiableCount, joinViolations } = collectPauseIntervals(t, d, coverage, segments);

  const classified: ClassifiedPauseInterval[] = intervals.map((interval) => {
    if (interval.source === 'zero-advance-pause') {
      return { ...interval, pauseClass: 'stationary' };
    }
    const pauseClass = classifyPauseSpeed(interval.metres, interval.seconds, bands) ?? 'stationary';
    return { ...interval, pauseClass };
  });

  return { intervals: classified, notClassifiableCount, joinViolations };
}

// ---------------------------------------------------------------------------
// D-10: the recording-mechanism (distance-triggered blind-spot) signature
// ---------------------------------------------------------------------------

/** Pre-declared, measured constants (34-RESEARCH.md § D-10 Blind-Spot Rule) — never tuned here. */
export const DISTANCE_TRIGGERED_MAX_CV_DD = 0.2;
export const DISTANCE_TRIGGERED_MAX_CV_RATIO = 0.8;
export const SIGNATURE_MIN_COVERED_PAIRS = 30;

export const NOT_COMPUTABLE_DISTANCE_TRIGGERED =
  'distance-triggered recording: a standstill would be written as a recording gap, not a covered creep, so the forgotten-stop flag cannot see it';
export const NOT_COMPUTABLE_TOO_FEW_SIGNATURE_PAIRS =
  'fewer than 30 covered pairs available to compute the recording-mechanism signature';

export type RecordingMechanismSignature =
  | { computable: true; cvDt: number; cvDd: number; ratio: number; distanceTriggered: boolean }
  | { computable: false; reason: string };

function mean(values: readonly number[]): number {
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

function stdev(values: readonly number[]): number {
  const m = mean(values);
  let sumSq = 0;
  for (const v of values) sumSq += (v - m) ** 2;
  return Math.sqrt(sumSq / values.length);
}

/**
 * Classifies a STREAM's own sampling regularity — never a class, a band or
 * a stop (34-RESEARCH.md Pitfall 5's non-circularity note, restated here):
 * it only ever gates the STOP-01 flag's computability, never PAUSE-01's
 * band derivation. Time-triggered devices hold the sample interval (`dt`)
 * almost perfectly constant while the per-sample distance advance (`dd`)
 * varies with pace; distance-triggered devices show the mirror image —
 * `dd` varies LESS than `dt` does. Restricted to pairs with `0 < dt <=
 * RECORDING_GAP_ABS_THRESHOLD_SEC` (imported, never a local literal
 * duplicate) and `dd > 0` (covered, advancing pairs only). Population
 * coefficient of variation, `ratio = cvDd / cvDt` (`Infinity` when `cvDt
 * === 0`, since a perfectly-regular-time device varies MORE than
 * infinitely relative to a truly-constant `dt`). `distanceTriggered =
 * cvDd < DISTANCE_TRIGGERED_MAX_CV_DD && ratio < DISTANCE_TRIGGERED_MAX_CV_RATIO`.
 * Fewer than `SIGNATURE_MIN_COVERED_PAIRS` qualifying pairs is its own
 * distinct not-computable reason, separate from "distance-triggered". The
 * three constants above are pre-declared from research and verified in the
 * calibration artifact (plan 34-04), not tuned here (Phase 27's D-02
 * anti-quota rule).
 */
export function recordingMechanismSignature(
  t: readonly number[],
  d: readonly number[]
): RecordingMechanismSignature {
  if (t == null || d == null) {
    return { computable: false, reason: NOT_COMPUTABLE_TOO_FEW_SIGNATURE_PAIRS };
  }

  const n = Math.min(t.length, d.length);
  const dts: number[] = [];
  const dds: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dt = t[i + 1] - t[i];
    const dd = d[i + 1] - d[i];
    if (!Number.isFinite(dt) || !Number.isFinite(dd)) continue;
    if (dt <= 0 || dt > RECORDING_GAP_ABS_THRESHOLD_SEC) continue; // exclude recording gaps
    if (dd <= 0) continue; // exclude flat/pause pairs
    dts.push(dt);
    dds.push(dd);
  }

  if (dts.length < SIGNATURE_MIN_COVERED_PAIRS) {
    return { computable: false, reason: NOT_COMPUTABLE_TOO_FEW_SIGNATURE_PAIRS };
  }

  const cvDt = stdev(dts) / mean(dts);
  const cvDd = stdev(dds) / mean(dds);
  const ratio = cvDt > 0 ? cvDd / cvDt : Infinity;
  const distanceTriggered = cvDd < DISTANCE_TRIGGERED_MAX_CV_DD && ratio < DISTANCE_TRIGGERED_MAX_CV_RATIO;

  return { computable: true, cvDt, cvDd, ratio, distanceTriggered };
}

// ---------------------------------------------------------------------------
// Forgotten-stop core (D-09, D-10, D-11)
// ---------------------------------------------------------------------------

/**
 * Finds `'covered-creep'` stretches — sustained near-zero-speed windows
 * INSIDE covered time only (D-09; never computed from `coverage.coveredSec`
 * alone, per 34-RESEARCH.md's Anti-Pattern: the aggregate total says
 * nothing about internal speed variation). Runs independently inside each
 * `CoveredRun`, so a stretch can never span a covered-run boundary (a
 * recording gap, pause or unreliable segment always sits between two
 * `CoveredRun`s). For every sample index `i` in a run, finds the smallest
 * `j >= i` with `t[j] - t[i] >= minSec` via a two-pointer sweep (`j` is
 * non-decreasing as `i` increases, giving O(n) per run) and keeps the
 * window when its OWN aggregate speed `(d[j] - d[i]) / (t[j] - t[i])` is
 * `<= maxSpeedMps` — every CONSTITUENT window satisfies the bound.
 *
 * D-22 UNION SEMANTICS (2026-09-23, plan 34-15 — retires plan 34-06's
 * stronger claim below): a covered-creep stretch is the MAXIMAL UNION of
 * qualifying windows that SHARE AT LEAST ONE SAMPLE INDEX, reported ONCE
 * with the union's own `seconds`/`metres`, recomputed fresh from the
 * union's own start/end samples (never summed or averaged from the
 * constituent windows). Two windows overlapping, or one contained in the
 * other, merge; sharing only the boundary sample (one window's `endIdx`
 * equal to the next window's `startIdx`) also counts as sharing and
 * merges. Windows that share NO sample index stay separate, however close
 * in time — adjacency alone never merges, because the samples strictly
 * between two disjoint windows are not covered by any qualifying window,
 * and reporting that gap as standstill would be unevidenced. The merge
 * step NEVER consults the growing union's own aggregate speed as a merge
 * condition — under D-22 that speed is a DISCLOSED OUTPUT of the returned
 * interval, never a guarantee, since a union of individually-bounded
 * windows is not itself bounded in general (two overlapping low-speed
 * windows can straddle a faster segment that only surfaces once they are
 * joined; plan 34-06's original merge-boundary fix discovered this, then
 * plan 34-11's browser checkpoint found that FIX itself double-counted
 * overlapping stretches by starting a second, overlapping stretch whenever
 * a union would have exceeded the bound — see 34-CONTEXT.md D-22).
 *
 * WR-04 (2026-09-23, plan 34-16): this shape mirrors
 * `scripts/compute-walking-break-evidence.mjs`'s independent
 * `localCreepWindows` oracle in its MERGE step exactly — collect every
 * qualifying window first, then merge by index overlap in one pass, so
 * per-source count, total seconds and longest stretch are a true partition
 * of standstill time with no double counting (what STOP-01 asks for). Its
 * ADMISSIBILITY step differs by construction and MUST: this function runs
 * inside each `CoveredRun`, so a zero-advance pause pair always breaks a
 * window; the oracle, which may not import this detector (D-18), approximates
 * that with a local `dt > 10 s` gap test and therefore ADMITS pause-interior
 * samples this function excludes. On a stream with a pause run longer than
 * `minSec`, the oracle reports a creep window this function does not — a
 * known definitional gap, never a production defect (34-15's archive-wide
 * reconciliation found and structurally explained all 13 such disagreements
 * on the current archive). Quote the oracle as an expected value only for a
 * window containing no `'pause'`-kind `gapIntervals` entry (34-VALIDATION.md
 * states this procedure beside the rows that quote it).
 *
 * RETIRED (plan 34-06, superseded by D-22): "every RETURNED stretch's own
 * `metres / seconds` is `<= maxSpeedMps`" — false in general; the UNION's
 * own aggregate speed may exceed the bound even though every window that
 * built it does not (disclosed, not asserted).
 *
 * CR-02 (2026-09-23, plan 34-16): total — `null`/`undefined` input or a
 * `t`/`d` length mismatch (the module docblock's own named malformed-input
 * class) returns `[]`; a non-finite `seconds`/`metres` inside an otherwise
 * well-formed window is rejected explicitly, never accepted by a bare
 * `NaN > max` comparison (which is `false`).
 */
export function findCreepStretches(
  t: readonly number[],
  d: readonly number[],
  coveredRuns: readonly CoveredRun[],
  maxSpeedMps: number,
  minSec: number
): PauseInterval[] {
  if (t == null || d == null || coveredRuns == null) return [];
  // CR-02: the module docblock's own named malformed-input class — a length
  // mismatch is never accepted here, matching `collectPauseIntervals`' own
  // guard above.
  if (t.length !== d.length) return [];

  const result: PauseInterval[] = [];

  for (const run of coveredRuns) {
    const runStart = run.startIndex;
    const runEnd = run.endIndex;
    if (runEnd <= runStart || runEnd >= t.length || runEnd >= d.length || runStart < 0) continue;

    // Pass 1: collect every window that independently qualifies (D-22's constituent bound).
    const qualifying: { startIdx: number; endIdx: number }[] = [];
    let j = runStart;
    for (let i = runStart; i <= runEnd; i++) {
      if (j < i) j = i;
      while (j <= runEnd && t[j] - t[i] < minSec) j++;
      if (j > runEnd) break; // no window of at least minSec fits starting at i within this run

      const seconds = t[j] - t[i];
      const metres = d[j] - d[i];
      // CR-02: reject non-finite explicitly. `NaN > max` is `false`, so a
      // bare `>` comparison ACCEPTS a corrupted window rather than
      // rejecting it — this is the load-bearing half of the fix, since it
      // also closes the same hole for a NaN inside an otherwise
      // length-matched `t`/`d`.
      if (!Number.isFinite(seconds) || !Number.isFinite(metres)) continue;
      if (seconds <= 0 || metres / seconds > maxSpeedMps) continue;

      qualifying.push({ startIdx: i, endIdx: j });
    }

    // Pass 2: union qualifying windows that SHARE AT LEAST ONE SAMPLE INDEX (D-22). `qualifying`
    // is already ascending in both startIdx and endIdx (the two-pointer sweep above is
    // monotonic), matching the oracle's own post-sort order — no separate sort needed. The
    // union's own aggregate speed is NEVER consulted here: it is an output of the merge, never a
    // merge condition.
    const mergedStretches: { startIdx: number; endIdx: number }[] = [];
    for (const w of qualifying) {
      const last = mergedStretches[mergedStretches.length - 1];
      if (last !== undefined && w.startIdx <= last.endIdx) {
        if (w.endIdx > last.endIdx) last.endIdx = w.endIdx;
      } else {
        mergedStretches.push({ startIdx: w.startIdx, endIdx: w.endIdx });
      }
    }

    for (const stretch of mergedStretches) {
      result.push({
        source: 'covered-creep',
        startSec: t[stretch.startIdx],
        endSec: t[stretch.endIdx],
        seconds: t[stretch.endIdx] - t[stretch.startIdx],
        metres: d[stretch.endIdx] - d[stretch.startIdx],
        startMetres: d[stretch.startIdx],
      });
    }
  }

  return result;
}

/**
 * The forgotten-stop core (D-09, D-10, D-11): a timer-running standstill
 * covers two sources, itemised separately — `'covered-creep'` stretches
 * (`findCreepStretches`) and the existing zero-advance `'pause'`
 * `gapIntervals` entries. Recording gaps are NEVER included (D-09 — auto-
 * pause or signal loss, the timer was not running). The D-10 blind-spot
 * signature is checked FIRST: a stream with too few signature pairs, or one
 * whose recording mechanism is distance-triggered (a standstill would be
 * written as a recording gap, structurally invisible to this function),
 * short-circuits to `{ computable: false, reason }` before either source is
 * computed — a clean `{ computable: true, ... }` result always means
 * "looked and found none", never "could not look". Total: never throws.
 */
export function classifyForgottenStop(
  t: readonly number[],
  d: readonly number[],
  coverage: PaceCoverage,
  coveredRuns: readonly CoveredRun[],
  params: StopParams
): { computable: true; creep: PauseInterval[]; pauses: PauseInterval[] } | { computable: false; reason: string } {
  const signature = recordingMechanismSignature(t, d);
  if (!signature.computable) {
    return { computable: false, reason: signature.reason };
  }
  if (signature.distanceTriggered) {
    return { computable: false, reason: NOT_COMPUTABLE_DISTANCE_TRIGGERED };
  }

  const creep = findCreepStretches(t, d, coveredRuns ?? [], params.stationaryMaxMps, params.minSec);

  const pauses: PauseInterval[] = [];
  if (t != null && d != null && coverage != null && coverage.gapIntervals != null && t.length === d.length) {
    const indexByTime = buildIndexByTime(t);
    for (const gi of coverage.gapIntervals) {
      if (gi.kind !== 'pause') continue;
      const interval = intervalFromGapInterval(d, indexByTime, gi, 'zero-advance-pause');
      if (interval !== null) pauses.push(interval);
    }
  }

  return { computable: true, creep, pauses };
}
