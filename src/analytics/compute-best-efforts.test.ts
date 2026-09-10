import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FileStore } from '../storage/file-store.js';
import type { StreamManifest } from '../streams/stream.types.js';
import { ceilingDemotion, deriveCeilings } from './best-effort-ceiling.js';
import { TARGET_ORDER } from './best-effort.types.js';
import type { CeilingDerivation, TargetDistanceKey } from './best-effort.types.js';
import {
  computeActivityEfforts,
  computeBestEfforts,
  type ActivityEffortInput,
} from './compute-best-efforts.js';

/** Builds a synthetic constant-pace series: `count` samples, `metersPerSec` m/s, 1s spacing. */
function constantPaceSeries(count: number, metersPerSec: number): { t: number[]; d: number[] } {
  const t: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < count; i++) {
    t.push(i);
    d.push(round1(i * metersPerSec));
  }
  return { t, d };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function baseInput(overrides: Partial<ActivityEffortInput> = {}): ActivityEffortInput {
  const { t, d } = constantPaceSeries(2000, 3); // 3 m/s ~ 5:33/km, well under any world record
  return {
    activityId: 'a1',
    startDate: '2026-01-01T00:00:00Z',
    activityDistanceM: d[d.length - 1],
    maxSpeedMps: undefined,
    distanceSource: 'native',
    t,
    d,
    ...overrides,
  };
}

describe('computeActivityEfforts — pre-filter', () => {
  it('an activity with distance 1500m (under the 1mi 0.99 threshold) yields no 1mi/5k/10k/half/marathon entries, eligibleTargets count is 2', () => {
    // 1mi * 0.99 = 1593.25m — 1500m falls just short, isolating 400m/1k as the
    // only eligible targets (D-01's own formula, verbatim from <action>).
    const input = baseInput({ activityDistanceM: 1500 });
    const result = computeActivityEfforts(input);
    expect(result.eligibleTargets).toEqual(['400m', '1k']);
    expect(result.eligibleTargets.length).toBe(2);
  });

  it('an activity with distance 4960m IS eligible for 5k (4960 >= 5000 * 0.99)', () => {
    const input = baseInput({ activityDistanceM: 4960 });
    const result = computeActivityEfforts(input);
    expect(result.eligibleTargets).toContain('5k');
  });

  it('an activity with distance 4950m (just under the 0.99 margin) is NOT eligible for 5k', () => {
    const input = baseInput({ activityDistanceM: 4949 });
    const result = computeActivityEfforts(input);
    expect(result.eligibleTargets).not.toContain('5k');
  });

  it('efforts are ordered by TARGET_ORDER, ascending distance, regardless of computation order', () => {
    const { t, d } = constantPaceSeries(6000, 3);
    const input = baseInput({ activityDistanceM: d[d.length - 1], t, d });
    const result = computeActivityEfforts(input);
    const distances = result.efforts.map((e) => e.distance);
    const sorted = [...distances].sort(
      (a, b) =>
        ['400m', '1k', '1mi', '5k', '10k', 'half', 'marathon'].indexOf(a) -
        ['400m', '1k', '1mi', '5k', '10k', 'half', 'marathon'].indexOf(b)
    );
    expect(distances).toEqual(sorted);
  });
});

describe('computeActivityEfforts — lowConfidence', () => {
  it('lowConfidence is true on every effort when distanceSource is geo', () => {
    const input = baseInput({ activityDistanceM: 3000, distanceSource: 'geo' });
    const result = computeActivityEfforts(input);
    expect(result.efforts.length).toBeGreaterThan(0);
    expect(result.efforts.every((e) => e.lowConfidence === true)).toBe(true);
  });

  it('lowConfidence is false on every effort when distanceSource is native', () => {
    const input = baseInput({ activityDistanceM: 3000, distanceSource: 'native' });
    const result = computeActivityEfforts(input);
    expect(result.efforts.length).toBeGreaterThan(0);
    expect(result.efforts.every((e) => e.lowConfidence === false)).toBe(true);
  });
});

describe('computeActivityEfforts — per-target isolation', () => {
  it('a 400m window implying a world-record-beating speed is rejected while 1k/5k survive', () => {
    // First 400m covered in 20s -> implied 20 m/s, beats the ~9.30 m/s 400m world-record ceiling.
    // Remainder of the series runs at a normal 3 m/s.
    const t: number[] = [];
    const d: number[] = [];
    t.push(0);
    d.push(0);
    t.push(20);
    d.push(400);
    // Continue at 3 m/s for the rest of a 6km run.
    let time = 20;
    let dist = 400;
    while (dist < 6000) {
      time += 1;
      dist = round1(dist + 3);
      t.push(time);
      d.push(dist);
    }

    const input = baseInput({ activityDistanceM: dist, t, d });
    const result = computeActivityEfforts(input);

    const distances = result.efforts.map((e) => e.distance);
    expect(distances).toContain('1k');
    expect(distances).toContain('5k');
    expect(result.rejected.length).toBe(1);
    expect(result.rejected[0].distance).toBe('400m');
  });

  it("a rejected effort's reason is the verbatim string produced by isPlausible, containing the offending numbers", () => {
    const t: number[] = [0, 20];
    const d: number[] = [0, 400];
    // Extend so activity is at least eligible for 400m only, single window test.
    const input = baseInput({ activityDistanceM: 400, t, d });
    const result = computeActivityEfforts(input);
    expect(result.rejected.length).toBe(1);
    expect(result.rejected[0].reason).toMatch(/exceeds world-record pace/);
    expect(result.rejected[0].reason).toMatch(/m\/s/);
  });

  it('max_speed of 0 does not suppress efforts — the activity still returns its plausible distances', () => {
    const input = baseInput({ activityDistanceM: 3000, maxSpeedMps: 0 });
    const result = computeActivityEfforts(input);
    expect(result.efforts.length).toBeGreaterThan(0);
  });

  it('max_speed of undefined does not suppress efforts — the activity still returns its plausible distances', () => {
    const input = baseInput({ activityDistanceM: 3000, maxSpeedMps: undefined });
    const result = computeActivityEfforts(input);
    expect(result.efforts.length).toBeGreaterThan(0);
  });
});

describe('computeActivityEfforts — malformed series', () => {
  it('a length-mismatched series returns zero efforts, zero rejected rows, and a populated seriesError', () => {
    const input = baseInput({ t: [0, 1, 2], d: [0, 3] });
    const result = computeActivityEfforts(input);
    expect(result.efforts).toEqual([]);
    expect(result.rejected).toEqual([]);
    expect(result.eligibleTargets).toEqual([]);
    expect(result.seriesError).toBeDefined();
    expect(result.seriesError).toMatch(/length mismatch/);
  });

  it('a non-finite entry returns zero efforts and a populated seriesError', () => {
    const input = baseInput({ t: [0, 1, 2], d: [0, NaN, 6] });
    const result = computeActivityEfforts(input);
    expect(result.efforts).toEqual([]);
    expect(result.seriesError).toBeDefined();
  });

  it('a decreasing distance array returns zero efforts and a populated seriesError', () => {
    const input = baseInput({ t: [0, 1, 2], d: [0, 6, 3] });
    const result = computeActivityEfforts(input);
    expect(result.efforts).toEqual([]);
    expect(result.seriesError).toBeDefined();
    expect(result.seriesError).toMatch(/decreases/);
  });
});

describe('computeActivityEfforts — rounding and pace consistency', () => {
  it('paceSecPerKm is consistent with durationSec: a 1k effort of 300.0s has paceSecPerKm 300.0', () => {
    const t: number[] = [0, 300];
    const d: number[] = [0, 1000];
    const input = baseInput({ activityDistanceM: 1000, t, d });
    const result = computeActivityEfforts(input);
    const oneK = result.efforts.find((e) => e.distance === '1k');
    expect(oneK).toBeDefined();
    expect(oneK!.durationSec).toBe(300.0);
    expect(oneK!.paceSecPerKm).toBe(300.0);
  });

  it('durationSec, paceSecPerKm and endOffsetSec are rounded to at most one decimal place', () => {
    const t: number[] = [0, 333];
    const d: number[] = [0, 1000];
    const input = baseInput({ activityDistanceM: 1000, t, d });
    const result = computeActivityEfforts(input);
    const oneK = result.efforts.find((e) => e.distance === '1k');
    expect(oneK).toBeDefined();
    const isRoundedTo1Decimal = (n: number) => Math.round(n * 10) === n * 10;
    expect(isRoundedTo1Decimal(oneK!.durationSec)).toBe(true);
    expect(isRoundedTo1Decimal(oneK!.paceSecPerKm)).toBe(true);
    expect(isRoundedTo1Decimal(oneK!.endOffsetSec)).toBe(true);
  });
});

describe('computeBestEfforts — archive orchestration', () => {
  let tmpDir: string;
  let fileStore: FileStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'best-efforts-'));
    fileStore = new FileStore(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  /** A constant-pace (t, d) series long enough to yield a 1k effort. */
  function series(durationForOneKm: number): { t: number[]; d: number[] } {
    // Two-sample series is enough for findBestEffort's interpolation.
    return { t: [0, durationForOneKm], d: [0, 1000] };
  }

  async function writeActivity(
    id: string,
    startDate: string,
    distance = 1000,
    maxSpeed: number | undefined = undefined
  ): Promise<void> {
    await fileStore.writeJson(path.join('activities', `${id}.json`), {
      id,
      type: 'Run',
      start_date: startDate,
      start_date_local: startDate,
      distance,
      moving_time: 300,
      max_speed: maxSpeed,
    });
  }

  async function writeStream(
    id: string,
    durationForOneKm: number,
    distanceSourceOverride?: 'native' | 'geo'
  ): Promise<void> {
    const { t, d } = series(durationForOneKm);
    await fileStore.writeJson(path.join('streams', `${id}.json`), {
      schemaVersion: 1,
      id,
      source: 'fit',
      distanceSource: distanceSourceOverride ?? 'native',
      sampleCount: t.length,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      t,
      d,
    });
  }

  async function writeManifest(manifest: StreamManifest): Promise<void> {
    await fileStore.writeJson('streams/manifest.json', manifest);
  }

  function emptyManifestDoc(): StreamManifest {
    return {
      schemaVersion: 1,
      generated_at: '',
      note: 'test manifest',
      totals: { activities: 0, with_streams: 0, without_streams: 0, by_reason: {} },
      activities: {},
    };
  }

  it('manifest-driven: reads exactly the available entries and reports skippedNoStream for unavailable ones, ignoring extra unlisted stream files', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['a2'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['a3'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['a4'] = { available: false, reason: 'manual' };
    manifest.activities['a5'] = { available: false, reason: 'no-original' };
    await writeManifest(manifest);

    await writeActivity('a1', '2026-01-01T00:00:00Z');
    await writeStream('a1', 300);
    await writeActivity('a2', '2026-02-01T00:00:00Z');
    await writeStream('a2', 280);
    await writeActivity('a3', '2026-03-01T00:00:00Z');
    await writeStream('a3', 290);

    // Extra unlisted stream file — must be ignored (manifest is the source of truth).
    await writeStream('unlisted', 999);

    const doc = await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
    });

    expect(doc.totals.skippedNoStream).toBe(2);
    // activitiesConsidered excludes skippedNoStream entries — it counts only
    // activities for which computation was actually attempted (3 available),
    // not the full manifest size (5).
    expect(doc.totals.activitiesConsidered).toBe(3);
    expect(Object.keys(doc.activities).sort()).toEqual(['a1', 'a2', 'a3']);
  });

  it('a corrupt stream file warns, increments skippedUnreadable, and does not abort the run — other activities still produce efforts', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['good'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['corrupt'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);

    await writeActivity('good', '2026-01-01T00:00:00Z');
    await writeStream('good', 300);

    await writeActivity('corrupt', '2026-01-01T00:00:00Z');
    // Deliberately corrupt (invalid JSON) stream file.
    await fs.mkdir(path.join(tmpDir, 'streams'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'streams', 'corrupt.json'), '{ not valid json', 'utf-8');

    const doc = await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
    });

    expect(doc.totals.skippedUnreadable).toBe(1);
    expect(doc.activities['good']).toBeDefined();
    expect(doc.activities['good'].efforts.length).toBeGreaterThan(0);
    expect(doc.activities['corrupt']).toBeUndefined();
  });

  it('an available entry whose activity record is missing under activitiesDir warns and increments skippedUnreadable', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['noactivity'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeStream('noactivity', 300);
    // Deliberately no activities/noactivity.json written.

    const doc = await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
    });

    expect(doc.totals.skippedUnreadable).toBe(1);
  });

  it('rankings contains one key per TargetDistanceKey, sorted fastest-first with 1-based rank, empty for unreached distances', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['fast'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['slow'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);

    await writeActivity('fast', '2026-01-01T00:00:00Z');
    await writeStream('fast', 250); // faster 1k
    await writeActivity('slow', '2026-01-02T00:00:00Z');
    await writeStream('slow', 300); // slower 1k

    const doc = await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
    });

    for (const key of ['400m', '1k', '1mi', '5k', '10k', 'half', 'marathon']) {
      expect(doc.rankings[key as keyof typeof doc.rankings]).toBeDefined();
    }
    // Neither stream is long enough for 5k+ — those rankings must be empty.
    expect(doc.rankings['5k']).toEqual([]);
    expect(doc.rankings.marathon).toEqual([]);

    expect(doc.rankings['1k'][0].activityId).toBe('fast');
    expect(doc.rankings['1k'][0].rank).toBe(1);
    expect(doc.rankings['1k'][1].activityId).toBe('slow');
    expect(doc.rankings['1k'][1].rank).toBe(2);
  });

  it('wasPRAtTheTime is true on the chronologically first effort and each improvement, false on a slower later effort', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['first'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['improved'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['slower'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);

    await writeActivity('first', '2026-01-01T00:00:00Z');
    await writeStream('first', 300);
    await writeActivity('improved', '2026-02-01T00:00:00Z');
    await writeStream('improved', 280); // faster — new PR
    await writeActivity('slower', '2026-03-01T00:00:00Z');
    await writeStream('slower', 320); // slower — not a PR

    const doc = await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
    });

    const firstEffort = doc.activities['first'].efforts.find((e) => e.distance === '1k');
    const improvedEffort = doc.activities['improved'].efforts.find((e) => e.distance === '1k');
    const slowerEffort = doc.activities['slower'].efforts.find((e) => e.distance === '1k');

    expect(firstEffort?.wasPRAtTheTime).toBe(true);
    expect(improvedEffort?.wasPRAtTheTime).toBe(true);
    expect(slowerEffort?.wasPRAtTheTime).toBe(false);
  });

  it("a geo-sourced activity's effort appears in rankings with lowConfidence true — not filtered out of PR contention", async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['geoact'] = {
      available: true,
      source: 'gpx',
      distanceSource: 'geo',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('geoact', '2026-01-01T00:00:00Z');
    await writeStream('geoact', 300, 'geo');

    const doc = await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
    });

    expect(doc.rankings['1k'].length).toBe(1);
    expect(doc.rankings['1k'][0].activityId).toBe('geoact');
    expect(doc.rankings['1k'][0].lowConfidence).toBe(true);
  });

  it('a world-record-guard rejection is retained and flagged, not deleted: rejected row AND a demoted effort with guard/reason set', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['implausible'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('implausible', '2026-01-01T00:00:00Z', 1000);
    // First 400m in 5s implies 80 m/s (implausible, beats the world-record
    // ceiling); the remaining 600m over 295s is a normal ~2 m/s pace, so the
    // 1k window (which spans the whole series) is plausible. Only the fastest
    // (minimum-duration) 400m window is implausible — the 1k effort survives.
    await fileStore.writeJson(path.join('streams', 'implausible.json'), {
      schemaVersion: 1,
      id: 'implausible',
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 3,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      t: [0, 5, 300],
      d: [0, 400, 1000],
    });

    const doc = await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
    });

    // The `rejected` row still exists — it is the archive-wide report of
    // which guard fired, not evidence the effort was deleted.
    expect(doc.rejected.length).toBe(1);
    expect(doc.rejected[0]).toMatchObject({ activityId: 'implausible', distance: '400m' });
    expect(doc.rejected[0].reason).toMatch(/exceeds world-record pace/);

    // D-08: the effort is RETAINED in activities[id].efforts, not removed —
    // this is the assertion the old test inverted (it used to assert the
    // 400m effort was ABSENT).
    const demoted400m = doc.activities['implausible'].efforts.find((e) => e.distance === '400m');
    expect(demoted400m).toBeDefined();
    expect(demoted400m!.demotion).not.toBeNull();
    expect(demoted400m!.demotion!.guard).toBe('world-record');
    expect(demoted400m!.demotion!.reason).toMatch(/exceeds world-record pace/);

    // The plausible 1k effort survives untouched.
    const oneK = doc.activities['implausible'].efforts.find((e) => e.distance === '1k');
    expect(oneK).toBeDefined();
    expect(oneK!.demotion).toBeNull();
  });

  it('a max-speed-guard rejection is also retained and flagged with guard "max-speed"', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['maxspeed-implausible'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    // max_speed 3 m/s means the max-speed guard (3 * 1.02 = 3.06 m/s) fires
    // well before the 400m world-record ceiling (~9.30 m/s) would — this
    // isolates the max-speed branch specifically.
    await writeActivity('maxspeed-implausible', '2026-01-01T00:00:00Z', 1000, 3);
    await fileStore.writeJson(path.join('streams', 'maxspeed-implausible.json'), {
      schemaVersion: 1,
      id: 'maxspeed-implausible',
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 3,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      // First 400m in 80s implies 5 m/s — exceeds max_speed*1.02 (3.06 m/s)
      // but not the 400m world-record ceiling. Remaining 600m over 220s
      // (~2.7 m/s) keeps the whole-series 1k window under the max_speed
      // margin too.
      t: [0, 80, 300],
      d: [0, 400, 1000],
    });

    const doc = await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
    });

    const demoted400m = doc.activities['maxspeed-implausible'].efforts.find(
      (e) => e.distance === '400m'
    );
    expect(demoted400m).toBeDefined();
    expect(demoted400m!.demotion).not.toBeNull();
    expect(demoted400m!.demotion!.guard).toBe('max-speed');
    expect(demoted400m!.demotion!.reason).toMatch(/exceeds activity max_speed/);
  });

  describe('demoted efforts remain in the efforts array', () => {
    /**
     * Walks `doc.rejected`, and for every row whose reason is not an
     * `unexpected error:` row (those have no corresponding effort — the
     * computation itself threw), asserts a matching `(activityId, distance)`
     * effort exists in `doc.activities[activityId].efforts` with a non-null
     * `demotion`. Returns the list of violations rather than asserting
     * directly, so the SAME helper can be run against both a correct
     * document (expecting zero violations) and a deliberately-mutated one
     * (expecting a violation per demoted effort removed) — a one-directional
     * audit is not evidence.
     */
    function auditNoDemotedEffortRemoved(doc: {
      rejected: { activityId: string; distance: string; reason: string }[];
      activities: Record<string, { efforts: { distance: string; demotion: unknown }[] }>;
    }): string[] {
      const violations: string[] = [];
      for (const row of doc.rejected) {
        if (row.reason.startsWith('unexpected error:')) continue;
        const activity = doc.activities[row.activityId];
        const effort = activity?.efforts.find((e) => e.distance === row.distance);
        if (!effort || effort.demotion == null) {
          violations.push(`${row.activityId} ${row.distance}: no retained, flagged effort found`);
        }
      }
      return violations;
    }

    it('returns zero violations against the freshly computed document, and at least one violation against a delete-mutated copy', async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['implausible'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);
      await writeActivity('implausible', '2026-01-01T00:00:00Z', 1000);
      await fileStore.writeJson(path.join('streams', 'implausible.json'), {
        schemaVersion: 1,
        id: 'implausible',
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 3,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        t: [0, 5, 300],
        d: [0, 400, 1000],
      });

      const doc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats'),
      });

      // Direction 1: the audit passes against the correct, freshly computed document.
      expect(auditNoDemotedEffortRemoved(doc)).toEqual([]);

      // Direction 2: demonstrate the audit failing. Build a mutated copy of
      // the same document with every demoted effort spliced OUT of its
      // efforts array — the literal "mutated to delete instead of flag"
      // state ROADMAP criterion 4 names — and assert the audit returns a
      // violation for each.
      const mutated = structuredClone(doc);
      for (const activity of Object.values(mutated.activities)) {
        activity.efforts = activity.efforts.filter((e) => e.demotion == null);
      }
      const violations = auditNoDemotedEffortRemoved(mutated);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.length).toBe(mutated.rejected.filter((r) => !r.reason.startsWith('unexpected error:')).length);
    });
  });

  describe('4556693525', () => {
    it('a personal-ceiling-exceeding 400m effort is demoted (guard: "ceiling"), pinned at durationSec 45.2 — not deleted', async () => {
      // D-04: the live pipeline computes 45.2s / 8.85 m/s for activity
      // 4556693525's 400m effort. PR-05 and the original ROADMAP Criterion 3
      // both state 44.0s / 9.09 m/s — that figure matches no record in the
      // live archive and was corrected to 45.2s / 8.85 m/s on 2026-09-10 per
      // D-04; pinning the wrong (44.0/9.09) value would produce a test that
      // fails on day one for the wrong reason. Note: this test is deferred
      // from Task 1 (which introduced this describe block's original slot)
      // into Task 2's commit, since it requires the ceiling mechanism Task 2
      // wires in — see this plan's SUMMARY.md Deviations section.
      const manifest = emptyManifestDoc();

      const BULK_COUNT = 150;
      const bulkIds: string[] = [];
      for (let i = 0; i < BULK_COUNT; i++) {
        const id = `bulk-${i}`;
        bulkIds.push(id);
        manifest.activities[id] = {
          available: true,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        };
      }
      manifest.activities['4556693525'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 3,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);

      // Bulk 400m population: 150 ordinary efforts, speeds spanning
      // 3.00-4.11 m/s so the nearest-rank p90 lands near the live
      // calibration's 400m figure (~4.00 m/s, ceiling ~5.11 m/s — see
      // 28-CEILING-CALIBRATION.md "Resulting coverage and demotions"),
      // clearing CEILING_MIN_POPULATION (100).
      for (let i = 0; i < BULK_COUNT; i++) {
        const speed = 3.0 + (i / (BULK_COUNT - 1)) * 1.112;
        const durationSec = round1(400 / speed);
        await writeActivity(bulkIds[i], '2020-01-01T00:00:00Z', 400);
        await fileStore.writeJson(path.join('streams', `${bulkIds[i]}.json`), {
          schemaVersion: 1,
          id: bulkIds[i],
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
          t: [0, durationSec],
          d: [0, 400],
        });
      }

      // The pinned activity: 400m in 45.2s (8.85 m/s implied) plus an
      // ordinary 1k effort. max_speed 16.4 means the max-speed guard does
      // NOT fire (16.4 * 1.02 clears 8.85 easily) — only the personal
      // ceiling demotes this effort.
      await writeActivity('4556693525', '2026-01-01T00:00:00Z', 1000, 16.4);
      await fileStore.writeJson(path.join('streams', '4556693525.json'), {
        schemaVersion: 1,
        id: '4556693525',
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 3,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        t: [0, 45.2, 225.4],
        d: [0, 400, 1000],
      });

      const doc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats'),
        // Explicit non-existent path (deliberately NOT the default
        // relative 'data/best-effort-exclusions.json'): the real committed
        // exclusions file already excludes this exact activity id for an
        // unrelated reason ("bad measurement"), which would silently
        // remove it from `byDistance` before the ceiling ever saw it — a
        // reachability trap this test must not fall into. `loadExclusions`
        // degrades a missing file to an empty index (T-16-EX-01).
        exclusionsPath: path.join(tmpDir, 'no-such-exclusions.json'),
      });

      // Sanity: the personal ceiling was actually derived (not fail-open)
      // at 400m, confirming the bulk population cleared
      // CEILING_MIN_POPULATION, and it sits well below 8.85 m/s.
      expect(doc.ceilings['400m'].ceilingMps).not.toBeNull();
      expect(doc.ceilings['400m'].ceilingMps!).toBeLessThan(8.85);

      const effort400m = doc.activities['4556693525'].efforts.find((e) => e.distance === '400m');
      expect(effort400m).toBeDefined();
      expect(effort400m!.durationSec).toBe(45.2);
      expect(effort400m!.demotion).not.toBeNull();
      expect(effort400m!.demotion!.guard).toBe('ceiling');

      // The ordinary 1k effort is untouched.
      const effort1k = doc.activities['4556693525'].efforts.find((e) => e.distance === '1k');
      expect(effort1k).toBeDefined();
      expect(effort1k!.demotion).toBeNull();
    });
  });

  it('totals are internally consistent: effortsComputed and lowConfidenceEfforts match the activities data', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['x1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['x2'] = {
      available: true,
      source: 'gpx',
      distanceSource: 'geo',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('x1', '2026-01-01T00:00:00Z');
    await writeStream('x1', 300);
    await writeActivity('x2', '2026-01-02T00:00:00Z');
    await writeStream('x2', 310, 'geo');

    const doc = await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
    });

    const sumEfforts = Object.values(doc.activities).reduce((sum, a) => sum + a.efforts.length, 0);
    const sumLowConfidence = Object.values(doc.activities).reduce(
      (sum, a) => sum + a.efforts.filter((e) => e.lowConfidence).length,
      0
    );
    expect(doc.totals.effortsComputed).toBe(sumEfforts);
    expect(doc.totals.lowConfidenceEfforts).toBe(sumLowConfidence);
  });

  it('writes best-efforts.json to <statsDir>, parses as JSON, with schemaVersion 1 and a non-empty ISO generatedAt', async () => {
    const manifest = emptyManifestDoc();
    await writeManifest(manifest);

    const statsDir = path.join(tmpDir, 'stats');
    await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir,
    });

    const written = await fs.readFile(path.join(statsDir, 'best-efforts.json'), 'utf-8');
    const parsed = JSON.parse(written);
    expect(parsed.schemaVersion).toBe(1);
    expect(typeof parsed.generatedAt).toBe('string');
    expect(parsed.generatedAt.length).toBeGreaterThan(0);
    expect(() => new Date(parsed.generatedAt).toISOString()).not.toThrow();
  });

  it('a run over an empty manifest writes a valid document with zero totals rather than throwing', async () => {
    const manifest = emptyManifestDoc();
    await writeManifest(manifest);

    const doc = await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
    });

    expect(doc.totals.activitiesConsidered).toBe(0);
    expect(doc.totals.effortsComputed).toBe(0);
    expect(doc.totals.skippedNoStream).toBe(0);
    expect(doc.totals.skippedUnreadable).toBe(0);
    expect(Object.keys(doc.activities)).toEqual([]);
  });

  describe('exclusions', () => {
    async function writeExclusions(
      exclusions: Array<{ activityId: string; distances: string[] | null; reason: string }>
    ): Promise<string> {
      const exclusionsPath = path.join(tmpDir, 'best-effort-exclusions.json');
      await fileStore.writeJson('best-effort-exclusions.json', {
        schemaVersion: 1,
        note: 'test',
        exclusions,
      });
      return exclusionsPath;
    }

    it('with two activities where the faster one is excluded (all distances), rankings[1k][0] is the slower, non-excluded activity', async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['fast-excluded'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      manifest.activities['slow'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);
      await writeActivity('fast-excluded', '2026-01-01T00:00:00Z');
      await writeStream('fast-excluded', 250); // faster 1k, but excluded
      await writeActivity('slow', '2026-01-02T00:00:00Z');
      await writeStream('slow', 300); // slower 1k

      const exclusionsPath = await writeExclusions([
        { activityId: 'fast-excluded', distances: null, reason: 'bad gps device' },
      ]);

      const doc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats'),
        exclusionsPath,
      });

      expect(doc.rankings['1k'][0].activityId).toBe('slow');
    });

    it('an excluded activity is still present in activities, with excludedFromRecords true on every effort and the activity, and wasPRAtTheTime false', async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['excluded-act'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);
      await writeActivity('excluded-act', '2026-01-01T00:00:00Z');
      await writeStream('excluded-act', 300);

      const exclusionsPath = await writeExclusions([
        { activityId: 'excluded-act', distances: null, reason: 'bad gps device' },
      ]);

      const doc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats'),
        exclusionsPath,
      });

      const activity = doc.activities['excluded-act'];
      expect(activity).toBeDefined();
      expect(activity.efforts.length).toBeGreaterThan(0);
      expect(activity.excludedFromRecords).toBe(true);
      for (const effort of activity.efforts) {
        expect(effort.excludedFromRecords).toBe(true);
        expect(effort.wasPRAtTheTime).toBe(false);
      }
    });

    it('totals.effortsExcluded equals the excluded activity effort count, and effortsComputed still counts them', async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['excluded-act'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      manifest.activities['normal-act'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);
      await writeActivity('excluded-act', '2026-01-01T00:00:00Z');
      await writeStream('excluded-act', 300);
      await writeActivity('normal-act', '2026-01-02T00:00:00Z');
      await writeStream('normal-act', 310);

      const exclusionsPath = await writeExclusions([
        { activityId: 'excluded-act', distances: null, reason: 'bad gps device' },
      ]);

      const doc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats'),
        exclusionsPath,
      });

      const excludedEffortCount = doc.activities['excluded-act'].efforts.length;
      expect(doc.totals.effortsExcluded).toBe(excludedEffortCount);
      const sumEfforts = Object.values(doc.activities).reduce((sum, a) => sum + a.efforts.length, 0);
      expect(doc.totals.effortsComputed).toBe(sumEfforts);
    });

    it('a per-distance exclusion removes the activity from that rankings entry but leaves it ranked elsewhere', async () => {
      // Build a series long enough for both 1k and 5k.
      const t: number[] = [0, 250, 1300];
      const d: number[] = [0, 1000, 5000];

      const manifest = emptyManifestDoc();
      manifest.activities['partial-excluded'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 3,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);

      await fileStore.writeJson(path.join('activities', 'partial-excluded.json'), {
        id: 'partial-excluded',
        type: 'Run',
        start_date: '2026-01-01T00:00:00Z',
        start_date_local: '2026-01-01T00:00:00Z',
        distance: 5000,
        moving_time: 1300,
        max_speed: undefined,
      });
      await fileStore.writeJson(path.join('streams', 'partial-excluded.json'), {
        schemaVersion: 1,
        id: 'partial-excluded',
        source: 'fit',
        distanceSource: 'native',
        sampleCount: t.length,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        t,
        d,
      });

      const exclusionsPath = await writeExclusions([
        { activityId: 'partial-excluded', distances: ['1k'], reason: 'bad gps device for 1k only' },
      ]);

      const doc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats'),
        exclusionsPath,
      });

      expect(doc.rankings['1k'].some((r) => r.activityId === 'partial-excluded')).toBe(false);
      expect(doc.rankings['5k'].some((r) => r.activityId === 'partial-excluded')).toBe(true);
    });
  });

  describe('deterministic across two runs', () => {
    /** Writes 120 clean 400m efforts plus one world-record-demoted 400m effort (and its ordinary 1k sibling), returning the activity ids in write order. */
    async function writeFixtureFiles(): Promise<string[]> {
      const bulkCount = 120;
      const ids: string[] = [];
      for (let i = 0; i < bulkCount; i++) {
        const id = `bulk-${i}`;
        ids.push(id);
        const speed = 3.0 + (i / (bulkCount - 1)) * 1.0; // 3.0-4.0 m/s
        const durationSec = round1(400 / speed);
        await writeActivity(id, '2020-01-01T00:00:00Z', 400);
        await fileStore.writeJson(path.join('streams', `${id}.json`), {
          schemaVersion: 1,
          id,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
          t: [0, durationSec],
          d: [0, 400],
        });
      }
      ids.push('implausible-det');
      await writeActivity('implausible-det', '2026-01-01T00:00:00Z', 1000);
      await fileStore.writeJson(path.join('streams', 'implausible-det.json'), {
        schemaVersion: 1,
        id: 'implausible-det',
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 3,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        t: [0, 5, 300],
        d: [0, 400, 1000],
      });
      return ids;
    }

    async function writeManifestWithOrder(ids: string[]): Promise<void> {
      const manifest = emptyManifestDoc();
      for (const id of ids) {
        manifest.activities[id] = {
          available: true,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: id === 'implausible-det' ? 3 : 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        };
      }
      await writeManifest(manifest);
    }

    /** The full `(activityId, distance) -> {demotion, wasPRAtTheTime}` projection of a document. */
    function projection(
      doc: Awaited<ReturnType<typeof computeBestEfforts>>
    ): Record<string, { demotion: unknown; wasPRAtTheTime: boolean }> {
      const result: Record<string, { demotion: unknown; wasPRAtTheTime: boolean }> = {};
      for (const [id, activity] of Object.entries(doc.activities)) {
        for (const effort of activity.efforts) {
          result[`${id}:${effort.distance}`] = {
            demotion: effort.demotion,
            wasPRAtTheTime: effort.wasPRAtTheTime,
          };
        }
      }
      return result;
    }

    it('running twice against unchanged input produces identical ceilings and an identical (activityId, distance) -> {demotion, wasPRAtTheTime} projection', async () => {
      const ids = await writeFixtureFiles();
      await writeManifestWithOrder(ids);

      const common = {
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        exclusionsPath: path.join(tmpDir, 'no-such-exclusions.json'),
      };

      const doc1 = await computeBestEfforts({ ...common, statsDir: path.join(tmpDir, 'stats1') });
      const doc2 = await computeBestEfforts({ ...common, statsDir: path.join(tmpDir, 'stats2') });

      // `generatedAt` is excluded from the comparison — it is a wall-clock
      // stamp, and criterion 1 asks for byte-identical CEILING VALUES AND
      // FLAGS, not a byte-identical file.
      expect(JSON.stringify(doc1.ceilings)).toBe(JSON.stringify(doc2.ceilings));
      expect(projection(doc1)).toEqual(projection(doc2));
    });

    it('order-independence at the orchestration level: reversed manifest entry order produces identical ceilings', async () => {
      const ids = await writeFixtureFiles();

      await writeManifestWithOrder(ids);
      const docForward = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats-forward'),
        exclusionsPath: path.join(tmpDir, 'no-such-exclusions.json'),
      });

      await writeManifestWithOrder([...ids].reverse());
      const docReversed = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats-reversed'),
        exclusionsPath: path.join(tmpDir, 'no-such-exclusions.json'),
      });

      expect(JSON.stringify(docForward.ceilings)).toBe(JSON.stringify(docReversed.ceilings));
    });
  });

  describe('no iteration to convergence', () => {
    /**
     * The WRONG variant PR-01 forbids, implemented here in the test file
     * only: calls `deriveCeilings`, removes every entry the resulting
     * ceilings demote, re-derives from the survivors, and repeats until the
     * ceilings stop moving or a fixed iteration cap is reached.
     */
    function iterateToConvergence(
      populationsByDistance: ReadonlyMap<TargetDistanceKey, readonly number[]>,
      maxIterations = 25
    ): Record<TargetDistanceKey, CeilingDerivation> {
      let current = new Map<TargetDistanceKey, readonly number[]>(populationsByDistance);
      let ceilings = deriveCeilings(current);
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        let anyRemoved = false;
        const next = new Map<TargetDistanceKey, readonly number[]>();
        for (const key of TARGET_ORDER) {
          const derivation = ceilings[key];
          const population = current.get(key) ?? [];
          const survivors = population.filter((speed) => ceilingDemotion(speed, derivation) === null);
          if (survivors.length !== population.length) anyRemoved = true;
          next.set(key, survivors);
        }
        if (!anyRemoved) break;
        current = next;
        ceilings = deriveCeilings(current);
      }
      return ceilings;
    }

    /** Clean bulk (100 @ 3.5 m/s) plus an 18-entry contaminated tail (5.0-9.0 m/s, all under the 400m world-record ceiling ~9.296 m/s) — a fixture whose 400m population carries a contaminated tail. */
    function contaminatedPopulation(): Map<TargetDistanceKey, number[]> {
      const clean = Array.from({ length: 100 }, () => 3.5);
      const contaminated = Array.from({ length: 18 }, (_, i) => 5.0 + (i / 17) * 4.0);
      const populations = new Map<TargetDistanceKey, number[]>();
      for (const key of TARGET_ORDER) {
        populations.set(key, key === '400m' ? [...clean, ...contaminated] : []);
      }
      return populations;
    }

    it('the iterated result strictly diverges from the single-pass result (lower ceiling, strictly larger demoted set at 400m), and the shipped document matches the single-pass value', async () => {
      const populations = contaminatedPopulation();

      // Divergence must be proven BEFORE anything else — if the two methods
      // ever coincide on this fixture, the fixture is too weak and must be
      // strengthened until they diverge.
      const singlePass = deriveCeilings(populations);
      const iterated = iterateToConvergence(populations);

      const singlePassCeiling = singlePass['400m'].ceilingMps;
      const iteratedCeiling = iterated['400m'].ceilingMps;
      expect(singlePassCeiling).not.toBeNull();
      expect(iteratedCeiling).not.toBeNull();
      expect(iteratedCeiling!).toBeLessThan(singlePassCeiling!);

      const population400m = populations.get('400m')!;
      const singlePassDemoted = population400m.filter(
        (speed) => ceilingDemotion(speed, singlePass['400m']) !== null
      ).length;
      const iteratedDemoted = population400m.filter(
        (speed) => ceilingDemotion(speed, iterated['400m']) !== null
      ).length;
      expect(iteratedDemoted).toBeGreaterThan(singlePassDemoted);

      // Now run the SAME population through the real archive orchestration
      // (each population entry becomes its own single-effort activity) and
      // confirm the shipped document matches the single-pass value, never
      // the iterated one.
      const manifest = emptyManifestDoc();
      const ids = population400m.map((_, i) => `pop-${i}`);
      for (const id of ids) {
        manifest.activities[id] = {
          available: true,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        };
      }
      await writeManifest(manifest);
      for (let i = 0; i < population400m.length; i++) {
        const durationSec = round1(400 / population400m[i]);
        await writeActivity(ids[i], '2020-01-01T00:00:00Z', 400);
        await fileStore.writeJson(path.join('streams', `${ids[i]}.json`), {
          schemaVersion: 1,
          id: ids[i],
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
          t: [0, durationSec],
          d: [0, 400],
        });
      }

      const doc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats'),
        exclusionsPath: path.join(tmpDir, 'no-such-exclusions.json'),
      });

      // The recomputed implied speed inside compute-best-efforts.ts derives
      // from a ROUNDED durationSec (round1), so a small tolerance is used
      // rather than bit-exact equality against our own unrounded design
      // values.
      expect(doc.ceilings['400m'].ceilingMps).not.toBeNull();
      expect(doc.ceilings['400m'].ceilingMps!).toBeCloseTo(singlePassCeiling!, 1);
      expect(
        Math.abs(doc.ceilings['400m'].ceilingMps! - iteratedCeiling!)
      ).toBeGreaterThan(0.5);
    });

    it("the production file's single deriveCeilings call site sits between the derive pass's own marker and the next pass's marker, with no enclosing loop", async () => {
      const source = await fs.readFile(
        new URL('./compute-best-efforts.ts', import.meta.url),
        'utf-8'
      );
      const pass2Index = source.indexOf('PASS 2');
      const pass3Index = source.indexOf('PASS 3');
      expect(pass2Index).toBeGreaterThan(-1);
      expect(pass3Index).toBeGreaterThan(pass2Index);

      const rawSlice = source.slice(pass2Index, pass3Index);
      const strippedSlice = rawSlice
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join('\n');
      expect(strippedSlice).toContain('deriveCeilings(');
      expect(strippedSlice).not.toMatch(/\bfor\s*\(/);
      expect(strippedSlice).not.toMatch(/\bwhile\s*\(/);
    });
  });

  describe('ceiling is non-circular', () => {
    it('the shipped ceiling matches the population filtered by the absolute guard + exclusion list, not the unfiltered raw sweep — divergence, then equality-with-filtered, then populationN equality, in that order', async () => {
      // Independent, in-test candidates over two populations that MUST
      // diverge for this fixture to mean anything:
      const CLEAN_COUNT = 100; // exactly CEILING_MIN_POPULATION once filtered
      const cleanSpeeds = Array.from({ length: CLEAN_COUNT }, () => 3.5);
      const excludedSpeed = 3.6; // ordinary pace, but excluded by activity id
      const guardFailingSpeeds = Array.from({ length: 15 }, (_, i) => 15 + (i / 14) * 9); // 15-24 m/s

      const filteredCandidate = new Map<TargetDistanceKey, number[]>();
      const unfilteredCandidate = new Map<TargetDistanceKey, number[]>();
      for (const key of TARGET_ORDER) {
        filteredCandidate.set(key, key === '400m' ? [...cleanSpeeds] : []);
        unfilteredCandidate.set(
          key,
          key === '400m' ? [...cleanSpeeds, excludedSpeed, ...guardFailingSpeeds] : []
        );
      }

      const filteredResult = deriveCeilings(filteredCandidate);
      const unfilteredResult = deriveCeilings(unfilteredCandidate);

      // 1. Divergence — the fixture actually discriminates.
      expect(filteredResult['400m'].ceilingMps).not.toBeNull();
      expect(unfilteredResult['400m'].ceilingMps).not.toBeNull();
      expect(filteredResult['400m'].ceilingMps).not.toBe(unfilteredResult['400m'].ceilingMps);

      // Build the matching real archive fixture: 100 clean 400m efforts, 15
      // guard-failing 400m efforts (world-record guard fires at 15-24 m/s,
      // well past the 400m ceiling of ~9.296 m/s), and 1 excluded 400m
      // effort at an otherwise-ordinary pace.
      const manifest = emptyManifestDoc();
      const cleanIds = cleanSpeeds.map((_, i) => `nc-clean-${i}`);
      const guardIds = guardFailingSpeeds.map((_, i) => `nc-guard-${i}`);
      const excludedId = 'nc-excluded';
      for (const id of [...cleanIds, ...guardIds, excludedId]) {
        manifest.activities[id] = {
          available: true,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        };
      }
      await writeManifest(manifest);

      async function writeSingle400m(id: string, speed: number): Promise<void> {
        const durationSec = round1(400 / speed);
        await writeActivity(id, '2020-01-01T00:00:00Z', 400);
        await fileStore.writeJson(path.join('streams', `${id}.json`), {
          schemaVersion: 1,
          id,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
          t: [0, durationSec],
          d: [0, 400],
        });
      }

      for (let i = 0; i < cleanIds.length; i++) await writeSingle400m(cleanIds[i], cleanSpeeds[i]);
      for (let i = 0; i < guardIds.length; i++) await writeSingle400m(guardIds[i], guardFailingSpeeds[i]);
      await writeSingle400m(excludedId, excludedSpeed);

      await fileStore.writeJson('nc-exclusions.json', {
        schemaVersion: 1,
        note: 'test',
        exclusions: [{ activityId: excludedId, distances: null, reason: 'non-circularity fixture' }],
      });
      const exclusionsPath = path.join(tmpDir, 'nc-exclusions.json');

      const doc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats'),
        exclusionsPath,
      });

      // 2. Equality with the FILTERED candidate, not the unfiltered one.
      expect(doc.ceilings['400m'].ceilingMps).toBeCloseTo(filteredResult['400m'].ceilingMps!, 2);
      expect(doc.ceilings['400m'].ceilingMps).not.toBeCloseTo(unfilteredResult['400m'].ceilingMps!, 0);

      // 3. `populationN` itself testifies to which population was used.
      expect(doc.ceilings['400m'].populationN).toBe(CLEAN_COUNT);
    });
  });

  it('D-02 fails open below CEILING_MIN_POPULATION: ceilings.half.ceilingMps is null with a non-null failOpenReason, and every half effort in the fixture is still ranked', async () => {
    const manifest = emptyManifestDoc();
    const ids = ['half-1', 'half-2', 'half-3'];
    for (const id of ids) {
      manifest.activities[id] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
    }
    await writeManifest(manifest);

    const halfDurations = [5000, 5100, 5200]; // ordinary half-marathon paces, well under the world record
    for (let i = 0; i < ids.length; i++) {
      await writeActivity(ids[i], `2026-0${i + 1}-01T00:00:00Z`, 21200);
      await fileStore.writeJson(path.join('streams', `${ids[i]}.json`), {
        schemaVersion: 1,
        id: ids[i],
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        t: [0, halfDurations[i]],
        d: [0, 21200],
      });
    }

    const doc = await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
      exclusionsPath: path.join(tmpDir, 'no-such-exclusions.json'),
    });

    expect(doc.ceilings.half.ceilingMps).toBeNull();
    expect(doc.ceilings.half.failOpenReason).not.toBeNull();
    expect(doc.rankings.half.length).toBe(3);
    for (const id of ids) {
      expect(doc.activities[id].efforts.find((e) => e.distance === 'half')?.demotion).toBeNull();
    }
  });
});
