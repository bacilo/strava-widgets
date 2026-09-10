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
  EffortDemotion,
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
// `deriveCeilings(...)` is imported here and called exactly once below, in
// the derivation pass between accumulation and filtering (PR-01's
// no-iteration clause) — see the "no iteration to convergence" suite in
// compute-best-efforts.test.ts.
import { ceilingDemotion, deriveCeilings } from './best-effort-ceiling.js';
import {
  buildCeilingStateFile,
  diffCeilingState,
  formatCeilingMovement,
  loadCeilingState,
} from './best-effort-ceiling-state.js';
import { isExcluded, loadExclusions } from './best-effort-exclusions.js';
import { loadManifest } from '../streams/stream-manifest.js';
import type { CanonicalStream, DistanceSource } from '../streams/stream.types.js';
import type { StravaActivity } from '../types/strava.types.js';
import { FileStore } from '../storage/file-store.js';

/** Rounds to at most one decimal place. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Builds the demotion that D-08's shared path records for an absolute-guard
 * rejection. This is the ONLY site in this file that constructs a
 * `demotion` value from `isPlausible`'s failing variant — the ceiling's own
 * rejection (Task 2 below) constructs its `EffortDemotion` via
 * `ceilingDemotion` instead, but nothing else in this file may assign to an
 * effort's `demotion` field, so one guard cannot silently diverge from
 * another (Phase 24's `resolveExcluded` lesson: duplicated derivations
 * defeat checkpoints).
 *
 * `guard` is optional on `PlausibilityResult`'s failing variant only because
 * `validateStreamSeries` shares that type for series-shape failures that
 * carry no absolute guard at all (plan 28-03's decision) — but
 * `validateStreamSeries`'s result is handled earlier, before the per-target
 * loop even starts, and never reaches this function. `isPlausible`'s own two
 * rejection branches always set `guard`, so the throw below is a defensive
 * assertion, not an expected path: it fails loudly (caught by this
 * function's caller's `try`/`catch`, landing as an `unexpected error:` row)
 * rather than silently mis-recording which guard fired.
 */
function demotionFromPlausibility(result: {
  ok: false;
  reason: string;
  guard?: 'max-speed' | 'world-record';
}): EffortDemotion {
  if (!result.guard) {
    throw new Error(
      `demotionFromPlausibility: isPlausible's failing result carried no guard (reason: ${result.reason})`
    );
  }
  return { guard: result.guard, reason: result.reason };
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
      const paceSecPerKm = raw.durationSec / (TARGET_METERS[key] / 1000);

      // D-08: an absolute-guard rejection no longer deletes the effort. It
      // still gets a `rejected` row (the archive-wide report), but the
      // effort itself is retained in `efforts[]` below, carrying its
      // demotion — the single shared path `demotionFromPlausibility` builds.
      if (!plausibility.ok) {
        rejected.push({ activityId, distance: key, reason: plausibility.reason });
      }

      efforts.push({
        distance: key,
        durationSec: round1(raw.durationSec),
        paceSecPerKm: round1(paceSecPerKm),
        startOffsetSec: Math.round(raw.startOffsetSec),
        endOffsetSec: round1(raw.endOffsetSec),
        lowConfidence: distanceSource === 'geo',
        demotion: plausibility.ok ? null : demotionFromPlausibility(plausibility),
      });
    } catch (error) {
      // NOT a demotion of a computed effort (D-08 is about retained-but-
      // flagged efforts) — the computation itself threw, so there is no
      // effort object to retain. This is the one remaining `rejected`-only
      // path; one target throwing must never lose the activity's other six
      // (Pitfall 6).
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
  exclusionsPath?: string;
  ceilingStatePath?: string;
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
  const exclusionsPath = options.exclusionsPath || 'data/best-effort-exclusions.json';
  const ceilingStatePath = options.ceilingStatePath || 'data/best-effort-ceiling.json';

  const fileStore = new FileStore('.');

  console.log(`Computing best efforts from manifest: ${streamsManifestPath}`);

  const manifest = await loadManifest(fileStore, streamsManifestPath);
  const exclusions = await loadExclusions(fileStore, exclusionsPath);
  // D-06/D-07: the previous run's committed ceiling state, loaded ONCE here.
  // This is READ-ONLY input to REPORTING below — Pass 2's `deriveCeilings`
  // call must never consult it, fall back to it, or blend with it. A future
  // reader will be tempted to use the previous value as a stabiliser; D-06
  // rejected exactly that (a hand-maintained/pinned number on the critical
  // path goes stale silently) in favour of re-deriving fresh every run and
  // only comparing against the previous value for the human-facing report.
  const previousState = await loadCeilingState(fileStore, ceilingStatePath);

  let skippedNoStream = 0;
  let skippedUnreadable = 0;
  let effortsExcluded = 0;
  let lowConfidenceEfforts = 0;

  const activities: Record<string, ActivityBestEfforts> = {};
  const rejected: RejectedEffort[] = [];

  // PASS 1 — ACCUMULATE. May read each activity's own stream/canonical
  // record; must not read anything derived from the archive as a whole (no
  // ceiling exists yet). `byDistance` accumulates exactly the population an
  // effort enters only when it PASSED the absolute guard (its `demotion` is
  // null after the per-target loop below) and `isExcluded` is false — this
  // is PR-02's seam: the ceiling's input (Pass 2) is already filtered by the
  // absolute guard and the exclusion list, and it is NOT ceiling-filtered
  // because the ceiling does not exist yet. A demoted effort is retained in
  // `activities[id].efforts` (D-08) but never enters `byDistance`.
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

      // `rejected` now widens to one row per DEMOTED effort across all three
      // guards (world-record, max-speed, ceiling) plus unexpected-error
      // rows — not a "deleted effort" report any more, since D-08 means
      // nothing is deleted. `totals.effortsRejected` below is `rejected.length`.
      for (const rejection of result.rejected) {
        rejected.push(rejection);
      }

      for (const effort of result.efforts) {
        if (effort.lowConfidence) lowConfidenceEfforts++;

        const isEffortExcluded = isExcluded(exclusions, id, effort.distance);
        if (isEffortExcluded) {
          effortsExcluded++;
          continue;
        }

        // D-08/PR-02: a demoted effort is retained in `activities[id].efforts`
        // (below) but must never feed the ranking/ceiling population — only
        // guard-passed, non-excluded efforts reach `byDistance`. Only
        // absolute-guard demotions exist at this point in the file; the
        // ceiling guard (plan 28-05 Task 2) demotes further, downstream of
        // this population, and never re-admits anything filtered out here.
        if (effort.demotion !== null) continue;

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
        efforts: result.efforts.map((e) => ({
          ...e,
          wasPRAtTheTime: false,
          excludedFromRecords: isExcluded(exclusions, id, e.distance),
        })),
        excludedFromRecords: exclusions.has(id),
      };
    } catch (error) {
      // A truncated or hand-edited stream/activity file must not abort a
      // 1,842-activity run (threat T-15-02).
      console.warn(`  ${id}: ${(error as Error).message}; skipping`);
      skippedUnreadable++;
      continue;
    }
  }

  // PASS 2 — DERIVE. May read only `byDistance` (Pass 1's already-filtered
  // output); must not read `activities`, `rejected`, or any ranking output.
  // `deriveCeilings` runs EXACTLY ONCE here, per process — PR-01's
  // no-iteration clause: this call is never re-run after Pass 3 demotes
  // anything below. Re-deriving after demotion is the mutation ROADMAP
  // criterion 1 demonstrates failing (see the "no iteration to convergence"
  // suite in compute-best-efforts.test.ts).
  // Built via `.map()` rather than a `for` loop — deliberately, so a
  // source-text audit of this pass (compute-best-efforts.test.ts's "no
  // iteration to convergence" suite) can assert the single `deriveCeilings`
  // call site below sits inside no loop of any kind, between this pass's
  // own marker and the next pass's.
  const impliedSpeedsByDistance = new Map<TargetDistanceKey, number[]>(
    TARGET_ORDER.map((key) => [
      key,
      byDistance.get(key)!.map((entry) => TARGET_METERS[key] / entry.durationSec),
    ])
  );
  const ceilings = deriveCeilings(impliedSpeedsByDistance);

  const rankings: Record<TargetDistanceKey, PRRankingEntry[]> = {} as Record<
    TargetDistanceKey,
    PRRankingEntry[]
  >;
  // Per-distance count of ceiling demotions, for the console tail below.
  const ceilingDemotedCounts = new Map<TargetDistanceKey, number>();

  // PASS 3 — FILTER AND FLAG. May read `byDistance` and `ceilings` (Pass
  // 2's output); must never remove an entry from `activities[id].efforts` —
  // that array is append-only from Pass 1 onward. Each distance's
  // population is partitioned into survivors and ceiling-demoted; a
  // ceiling-demoted entry's matching effort gains a `demotion` (mirroring
  // Task 1's absolute-guard path) and a matching `rejected` row, but is
  // never spliced out of `activities[id].efforts`. Only survivors reach
  // `markPRs`/`rankTopN`.
  for (const key of TARGET_ORDER) {
    const entries = byDistance.get(key)!;
    const derivation = ceilings[key];

    const survivors: PRAccumulatorEntry[] = [];
    for (const entry of entries) {
      const impliedSpeedMps = TARGET_METERS[key] / entry.durationSec;
      const demotion = ceilingDemotion(impliedSpeedMps, derivation);
      if (demotion) {
        const activityEfforts = activities[entry.activityId]?.efforts;
        const effort = activityEfforts?.find((e) => e.distance === key);
        if (effort) effort.demotion = demotion;
        rejected.push({ activityId: entry.activityId, distance: key, reason: demotion.reason });
      } else {
        survivors.push(entry);
      }
    }
    ceilingDemotedCounts.set(key, entries.length - survivors.length);

    const withPR = markPRs(survivors);

    // Write wasPRAtTheTime back onto the matching effort inside the
    // per-activity results. Each activity has at most one effort per
    // distance, so matching by (activityId, distance) is unambiguous.
    for (const marked of withPR) {
      const activityEfforts = activities[marked.activityId]?.efforts;
      if (!activityEfforts) continue;
      const effort = activityEfforts.find((e) => e.distance === key);
      if (effort) effort.wasPRAtTheTime = marked.wasPRAtTheTime;
    }

    rankings[key] = rankTopN(survivors);
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
  // Derived by walking the shipped data rather than an incrementing
  // counter, so it cannot drift from what a consumer would actually see —
  // counts every effort (any guard: world-record, max-speed, ceiling) whose
  // `demotion` is non-null across the whole built document. A plain `for`
  // loop (not `.filter`) is used deliberately so this read-only count is
  // never mistaken, by source-text audit, for a mutation of
  // `activities[id].efforts` — that array is append-only from Pass 1 onward.
  let effortsDemoted = 0;
  for (const activity of Object.values(sortedActivities)) {
    for (const effort of activity.efforts) {
      if (effort.demotion !== null) effortsDemoted++;
    }
  }

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
      // Widened meaning (D-08): one row per demoted effort (any guard) plus
      // unexpected-error rows — no longer a "deleted effort" count, since
      // nothing is deleted any more.
      effortsRejected: rejected.length,
      effortsExcluded,
      lowConfidenceEfforts,
      skippedNoStream,
      skippedUnreadable,
      effortsDemoted,
    },
    rankings,
    rejected,
    activities: sortedActivities,
    // D-06: every run records the per-distance ceiling, its p90, its
    // population size, and any failOpenReason — persisted for audit.
    ceilings,
  };

  // D-06/D-07: compare this run's fresh derivation against the committed
  // previous state (loaded, read-only, before Pass 2 above) and report the
  // movement. `previousState` never reaches `deriveCeilings` — it is
  // consulted ONLY here, after Pass 3, purely for the human-facing diff.
  const ceilingMovement = diffCeilingState(previousState, doc.ceilings);
  const ceilingMovementLines = formatCeilingMovement(ceilingMovement);

  await fileStore.writeJson(path.join(statsDir, 'best-efforts.json'), doc);

  // Per-activity shard files (18-13/T-18-AVAIL-04): the detail view's
  // best-efforts panel needs exactly one activity's efforts, and must never
  // fetch this whole archive-wide document in a browser (it is multiple MB
  // for the live archive). Mirrors the existing data/activities/{id}.json /
  // data/streams/{id}.json per-activity file convention already established
  // for the raw record and stream — purely additive, does not change
  // best-efforts.json's own shape or any existing consumer.
  for (const [id, entry] of Object.entries(sortedActivities)) {
    await fileStore.writeJson(path.join(statsDir, 'best-efforts', `${id}.json`), entry);
  }

  console.log(`\nGenerated best efforts:`);
  console.log(`- Activities considered: ${doc.totals.activitiesConsidered}`);
  console.log(`- Activities with efforts: ${doc.totals.activitiesWithEfforts}`);
  console.log(`- Efforts computed: ${doc.totals.effortsComputed}`);
  console.log(`- Low-confidence efforts: ${doc.totals.lowConfidenceEfforts}`);
  console.log(`- Efforts excluded (records): ${doc.totals.effortsExcluded}`);
  console.log(`- Skipped (no stream): ${doc.totals.skippedNoStream}`);
  console.log(`- Skipped (unreadable): ${doc.totals.skippedUnreadable}`);
  for (const key of TARGET_ORDER) {
    console.log(`  ${key}: ${rankings[key].length} ranked`);
  }
  console.log(`\nCeilings (Phase 28 PR-01/PR-02):`);
  for (const key of TARGET_ORDER) {
    const derivation = ceilings[key];
    if (derivation.ceilingMps === null) {
      console.log(`  ${key}: fail-open — ${derivation.failOpenReason}`);
    } else {
      const demotedCount = ceilingDemotedCounts.get(key) ?? 0;
      console.log(
        `  ${key}: ceiling ${derivation.ceilingMps.toFixed(4)} m/s (p90 ${derivation.p90Mps!.toFixed(4)} m/s over ${derivation.populationN}), ${demotedCount} demoted`
      );
    }
  }
  console.log(`\nOutput written to: ${path.join(statsDir, 'best-efforts.json')}`);

  // D-06: the ceiling's movement against the committed previous run is
  // always reported in words with numbers — never silent, whether it moved
  // or not. `ceilingMovementRows` (used just below to gate the conditional
  // write) is empty exactly when this run agrees with the previous one,
  // which is the observation this line makes explicit.
  console.log(`\nCeiling movement vs. previous committed run:`);
  if (ceilingMovement.length === 0) {
    console.log(`  unchanged at every distance`);
  } else {
    for (const line of ceilingMovementLines) {
      console.log(`  ${line}`);
    }
  }

  // Write the committed ceiling-state file CONDITIONALLY: only when the
  // ceiling actually moved (`ceilingMovement.length > 0`). The file carries
  // a `generatedAt` stamp, so an unconditional write would produce a commit
  // on every nightly run — and a nightly commit against a repository whose
  // CI already races `origin/master` (T-28-06-C) is how an occasional
  // non-fast-forward becomes a routine one. When nothing moved, the file is
  // left byte-untouched so git sees no diff and the auto-commit step below
  // (daily-refresh.yml) has nothing to stage for this path.
  if (ceilingMovement.length > 0) {
    const stateFile = buildCeilingStateFile(doc.ceilings, doc.generatedAt);
    await fileStore.writeJson(ceilingStatePath, stateFile);
    console.log(`  Committed ceiling state updated: ${ceilingStatePath}`);
  }

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
