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
    intervals.push({
      source: 'merged-segment',
      startSec: seg.startSec,
      endSec: seg.endSec,
      seconds: seg.seconds,
      metres: seg.metres,
      startMetres: d[seg.startIndex],
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
 * window when its aggregate speed `(d[j] - d[i]) / (t[j] - t[i])` is `<=
 * maxSpeedMps`. Overlapping/adjacent qualifying windows are unioned into
 * one maximal stretch, but ONLY while the growing union's OWN aggregate
 * speed also stays `<= maxSpeedMps` — verified before every extension
 * (plan 34-06 Task 2's own "walking-break control" DEFINITIONAL test found
 * this the hard way: a naive index-range union of individually-bounded
 * windows is not itself bounded in general, since two overlapping low-speed
 * windows can straddle a faster segment that only surfaces once they are
 * joined). A window whose union with the current stretch WOULD exceed the
 * bound starts its own stretch instead (it independently qualifies on its
 * own span). INVARIANT: every returned `PauseInterval`'s own
 * `metres / seconds` is `<= maxSpeedMps` — never merely "built from
 * qualifying windows". Total: `null`/`undefined` input returns `[]`.
 */
export function findCreepStretches(
  t: readonly number[],
  d: readonly number[],
  coveredRuns: readonly CoveredRun[],
  maxSpeedMps: number,
  minSec: number
): PauseInterval[] {
  if (t == null || d == null || coveredRuns == null) return [];

  const result: PauseInterval[] = [];

  for (const run of coveredRuns) {
    const runStart = run.startIndex;
    const runEnd = run.endIndex;
    if (runEnd <= runStart || runEnd >= t.length || runStart < 0) continue;

    const mergedStretches: { startIdx: number; endIdx: number }[] = [];
    let j = runStart;
    for (let i = runStart; i <= runEnd; i++) {
      if (j < i) j = i;
      while (j <= runEnd && t[j] - t[i] < minSec) j++;
      if (j > runEnd) break; // no window of at least minSec fits starting at i within this run

      const seconds = t[j] - t[i];
      const metres = d[j] - d[i];
      if (seconds <= 0 || metres / seconds > maxSpeedMps) continue;

      // This window [i, j] independently satisfies the bound (checked above). Extending the
      // PREVIOUS stretch to cover it is only safe if the EXTENDED union's own aggregate speed
      // ALSO satisfies the bound — a union of individually-bounded windows is not itself
      // guaranteed bounded (two overlapping low-speed windows can straddle a faster segment
      // whose own contribution only shows up once the two are joined into one longer span).
      // Verifying the candidate union's own speed before committing to it, rather than simply
      // taking the index-range union, keeps every RETURNED stretch's own metres/seconds within
      // maxSpeedMps — the property `findCreepStretches`' own docblock and every downstream
      // consumer (the walking-break control's DEFINITIONAL regression tripwire; STOP-02's
      // Pauses-section disclosure) relies on.
      const last = mergedStretches[mergedStretches.length - 1];
      if (last !== undefined && i <= last.endIdx) {
        if (j <= last.endIdx) continue; // already fully covered by the existing bounded stretch
        const candidateEndIdx = j;
        const candidateSeconds = t[candidateEndIdx] - t[last.startIdx];
        const candidateMetres = d[candidateEndIdx] - d[last.startIdx];
        if (candidateSeconds > 0 && candidateMetres / candidateSeconds <= maxSpeedMps) {
          last.endIdx = candidateEndIdx;
        } else {
          // The union would exceed the bound — [i, j] still independently qualifies (checked
          // above), so it starts its own stretch rather than being folded into `last`.
          mergedStretches.push({ startIdx: i, endIdx: j });
        }
      } else {
        mergedStretches.push({ startIdx: i, endIdx: j });
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
