import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { readGarminExportForReconcile } from './adapters/garmin.js';
import { readStravaExportForReconcile, type AdapterOutput } from './adapters/strava.js';
import { loadArchiveIndex, reconcile } from './reconcile.js';
import { buildAudit, serializeAudit, type ReconciliationAudit } from './reconciliation-audit.js';

/**
 * Orchestrates one export-vs-archive reconciliation and writes the committed
 * audit (Phase 36.1, ING-04, R-01). Every path is a required option: the
 * repo-relative defaults live only in the CLI case in src/index.ts.
 */

/** Source name -> adapter. A source absent here fails closed. */
export const ADAPTERS: Record<string, (root: string) => AdapterOutput> = {
  strava: readStravaExportForReconcile,
  garmin: readGarminExportForReconcile,
};

/** Garmin summary files carry the account email in their name; the public audit records the account part as a placeholder. */
function publicSummaryPath(rel: string): string {
  const dir = path.dirname(rel);
  const base = path.basename(rel).replace(/^.*?(_\d+_summarizedActivities\.json)$/, '<account>$1');
  return dir === '.' ? base : path.join(dir, base);
}

export async function runReconciliation(opts: {
  source: string;
  exportRoot: string;
  activitiesDir: string;
  auditDir: string;
  exportDate: string;
}): Promise<ReconciliationAudit> {
  const { source } = opts;
  if (!/^[a-z]+$/.test(source)) throw new Error(`unknown source: ${JSON.stringify(source)}`);
  if (!Object.prototype.hasOwnProperty.call(ADAPTERS, source)) {
    throw new Error(`unknown source: ${source}`);
  }

  const root = path.join(opts.exportRoot, source);
  const { runs, preIgnored, summaryFiles } = ADAPTERS[source](root);
  const result = reconcile(source, runs, loadArchiveIndex(opts.activitiesDir), { preIgnored });

  const hashed = summaryFiles.map(f => ({
    path: publicSummaryPath(f),
    sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex'),
  }));
  const audit = buildAudit(result, { exportDate: opts.exportDate, summaryFiles: hashed });

  fs.mkdirSync(opts.auditDir, { recursive: true });
  const target = path.join(opts.auditDir, `${source}.json`);
  const tmp = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, serializeAudit(audit));
  fs.renameSync(tmp, target);

  console.log(`Reconciliation (${source}): ${audit.coverage_window.first_run_start} .. ${audit.coverage_window.last_run_start}`);
  const c = audit.counts;
  console.log(
    `  export runs ${c.export_runs}, matched exact ${c.matched_exact}, near ${c.near}, missing ${c.missing} (trivial ${c.missing_trivial})`
  );
  for (const m of audit.missing.slice(0, 40)) {
    console.log(`  missing ${m.source_id} ${m.start_date} ${m.activity_type} ${m.distance_m} m${m.trivial ? ' (trivial)' : ''}`);
  }
  if (audit.missing.length > 40) console.log(`  ... and ${audit.missing.length - 40} more in ${target}`);
  return audit;
}
