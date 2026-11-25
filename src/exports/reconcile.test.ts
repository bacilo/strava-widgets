import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  isRunLike,
  loadArchiveIndex,
  NEAR_MATCH_TOLERANCE_S,
  reconcile,
  TRIVIAL_DISTANCE_M,
  type ArchiveEntry,
  type ReconcileExportRun,
} from './reconcile.js';

const E = 1776666748; // 2026-04-20T06:32:28Z

function run(sourceId: string, startEpoch: number, extra: Partial<ReconcileExportRun> = {}): ReconcileExportRun {
  return { sourceId, startEpoch, activityType: 'Run', distanceM: 5000, ...extra };
}

describe('constants', () => {
  it('pins the tolerance and trivial thresholds', () => {
    expect(NEAR_MATCH_TOLERANCE_S).toBe(120);
    expect(TRIVIAL_DISTANCE_M).toBe(100);
  });
});

describe('isRunLike (fail closed)', () => {
  it.each(['Run', 'running', 'trail_running', 'Treadmill Running', 'virtual_run', ''])('%j is run-like', t => {
    expect(isRunLike(t)).toBe(true);
  });
  it.each(['Ride', 'Walk', 'Workout', 'strength_training'])('%j is not run-like', t => {
    expect(isRunLike(t)).toBe(false);
  });
});

describe('reconcile matching', () => {
  it('matches on exact epoch even when the export id equals a DIFFERENT archive id (L-01)', () => {
    const archive: ArchiveEntry[] = [
      { id: 'i1', epoch: E },
      { id: '18180779941', epoch: E + 100000 },
    ];
    const r = reconcile('t', [run('18180779941', E)], archive);
    expect(r.matchedExact).toBe(1);
    expect(r.missing).toEqual([]);
    expect(r.near).toEqual([]);
  });

  it('does not match on id alone: same id, different epoch is classified by epoch', () => {
    const r = reconcile('t', [run('i1', E + 5000)], [{ id: 'i1', epoch: E }]);
    expect(r.matchedExact).toBe(0);
    expect(r.missing.map(m => m.sourceId)).toEqual(['i1']);
  });

  it('reports near within 120 s and missing at 121 s', () => {
    const archive = [{ id: 'a', epoch: E }];
    const r = reconcile('t', [run('x1', E + 120), run('x2', E - 1), run('x3', E + 121)], archive);
    expect(r.near.map(n => [n.sourceId, n.deltaS, n.archiveId])).toEqual([
      ['x2', -1, 'a'],
      ['x1', 120, 'a'],
    ]);
    expect(r.missing.map(m => m.sourceId)).toEqual(['x3']);
  });

  it('lists a run between two archive neighbours as missing with an ISO startDate', () => {
    const archive = [
      { id: 'i211617588', epoch: 1794895612 },
      { id: 'i211719792', epoch: 1795014403 },
    ];
    const epoch = Date.UTC(2026, 10, 18, 6, 30, 0) / 1000;
    const r = reconcile('t', [run('g1', epoch)], archive);
    expect(r.missing).toHaveLength(1);
    expect(r.missing[0].startDate).toBe('2026-11-18T06:30:00Z');
  });

  it('flags runs under 100 m as trivial instead of dropping them', () => {
    const r = reconcile('t', [run('s', E, { distanceM: 99.9 }), run('l', E + 1000, { distanceM: 100 })], []);
    expect(r.missing.map(m => [m.sourceId, m.trivial])).toEqual([
      ['s', true],
      ['l', false],
    ]);
  });

  it('sorts missing by epoch then sourceId', () => {
    const r = reconcile('t', [run('b', E + 10000), run('z', E), run('a', E)], []);
    expect(r.missing.map(m => m.sourceId)).toEqual(['a', 'z', 'b']);
  });

  it('carries no activity name field', () => {
    const r = reconcile('t', [run('s', E)], []);
    expect(Object.keys(r.missing[0]).sort()).toEqual(
      ['activityType', 'distanceM', 'sourceId', 'startDate', 'startEpoch', 'trivial']
    );
  });
});

describe('reconcile classification, window and conservation', () => {
  it('routes non-run-like rows to ignoredTypes and merges preIgnored', () => {
    const rows = [run('r', E), { ...run('b', E + 1), activityType: 'Ride' }, { ...run('w', E + 2), activityType: 'Walk' }];
    const r = reconcile('t', rows, [{ id: 'a', epoch: E }], { preIgnored: { Ride: 2, Hike: 1 } });
    expect(r.ignoredTypes).toEqual({ Hike: 1, Ride: 3, Walk: 1 });
    expect(r.exportRunCount).toBe(1);
    expect(r.missing).toEqual([]);
  });

  it('derives the window from run-like rows only; archive outside it is never reported', () => {
    const archive = [
      { id: 'early', epoch: E - 1_000_000 },
      { id: 'in', epoch: E },
      { id: 'late', epoch: E + 1_000_000 },
    ];
    const rows = [run('r1', E), run('r2', E + 500), { ...run('b', E + 9_000_000), activityType: 'Ride' }];
    const r = reconcile('t', rows, archive);
    expect(r.window).toEqual({ firstEpoch: E, lastEpoch: E + 500 });
    expect(r.matchedExact).toBe(1);
    expect(r.missing.map(m => m.sourceId)).toEqual(['r2']);
  });

  it('a one-row export has firstEpoch === lastEpoch', () => {
    const r = reconcile('t', [run('r', E)], []);
    expect(r.window.firstEpoch).toBe(r.window.lastEpoch);
  });

  it('throws on zero run-like rows instead of reporting 0 missing', () => {
    expect(() => reconcile('t', [], [{ id: 'a', epoch: E }])).toThrow('parsed 0 runs');
    expect(() => reconcile('t', [{ ...run('b', E), activityType: 'Ride' }], [])).toThrow('parsed 0 runs');
  });

  it('conserves: exportRunCount = matchedExact + near + missing, against an independent input count', () => {
    const archive = [
      { id: 'a', epoch: E },
      { id: 'b', epoch: E + 1000 },
    ];
    const rows: ReconcileExportRun[] = [
      run('1', E),
      run('2', E + 1030),
      run('3', E + 50000),
      { ...run('4', E + 60000), activityType: 'trail_running' },
      { ...run('5', E + 70000), activityType: 'Ride' },
      { ...run('6', E + 80000), activityType: '' },
    ];
    const expectedRunLike = rows.filter(x => /run/i.test(x.activityType) || x.activityType === '').length;
    const r = reconcile('t', rows, archive);
    expect(expectedRunLike).toBe(5);
    expect(r.exportRunCount).toBe(expectedRunLike);
    expect(r.matchedExact + r.near.length + r.missing.length).toBe(expectedRunLike);
    expect(r.matchedExact).toBe(1);
    expect(r.near).toHaveLength(1);
    expect(r.missing).toHaveLength(3);
  });
});

describe('loadArchiveIndex', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  });
  function tmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'reconcile-'));
    dirs.push(d);
    return d;
  }

  it('reads id and epoch from every json file, stringifying ids', () => {
    const d = tmp();
    fs.writeFileSync(path.join(d, 'b.json'), JSON.stringify({ id: 2, start_date: '2026-04-20T06:32:28Z' }));
    fs.writeFileSync(path.join(d, 'a.json'), JSON.stringify({ id: 'i1', start_date: '2026-04-20T06:32:28Z' }));
    fs.writeFileSync(path.join(d, 'note.txt'), 'ignored');
    expect(loadArchiveIndex(d)).toEqual([
      { id: 'i1', epoch: E },
      { id: '2', epoch: E },
    ]);
  });

  it('throws naming the file when a json file is unparseable (fail closed)', () => {
    const d = tmp();
    fs.writeFileSync(path.join(d, 'ok.json'), JSON.stringify({ id: 1, start_date: '2026-04-20T06:32:28Z' }));
    fs.writeFileSync(path.join(d, 'broken.json'), '{ nope');
    expect(() => loadArchiveIndex(d)).toThrow('broken.json');
  });
});
