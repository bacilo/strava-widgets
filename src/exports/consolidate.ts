import fs from 'node:fs';
import path from 'node:path';

import polyline from '@mapbox/polyline';

import { IntervalsProvider } from '../api/intervals-provider.js';
import type { StravaActivity } from '../types/strava.types.js';
import { columnIndices, parseCsv, parseStravaExportDate } from './csv.js';
import { readOriginal } from './geometry-readers.js';

/**
 * Consolidate bulk exports under export_data/ against the canonical archive.
 *
 * The canonical archive (data/activities/) is the authoritative source the
 * pipeline and any future dashboarding read. Bulk exports are the raw layer
 * beneath it: original device recordings (FIT/GPX) with full-resolution
 * streams. Consolidation:
 *
 *   1. matches every export activity to its canonical record — by Strava id
 *      where the archive id is numeric, by start_date epoch otherwise (both
 *      joins verified exact against live data),
 *   2. imports runs the archive is missing, with geometry decoded from the
 *      original recording and validated against the recorded distance,
 *   3. writes data/provenance.json linking each canonical record to its
 *      original file, so full streams stay one lookup away.
 *
 * Re-runnable and idempotent: new exports dropped under export_data/ (the
 * Garmin one, next) get folded in by running it again.
 */

interface ExportRun {
  stravaId: string;
  epoch: number;
  iso: string;
  name: string;
  activityType: string;
  distanceMeters: number;
  movingTimeS: number;
  elapsedTimeS: number;
  elevationGainM: number;
  maxSpeedMs?: number;
  averageHr?: number;
  maxHr?: number;
  file?: string;
  gear?: string;
}

interface ProvenanceEntry {
  strava_id?: string;
  original?: string;
  matched_by: 'strava_id' | 'start_date' | 'imported';
  gear?: string;
}

const ACTIVITIES_DIR = 'data/activities';
const PROVENANCE_PATH = 'data/provenance.json';

function num(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Parse the Strava bulk export's activities.csv into typed rows. */
export function readStravaExportCsv(root: string): { runs: ExportRun[]; nonRuns: Map<string, number> } {
  const rows = parseCsv(fs.readFileSync(path.join(root, 'activities.csv'), 'utf-8'));
  const header = rows[0];
  const cols = columnIndices(header);

  // Duplicated columns hold display units first, canonical units last —
  // "Distance" is km then meters. Always take the last occurrence.
  const last = (name: string): number => {
    const indices = cols.get(name);
    if (!indices) throw new Error(`activities.csv is missing column "${name}"`);
    return indices[indices.length - 1];
  };

  const runs: ExportRun[] = [];
  const nonRuns = new Map<string, number>();

  for (const row of rows.slice(1)) {
    const activityType = row[last('Activity Type')];
    if (activityType !== 'Run') {
      nonRuns.set(activityType, (nonRuns.get(activityType) ?? 0) + 1);
      continue;
    }

    const epoch = parseStravaExportDate(row[last('Activity Date')]);
    if (epoch === undefined) {
      console.warn(`  unparseable date, skipping row: ${row[last('Activity Date')]}`);
      continue;
    }

    runs.push({
      stravaId: row[last('Activity ID')],
      epoch,
      iso: new Date(epoch * 1000).toISOString().replace('.000Z', 'Z'),
      name: row[last('Activity Name')] || 'Untitled',
      activityType,
      distanceMeters: num(row[last('Distance')]) ?? 0,
      movingTimeS: num(row[last('Moving Time')]) ?? 0,
      elapsedTimeS: num(row[last('Elapsed Time')]) ?? 0,
      elevationGainM: num(row[last('Elevation Gain')]) ?? 0,
      maxSpeedMs: num(row[last('Max Speed')]),
      averageHr: num(row[last('Average Heart Rate')]),
      maxHr: num(row[last('Max Heart Rate')]),
      file: row[last('Filename')] || undefined,
      gear: row[last('Activity Gear')] || undefined,
    });
  }

  return { runs, nonRuns };
}

/** Build a canonical record from an export row, geometry attached separately. */
function toCanonical(run: ExportRun): StravaActivity {
  return {
    id: Number(run.stravaId),
    name: run.name,
    type: 'Run',
    start_date: run.iso,
    start_date_local: run.iso,
    distance: run.distanceMeters,
    moving_time: Math.round(run.movingTimeS),
    elapsed_time: Math.round(run.elapsedTimeS),
    total_elevation_gain: run.elevationGainM,
    average_speed: run.movingTimeS > 0 ? run.distanceMeters / run.movingTimeS : 0,
    max_speed: run.maxSpeedMs ?? 0,
    average_heartrate: run.averageHr,
    max_heartrate: run.maxHr,
    map: { summary_polyline: '' },
    source_provider: 'strava-export',
    external_id: run.file ? path.basename(run.file) : undefined,
  };
}

export async function consolidateExports(): Promise<void> {
  const exportRoot = 'export_data';
  const sources = fs.existsSync(exportRoot)
    ? fs.readdirSync(exportRoot).filter(d => fs.statSync(path.join(exportRoot, d)).isDirectory())
    : [];

  if (sources.length === 0) {
    console.log('Nothing to consolidate: no directories under export_data/.');
    return;
  }

  // Canonical archive index.
  const archiveById = new Map<string, string>(); // id -> filename
  const archiveByEpoch = new Map<number, string>(); // epoch -> id
  for (const file of fs.readdirSync(ACTIVITIES_DIR).filter(f => f.endsWith('.json'))) {
    const activity = JSON.parse(fs.readFileSync(path.join(ACTIVITIES_DIR, file), 'utf-8'));
    const id = String(activity.id);
    archiveById.set(id, file);
    archiveByEpoch.set(Math.floor(new Date(activity.start_date).getTime() / 1000), id);
  }
  console.log(`Canonical archive: ${archiveById.size} activities\n`);

  const provenance: Record<string, ProvenanceEntry> = {};
  const sourceSummaries: Record<string, unknown> = {};
  let imported = 0;

  for (const source of sources) {
    const root = path.join(exportRoot, source);

    if (source !== 'strava') {
      console.log(`== ${source}: no adapter yet — inventoried but not consolidated`);
      sourceSummaries[source] = { status: 'awaiting_adapter' };
      continue;
    }

    console.log(`== ${source}: reading activities.csv`);
    const { runs, nonRuns } = readStravaExportCsv(root);
    console.log(`   ${runs.length} runs, non-runs kept raw only: ${JSON.stringify(Object.fromEntries(nonRuns))}`);

    let byId = 0;
    let byEpoch = 0;
    const missing: ExportRun[] = [];

    for (const run of runs) {
      const original = run.file ? `${source}:${run.file}` : undefined;
      if (archiveById.has(run.stravaId)) {
        byId++;
        provenance[run.stravaId] = { matched_by: 'strava_id', original, gear: run.gear };
      } else if (archiveByEpoch.has(run.epoch)) {
        byEpoch++;
        const id = archiveByEpoch.get(run.epoch)!;
        provenance[id] = { strava_id: run.stravaId, matched_by: 'start_date', original, gear: run.gear };
      } else {
        missing.push(run);
      }
    }

    console.log(`   matched: ${byId} by strava id, ${byEpoch} by start_date`);
    console.log(`   missing from archive: ${missing.length}`);

    // Import what the archive lacks.
    for (const run of missing) {
      const activity = toCanonical(run);

      if (run.file) {
        try {
          const recording = await readOriginal(path.join(root, run.file));
          const validation = IntervalsProvider.validateGeometry(
            recording.coordinates,
            run.distanceMeters
          );
          if (validation.ok) {
            activity.map = { summary_polyline: polyline.encode(recording.coordinates) };
            activity.start_latlng = recording.coordinates[0];
          } else {
            console.warn(`   ${run.stravaId}: geometry rejected (${validation.reason}); importing without route`);
          }
        } catch (error: any) {
          console.warn(`   ${run.stravaId}: could not read original (${error.message}); importing without route`);
        }
      }

      const filename = `${activity.id}.json`;
      fs.writeFileSync(
        path.join(ACTIVITIES_DIR, filename),
        JSON.stringify(activity, null, 2)
      );
      archiveById.set(String(activity.id), filename);
      archiveByEpoch.set(run.epoch, String(activity.id));
      provenance[String(activity.id)] = {
        matched_by: 'imported',
        original: run.file ? `${source}:${run.file}` : undefined,
        gear: run.gear,
      };
      imported++;
      console.log(
        `   + imported ${run.iso.slice(0, 10)} ${run.name} ` +
        `(${(run.distanceMeters / 1000).toFixed(1)} km${activity.map?.summary_polyline ? ', with route' : ', no route'})`
      );
    }

    sourceSummaries[source] = {
      csv_runs: runs.length,
      matched_by_id: byId,
      matched_by_epoch: byEpoch,
      imported: missing.length,
      runs_without_original: runs.filter(r => !r.file).length,
      non_runs: Object.fromEntries(nonRuns),
    };
  }

  // Archive records with no original anywhere (Garmin-only blips, pre-export deletions).
  const withoutOriginal = [...archiveById.keys()].filter(
    id => !provenance[id]?.original && provenance[id]?.matched_by !== 'imported'
  );

  const doc = {
    generated_at: new Date().toISOString(),
    note: 'Maps canonical activity ids to original recordings under export_data/ (gitignored, local-only). Regenerate with: node dist/index.js consolidate-exports',
    sources: sourceSummaries,
    archive_total: archiveById.size,
    archive_without_original: withoutOriginal,
    activities: provenance,
  };
  fs.writeFileSync(PROVENANCE_PATH, JSON.stringify(doc, null, 2));

  console.log(`\nProvenance written: ${PROVENANCE_PATH}`);
  console.log(`  archive total: ${archiveById.size}`);
  console.log(`  linked to an original: ${Object.values(provenance).filter(p => p.original).length}`);
  console.log(`  imported this run: ${imported}`);
  console.log(`  archive records with no original: ${withoutOriginal.length}`);
  if (withoutOriginal.length > 0 && withoutOriginal.length <= 40) {
    console.log(`    ${withoutOriginal.join(', ')}`);
  }
  if (imported > 0) {
    console.log('\nArchive changed — regenerate stats/geo/routes/heatmap before deploying.');
  }
}
