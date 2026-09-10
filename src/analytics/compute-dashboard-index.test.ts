import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FileStore } from '../storage/file-store.js';
import type { CanonicalStream, StreamManifest } from '../streams/stream.types.js';
import type { StravaActivity } from '../types/strava.types.js';
import type { BestEffortsDocument } from './best-effort.types.js';
import { DASHBOARD_INDEX_SCHEMA_VERSION } from './dashboard-index.types.js';
import { computeDashboardIndex } from './compute-dashboard-index.js';
import { detectPaceDisagreement } from './pace-derivation.js';
import { NOT_COMPUTABLE_NO_STREAM } from './pace-quality.js';
import { makeStream, syntheticDecimationAliasedStream } from './pace-fixtures.js';

/** The exact declared member list of `DashboardIndexRow`, sorted — used to assert no leaked fields. */
const EXPECTED_ROW_KEYS = [
  'avgCadenceRpm',
  'avgHr',
  'distanceM',
  'elevationGainM',
  'excludedFromRecords',
  'gearName',
  'id',
  'location',
  'lowConfidence',
  'maxHr',
  'movingTimeSec',
  'name',
  'paceDisagreement',
  'paceSecPerKm',
  'prCount',
  'quality',
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

  async function writeStream(id: string, stream: CanonicalStream): Promise<void> {
    await fileStore.writeJson(path.join('streams', `${id}.json`), stream);
  }

  async function writeGearConfig(gear: Record<string, string>): Promise<void> {
    await fileStore.writeJson(path.join('config', 'gear.json'), {
      schemaVersion: 1,
      note: 'test gear config',
      gear,
    });
  }

  const baseOptions = () => ({
    activitiesDir: path.join(tmpDir, 'activities'),
    streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
    statsDir: path.join(tmpDir, 'stats'),
    geoDir: path.join(tmpDir, 'geo'),
    outDir: path.join(tmpDir, 'dashboard'),
    gearConfigPath: path.join(tmpDir, 'config', 'gear.json'),
    // Phase 27's quality-signal read is unconditional for every available
    // manifest entry (unlike paceDisagreement's threshold-gated read), so
    // every test with an `available: true` entry now needs this sandboxed
    // — otherwise it would probe the real repo's `data/streams/` by
    // relative path.
    streamsDir: path.join(tmpDir, 'streams'),
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

  it('sportType falls back to type when sport_type is absent (intervals.icu-migrated records)', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['i123'] = {
      available: true,
      source: 'intervals',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('i123', { type: 'Run', sport_type: undefined });

    const doc = await computeDashboardIndex(baseOptions());
    expect(doc.activities[0].sportType).toBe('Run');
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
              demotion: null,
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
              demotion: null,
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
              demotion: null,
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

  it('orders a mixed-suffix boundary pair correctly regardless of build-machine timezone (WR-03)', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['3475726256'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['i174109928'] = {
      available: true,
      source: 'intervals',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('3475726256', { start_date_local: '2026-08-06T23:30:00Z' });
    await writeActivity('i174109928', { start_date_local: '2026-08-07T00:30:00' });

    const doc = await computeDashboardIndex(baseOptions());
    expect(doc.activities.map((r) => r.id)).toEqual(['i174109928', '3475726256']);
  });

  it('sorts around a malformed start_date_local without corrupting the whole order', async () => {
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
    manifest.activities['bad'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('old', { start_date_local: '2024-01-01T09:00:00Z' });
    await writeActivity('new', { start_date_local: '2026-06-01T09:00:00Z' });
    await writeActivity('bad', { start_date_local: 'not-a-date' });

    const doc = await computeDashboardIndex(baseOptions());
    expect(doc.activities).toHaveLength(3);
    expect(doc.activities.map((r) => r.id)).toEqual(['new', 'old', 'bad']);
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

  it('a gear_id present in a populated gear map yields the real name', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('a1', { gear_id: 'g123' });
    await writeGearConfig({ g123: 'Pegasus 40' });

    const doc = await computeDashboardIndex(baseOptions());
    expect(doc.activities[0].gearName).toBe('Pegasus 40');
  });

  it('a gear_id absent from the gear map yields a Shoe N ordinal', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('a1', { gear_id: 'g999' });
    await writeGearConfig({});

    const doc = await computeDashboardIndex(baseOptions());
    expect(doc.activities[0].gearName).toBe('Shoe 1');
  });

  it('an activity with no gear_id yields gearName: null', async () => {
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
    await writeGearConfig({});

    const doc = await computeDashboardIndex(baseOptions());
    expect(doc.activities[0].gearName).toBeNull();
  });

  it('a missing gear config file yields ordinals for geared rows and null for ungeared rows with no thrown error', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['geared'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['ungeared'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('geared', { gear_id: 'g555' });
    await writeActivity('ungeared');
    // No gear.json written.

    const doc = await computeDashboardIndex(baseOptions());
    const byId = Object.fromEntries(doc.activities.map((r) => [r.id, r]));
    expect(byId['geared'].gearName).toBe('Shoe 1');
    expect(byId['ungeared'].gearName).toBeNull();
  });

  it('totals.withGear matches the number of non-null gearName rows', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['geared1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['geared2'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['ungeared'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('geared1', { gear_id: 'g1' });
    await writeActivity('geared2', { gear_id: 'g2' });
    await writeActivity('ungeared');
    await writeGearConfig({ g1: 'Shoe A', g2: 'Shoe B' });

    const doc = await computeDashboardIndex(baseOptions());
    const withGear = doc.activities.filter((r) => r.gearName !== null);
    expect(doc.totals.withGear).toBe(withGear.length);
    expect(doc.totals.withGear).toBe(2);
  });

  it('no emitted row gearName equals its source gear_id', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('a1', { gear_id: 'g16649854' });
    await writeGearConfig({ g16649854: '' });

    const doc = await computeDashboardIndex(baseOptions());
    expect(doc.activities[0].gearName).not.toBe('g16649854');
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

  describe('quality signals (QUAL-01, QUAL-03, D-17)', () => {
    it('a streamed activity produces a row whose quality carries all five named sub-objects and notComputableReason: null', async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['streamed1'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 11,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);
      await writeActivity('streamed1', { device_name: 'Garmin fēnix 6 Pro' });
      await writeStream(
        'streamed1',
        makeStream({
          id: 'streamed1',
          t: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
          d: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300],
        })
      );

      const doc = await computeDashboardIndex(baseOptions());
      const row = doc.activities[0];
      expect(row.quality.notComputableReason).toBeNull();
      expect(row.quality.decimation).toBeDefined();
      expect(row.quality.gapProfile).toBeDefined();
      expect(row.quality.impossibleSamples).toBeDefined();
      expect(row.quality.deviceEra).toBeDefined();
      expect(row.quality.elapsedVsMoving).toBeDefined();
      expect(row.quality.decimation.tier).toBe('none');
      expect(row.quality.gapProfile.tier).toBe('none');
      expect(row.quality.impossibleSamples.tier).toBe('none');
      expect(row.quality.deviceEra.family).toBe('garmin-fenix-6-pro');
      expect(row.quality.anySevere).toBe(false);
    });

    it('a stream-less activity reports notComputableReason === NOT_COMPUTABLE_NO_STREAM, all three tiering tiers not-computable, anySevere false, and a resolved deviceEra.family never "none"', async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['nostream1'] = { available: false, reason: 'manual' };
      await writeManifest(manifest);
      await writeActivity('nostream1', { device_name: null, source_provider: null });

      const doc = await computeDashboardIndex(baseOptions());
      const row = doc.activities[0];
      expect(row.quality.notComputableReason).toBe(NOT_COMPUTABLE_NO_STREAM);
      expect(row.quality.decimation.tier).toBe('not-computable');
      expect(row.quality.gapProfile.tier).toBe('not-computable');
      expect(row.quality.impossibleSamples.tier).toBe('not-computable');
      expect(row.quality.anySevere).toBe(false);
      expect(row.quality.deviceEra.family).not.toBe('none');
      expect(row.quality.deviceEra.family).toBe('no-device-name');
    });

    it('doc.schemaVersion equals DASHBOARD_INDEX_SCHEMA_VERSION, which is still 1', async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['a1'] = { available: false, reason: 'manual' };
      await writeManifest(manifest);
      await writeActivity('a1');

      const doc = await computeDashboardIndex(baseOptions());
      expect(doc.schemaVersion).toBe(DASHBOARD_INDEX_SCHEMA_VERSION);
      expect(DASHBOARD_INDEX_SCHEMA_VERSION).toBe(1);
    });

    it('totals.qualityAnySevere equals the count of rows whose quality.anySevere is true, recomputed independently from doc.activities', async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['severe1'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 101,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      manifest.activities['clean1'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 11,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);
      await writeActivity('severe1');
      await writeActivity('clean1');
      // syntheticDecimationAliasedStream: 101 samples, 50% zero-advance —
      // well past DECIMATION_SEVERE_ZERO_ADVANCE_FRACTION (0.15) and
      // DECIMATION_SEVERE_MIN_SAMPLES (50), so this activity's decimation
      // tier is 'severe' and anySevere is true.
      await writeStream('severe1', { ...syntheticDecimationAliasedStream(), id: 'severe1' });
      await writeStream(
        'clean1',
        makeStream({
          id: 'clean1',
          t: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
          d: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300],
        })
      );

      const doc = await computeDashboardIndex(baseOptions());
      const recount = doc.activities.filter((row) => row.quality.anySevere).length;
      expect(recount).toBeGreaterThan(0);
      expect(doc.totals.qualityAnySevere).toBe(recount);
    });

    it('a shard file is written for every row, its activityId matches the row id, and its signals deep-equals the row quality', async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['streamed1'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 11,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      manifest.activities['nostream1'] = { available: false, reason: 'manual' };
      await writeManifest(manifest);
      await writeActivity('streamed1');
      await writeActivity('nostream1');
      await writeStream(
        'streamed1',
        makeStream({
          id: 'streamed1',
          t: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
          d: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300],
        })
      );

      const doc = await computeDashboardIndex(baseOptions());
      for (const row of doc.activities) {
        const shardBody = JSON.parse(
          await fs.readFile(path.join(tmpDir, 'stats', 'pace-quality', `${row.id}.json`), 'utf-8')
        );
        expect(shardBody.activityId).toBe(row.id);
        expect(shardBody.signals).toEqual(row.quality);
      }
    });

    it('a stream file present but containing malformed JSON yields notComputableReason set and does not throw or skip the activity', async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['corruptstream1'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 11,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);
      await writeActivity('corruptstream1');
      await fs.mkdir(path.join(tmpDir, 'streams'), { recursive: true });
      await fs.writeFile(
        path.join(tmpDir, 'streams', 'corruptstream1.json'),
        '{ not valid json',
        'utf-8'
      );

      const doc = await computeDashboardIndex(baseOptions());
      expect(doc.activities).toHaveLength(1);
      const row = doc.activities[0];
      expect(row.quality.notComputableReason).toBe(NOT_COMPUTABLE_NO_STREAM);
      expect(row.quality.decimation.tier).toBe('not-computable');
    });
  });
});

/**
 * PACE-07/D-14: the metadata-vs-stream pace disagreement cross-check,
 * measured against the REAL committed archive (`data/activities/*.json` +
 * `data/streams/{id}.json`), not the tmpDir fixtures above — this is the
 * same archive-wide sweep discipline `pace-derivation.test.ts` uses for
 * `classifyGaps`. Re-verify at execution time (the archive grows nightly);
 * do not trust these numbers blindly.
 *
 * Disposition rule: a newly flagged activity beyond the ones named here is
 * a genuine finding to record and, if real, to regenerate the PACE-06/
 * PACE-07 reporting for — it is never a reason to loosen this assertion.
 */
describe('pace disagreement', () => {
  const ACTIVITIES_DIR = 'data/activities';
  const STREAMS_DIR = 'data/streams';

  function metadataPaceSecPerKm(activity: StravaActivity): number | null {
    const distanceM = activity.distance;
    const movingTimeSec = activity.moving_time;
    return distanceM > 0 && movingTimeSec > 0 ? movingTimeSec / (distanceM / 1000) : null;
  }

  it('flags exactly a handful of activities archive-wide, including 5059204779, at or under the 0.5% over-fire ceiling', async () => {
    // Scans every committed activity record, matching the writer's own
    // per-activity loop (compute-dashboard-index.ts) — the denominator is
    // the archive's full activity count (~1,890), not the smaller subset
    // that happens to have a matching stream file (~1,865). A missing
    // stream degrades to "not flagged" here too, exactly as the real writer
    // degrades on a stream read failure (T-26-01).
    const activityFiles = (await fs.readdir(ACTIVITIES_DIR)).filter((f) => f.endsWith('.json'));

    let scanned = 0;
    const flagged: string[] = [];

    for (const file of activityFiles) {
      const id = file.replace(/\.json$/, '');

      const activity = JSON.parse(
        await fs.readFile(path.join(ACTIVITIES_DIR, file), 'utf-8')
      ) as StravaActivity;

      scanned++;

      let stream: CanonicalStream | null = null;
      try {
        stream = JSON.parse(
          await fs.readFile(path.join(STREAMS_DIR, `${id}.json`), 'utf-8')
        ) as CanonicalStream;
      } catch {
        stream = null; // No matching stream file — cannot be flagged, same as the writer.
      }

      const result =
        stream !== null ? detectPaceDisagreement(metadataPaceSecPerKm(activity), stream) : null;
      if (result !== null) flagged.push(id);
    }

    console.log(
      `pace disagreement sweep: scanned ${scanned} activities, flagged ${flagged.length} (${flagged.join(', ')})`
    );

    expect(scanned).toBeGreaterThanOrEqual(1890);
    expect(flagged).toContain('5059204779');
    expect(flagged.length).toBeLessThanOrEqual(3);
    expect(flagged.length / scanned).toBeLessThanOrEqual(0.005);
    // Reads and derives pace over the whole ~1,890-activity archive, which lands
    // just under vitest's 5s default and fails intermittently on a busy machine.
    // The budget is generous on purpose — this guards the assertions above, not
    // the sweep's runtime.
  }, 60_000);

  it("5059204779's flagged values round to streamPaceSecPerKm 350.6 (5:51/km) and metadataPaceSecPerKm 112.6 — the exact string UI-SPEC's browser checkpoint row 3 reads back on screen", async () => {
    const activity = JSON.parse(
      await fs.readFile(path.join(ACTIVITIES_DIR, '5059204779.json'), 'utf-8')
    ) as StravaActivity;
    const stream = JSON.parse(
      await fs.readFile(path.join(STREAMS_DIR, '5059204779.json'), 'utf-8')
    ) as CanonicalStream;

    const result = detectPaceDisagreement(metadataPaceSecPerKm(activity), stream);

    expect(result).not.toBeNull();
    expect(result?.streamPaceSecPerKm).toBe(350.6);
    expect(result?.metadataPaceSecPerKm).toBe(112.6);
  });

  it('negative case 7 (permanent): disabling the cross-check via metadataThresholdSecPerKm: 0 returns null for 5059204779, proving the cross-check itself produces the flag — with it disabled the row carries nothing and 112.6 sec/km stands unqualified, which is today\'s shipped behaviour', async () => {
    const activity = JSON.parse(
      await fs.readFile(path.join(ACTIVITIES_DIR, '5059204779.json'), 'utf-8')
    ) as StravaActivity;
    const stream = JSON.parse(
      await fs.readFile(path.join(STREAMS_DIR, '5059204779.json'), 'utf-8')
    ) as CanonicalStream;
    const pace = metadataPaceSecPerKm(activity);

    const disabled = detectPaceDisagreement(pace, stream, { metadataThresholdSecPerKm: 0 });
    expect(disabled).toBeNull();

    // Fails-in-both-directions check: the same call with the default
    // threshold must return non-null on this same stream, or this negative
    // case would be vacuous (unfailable in the other direction).
    const enabled = detectPaceDisagreement(pace, stream);
    expect(enabled).not.toBeNull();
  });
});
