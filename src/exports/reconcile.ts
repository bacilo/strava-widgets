import fs from 'node:fs';
import path from 'node:path';

/**
 * Source-agnostic reconciliation core (Phase 36.1, ING-02).
 *
 * Compares the run-like rows of a bulk export against the canonical archive.
 *
 * - Exact start epoch is the match key: the same key as IntervalsSync
 *   (`Math.floor(new Date(start_date).getTime() / 1000)`).
 * - An id is NEVER a match key (L-01). Archive ids and export ids live in
 *   different namespaces, so an id collision proves nothing and an id mismatch
 *   proves nothing. A record present in the archive must never be listed missing.
 * - A start within +-120 s of an archive epoch (but not equal) is "near": it is
 *   reported only, never imported and never counted as missing (R-02).
 * - Runs under 100 m are listed with `trivial: true`, not dropped (R-03).
 * - The type classifier fails closed: anything containing "run", or an empty
 *   type, is run-like. Everything else is counted by name in `ignoredTypes`.
 * - No activity names appear in the result: the audit is public.
 *
 * Pure apart from `loadArchiveIndex`, which reads only the directory it is given.
 */

export const NEAR_MATCH_TOLERANCE_S = 120;
export const TRIVIAL_DISTANCE_M = 100;

export interface ReconcileExportRun {
  sourceId: string;
  startEpoch: number;
  activityType: string;
  distanceM: number;
}

export interface ArchiveEntry {
  id: string;
  epoch: number;
}

export interface NearMatch {
  sourceId: string;
  startEpoch: number;
  archiveId: string;
  deltaS: number;
}

export interface MissingRun {
  sourceId: string;
  startEpoch: number;
  startDate: string;
  activityType: string;
  distanceM: number;
  trivial: boolean;
}

export interface ReconcileResult {
  source: string;
  window: { firstEpoch: number; lastEpoch: number };
  exportRunCount: number;
  matchedExact: number;
  near: NearMatch[];
  missing: MissingRun[];
  ignoredTypes: Record<string, number>;
}

/** Fails closed: an empty type is treated as a run so that it surfaces. */
export function isRunLike(activityType: string): boolean {
  return activityType.trim() === '' || /run/i.test(activityType);
}

function toIsoSeconds(epoch: number): string {
  return new Date(epoch * 1000).toISOString().replace('.000Z', 'Z');
}

/** Index of the first element >= target in a sorted array. */
function lowerBound(sorted: number[], target: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function reconcile(
  source: string,
  exportRuns: ReconcileExportRun[],
  archive: ArchiveEntry[],
  opts: { nearToleranceS?: number; preIgnored?: Record<string, number> } = {}
): ReconcileResult {
  const tolerance = opts.nearToleranceS ?? NEAR_MATCH_TOLERANCE_S;

  const ignored: Record<string, number> = {};
  for (const [type, n] of Object.entries(opts.preIgnored ?? {})) {
    ignored[type] = (ignored[type] ?? 0) + n;
  }

  const runs: ReconcileExportRun[] = [];
  for (const run of exportRuns) {
    if (isRunLike(run.activityType)) {
      runs.push(run);
    } else {
      ignored[run.activityType] = (ignored[run.activityType] ?? 0) + 1;
    }
  }

  if (runs.length === 0) {
    throw new Error(`reconcile(${source}): parsed 0 runs from the export; refusing to report completeness`);
  }

  const idByEpoch = new Map<number, string>();
  for (const entry of archive) {
    if (!idByEpoch.has(entry.epoch)) idByEpoch.set(entry.epoch, entry.id);
  }
  const sortedEpochs = [...idByEpoch.keys()].sort((a, b) => a - b);

  let matchedExact = 0;
  const near: NearMatch[] = [];
  const missing: MissingRun[] = [];
  let firstEpoch = Infinity;
  let lastEpoch = -Infinity;

  for (const run of runs) {
    if (run.startEpoch < firstEpoch) firstEpoch = run.startEpoch;
    if (run.startEpoch > lastEpoch) lastEpoch = run.startEpoch;

    if (idByEpoch.has(run.startEpoch)) {
      matchedExact += 1;
      continue;
    }

    // Nearest archive epoch (ties go to the earlier one).
    const i = lowerBound(sortedEpochs, run.startEpoch);
    let best: number | undefined;
    for (const candidate of [sortedEpochs[i - 1], sortedEpochs[i]]) {
      if (candidate === undefined) continue;
      if (best === undefined || Math.abs(candidate - run.startEpoch) < Math.abs(best - run.startEpoch)) {
        best = candidate;
      }
    }

    if (best !== undefined && Math.abs(best - run.startEpoch) <= tolerance) {
      near.push({
        sourceId: run.sourceId,
        startEpoch: run.startEpoch,
        archiveId: idByEpoch.get(best)!,
        deltaS: run.startEpoch - best,
      });
    } else {
      missing.push({
        sourceId: run.sourceId,
        startEpoch: run.startEpoch,
        startDate: toIsoSeconds(run.startEpoch),
        activityType: run.activityType,
        distanceM: run.distanceM,
        trivial: run.distanceM < TRIVIAL_DISTANCE_M,
      });
    }
  }

  const byEpochThenId = (
    a: { startEpoch: number; sourceId: string },
    b: { startEpoch: number; sourceId: string }
  ): number => a.startEpoch - b.startEpoch || (a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0);
  near.sort(byEpochThenId);
  missing.sort(byEpochThenId);

  const ignoredTypes: Record<string, number> = {};
  for (const key of Object.keys(ignored).sort()) ignoredTypes[key] = ignored[key];

  return {
    source,
    window: { firstEpoch, lastEpoch },
    exportRunCount: runs.length,
    matchedExact,
    near,
    missing,
    ignoredTypes,
  };
}

/**
 * Reads every *.json in `activitiesDir`. The directory is required (no default
 * path). An unreadable or unparseable file throws, naming the file: fail closed.
 */
export function loadArchiveIndex(activitiesDir: string): ArchiveEntry[] {
  const files = fs
    .readdirSync(activitiesDir)
    .filter(f => f.endsWith('.json'))
    .sort();
  const entries: ArchiveEntry[] = [];
  for (const file of files) {
    let activity: { id: unknown; start_date: string };
    try {
      activity = JSON.parse(fs.readFileSync(path.join(activitiesDir, file), 'utf-8'));
    } catch (err) {
      throw new Error(`loadArchiveIndex: cannot read ${file}: ${(err as Error).message}`);
    }
    const epoch = Math.floor(new Date(activity.start_date).getTime() / 1000);
    if (!Number.isFinite(epoch)) {
      throw new Error(`loadArchiveIndex: ${file} has no parseable start_date`);
    }
    entries.push({ id: String(activity.id), epoch });
  }
  return entries;
}
