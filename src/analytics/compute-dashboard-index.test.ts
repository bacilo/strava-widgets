import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FileStore } from '../storage/file-store.js';
import type { StreamManifest } from '../streams/stream.types.js';
import type { BestEffortsDocument } from './best-effort.types.js';
import { computeDashboardIndex } from './compute-dashboard-index.js';

/** The exact declared member list of `DashboardIndexRow`, sorted — used to assert no leaked fields. */
const EXPECTED_ROW_KEYS = [
  'avgCadenceRpm',
  'avgHr',
  'distanceM',
  'elevationGainM',
  'excludedFromRecords',
  'id',
  'location',
  'lowConfidence',
  'maxHr',
  'movingTimeSec',
  'name',
  'paceSecPerKm',
  'prCount',
  'sportType',
  'startDate',
  'startDateLocal',
  'streams',
].sort();

describe('computeDashboardIndex — archive orchestration', () => {
  let tmpDir: string;
  let fileStore: FileStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-index-'));
    fileStore = new FileStore(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  function emptyManifestDoc(): StreamManifest {
    return {
      schemaVersion: 1,
      generated_at: '',
      note: 'test manifest',
      totals: { activities: 0, with_streams: 0, without_streams: 0, by_reason: {} },
      activities: {},
    };
  }

  async function writeManifest(manifest: StreamManifest): Promise<void> {
    await fileStore.writeJson('streams/manifest.json', manifest);
  }

  async function writeActivity(id: string, overrides: Record<string, unknown> = {}): Promise<void> {
    await fileStore.writeJson(path.join('activities', `${id}.json`), {
      id,
      name: 'Morning Run',
      type: 'Run',
      sport_type: 'Run',
      start_date: '2026-01-01T07:00:00Z',
      start_date_local: '2026-01-01T09:00:00Z',
      distance: 10000,
      moving_time: 3000,
      elapsed_time: 3100,
      total_elevation_gain: 50,
      average_speed: 3.3,
      max_speed: 4.5,
      average_heartrate: 140,
      max_heartrate: 160,
      average_cadence: 85,
      location_city: null,
      ...overrides,
    });
  }

  async function writeBestEfforts(doc: Partial<BestEffortsDocument>): Promise<void> {
    await fileStore.writeJson(path.join('stats', 'best-efforts.json'), {
      schemaVersion: 1,
      generatedAt: '',
      note: 'test best-efforts',
      totals: {
        activitiesConsidered: 0,
        activitiesWithEfforts: 0,
        effortsComputed: 0,
        effortsRejected: 0,
        effortsExcluded: 0,
        lowConfidenceEfforts: 0,
        skippedNoStream: 0,
        skippedUnreadable: 0,
      },
      rankings: {},
      rejected: [],
      activities: {},
      ...doc,
    });
  }

  async function writeCities(map: Record<string, string[]>): Promise<void> {
    await fileStore.writeJson(path.join('geo', 'activity-cities.json'), map);
  }

  const baseOptions = () => ({
    activitiesDir: path.join(tmpDir, 'activities'),
    streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
    statsDir: path.join(tmpDir, 'stats'),
    geoDir: path.join(tmpDir, 'geo'),
    outDir: path.join(tmpDir, 'dashboard'),
  });

  it('an available manifest entry with a readable activity produces a row with fields straight from the activity record', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: true, cadence: true, elevation: true },
    };
    await writeManifest(manifest);
    await writeActivity('a1');

    const doc = await computeDashboardIndex(baseOptions());

    expect(doc.activities).toHaveLength(1);
    const row = doc.activities[0];
    expect(row.id).toBe('a1');
    expect(row.distanceM).toBe(10000);
    expect(row.movingTimeSec).toBe(3000);
    expect(row.elevationGainM).toBe(50);
    expect(row.avgHr).toBe(140);
    expect(row.maxHr).toBe(160);
    expect(row.avgCadenceRpm).toBe(85);
    expect(row.sportType).toBe('Run');
  });

  it('paceSecPerKm for distance 10000, moving_time 3000 is 300, rounded to one decimal', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('a1', { distance: 10000, moving_time: 3000 });

    const doc = await computeDashboardIndex(baseOptions());
    expect(doc.activities[0].paceSecPerKm).toBe(300);
  });

  it('paceSecPerKm is null when distance is 0', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('a1', { distance: 0, moving_time: 3000 });

    const doc = await computeDashboardIndex(baseOptions());
    expect(doc.activities[0].paceSecPerKm).toBeNull();
  });

  it('paceSecPerKm is null when moving_time is 0', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('a1', { distance: 10000, moving_time: 0 });

    const doc = await computeDashboardIndex(baseOptions());
    expect(doc.activities[0].paceSecPerKm).toBeNull();
  });

  it('avgHr, maxHr, avgCadenceRpm, and elevationGainM are null (not 0, not undefined) when the source field is absent or null', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('a1', {
      average_heartrate: undefined,
      max_heartrate: null,
      average_cadence: undefined,
      total_elevation_gain: null,
    });

    const doc = await computeDashboardIndex(baseOptions());
    const row = doc.activities[0];
    expect(row.avgHr).toBeNull();
    expect(row.maxHr).toBeNull();
    expect(row.avgCadenceRpm).toBeNull();
    expect(row.elevationGainM).toBeNull();
  });

  it('avgCadenceRpm equals the raw average_cadence value, NOT doubled', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('a1', { average_cadence: 87.9 });

    const doc = await computeDashboardIndex(baseOptions());
    expect(doc.activities[0].avgCadenceRpm).toBe(87.9);
  });

  it('a manifest entry with available: false, reason: manual still produces a row with streams flags all false', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = { available: false, reason: 'manual' };
    await writeManifest(manifest);
    await writeActivity('a1');

    const doc = await computeDashboardIndex(baseOptions());
    expect(doc.activities).toHaveLength(1);
    const row = doc.activities[0];
    expect(row.streams.available).toBe(false);
    expect(row.streams.reason).toBe('manual');
    expect(row.streams.hr).toBe(false);
    expect(row.streams.cadence).toBe(false);
    expect(row.streams.elevation).toBe(false);
  });

  it("an available entry's streams.hr/cadence/elevation mirror the manifest channels booleans and distanceSource mirrors the manifest value", async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'geo',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: true, cadence: false, elevation: true },
    };
    await writeManifest(manifest);
    await writeActivity('a1');

    const doc = await computeDashboardIndex(baseOptions());
    const row = doc.activities[0];
    expect(row.streams.available).toBe(true);
    expect(row.streams.hr).toBe(true);
    expect(row.streams.cadence).toBe(false);
    expect(row.streams.elevation).toBe(true);
    expect(row.streams.distanceSource).toBe('geo');
  });

  it("lowConfidence is true exactly when the manifest entry's distanceSource is 'geo', false for 'native' and unavailable entries", async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['geo1'] = {
      available: true,
      source: 'gpx',
      distanceSource: 'geo',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['native1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['unavail1'] = { available: false, reason: 'manual' };
    await writeManifest(manifest);
    await writeActivity('geo1');
    await writeActivity('native1');
    await writeActivity('unavail1');

    const doc = await computeDashboardIndex(baseOptions());
    const byId = Object.fromEntries(doc.activities.map((r) => [r.id, r]));
    expect(byId['geo1'].lowConfidence).toBe(true);
    expect(byId['native1'].lowConfidence).toBe(false);
    expect(byId['unavail1'].lowConfidence).toBe(false);
  });

  it('location is the FIRST city name from the cities map when present', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('a1', { location_city: 'Fallback City' });
    await writeCities({ a1: ['Gropiusstadt', 'Johannisthal'] });

    const doc = await computeDashboardIndex(baseOptions());
    expect(doc.activities[0].location).toBe('Gropiusstadt');
  });

  it('location falls back to location_city when the cities map has no entry', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('a1', { location_city: 'Fallback City' });
    await writeCities({});

    const doc = await computeDashboardIndex(baseOptions());
    expect(doc.activities[0].location).toBe('Fallback City');
  });

  it('location is null when neither the cities map nor location_city exists', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('a1', { location_city: null });
    await writeCities({});

    const doc = await computeDashboardIndex(baseOptions());
    expect(doc.activities[0].location).toBeNull();
  });

  it('excludedFromRecords mirrors bestEfforts.activities[id].excludedFromRecords; false when the activity has no best-efforts entry', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['excluded1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['noentry1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('excluded1');
    await writeActivity('noentry1');
    await writeBestEfforts({
      activities: {
        excluded1: {
          activityId: 'excluded1',
          startDate: '2026-01-01T07:00:00Z',
          distanceSource: 'native',
          efforts: [],
          excludedFromRecords: true,
        },
      },
    });

    const doc = await computeDashboardIndex(baseOptions());
    const byId = Object.fromEntries(doc.activities.map((r) => [r.id, r]));
    expect(byId['excluded1'].excludedFromRecords).toBe(true);
    expect(byId['noentry1'].excludedFromRecords).toBe(false);
  });

  it('prCount counts that activity efforts with wasPRAtTheTime === true; 0 when the activity has no best-efforts entry', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['pr1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['noentry1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('pr1');
    await writeActivity('noentry1');
    await writeBestEfforts({
      activities: {
        pr1: {
          activityId: 'pr1',
          startDate: '2026-01-01T07:00:00Z',
          distanceSource: 'native',
          excludedFromRecords: false,
          efforts: [
            {
              distance: '400m',
              durationSec: 90,
              paceSecPerKm: 225,
              startOffsetSec: 0,
              endOffsetSec: 90,
              lowConfidence: false,
              wasPRAtTheTime: true,
              excludedFromRecords: false,
            },
            {
              distance: '1k',
              durationSec: 240,
              paceSecPerKm: 240,
              startOffsetSec: 0,
              endOffsetSec: 240,
              lowConfidence: false,
              wasPRAtTheTime: true,
              excludedFromRecords: false,
            },
            {
              distance: '5k',
              durationSec: 1300,
              paceSecPerKm: 260,
              startOffsetSec: 0,
              endOffsetSec: 1300,
              lowConfidence: false,
              wasPRAtTheTime: false,
              excludedFromRecords: false,
            },
          ],
        },
      },
    });

    const doc = await computeDashboardIndex(baseOptions());
    const byId = Object.fromEntries(doc.activities.map((r) => [r.id, r]));
    expect(byId['pr1'].prCount).toBe(2);
    expect(byId['noentry1'].prCount).toBe(0);
  });

  it('activities is ordered newest-first by startDateLocal', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['old'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['new'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['mid'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('old', { start_date_local: '2024-01-01T09:00:00Z' });
    await writeActivity('new', { start_date_local: '2026-06-01T09:00:00Z' });
    await writeActivity('mid', { start_date_local: '2025-03-01T09:00:00Z' });

    const doc = await computeDashboardIndex(baseOptions());
    expect(doc.activities.map((r) => r.id)).toEqual(['new', 'mid', 'old']);
  });

  it('an activity file that is missing increments totals.skippedUnreadable, logs a warning, and does not abort the run', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['missing1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['good1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    // missing1 has no activity file written on purpose.
    await writeActivity('good1');

    const doc = await computeDashboardIndex(baseOptions());
    expect(doc.totals.skippedUnreadable).toBe(1);
    expect(doc.activities).toHaveLength(1);
    expect(doc.activities[0].id).toBe('good1');
  });

  it('an activity file containing invalid JSON increments totals.skippedUnreadable and does not abort the run', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['corrupt1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['good1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await fs.mkdir(path.join(tmpDir, 'activities'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, 'activities', 'corrupt1.json'),
      '{ not valid json',
      'utf-8'
    );
    await writeActivity('good1');

    const doc = await computeDashboardIndex(baseOptions());
    expect(doc.totals.skippedUnreadable).toBe(1);
    expect(doc.activities).toHaveLength(1);
    expect(doc.activities[0].id).toBe('good1');
  });

  it('a missing best-efforts.json produces rows with excludedFromRecords: false and prCount: 0 and does not throw', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('a1');
    // No best-efforts.json written.

    const doc = await computeDashboardIndex(baseOptions());
    expect(doc.activities[0].excludedFromRecords).toBe(false);
    expect(doc.activities[0].prCount).toBe(0);
  });

  it('a missing activity-cities.json produces rows falling back to location_city and does not throw', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('a1', { location_city: 'Berlin' });
    // No activity-cities.json written.

    const doc = await computeDashboardIndex(baseOptions());
    expect(doc.activities[0].location).toBe('Berlin');
  });

  it('a missing stream manifest throws', async () => {
    // Manifest deliberately not written.
    await expect(computeDashboardIndex(baseOptions())).rejects.toThrow();
  });

  it('totals reconcile: activities array length equals totals.activities, and withStreams + withoutStreams + skippedUnreadable equals the manifest entry count', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['avail1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['unavail1'] = { available: false, reason: 'manual' };
    manifest.activities['missing1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('avail1');
    await writeActivity('unavail1');
    // missing1 has no activity file, so it is skipped as unreadable.

    const doc = await computeDashboardIndex(baseOptions());
    const manifestCount = Object.keys(manifest.activities).length;
    expect(doc.activities.length).toBe(doc.totals.activities);
    expect(doc.totals.withStreams + doc.totals.withoutStreams + doc.totals.skippedUnreadable).toBe(
      manifestCount
    );
  });

  it('the written document has schemaVersion, a parseable ISO generatedAt, and a non-empty note', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('a1');

    const doc = await computeDashboardIndex(baseOptions());
    expect(doc.schemaVersion).toBe(1);
    expect(Number.isNaN(Date.parse(doc.generatedAt))).toBe(false);
    expect(doc.note.length).toBeGreaterThan(0);
  });

  it('no emitted row object has an own property outside the declared DashboardIndexRow member list', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('a1');

    const doc = await computeDashboardIndex(baseOptions());
    const row = doc.activities[0];
    expect(Object.keys(row).sort()).toEqual(EXPECTED_ROW_KEYS);
  });

  it('writes the document to <outDir>/index.json on disk', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('a1');

    await computeDashboardIndex(baseOptions());
    const written = JSON.parse(
      await fs.readFile(path.join(tmpDir, 'dashboard', 'index.json'), 'utf-8')
    );
    expect(written.activities).toHaveLength(1);
  });
});
