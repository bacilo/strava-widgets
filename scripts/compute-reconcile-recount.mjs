/**
 * Independent recount for the export-vs-archive reconciliation (Phase 36.1, ING-02).
 *
 * Zero-import rule: this script imports Node builtins only (fs, path, url). It
 * must not load the production reconcile core, the shared CSV parser, or any
 * repo helper module, because a bug shared with the code under check would then
 * cancel out and the cross-check would pass vacuously. The CSV splitter and the
 * export date parser below are therefore written from scratch.
 * Precedent: compute-running-pace-recount.mjs, which follows the same rule.
 *
 * Deliberate difference from production: the type rule is applied to EVERY row
 * (run-like when /run/i matches or the type is empty). The production Strava
 * parser keeps only the exact type "Run"; a run-like type it drops therefore
 * shows up here as a disagreement instead of being hidden.
 *
 * Garmin branch (--source garmin): restates the probe units independently below and
 * finds summary files by walking the WHOLE export root for names ending in the
 * summary suffix (the production adapter reads one probed directory instead).
 *
 * Usage: node scripts/compute-reconcile-recount.mjs [--source strava|garmin] --export <dir> --activities <dir>
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

/** Quote-aware CSV splitter (own implementation: split into records, then fields). */
export function parseCsvIndependent(text) {
  const records = [];
  let start = 0;
  let quoted = false;
  for (let i = 0; i <= text.length; i++) {
    const c = text[i];
    if (c === '"') quoted = !quoted;
    if (i === text.length || (!quoted && (c === '\n' || c === '\r'))) {
      const rec = text.slice(start, i);
      if (rec.length > 0) records.push(rec);
      if (c === '\r' && text[i + 1] === '\n') i++;
      start = i + 1;
    }
  }
  return records.map((rec) => {
    const fields = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < rec.length; i++) {
      const c = rec[i];
      if (q) {
        if (c === '"' && rec[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { fields.push(cur); cur = ''; }
      else cur += c;
    }
    fields.push(cur);
    return fields;
  });
}

const MONTH_TABLE = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Aug 16, 2011, 6:55:32 PM" (UTC) -> epoch seconds, or undefined. */
export function parseDateIndependent(s) {
  const parts = /^([A-Za-z]{3}) (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2}):(\d{2}) ([AP]M)$/.exec(s.trim());
  if (!parts) return undefined;
  const month = MONTH_TABLE.indexOf(parts[1]);
  if (month < 0) return undefined;
  let hour = Number(parts[4]);
  if (hour === 12) hour = 0;
  if (parts[7] === 'PM') hour += 12;
  return Date.UTC(Number(parts[3]), month, Number(parts[2]), hour, Number(parts[5]), Number(parts[6])) / 1000;
}

function isRunLikeLocal(type) {
  return type.trim() === '' || /run/i.test(type);
}

export function recount({ csvText, archiveJsonTexts, nearToleranceS = 120 }) {
  const rows = parseCsvIndependent(csvText);
  const header = rows[0].map((h) => h.trim());
  const lastIdx = (name) => header.lastIndexOf(name);
  const iId = lastIdx('Activity ID');
  const iDate = lastIdx('Activity Date');
  const iType = lastIdx('Activity Type');
  if (iId < 0 || iDate < 0 || iType < 0) throw new Error('recount: required CSV column missing');

  const archiveEpochs = new Set();
  for (const text of archiveJsonTexts) {
    archiveEpochs.add(Math.floor(Date.parse(JSON.parse(text).start_date) / 1000));
  }
  const archiveList = [...archiveEpochs];

  let exportRuns = 0;
  let matchedExact = 0;
  let near = 0;
  const missingIds = [];
  const ignoredTypes = {};

  for (const row of rows.slice(1)) {
    const type = row[iType] ?? '';
    if (!isRunLike(type)) {
      ignoredTypes[type] = (ignoredTypes[type] ?? 0) + 1;
      continue;
    }
    const epoch = parseDateIndependent(row[iDate] ?? '');
    if (epoch === undefined) throw new Error(`recount: unparseable date for run ${row[iId]}: ${row[iDate]}`);
    exportRuns++;
    if (archiveEpochs.has(epoch)) {
      matchedExact++;
    } else if (archiveList.some((a) => Math.abs(a - epoch) <= nearToleranceS)) {
      near++;
    } else {
      missingIds.push(row[iId]);
    }
  }
  missingIds.sort();
  return { exportRuns, matchedExact, near, missingIds, ignoredTypes };
}

/**
 * Garmin recount. Independent restatement of 36.1-GARMIN-PROBE.md sections 2-4:
 * summary files hold [{"summarizedActivitiesExport":[rows]}]; the id is `activityId`,
 * the start is `startTimeGmt` in epoch MILLISECONDS (divide by 1000), the type is
 * `activityType`. Distance is not needed for the counts.
 */
export function recountGarmin({ summaryJsonTexts, archiveJsonTexts, nearToleranceS = 120 }) {
  if (summaryJsonTexts.length === 0) throw new Error('recountGarmin: no summary files');
  const archiveList = archiveJsonTexts.map((t) => Math.floor(Date.parse(JSON.parse(t).start_date) / 1000));
  const archiveEpochs = new Set(archiveList);

  let exportRuns = 0;
  let matchedExact = 0;
  let near = 0;
  const missingIds = [];
  const ignoredTypes = {};
  for (const text of summaryJsonTexts) {
    const rows = JSON.parse(text)[0].summarizedActivitiesExport;
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('recountGarmin: empty or malformed summary file');
    for (const row of rows) {
      const type = row.activityType ?? '';
      if (!isRunLikeLocal(type)) {
        ignoredTypes[type] = (ignoredTypes[type] ?? 0) + 1;
        continue;
      }
      if (row.activityId === undefined || typeof row.startTimeGmt !== 'number') {
        throw new Error('recountGarmin: row without activityId or startTimeGmt');
      }
      const epoch = Math.floor(row.startTimeGmt / 1000);
      exportRuns++;
      if (archiveEpochs.has(epoch)) matchedExact++;
      else if (archiveList.some((a) => Math.abs(a - epoch) <= nearToleranceS)) near++;
      else missingIds.push(String(row.activityId));
    }
  }
  missingIds.sort();
  return { exportRuns, matchedExact, near, missingIds, ignoredTypes };
}

/** Recursive walk of the whole export root for summary files, sorted. */
export function findSummaryFiles(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('_summarizedActivities.json')) found.push(full);
    }
  };
  walk(root);
  return found.sort();
}

function isRunLike(type) {
  return isRunLikeLocal(type);
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main() {
  try {
    const exportDir = arg('--export');
    const activitiesDir = arg('--activities');
    const source = arg('--source') ?? 'strava';
    if (!exportDir || !activitiesDir) throw new Error('usage: [--source strava|garmin] --export <dir> --activities <dir>');
    if (source !== 'strava' && source !== 'garmin') throw new Error(`unknown source: ${source}`);
    const archiveJsonTexts = readdirSync(activitiesDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => readFileSync(join(activitiesDir, f), 'utf8'));
    if (source === 'garmin') {
      const summaryJsonTexts = findSummaryFiles(exportDir).map((f) => readFileSync(f, 'utf8'));
      console.log(JSON.stringify(recountGarmin({ summaryJsonTexts, archiveJsonTexts }), null, 2));
    } else {
      const csvText = readFileSync(join(exportDir, 'activities.csv'), 'utf8');
      console.log(JSON.stringify(recount({ csvText, archiveJsonTexts }), null, 2));
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
