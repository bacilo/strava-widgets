import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runReconciliation } from '../reconcile-exports.js';
import { readGarminExportForReconcile } from './garmin.js';

const FIXTURE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '__fixtures__', 'garmin');
const FIT_DIR = path.join('DI_CONNECT', 'DI-Connect-Fitness');
const FIXTURE_FILE = path.join(FIT_DIR, 'fixture_1_summarizedActivities.json');

const dirs: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'garmin-adapter-'));
  dirs.push(d);
  return d;
}

/** Returns an export root holding a copy of the fixture at <root>/garmin. */
function copyFixture(): string {
  const d = tmp();
  fs.cpSync(FIXTURE_ROOT, path.join(d, 'garmin'), { recursive: true });
  return d;
}

function writeSummary(root: string, rows: unknown): void {
  fs.mkdirSync(path.join(root, FIT_DIR), { recursive: true });
  fs.writeFileSync(path.join(root, FIXTURE_FILE), JSON.stringify([{ summarizedActivitiesExport: rows }]));
}

const fixtureRows = (): Array<Record<string, number | string>> =>
  JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT, FIXTURE_FILE), 'utf8'))[0].summarizedActivitiesExport;

describe('readGarminExportForReconcile', () => {
  it('returns one row per fixture row, passing non-run types through', () => {
    const out = readGarminExportForReconcile(FIXTURE_ROOT);
    const raw = fixtureRows();
    expect(out.runs.length).toBe(raw.length);
    expect(out.preIgnored).toEqual({});
    expect(out.runs.map(r => r.activityType)).toEqual(raw.map(r => r.activityType));
  });

  it('converts centimetres to metres and milliseconds to epoch seconds', () => {
    const out = readGarminExportForReconcile(FIXTURE_ROOT);
    const raw = fixtureRows();
    out.runs.forEach((r, i) => {
      expect(r.distanceM).toBe((raw[i].distance as number) / 100);
      expect(r.startEpoch).toBe(Math.floor((raw[i].startTimeGmt as number) / 1000));
    });
    const both = out.runs.find(r => r.sourceId === '900000000002')!;
    expect(both.startEpoch).toBe(1795014403);
    expect(both.distanceM).toBeCloseTo(13437.13, 6);
  });

  it('lists summary files relative to the root, sorted', () => {
    expect(readGarminExportForReconcile(FIXTURE_ROOT).summaryFiles).toEqual([FIXTURE_FILE]);
  });

  it('throws when there is no summary file', () => {
    expect(() => readGarminExportForReconcile(tmp())).toThrow(/no summarizedActivities/);
  });

  it('throws on a summary file with 0 rows', () => {
    const root = tmp();
    writeSummary(root, []);
    expect(() => readGarminExportForReconcile(root)).toThrow(/0 rows/);
  });

  it('throws naming the row index when the id or start is missing', () => {
    const a = tmp();
    writeSummary(a, [{ activityId: 1, startTimeGmt: 1000, activityType: 'running', distance: 1 }, { startTimeGmt: 2000 }]);
    expect(() => readGarminExportForReconcile(a)).toThrow(/row 1/);
    const b = tmp();
    writeSummary(b, [{ activityId: 5, activityType: 'running' }]);
    expect(() => readGarminExportForReconcile(b)).toThrow(/row 0/);
  });

  it('throws on a non-digit activity id', () => {
    const root = tmp();
    writeSummary(root, [{ activityId: '12a', startTimeGmt: 1000, activityType: 'running', distance: 1 }]);
    expect(() => readGarminExportForReconcile(root)).toThrow(/invalid activity id/);
  });

  it('classifies the named rows through runReconciliation on a temp copy', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const root = copyFixture();
    const acts = path.join(tmp(), 'acts');
    fs.mkdirSync(acts);
    const plant = (id: string, epoch: number): void =>
      fs.writeFileSync(path.join(acts, `${id}.json`), JSON.stringify({ id, start_date: new Date(epoch * 1000).toISOString() }));
    plant('a1', 1795014403);
    plant('a2', 1772348460 - 60);
    plant('a3', 1773126000);
    const audit = await runReconciliation({
      source: 'garmin',
      exportRoot: root,
      activitiesDir: acts,
      auditDir: path.join(tmp(), 'audit'),
      exportDate: '2026-11-25',
    });
    const ids = (xs: { source_id: string }[]): string[] => xs.map(x => x.source_id);
    expect(ids(audit.missing)).toEqual(['900000000003']);
    expect(ids(audit.near)).toEqual(['900000000004']);
    expect(ids(audit.missing)).not.toContain('900000000002');
    expect(ids(audit.near)).not.toContain('900000000002');
    expect(audit.counts.matched_exact).toBeGreaterThanOrEqual(1);
    expect(audit.export_identity.summary_files[0].path).toBe(path.join(FIT_DIR, '<account>_1_summarizedActivities.json'));
  });
});
