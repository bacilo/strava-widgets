import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileStore } from '../storage/file-store.js';
import { SyncStateManager } from '../storage/sync-state.js';
import { emptyManifest, saveManifest, upsertUnavailable } from '../streams/stream-manifest.js';
import { IntervalsSync } from './intervals-sync.js';

/**
 * First test suite for this module. Its whole point is catching the bug this
 * plan corrects — a filtered `getStreams` request silently drops HR/cadence/
 * altitude before the request is even made — so the fake client below MUST
 * honor `types` the way the live API does. A fake that ignores `types` and
 * returns everything makes these tests pass against the broken
 * implementation, which is the specific failure mode being guarded against.
 */

const FULL_STREAMS_PAYLOAD: Record<string, unknown>[] = [
  {
    type: 'latlng',
    data: [55.70, 55.701, 55.702, 55.703, 55.704],
    data2: [12.50, 12.501, 12.502, 12.503, 12.504],
  },
  { type: 'time', data: [0, 10, 20, 30, 40] },
  { type: 'distance', data: [0, 120, 250, 380, 510] },
  { type: 'heartrate', data: [120, 125, 130, 128, 126] },
  { type: 'cadence', data: [80, 82, 81, 83, 80] },
  { type: 'altitude', data: [10, 11, 12, 11, 10] },
];

// Matches the haversine distance of the latlng points above closely enough
// for validateGeometry to pass — not load-bearing for stream persistence
// (which runs independent of geometry validation), but keeps the fixture
// realistic.
const RAW_ACTIVITY = {
  id: 'i1001',
  type: 'Run',
  name: 'Test Run',
  start_date: '2026-08-01T06:00:00Z',
  start_date_local: '2026-08-01T08:00:00',
  distance: 510,
  moving_time: 40,
  stream_types: ['latlng', 'time', 'distance', 'heartrate', 'cadence', 'altitude'],
};

/**
 * Filtering-faithful fake client. `getStreams` narrows its response to
 * `types` exactly like the live API's `?types=` query does; `getAllStreams`
 * ignores type entirely, matching the unfiltered endpoint.
 */
function makeFakeClient(
  payload: Record<string, unknown>[] | 'throw',
  activities: Record<string, unknown>[] = [RAW_ACTIVITY]
) {
  const getStreamsCalls: string[][] = [];
  const state = { getAllStreamsCalls: 0 };
  const client = {
    async getActivities(_params: { oldest?: string; newest?: string }) {
      return activities;
    },
    async getStreams(_activityId: string, types: string[]) {
      getStreamsCalls.push(types);
      if (payload === 'throw') throw new Error('simulated streams failure');
      return payload.filter(s => types.includes(s.type as string));
    },
    async getAllStreams(_activityId: string) {
      state.getAllStreamsCalls++;
      if (payload === 'throw') throw new Error('simulated streams failure');
      return payload;
    },
  };
  return { client, getStreamsCalls, state };
}

function makeFakeSyncStateManager() {
  const saveCalls: unknown[] = [];
  return {
    manager: {
      async load() {
        return {
          last_sync_timestamp: 0,
          last_activity_id: '',
          total_activities: 0,
          last_sync_date: '',
        };
      },
      async save(state: unknown) {
        saveCalls.push(state);
      },
    },
    saveCalls,
  };
}

describe('IntervalsSync.syncNewActivities — stream persistence', () => {
  let tmpDir: string;
  let fileStore: FileStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intervals-sync-'));
    fileStore = new FileStore(tmpDir);
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  function buildSync(payload: Record<string, unknown>[] | 'throw') {
    const { client, getStreamsCalls, state } = makeFakeClient(payload);
    const { manager } = makeFakeSyncStateManager();
    const sync = new IntervalsSync({
      client: client as never,
      fileStore,
      syncStateManager: manager as never,
      activitiesDir: 'activities',
      streamsDir: 'streams',
      streamsManifestPath: 'streams/manifest.json',
    });
    return { sync, getStreamsCalls, state };
  }

  it('a newly-synced activity gets a stream file in the same canonical format the backfill produces', async () => {
    const { sync } = buildSync(FULL_STREAMS_PAYLOAD);
    await sync.syncNewActivities();

    const streamPath = path.join(tmpDir, 'streams', 'i1001.json');
    expect(fs.existsSync(streamPath)).toBe(true);
    const stream = JSON.parse(fs.readFileSync(streamPath, 'utf-8'));
    expect(stream.schemaVersion).toBe(1);
    expect(Array.isArray(stream.t)).toBe(true);
  });

  it('regression guard: the persisted stream carries hr, cadence and elevation channels — fails if the request is ever narrowed back to coordinates', async () => {
    const { sync } = buildSync(FULL_STREAMS_PAYLOAD);
    await sync.syncNewActivities();

    const streamPath = path.join(tmpDir, 'streams', 'i1001.json');
    const stream = JSON.parse(fs.readFileSync(streamPath, 'utf-8'));
    expect(stream.channels.hr).toBe(true);
    expect(stream.channels.cadence).toBe(true);
    expect(stream.channels.elevation).toBe(true);
  });

  it('anti-pattern guard: persisting streams must not double the daily API load — exactly one unfiltered request, zero filtered ones', async () => {
    const { sync, getStreamsCalls, state } = buildSync(FULL_STREAMS_PAYLOAD);
    await sync.syncNewActivities();

    expect(getStreamsCalls.length).toBe(0);
    expect(state.getAllStreamsCalls).toBe(1);
  });

  it('writes a manifest entry with available:true and a channels object', async () => {
    const { sync } = buildSync(FULL_STREAMS_PAYLOAD);
    await sync.syncNewActivities();

    const manifestPath = path.join(tmpDir, 'streams', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.activities['i1001']).toMatchObject({ available: true });
    expect(manifest.activities['i1001'].channels).toBeTruthy();
  });

  it('a stream failure must not lose the activity: an empty payload still writes the activity, flagged no-samples in the manifest', async () => {
    const { sync } = buildSync([]);
    await sync.syncNewActivities();

    const activityPath = path.join(tmpDir, 'activities', 'i1001.json');
    expect(fs.existsSync(activityPath)).toBe(true);

    const manifestPath = path.join(tmpDir, 'streams', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.activities['i1001']).toEqual({ available: false, reason: 'no-samples' });
  });

  it('syncNewActivities resolves (does not reject) when the client throws; the activity is still written and a manifest entry exists', async () => {
    const { sync } = buildSync('throw');

    await expect(sync.syncNewActivities()).resolves.toBeDefined();

    const activityPath = path.join(tmpDir, 'activities', 'i1001.json');
    expect(fs.existsSync(activityPath)).toBe(true);

    const manifestPath = path.join(tmpDir, 'streams', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.activities['i1001']).toEqual({ available: false, reason: 'no-samples' });
  });
});

describe('IntervalsSync.syncNewActivities - near-match dedupe (ING-05)', () => {
  const E = '2026-08-01T06:00:00Z';
  let tmpDir: string;
  let fileStore: FileStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intervals-near-'));
    fileStore = new FileStore(tmpDir);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  function seed(id: string, startDate: string, extra: Record<string, unknown> = {}) {
    fs.mkdirSync(path.join(tmpDir, 'activities'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'activities', `${id}.json`),
      JSON.stringify({ id, start_date: startDate, ...extra })
    );
  }

  function at(offsetS: number): string {
    return new Date(Date.parse(E) + offsetS * 1000).toISOString().replace('.000Z', 'Z');
  }

  function delivery(id: string, startDate: string) {
    return { ...RAW_ACTIVITY, id, start_date: startDate };
  }

  function build(activities: Record<string, unknown>[]) {
    const { client, state } = makeFakeClient(FULL_STREAMS_PAYLOAD, activities);
    const { manager, saveCalls } = makeFakeSyncStateManager();
    const sync = new IntervalsSync({
      client: client as never,
      fileStore,
      syncStateManager: manager as never,
      activitiesDir: 'activities',
      streamsDir: 'streams',
      streamsManifestPath: 'streams/manifest.json',
    });
    return { sync, state, saveCalls };
  }

  function nearLogLines(): string[] {
    return (console.log as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .map(c => String(c[0]))
      .filter(l => l.includes('near-match skip'));
  }

  it('skips and reports a delivery 60 s from a hand-seeded FIT-imported record, writing nothing', async () => {
    seed('25000000001', E, { source_provider: 'garmin-export' });
    const m = emptyManifest();
    upsertUnavailable(m, '25000000001', 'no-samples');
    await saveManifest(fileStore, 'streams/manifest.json', m);
    const manifestPath = path.join(tmpDir, 'streams', 'manifest.json');
    const before = fs.readFileSync(manifestPath);

    const { sync, state, saveCalls } = build([delivery('i2001', at(60))]);
    const res = await sync.syncNewActivities();

    expect(res.newRuns).toBe(0);
    expect(fs.existsSync(path.join(tmpDir, 'activities', 'i2001.json'))).toBe(false);
    expect(state.getAllStreamsCalls).toBe(0);
    // WR-05: the skip is now persisted (assertion changed from 0 saves to 1; the
    // manifest-unchanged and no-activity-file guards below are untouched).
    expect(saveCalls).toHaveLength(1);
    expect(saveCalls[0]).toMatchObject({
      last_sync_timestamp: 0,
      last_activity_id: '',
      total_activities: 0,
      near_match_skips: {
        i2001: { existingId: '25000000001', deltaS: 60, startDate: at(60) },
      },
    });
    expect(fs.readFileSync(manifestPath)).toEqual(before);
    expect(res.nearMatches).toEqual([
      { intervalsId: 'i2001', existingId: '25000000001', deltaS: 60, startDate: at(60) },
    ]);
  });

  it.each([
    ['intervals', { source_provider: 'intervals' }],
    ['Strava-origin (no source_provider)', {}],
    ['strava-export', { source_provider: 'strava-export' }],
  ])('writes a delivery 1 s from a %s record', async (_label, extra) => {
    seed('30000000001', E, extra);
    const { sync } = build([delivery('i2002', at(1))]);
    const res = await sync.syncNewActivities();
    expect(res.newRuns).toBe(1);
    expect(fs.existsSync(path.join(tmpDir, 'activities', 'i2002.json'))).toBe(true);
    expect(nearLogLines()).toHaveLength(0);
  });

  it('writes both of two deliveries 60 s apart in one batch when no FIT record exists', async () => {
    const { sync } = build([delivery('i2001', at(0)), delivery('i2002', at(60))]);
    const res = await sync.syncNewActivities();
    expect(res.newRuns).toBe(2);
    expect(fs.existsSync(path.join(tmpDir, 'activities', 'i2001.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'activities', 'i2002.json'))).toBe(true);
  });

  it('an exact match on a non-FIT record wins over a near FIT record (no near report)', async () => {
    // Order-dependent: the delivery is exact on the intervals record AND 30 s
    // from the FIT record, so it is reported near only if the near check runs first.
    seed('i3000', at(30));
    seed('25000000001', E, { source_provider: 'garmin-export' });
    const { sync } = build([delivery('i2001', at(30))]);
    const res = await sync.syncNewActivities();
    expect(res.newRuns).toBe(0);
    expect(res.skipped).toBe(1);
    expect(res.nearMatches).toEqual([]);
    expect(nearLogLines()).toHaveLength(0);
    expect(fs.existsSync(path.join(tmpDir, 'activities', 'i2001.json'))).toBe(false);
  });

  it('skips an exact-start duplicate of a FIT-imported record without reporting a near match', async () => {
    seed('25000000001', E, { source_provider: 'garmin-export' });
    const { sync } = build([delivery('i2001', E)]);
    const res = await sync.syncNewActivities();
    expect(res.newRuns).toBe(0);
    expect(res.skipped).toBe(1);
    expect(fs.existsSync(path.join(tmpDir, 'activities', 'i2001.json'))).toBe(false);
    expect(nearLogLines()).toHaveLength(0);
  });
});

describe('IntervalsSync near-match skips persist in sync-state (WR-05)', () => {
  const E = '2026-08-01T06:00:00Z';
  const STATE_FILE = 'sync-state.json';
  const LEGACY = {
    last_sync_timestamp: 1785560000,
    last_activity_id: 'i1999',
    total_activities: 7,
    last_sync_date: '2026-08-01T05:00:00.000Z',
  };
  const SKIP_I2001 = {
    existingId: '25000000001',
    deltaS: 60,
    startDate: '2026-08-01T06:01:00Z',
    firstSeen: '2026-11-26T12:00:00.000Z',
  };
  let tmpDir: string;
  let fileStore: FileStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intervals-wr05-'));
    fileStore = new FileStore(tmpDir);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-26T12:00:00.000Z'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  function seedFit() {
    fs.mkdirSync(path.join(tmpDir, 'activities'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'activities', '25000000001.json'),
      JSON.stringify({ id: '25000000001', start_date: E, source_provider: 'garmin-export' })
    );
  }

  function writeState(obj: unknown) {
    fs.writeFileSync(path.join(tmpDir, STATE_FILE), JSON.stringify(obj, null, 2));
  }

  function readState(): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(tmpDir, STATE_FILE), 'utf-8'));
  }

  function run(deliveries: Record<string, unknown>[]) {
    const { client } = makeFakeClient(FULL_STREAMS_PAYLOAD, deliveries);
    const sync = new IntervalsSync({
      client: client as never,
      fileStore,
      syncStateManager: new SyncStateManager(STATE_FILE, fileStore),
      activitiesDir: 'activities',
      streamsDir: 'streams',
      streamsManifestPath: 'streams/manifest.json',
    });
    return sync.syncNewActivities();
  }

  const d = (id: string, startDate: string) => ({ ...RAW_ACTIVITY, id, start_date: startDate });
  const AT_60 = '2026-08-01T06:01:00Z';
  const AT_3600 = '2026-08-01T07:00:00Z';
  const AT_7200 = '2026-08-01T08:00:00Z';

  it('Row A: a skip recorded earlier in a run survives a later per-activity save', async () => {
    seedFit();
    const res = await run([d('i2003', AT_3600), d('i2001', AT_60)]);
    expect(res.newRuns).toBe(1);
    const onDisk = readState();
    expect(onDisk.near_match_skips).toEqual({ i2001: SKIP_I2001 });
    expect(onDisk.last_sync_timestamp).toBe(1785567600);
    expect(onDisk.last_activity_id).toBe('i2003');
  });

  it('Row B: a skip-only run persists the skip and leaves the watermark fields unchanged', async () => {
    seedFit();
    writeState(LEGACY);
    const res = await run([d('i2001', AT_60)]);
    expect(res.newRuns).toBe(0);
    expect(fs.existsSync(path.join(tmpDir, 'activities', 'i2001.json'))).toBe(false);
    expect(readState()).toEqual({ ...LEGACY, near_match_skips: { i2001: SKIP_I2001 } });
  });

  it('Row C: re-seeing the same skip keeps firstSeen and leaves the file byte-identical', async () => {
    seedFit();
    writeState(LEGACY);
    await run([d('i2001', AT_60)]);
    const bytes1 = fs.readFileSync(path.join(tmpDir, STATE_FILE));
    vi.setSystemTime(new Date('2026-11-27T12:00:00.000Z'));
    await run([d('i2001', AT_60)]);
    const bytes2 = fs.readFileSync(path.join(tmpDir, STATE_FILE));
    expect((readState().near_match_skips as Record<string, { firstSeen: string }>).i2001.firstSeen).toBe(
      '2026-11-26T12:00:00.000Z'
    );
    expect(bytes2.equals(bytes1)).toBe(true);
  });

  it('Row D: a pre-existing entry keeps its firstSeen and a later write does not drop it', async () => {
    seedFit();
    writeState({
      ...LEGACY,
      near_match_skips: { i2001: { ...SKIP_I2001, firstSeen: '2026-01-01T00:00:00.000Z' } },
    });
    const res = await run([d('i2003', AT_3600), d('i2001', AT_60)]);
    expect(res.newRuns).toBe(1);
    expect(fs.existsSync(path.join(tmpDir, 'activities', 'i2003.json'))).toBe(true);
    const skips = readState().near_match_skips as Record<string, { firstSeen: string }>;
    expect(skips.i2001.firstSeen).toBe('2026-01-01T00:00:00.000Z');
  });

  it('Row E: a legacy file with no skips loads, syncs, and stays free of near_match_skips', async () => {
    writeState(LEGACY);
    const res = await run([d('i2002', AT_7200)]);
    expect(res.newRuns).toBe(1);
    expect(Object.keys(readState())).not.toContain('near_match_skips');
  });
});
