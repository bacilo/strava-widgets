import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileStore } from '../storage/file-store.js';
import type { CanonicalStream, StreamManifest } from '../streams/stream.types.js';
import type { StravaActivity } from '../types/strava.types.js';
import type { BestEffortsDocument } from './best-effort.types.js';
import { DASHBOARD_INDEX_SCHEMA_VERSION } from './dashboard-index.types.js';
import { computeDashboardIndex } from './compute-dashboard-index.js';
import { detectPaceDisagreement, deriveRunningPace } from './pace-derivation.js';
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
  'runningPace',
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
              contaminated: null,
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
              contaminated: null,
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
              contaminated: null,
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

    // Phase 33 (SEG-06, D-08, plan 33-10 Task 3): DASHBOARD_INDEX_SCHEMA_VERSION
    // stays 1 for the seventh quality signal's additive arrival — named so a
    // reader (and the decision-coverage gate) sees Phase 33 kept the
    // pre-existing invariant, not merely that the constant happens to equal 1.
    it('Phase 33 (SEG-06, D-08) kept DASHBOARD_INDEX_SCHEMA_VERSION at 1 despite quality.unreliableSegments arriving on every row', async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['a1'] = { available: false, reason: 'manual' };
      await writeManifest(manifest);
      await writeActivity('a1');

      const doc = await computeDashboardIndex(baseOptions());
      expect(doc.schemaVersion).toBe(1);
      expect(doc.activities[0].quality.unreliableSegments).toBeDefined();
    });

    it("a computed index row's quality.unreliableSegments carries every field populated for an activity with real detected segments (3475734189, the hidden-pause fixture)", async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['3475734189'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 11,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);
      await writeActivity('3475734189');
      const rawStream = await fs.readFile(path.join('data', 'streams', '3475734189.json'), 'utf-8');
      const realStream = JSON.parse(rawStream) as CanonicalStream;
      await writeStream('3475734189', realStream);

      const doc = await computeDashboardIndex(baseOptions());
      const row = doc.activities[0];
      // Independently-known values for this named activity (33-09-SUMMARY.md,
      // reproduced from 33-14's anchor check): 1 segment, 181.5 m, 122.7 m
      // excess, 8 s, hidden-pause, severe.
      expect(row.quality.unreliableSegments.tier).toBe('severe');
      expect(row.quality.unreliableSegments.count).toBe(1);
      expect(row.quality.unreliableSegments.totalMetres).toBeCloseTo(181.5, 6);
      expect(row.quality.unreliableSegments.totalExcessMetres).toBeCloseTo(122.7, 6);
      expect(row.quality.unreliableSegments.totalSeconds).toBe(8);
      expect(row.quality.unreliableSegments.excessFraction).not.toBeNull();
      expect(row.quality.unreliableSegments.mechanisms).toEqual(['hidden-pause']);
    });

    it('a stream-less activity reports quality.unreliableSegments in its not-computable shape too, not absent', async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['nostream-unreliable'] = { available: false, reason: 'manual' };
      await writeManifest(manifest);
      await writeActivity('nostream-unreliable', { device_name: null, source_provider: null });

      const doc = await computeDashboardIndex(baseOptions());
      const row = doc.activities[0];
      expect(row.quality.unreliableSegments).toEqual({
        tier: 'not-computable',
        count: null,
        totalMetres: null,
        totalExcessMetres: null,
        totalSeconds: null,
        excessFraction: null,
        mechanisms: null,
      });
    });

    describe('pauses (Phase 34: PAUSE-02, STOP-01, STOP-03, D-11, D-14)', () => {
      it("a computed index row for 3475724402 carries quality.pauseClassification and quality.forgottenStop with every field populated", async () => {
        const manifest = emptyManifestDoc();
        manifest.activities['3475724402'] = {
          available: true,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 11,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        };
        await writeManifest(manifest);
        await writeActivity('3475724402');
        const rawStream = await fs.readFile(path.join('data', 'streams', '3475724402.json'), 'utf-8');
        const realStream = JSON.parse(rawStream) as CanonicalStream;
        await writeStream('3475724402', realStream);

        const doc = await computeDashboardIndex(baseOptions());
        const row = doc.activities[0];

        const pc = row.quality.pauseClassification;
        expect(pc.intervalCount).not.toBeNull();
        expect(pc.stationaryCount).not.toBeNull();
        expect(pc.walkedCount).not.toBeNull();
        expect(pc.ranThroughCount).not.toBeNull();
        expect(pc.transportedCount).not.toBeNull();
        expect(pc.notClassifiableCount).not.toBeNull();
        // Independently known from the 34-07 zero-import recount: walked=1,
        // ran-through=17, stationary=0, transported=0.
        expect(pc.walkedCount).toBe(1);
        expect(pc.ranThroughCount).toBe(17);
        expect(pc.stationaryCount).toBe(0);
        expect(pc.transportedCount).toBe(0);

        const fsSignal = row.quality.forgottenStop;
        expect(fsSignal.computable).toBe(true);
        expect(fsSignal.reason).toBeNull();
        expect(fsSignal.count).not.toBeNull();
        expect(fsSignal.totalSec).not.toBeNull();
        expect(fsSignal.longestSec).not.toBeNull();
        expect(fsSignal.creepCount).not.toBeNull();
        expect(fsSignal.creepTotalSec).not.toBeNull();
        expect(fsSignal.creepLongestSec).not.toBeNull();
        expect(fsSignal.pauseCount).not.toBeNull();
        expect(fsSignal.pauseTotalSec).not.toBeNull();
        expect(fsSignal.pauseLongestSec).not.toBeNull();
      });

      it('a stream-less activity carries quality.pauseClassification and quality.forgottenStop in not-computable form (present, not absent)', async () => {
        const manifest = emptyManifestDoc();
        manifest.activities['nostream-pauses'] = { available: false, reason: 'manual' };
        await writeManifest(manifest);
        await writeActivity('nostream-pauses', { device_name: null, source_provider: null });

        const doc = await computeDashboardIndex(baseOptions());
        const row = doc.activities[0];
        expect(row.quality.pauseClassification).toEqual({
          intervalCount: null,
          stationaryCount: null,
          walkedCount: null,
          ranThroughCount: null,
          transportedCount: null,
          notClassifiableCount: null,
        });
        expect(row.quality.forgottenStop.computable).toBe(false);
        expect(row.quality.forgottenStop.reason).toBe(row.quality.notComputableReason);
      });

      it('doc.schemaVersion equals DASHBOARD_INDEX_SCHEMA_VERSION, which is still 1, despite quality.pauseClassification/forgottenStop arriving on every row', async () => {
        const manifest = emptyManifestDoc();
        manifest.activities['a1'] = { available: false, reason: 'manual' };
        await writeManifest(manifest);
        await writeActivity('a1');

        const doc = await computeDashboardIndex(baseOptions());
        expect(doc.schemaVersion).toBe(1);
        expect(DASHBOARD_INDEX_SCHEMA_VERSION).toBe(1);
        expect(doc.activities[0].quality.pauseClassification).toBeDefined();
        expect(doc.activities[0].quality.forgottenStop).toBeDefined();
      });
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

  /**
   * RPACE-01/RPACE-03 (35-09): the writer-level reachability proof for the
   * gate this plan deletes. NEW describe block per plan instruction — the
   * pre-existing `describe('pace disagreement', ...)` block below (added by
   * 35-08, retargeted onto the real archive) is left untouched.
   *
   * `3475724402`'s own metadata pace is 296.0 s/km — well above the retired
   * 200 sec/km gate — so these fixtures use that same shape (`distance:
   * 1000, moving_time: 296` → `paceSecPerKm: 296`) rather than reusing the
   * real archive, since the real archive's own reachability is already
   * covered by the `pace disagreement` block below.
   */
  describe('running pace reachability (RPACE-01/RPACE-03, 35-09 — the retired 200 sec/km gate is deleted)', () => {
    const SLOW_METADATA_PACE_SEC_PER_KM = 296; // matches 3475724402's own real profile

    /**
     * Builds a synthetic stream shaped like `pace-derivation.test.ts`'s own
     * proven "(c) isolated single-pair GPS jump" fixture: `pairCount` dense
     * covered pairs (`dt=pairDtSec`, `dd=pairDdM` each, strictly increasing
     * so no pair is ever classified `pause`), then ONE isolated-jump burst
     * pair (`dt=2s`, `dd=60m` — implied speed 30 m/s, far above
     * `UNRELIABLE_SPEED_LIMIT_MPS` (7.35), excess 45.3 m clears
     * `UNRELIABLE_EXCESS_FLOOR_M` (3), 60 m below `HIDDEN_PAUSE_MIN_METRES`
     * (116.95) — the exact reachable shape `pace-derivation.test.ts` already
     * proved classifies `isolated-jump`, not `gap-adjacent`/`hidden-pause`),
     * then `pairCount` more dense covered pairs. `dt<=10` throughout keeps
     * every non-burst pair under `RECORDING_GAP_ABS_THRESHOLD_SEC` (10), so
     * it is never classified `recording-gap` either.
     *
     * Hand: `coveredM = 2 * pairCount * pairDdM`, `coveredSec = 2 * pairCount
     * * pairDtSec`, `excludedM = 60` (exactly the burst pair's own advance),
     * `excludedSec = 2` (exactly the burst pair's own duration) — the same
     * boundary rule `deriveRunningPace`'s own docblock states.
     */
    function buildRunningPaceFixtureStream(opts: {
      pairDtSec: number;
      pairDdM: number;
      pairCount: number;
    }): CanonicalStream {
      const { pairDtSec, pairDdM, pairCount } = opts;
      const t: number[] = [0];
      const d: number[] = [0];
      for (let i = 0; i < pairCount; i++) {
        t.push(t[t.length - 1] + pairDtSec);
        d.push(d[d.length - 1] + pairDdM);
      }
      t.push(t[t.length - 1] + 2); // the isolated-jump burst: dt=2, dd=60
      d.push(d[d.length - 1] + 60);
      for (let i = 0; i < pairCount; i++) {
        t.push(t[t.length - 1] + pairDtSec);
        d.push(d[d.length - 1] + pairDdM);
      }
      return makeStream({ t, d });
    }

    /**
     * coveredM=1600, coveredSec=500, excludedM=60, excludedSec=2 (hand,
     * per the docblock above) → runningPaceSecPerKm = 500/(1600/1000) =
     * 312.5. ratio = 312.5/296 ≈ 1.0557, clears
     * `PACE_DISAGREEMENT_RUNNING_RATIO` (1.0173) — this fixture IS flagged.
     */
    function makeFlaggedStream(): CanonicalStream {
      return buildRunningPaceFixtureStream({ pairDtSec: 10, pairDdM: 32, pairCount: 25 });
    }

    /**
     * coveredM=1500, coveredSec=450, excludedM=60, excludedSec=2 (hand) →
     * runningPaceSecPerKm = 450/(1500/1000) = 300.0. ratio = 300/296 ≈
     * 1.0135, does NOT clear 1.0173 — this fixture is eligible (excludedM >
     * 0, D-02's gate) but NOT flagged. The mirror of `makeFlaggedStream`,
     * proving reachability fails in the correct direction too, not just the
     * accept direction.
     */
    function makeMirrorStream(): CanonicalStream {
      return buildRunningPaceFixtureStream({ pairDtSec: 9, pairDdM: 30, pairCount: 25 });
    }

    it('a slow-metadata activity (paceSecPerKm well above the retired 200 sec/km gate) is reachable: runningPace is populated and paceDisagreement is non-null once the running pace clears the calibrated cut', async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['slow-badged'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 53,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);
      await writeActivity('slow-badged', { distance: 1000, moving_time: 296 });
      await writeStream('slow-badged', makeFlaggedStream());

      const doc = await computeDashboardIndex(baseOptions());
      const row = doc.activities[0];

      expect(row.paceSecPerKm).toBe(SLOW_METADATA_PACE_SEC_PER_KM);
      expect(row.paceSecPerKm as number).toBeGreaterThan(200); // above the retired gate

      expect(row.runningPace).not.toBeNull();
      expect(row.runningPace?.computable).toBe(true);
      expect(row.runningPace?.notComputableReason).toBeNull();
      expect(row.runningPace?.runningPaceSecPerKm).toBeCloseTo(312.5, 5);
      expect(row.runningPace?.excludedM).toBeCloseTo(60, 5);

      expect(row.paceDisagreement).not.toBeNull();
      expect(row.paceDisagreement?.runningPaceSecPerKm).toBeCloseTo(312.5, 1);
    });

    it('the mirror slow-metadata activity, whose running pace does NOT clear the calibrated cut, has runningPace populated but paceDisagreement null — reachability fails correctly in this direction too, so the first case is not vacuous', async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['slow-not-badged'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 53,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);
      await writeActivity('slow-not-badged', { distance: 1000, moving_time: 296 });
      await writeStream('slow-not-badged', makeMirrorStream());

      const doc = await computeDashboardIndex(baseOptions());
      const row = doc.activities[0];

      expect(row.paceSecPerKm).toBe(SLOW_METADATA_PACE_SEC_PER_KM);
      expect(row.paceSecPerKm as number).toBeGreaterThan(200); // above the retired gate

      expect(row.runningPace).not.toBeNull();
      expect(row.runningPace?.computable).toBe(true);
      expect(row.runningPace?.runningPaceSecPerKm).toBeCloseTo(300, 5);
      expect(row.runningPace?.excludedM).toBeCloseTo(60, 5); // D-02 eligible

      expect(row.paceDisagreement).toBeNull();
    });

    it("the retired 200 sec/km gate, reproduced inline against the SAME flagged fixture, would never have read this activity's stream and paceDisagreement would have stayed null forever — proving the gate itself, not the comparator, was what made ROADMAP criterion 3 unsatisfiable (T-35-36)", () => {
      // The retired constant's own value (35-08's carry-over docblock: 200)
      // reproduced here as a LOCAL literal for comparison only — the real
      // export is deleted, and this file never imports or re-adds it.
      const OLD_RETIRED_GATE_SEC_PER_KM = 200;

      let oldGateStreamReadAttempted = false;
      let oldGatePaceDisagreement: ReturnType<typeof detectPaceDisagreement> = null;
      if (
        SLOW_METADATA_PACE_SEC_PER_KM !== null &&
        SLOW_METADATA_PACE_SEC_PER_KM < OLD_RETIRED_GATE_SEC_PER_KM
      ) {
        oldGateStreamReadAttempted = true;
        const stream = makeFlaggedStream();
        oldGatePaceDisagreement = detectPaceDisagreement(
          SLOW_METADATA_PACE_SEC_PER_KM,
          deriveRunningPace(stream)
        );
      }

      // VERBATIM RESULT under the old gate (296.0 is not < 200, so the
      // condition is false): the stream is never read, and
      // paceDisagreement stays null — permanently, for every activity whose
      // metadata pace is >= 200 sec/km, no matter what the comparator or
      // threshold does.
      expect(oldGateStreamReadAttempted).toBe(false);
      expect(oldGatePaceDisagreement).toBeNull();

      // Contrast: the SAME fixture, read unconditionally (what Task 1
      // shipped and the test above proves), DOES compute a non-null
      // paceDisagreement. The only difference between "never reachable" and
      // "correctly badged" is whether the gate stands.
    });

    it('the stream is read exactly once per activity across a full row assembly — a regression re-adding a second gated read would otherwise be invisible', async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['single-read'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 53,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);
      await writeActivity('single-read', { distance: 1000, moving_time: 296 });
      await writeStream('single-read', makeFlaggedStream());

      const readJsonSpy = vi.spyOn(FileStore.prototype, 'readJson');
      try {
        await computeDashboardIndex(baseOptions());

        const streamPath = path.join(tmpDir, 'streams', 'single-read.json');
        const streamReadCalls = readJsonSpy.mock.calls.filter(([calledPath]) => calledPath === streamPath);
        expect(streamReadCalls).toHaveLength(1);
      } finally {
        readJsonSpy.mockRestore();
      }
    });

    it('an activity with entry.available === false yields runningPace: null (the "no stream at all" state, never "not computable")', async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['no-stream-at-all'] = { available: false, reason: 'manual' };
      await writeManifest(manifest);
      await writeActivity('no-stream-at-all');

      const doc = await computeDashboardIndex(baseOptions());
      expect(doc.activities[0].runningPace).toBeNull();
    });

    it('a stream present but failing validateStreamSeries yields a POPULATED runningPace with computable: false, a non-empty reason, and runningPaceSecPerKm: null — never null and never a fabricated zero', async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['unusable-stream'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 1,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);
      await writeActivity('unusable-stream', { distance: 1000, moving_time: 296 });
      // A single-sample stream fails validateStreamSeries (fewer than 2
      // samples) — classifyGapsWithSegments' own pass 1 rejects it.
      await writeStream('unusable-stream', makeStream({ t: [0], d: [0] }));

      const doc = await computeDashboardIndex(baseOptions());
      const rp = doc.activities[0].runningPace;
      expect(rp).not.toBeNull();
      expect(rp?.computable).toBe(false);
      expect(typeof rp?.notComputableReason).toBe('string');
      expect(rp?.notComputableReason?.length).toBeGreaterThan(0);
      expect(rp?.runningPaceSecPerKm).toBeNull();
    });

    it("criterion 4 guard: each fixture's row.paceSecPerKm is byte-identical to an INDEPENDENTLY computed moving_time / (distance / 1000) — never derived from, or perturbed by, the writer's own running-pace or disagreement computation", async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['guard1'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 53,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      manifest.activities['guard2'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 53,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);
      await writeActivity('guard1', { distance: 1000, moving_time: 296 });
      await writeActivity('guard2', { distance: 7500, moving_time: 2222 });
      await writeStream('guard1', makeFlaggedStream());
      await writeStream('guard2', makeMirrorStream());

      const doc = await computeDashboardIndex(baseOptions());
      const byId = Object.fromEntries(doc.activities.map((r) => [r.id, r]));

      // Independent — computed here from the raw activity fields alone,
      // never by reading row.runningPace or row.paceDisagreement.
      const independentPaceSecPerKm = (distanceM: number, movingTimeSec: number): number =>
        Math.round((movingTimeSec / (distanceM / 1000)) * 10) / 10;

      expect(byId['guard1'].paceSecPerKm).toBe(independentPaceSecPerKm(1000, 296));
      expect(byId['guard2'].paceSecPerKm).toBe(independentPaceSecPerKm(7500, 2222));
    });
  });
});

/**
 * RPACE-03/D-01/D-14: the metadata-vs-running-pace disagreement cross-check,
 * measured against the REAL committed archive (`data/activities/*.json` +
 * `data/streams/{id}.json`), not the tmpDir fixtures above — this is the
 * same archive-wide sweep discipline `pace-derivation.test.ts` uses for
 * `classifyGaps`. Re-verify at execution time (the archive grows nightly);
 * do not trust these numbers blindly. This is the phase's ONE archive-
 * reading location for `detectPaceDisagreement` reachability — every bound
 * and figure below is PARSED from `35-CALIBRATION.md` / `35-RUNNING-PACE-
 * RECOUNT.md` at test time, never re-pinned as a new literal (T-35-41).
 *
 * Disposition rule: a mismatch against the parsed bound is a genuine
 * finding — either the archive moved since the artifact was rendered
 * (re-run the generator) or the comparator diverged from the calibration
 * (a real regression) — never a reason to loosen this assertion.
 */
describe('pace disagreement', () => {
  const ACTIVITIES_DIR = 'data/activities';
  const STREAMS_DIR = 'data/streams';
  const CALIBRATION_PATH = path.join(
    '.planning',
    'phases',
    '35-stream-derived-running-pace',
    '35-CALIBRATION.md'
  );
  const RECOUNT_PATH = path.join(
    '.planning',
    'phases',
    '35-stream-derived-running-pace',
    '35-RUNNING-PACE-RECOUNT.md'
  );

  function metadataPaceSecPerKm(activity: StravaActivity): number | null {
    const distanceM = activity.distance;
    const movingTimeSec = activity.moving_time;
    return distanceM > 0 && movingTimeSec > 0 ? movingTimeSec / (distanceM / 1000) : null;
  }

  /** Mirrors `list.ts`'s `formatPace` locally (RECOUNT.md's own "local duplicate" convention) — this is analytics-layer, and importing dashboard view code here would cross a layering boundary this suite otherwise never crosses. */
  function formatPaceLocal(secPerKm: number): string {
    const totalSeconds = Math.round(secPerKm);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}/km`;
  }

  async function readCalibration(): Promise<string> {
    return fs.readFile(CALIBRATION_PATH, 'utf-8');
  }

  async function readRecount(): Promise<string> {
    return fs.readFile(RECOUNT_PATH, 'utf-8');
  }

  /** Parses "Newly-disputed count under the chosen cut (population E): <n>" from 35-CALIBRATION.md § Gates. */
  async function parsedArchiveWideFlaggedCount(): Promise<number> {
    const artifact = await readCalibration();
    const match = /Newly-disputed count under the chosen cut \(population E\): (\d+)/.exec(
      artifact
    );
    if (match === null) {
      throw new Error(
        `Expected a "Newly-disputed count under the chosen cut (population E): <n>" line in ` +
          `${CALIBRATION_PATH} — a re-run of the generator landing on its own HALT branch is the ` +
          'likely cause; never skip, never silently pass.'
      );
    }
    return Number(match[1]);
  }

  /** Parses the § Gates "Named activity" table's `status` column (badged / not badged) for one activity id. */
  async function parsedBadgedStatus(activityId: string): Promise<'badged' | 'not badged'> {
    const artifact = await readCalibration();
    const rowPattern = new RegExp(
      `\\|\\s*${activityId}\\s*\\|[^|]*\\|[^|]*\\|[^|]*\\|[^|]*\\|\\s*(badged|not badged)\\s*\\|`
    );
    const match = rowPattern.exec(artifact);
    if (match === null) {
      throw new Error(
        `Expected a "| ${activityId} | ... | badged|not badged |" row in ${CALIBRATION_PATH}'s ` +
          '§ Gates Named activity table — never skip, never silently pass.'
      );
    }
    return match[1] as 'badged' | 'not badged';
  }

  /** Parses 5059204779's "Running pace" column value (the parenthesised sec/km figure) from 35-RUNNING-PACE-RECOUNT.md. */
  async function parsedRecountRunningPaceSecPerKm(activityId: string): Promise<number> {
    const artifact = await readRecount();
    const rowPattern = new RegExp(
      `\\|\\s*${activityId}\\s*\\|[^|]*\\|[^|]*\\|[^|]*\\|[^|]*\\|[^|]*\\|[^(]*\\(([0-9.]+)\\)\\s*\\|`
    );
    const match = rowPattern.exec(artifact);
    if (match === null) {
      throw new Error(
        `Expected a "| ${activityId} | ... (<secPerKm>) |" row in ${RECOUNT_PATH} — never skip, ` +
          'never silently pass.'
      );
    }
    return Number(match[1]);
  }

  it('flags EXACTLY the archive-wide count parsed from 35-CALIBRATION.md § Gates (population E, D-02 eligibility gate)', async () => {
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
        stream !== null
          ? detectPaceDisagreement(metadataPaceSecPerKm(activity), deriveRunningPace(stream))
          : null;
      if (result !== null) flagged.push(id);
    }

    console.log(
      `pace disagreement sweep: scanned ${scanned} activities, flagged ${flagged.length} (${flagged.join(', ')})`
    );

    const expectedCount = await parsedArchiveWideFlaggedCount();

    // Phase 36 gap closure (`.planning/debug/36-recount-isolated-jump.md`, bucket Q; detector fix
    // in `unreliable-segments.ts`'s `extendThroughTrailingStall`): 35-CALIBRATION.md's parsed count
    // (125) was rendered against the PRE-fix detector, which false-flagged a quantized-stream
    // catch-up lump immediately followed by a stall as `isolated-jump` on these two activities —
    // excluding real covered distance from `deriveRunningPace`'s denominator and pushing their
    // derived running pace far enough from metadata pace to clear `PACE_DISAGREEMENT_RUNNING_RATIO`.
    // Post-fix, both windows are correctly recognised as reliable, their running pace moves back
    // into agreement, and they stop being flagged — a diagnosed, one-time, EXPLAINED two-activity
    // delta, not comparator drift and not a real regression. Verified: re-running the full sweep
    // against the pre-fix detector (git-committed `unreliable-segments.ts` as of `f5e72aa8`)
    // reproduces 35-CALIBRATION.md's 125 exactly, and the only set difference between the two runs
    // is these two ids. `35-CALIBRATION.md` itself (and the `PACE_DISAGREEMENT_RUNNING_RATIO`
    // constant it calibrates) is NOT regenerated here — re-deriving that archive-wide ratio
    // statistic is a separate, heavier recalibration decision, out of this gap-closure's scope.
    const PHASE_36_GAP_CLOSURE_NO_LONGER_FLAGGED = ['14675028146', '4598855187'];
    for (const id of PHASE_36_GAP_CLOSURE_NO_LONGER_FLAGGED) {
      expect(
        flagged,
        `${id}: expected to no longer be flagged post Phase-36-gap-closure (was flagged under the ` +
          'pre-fix detector per 35-CALIBRATION.md) — see .planning/debug/36-recount-isolated-jump.md'
      ).not.toContain(id);
    }

    expect(scanned).toBeGreaterThanOrEqual(1890);
    expect(
      flagged.length,
      `flagged.length (${flagged.length}) !== 35-CALIBRATION.md's parsed archive-wide count ` +
        `(${expectedCount}) minus the ${PHASE_36_GAP_CLOSURE_NO_LONGER_FLAGGED.length} diagnosed ` +
        'Phase 36 gap-closure exceptions above. A further mismatch most likely means the nightly ' +
        "archive moved since 35-CALIBRATION.md was rendered — re-run 35-07's generator (idempotent, " +
        'content-addressed to `rev-parse HEAD:data/streams`) and recommit the artifact. A mismatch ' +
        'of tens means the comparator has diverged from the calibration — the failure this row ' +
        'exists to catch. Never widen or soften this assertion to make it pass.'
    ).toBe(expectedCount - PHASE_36_GAP_CLOSURE_NO_LONGER_FLAGGED.length);
    // Reads and derives pace over the whole ~1,890-activity archive, which lands
    // just under vitest's 5s default and fails intermittently on a busy machine.
    // The budget is generous on purpose — this guards the assertions above, not
    // the sweep's runtime.
  }, 60_000);

  it.each(['3475724402', '3475734189', '3475740390', '5059204779'])(
    "%s's badged status matches 35-CALIBRATION.md § Gates' Named activity table (parsed, not pinned)",
    async (activityId) => {
      const activity = JSON.parse(
        await fs.readFile(path.join(ACTIVITIES_DIR, `${activityId}.json`), 'utf-8')
      ) as StravaActivity;
      const stream = JSON.parse(
        await fs.readFile(path.join(STREAMS_DIR, `${activityId}.json`), 'utf-8')
      ) as CanonicalStream;

      const result = detectPaceDisagreement(
        metadataPaceSecPerKm(activity),
        deriveRunningPace(stream)
      );
      const expectedStatus = await parsedBadgedStatus(activityId);
      expect(result !== null ? 'badged' : 'not badged').toBe(expectedStatus);
    }
  );

  it("the four named activities are not all badged — 35-CALIBRATION.md § Gates reports at least one 'not badged' (3475740390), so this sweep genuinely exercises both directions", async () => {
    const artifact = await readCalibration();
    const statuses = ['3475724402', '3475734189', '3475740390', '5059204779'];
    const results = await Promise.all(statuses.map((id) => parsedBadgedStatus(id)));
    expect(results).toContain('not badged');
    // Guards the guard: if a future recalibration badges all four, this test
    // fails loudly instead of silently certifying a vacuous "both directions"
    // claim — per this row's own acceptance criteria, a future reader must
    // add an explicit not-badged control from the artifact's gate-excluded
    // population instead of deleting this check.
    void artifact;
  });

  it("5059204779's running pace is parsed from 35-RUNNING-PACE-RECOUNT.md (within the already-disclosed traversal-shape/boundary divergence), never a new hardcoded literal — the exact string UI-SPEC's browser checkpoint row 3 reads back on screen", async () => {
    const activity = JSON.parse(
      await fs.readFile(path.join(ACTIVITIES_DIR, '5059204779.json'), 'utf-8')
    ) as StravaActivity;
    const stream = JSON.parse(
      await fs.readFile(path.join(STREAMS_DIR, '5059204779.json'), 'utf-8')
    ) as CanonicalStream;

    const result = detectPaceDisagreement(
      metadataPaceSecPerKm(activity),
      deriveRunningPace(stream)
    );

    expect(result).not.toBeNull();
    expect(result?.metadataPaceSecPerKm).toBe(112.6);

    const recountPace = await parsedRecountRunningPaceSecPerKm('5059204779');
    // 35-07-SUMMARY.md's own reconciliation table names this activity's
    // production-vs-recount gap as an EXPLAINED DIVERGENCE ("traversal-
    // shape/boundary", a 2-second coveredSec difference only) — production
    // measures 355.8, the independent recount measures 356. Asserting exact
    // equality here would either falsely fail (dishonestly) or require
    // silently widening the comparator to match the recount (a behaviour
    // change this plan does not make) — so this assertion is a small,
    // explicitly-bounded tolerance around the PARSED recount figure, not a
    // second hardcoded literal: 1 sec/km comfortably covers the disclosed
    // 0.2 sec/km gap while still failing on any materially different figure.
    expect(Math.abs((result?.runningPaceSecPerKm as number) - recountPace)).toBeLessThanOrEqual(1);

    // What actually matters for UI-SPEC's browser checkpoint row 3 is the
    // ON-SCREEN STRING a reader sees — and both the production figure and
    // the independently-recounted figure round to the SAME displayed
    // "5:56/km", despite differing at the one-decimal level. This is the
    // assertion the checkpoint itself depends on.
    expect(formatPaceLocal(result?.runningPaceSecPerKm as number)).toBe(
      formatPaceLocal(recountPace)
    );
  });

  it("negative case 7 (permanent, D-02 gate): forcing 5059204779's own real RunningPace's excludedM to 0 returns null, proving the eligibility gate itself produces the flag — the unmodified object (real excludedM=166) returns non-null, so this negative case is not vacuous in the other direction", async () => {
    const activity = JSON.parse(
      await fs.readFile(path.join(ACTIVITIES_DIR, '5059204779.json'), 'utf-8')
    ) as StravaActivity;
    const stream = JSON.parse(
      await fs.readFile(path.join(STREAMS_DIR, '5059204779.json'), 'utf-8')
    ) as CanonicalStream;
    const pace = metadataPaceSecPerKm(activity);
    const runningPace = deriveRunningPace(stream);
    expect(runningPace.excludedM).toBeGreaterThan(0);

    const gatedOff = { ...runningPace, excludedM: 0 };
    const disabled = detectPaceDisagreement(pace, gatedOff);
    expect(disabled).toBeNull();

    // Fails-in-both-directions check: the unmodified (real) RunningPace must
    // return non-null on this same activity, or this negative case would be
    // vacuous (unfailable in the other direction).
    const enabled = detectPaceDisagreement(pace, runningPace);
    expect(enabled).not.toBeNull();
  });
});
