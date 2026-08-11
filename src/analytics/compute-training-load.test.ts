import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileStore } from '../storage/file-store.js';
import type { StreamManifest, StreamManifestEntry } from '../streams/stream.types.js';
import { computeTrainingLoad } from './compute-training-load.js';

/**
 * Degradation-contract suite for `computeTrainingLoad`. The numeric TRIMP
 * and CTL/ATL/TSB formulas are already covered by plan 18-03's
 * `trimp.test.ts` and `training-load.test.ts` — this suite only pins how
 * the build step reacts when its inputs are missing, partial, or broken.
 */
describe('computeTrainingLoad — degradation contract', () => {
  let tmpDir: string;
  let fileStore: FileStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'training-load-'));
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

  /** An `available: true` manifest entry with an HR channel toggle. */
  function availableEntry(hasHr: boolean): StreamManifestEntry {
    return {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: hasHr, cadence: false, elevation: false },
    };
  }

  async function writeManifest(manifest: StreamManifest): Promise<void> {
    await fileStore.writeJson('streams/manifest.json', manifest);
  }

  async function writeActivity(
    id: string,
    startDateLocal: string,
    overrides: Record<string, unknown> = {}
  ): Promise<void> {
    await fileStore.writeJson(path.join('activities', `${id}.json`), {
      id,
      type: 'Run',
      start_date: startDateLocal,
      start_date_local: startDateLocal,
      distance: 5000,
      moving_time: 1800,
      ...overrides,
    });
  }

  /** A two-sample `{t, hr}` stream. `hr` omitted entirely when `undefined`. */
  async function writeStream(id: string, t: number[], hr: number[] | undefined): Promise<void> {
    const doc: Record<string, unknown> = {
      schemaVersion: 1,
      id,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: t.length,
      channels: { time: true, distance: true, hr: hr !== undefined, cadence: false, elevation: false },
      t,
      d: t.map((x) => Math.round(x * 3 * 10) / 10),
    };
    if (hr !== undefined) doc.hr = hr;
    await fileStore.writeJson(path.join('streams', `${id}.json`), doc);
  }

  async function writeAthleteConfig(): Promise<void> {
    await fileStore.writeJson(path.join('config', 'athlete.json'), {
      schemaVersion: 1,
      maxHr: 190,
      hrZones: [
        { zone: 1, minBpm: 95, maxBpm: 123 },
        { zone: 2, minBpm: 124, maxBpm: 142 },
        { zone: 3, minBpm: 143, maxBpm: 161 },
        { zone: 4, minBpm: 162, maxBpm: 180 },
        { zone: 5, minBpm: 181, maxBpm: null },
      ],
    });
  }

  async function writePrivateConfig(overrides: Record<string, unknown> = {}): Promise<void> {
    await fileStore.writeJson(path.join('private', 'athlete-private.json'), {
      schemaVersion: 1,
      birthDate: '1990-01-01',
      sex: 'male',
      restingHr: 50,
      ...overrides,
    });
  }

  const baseOptions = () => ({
    activitiesDir: path.join(tmpDir, 'activities'),
    streamsDir: path.join(tmpDir, 'streams'),
    streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
    athleteConfigPath: path.join(tmpDir, 'config', 'athlete.json'),
    athletePrivatePath: path.join(tmpDir, 'private', 'athlete-private.json'),
    statsDir: path.join(tmpDir, 'stats'),
  });

  it('1. valid public config, no private config: edwards runs, banister disabled naming the private path, every day banister is null, no throw', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = availableEntry(true);
    await writeManifest(manifest);
    await writeActivity('a1', '2026-01-01T07:00:00Z');
    await writeStream('a1', [0, 600], [150, 150]);
    await writeAthleteConfig();
    // No private config written on purpose.

    const doc = await computeTrainingLoad(baseOptions());

    expect(doc.models.edwards).toBe(true);
    expect(doc.models.banister).toBe(false);
    expect(doc.days.length).toBeGreaterThan(0);
    expect(doc.days.every((d) => d.banister === null)).toBe(true);
    expect(doc.banisterDisabledReason).not.toBeNull();
    expect(doc.banisterDisabledReason).toContain('data/private/athlete-private.json');
  });

  it('2. valid public and private config: banister runs, days carry a non-null banister entry, and the two model series differ numerically', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = availableEntry(true);
    await writeManifest(manifest);
    await writeActivity('a1', '2026-01-01T07:00:00Z');
    await writeStream('a1', [0, 600], [150, 150]);
    await writeAthleteConfig();
    await writePrivateConfig();

    const doc = await computeTrainingLoad(baseOptions());

    expect(doc.models.banister).toBe(true);
    const dayWithData = doc.days.find((d) => d.edwards.trimp > 0);
    expect(dayWithData).toBeDefined();
    expect(dayWithData!.banister).not.toBeNull();
    expect(dayWithData!.banister!.trimp).not.toBe(dayWithData!.edwards.trimp);
  });

  it('3. private config present but restingHr null: banister disabled naming restingHr, edwards unaffected', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = availableEntry(true);
    await writeManifest(manifest);
    await writeActivity('a1', '2026-01-01T07:00:00Z');
    await writeStream('a1', [0, 600], [150, 150]);
    await writeAthleteConfig();
    await writePrivateConfig({ restingHr: null });

    const doc = await computeTrainingLoad(baseOptions());

    expect(doc.models.edwards).toBe(true);
    expect(doc.models.banister).toBe(false);
    expect(doc.banisterDisabledReason).toContain('restingHr');
    const dayWithData = doc.days.find((d) => d.edwards.trimp > 0);
    expect(dayWithData).toBeDefined();
    expect(dayWithData!.edwards.trimp).toBeGreaterThan(0);
  });

  it('4. missing/invalid public athlete.json: edwards disabled, days empty, a reason present, no throw', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = availableEntry(true);
    await writeManifest(manifest);
    await writeActivity('a1', '2026-01-01T07:00:00Z');
    await writeStream('a1', [0, 600], [150, 150]);
    // No athlete.json written on purpose.

    const doc = await computeTrainingLoad(baseOptions());

    expect(doc.models.edwards).toBe(false);
    expect(doc.models.banister).toBe(false);
    expect(doc.days).toEqual([]);
    expect(doc.banisterDisabledReason).not.toBeNull();
  });

  it('5. missing stream manifest throws, mentioning backfill-streams', async () => {
    // Manifest deliberately not written.
    await expect(computeTrainingLoad(baseOptions())).rejects.toThrow(/backfill-streams/);
  });

  it('6. one unreadable stream file among three: the other two are still processed, activitiesUnreadable === 1, a warning was logged', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['good1'] = availableEntry(true);
    manifest.activities['good2'] = availableEntry(true);
    manifest.activities['corrupt1'] = availableEntry(true);
    await writeManifest(manifest);
    await writeActivity('good1', '2026-01-01T07:00:00Z');
    await writeStream('good1', [0, 600], [150, 150]);
    await writeActivity('good2', '2026-01-02T07:00:00Z');
    await writeStream('good2', [0, 600], [150, 150]);
    await writeActivity('corrupt1', '2026-01-03T07:00:00Z');
    await fs.mkdir(path.join(tmpDir, 'streams'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'streams', 'corrupt1.json'), '{ not valid json', 'utf-8');
    await writeAthleteConfig();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const doc = await computeTrainingLoad(baseOptions());

    expect(doc.totals.activitiesUnreadable).toBe(1);
    expect(doc.totals.activitiesWithHr).toBe(2);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('7. an activity with channels.hr false contributes runs:1 and runsWithHr:0 on its day, and 0 TRIMP', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = availableEntry(false);
    await writeManifest(manifest);
    await writeActivity('a1', '2026-01-01T07:00:00Z');
    await writeAthleteConfig();

    const doc = await computeTrainingLoad(baseOptions());

    const day = doc.days.find((d) => d.date === '2026-01-01');
    expect(day).toBeDefined();
    expect(day!.runs).toBe(1);
    expect(day!.runsWithHr).toBe(0);
    expect(day!.edwards.trimp).toBe(0);
  });

  it('8. two activities on the same calendar day: their TRIMP sums into one day entry and runs === 2', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = availableEntry(true);
    manifest.activities['a2'] = availableEntry(true);
    await writeManifest(manifest);
    await writeActivity('a1', '2026-01-01T06:00:00Z');
    await writeStream('a1', [0, 600], [150, 150]);
    await writeActivity('a2', '2026-01-01T18:00:00Z');
    await writeStream('a2', [0, 600], [150, 150]);
    await writeAthleteConfig();

    const doc = await computeTrainingLoad(baseOptions());

    const day = doc.days.find((d) => d.date === '2026-01-01');
    expect(day).toBeDefined();
    expect(day!.runs).toBe(2);
    // Each 10-minute zone-3 (150bpm) segment contributes 10*3=30 edwards TRIMP; two activities sum to 60.
    expect(day!.edwards.trimp).toBeCloseTo(60, 1);
  });

  it('9. a 40-day gap between two activities: the spine contains all 40 intervening days with runs === 0 and a strictly decreasing CTL', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = availableEntry(true);
    manifest.activities['a2'] = availableEntry(true);
    await writeManifest(manifest);
    await writeActivity('a1', '2026-01-01T07:00:00Z');
    await writeStream('a1', [0, 3600], [170, 170]);
    await writeActivity('a2', '2026-02-10T07:00:00Z'); // 40 days after 2026-01-01
    await writeStream('a2', [0, 600], [150, 150]);
    await writeAthleteConfig();

    const doc = await computeTrainingLoad(baseOptions());

    const jan1Index = doc.days.findIndex((d) => d.date === '2026-01-01');
    const feb10Index = doc.days.findIndex((d) => d.date === '2026-02-10');
    expect(jan1Index).toBeGreaterThanOrEqual(0);
    expect(feb10Index).toBeGreaterThan(jan1Index);
    expect(feb10Index - jan1Index).toBe(40);

    for (let i = jan1Index + 1; i < feb10Index; i++) {
      expect(doc.days[i].runs).toBe(0);
    }

    let decreases = 0;
    for (let i = jan1Index + 2; i < feb10Index; i++) {
      if (doc.days[i].edwards.ctl < doc.days[i - 1].edwards.ctl) decreases++;
    }
    expect(decreases).toBe(feb10Index - (jan1Index + 2));
  });

  it('10. emitted numbers are rounded to at most 2 decimals across a sample of entries', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = availableEntry(true);
    await writeManifest(manifest);
    await writeActivity('a1', '2026-01-01T07:00:00Z');
    await writeStream('a1', [0, 613], [153, 153]);
    await writeAthleteConfig();
    await writePrivateConfig();

    const doc = await computeTrainingLoad(baseOptions());

    function decimalPlaces(n: number): number {
      const s = n.toString();
      const idx = s.indexOf('.');
      return idx === -1 ? 0 : s.length - idx - 1;
    }

    const sample = doc.days.slice(0, 20);
    expect(sample.length).toBeGreaterThan(0);
    for (const day of sample) {
      expect(decimalPlaces(day.edwards.trimp)).toBeLessThanOrEqual(2);
      expect(decimalPlaces(day.edwards.ctl)).toBeLessThanOrEqual(2);
      expect(decimalPlaces(day.edwards.atl)).toBeLessThanOrEqual(2);
      expect(decimalPlaces(day.edwards.tsb)).toBeLessThanOrEqual(2);
      if (day.banister) {
        expect(decimalPlaces(day.banister.trimp)).toBeLessThanOrEqual(2);
        expect(decimalPlaces(day.banister.ctl)).toBeLessThanOrEqual(2);
        expect(decimalPlaces(day.banister.atl)).toBeLessThanOrEqual(2);
        expect(decimalPlaces(day.banister.tsb)).toBeLessThanOrEqual(2);
      }
    }
  });
});
