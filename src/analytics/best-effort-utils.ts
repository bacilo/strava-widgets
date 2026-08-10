/**
 * Best-effort computation utilities for running analytics.
 *
 * Durations are always `t[j] - t[i]`, computed at the exact target-distance
 * crossing — never a sample-index count and never snapped to the next
 * sample. Distance is always read from the caller's `d` array. This module
 * performs no I/O.
 */

import type {
  PlausibilityResult,
  PRRankingEntry,
  RawEffort,
  TargetDistanceKey,
} from './best-effort.types.js';

/**
 * Multiplier applied to an activity's own max_speed before rejecting an
 * effort — absorbs rounding/interpolation noise. Deliberately aligned with
 * D-05's 2% fixture tolerance.
 */
export const MAX_SPEED_MARGIN = 1.02;

/** Size of each per-distance PR ranking in the output document. */
export const TOP_N = 10;

/**
 * World-record speed ceiling per target distance, computed as
 * distanceMeters / recordSeconds. The marathon entry deliberately uses the
 * ratified 2:00:35 rather than the pending-ratification 1:59:30 because a
 * sanity ceiling should err conservative. Several of these changed during
 * 2026 — a future maintainer should re-check the dates.
 */
export const WORLD_RECORD_SPEED_MPS: Record<TargetDistanceKey, number> = {
  '400m': 400 / 43.03, // Wayde van Niekerk, 43.03s (2016)
  '1k': 1000 / 131.96, // Noah Ngeny, 2:11.96 world best (1999)
  '1mi': 1609.344 / 222.66, // Josh Kerr, 3:42.66 (London Diamond League, Jul 2026)
  '5k': 5000 / 755.36, // Joshua Cheptegei, 12:35.36 (2020)
  '10k': 10000 / 1591, // Yomif Kejelcha, 26:31 (2025)
  half: 21097.5 / 3440, // Jacob Kiplimo, 57:20 (Lisbon Half, Feb 2026)
  marathon: 42195 / 7235, // Kelvin Kiptum, 2:00:35 (2023, ratified)
};

/**
 * Validates a `(t, d)` series before it reaches the sweep. Runs, in order:
 * equal-length check, minimum-sample-count check, finiteness check, and
 * non-decreasing checks on both arrays. Equal consecutive values are valid
 * in both arrays (a genuine standstill, or samples sharing a timestamp).
 */
export function validateStreamSeries(t: number[], d: number[]): PlausibilityResult {
  if (t.length !== d.length) {
    return {
      ok: false,
      reason: `t and d length mismatch: t has ${t.length} samples, d has ${d.length} samples`,
    };
  }

  const n = t.length;
  if (n < 2) {
    return { ok: false, reason: `series has ${n} sample(s), at least 2 are required` };
  }

  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(t[i])) {
      return { ok: false, reason: `t[${i}] is not a finite number: ${t[i]}` };
    }
    if (!Number.isFinite(d[i])) {
      return { ok: false, reason: `d[${i}] is not a finite number: ${d[i]}` };
    }
  }

  for (let i = 1; i < n; i++) {
    if (t[i] < t[i - 1]) {
      return {
        ok: false,
        reason: `t decreases at index ${i}: t[${i - 1}]=${t[i - 1]}, t[${i}]=${t[i]}`,
      };
    }
  }

  for (let i = 1; i < n; i++) {
    if (d[i] < d[i - 1]) {
      return {
        ok: false,
        reason: `d decreases at index ${i}: d[${i - 1}]=${d[i - 1]}, d[${i}]=${d[i]}`,
      };
    }
  }

  return { ok: true };
}

/**
 * Two-pointer O(n) sweep: for each start index `i`, advances the shared end
 * pointer `j` (never resetting backward) until `d[j] - d[i] >= targetMeters`,
 * then linearly interpolates the exact crossing time between `t[j-1]` and
 * `t[j]`. Tracks the minimum such duration across all `i`.
 *
 * Assumes a validated series — callers run `validateStreamSeries` first.
 */
export function findBestEffort(
  t: number[],
  d: number[],
  targetMeters: number
): RawEffort | undefined {
  const n = t.length;
  if (n < 2 || d[n - 1] - d[0] < targetMeters) return undefined;

  let best: RawEffort | undefined;
  let j = 0;

  for (let i = 0; i < n; i++) {
    if (j < i + 1) j = i + 1;
    while (j < n && d[j] - d[i] < targetMeters) j++;
    if (j >= n) break;

    // Linear interpolation at the exact crossing — never snap to d[j]/t[j].
    const needed = targetMeters - (d[j - 1] - d[i]);
    const segMeters = d[j] - d[j - 1];
    const frac = segMeters > 0 ? needed / segMeters : 0;
    const crossingTime = t[j - 1] + frac * (t[j] - t[j - 1]);

    const durationSec = crossingTime - t[i];
    if (durationSec > 0 && (!best || durationSec < best.durationSec)) {
      best = { durationSec, startOffsetSec: t[i], endOffsetSec: crossingTime };
    }
  }

  return best;
}

/**
 * Rejects an effort whose implied speed exceeds the activity's own
 * max_speed (plus a margin absorbing interpolation/decimation noise) or the
 * world-record ceiling for that distance. The max_speed half of the guard
 * runs only when `activityMaxSpeedMps` is truthy and finite; when it is
 * absent or zero the function falls through to the world-record ceiling
 * alone rather than rejecting everything (RESEARCH.md Pitfall 5).
 */
export function isPlausible(
  impliedSpeedMps: number,
  activityMaxSpeedMps: number | undefined,
  worldRecordSpeedMps: number
): PlausibilityResult {
  if (
    activityMaxSpeedMps &&
    Number.isFinite(activityMaxSpeedMps) &&
    impliedSpeedMps > activityMaxSpeedMps * MAX_SPEED_MARGIN
  ) {
    return {
      ok: false,
      reason: `implied ${impliedSpeedMps.toFixed(2)} m/s exceeds activity max_speed ${activityMaxSpeedMps.toFixed(2)} m/s`,
    };
  }

  if (impliedSpeedMps > worldRecordSpeedMps) {
    return {
      ok: false,
      reason: `implied ${impliedSpeedMps.toFixed(2)} m/s exceeds world-record pace ${worldRecordSpeedMps.toFixed(2)} m/s`,
    };
  }

  return { ok: true };
}

/**
 * Sorts efforts for one target distance chronologically by `startDate` and
 * stamps each with whether it improved on the best time seen so far. An
 * equalled time is not a new record.
 */
export function markPRs<T extends { startDate: string; durationSec: number }>(
  effortsForDistance: T[]
): (T & { wasPRAtTheTime: boolean })[] {
  const chronological = [...effortsForDistance].sort(
    (a, b) => Date.parse(a.startDate) - Date.parse(b.startDate)
  );

  let bestSoFar = Infinity;
  return chronological.map((effort) => {
    const wasPRAtTheTime = effort.durationSec < bestSoFar;
    if (wasPRAtTheTime) bestSoFar = effort.durationSec;
    return { ...effort, wasPRAtTheTime };
  });
}

/**
 * Sorts efforts for one target distance fastest-first (ties broken by
 * earlier `startDate`), truncates to `n`, and stamps 1-based `rank`.
 */
export function rankTopN(
  effortsForDistance: PRRankingEntry[] | Array<Omit<PRRankingEntry, 'rank'>>,
  n: number = TOP_N
): PRRankingEntry[] {
  const sorted = [...effortsForDistance].sort((a, b) => {
    if (a.durationSec !== b.durationSec) return a.durationSec - b.durationSec;
    return Date.parse(a.startDate) - Date.parse(b.startDate);
  });

  return sorted.slice(0, n).map((entry, index) => ({ ...entry, rank: index + 1 }));
}
