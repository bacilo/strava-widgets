import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { diffDataTree, snapshotDataTree, type DataTreeSnapshot } from '../test-support/data-write-guard.js';
import { consolidateExports } from './consolidate.js';

// Header line copied from a real Strava export (header only, no data rows).
const HEADER = 'Activity ID,Activity Date,Activity Name,Activity Type,Activity Description,Elapsed Time,Distance,Max Heart Rate,Relative Effort,Commute,Activity Private Note,Activity Gear,Filename,Athlete Weight,Bike Weight,Elapsed Time,Moving Time,Distance,Max Speed,Average Speed,Elevation Gain,Elevation Loss,Elevation Low,Elevation High,Max Grade,Average Grade,Average Positive Grade,Average Negative Grade,Max Cadence,Average Cadence,Max Heart Rate,Average Heart Rate,Max Watts,Average Watts,Calories,Max Temperature,Average Temperature,Relative Effort,Total Work,Number of Runs,Uphill Time,Downhill Time,Other Time,Perceived Exertion,Type,Start Time,Weighted Average Power,Power Count,Prefer Perceived Exertion,Perceived Relative Effort,Commute,Total Weight Lifted,From Upload,Grade Adjusted Distance,Weather Observation Time,Weather Condition,Weather Temperature,Apparent Temperature,Dewpoint,Humidity,Weather Pressure,Wind Speed,Wind Gust,Wind Bearing,Precipitation Intensity,Sunrise Time,Sunset Time,Moon Phase,Bike,Gear,Precipitation Probability,Precipitation Type,Cloud Cover,Weather Visibility,UV Index,Weather Ozone,Jump Count,Total Grit,Average Flow,Flagged,Average Elapsed Speed,Dirt Distance,Newly Explored Distance,Newly Explored Dirt Distance,Activity Count,Total Steps,Carbon Saved,Pool Length,Training Load,Intensity,Average Grade Adjusted Pace,Timer Time,Total Cycles,Recovery,With Pet,Competition,Long Run,For a Cause,With Kid,Downhill Distance,Total Sets,Total Reps,Media';

let before: DataTreeSnapshot;
beforeAll(() => {
  before = snapshotDataTree();
});
afterAll(() => {
  expect(diffDataTree(before, snapshotDataTree())).toEqual([]);
});

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const D1 = 'Aug 16, 2011, 6:55:32 PM';
const D2 = 'Aug 17, 2011, 6:55:32 PM';
const D3 = 'Aug 18, 2011, 6:55:32 PM';
const epoch = (y: number, m: number, d: number, h: number, mi: number, s: number): number =>
  Date.UTC(y, m, d, h, mi, s) / 1000;

function writeCsv(dir: string, rows: Array<{ id: string; date: string }>): void {
  const names = HEADER.split(',');
  const lines = [HEADER];
  for (const r of rows) {
    const cells = names.map(() => '');
    const set = (name: string, value: string): void => {
      const idx = names.map((n, i) => (n === name ? i : -1)).filter(i => i >= 0);
      cells[idx[idx.length - 1]] = value;
    };
    set('Activity ID', r.id);
    set('Activity Date', '"' + r.date + '"');
    set('Activity Name', 'n' + r.id);
    set('Activity Type', 'Run');
    set('Distance', '5000');
    lines.push(cells.join(','));
  }
  fs.writeFileSync(path.join(dir, 'activities.csv'), lines.join('\n') + '\n');
}

function rec(id: string, iso: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ id: /^\d{1,9}$/.test(id) ? Number(id) : id, start_date: iso, ...extra });
}

function fixture(stravaRows: Array<{ id: string; date: string }>, garminStart = '2020-01-01T00:00:00Z') {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'consolidate-'));
  dirs.push(base);
  const exportRoot = path.join(base, 'export_data');
  const activitiesDir = path.join(base, 'activities');
  const provenancePath = path.join(base, 'provenance.json');
  fs.mkdirSync(path.join(exportRoot, 'strava'), { recursive: true });
  fs.mkdirSync(path.join(exportRoot, 'garmin'), { recursive: true });
  fs.mkdirSync(activitiesDir);
  fs.writeFileSync(path.join(exportRoot, 'garmin', 'file.bin'), 'x');
  writeCsv(path.join(exportRoot, 'strava'), stravaRows);
  fs.writeFileSync(path.join(activitiesDir, '111.json'), rec('111', '2011-08-16T18:55:32Z'));
  fs.writeFileSync(path.join(activitiesDir, '222.json'), rec('222', '2011-08-17T18:55:32Z'));
  fs.writeFileSync(
    path.join(activitiesDir, '33333333333.json'),
    rec('33333333333', garminStart, { source_provider: 'garmin-export', garmin_activity_id: '33333333333', original_file: 'garmin:x.fit' })
  );
  fs.writeFileSync(
    path.join(activitiesDir, '44444444444.json'),
    rec('44444444444', '2020-02-02T00:00:00Z', { source_provider: 'garmin-export', garmin_activity_id: '44444444444' })
  );
  return { exportRoot, activitiesDir, provenancePath };
}

async function run(f: ReturnType<typeof fixture>): Promise<string> {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await consolidateExports(f);
  } finally {
    log.mockRestore();
  }
  return fs.readFileSync(f.provenancePath, 'utf-8');
}

const base = [
  { id: '111', date: D1 },
  { id: '222', date: D2 },
];

describe('consolidateExports garmin-export provenance', () => {
  it('keeps the imported link, lists the original-less record, and never imports from garmin', async () => {
    const f = fixture(base);
    const doc = JSON.parse(await run(f));
    expect(doc.activities['33333333333']).toEqual({ matched_by: 'imported', original: 'garmin:x.fit' });
    expect(doc.activities['44444444444']).toBeUndefined();
    expect(doc.archive_without_original).toContain('44444444444');
    expect(doc.archive_without_original).not.toContain('33333333333');
    expect(doc.sources.garmin.status).toBe('inventoried; reconcile via reconcile-exports, import via import-fit');
    expect(fs.readdirSync(f.activitiesDir)).toHaveLength(4);
  });

  it('is byte-identical across runs apart from generated_at', async () => {
    const f = fixture(base);
    const a = await run(f);
    const b = await run(f);
    const strip = (t: string): string => t.replace(/^\s*"generated_at":.*$/m, '');
    expect(strip(b)).toBe(strip(a));
    const pa = JSON.parse(a);
    const pb = JSON.parse(b);
    delete pa.generated_at;
    delete pb.generated_at;
    expect(pb).toEqual(pa);
  });

  it('lets a strava start_date link win over the garmin re-derivation', async () => {
    const f = fixture([...base, { id: '999', date: D3 }], '2011-08-18T18:55:32Z');
    expect(epoch(2011, 7, 18, 18, 55, 32)).toBe(Math.floor(Date.parse('2011-08-18T18:55:32Z') / 1000));
    const doc = JSON.parse(await run(f));
    expect(doc.activities['33333333333'].matched_by).toBe('start_date');
    expect(doc.activities['33333333333'].strava_id).toBe('999');
  });

  it('fails closed on traversal or malformed original_file', async () => {
    const f = fixture(base);
    for (const [i, bad] of ['garmin:../../etc/passwd', 'garmin:a/../b.fit', 'nocolon', 'garmin:'].entries()) {
      fs.writeFileSync(
        path.join(f.activitiesDir, `5555555555${i}.json`),
        rec(`5555555555${i}`, `2021-01-0${i + 1}T00:00:00Z`, { source_provider: 'garmin-export', original_file: bad })
      );
    }
    const doc = JSON.parse(await run(f));
    for (let i = 0; i < 4; i++) {
      expect(doc.activities[`5555555555${i}`]).toBeUndefined();
      expect(doc.archive_without_original).toContain(`5555555555${i}`);
    }
  });

  it('keeps the default paths unchanged', () => {
    expect(consolidateExports.length).toBe(0);
    const src = fs.readFileSync(path.join(process.cwd(), 'src/exports/consolidate.ts'), 'utf-8');
    expect(src).toContain("const ACTIVITIES_DIR = 'data/activities'");
    expect(src).toContain("const PROVENANCE_PATH = 'data/provenance.json'");
    expect(src).toContain("opts.exportRoot ?? 'export_data'");
  });
});
