/**
 * Best-effort computation utilities for running analytics.
 *
 * Durations are always `t[j] - t[i]`, computed at the exact target-distance
 * crossing — never a sample-index count and never snapped to the next
 * sample. Distance is always read from the caller's `d` array. This module
 * performs no I/O.
 */

import type { PlausibilityResult, RawEffort } from './best-effort.types.js';

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
