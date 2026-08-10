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

import * as path from 'path';

import type {
  ActivityBestEfforts,
  BestEffortsDocument,
  ComputedEffort,
  PRRankingEntry,
  RejectedEffort,
  TargetDistanceKey,
} from './best-effort.types.js';
import { BEST_EFFORTS_SCHEMA_VERSION, TARGET_METERS, TARGET_ORDER } from './best-effort.types.js';
import {
  findBestEffort,
  isPlausible,
  markPRs,
  rankTopN,
  validateStreamSeries,
  WORLD_RECORD_SPEED_MPS,
} from './best-effort-utils.js';
import { loadManifest } from '../streams/stream-manifest.js';
import type { CanonicalStream, DistanceSource } from '../streams/stream.types.js';
import type { StravaActivity } from '../types/strava.types.js';
import { FileStore } from '../storage/file-store.js';

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

/** Options for `computeBestEfforts`, each defaulted to the repo's standard data layout. */
export interface ComputeBestEffortsOptions {
  activitiesDir?: string;
  streamsDir?: string;
  streamsManifestPath?: string;
  statsDir?: string;
}

interface PRAccumulatorEntry {
  activityId: string;
  startDate: string;
  durationSec: number;
  paceSecPerKm: number;
  lowConfidence: boolean;
}

/** Cap on rejection rows echoed to the console, so a pathological run cannot flood CI logs. */
const REJECTED_CONSOLE_CAP = 50;

/**
 * Reads the stream manifest, sweeps every available activity's stream for
 * the seven target distances, marks personal records chronologically, and
 * writes `<statsDir>/best-efforts.json` atomically. Returns the document as
 * well as writing it, so tests and the fixture suite can assert without
 * re-reading the file.
 */
export async function computeBestEfforts(
  options: ComputeBestEffortsOptions = {}
): Promise<BestEffortsDocument> {
  const activitiesDir = options.activitiesDir || 'data/activities';
  const streamsDir = options.streamsDir || 'data/streams';
  const streamsManifestPath = options.streamsManifestPath || 'data/streams/manifest.json';
  const statsDir = options.statsDir || 'data/stats';

  const fileStore = new FileStore('.');

  console.log(`Computing best efforts from manifest: ${streamsManifestPath}`);

  const manifest = await loadManifest(fileStore, streamsManifestPath);

  let skippedNoStream = 0;
  let skippedUnreadable = 0;
  let effortsRejected = 0;
  let lowConfidenceEfforts = 0;

  const activities: Record<string, ActivityBestEfforts> = {};
  const rejected: RejectedEffort[] = [];

  // Map<distance, entries> — accumulated across the whole archive, then
  // sorted/marked/ranked once per distance after the per-activity loop.
  const byDistance = new Map<TargetDistanceKey, PRAccumulatorEntry[]>();
  for (const key of TARGET_ORDER) byDistance.set(key, []);

  for (const [id, entry] of Object.entries(manifest.activities)) {
    if (!entry.available) {
      skippedNoStream++;
      continue;
    }

    try {
      const activity = await fileStore.readJson<StravaActivity>(
        path.join(activitiesDir, `${id}.json`)
      );
      const stream = await fileStore.readJson<CanonicalStream>(path.join(streamsDir, `${id}.json`));

      const result = computeActivityEfforts({
        activityId: id,
        startDate: activity.start_date,
        activityDistanceM: activity.distance,
        maxSpeedMps: activity.max_speed,
        distanceSource: entry.distanceSource,
        t: stream.t,
        d: stream.d,
      });

      if (result.seriesError) {
        console.warn(`  ${id}: ${result.seriesError}; skipping`);
        skippedUnreadable++;
        continue;
      }

      for (const rejection of result.rejected) {
        rejected.push(rejection);
        effortsRejected++;
      }

      for (const effort of result.efforts) {
        if (effort.lowConfidence) lowConfidenceEfforts++;

        byDistance.get(effort.distance)!.push({
          activityId: id,
          startDate: activity.start_date,
          durationSec: effort.durationSec,
          paceSecPerKm: effort.paceSecPerKm,
          lowConfidence: effort.lowConfidence,
        });
      }

      activities[id] = {
        activityId: id,
        startDate: activity.start_date,
        distanceSource: entry.distanceSource,
        efforts: result.efforts.map((e) => ({ ...e, wasPRAtTheTime: false })),
      };
    } catch (error) {
      // A truncated or hand-edited stream/activity file must not abort a
      // 1,842-activity run (threat T-15-02).
      console.warn(`  ${id}: ${(error as Error).message}; skipping`);
      skippedUnreadable++;
      continue;
    }
  }

  const rankings: Record<TargetDistanceKey, PRRankingEntry[]> = {} as Record<
    TargetDistanceKey,
    PRRankingEntry[]
  >;

  for (const key of TARGET_ORDER) {
    const entries = byDistance.get(key)!;
    const withPR = markPRs(entries);

    // Write wasPRAtTheTime back onto the matching effort inside the
    // per-activity results. Each activity has at most one effort per
    // distance, so matching by (activityId, distance) is unambiguous.
    for (const marked of withPR) {
      const activityEfforts = activities[marked.activityId]?.efforts;
      if (!activityEfforts) continue;
      const effort = activityEfforts.find((e) => e.distance === key);
      if (effort) effort.wasPRAtTheTime = marked.wasPRAtTheTime;
    }

    rankings[key] = rankTopN(entries);
  }

  // Diff-stable output — sorted activity ids, mirroring saveManifest's convention.
  const sortedActivities: Record<string, ActivityBestEfforts> = {};
  for (const id of Object.keys(activities).sort((a, b) => a.localeCompare(b))) {
    sortedActivities[id] = activities[id];
  }

  const activitiesWithEfforts = Object.values(sortedActivities).filter(
    (a) => a.efforts.length > 0
  ).length;
  const effortsComputed = Object.values(sortedActivities).reduce(
    (sum, a) => sum + a.efforts.length,
    0
  );

  const doc: BestEffortsDocument = {
    schemaVersion: BEST_EFFORTS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    note:
      'Derived, gitignored, and regenerated by `node dist/index.js compute-best-efforts`. ' +
      'Consumers read this file rather than recomputing.',
    totals: {
      // Activities for which computation was actually attempted — i.e. the
      // manifest total minus entries with no stream available. Entries
      // skipped for lacking a stream are reported separately via
      // `skippedNoStream` and must not be double-counted here.
      activitiesConsidered: Object.keys(manifest.activities).length - skippedNoStream,
      activitiesWithEfforts,
      effortsComputed,
      effortsRejected,
      lowConfidenceEfforts,
      skippedNoStream,
      skippedUnreadable,
    },
    rankings,
    rejected,
    activities: sortedActivities,
  };

  await fileStore.writeJson(path.join(statsDir, 'best-efforts.json'), doc);

  console.log(`\nGenerated best efforts:`);
  console.log(`- Activities considered: ${doc.totals.activitiesConsidered}`);
  console.log(`- Activities with efforts: ${doc.totals.activitiesWithEfforts}`);
  console.log(`- Efforts computed: ${doc.totals.effortsComputed}`);
  console.log(`- Low-confidence efforts: ${doc.totals.lowConfidenceEfforts}`);
  console.log(`- Skipped (no stream): ${doc.totals.skippedNoStream}`);
  console.log(`- Skipped (unreadable): ${doc.totals.skippedUnreadable}`);
  for (const key of TARGET_ORDER) {
    console.log(`  ${key}: ${rankings[key].length} ranked`);
  }
  console.log(`\nOutput written to: ${path.join(statsDir, 'best-efforts.json')}`);

  if (rejected.length > 0) {
    console.log(`\nRejected efforts (dropped, not fatal):`);
    for (const r of rejected.slice(0, REJECTED_CONSOLE_CAP)) {
      console.log(`  ${r.activityId} ${r.distance}: ${r.reason}`);
    }
    if (rejected.length > REJECTED_CONSOLE_CAP) {
      console.log(`  ... and ${rejected.length - REJECTED_CONSOLE_CAP} more`);
    }
  }

  return doc;
}
