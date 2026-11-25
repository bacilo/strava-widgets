import { describe, expect, it } from 'vitest';

import type { ReconcileResult } from './reconcile.js';
import { buildAudit, serializeAudit } from './reconciliation-audit.js';

const T0 = Date.UTC(2020, 0, 1, 10, 0, 0) / 1000;
const T1 = Date.UTC(2021, 5, 2, 11, 30, 5) / 1000;

function makeResult(): ReconcileResult {
  return {
    source: 'strava',
    window: { firstEpoch: T0, lastEpoch: T1 },
    exportRunCount: 10,
    matchedExact: 7,
    near: [{ sourceId: '2', startEpoch: T0 + 60, archiveId: 'i9', deltaS: 60 }],
    missing: [
      { sourceId: '3', startEpoch: T0 + 500, startDate: '2020-01-01T10:08:20Z', activityType: 'Run', distanceM: 5000, trivial: false },
      { sourceId: '4', startEpoch: T0 + 900, startDate: '2020-01-01T10:15:00Z', activityType: 'Run', distanceM: 20, trivial: true },
    ],
    ignoredTypes: { Walk: 2, Ride: 1 },
  };
}
const META = { exportDate: '2021-06-03', summaryFiles: [{ path: 'activities.csv', sha256: 'ab'.repeat(32) }] };

describe('buildAudit', () => {
  it('has exactly the specified top-level keys in order', () => {
    expect(Object.keys(buildAudit(makeResult(), META))).toEqual([
      'schema_version', 'source', 'export_date', 'export_identity', 'coverage_window', 'claim', 'counts', 'near', 'missing',
    ]);
  });

  it('projects window, counts and entry key sets', () => {
    const a = buildAudit(makeResult(), META);
    expect(a.coverage_window).toEqual({ first_run_start: '2020-01-01T10:00:00Z', last_run_start: '2021-06-02T11:30:05Z' });
    expect(a.counts).toEqual({
      export_runs: 10, matched_exact: 7, near: 1, missing: 2, missing_trivial: 1,
      ignored_types: { Ride: 1, Walk: 2 },
    });
    expect(Object.keys(a.counts.ignored_types)).toEqual(['Ride', 'Walk']);
    expect(Object.keys(a.missing[0]).sort()).toEqual(['activity_type', 'distance_m', 'source_id', 'start_date', 'trivial']);
    expect(Object.keys(a.near[0]).sort()).toEqual(['archive_id', 'delta_s', 'source_id', 'start_date']);
  });

  it('states the exact window-bounded claim', () => {
    expect(buildAudit(makeResult(), META).claim).toBe(
      'This audit covers only runs recorded in this export that start between 2020-01-01T10:00:00Z and 2021-06-02T11:30:05Z inclusive. It makes no claim about runs outside that window or absent from the export.'
    );
  });

  it('is deterministic across independent builds and ends with a newline', () => {
    const a = serializeAudit(buildAudit(makeResult(), META));
    const b = serializeAudit(buildAudit(makeResult(), META));
    expect(a).toBe(b);
    expect(a.endsWith('\n')).toBe(true);
  });

  it('drops planted leak properties (allow-list projection)', () => {
    const r = makeResult();
    Object.assign(r.missing[0], { lat: 55.1, lng: 12.2, name: 'Home loop', polyline: 'xyz' });
    Object.assign(r.near[0], { name: 'Secret', start_latlng: [1, 2] });
    const text = serializeAudit(buildAudit(r, META));
    expect(text).not.toMatch(/"(lat|lng|latlng|start_latlng|name|polyline)"/);
    expect(text).not.toMatch(/^\//m);
    expect(text).not.toContain('Home loop');
  });

  it('keeps every near and missing date inside the window', () => {
    const a = buildAudit(makeResult(), META);
    for (const e of [...a.near, ...a.missing]) {
      expect(e.start_date >= a.coverage_window.first_run_start).toBe(true);
      expect(e.start_date <= a.coverage_window.last_run_start).toBe(true);
    }
  });

  it('names the single instant for a one-run window', () => {
    const r = makeResult();
    r.window = { firstEpoch: T0, lastEpoch: T0 };
    r.near = [];
    r.missing = [];
    const a = buildAudit(r, { ...META, exportDate: '2020-01-01' });
    expect(a.coverage_window.first_run_start).toBe(a.coverage_window.last_run_start);
    expect(a.claim).toContain('between 2020-01-01T10:00:00Z and 2020-01-01T10:00:00Z inclusive');
  });

  it('rejects a malformed export date and one predating the newest run', () => {
    expect(() => buildAudit(makeResult(), { ...META, exportDate: '2021/06/03' })).toThrow('YYYY-MM-DD');
    expect(() => buildAudit(makeResult(), { ...META, exportDate: '2021-06-01' })).toThrow('predates');
  });

  it('has no timestamp, hash or absolute path fields', () => {
    const text = serializeAudit(buildAudit(makeResult(), META));
    expect(text).not.toMatch(/generated_at|"commit"|"head"/);
  });
});
