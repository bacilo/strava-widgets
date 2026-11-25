import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { Decoder, Encoder, Profile, Stream } from '@garmin/fitsdk';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FileStore } from '../storage/file-store.js';
import { IntervalsSync } from '../sync/intervals-sync.js';
import { deriveFromSamples } from '../streams/derive-stream.js';
import { diffDataTree, snapshotDataTree, type DataTreeSnapshot } from '../test-support/data-write-guard.js';
import { fitRecordsToSamples } from './geometry-readers.js';
import { importFit, MAX_FIT_BYTES } from './fit-import.js';
import { NEAR_MATCH_TOLERANCE_S } from './reconcile.js';

/**
 * No test here may write to the real data/ tree: every directory is a mkdtemp
 * path. The guard is snapshot-relative (CI dirties data/geo before tests run),
 * so it holds whether or not data/ was already dirty.
 */
let dataBefore: DataTreeSnapshot;
beforeAll(() => {
  dataBefore = snapshotDataTree();
});
afterAll(() => {
  expect(diffDataTree(dataBefore, snapshotDataTree())).toEqual([]);
});

const FIT_EPOCH_OFFSET_S = 631065600;
const START = new Date('2026-11-18T06:30:00Z');

interface BuildOpts {
  sessions?: number;
  sport?: string;
  startTime?: Date;
  localOffsetS?: number;
  productName?: string;
  timeCreatedOffsetS?: number;
  geometry?: 'ok' | 'bad';
}

function buildFit(o: BuildOpts = {}): Buffer {
  const start = o.startTime ?? START;
  const enc = new Encoder();
  enc.onMesg(Profile.MesgNum.FILE_ID, {
    type: 'activity',
    manufacturer: 'garmin',
    product: 1,
    timeCreated: new Date(start.getTime() + (o.timeCreatedOffsetS ?? 0) * 1000),
  });
  if (o.productName) {
    enc.onMesg(Profile.MesgNum.DEVICE_INFO, {
      timestamp: start,
      deviceIndex: 'creator',
      productName: o.productName,
    });
  }
  for (let i = 0; i < 30; i++) {
    const rec: Record<string, unknown> = {
      timestamp: new Date(start.getTime() + i * 50_000),
      heartRate: 140 + i,
      cadence: 80,
      distance: (i * 5000) / 29,
      altitude: 20 + (i % 5),
    };
    // 5 km of northward track at ~172 m per step; the 'bad' track barely moves.
    const stepDeg = o.geometry === 'bad' ? 0.00001 : 5000 / 29 / 111_195;
    rec.positionLat = Math.round(((55.7 + i * stepDeg) * 2 ** 31) / 180);
    rec.positionLong = Math.round((12.5 * 2 ** 31) / 180);
    enc.onMesg(Profile.MesgNum.RECORD, rec);
  }
  for (let s = 0; s < (o.sessions ?? 1); s++) {
    enc.onMesg(Profile.MesgNum.SESSION, {
      timestamp: new Date(start.getTime() + 1500_000),
      startTime: start,
      sport: o.sport ?? 'running',
      totalDistance: 5000,
      totalTimerTime: 1500.4,
      totalElapsedTime: 1530.6,
      totalAscent: 12,
      avgHeartRate: 150,
      maxHeartRate: 170,
    });
  }
  const ts = new Date(start.getTime() + 1500_000);
  enc.onMesg(Profile.MesgNum.ACTIVITY, {
    timestamp: ts,
    numSessions: o.sessions ?? 1,
    type: 'manual',
    localTimestamp:
      Math.floor(ts.getTime() / 1000) - FIT_EPOCH_OFFSET_S + (o.localOffsetS ?? 3600),
  });
  return Buffer.from(enc.close());
}

let tmp: string;
let dirs: {
  exportRoot: string;
  activitiesDir: string;
  streamsDir: string;
  manifestPath: string;
  provenancePath: string;
};

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fit-import-'));
  dirs = {
    exportRoot: path.join(tmp, 'export'),
    activitiesDir: path.join(tmp, 'activities'),
    streamsDir: path.join(tmp, 'streams'),
    manifestPath: path.join(tmp, 'streams', 'manifest.json'),
    provenancePath: path.join(tmp, 'provenance.json'),
  };
  fs.mkdirSync(path.join(dirs.exportRoot, 'garmin'), { recursive: true });
  fs.mkdirSync(dirs.activitiesDir, { recursive: true });
});

afterEach(async () => {
  await fsp.rm(tmp, { recursive: true, force: true });
});

function place(name: string, bytes: Buffer, source = 'garmin'): string {
  const p = path.join(dirs.exportRoot, source, name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, bytes);
  return p;
}

function run(fitPath: string, garminId = '12345678901', extra: Record<string, unknown> = {}) {
  return importFit({ fitPath, garminId, source: 'garmin', ...dirs, ...extra });
}

function counts() {
  const n = (d: string) => (fs.existsSync(d) ? fs.readdirSync(d).length : 0);
  return {
    activities: n(dirs.activitiesDir),
    streams: n(dirs.streamsDir),
    provenance: fs.existsSync(dirs.provenancePath) ? 1 : 0,
  };
}

function seedArchive(id: string, startDate: string, extra: Record<string, unknown> = {}) {
  fs.writeFileSync(
    path.join(dirs.activitiesDir, `${id}.json`),
    JSON.stringify({ id, start_date: startDate, ...extra })
  );
}

describe('fixture builder self-test', () => {
  it('round-trips through the real Decoder', () => {
    const d = new Decoder(Stream.fromBuffer(buildFit({ productName: 'Forerunner 965' })));
    expect(d.isFIT()).toBe(true);
    expect(d.checkIntegrity()).toBe(true);
    const { messages } = d.read();
    expect((messages.sessionMesgs as unknown[]).length).toBe(1);
    expect((messages.recordMesgs as unknown[]).length).toBe(30);
    expect((messages.sessionMesgs as { startTime: Date }[])[0].startTime.toISOString()).toBe(
      '2026-11-18T06:30:00.000Z'
    );
  });
});

describe('importFit', () => {
  it('imports a single running FIT into all four sinks', async () => {
    const fit = place('x.fit', buildFit());
    const result = await run(fit);
    expect(result.status).toBe('imported');
    if (result.status !== 'imported') return;
    expect(result.id).toBe('12345678901');

    const rec = JSON.parse(fs.readFileSync(path.join(dirs.activitiesDir, '12345678901.json'), 'utf-8'));
    expect(rec).toMatchObject({
      id: 12345678901,
      type: 'Run',
      start_date: '2026-11-18T06:30:00Z',
      start_date_local: '2026-11-18T07:30:00',
      distance: 5000,
      moving_time: 1500,
      elapsed_time: 1531,
      total_elevation_gain: 12,
      source_provider: 'garmin-export',
      garmin_activity_id: '12345678901',
      external_id: 'x.fit',
      original_file: 'garmin:x.fit',
      field_origin: 'fit-session',
    });
    expect('device_name' in rec).toBe(false);
    expect(rec.map.summary_polyline.length).toBeGreaterThan(0);
    expect(Array.isArray(rec.start_latlng)).toBe(true);

    const decoded = new Decoder(Stream.fromBuffer(fs.readFileSync(fit))).read();
    const expected = deriveFromSamples(
      '12345678901',
      fitRecordsToSamples(decoded.messages.recordMesgs ?? []),
      'fit'
    );
    const stream = JSON.parse(fs.readFileSync(path.join(dirs.streamsDir, '12345678901.json'), 'utf-8'));
    expect(expected).not.toBeNull();
    expect(stream.sampleCount).toBe(expected!.sampleCount);
    expect(result.streamSampleCount).toBe(expected!.sampleCount);

    const manifest = JSON.parse(fs.readFileSync(dirs.manifestPath, 'utf-8'));
    expect(manifest.activities['12345678901']).toMatchObject({ available: true, source: 'fit' });

    const prov = JSON.parse(fs.readFileSync(dirs.provenancePath, 'utf-8'));
    expect(prov.activities['12345678901']).toEqual({ matched_by: 'imported', original: 'garmin:x.fit' });
  });

  it('keeps other provenance entries and honours --name', async () => {
    fs.writeFileSync(
      dirs.provenancePath,
      JSON.stringify({ note: 'keep', activities: { '7': { matched_by: 'strava_id' } } })
    );
    await run(place('x.fit', buildFit()), '12345678901', { name: 'Morning Run' });
    const prov = JSON.parse(fs.readFileSync(dirs.provenancePath, 'utf-8'));
    expect(prov.note).toBe('keep');
    expect(prov.activities['7']).toEqual({ matched_by: 'strava_id' });
    const rec = JSON.parse(fs.readFileSync(path.join(dirs.activitiesDir, '12345678901.json'), 'utf-8'));
    expect(rec.name).toBe('Morning Run');
  });

  it('reads a gzipped FIT and records the relative original path', async () => {
    const fit = place('sub/y.fit.gz', gzipSync(buildFit()));
    const result = await run(fit);
    expect(result.status).toBe('imported');
    const prov = JSON.parse(fs.readFileSync(dirs.provenancePath, 'utf-8'));
    expect(prov.activities['12345678901'].original).toBe('garmin:sub/y.fit.gz');
  });

  it('dedupes on session.startTime, not fileId.timeCreated (+2 s apart)', async () => {
    seedArchive('i999', '2026-11-18T06:30:00Z');
    const before = counts();
    const result = await run(place('x.fit', buildFit({ timeCreatedOffsetS: 2 })));
    expect(result).toEqual({ status: 'duplicate', existingId: 'i999', startDate: '2026-11-18T06:30:00Z' });
    expect(counts()).toEqual(before);
  });

  it('refuses a near-match (60 s) with nothing written', async () => {
    seedArchive('i999', '2026-11-18T06:31:00Z');
    const before = counts();
    await expect(run(place('x.fit', buildFit()))).rejects.toThrow(/near-match/);
    expect(counts()).toEqual(before);
    expect(NEAR_MATCH_TOLERANCE_S).toBeGreaterThanOrEqual(60);
  });

  it('refuses an id collision by filename, record id, and garmin_activity_id', async () => {
    seedArchive('12345678901', '2026-01-01T00:00:00Z');
    await expect(run(place('x.fit', buildFit()))).rejects.toThrow(/collision/);
    fs.rmSync(path.join(dirs.activitiesDir, '12345678901.json'));

    seedArchive('i1', '2026-01-01T00:00:00Z', { id: 12345678901 });
    await expect(run(place('x.fit', buildFit()))).rejects.toThrow(/collision/);
    fs.rmSync(path.join(dirs.activitiesDir, 'i1.json'));

    seedArchive('i2', '2026-01-01T00:00:00Z', { garmin_activity_id: '12345678901' });
    const before = counts();
    await expect(run(place('x.fit', buildFit()))).rejects.toThrow(/collision/);
    expect(counts()).toEqual(before);
  });

  it.each(['g123', '../1', ''])('refuses invalid garmin id %j', async id => {
    await expect(run(place('x.fit', buildFit()), id)).rejects.toThrow(/invalid garmin id/);
    expect(counts().activities).toBe(0);
  });

  it('refuses multi-session, non-running, non-FIT, bad-integrity and oversized files', async () => {
    await expect(run(place('a.fit', buildFit({ sessions: 2 })))).rejects.toThrow(/exactly one session/);
    await expect(run(place('b.fit', buildFit({ sport: 'cycling' })))).rejects.toThrow(/not a running activity/);
    await expect(run(place('c.fit', Buffer.from('definitely not a fit file at all')))).rejects.toThrow(
      /not a FIT file/
    );
    const good = buildFit();
    const corrupt = Buffer.from(good);
    corrupt[corrupt.length - 1] ^= 0xff;
    corrupt[corrupt.length - 2] ^= 0xff;
    await expect(run(place('d.fit', corrupt))).rejects.toThrow(/integrity/);

    const big = path.join(dirs.exportRoot, 'garmin', 'big.fit');
    const fd = fs.openSync(big, 'w');
    fs.ftruncateSync(fd, MAX_FIT_BYTES + 1);
    fs.closeSync(fd);
    await expect(run(big)).rejects.toThrow(/too large/);

    expect(counts()).toEqual({ activities: 0, streams: 0, provenance: 0 });
  });

  it('refuses a path outside <exportRoot>/<source>/', async () => {
    const outside = path.join(tmp, 'elsewhere.fit');
    fs.writeFileSync(outside, buildFit());
    await expect(run(outside)).rejects.toThrow(/outside export root/);
    const otherSource = place('z.fit', buildFit(), 'strava');
    await expect(run(otherSource)).rejects.toThrow(/outside export root/);
    // Traversal through a symlink is caught by realpath.
    const link = path.join(dirs.exportRoot, 'garmin', 'link.fit');
    fs.symlinkSync(outside, link);
    await expect(run(link)).rejects.toThrow(/outside export root/);
    expect(counts().activities).toBe(0);
  });

  it('copies only the creator productName as device_name', async () => {
    await run(place('x.fit', buildFit({ productName: 'Forerunner 965' })));
    const rec = JSON.parse(fs.readFileSync(path.join(dirs.activitiesDir, '12345678901.json'), 'utf-8'));
    expect(rec.device_name).toBe('Forerunner 965');
    expect(JSON.stringify(rec)).not.toMatch(/serial/i);
  });

  it('imports without a route when geometry validation fails', async () => {
    const result = await run(place('x.fit', buildFit({ geometry: 'bad' })));
    expect(result.status).toBe('imported');
    const rec = JSON.parse(fs.readFileSync(path.join(dirs.activitiesDir, '12345678901.json'), 'utf-8'));
    expect(rec.map.summary_polyline).toBe('');
    expect('start_latlng' in rec).toBe(false);
  });

  it('uses a negative local offset correctly', async () => {
    await run(place('x.fit', buildFit({ localOffsetS: -18000 })));
    const rec = JSON.parse(fs.readFileSync(path.join(dirs.activitiesDir, '12345678901.json'), 'utf-8'));
    expect(rec.start_date_local).toBe('2026-11-18T01:30:00');
  });
});

describe('importFit then IntervalsSync (nightly dedupe)', () => {
  function intervalsPayload(startDate: string) {
    const raw = {
      id: 'i5001',
      type: 'Run',
      name: 'Nightly',
      start_date: startDate,
      start_date_local: startDate.replace('Z', ''),
      distance: 5000,
      moving_time: 1500,
      stream_types: ['time', 'distance'],
    };
    const client = {
      async getActivities() {
        return [raw];
      },
      async getStreams() {
        return [];
      },
      async getAllStreams() {
        return [];
      },
    };
    const manager = {
      async load() {
        return { last_sync_timestamp: 0, last_activity_id: '', total_activities: 0, last_sync_date: '' };
      },
      async save() {},
    };
    return new IntervalsSync({
      client: client as never,
      fileStore: new FileStore('/'),
      syncStateManager: manager as never,
      activitiesDir: dirs.activitiesDir,
      streamsDir: dirs.streamsDir,
      streamsManifestPath: dirs.manifestPath,
    });
  }

  it('same start_date creates no second record (newRuns 0)', async () => {
    await run(place('x.fit', buildFit()));
    expect(fs.readdirSync(dirs.activitiesDir)).toHaveLength(1);
    const res = await intervalsPayload('2026-11-18T06:30:00Z').syncNewActivities();
    expect(res.newRuns).toBe(0);
    expect(fs.readdirSync(dirs.activitiesDir)).toHaveLength(1);
  });

  it('CAN-FAIL: start_date shifted by 1 s does create a record', async () => {
    await run(place('x.fit', buildFit()));
    const res = await intervalsPayload('2026-11-18T06:30:01Z').syncNewActivities();
    expect(res.newRuns).toBe(1);
    expect(fs.readdirSync(dirs.activitiesDir)).toHaveLength(2);
  });
});
