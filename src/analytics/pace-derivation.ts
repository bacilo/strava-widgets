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
