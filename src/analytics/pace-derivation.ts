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
import { detectUnreliableSegments, DEFAULT_DETECTOR_PARAMS } from './unreliable-segments.js';
import type { UnreliableSegment, SegmentMechanism } from './unreliable-segments.js';

/**
 * `pace-derivation.ts` is the detector's ONE permitted importer
 * (`pace-single-source.test.ts:138`) — every other analytics module reaches
 * `detectUnreliableSegments`' output through `classifyGapsWithSegments`
 * below and these re-exported types, rather than importing
 * `unreliable-segments.js` directly. Widening that allowlist in a later
 * phase needs its own recorded reason, the same discipline
 * `ALLOWED_FILE_SUFFIX` already holds that audit file to (Phase 33 plan
 * 33-09, Task 1).
 */
export type { UnreliableSegment, SegmentMechanism } from './unreliable-segments.js';

/**
 * The transport-speed VALUE re-export (34-CONTEXT.md D-05) — the one door
 * through which the detector's calibrated transport boundary reaches every
 * downstream consumer (`pause-classification.ts`'s `isTransported`/
 * `classifyPauseSpeed`). A pure `export … from` re-export leaves the name
 * unbound in THIS module's own scope (`pace-derivation.ts` itself never
 * reads `UNRELIABLE_SPEED_LIMIT_MPS` — it only forwards it), which is fine:
 * this file has no comparison of its own to make against it. Consumers must
 * import it from here, never copy the literal `7.35` (D-05's single-source
 * audit forbids the literal outside `unreliable-segments.ts` and its own
 * test).
 */
export { UNRELIABLE_SPEED_LIMIT_MPS } from './unreliable-segments.js';

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

/**
 * The three named non-covered segment categories (33-CONTEXT.md D-02).
 * `unreliable` sits at the TOP of `classifyGaps`' strict-priority tree —
 * above `recording-gap`, above `pause` (D-01) — because a detected
 * unreliable segment's seconds are folded in AFTER the pre-detector
 * three-way pass (see `classifyGapsThreeWay` below for that pre-detector
 * list, and `classifyGaps`' own docblock for the four-rung priority order).
 */
export type GapKind = 'recording-gap' | 'pause' | 'unreliable';

/**
 * The two pre-detector non-covered categories — `GapKind` minus
 * `'unreliable'`. This is the classification `classifyGapsThreeWay` returns
 * and the ONE gap-list shape `detectUnreliableSegments` is ever fed (D-14,
 * 33-CONTEXT.md D-02).
 */
export type PreDetectorGapKind = 'recording-gap' | 'pause';

/** One merged run of adjacent same-kind non-covered segments, in real time. */
export interface GapInterval {
  startSec: number;
  endSec: number;
  kind: GapKind;
}

/** The pre-detector twin of `GapInterval` — never carries `kind: 'unreliable'`. */
export interface PreDetectorGapInterval {
  startSec: number;
  endSec: number;
  kind: PreDetectorGapKind;
}

/**
 * One maximal run of consecutive `'covered'` pairs, `[startIndex, endIndex)`
 * over the pair-index space (pair `i` spans samples `t[i]`..`t[i+1]`), from
 * `classifyGapsWithSegments`'s own FINAL `pairKinds` array (34-CONTEXT.md
 * D-01, 34-RESEARCH.md Pattern 1/Pitfall 5). Deliberately index-based, never
 * a second `startSec`/`endSec` boundary convention derived by re-scanning
 * floating-point sample times — the same reason the pass-3 detector-segment
 * containment check above is index-based (32-13/32-17's fixed defect: a
 * second, disagreeing boundary convention can double-count a shared
 * interval). A downstream covered-time consumer (Phase 34's
 * `findCreepStretches`) that needs "which samples are covered" reads THIS
 * field, never `coverage.gapIntervals`'s absence as a proxy.
 */
export interface CoveredRun {
  startIndex: number;
  endIndex: number;
}

/**
 * Derives `CoveredRun[]` from a FINAL `pairKinds` array (post pass-3, the
 * same array `accumulateCoverage` sums) — a maximal run of consecutive
 * `'covered'` entries `i` is reported as `{ startIndex: firstPair, endIndex:
 * lastPair + 1 }`. Pure, total: an empty `pairKinds` array returns `[]`.
 */
function deriveCoveredRuns(pairKinds: readonly PairKind[]): CoveredRun[] {
  const runs: CoveredRun[] = [];
  let runStart: number | null = null;
  for (let i = 0; i < pairKinds.length; i++) {
    if (pairKinds[i] === 'covered') {
      if (runStart === null) runStart = i;
    } else if (runStart !== null) {
      runs.push({ startIndex: runStart, endIndex: i });
      runStart = null;
    }
  }
  if (runStart !== null) {
    runs.push({ startIndex: runStart, endIndex: pairKinds.length });
  }
  return runs;
}

/**
 * Exact coverage accounting over one stream's span. `coveredSec +
 * recordingGapSec + pauseSec + unreliableSec === spanSec` by construction
 * (COV-01, D-07, widened by 33-CONTEXT.md D-01/D-02) — every segment lands
 * in exactly one category, none is skipped.
 *
 * That four-term identity is a STRUCTURAL property of a mutually exclusive,
 * exhaustive pair classification — it holds even if the WRONG pairs were
 * classified `unreliable` (a bug that relabels segments without changing
 * their count still sums to `spanSec`). It is therefore NOT on its own
 * evidence that the right pairs were classified `unreliable`; the
 * load-bearing check is plan 33-07's detector-free recount, reconciled
 * against an independently-derived segment-seconds total.
 */
export interface PaceCoverage {
  spanSec: number;
  coveredSec: number;
  recordingGapSec: number;
  pauseSec: number;
  unreliableSec: number;
  gapIntervals: GapInterval[];
}

/**
 * The shape `classifyGaps` had before Phase 33 — the pre-detector three-way
 * split, with no `unreliableSec` term. Returned by `classifyGapsThreeWay`.
 */
export interface ThreeWayPaceCoverage {
  spanSec: number;
  coveredSec: number;
  recordingGapSec: number;
  pauseSec: number;
  gapIntervals: PreDetectorGapInterval[];
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
  return {
    spanSec: 0,
    coveredSec: 0,
    recordingGapSec: 0,
    pauseSec: 0,
    unreliableSec: 0,
    gapIntervals: [],
  };
}

/** The `ThreeWayPaceCoverage` sibling of `zeroCoverage` — never a shared/mutable constant. */
function zeroThreeWayCoverage(): ThreeWayPaceCoverage {
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

/** The per-pair result of pass 1 — one of `GapKind`'s members, or `'covered'`. */
type PairKind = GapKind | 'covered';

/**
 * Pass 1: classifies every `[t[i], t[i+1]]` segment of a stream into exactly
 * one of `recording-gap`, `pause`, or `covered` — the pre-detector decision,
 * shared verbatim by `classifyGapsThreeWay` and `classifyGaps` (D-14: one
 * definition of "gap"). Never itself produces `'unreliable'` — that label is
 * assigned only by `classifyGaps`' own pass 3, after the detector runs.
 *
 * Guarded by `validateStreamSeries` on entry (T-26-01) — any non-`ok` input
 * (length mismatch, fewer than 2 samples, a non-finite value, decreasing
 * `t`/`d`) returns `ok: false` rather than throwing. `validateStreamSeries`
 * itself is TOTAL (35-02, 2026-09-24, D-08): it never throws for any input
 * shape, including `null`, `undefined` and a non-array value — its own first
 * check rejects anything for which `Array.isArray` is false before `.length`
 * is ever read. Every call site of `validateStreamSeries`, in this module and
 * in `pace-quality.ts`, therefore inherits the same never-throws guarantee.
 * The local `t == null || d == null` check immediately below is retained as
 * defence in depth for an untyped `.mjs` caller, not because
 * `validateStreamSeries` still needs it.
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
 */
function classifyPairKinds(
  t: readonly number[],
  d: readonly number[],
  options?: { pauseRule?: PauseRule }
): { ok: boolean; spanSec: number; pairKinds: PairKind[] } {
  if (t == null || d == null || !validateStreamSeries(t as number[], d as number[]).ok) {
    return { ok: false, spanSec: 0, pairKinds: [] };
  }

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

  const pairKinds: PairKind[] = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    const dt = t[i + 1] - t[i];
    if (dt > RECORDING_GAP_ABS_THRESHOLD_SEC) {
      pairKinds[i] = 'recording-gap';
    } else if (flatRunDuration[i] >= 0 && flatRunDuration[i] > pauseThresholdSec) {
      pairKinds[i] = 'pause';
    } else {
      pairKinds[i] = 'covered';
    }
  }

  return { ok: true, spanSec, pairKinds };
}

/**
 * Accumulates a `pairKinds` array (from `classifyPairKinds`, optionally
 * mutated by `classifyGaps`' pass 3) into totals and merged `gapIntervals`
 * runs. This is the ONE classification-arithmetic implementation in this
 * module — kind-count-agnostic by construction (the `openKind === kind`
 * same-kind-run merge below does not special-case how many non-`'covered'`
 * kinds exist), reused by `classifyGapsThreeWay` (once, over the pre-detector
 * `pairKinds`) and `classifyGaps` (twice: once to build the detector's own
 * `gaps` argument, once more after pass 3 relabels the detected segments).
 */
function accumulateCoverage(
  t: readonly number[],
  pairKinds: readonly PairKind[]
): {
  coveredSec: number;
  recordingGapSec: number;
  pauseSec: number;
  unreliableSec: number;
  gapIntervals: GapInterval[];
} {
  let coveredSec = 0;
  let recordingGapSec = 0;
  let pauseSec = 0;
  let unreliableSec = 0;
  const gapIntervals: GapInterval[] = [];
  let openKind: GapKind | null = null;
  let openStartSec = 0;
  const n = pairKinds.length + 1;

  for (let i = 0; i < n - 1; i++) {
    const dt = t[i + 1] - t[i];
    const kind = pairKinds[i];

    if (kind === 'recording-gap') recordingGapSec += dt;
    else if (kind === 'pause') pauseSec += dt;
    else if (kind === 'unreliable') unreliableSec += dt;
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

  return { coveredSec, recordingGapSec, pauseSec, unreliableSec, gapIntervals };
}

/**
 * The PRE-detector classification (D-02, D-14) — `recording-gap` and `pause`
 * only, never `unreliable`. This is the ONE definition of "gap" that
 * `detectUnreliableSegments` is fed, matching that module's own docblock
 * rule that gaps arrive as the caller's argument rather than being
 * redefined internally. Any caller needing "gaps as the detector sees them"
 * MUST call this function, never `classifyGaps(...).gapIntervals` — feeding
 * the POST-detector four-way list back into the detector is circular,
 * because those intervals already have the detector's own prior output
 * folded into them (Task 2 of this plan repairs the four call sites that
 * once did exactly this).
 *
 * On an invalid stream (T-26-01), returns the zeroed `ThreeWayPaceCoverage`.
 */
export function classifyGapsThreeWay(
  t: readonly number[],
  d: readonly number[],
  options?: { pauseRule?: PauseRule }
): ThreeWayPaceCoverage {
  const pass1 = classifyPairKinds(t, d, options);
  if (!pass1.ok) return zeroThreeWayCoverage();

  const acc = accumulateCoverage(t, pass1.pairKinds);
  return {
    spanSec: pass1.spanSec,
    coveredSec: acc.coveredSec,
    recordingGapSec: acc.recordingGapSec,
    pauseSec: acc.pauseSec,
    // Safe: `pass1.pairKinds` comes straight from `classifyPairKinds`, which
    // only ever assigns 'recording-gap' | 'pause' | 'covered' — never
    // 'unreliable' — so `acc.gapIntervals` structurally cannot contain a
    // `kind: 'unreliable'` entry here.
    gapIntervals: acc.gapIntervals as PreDetectorGapInterval[],
  };
}

/**
 * Classifies every `[t[i], t[i+1]]` segment of a stream into exactly one of
 * `unreliable`, `recording-gap`, `pause`, or `covered`, and accounts the
 * real-time span of each category exactly (D-04, D-07, COV-01, widened by
 * 33-CONTEXT.md D-01/D-02/D-14). Exactly `classifyGapsWithSegments(t, d,
 * options).coverage` for every input, including invalid streams (Phase 33
 * plan 33-09, Task 1) — the coverage half of that function's result, with
 * the detector's own `UnreliableSegment[]` list discarded. A caller needing
 * BOTH halves (e.g. SEG-06's per-activity signal, which also needs each
 * segment's mechanism and excess metres) must call
 * `classifyGapsWithSegments` directly rather than calling this function and
 * separately calling the detector, which would run it twice.
 *
 * See `classifyGapsWithSegments`'s own docblock for the full four-rung
 * priority order and the three-pass mechanics.
 */
export function classifyGaps(
  t: readonly number[],
  d: readonly number[],
  options?: { pauseRule?: PauseRule }
): PaceCoverage {
  return classifyGapsWithSegments(t, d, options).coverage;
}

/**
 * The detector's ONE permitted accessor (Phase 33 plan 33-09, Task 1). This
 * function is the SOLE call site of `detectUnreliableSegments` in this
 * module — exactly one `detectUnreliableSegments(` call exists in this file
 * after this change — so any module needing BOTH the coverage accounting
 * AND the detector's own `UnreliableSegment[]` (mechanism, excess metres,
 * per-segment bounds) calls this function once and shares both halves of
 * the result, rather than calling `classifyGaps` and
 * `detectUnreliableSegments` separately (which would run the detector twice
 * and risk the two results disagreeing).
 *
 * Guarded by `validateStreamSeries` on entry (T-26-01) — any non-`ok` input
 * (length mismatch, fewer than 2 samples, a non-finite value, decreasing
 * `t`/`d`) returns the zeroed `PaceCoverage` and an empty `segments` array
 * rather than throwing — never a partial result.
 *
 * Classification is by STRICT PRIORITY, four rungs, `unreliable` first
 * (D-01) — a pair the pre-detector pass called `recording-gap` or `pause`
 * that lies inside a detected unreliable segment is RECLASSIFIED as
 * `unreliable` in pass 3 below, so those seconds MOVE between caption terms;
 * `spanSec` and every stream byte are unchanged:
 *   1. inside a segment `detectUnreliableSegments` returns → `unreliable`.
 *   2. else `dt = t[i+1] - t[i] > RECORDING_GAP_ABS_THRESHOLD_SEC` → `recording-gap`.
 *   3. else if the segment belongs to a distance-flat run whose duration
 *      exceeds the resolved pause threshold → `pause`.
 *   4. else → `covered`.
 *
 * Three passes over the one `classifyPairKinds`/`accumulateCoverage`
 * classification, never a second copy of the arithmetic:
 *   - Pass 1 (`classifyPairKinds`): the pre-detector recording-gap/pause/
 *     covered decision, unchanged from before this phase.
 *   - Pass 2: accumulates pass 1 once to obtain the pre-detector
 *     `gapIntervals` — the SAME list `classifyGapsThreeWay` returns — maps
 *     it to `{ startSec, endSec }` spans, and calls
 *     `detectUnreliableSegments(t, d, spans, DEFAULT_DETECTOR_PARAMS)`.
 *   - Pass 3: for each returned segment, overwrites `pairKinds[i] =
 *     'unreliable'` for every `i` with `seg.startIndex <= i && i <
 *     seg.endIndex`, then accumulates a second time to get the final
 *     four-way totals and `gapIntervals`.
 *
 * Containment in pass 3 is INDEX-based, using the detector's own
 * `startIndex`/`endIndex` — never a `startSec <= t[i] && t[i+1] <= endSec`
 * float comparison. Re-deriving membership from floating `startSec`/`endSec`
 * boundaries would create a SECOND boundary convention alongside the
 * detector's own index-based one, and a disagreeing second convention is
 * exactly the defect 32-13/32-17 fixed (overlapping mapped gap blocks
 * double-counting a shared interval).
 *
 * `gapIntervals` merges adjacent same-kind non-covered segments into runs
 * with real `startSec`/`endSec` boundaries (not indices), ordered ascending.
 * The returned `segments` array is the detector's own raw output — unsorted
 * beyond whatever order `detectUnreliableSegments` itself returns.
 */
export function classifyGapsWithSegments(
  t: readonly number[],
  d: readonly number[],
  options?: { pauseRule?: PauseRule }
): { coverage: PaceCoverage; segments: UnreliableSegment[]; coveredRuns: CoveredRun[] } {
  const pass1 = classifyPairKinds(t, d, options);
  if (!pass1.ok) return { coverage: zeroCoverage(), segments: [], coveredRuns: [] };

  // Pass 2: the pre-detector three-way gapIntervals — the detector's own
  // `gaps` argument. This is exactly what `classifyGapsThreeWay` returns;
  // computed again here (rather than calling that function) only because
  // `spanSec`/`pairKinds` are already in hand from pass 1 above — the
  // arithmetic itself is the one shared `accumulateCoverage` call, not a
  // second implementation.
  const preDetectorAcc = accumulateCoverage(t, pass1.pairKinds);
  const detectorGaps = preDetectorAcc.gapIntervals.map((g) => ({
    startSec: g.startSec,
    endSec: g.endSec,
  }));
  const segments = detectUnreliableSegments(
    t as number[],
    d as number[],
    detectorGaps,
    DEFAULT_DETECTOR_PARAMS
  );

  // Pass 3: reclassify every pair inside a detected segment as 'unreliable',
  // using the detector's own startIndex/endIndex (see docblock above for why
  // this must not be re-derived from startSec/endSec).
  const pairKinds: PairKind[] = pass1.pairKinds.slice();
  for (const seg of segments) {
    for (let i = seg.startIndex; i < seg.endIndex; i++) {
      pairKinds[i] = 'unreliable';
    }
  }

  const finalAcc = accumulateCoverage(t, pairKinds);
  return {
    coverage: {
      spanSec: pass1.spanSec,
      coveredSec: finalAcc.coveredSec,
      recordingGapSec: finalAcc.recordingGapSec,
      pauseSec: finalAcc.pauseSec,
      unreliableSec: finalAcc.unreliableSec,
      gapIntervals: finalAcc.gapIntervals,
    },
    segments,
    // Derived from the SAME final pairKinds array finalAcc was summed from —
    // no second classification pass, no re-scan of gapIntervals (D-01).
    coveredRuns: deriveCoveredRuns(pairKinds),
  };
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
 * WR-01 (26-REVIEW.md, adjudicated in plan 26-11): the sum of every
 * returned `timeSec` is NOT guaranteed to equal `coverage.coveredSec`. It
 * equals `coveredSec` MINUS the covered time whose own averaging window
 * resolved to a null pace — an isolated zero-net-advance `covered` segment
 * flanked by two `recording-gap`s reproduces this exactly (synthetic shape
 * `t = [0, 12, 14, 26], d = [0, 30, 30, 60]`: the middle `[12, 14]` segment
 * classifies `covered`, but its window clamps to exactly `[12, 14]` with
 * `metres = 0`, so its pace is `null` and this function drops it — 0
 * bucketed seconds against `coveredSec = 2`). The exact, unconditional
 * identity `coveredSec === bucketedSec + unbucketedCoveredSec` now lives in
 * `paceHistogramAccounting`, not here.
 *
 * This function's exclusion mechanism itself is unchanged and still
 * correct: `gapIntervals` is a REQUIRED third argument, not an optional
 * flag that defaults to the leaky behaviour `derivePaceSeriesGapAware`'s
 * window clipping deliberately leaves the LAST sample before a gap
 * non-null (a shrunk-but-valid trailing window, so the chart line stays
 * continuous up to the gap edge). That sample's own FORWARD segment
 * `[t[i], t[i+1]]` *is* the gap (`classifyGaps` classifies it
 * `recording-gap` or `pause`, never `covered`). Skipping only
 * `paceSeries[i] === null` is NOT sufficient to exclude that segment,
 * because the pre-gap sample's pace is non-null — only checking whether
 * the segment's OWN START falls inside a `gapIntervals` entry catches it.
 * For `i` in `[0, t.length - 2]`, a segment is excluded when `dt <= 0`,
 * `paceSeries[i]` is null/undefined, OR `t[i]` falls within
 * `[g.startSec, g.endSec)` for any gap interval `g`.
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

/**
 * The covered time that `paceHistogramSamples` dropped because its own
 * averaging window resolved to a null pace (WR-01, plan 26-11) — the
 * itemised complement of `bucketedSec` inside `coverage.coveredSec`.
 *
 * `coverage.coveredSec - sum(bucketedTimesSec)`. Deliberately NOT clamped
 * at zero: a negative result would mean bucketed time exceeded covered
 * time, which is a different and worse defect (bucketed time counted from
 * outside `covered` territory) than the shortfall this function measures,
 * and clamping would silently hide it rather than surface it.
 */
export function unbucketedCoveredSec(
  coverage: PaceCoverage,
  bucketedTimesSec: readonly number[]
): number {
  const bucketedSec = bucketedTimesSec.reduce((sum, s) => sum + s, 0);
  return coverage.coveredSec - bucketedSec;
}

/**
 * The itemised covered-time accounting companion to `paceHistogramSamples`
 * (WR-01, D-07 applied one layer down, plan 26-11). Takes the WHOLE
 * `PaceCoverage` (not a bare `gapIntervals` array) so the itemisation
 * cannot be computed against a different coverage object than the samples
 * were derived under — the same D-16 structural argument that makes
 * `derivePaceWithCoverage` return both halves together.
 *
 * Guarantees, unconditionally and by construction:
 * `coverage.coveredSec === bucketedSec + unbucketedCoveredSec`.
 */
export function paceHistogramAccounting(
  t: readonly number[],
  paceSeries: readonly (number | null)[],
  coverage: PaceCoverage
): {
  samples: Array<{ paceSecPerKm: number; timeSec: number }>;
  bucketedSec: number;
  unbucketedCoveredSec: number;
} {
  const samples = paceHistogramSamples(t, paceSeries, coverage.gapIntervals);
  const bucketedSec = samples.reduce((sum, s) => sum + s.timeSec, 0);
  const unbucketed = unbucketedCoveredSec(
    coverage,
    samples.map((s) => s.timeSec)
  );
  return { samples, bucketedSec, unbucketedCoveredSec: unbucketed };
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
