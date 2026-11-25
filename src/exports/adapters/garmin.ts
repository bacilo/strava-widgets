import fs from 'node:fs';
import path from 'node:path';

import type { ReconcileExportRun } from '../reconcile.js';
import type { AdapterOutput } from './strava.js';

/**
 * Garmin bulk export -> reconcile input (Phase 36.1-08, L-03).
 * Written against 36.1-GARMIN-PROBE.md and its scrubbed fixture. Every
 * constant below cites the probe section it comes from.
 *
 * Only the fields needed for reconciliation are read. Names and positions are
 * never copied into the output (the audit is public).
 */

/** GARMIN-PROBE section 2: directory holding the summary files, relative to the export root. */
export const GARMIN_SUMMARY_DIR = path.join('DI_CONNECT', 'DI-Connect-Fitness');
/** GARMIN-PROBE section 2: summary files are named `<account>_N_summarizedActivities.json`. The account part is the user's email, so files are found by suffix only. */
export const GARMIN_SUMMARY_SUFFIX = '_summarizedActivities.json';
/** GARMIN-PROBE section 2: each file is `[{"summarizedActivitiesExport":[...rows]}]`. */
export const GARMIN_WRAPPER_KEY = 'summarizedActivitiesExport';
/** GARMIN-PROBE section 3: role keys. */
export const GARMIN_ID_KEY = 'activityId';
export const GARMIN_START_KEY = 'startTimeGmt';
export const GARMIN_TYPE_KEY = 'activityType';
export const GARMIN_DISTANCE_KEY = 'distance';
/** GARMIN-PROBE section 4: start time is epoch milliseconds. */
export const GARMIN_START_MS_PER_S = 1000;
/** GARMIN-PROBE section 4: distance is centimetres (100 cm per metre). */
export const GARMIN_DISTANCE_CM_PER_M = 100;

const ID_PATTERN = /^\d{1,20}$/;

function listSummaryFiles(root: string): string[] {
  const dir = path.join(root, GARMIN_SUMMARY_DIR);
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    names = [];
  }
  const files = names.filter(n => n.endsWith(GARMIN_SUMMARY_SUFFIX)).sort();
  if (files.length === 0) {
    throw new Error(`no summarizedActivities files found under ${GARMIN_SUMMARY_DIR} in the Garmin export root`);
  }
  return files.map(n => path.join(GARMIN_SUMMARY_DIR, n));
}

export function readGarminExportForReconcile(root: string): AdapterOutput {
  const summaryFiles = listSummaryFiles(root);
  const runs: ReconcileExportRun[] = [];

  summaryFiles.forEach((rel, fileIdx) => {
    const label = `summary file #${fileIdx + 1}`;
    const parsed: unknown = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
    const rows = (parsed as Array<Record<string, unknown>>)?.[0]?.[GARMIN_WRAPPER_KEY];
    if (!Array.isArray(rows)) throw new Error(`${label}: wrapper ${GARMIN_WRAPPER_KEY} is not an array`);
    if (rows.length === 0) throw new Error(`${label}: 0 rows`);

    rows.forEach((row: Record<string, unknown>, i: number) => {
      const id = row?.[GARMIN_ID_KEY];
      const start = row?.[GARMIN_START_KEY];
      if (id === undefined || id === null || typeof start !== 'number' || !Number.isFinite(start)) {
        throw new Error(`${label}: row ${i} lacks ${GARMIN_ID_KEY} or ${GARMIN_START_KEY}`);
      }
      const idStr = String(id);
      if (!ID_PATTERN.test(idStr)) throw new Error(`${label}: row ${i} has invalid activity id`);
      const type = row[GARMIN_TYPE_KEY];
      const dist = row[GARMIN_DISTANCE_KEY];
      runs.push({
        sourceId: idStr,
        startEpoch: Math.floor(start / GARMIN_START_MS_PER_S),
        activityType: typeof type === 'string' ? type : '',
        distanceM: typeof dist === 'number' ? dist / GARMIN_DISTANCE_CM_PER_M : 0,
      });
    });
  });

  return { runs, preIgnored: {}, summaryFiles };
}
