import type { ReconcileResult } from './reconcile.js';

/**
 * Deterministic, public-safe reconciliation audit (Phase 36.1, ING-04, R-01).
 *
 * The audit is committed to a public repo, so it is built by explicit
 * allow-list projection: ids, ISO dates, activity type, distance and sha256
 * only. No coordinates, no names, no absolute paths.
 *
 * There is deliberately no generation timestamp, no wall clock and no git hash: a
 * committed artifact that embeds either never regenerates byte-identically.
 * The only date is the caller-supplied export date.
 */

export interface ExportIdentity {
  summary_files: { path: string; sha256: string }[];
}

export interface ReconciliationAudit {
  schema_version: 1;
  source: string;
  export_date: string;
  export_identity: ExportIdentity;
  coverage_window: { first_run_start: string; last_run_start: string };
  claim: string;
  counts: {
    export_runs: number;
    matched_exact: number;
    near: number;
    missing: number;
    missing_trivial: number;
    ignored_types: Record<string, number>;
  };
  near: { source_id: string; start_date: string; archive_id: string; delta_s: number }[];
  missing: {
    source_id: string;
    start_date: string;
    activity_type: string;
    distance_m: number;
    trivial: boolean;
  }[];
}

function iso(epoch: number): string {
  return new Date(epoch * 1000).toISOString().replace('.000Z', 'Z');
}

export function buildAudit(
  result: ReconcileResult,
  meta: { exportDate: string; summaryFiles: { path: string; sha256: string }[] }
): ReconciliationAudit {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.exportDate)) {
    throw new Error(`buildAudit: export date "${meta.exportDate}" is not YYYY-MM-DD`);
  }
  const first = iso(result.window.firstEpoch);
  const last = iso(result.window.lastEpoch);
  if (meta.exportDate < last.slice(0, 10)) {
    throw new Error(`buildAudit: export date ${meta.exportDate} predates its newest run ${last}`);
  }

  const ignored: Record<string, number> = {};
  for (const key of Object.keys(result.ignoredTypes).sort()) ignored[key] = result.ignoredTypes[key];

  const summaryFiles = meta.summaryFiles
    .map(f => ({ path: f.path, sha256: f.sha256 }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return {
    schema_version: 1,
    source: result.source,
    export_date: meta.exportDate,
    export_identity: { summary_files: summaryFiles },
    coverage_window: { first_run_start: first, last_run_start: last },
    claim:
      `This audit covers only runs recorded in this export that start between ${first} and ${last} inclusive. ` +
      'It makes no claim about runs outside that window or absent from the export.',
    counts: {
      export_runs: result.exportRunCount,
      matched_exact: result.matchedExact,
      near: result.near.length,
      missing: result.missing.length,
      missing_trivial: result.missing.filter(m => m.trivial).length,
      ignored_types: ignored,
    },
    near: result.near.map(n => ({
      source_id: n.sourceId,
      start_date: iso(n.startEpoch),
      archive_id: n.archiveId,
      delta_s: n.deltaS,
    })),
    missing: result.missing.map(m => ({
      source_id: m.sourceId,
      start_date: m.startDate,
      activity_type: m.activityType,
      distance_m: m.distanceM,
      trivial: m.trivial,
    })),
  };
}

export function serializeAudit(audit: ReconciliationAudit): string {
  return JSON.stringify(audit, null, 2) + '\n';
}
