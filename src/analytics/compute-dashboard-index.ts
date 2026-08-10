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
} from './dashboard-index.types.js';
import { DASHBOARD_INDEX_SCHEMA_VERSION } from './dashboard-index.types.js';
import type { ActivityBestEfforts, BestEffortsDocument } from './best-effort.types.js';
import type { StreamManifest } from '../streams/stream.types.js';
import type { StravaActivity } from '../types/strava.types.js';
import { FileStore } from '../storage/file-store.js';

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

/** Options for `computeDashboardIndex`, each defaulted to the repo's standard data layout. */
export interface ComputeDashboardIndexOptions {
  activitiesDir?: string;
  streamsManifestPath?: string;
  statsDir?: string;
  geoDir?: string;
  outDir?: string;
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

  let withStreams = 0;
  let withoutStreams = 0;
  let withHr = 0;
  let withCadence = 0;
  let lowConfidenceCount = 0;
  let excludedFromRecordsCount = 0;
  let skippedUnreadable = 0;

  const rows: DashboardIndexRow[] = [];

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

      const row: DashboardIndexRow = {
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
      };

      rows.push(row);
    } catch (error) {
      console.warn(`  ${id}: ${(error as Error).message}; skipping`);
      skippedUnreadable++;
      continue;
    }
  }

  rows.sort((a, b) => Date.parse(b.startDateLocal) - Date.parse(a.startDateLocal));

  const totals: DashboardIndexTotals = {
    activities: rows.length,
    withStreams,
    withoutStreams,
    withHr,
    withCadence,
    lowConfidence: lowConfidenceCount,
    excludedFromRecords: excludedFromRecordsCount,
    skippedUnreadable,
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

  console.log(`\nGenerated dashboard index:`);
  console.log(`- Activities indexed: ${totals.activities}`);
  console.log(`- With streams: ${totals.withStreams}`);
  console.log(`- Without streams: ${totals.withoutStreams}`);
  console.log(`- With HR: ${totals.withHr}`);
  console.log(`- With cadence: ${totals.withCadence}`);
  console.log(`- Low confidence: ${totals.lowConfidence}`);
  console.log(`- Excluded from records: ${totals.excludedFromRecords}`);
  console.log(`- Skipped (unreadable): ${totals.skippedUnreadable}`);
  console.log(`\nOutput written to: ${path.join(outDir, 'index.json')}`);

  return doc;
}
