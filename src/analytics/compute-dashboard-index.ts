/**
 * Manifest-driven dashboard index generation over the committed archive.
 *
 * Reads the Phase 14 stream manifest (`data/streams/manifest.json`) plus
 * per-activity canonical activity JSON, cross-references the Phase 15
 * best-efforts document and Phase 12 activity-cities geocoding output, and
 * writes the gitignored `data/dashboard/index.json` browse-complete index
 * that the Phase 17 dashboard shell loads up front instead of fetching all
 * 1,867 detail files.
 */

import * as path from 'path';

import type {
  DashboardIndexDocument,
  DashboardIndexRow,
  DashboardIndexStreams,
  DashboardIndexTotals,
  PaceDisagreement,
} from './dashboard-index.types.js';
import { DASHBOARD_INDEX_SCHEMA_VERSION } from './dashboard-index.types.js';
import type { ActivityBestEfforts, BestEffortsDocument } from './best-effort.types.js';
import type { CanonicalStream, StreamManifest } from '../streams/stream.types.js';
import type { StravaActivity } from '../types/strava.types.js';
import { FileStore } from '../storage/file-store.js';
import { buildGearLabelMap, type GearUsage } from './gear-naming.js';
import { parseGearDocument } from '../dashboard/data/gear-client.js';
import {
  detectPaceDisagreement,
  PACE_DISAGREEMENT_METADATA_THRESHOLD_SEC_PER_KM,
} from './pace-derivation.js';
import { computePaceQualitySignals, buildPaceQualityShard } from './pace-quality.js';
import type { ActivityQualityMetadata, ActivityQualitySignals, PaceQualityShard } from './pace-quality.js';

/** Rounds to at most one decimal place. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Maps `undefined`, `null`, and `NaN` to `null`; passes through any other number. */
function numOrNull(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return value;
}

/**
 * Normalized, NaN-safe sort key for `startDateLocal` (WR-03). Z-suffixed
 * Strava values parse as UTC while no-`Z` intervals.icu values parse in the
 * build machine's local timezone, so on a CET developer machine the
 * intervals rows are skewed by one to two hours relative to CI (UTC) — a
 * locally generated `index.json` can order same-day boundary activities
 * differently than the deployed one. Appending `Z` to the no-Z form before
 * parsing makes both shapes comparable on the same UTC axis. An unparseable
 * value previously made `Date.parse` return `NaN`, which leaves the whole
 * comparator (and therefore the whole sort order) unspecified rather than
 * merely misplacing one row; falling back to `0` here confines the damage
 * to that single row instead.
 */
function startDateSortKey(startDateLocal: string): number {
  const normalized = startDateLocal.endsWith('Z') ? startDateLocal : `${startDateLocal}Z`;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Options for `computeDashboardIndex`, each defaulted to the repo's standard data layout. */
export interface ComputeDashboardIndexOptions {
  activitiesDir?: string;
  streamsManifestPath?: string;
  statsDir?: string;
  geoDir?: string;
  outDir?: string;
  gearConfigPath?: string;
  streamsDir?: string;
}

/**
 * Reads the stream manifest, cross-references the committed archive's
 * activity records, best-efforts document, and geocoded cities map, and
 * writes `<outDir>/index.json` atomically. Returns the document as well as
 * writing it, so tests can assert without re-reading the file.
 */
export async function computeDashboardIndex(
  options: ComputeDashboardIndexOptions = {}
): Promise<DashboardIndexDocument> {
  const activitiesDir = options.activitiesDir || 'data/activities';
  const streamsManifestPath = options.streamsManifestPath || 'data/streams/manifest.json';
  const statsDir = options.statsDir || 'data/stats';
  const geoDir = options.geoDir || 'data/geo';
  const outDir = options.outDir || 'data/dashboard';
  const gearConfigPath = options.gearConfigPath || 'data/config/gear.json';
  const streamsDir = options.streamsDir || 'data/streams';

  const fileStore = new FileStore('.');

  console.log(`Computing dashboard index from manifest: ${streamsManifestPath}`);

  // REQUIRED — without the manifest there is nothing to index. Deliberately
  // NOT using stream-manifest.ts's loadManifest, which tolerates a missing
  // file by returning an empty manifest; here a missing manifest must throw.
  const manifest = await fileStore.readJson<StreamManifest>(streamsManifestPath);

  // OPTIONAL — degrade to an empty lookup on any failure, warning why.
  let bestEfforts: BestEffortsDocument | undefined;
  try {
    bestEfforts = await fileStore.readJson<BestEffortsDocument>(
      path.join(statsDir, 'best-efforts.json')
    );
  } catch (error) {
    console.warn(
      `Could not read best-efforts document (${(error as Error).message}); ` +
        `PR counts and record exclusions will be absent.`
    );
  }

  // OPTIONAL — degrade to an empty lookup on any failure, warning why.
  let cities: Record<string, string[]> | undefined;
  try {
    cities = await fileStore.readJson<Record<string, string[]>>(
      path.join(geoDir, 'activity-cities.json')
    );
  } catch (error) {
    console.warn(
      `Could not read activity-cities document (${(error as Error).message}); ` +
        `locations will fall back to each activity's location_city.`
    );
  }

  // OPTIONAL — degrade to a null map on any failure, warning why (D-19: gear
  // is not a phase blocker). A null map still lets buildGearLabelMap assign
  // full ordinal labelling below.
  let gearMap: Record<string, string> | null = null;
  try {
    const rawGearDoc = await fileStore.readJson<unknown>(gearConfigPath);
    gearMap = parseGearDocument(rawGearDoc);
    if (gearMap === null) {
      console.warn(`Gear config at ${gearConfigPath} is malformed; gear names will use ordinals only.`);
    }
  } catch (error) {
    console.warn(
      `Could not read gear config (${(error as Error).message}); gear names will use ordinals only.`
    );
  }

  let withStreams = 0;
  let withoutStreams = 0;
  let withHr = 0;
  let withCadence = 0;
  let lowConfidenceCount = 0;
  let excludedFromRecordsCount = 0;
  let skippedUnreadable = 0;
  let withGear = 0;
  let paceDisagreementCount = 0;
  let qualityAnySevereCount = 0;
  let qualityNotComputableCount = 0;
  // Added cost of computing the Phase 27 quality signals and building the
  // D-17 evidence shard — a full stream read over the archive added to a
  // step that previously read streams only conditionally (PACE-07's
  // threshold-gated read). Tracked separately from the pre-existing loop
  // work so a future regression in this specific cost is visible.
  let qualityComputeMs = 0;

  // First pass: build every row EXCEPT gearName, and collect gear usage
  // ({ gearId, startDate }) for every activity that has a non-empty string
  // gear_id. The label map needs every activity's usage before any label
  // can be assigned, so gearName is deliberately left for the second pass
  // below — the activity file is read exactly once here, never twice.
  //
  // `shard` is carried alongside `row` (built in this SAME pass, from the
  // SAME stream read the row's `quality` field itself used) rather than
  // re-read from disk in the shard-write loop below — one stream read per
  // activity per run, never two, matching PACE-07's own reuse discipline.
  const pendingRows: Array<{
    row: Omit<DashboardIndexRow, 'gearName'>;
    gearId: string | null;
    shard: PaceQualityShard;
  }> = [];
  const gearUsages: GearUsage[] = [];

  for (const [id, entry] of Object.entries(manifest.activities)) {
    try {
      const activity = await fileStore.readJson<StravaActivity>(
        path.join(activitiesDir, `${id}.json`)
      );

      const streams: DashboardIndexStreams = entry.available
        ? {
            available: true,
            hr: entry.channels.hr,
            cadence: entry.channels.cadence,
            elevation: entry.channels.elevation,
            distanceSource: entry.distanceSource,
          }
        : {
            available: false,
            reason: entry.reason,
            hr: false,
            cadence: false,
            elevation: false,
          };

      if (entry.available) {
        withStreams++;
        if (entry.channels.hr) withHr++;
        if (entry.channels.cadence) withCadence++;
      } else {
        withoutStreams++;
      }

      const lowConfidence = entry.available && entry.distanceSource === 'geo';
      if (lowConfidence) lowConfidenceCount++;

      const bestEffortsEntry: ActivityBestEfforts | undefined = bestEfforts?.activities[id];
      const excludedFromRecords = bestEffortsEntry?.excludedFromRecords ?? false;
      if (excludedFromRecords) excludedFromRecordsCount++;
      const prCount = bestEffortsEntry
        ? bestEffortsEntry.efforts.filter((e) => e.wasPRAtTheTime === true).length
        : 0;

      const cityNames = cities?.[id];
      const location =
        cityNames && cityNames.length > 0
          ? cityNames[0]
          : ((activity.location_city as string | null | undefined) ?? null);

      const distanceM = activity.distance;
      const movingTimeSec = activity.moving_time;
      const paceSecPerKm =
        distanceM > 0 && movingTimeSec > 0 ? round1(movingTimeSec / (distanceM / 1000)) : null;

      // PACE-07/D-14: gated on the threshold so the archive sweep stays
      // cheap — only when the metadata pace is implausibly fast do we read
      // the activity's stream file at all (T-26-09). Degrades to `null` on
      // any stream read/parse failure (T-26-01), following the existing
      // OPTIONAL-read pattern this file already uses for best-efforts,
      // cities and gear.
      //
      // `streamForActivity`/`streamReadAttempted` carry this read forward
      // to the QUAL-01/QUAL-03 block below so an activity whose pace also
      // triggered this check is never read from `streamsDir` twice.
      let paceDisagreement: PaceDisagreement | null = null;
      let streamForActivity: CanonicalStream | null = null;
      let streamReadAttempted = false;
      if (
        paceSecPerKm !== null &&
        paceSecPerKm < PACE_DISAGREEMENT_METADATA_THRESHOLD_SEC_PER_KM
      ) {
        streamReadAttempted = true;
        try {
          streamForActivity = await fileStore.readJson<CanonicalStream>(
            path.join(streamsDir, `${id}.json`)
          );
          paceDisagreement = detectPaceDisagreement(paceSecPerKm, streamForActivity);
        } catch (error) {
          console.warn(
            `  ${id}: could not read stream for pace disagreement check (${(error as Error).message}); paceDisagreement will be null`
          );
          paceDisagreement = null;
          streamForActivity = null;
        }
        if (paceDisagreement !== null) paceDisagreementCount++;
      }

      // QUAL-01/QUAL-03: UNLIKE paceDisagreement's gated read above, the
      // three stream-derived quality signals need every activity's stream
      // unconditionally — reuse the read above when it already happened for
      // this activity, otherwise read once here when the manifest says a
      // stream exists. Where the manifest says no stream is available, pass
      // `null` directly without attempting a read — `computePaceQualitySignals`
      // turns that into an explicit `notComputableReason`, never a zeroed
      // `'none'` tier (D-06). A read/parse failure degrades the same way,
      // following the same try/catch-and-warn shape as the block above.
      const qualityStart = Date.now();
      let streamForQuality: CanonicalStream | null = streamForActivity;
      if (!streamReadAttempted) {
        if (entry.available) {
          try {
            streamForQuality = await fileStore.readJson<CanonicalStream>(
              path.join(streamsDir, `${id}.json`)
            );
          } catch (error) {
            console.warn(
              `  ${id}: could not read stream for quality signals (${(error as Error).message}); quality will be not-computable`
            );
            streamForQuality = null;
          }
        } else {
          streamForQuality = null;
        }
      }

      const qualityMetadata: ActivityQualityMetadata = {
        deviceName: activity.device_name,
        sourceProvider: activity.source_provider,
        elapsedTimeSec: activity.elapsed_time,
        movingTimeSec: activity.moving_time,
      };
      const quality: ActivityQualitySignals = computePaceQualitySignals(
        streamForQuality,
        qualityMetadata
      );
      const shard: PaceQualityShard = buildPaceQualityShard(
        String(id),
        streamForQuality,
        qualityMetadata
      );
      qualityComputeMs += Date.now() - qualityStart;
      if (quality.anySevere) qualityAnySevereCount++;
      if (quality.notComputableReason !== null) qualityNotComputableCount++;

      // Raw gear id, used only as a map key/sort input for the label map
      // below — never assigned directly to any row field (17-D32/D33).
      const rawGearId = (activity as unknown as { gear_id?: unknown }).gear_id;
      const gearId = typeof rawGearId === 'string' && rawGearId.length > 0 ? rawGearId : null;
      if (gearId !== null) {
        gearUsages.push({ gearId, startDate: activity.start_date });
      }

      const row: Omit<DashboardIndexRow, 'gearName'> = {
        id: String(id),
        startDate: activity.start_date,
        startDateLocal: activity.start_date_local,
        name: activity.name,
        distanceM,
        movingTimeSec,
        paceSecPerKm,
        elevationGainM: numOrNull(activity.total_elevation_gain),
        avgHr: numOrNull(activity.average_heartrate),
        maxHr: numOrNull(activity.max_heartrate),
        avgCadenceRpm: numOrNull(activity.average_cadence),
        location,
        // Strava records carry `sport_type`; intervals.icu-migrated records
        // (Aug 2026 ingestion switch, `i...`-prefixed ids) carry only `type`.
        // Fall back so the real archive's mixed provenance doesn't produce
        // rows with a missing sportType.
        sportType: (activity.sport_type as string | undefined) ?? activity.type,
        streams,
        lowConfidence,
        excludedFromRecords,
        prCount,
        paceDisagreement,
        quality,
      };

      pendingRows.push({ row, gearId, shard });
    } catch (error) {
      console.warn(`  ${id}: ${(error as Error).message}; skipping`);
      skippedUnreadable++;
      continue;
    }
  }

  // Second pass: resolve every gear id to a human label in one deterministic
  // call, then assemble the final rows. The recording device's own name is
  // deliberately NOT used as a shoe fallback here — `resolveGearLabel`'s
  // ladder does that for the detail view's single-activity Gear tile, but a
  // device is not a shoe, and putting it in a *shoe* aggregate would
  // silently invent gear coverage the archive does not have (D-18's
  // "absence made up" failure).
  const gearLabelMap = buildGearLabelMap(gearUsages, gearMap);

  // Carried alongside `pendingRows` (built from the SAME stream read as each
  // row's own `quality` field, never a second one) — keyed by id so the
  // shard-write loop below can look each one up by the FINAL, sorted row
  // order without re-reading any stream from disk.
  const shardsById = new Map<string, PaceQualityShard>(
    pendingRows.map(({ row, shard }) => [row.id, shard])
  );

  const rows: DashboardIndexRow[] = pendingRows.map(({ row, gearId }) => {
    const gearName = gearId !== null ? (gearLabelMap.get(gearId) ?? null) : null;
    if (gearName !== null) withGear++;
    return { ...row, gearName };
  });

  rows.sort((a, b) => startDateSortKey(b.startDateLocal) - startDateSortKey(a.startDateLocal));

  const totals: DashboardIndexTotals = {
    activities: rows.length,
    withStreams,
    withoutStreams,
    withHr,
    withCadence,
    lowConfidence: lowConfidenceCount,
    excludedFromRecords: excludedFromRecordsCount,
    skippedUnreadable,
    withGear,
    qualityAnySevere: qualityAnySevereCount,
    qualityNotComputable: qualityNotComputableCount,
  };

  const doc: DashboardIndexDocument = {
    schemaVersion: DASHBOARD_INDEX_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    note:
      'Derived, gitignored, and regenerated by `node dist/index.js compute-dashboard-index`. ' +
      'Consumers read this file rather than recomputing.',
    totals,
    activities: rows,
  };

  await fileStore.writeJson(path.join(outDir, 'index.json'), doc);

  // D-17 evidence shard — one file per row, including stream-less
  // activities, so the detail view always has an honest artifact to fetch
  // rather than a 404 it must interpret. Mirrors `compute-best-efforts.ts`'s
  // own per-id shard-write loop shape (main doc write immediately followed
  // by a per-id loop). Runs over the FINAL, sorted `rows` so every row that
  // made it into the published index gets exactly one shard; the shard
  // object itself was already built above from the same stream read the
  // row's own `quality` field used, never re-read here.
  const shardWriteStart = Date.now();
  for (const row of rows) {
    const shard = shardsById.get(row.id);
    if (shard) {
      await fileStore.writeJson(path.join(statsDir, 'pace-quality', `${row.id}.json`), shard);
    }
  }
  const shardWriteMs = Date.now() - shardWriteStart;

  console.log(`\nGenerated dashboard index:`);
  console.log(`- Activities indexed: ${totals.activities}`);
  console.log(`- With streams: ${totals.withStreams}`);
  console.log(`- Without streams: ${totals.withoutStreams}`);
  console.log(`- With HR: ${totals.withHr}`);
  console.log(`- With cadence: ${totals.withCadence}`);
  console.log(`- Low confidence: ${totals.lowConfidence}`);
  console.log(`- Excluded from records: ${totals.excludedFromRecords}`);
  console.log(`- Skipped (unreadable): ${totals.skippedUnreadable}`);
  console.log(`- With gear: ${totals.withGear}`);
  console.log(`- Pace disagreements flagged: ${paceDisagreementCount}`);
  console.log(`- Quality: any severe signal: ${totals.qualityAnySevere}`);
  console.log(`- Quality: not computable: ${totals.qualityNotComputable}`);
  console.log(
    `- Quality pass wall time: ${qualityComputeMs + shardWriteMs}ms ` +
      `(signal compute + shard build ${qualityComputeMs}ms, shard write ${shardWriteMs}ms)`
  );
  console.log(`\nOutput written to: ${path.join(outDir, 'index.json')}`);

  return doc;
}
