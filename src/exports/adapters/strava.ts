import { readStravaExportCsv } from '../consolidate.js';
import { isRunLike, type ReconcileExportRun } from '../reconcile.js';

/** Shared by every export adapter (Strava here, Garmin in 36.1-08). */
export interface AdapterOutput {
  runs: ReconcileExportRun[];
  preIgnored: Record<string, number>;
  summaryFiles: string[];
}

/**
 * Strava export -> reconcile input. Wraps (does not copy) readStravaExportCsv.
 * That parser keeps only the exact type 'Run' (fail-open), so any run-like type
 * it dropped is a hard error here: reconcile refuses to claim completeness.
 */
export function readStravaExportForReconcile(root: string): AdapterOutput {
  const { runs, nonRuns } = readStravaExportCsv(root);

  for (const [type, count] of nonRuns) {
    if (isRunLike(type)) {
      throw new Error(
        `Strava CSV parser dropped run-like type "${type}" (${count} rows); reconcile refuses to report completeness`
      );
    }
  }

  return {
    runs: runs.map(r => ({
      sourceId: r.stravaId,
      startEpoch: r.epoch,
      activityType: r.activityType,
      distanceM: r.distanceMeters,
    })),
    preIgnored: Object.fromEntries([...nonRuns].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
    summaryFiles: ['activities.csv'],
  };
}
