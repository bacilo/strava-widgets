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
import type { DistanceSource } from '../streams/stream.types.js';

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
 *
 * NOT YET IMPLEMENTED — RED phase stub.
 */
export function computeActivityEfforts(_input: ActivityEffortInput): ActivityEffortResult {
  throw new Error('not implemented');
}
