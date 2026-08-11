/**
 * Per-km splits table computation (DETAIL-04).
 *
 * Pure, DOM-free module — computes exact-crossing-interpolated km splits from
 * a `CanonicalStream`. Mirrors `findBestEffort`'s linear-interpolation-at-
 * crossing technique (`best-effort-utils.ts`, RESEARCH.md Pattern 2), but
 * walks `d` forward once for each successive `km * 1000` boundary instead of
 * running the two-pointer sliding search — O(n) single forward pass.
 *
 * Committed streams are NOT uniformly sampled (RESEARCH.md Pitfall 1) — a
 * real committed file starts `t = [0, 1, 5, 10, 14, 16, 18, 20, 22, 24]`.
 * Every per-split channel average (`avgHr`, `avgCadence`) is therefore
 * Δt-weighted, accumulating `value[i] * (t[i+1] - t[i])` over the samples
 * inside the split's window (including the fractional first/last
 * sub-intervals at the interpolated boundaries), never a sample-count mean.
 */

import type { CanonicalStream } from '../../streams/stream.types.js';
import { validateStreamSeries } from '../../analytics/best-effort-utils.js';

/** A tolerance below which a residual "partial" distance is treated as float noise, not a real partial km. */
const PARTIAL_DISTANCE_EPSILON_M = 1e-6;

export interface Split {
  /** 1-based; the final entry may be a partial km (D-28). */
  km: number;
  /** Real distance covered by this split (1000 for a full km, less for the final partial). */
  distanceM: number;
  durationSec: number;
  paceSecPerKm: number;
  isPartial: boolean;
  startTimeSec: number;
  endTimeSec: number;
  /** Δt-weighted average; null when the stream has no `hr` array. */
  avgHr: number | null;
  /** Δt-weighted average; null when the stream has no `cadence` array. */
  avgCadence: number | null;
  /** Interpolated altitude at the split's end boundary minus at its start boundary; null when the stream has no `alt` array. */
  elevDeltaM: number | null;
}

function lerp(a: number, b: number, frac: number): number {
  return a + frac * (b - a);
}

/**
 * Accumulates `value[idx] * clippedDeltaT` for every raw segment `[t[idx], t[idx+1]]`
 * that overlaps `[windowStart, windowEnd]`, from `fromIdx` (the last raw
 * sample at or before `windowStart`) through `toIdx` (the last raw sample at
 * or before `windowEnd`). Left-endpoint (step-function) weighting, per plan
 * contract — the value is held constant from sample `idx` until the next
 * sample changes it.
 */
function accumulateWeighted(
  values: number[],
  t: number[],
  fromIdx: number,
  toIdx: number,
  windowStart: number,
  windowEnd: number
): number {
  let sum = 0;
  for (let idx = fromIdx; idx <= toIdx; idx++) {
    const segStartT = idx === fromIdx ? windowStart : t[idx];
    const segEndT = idx === toIdx ? windowEnd : t[idx + 1];
    const dt = segEndT - segStartT;
    if (dt > 0) {
      sum += values[idx] * dt;
    }
  }
  return sum;
}

/**
 * Computes per-km splits from a `CanonicalStream`. Never throws for any
 * `CanonicalStream`-shaped input, including zero-length arrays — returns `[]`
 * whenever `validateStreamSeries` rejects the series (length mismatch,
 * non-finite, decreasing, or fewer than 2 samples).
 */
export function computeSplits(stream: CanonicalStream): Split[] {
  const { t, d, hr, cadence, alt } = stream;

  const validation = validateStreamSeries(t, d);
  if (!validation.ok) return [];

  const n = t.length;
  const d0 = d[0];
  const totalM = d[n - 1] - d0;
  if (totalM <= 0) return [];

  const splits: Split[] = [];

  let prevTime = t[0];
  let prevAlt = alt ? alt[0] : undefined;
  let carryIndex = 0;
  let j = 1;
  let km = 1;
  let completedBoundaryM = 0;

  while (true) {
    const boundaryM = km * 1000;
    while (j < n && d[j] - d0 < boundaryM) j++;
    if (j >= n) break;

    const segMeters = d[j] - d[j - 1];
    const frac = segMeters > 0 ? (boundaryM - (d[j - 1] - d0)) / segMeters : 0;
    const crossingTime = lerp(t[j - 1], t[j], frac);
    const crossingAlt = alt ? lerp(alt[j - 1], alt[j], frac) : undefined;

    const durationSec = crossingTime - prevTime;

    const avgHr = hr
      ? accumulateWeighted(hr, t, carryIndex, j - 1, prevTime, crossingTime) / durationSec
      : null;
    const avgCadence = cadence
      ? accumulateWeighted(cadence, t, carryIndex, j - 1, prevTime, crossingTime) / durationSec
      : null;
    const elevDeltaM = alt && crossingAlt !== undefined && prevAlt !== undefined
      ? crossingAlt - prevAlt
      : null;

    splits.push({
      km,
      distanceM: 1000,
      durationSec,
      paceSecPerKm: durationSec,
      isPartial: false,
      startTimeSec: prevTime,
      endTimeSec: crossingTime,
      avgHr,
      avgCadence,
      elevDeltaM,
    });

    prevTime = crossingTime;
    prevAlt = crossingAlt;
    carryIndex = j - 1;
    completedBoundaryM = boundaryM;
    km++;
  }

  const remainderM = totalM - completedBoundaryM;
  if (remainderM > PARTIAL_DISTANCE_EPSILON_M) {
    const endTime = t[n - 1];
    const endAlt = alt ? alt[n - 1] : undefined;
    const durationSec = endTime - prevTime;

    const avgHr = hr
      ? accumulateWeighted(hr, t, carryIndex, n - 1, prevTime, endTime) / durationSec
      : null;
    const avgCadence = cadence
      ? accumulateWeighted(cadence, t, carryIndex, n - 1, prevTime, endTime) / durationSec
      : null;
    const elevDeltaM = alt && endAlt !== undefined && prevAlt !== undefined
      ? endAlt - prevAlt
      : null;

    splits.push({
      km,
      distanceM: remainderM,
      durationSec,
      paceSecPerKm: durationSec / (remainderM / 1000),
      isPartial: true,
      startTimeSec: prevTime,
      endTimeSec: endTime,
      avgHr,
      avgCadence,
      elevDeltaM,
    });
  }

  return splits;
}
