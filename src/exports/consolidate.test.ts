import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { diffDataTree, snapshotDataTree, type DataTreeSnapshot } from '../test-support/data-write-guard.js';
import { consolidateExports } from './consolidate.js';
import { parseStravaExportDate } from './csv.js';

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
    for (const [i, bad] of [
      'garmin:../../etc/passwd',
      'garmin:a/../b.fit',
      'nocolon',
      'garmin:',
      'garmin:UploadedFiles/user@example.com_123.fit',
    ].entries()) {
      fs.writeFileSync(
        path.join(f.activitiesDir, `5555555555${i}.json`),
        rec(`5555555555${i}`, `2021-01-0${i + 1}T00:00:00Z`, { source_provider: 'garmin-export', original_file: bad })
      );
    }
    const doc = JSON.parse(await run(f));
    for (let i = 0; i < 5; i++) {
      expect(doc.activities[`5555555555${i}`]).toBeUndefined();
      expect(doc.archive_without_original).toContain(`5555555555${i}`);
    }
    expect(JSON.stringify(doc)).not.toContain('@');
  });

  it('keeps the default paths unchanged', () => {
    expect(consolidateExports.length).toBe(0);
    const src = fs.readFileSync(path.join(process.cwd(), 'src/exports/consolidate.ts'), 'utf-8');
    expect(src).toContain("const ACTIVITIES_DIR = 'data/activities'");
    expect(src).toContain("const PROVENANCE_PATH = 'data/provenance.json'");
    expect(src).toContain("opts.exportRoot ?? 'export_data'");
  });
});

// Independent anchor: the ISO start of archive record 111 in the fixture.
const BASE_111 = Date.parse('2011-08-16T18:55:32Z') / 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Strava export date string (UTC, 12-hour clock) for an absolute epoch in seconds. */
function csvDateAtEpoch(sec: number): string {
  const d = new Date(sec * 1000);
  const h24 = d.getUTCHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const two = (n: number): string => String(n).padStart(2, '0');
  return (
    `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}, ` +
    `${h12}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())} ${h24 < 12 ? 'AM' : 'PM'}`
  );
}
const csvDateAt = (offsetS: number): string => csvDateAtEpoch(BASE_111 + offsetS);

const NEAR_OFFSETS = [1, -1, 60, 120, -120];
const FAR_OFFSETS = [121, -121];
const strip = (t: string): string => t.replace(/^\s*"generated_at":.*$/m, '');

describe('consolidateExports near-match (SC3)', () => {
  it.each([...NEAR_OFFSETS, ...FAR_OFFSETS, 0, 3600])('csvDateAt(%i) round-trips through parseStravaExportDate', offset => {
    expect(parseStravaExportDate(csvDateAt(offset))).toBe(BASE_111 + offset);
  });

  it.each(NEAR_OFFSETS)('does not import an export row %i s from an archive record', async offset => {
    const f = fixture([...base, { id: '777', date: csvDateAt(offset) }]);
    const doc = JSON.parse(await run(f));
    expect(fs.readdirSync(f.activitiesDir)).toHaveLength(4);
    expect(fs.existsSync(path.join(f.activitiesDir, '777.json'))).toBe(false);
    expect(doc.activities['777']).toBeUndefined();
    expect(doc.sources.strava.near_match_skipped).toBe(1);
    expect(doc.sources.strava.imported).toBe(0);
  });

  it.each(FAR_OFFSETS)('still imports an export row %i s from an archive record', async offset => {
    const f = fixture([...base, { id: '777', date: csvDateAt(offset) }]);
    const doc = JSON.parse(await run(f));
    expect(fs.readdirSync(f.activitiesDir)).toHaveLength(5);
    expect(fs.existsSync(path.join(f.activitiesDir, '777.json'))).toBe(true);
    expect(doc.activities['777'].matched_by).toBe('imported');
    expect('near_match_skipped' in doc.sources.strava).toBe(false);
  });

  // Decoy archive record 555 sits 30 s after 111, inside the 1..120 s near window.
  // A near-first order would skip the exact/by-id row against it, so these pins can fail.
  const writeDecoy = (f: { activitiesDir: string }): void => {
    const decoyIso = '2011-08-16T18:56:02Z';
    expect(Date.parse(decoyIso) / 1000 - BASE_111).toBe(30);
    fs.writeFileSync(path.join(f.activitiesDir, '555.json'), rec('555', decoyIso));
  };

  it('resolves an exact epoch by start_date before the near rule', async () => {
    const f = fixture([{ id: '222', date: D2 }, { id: '888', date: D1 }]);
    writeDecoy(f);
    const doc = JSON.parse(await run(f));
    expect(doc.activities['111'].matched_by).toBe('start_date');
    expect(doc.activities['111'].strava_id).toBe('888');
    expect(fs.readdirSync(f.activitiesDir)).toHaveLength(5);
    expect(fs.existsSync(path.join(f.activitiesDir, '888.json'))).toBe(false);
    expect('near_match_skipped' in doc.sources.strava).toBe(false);
  });

  it('resolves a strava id match before the near rule', async () => {
    const f = fixture(base);
    writeDecoy(f);
    const doc = JSON.parse(await run(f));
    expect(doc.activities['111'].matched_by).toBe('strava_id');
    expect('near_match_skipped' in doc.sources.strava).toBe(false);
    expect(fs.readdirSync(f.activitiesDir)).toHaveLength(5);
  });

  it('imports both rows of an in-batch near pair (candidates are the archive as indexed)', async () => {
    const t = Date.parse('2012-01-01T10:00:00Z') / 1000;
    const f = fixture([...base, { id: '801', date: csvDateAtEpoch(t) }, { id: '802', date: csvDateAtEpoch(t + 60) }]);
    const doc = JSON.parse(await run(f));
    expect(fs.readdirSync(f.activitiesDir)).toHaveLength(6);
    expect(doc.activities['801'].matched_by).toBe('imported');
    expect(doc.activities['802'].matched_by).toBe('imported');
  });

  it('omits near_match_skipped when no row is near', async () => {
    const doc = JSON.parse(await run(fixture(base)));
    expect('near_match_skipped' in doc.sources.strava).toBe(false);
  });

  it('logs ids, date and signed delta only, never the activity name', async () => {
    const f = fixture([...base, { id: '777', date: csvDateAt(-60) }]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    let lines: string[];
    try {
      await consolidateExports(f);
      lines = log.mock.calls.map(c => String(c[0])).filter(l => l.includes('near-match:'));
    } finally {
      log.mockRestore();
    }
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('777');
    expect(lines[0]).toContain('111');
    expect(lines[0]).toContain('-60');
    expect(lines[0]).not.toContain('n777');
  });

  it('is byte-identical across runs with a near row present', async () => {
    const f = fixture([...base, { id: '777', date: csvDateAt(60) }]);
    const a = await run(f);
    const listing = fs.readdirSync(f.activitiesDir).sort();
    const b = await run(f);
    expect(strip(b)).toBe(strip(a));
    expect(fs.readdirSync(f.activitiesDir).sort()).toEqual(listing);
    expect(listing).toHaveLength(4);
  });
});
