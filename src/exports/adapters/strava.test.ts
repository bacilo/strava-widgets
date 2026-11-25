import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { readStravaExportForReconcile } from './strava.js';

// Header line copied from a real Strava export (header only, no data rows).
const HEADER = 'Activity ID,Activity Date,Activity Name,Activity Type,Activity Description,Elapsed Time,Distance,Max Heart Rate,Relative Effort,Commute,Activity Private Note,Activity Gear,Filename,Athlete Weight,Bike Weight,Elapsed Time,Moving Time,Distance,Max Speed,Average Speed,Elevation Gain,Elevation Loss,Elevation Low,Elevation High,Max Grade,Average Grade,Average Positive Grade,Average Negative Grade,Max Cadence,Average Cadence,Max Heart Rate,Average Heart Rate,Max Watts,Average Watts,Calories,Max Temperature,Average Temperature,Relative Effort,Total Work,Number of Runs,Uphill Time,Downhill Time,Other Time,Perceived Exertion,Type,Start Time,Weighted Average Power,Power Count,Prefer Perceived Exertion,Perceived Relative Effort,Commute,Total Weight Lifted,From Upload,Grade Adjusted Distance,Weather Observation Time,Weather Condition,Weather Temperature,Apparent Temperature,Dewpoint,Humidity,Weather Pressure,Wind Speed,Wind Gust,Wind Bearing,Precipitation Intensity,Sunrise Time,Sunset Time,Moon Phase,Bike,Gear,Precipitation Probability,Precipitation Type,Cloud Cover,Weather Visibility,UV Index,Weather Ozone,Jump Count,Total Grit,Average Flow,Flagged,Average Elapsed Speed,Dirt Distance,Newly Explored Distance,Newly Explored Dirt Distance,Activity Count,Total Steps,Carbon Saved,Pool Length,Training Load,Intensity,Average Grade Adjusted Pace,Timer Time,Total Cycles,Recovery,With Pet,Competition,Long Run,For a Cause,With Kid,Downhill Distance,Total Sets,Total Reps,Media';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function writeExport(rows: Array<{ id: string; date: string; type: string; distanceM: number }>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strava-adapter-'));
  dirs.push(dir);
  const names = HEADER.split(',');
  const lines = [HEADER];
  for (const r of rows) {
    const cells = names.map(() => '');
    const set = (name: string, value: string, which: 'first' | 'last'): void => {
      const idx = names.map((n, i) => (n === name ? i : -1)).filter(i => i >= 0);
      cells[which === 'first' ? idx[0] : idx[idx.length - 1]] = value;
    };
    set('Activity ID', r.id, 'last');
    set('Activity Date', '"' + r.date + '"', 'last');
    set('Activity Name', 'n' + r.id, 'last');
    set('Activity Type', r.type, 'last');
    set('Distance', '9.99', 'first'); // display units (km)
    set('Distance', String(r.distanceM), 'last'); // canonical meters
    lines.push(cells.join(','));
  }
  fs.writeFileSync(path.join(dir, 'activities.csv'), lines.join('\n') + '\n');
  return dir;
}

describe('readStravaExportForReconcile', () => {
  it('maps runs (distance from the LAST Distance column) and counts non-runs as preIgnored', () => {
    const dir = writeExport([
      { id: '111', date: 'Aug 16, 2011, 6:55:32 PM', type: 'Run', distanceM: 5000.5 },
      { id: '222', date: 'Aug 17, 2011, 6:55:32 PM', type: 'Ride', distanceM: 20000 },
      { id: '333', date: 'Aug 18, 2011, 6:55:32 PM', type: 'Walk', distanceM: 3000 },
    ]);
    const out = readStravaExportForReconcile(dir);
    expect(out.runs).toEqual([
      { sourceId: '111', startEpoch: Date.UTC(2011, 7, 16, 18, 55, 32) / 1000, activityType: 'Run', distanceM: 5000.5 },
    ]);
    expect(out.preIgnored).toEqual({ Ride: 1, Walk: 1 });
    expect(out.summaryFiles).toEqual(['activities.csv']);
  });

  it('throws naming the type when the shared parser dropped a run-like type', () => {
    const dir = writeExport([
      { id: '111', date: 'Aug 16, 2011, 6:55:32 PM', type: 'Run', distanceM: 5000 },
      { id: '444', date: 'Aug 19, 2011, 6:55:32 PM', type: 'Trail Run', distanceM: 8000 },
    ]);
    expect(() => readStravaExportForReconcile(dir)).toThrow('Trail Run');
  });
});
