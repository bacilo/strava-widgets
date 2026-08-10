import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FileStore } from '../storage/file-store.js';
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
function makeFakeClient(payload: Record<string, unknown>[] | 'throw') {
  const getStreamsCalls: string[][] = [];
  const state = { getAllStreamsCalls: 0 };
  const client = {
    async getActivities(_params: { oldest?: string; newest?: string }) {
      return [RAW_ACTIVITY];
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
