/**
 * Manifest-driven best-effort computation over committed streams.
 *
 * Reads the Phase 14 stream manifest (`data/streams/manifest.json`) plus
 * per-activity stream and canonical activity JSON, sweeps every available
 * activity's stream for the seven target distances, guards and flags the
 * results, marks personal records chronologically, and writes the
 * gitignored `data/stats/best-efforts.json` that Phases 16-18 read and
 * never recompute.
 */

import type {
  ComputedEffort,
  RejectedEffort,
  TargetDistanceKey,
} from './best-effort.types.js';
import { TARGET_METERS, TARGET_ORDER } from './best-effort.types.js';
import {
  findBestEffort,
  isPlausible,
  validateStreamSeries,
  WORLD_RECORD_SPEED_MPS,
} from './best-effort-utils.js';
import type { DistanceSource } from '../streams/stream.types.js';

/** Rounds to at most one decimal place. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Input to `computeActivityEfforts` — one activity's canonical record plus its stream series. */
export interface ActivityEffortInput {
  activityId: string;
  startDate: string;
  activityDistanceM: number;
  maxSpeedMps: number | undefined;
  distanceSource: DistanceSource;
  t: number[];
  d: number[];
}

/** Output of `computeActivityEfforts` — per-activity efforts, rejections, and eligibility metadata. */
export interface ActivityEffortResult {
  efforts: ComputedEffort[];
  rejected: RejectedEffort[];
  eligibleTargets: TargetDistanceKey[];
  seriesError?: string;
}

/**
 * Computes all plausible efforts for one activity across the seven target
 * distances. Pure — no file I/O. This is the seam the fixture-validation
 * suite (plan 04) calls directly without any file writing.
 */
export function computeActivityEfforts(input: ActivityEffortInput): ActivityEffortResult {
  const { activityId, activityDistanceM, maxSpeedMps, distanceSource, t, d } = input;

  const seriesValidation = validateStreamSeries(t, d);
  if (!seriesValidation.ok) {
    return { efforts: [], rejected: [], eligibleTargets: [], seriesError: seriesValidation.reason };
  }

  // D-01: 1% margin absorbs the difference between the canonical `distance`
  // field and the stream's own span.
  const eligibleTargets = TARGET_ORDER.filter(
    (key) => activityDistanceM >= TARGET_METERS[key] * 0.99
  );

  const efforts: ComputedEffort[] = [];
  const rejected: RejectedEffort[] = [];

  for (const key of eligibleTargets) {
    try {
      const raw = findBestEffort(t, d, TARGET_METERS[key]);
      if (!raw) {
        // The stream simply never covers this distance — not an error, not a rejection.
        continue;
      }

      const impliedSpeedMps = TARGET_METERS[key] / raw.durationSec;
      const plausibility = isPlausible(impliedSpeedMps, maxSpeedMps, WORLD_RECORD_SPEED_MPS[key]);

      if (!plausibility.ok) {
        rejected.push({ activityId, distance: key, reason: plausibility.reason });
        continue;
      }

      const paceSecPerKm = raw.durationSec / (TARGET_METERS[key] / 1000);

      efforts.push({
        distance: key,
        durationSec: round1(raw.durationSec),
        paceSecPerKm: round1(paceSecPerKm),
        startOffsetSec: Math.round(raw.startOffsetSec),
        endOffsetSec: round1(raw.endOffsetSec),
        lowConfidence: distanceSource === 'geo',
      });
    } catch (error) {
      // One target throwing must never lose the activity's other six (Pitfall 6).
      rejected.push({
        activityId,
        distance: key,
        reason: `unexpected error: ${(error as Error).message}`,
      });
    }
  }

  return { efforts, rejected, eligibleTargets };
}
