/**
 * Shared gap-aware pace derivation over the committed, decimated `{t[], d[]}`
 * stream shape (PACE-01, PACE-02, COV-01, D-15).
 *
 * Pure, client-safe module — no `fs`, no `fetch`, no DOM. It is imported by
 * both the dashboard render path (browser) and the CI compute chain (Node),
 * so it cannot take a Node-only or browser-only dependency, mirroring the
 * discipline `trimp.ts:1-21` states for the same reason.
 *
 * Pitfall 2 (18-RESEARCH.md § Common Pitfalls, restated here as this
 * module's consumer of the house rule): `CanonicalStream.t` is decimated and
 * irregularly spaced (variable sample intervals), not fixed-Hz. Every
 * accounting in this file integrates by the REAL `Δt` between consecutive
 * samples (`t[i + 1] - t[i]`), never by sample count — the same discipline
 * `derivePaceSeries`, `computeHrZoneTimes` and `edwardsTrimp`/`banisterTrimp`
 * already honour.
 *
 * D-06: the coverage denominator is the STREAM'S OWN SPAN, `t[n-1] - t[0]`.
 * `CanonicalStream` carries no `elapsed_time` field — that is activity
 * metadata, read from a different file, and is deliberately never consulted
 * here. Coverage is a property of the stream alone.
 *
 * This file holds the classification + exact-coverage-accounting half of the
 * module (PACE-02, COV-01). Every exported function is total: any
 * array-shaped input, including a malformed or adversarial stream, returns a
 * zeroed result rather than throwing (T-26-01). No `?? 0` / `|| 0` coercion
 * anywhere below — "insufficient data" is always a zeroed/neutral result,
 * never a plausible-looking computed zero (T-26-02).
 */

import { validateStreamSeries } from './best-effort-utils.js';
import type { CanonicalStream } from '../streams/stream.types.js';

/**
 * Absolute-time threshold above which a `[t[i], t[i+1]]` segment is a
 * `recording-gap` rather than a `pause` or `covered` segment. Unchanged from
 * PROJECT.md's existing 1,233-activity cohort (a gap >10s with no samples
 * recorded across it) — 26-RESEARCH.md found no evidence this constant needs
 * to move.
 */
export const RECORDING_GAP_ABS_THRESHOLD_SEC = 10;

/**
 * Multiplier applied to an activity's own p90 distance-advance interval to
 * derive its pause threshold (D-04, D-05). 26-RESEARCH.md's measurement:
 * K=4 is the minimum multiplier reaching 0.00% pause on all four measured
 * interval profiles (medians 2s / 16s / 24s / 60s); K=5 ships with a full
 * extra multiple of headroom rather than shipping at the exact boundary.
 */
export const PAUSE_GAP_P90_MULTIPLIER = 5;

/** The two named non-covered segment categories (D-04). */
export type GapKind = 'recording-gap' | 'pause';

/** One merged run of adjacent same-kind non-covered segments, in real time. */
export interface GapInterval {
  startSec: number;
  endSec: number;
  kind: GapKind;
}

/**
 * Exact coverage accounting over one stream's span. `coveredSec +
 * recordingGapSec + pauseSec === spanSec` by construction (COV-01, D-07) —
 * every segment lands in exactly one category, none is skipped.
 */
export interface PaceCoverage {
  spanSec: number;
  coveredSec: number;
  recordingGapSec: number;
  pauseSec: number;
  gapIntervals: GapInterval[];
}

/**
 * How the pause threshold is derived. `scale-relative` (the shipped default,
 * D-04) computes the threshold from the activity's own advance-interval
 * distribution; `absolute` is a fixed seconds value, kept only so Task 2 can
 * demonstrate the absolute rule's D-05 misclassification failing before the
 * scale-relative rule is trusted.
 */
export type PauseRule =
  | { kind: 'scale-relative'; multiplier: number }
  | { kind: 'absolute'; thresholdSec: number };

/** Returns a fresh zeroed result — never a shared/mutable module-level constant. */
function zeroCoverage(): PaceCoverage {
  return { spanSec: 0, coveredSec: 0, recordingGapSec: 0, pauseSec: 0, gapIntervals: [] };
}

/**
 * R-7 linear-interpolation quantile (numpy's / D3's default): `pos = (len -
 * 1) * q`, interpolating between `floor(pos)` and `ceil(pos)`. `sortedAsc`
 * must already be sorted ascending — this function does not sort. Returns
 * `NaN` on an empty array rather than `0`, so an empty distribution is never
 * mistaken for a genuine zero-width one. Deliberately the SAME quantile
 * implementation Phase 28's PR plausibility ceiling will reuse; do not
 * substitute a nearest-rank variant here.
 */
export function quantile(sortedAsc: readonly number[], q: number): number {
  const n = sortedAsc.length;
  if (n === 0) return NaN;
  if (n === 1) return sortedAsc[0];

  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];

  const frac = pos - lo;
  return sortedAsc[lo] + frac * (sortedAsc[hi] - sortedAsc[lo]);
}

/**
 * Walks consecutive samples and records the real-time gap between each pair
 * of samples where `d` actually advances (`d[i] > d[i-1]`), seeded with
 * `lastAdvanceT = t[0]` so the very first advance is measured from the
 * stream's own start rather than being dropped. Returns the intervals sorted
 * ascending, ready to feed `quantile`. A stream that never advances (all
 * `d` values equal) returns an empty array — callers must not coerce that to
 * `0`, since "no advance interval exists" and "advance interval is zero" are
 * different facts (`classifyGaps` treats the empty case as an infinite pause
 * threshold, per its own contract below).
 */
export function advanceIntervals(t: readonly number[], d: readonly number[]): number[] {
  const n = Math.min(t.length, d.length);
  if (n === 0) return [];

  const result: number[] = [];
  let lastAdvanceT = t[0];
  for (let i = 1; i < n; i++) {
    if (d[i] > d[i - 1]) {
      result.push(t[i] - lastAdvanceT);
      lastAdvanceT = t[i];
    }
  }
  return result.sort((a, b) => a - b);
}

/**
 * Precomputes, per segment index `i` in `[0, n-2]`, the duration (in real
 * seconds) of the maximal distance-flat run that segment belongs to, or `-1`
 * if the segment is not distance-flat (`d[i+1] - d[i] > 0`). A "maximal
 * distance-flat run" is a maximal span of consecutive sample indices `i..j`
 * such that `d[k+1] - d[k] <= 0` for every `k` in `[i, j-1]`; its duration is
 * `t[j] - t[i]`. Every segment inside that run (indices `i` through `j-1`)
 * shares the same duration value, so a single 10-minute flat run is judged
 * as one 10-minute pause rather than as many independent short segments —
 * exactly the distinction D-05's discriminator depends on.
 */
function computeFlatRunDurations(t: readonly number[], d: readonly number[], n: number): number[] {
  const flatRunDuration: number[] = new Array(n - 1).fill(-1);
  let i = 0;
  while (i < n - 1) {
    if (d[i + 1] - d[i] <= 0) {
      let j = i;
      while (j < n - 1 && d[j + 1] - d[j] <= 0) j++;
      const duration = t[j] - t[i];
      for (let k = i; k < j; k++) flatRunDuration[k] = duration;
      i = j;
    } else {
      i++;
    }
  }
  return flatRunDuration;
}

/**
 * Classifies every `[t[i], t[i+1]]` segment of a stream into exactly one of
 * `recording-gap`, `pause`, or `covered`, and accounts the real-time span of
 * each category exactly (D-04, D-07, COV-01).
 *
 * Guarded by `validateStreamSeries` on entry (T-26-01) — any non-`ok` input
 * (length mismatch, fewer than 2 samples, a non-finite value, decreasing
 * `t`/`d`) returns the zeroed `PaceCoverage` rather than throwing.
 *
 * Classification is by STRICT PRIORITY, never as two independent overlapping
 * checks (26-RESEARCH.md Pitfall 3 — independent checks can double-count a
 * segment into more than one category and break the exact-sum identity):
 *   1. `dt = t[i+1] - t[i] > RECORDING_GAP_ABS_THRESHOLD_SEC` → `recording-gap`.
 *   2. else if the segment belongs to a distance-flat run whose duration
 *      exceeds the resolved pause threshold → `pause`.
 *   3. else → `covered`.
 *
 * The pause threshold defaults to `{ kind: 'scale-relative', multiplier:
 * PAUSE_GAP_P90_MULTIPLIER }`, resolved to `multiplier * quantile(p90 of
 * advanceIntervals(t, d))`. If the stream never advances, the threshold is
 * `Infinity` — nothing is classified as pause rather than everything (a
 * stream with no advance intervals has no basis to judge "long relative to
 * what").
 *
 * `gapIntervals` merges adjacent same-kind non-covered segments into runs
 * with real `startSec`/`endSec` boundaries (not indices), ordered ascending.
 */
export function classifyGaps(
  t: readonly number[],
  d: readonly number[],
  options?: { pauseRule?: PauseRule }
): PaceCoverage {
  if (!validateStreamSeries(t as number[], d as number[]).ok) return zeroCoverage();

  const n = t.length;
  const spanSec = t[n - 1] - t[0];

  const pauseRule: PauseRule =
    options?.pauseRule ?? { kind: 'scale-relative', multiplier: PAUSE_GAP_P90_MULTIPLIER };

  let pauseThresholdSec: number;
  if (pauseRule.kind === 'absolute') {
    pauseThresholdSec = pauseRule.thresholdSec;
  } else {
    const intervals = advanceIntervals(t, d);
    pauseThresholdSec =
      intervals.length === 0 ? Infinity : pauseRule.multiplier * quantile(intervals, 0.9);
  }

  const flatRunDuration = computeFlatRunDurations(t, d, n);

  let coveredSec = 0;
  let recordingGapSec = 0;
  let pauseSec = 0;
  const gapIntervals: GapInterval[] = [];
  let openKind: GapKind | null = null;
  let openStartSec = 0;

  for (let i = 0; i < n - 1; i++) {
    const dt = t[i + 1] - t[i];

    let kind: GapKind | 'covered';
    if (dt > RECORDING_GAP_ABS_THRESHOLD_SEC) {
      kind = 'recording-gap';
    } else if (flatRunDuration[i] >= 0 && flatRunDuration[i] > pauseThresholdSec) {
      kind = 'pause';
    } else {
      kind = 'covered';
    }

    if (kind === 'recording-gap') recordingGapSec += dt;
    else if (kind === 'pause') pauseSec += dt;
    else coveredSec += dt;

    if (kind === 'covered') {
      if (openKind !== null) {
        gapIntervals.push({ startSec: openStartSec, endSec: t[i], kind: openKind });
        openKind = null;
      }
    } else if (openKind === kind) {
      // Same-kind run continues — extend without emitting yet.
    } else {
      if (openKind !== null) {
        gapIntervals.push({ startSec: openStartSec, endSec: t[i], kind: openKind });
      }
      openKind = kind;
      openStartSec = t[i];
    }
  }

  if (openKind !== null) {
    gapIntervals.push({ startSec: openStartSec, endSec: t[n - 1], kind: openKind });
  }

  return { spanSec, coveredSec, recordingGapSec, pauseSec, gapIntervals };
}

// ---------------------------------------------------------------------------
// Pace series (adaptive, gap-clipped windowed averaging) — PACE-02, PACE-03
// ---------------------------------------------------------------------------

/**
 * Multiplier applied to an activity's own p90 distance-advance interval to
 * derive its averaging window width (D-01, D-02). 26-RESEARCH.md's
 * measurement: the roadmap's own cited windows (150s / ~230s / ~248s for the
 * three "recovered" activities) divide by their measured p90 advance
 * intervals (60s / 88.4s / 99s) to 2.5 in every case, almost exactly — the
 * multiplier is not a guess, it falls directly out of the roadmap's own
 * numbers once divided, and this session's re-measurement against the
 * committed streams confirmed the ratio holds within methodology noise.
 */
export const PACE_WINDOW_P90_MULTIPLIER = 2.5;

/**
 * Floor on the resolved averaging window width, in seconds (D-02, D-03).
 * This is the pre-existing `PACE_SMOOTHING_WINDOW_SEC` value carried over
 * from `detail-charts-logic.ts`, now a FLOOR rather than the only value. Kept
 * at 20 rather than letting the formula run unfloored: an unfloored formula
 * would give activity 4556693525 (p90 advance interval 4s) a 10s window,
 * which would still avoid stair-step noise, but it is NOT the configuration
 * PACE-03/PACE-06's cited figures were measured under, and diverging from
 * those figures without re-deriving them violates D-03.
 */
export const PACE_WINDOW_FLOOR_SEC = 20;

/**
 * Linearly interpolates `values` at an arbitrary `time`, clamping to the
 * series' first/last sample when `time` falls outside its range. Assumes `t`
 * is non-decreasing. Moved here verbatim from
 * `detail-charts-logic.ts:68-86` (D-15) — plan 26-04 makes that module
 * re-export this copy rather than keep a second implementation.
 */
export function interpValueAtTime(
  t: readonly number[],
  values: readonly number[],
  time: number
): number {
  const n = t.length;
  if (n === 0) return NaN;
  if (n === 1 || time <= t[0]) return values[0];
  if (time >= t[n - 1]) return values[n - 1];

  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (t[mid] <= time) lo = mid;
    else hi = mid - 1;
  }
  const i = lo;
  const j = Math.min(i + 1, n - 1);
  if (t[j] === t[i]) return values[i];
  const frac = (time - t[i]) / (t[j] - t[i]);
  return values[i] + frac * (values[j] - values[i]);
}

/**
 * Resolves the averaging window width for one stream: `max(FLOOR, MULTIPLIER
 * x p90 of that stream's own distance-advance intervals)` (D-01, D-02).
 * Computed per activity from that activity's own distance-advance-interval
 * distribution, never a single constant across every activity — the
 * fixed-20s window is the roadmap's demonstrated-failing case (PACE-03),
 * not the shipped mechanism.
 *
 * When `advanceIntervals` is empty (the stream never advances distance),
 * returns the floor rather than `NaN` (T-26-01) — "no advance interval
 * exists" has no basis to judge a window width against, so the floor is the
 * only well-defined answer.
 */
export function adaptiveWindowSec(t: readonly number[], d: readonly number[]): number {
  const intervals = advanceIntervals(t, d);
  if (intervals.length === 0) return PACE_WINDOW_FLOOR_SEC;
  return Math.max(PACE_WINDOW_FLOOR_SEC, PACE_WINDOW_P90_MULTIPLIER * quantile(intervals, 0.9));
}

/**
 * For each sample index, takes the centred window of REAL elapsed time
 * `±windowSec/2` (clamped to the stream's extent), sums the actual distance
 * and actual elapsed time across that window using the real `t`/`d` values
 * (never a fixed sample count), and returns `elapsed / (metres / 1000)`.
 * Returns `null` for any window where metres or elapsed is 0 — a standstill
 * never yields an Infinity pace (this is `derivePaceSeries`'s body,
 * unchanged, per D-01 — see `detail-charts-logic.ts:88-127`).
 *
 * With `clipAtGaps` (default `true`, PACE-02): the centred window is
 * additionally clamped so it cannot cross a `gapIntervals` boundary — the
 * window's start clamps forward to the end of the latest gap that ends at or
 * before `t[i]`, and its end clamps backward to the start of the earliest
 * gap that starts at or after `t[i]`. If `t[i]` itself falls strictly inside
 * a gap interval, the result at that index is `null` — no pace is invented
 * for a period with no samples. `clipAtGaps: false` skips this clamping
 * entirely; it exists solely so the demonstrated-failing gap-bridging case
 * can be a permanent in-suite test (T-26-06) — no production call site may
 * ever pass it.
 */
export function derivePaceSeriesGapAware(
  t: readonly number[],
  d: readonly number[],
  options: { windowSec: number; gapIntervals: readonly GapInterval[]; clipAtGaps?: boolean }
): (number | null)[] {
  const { windowSec, gapIntervals } = options;
  const clipAtGaps = options.clipAtGaps ?? true;

  const n = t.length;
  const result: (number | null)[] = new Array(n);
  if (n === 0) return result;

  const half = windowSec / 2;
  const tStart = t[0];
  const tEnd = t[n - 1];

  for (let i = 0; i < n; i++) {
    const time = t[i];

    if (clipAtGaps) {
      const insideGap = gapIntervals.some((g) => g.startSec < time && time < g.endSec);
      if (insideGap) {
        result[i] = null;
        continue;
      }
    }

    let windowStart = Math.max(tStart, time - half);
    let windowEnd = Math.min(tEnd, time + half);

    if (clipAtGaps) {
      for (const g of gapIntervals) {
        if (g.endSec <= time && g.endSec > windowStart) windowStart = g.endSec;
        if (g.startSec >= time && g.startSec < windowEnd) windowEnd = g.startSec;
      }
    }

    const elapsed = windowEnd - windowStart;
    if (!(elapsed > 0)) {
      result[i] = null;
      continue;
    }

    const dStart = interpValueAtTime(t, d, windowStart);
    const dEnd = interpValueAtTime(t, d, windowEnd);
    const metres = dEnd - dStart;
    if (!(metres > 0)) {
      result[i] = null;
      continue;
    }

    result[i] = elapsed / (metres / 1000);
  }

  return result;
}

/** The pace series, the coverage it was derived under, and the resolved window width, together. */
export interface PaceDerivationResult {
  paceSeries: (number | null)[];
  coverage: PaceCoverage;
  windowSec: number;
}

/**
 * The single entry point (D-16): the ONE way any caller may obtain a
 * derived pace series is by also receiving the coverage accounting it was
 * derived under, in the same return value — no caller can hold pace without
 * coverage, so no caption can drift from the histogram beside it.
 *
 * D-17: the returned `paceSeries` is a PRESENTATION series only. It is
 * never written, never persisted, and nothing here feeds `computeSplits` or
 * becomes a stats value — this module produces chart/histogram input, not
 * derived data.
 *
 * Calls `classifyGaps` exactly once, resolves `windowSec` to
 * `options.windowSec ?? adaptiveWindowSec(stream.t, stream.d)` (D-01, D-02),
 * and clips every averaging window at the resolved gap boundaries by default
 * (PACE-02). `options.windowSec` and `options.clipAtGaps` exist only for
 * this module's own demonstrated-failing tests (T-26-06); no production call
 * site may pass them.
 *
 * On an invalid stream (T-26-01) this never throws — it returns an empty
 * series with the zeroed `PaceCoverage` and the floor window width.
 */
export function derivePaceWithCoverage(
  stream: CanonicalStream,
  options?: { windowSec?: number; pauseRule?: PauseRule; clipAtGaps?: boolean }
): PaceDerivationResult {
  const { t, d } = stream;

  if (!validateStreamSeries(t, d).ok) {
    return { paceSeries: [], coverage: zeroCoverage(), windowSec: PACE_WINDOW_FLOOR_SEC };
  }

  const coverage = classifyGaps(t, d, { pauseRule: options?.pauseRule });
  const windowSec = options?.windowSec ?? adaptiveWindowSec(t, d);
  const paceSeries = derivePaceSeriesGapAware(t, d, {
    windowSec,
    gapIntervals: coverage.gapIntervals,
    clipAtGaps: options?.clipAtGaps,
  });

  return { paceSeries, coverage, windowSec };
}

/**
 * Builds the Δt-weighted `{ paceSecPerKm, timeSec }` samples a histogram
 * consumes, from a pace series produced by `derivePaceSeriesGapAware` /
 * `derivePaceWithCoverage`. Reproduces `computePaceDistribution`'s existing
 * Δt weighting (`detail-zones.ts`'s `bucketTimeSec.set(index, existing +
 * dt)`) and is the shared primitive plan 26-09's residual-fast-mass script
 * measures against.
 *
 * INVARIANT (fixed 2026-09-08, cross-plan integration repair): the sum of
 * every returned `timeSec` equals `coverage.coveredSec` EXACTLY — never
 * `spanSec`, never `coveredSec` plus any gap/pause time. This requires
 * `gapIntervals` as a REQUIRED third argument, not an optional flag that
 * defaults to the leaky behaviour: `derivePaceSeriesGapAware`'s window
 * clipping deliberately leaves the LAST sample before a gap non-null (a
 * shrunk-but-valid trailing window, so the chart line stays continuous up
 * to the gap edge). That sample's own FORWARD segment `[t[i], t[i+1]]` *is*
 * the gap (`classifyGaps` classifies it `recording-gap` or `pause`, never
 * `covered`). Skipping only `paceSeries[i] === null` is NOT sufficient to
 * exclude that segment, because the pre-gap sample's pace is non-null —
 * only checking whether the segment's OWN START falls inside a
 * `gapIntervals` entry catches it. For `i` in `[0, t.length - 2]`, a
 * segment is excluded when `dt <= 0`, `paceSeries[i]` is null/undefined, OR
 * `t[i]` falls within `[g.startSec, g.endSec)` for any gap interval `g`.
 */
export function paceHistogramSamples(
  t: readonly number[],
  paceSeries: readonly (number | null)[],
  gapIntervals: readonly GapInterval[]
): Array<{ paceSecPerKm: number; timeSec: number }> {
  const result: Array<{ paceSecPerKm: number; timeSec: number }> = [];
  for (let i = 0; i < t.length - 1; i++) {
    const dt = t[i + 1] - t[i];
    const pace = paceSeries[i];
    if (dt <= 0 || pace === null || pace === undefined) continue;

    const segStart = t[i];
    const inGap = gapIntervals.some((g) => segStart >= g.startSec && segStart < g.endSec);
    if (inGap) continue;

    result.push({ paceSecPerKm: pace, timeSec: dt });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Metadata-vs-stream pace disagreement (PACE-07, D-10, D-14)
// ---------------------------------------------------------------------------

/**
 * Metadata pace threshold, in sec/km, below which a disagreement check is
 * even attempted (PACE-07). The roadmap states the threshold as "metadata
 * implying a sustained pace faster than 3:20/km" — 200 sec/km is exactly
 * 3:20/km. 26-RESEARCH.md measured exactly one archive-wide flag at this
 * threshold (activity 5059204779, metadata 112.6 sec/km).
 */
export const PACE_DISAGREEMENT_METADATA_THRESHOLD_SEC_PER_KM = 200;

/**
 * Minimum ratio of stream-derived pace to metadata pace for a disagreement
 * to count as material (PACE-07). Activity 5059204779's measured ratio is
 * 350.6 / 112.6 = 3.11, well above this floor.
 */
export const PACE_DISAGREEMENT_RATIO = 2;

/**
 * Span-based stream pace: `(t[n-1] - t[0]) / ((d[n-1] - d[0]) / 1000)`, or
 * `null` when the stream is invalid (via `validateStreamSeries`), the time
 * span is not positive, or the distance span is not positive.
 *
 * Deliberately SPAN-based, not covered-time-based (unlike
 * `derivePaceWithCoverage`'s windowed series) — this reproduces the
 * roadmap's and UI-SPEC's cited 5:51/km for 5059204779 exactly (3788s /
 * 10.804km = 350.6 sec/km), which is the figure the browser checkpoint
 * reads back verbatim. A gap-aware windowed average would answer a
 * different question ("how fast when moving") than this check needs
 * ("what pace does the whole recorded stream actually imply").
 */
export function streamPaceSecPerKm(stream: CanonicalStream): number | null {
  const { t, d } = stream;
  if (!validateStreamSeries(t, d).ok) return null;

  const n = t.length;
  const spanSec = t[n - 1] - t[0];
  const spanM = d[n - 1] - d[0];
  if (!(spanSec > 0) || !(spanM > 0)) return null;

  return spanSec / (spanM / 1000);
}

/** The result of a material metadata-vs-stream pace disagreement (PACE-07, D-10). */
export interface PaceDisagreementResult {
  streamPaceSecPerKm: number;
  metadataPaceSecPerKm: number;
  ratio: number;
}

/**
 * Detects a material disagreement between an activity's metadata-derived
 * pace (`movingTimeSec / (distanceM / 1000)`, computed by the caller) and
 * its own stream-derived pace (PACE-07). Returns `null` — never a
 * partially-filled object and never a zero — unless ALL of:
 *   - `metadataPaceSecPerKm` is not `null` and is `> 0`
 *   - `metadataPaceSecPerKm < threshold` (gate: only implausibly fast
 *     metadata paces are even checked, so a slow-but-real activity like
 *     11544429866's 402.4 sec/km is never considered)
 *   - `streamPaceSecPerKm(stream)` is not `null`
 *   - the stream pace is at least `ratio` times the metadata pace
 *
 * Nothing about `paceSecPerKm` is recomputed or substituted here (D-10) —
 * this function only DETECTS and reports the disagreement; the caller
 * decides what to do with it. Never throws on any array-shaped stream
 * (T-26-01). Both returned paces are rounded to one decimal, matching
 * `compute-dashboard-index.ts`'s existing `round1` convention.
 */
export function detectPaceDisagreement(
  metadataPaceSecPerKm: number | null,
  stream: CanonicalStream,
  options?: { metadataThresholdSecPerKm?: number; ratio?: number }
): PaceDisagreementResult | null {
  const threshold =
    options?.metadataThresholdSecPerKm ?? PACE_DISAGREEMENT_METADATA_THRESHOLD_SEC_PER_KM;
  const ratioFloor = options?.ratio ?? PACE_DISAGREEMENT_RATIO;

  if (metadataPaceSecPerKm === null || !(metadataPaceSecPerKm > 0)) return null;
  if (!(metadataPaceSecPerKm < threshold)) return null;

  const streamPace = streamPaceSecPerKm(stream);
  if (streamPace === null) return null;

  if (!(streamPace / metadataPaceSecPerKm >= ratioFloor)) return null;

  return {
    streamPaceSecPerKm: Math.round(streamPace * 10) / 10,
    metadataPaceSecPerKm: Math.round(metadataPaceSecPerKm * 10) / 10,
    ratio: Math.round((streamPace / metadataPaceSecPerKm) * 100) / 100,
  };
}
