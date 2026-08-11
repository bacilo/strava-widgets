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
import { buildGearLabelMap, type GearUsage } from './gear-naming.js';
import { parseGearDocument } from '../dashboard/data/gear-client.js';

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

  // First pass: build every row EXCEPT gearName, and collect gear usage
  // ({ gearId, startDate }) for every activity that has a non-empty string
  // gear_id. The label map needs every activity's usage before any label
  // can be assigned, so gearName is deliberately left for the second pass
  // below — the activity file is read exactly once here, never twice.
  const pendingRows: Array<{ row: Omit<DashboardIndexRow, 'gearName'>; gearId: string | null }> =
    [];
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
      };

      pendingRows.push({ row, gearId });
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
  console.log(`- With gear: ${totals.withGear}`);
  console.log(`\nOutput written to: ${path.join(outDir, 'index.json')}`);

  return doc;
}
