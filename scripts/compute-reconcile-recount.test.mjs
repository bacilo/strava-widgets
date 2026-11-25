/**
 * Cross-check of the reconcile core (dist build) against the zero-import recount
 * (Phase 36.1 plan 03). Run `npm run build` first. All fixtures live in a temp dir;
 * nothing under data/ or export_data/ is read or written.
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';

import { afterEach, describe, expect, it } from 'vitest';

import { readStravaExportForReconcile } from '../dist/exports/adapters/strava.js';
import { loadArchiveIndex, reconcile } from '../dist/exports/reconcile.js';
import { parseCsvIndependent, parseDateIndependent, recount } from './compute-reconcile-recount.mjs';

const SCRIPT_PATH = fileURLToPath(new URL('./compute-reconcile-recount.mjs', import.meta.url));

// Header line copied from a real Strava export (header only).
const HEADER = 'Activity ID,Activity Date,Activity Name,Activity Type,Activity Description,Elapsed Time,Distance,Max Heart Rate,Relative Effort,Commute,Activity Private Note,Activity Gear,Filename,Athlete Weight,Bike Weight,Elapsed Time,Moving Time,Distance,Max Speed,Average Speed,Elevation Gain,Elevation Loss,Elevation Low,Elevation High,Max Grade,Average Grade,Average Positive Grade,Average Negative Grade,Max Cadence,Average Cadence,Max Heart Rate,Average Heart Rate,Max Watts,Average Watts,Calories,Max Temperature,Average Temperature,Relative Effort,Total Work,Number of Runs,Uphill Time,Downhill Time,Other Time,Perceived Exertion,Type,Start Time,Weighted Average Power,Power Count,Prefer Perceived Exertion,Perceived Relative Effort,Commute,Total Weight Lifted,From Upload,Grade Adjusted Distance,Weather Observation Time,Weather Condition,Weather Temperature,Apparent Temperature,Dewpoint,Humidity,Weather Pressure,Wind Speed,Wind Gust,Wind Bearing,Precipitation Intensity,Sunrise Time,Sunset Time,Moon Phase,Bike,Gear,Precipitation Probability,Precipitation Type,Cloud Cover,Weather Visibility,UV Index,Weather Ozone,Jump Count,Total Grit,Average Flow,Flagged,Average Elapsed Speed,Dirt Distance,Newly Explored Distance,Newly Explored Dirt Distance,Activity Count,Total Steps,Carbon Saved,Pool Length,Training Load,Intensity,Average Grade Adjusted Pace,Timer Time,Total Cycles,Recovery,With Pet,Competition,Long Run,For a Cause,With Kid,Downhill Distance,Total Sets,Total Reps,Media';

const dirs = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const RUNS = [
  { id: '1001', date: 'Aug 16, 2011, 6:55:32 PM', type: 'Run' },
  { id: '1002', date: 'Jan 2, 2020, 12:05:00 AM', type: 'Run' },
  { id: '1003', date: 'Apr 20, 2026, 6:32:28 AM', type: 'Run' },
  { id: '1004', date: 'Nov 17, 2026, 12:30:00 PM', type: 'Run' },
  { id: '1005', date: 'Nov 18, 2026, 6:30:00 AM', type: 'Run' },
  { id: '1006', date: 'Nov 19, 2026, 6:30:00 AM', type: 'Ride' },
];

function buildFixture() {
  const root = mkdtempSync(join(tmpdir(), 'reconcile-recount-'));
  dirs.push(root);
  const exportDir = join(root, 'export');
  const activitiesDir = join(root, 'activities');
  mkdirSync(exportDir);
  mkdirSync(activitiesDir);

  const names = HEADER.split(',');
  const lines = [HEADER];
  for (const r of RUNS) {
    const cells = names.map(() => '');
    const idxOf = (n) => names.map((x, i) => (x === n ? i : -1)).filter((i) => i >= 0);
    const put = (n, v, last = true) => {
      const idx = idxOf(n);
      cells[last ? idx[idx.length - 1] : idx[0]] = v;
    };
    put('Activity ID', r.id);
    put('Activity Date', '"' + r.date + '"');
    put('Activity Name', 'n' + r.id);
    put('Activity Type', r.type);
    put('Distance', '5.0', false);
    put('Distance', '5000');
    lines.push(cells.join(','));
  }
  writeFileSync(join(exportDir, 'activities.csv'), lines.join('\n') + '\n');

  // Archive: exact for 1001-1004, near (+30 s) for 1005, plus one unrelated record.
  const archive = [
    ['a1', '2011-08-16T18:55:32Z'],
    ['a2', '2020-01-02T00:05:00Z'],
    ['a3', '2026-04-20T06:32:28Z'],
    ['a4', '2026-11-17T12:30:00Z'],
    ['a5', '2026-11-18T06:30:30Z'],
    ['a6', '2015-05-05T05:05:05Z'],
  ];
  for (const [id, start] of archive) {
    writeFileSync(join(activitiesDir, id + '.json'), JSON.stringify({ id, start_date: start }));
  }
  return { exportDir, activitiesDir };
}

function both(exportDir, activitiesDir) {
  const adapter = readStravaExportForReconcile(exportDir);
  const core = reconcile('strava', adapter.runs, loadArchiveIndex(activitiesDir), { preIgnored: adapter.preIgnored });
  const files = readdirSync(activitiesDir).filter((f) => f.endsWith('.json')).sort();
  const independent = recount({
    csvText: readFileSync(join(exportDir, 'activities.csv'), 'utf8'),
    archiveJsonTexts: files.map((f) => readFileSync(join(activitiesDir, f), 'utf8')),
  });
  return { core, independent, fileCount: files.length };
}

describe('independent parsers', () => {
  it('parses the Strava export date format as UTC, including 12 AM / 12 PM', () => {
    expect(parseDateIndependent('Aug 16, 2011, 6:55:32 PM')).toBe(Date.UTC(2011, 7, 16, 18, 55, 32) / 1000);
    expect(parseDateIndependent('Jan 2, 2020, 12:05:00 AM')).toBe(Date.UTC(2020, 0, 2, 0, 5, 0) / 1000);
    expect(parseDateIndependent('Jan 2, 2020, 12:05:00 PM')).toBe(Date.UTC(2020, 0, 2, 12, 5, 0) / 1000);
    expect(parseDateIndependent('garbage')).toBeUndefined();
  });

  it('splits quoted fields containing commas and escaped quotes', () => {
    expect(parseCsvIndependent('a,"b, c","d""e"\n1,2,3\n')).toEqual([
      ['a', 'b, c', 'd"e'],
      ['1', '2', '3'],
    ]);
  });
});

describe('core vs recount', () => {
  it('CAN-PASS: unmodified synthetic archive gives 0 missing in both, with identical counts', () => {
    const { exportDir, activitiesDir } = buildFixture();
    const { core, independent } = both(exportDir, activitiesDir);
    expect(core.missing).toEqual([]);
    expect(independent.missingIds).toEqual([]);
    expect(core.exportRunCount).toBe(5);
    expect(independent.exportRuns).toBe(5);
    expect(core.matchedExact).toBe(independent.matchedExact);
    expect(core.matchedExact).toBe(4);
    expect(core.near.length).toBe(independent.near);
    expect(core.near.length).toBe(1);
    expect(core.ignoredTypes).toEqual(independent.ignoredTypes);
    expect(core.ignoredTypes).toEqual({ Ride: 1 });
  });

  it('CAN-FAIL: removing one archive record raises missing by exactly 1 in BOTH, naming the export id and date', () => {
    const { exportDir, activitiesDir } = buildFixture();
    const before = readdirSync(activitiesDir).length;
    rmSync(join(activitiesDir, 'a3.json'));
    const { core, independent, fileCount } = both(exportDir, activitiesDir);
    expect(fileCount).toBe(before - 1);
    expect(core.missing.map((m) => m.sourceId)).toEqual(['1003']);
    expect(core.missing[0].startDate).toBe('2026-04-20T06:32:28Z');
    expect(independent.missingIds).toEqual(['1003']);
    expect(core.matchedExact).toBe(3);
    expect(independent.matchedExact).toBe(3);
    expect(core.matchedExact + core.near.length + core.missing.length).toBe(core.exportRunCount);
  });

  it('recount counts a run-like type the production parser would drop (fail-open shows as disagreement)', () => {
    const csv = HEADER + '\n';
    const names = HEADER.split(',');
    const cells = names.map(() => '');
    cells[names.lastIndexOf('Activity ID')] = '9';
    cells[names.lastIndexOf('Activity Date')] = '"Aug 16, 2011, 6:55:32 PM"';
    cells[names.lastIndexOf('Activity Type')] = 'Trail Run';
    const out = recount({ csvText: csv + cells.join(',') + '\n', archiveJsonTexts: [] });
    expect(out.exportRuns).toBe(1);
    expect(out.missingIds).toEqual(['9']);
  });
});

describe('zero-import guard', () => {
  const FORBIDDEN = [/from\s+['"]\.\.\/src/, /from\s+['"]\.\.\/dist/, /from\s+['"]\.\/lib/, /require\(/];
  function strip(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');
  }
  function scan(source) {
    return FORBIDDEN.filter((re) => re.test(strip(source)));
  }

  it('flags a planted src import (non-vacuous) and passes the real source', () => {
    const raw = readFileSync(SCRIPT_PATH, 'utf8');
    const mutated = raw + "\nimport { reconcile } from '../src/exports/reconcile.js';\n";
    expect(mutated).not.toBe(raw);
    expect(scan(mutated).length).toBeGreaterThan(0);
    expect(scan(raw)).toEqual([]);
  });
});
