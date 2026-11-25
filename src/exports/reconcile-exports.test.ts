import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runReconciliation } from './reconcile-exports.js';

const HEADER = 'Activity ID,Activity Date,Activity Name,Activity Type,Activity Description,Elapsed Time,Distance,Max Heart Rate,Relative Effort,Commute,Activity Private Note,Activity Gear,Filename,Athlete Weight,Bike Weight,Elapsed Time,Moving Time,Distance,Max Speed,Average Speed,Elevation Gain,Elevation Loss,Elevation Low,Elevation High,Max Grade,Average Grade,Average Positive Grade,Average Negative Grade,Max Cadence,Average Cadence,Max Heart Rate,Average Heart Rate,Max Watts,Average Watts,Calories,Max Temperature,Average Temperature,Relative Effort,Total Work,Number of Runs,Uphill Time,Downhill Time,Other Time,Perceived Exertion,Type,Start Time,Weighted Average Power,Power Count,Prefer Perceived Exertion,Perceived Relative Effort,Commute,Total Weight Lifted,From Upload,Grade Adjusted Distance,Weather Observation Time,Weather Condition,Weather Temperature,Apparent Temperature,Dewpoint,Humidity,Weather Pressure,Wind Speed,Wind Gust,Wind Bearing,Precipitation Intensity,Sunrise Time,Sunset Time,Moon Phase,Bike,Gear,Precipitation Probability,Precipitation Type,Cloud Cover,Weather Visibility,UV Index,Weather Ozone,Jump Count,Total Grit,Average Flow,Flagged,Average Elapsed Speed,Dirt Distance,Newly Explored Distance,Newly Explored Dirt Distance,Activity Count,Total Steps,Carbon Saved,Pool Length,Training Load,Intensity,Average Grade Adjusted Pace,Timer Time,Total Cycles,Recovery,With Pet,Competition,Long Run,For a Cause,With Kid,Downhill Distance,Total Sets,Total Reps,Media';

const dirs: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const ROWS = [
  { id: '111', date: 'Aug 16, 2011, 6:55:32 PM', epoch: Date.UTC(2011, 7, 16, 18, 55, 32) / 1000, iso: '2011-08-16T18:55:32Z' },
  { id: '222', date: 'Aug 17, 2011, 6:55:32 PM', epoch: Date.UTC(2011, 7, 17, 18, 55, 32) / 1000, iso: '2011-08-17T18:55:32Z' },
  { id: '333', date: 'Aug 18, 2011, 6:55:32 PM', epoch: Date.UTC(2011, 7, 18, 18, 55, 32) / 1000, iso: '2011-08-18T18:55:32Z' },
];

function setup(rows = ROWS): { exportRoot: string; acts: string; audit: string } {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'reconcile-exports-'));
  dirs.push(base);
  const exportRoot = path.join(base, 'export');
  const acts = path.join(base, 'acts');
  fs.mkdirSync(path.join(exportRoot, 'strava'), { recursive: true });
  fs.mkdirSync(acts);
  const names = HEADER.split(',');
  const lines = [HEADER];
  for (const r of rows) {
    const cells = names.map(() => '');
    const last = (n: string): number => names.lastIndexOf(n);
    cells[last('Activity ID')] = r.id;
    cells[last('Activity Date')] = '"' + r.date + '"';
    cells[last('Activity Name')] = 'n' + r.id;
    cells[last('Activity Type')] = 'Run';
    cells[last('Distance')] = '5000';
    lines.push(cells.join(','));
    fs.writeFileSync(
      path.join(acts, `a${r.id}.json`),
      JSON.stringify({ id: 'a' + r.id, start_date: new Date(r.epoch * 1000).toISOString() })
    );
  }
  fs.writeFileSync(path.join(exportRoot, 'strava', 'activities.csv'), lines.join('\n') + '\n');
  return { exportRoot, acts, audit: path.join(base, 'audit') };
}

const sha = (p: string): string => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

describe('runReconciliation', () => {
  it('writes the audit and a second run is byte-identical', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const s = setup();
    const opts = { source: 'strava', exportRoot: s.exportRoot, activitiesDir: s.acts, auditDir: s.audit, exportDate: '2011-08-19' };
    const a = await runReconciliation(opts);
    expect(a.counts).toMatchObject({ export_runs: 3, matched_exact: 3, missing: 0 });
    const file = path.join(s.audit, 'strava.json');
    const before = sha(file);
    await runReconciliation(opts);
    expect(sha(file)).toBe(before);
  });

  it('fails closed on unknown and traversal sources, writing nothing', async () => {
    const s = setup();
    const base = { exportRoot: s.exportRoot, activitiesDir: s.acts, auditDir: s.audit, exportDate: '2011-08-19' };
    await expect(runReconciliation({ ...base, source: 'bogus' })).rejects.toThrow('unknown source');
    await expect(runReconciliation({ ...base, source: '../x' })).rejects.toThrow('unknown source');
    await expect(runReconciliation({ ...base, source: 'constructor' })).rejects.toThrow('unknown source');
    expect(fs.existsSync(s.audit) ? fs.readdirSync(s.audit).length : 0).toBe(0);
  });

  it('garmin reconciles the fixture', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const s = setup();
    const fixture = path.join(path.dirname(new URL(import.meta.url).pathname), '__fixtures__', 'garmin');
    fs.cpSync(fixture, path.join(s.exportRoot, 'garmin'), { recursive: true });
    const a = await runReconciliation({
      source: 'garmin', exportRoot: s.exportRoot, activitiesDir: s.acts, auditDir: s.audit, exportDate: '2026-11-25',
    });
    expect(a.source).toBe('garmin');
    expect(a.counts.export_runs).toBe(4);
    expect(a.counts.ignored_types).toEqual({ cycling: 1, floor_climbing: 1 });
  });

  it('throws on 0 runs and writes no audit', async () => {
    const s = setup([]);
    await expect(
      runReconciliation({ source: 'strava', exportRoot: s.exportRoot, activitiesDir: s.acts, auditDir: s.audit, exportDate: '2011-08-19' })
    ).rejects.toThrow('parsed 0 runs');
    expect(fs.existsSync(path.join(s.audit, 'strava.json'))).toBe(false);
  });

  it('CAN-FAIL: removing one archive record lists exactly that run', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const s = setup();
    const countBefore = fs.readdirSync(s.acts).length;
    fs.rmSync(path.join(s.acts, 'a222.json'));
    expect(fs.readdirSync(s.acts).length).toBe(countBefore - 1);
    const a = await runReconciliation({
      source: 'strava', exportRoot: s.exportRoot, activitiesDir: s.acts, auditDir: s.audit, exportDate: '2011-08-19',
    });
    expect(a.counts.missing).toBe(1);
    expect(a.missing[0]).toMatchObject({ source_id: '222', start_date: '2011-08-17T18:55:32Z' });
  });

  it('records the sha256 of the summary file bytes, computed independently', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const s = setup();
    const a = await runReconciliation({
      source: 'strava', exportRoot: s.exportRoot, activitiesDir: s.acts, auditDir: s.audit, exportDate: '2011-08-19',
    });
    expect(a.export_identity.summary_files[0]).toEqual({
      path: 'activities.csv',
      sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(s.exportRoot, 'strava', 'activities.csv'))).digest('hex'),
    });
  });
});
