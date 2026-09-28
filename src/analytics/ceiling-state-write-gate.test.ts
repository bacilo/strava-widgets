/**
 * Watches the `writeCeilingState` gate (28 WR-06, D-11) in BOTH directions
 * on a real fixture where TODAY'S ungated code would have written — never a
 * vacuous check. Every path passed to `computeBestEfforts` here points
 * inside an `mkdtempSync` directory (removed in `afterAll`); this file reads
 * and writes nothing under the real committed archive.
 *
 * Fixture: `CEILING_MIN_POPULATION` (currently 100) synthetic 400m
 * activities at one constant pace, mirroring `compute-best-efforts.test.ts`'s
 * own "100 clean 400m efforts" population fixtures (2-sample synthetic
 * streams, `writeActivity`/`writeManifest`-equivalent helpers below) — large
 * enough that `deriveCeilings` actually derives a real (non-fail-open)
 * ceiling for `400m`, so `diffCeilingState(null, ...)` returns its one
 * `'first-run'` row and `ceilingMovement.length > 0` holds on every run in
 * this file (confirmed inline via each test's own assertion on the returned
 * document, never assumed).
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FileStore } from '../storage/file-store.js';
import type { StreamManifest } from '../streams/stream.types.js';
import { CEILING_MIN_POPULATION } from './best-effort-ceiling.js';
import type { BestEffortCeilingStateFile } from './best-effort.types.js';
import { computeBestEfforts, type ComputeBestEffortsOptions } from './compute-best-efforts.js';

describe('ceiling-state write gate (28 WR-06, D-11) — writeCeilingState', () => {
  let tmpDir: string;
  let fileStore: FileStore;

  const FIXTURE_SPEED_MPS = 3.5;

  beforeAll(async () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'ceiling-write-gate-'));
    fileStore = new FileStore(tmpDir);

    const manifest: StreamManifest = {
      schemaVersion: 1,
      generated_at: '',
      note: 'ceiling-state-write-gate fixture — never the real archive',
      totals: { activities: 0, with_streams: 0, without_streams: 0, by_reason: {} },
      activities: {},
    };

    for (let i = 0; i < CEILING_MIN_POPULATION; i++) {
      const id = `gate-${i}`;
      manifest.activities[id] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await fileStore.writeJson(path.join('activities', `${id}.json`), {
        id,
        type: 'Run',
        start_date: '2020-01-01T00:00:00Z',
        start_date_local: '2020-01-01T00:00:00Z',
        distance: 400,
        moving_time: 300,
        max_speed: undefined,
      });
      const durationSec = Math.round((400 / FIXTURE_SPEED_MPS) * 10) / 10;
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

    await fileStore.writeJson('streams/manifest.json', manifest);
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  /** Every option below points inside `tmpDir` — nothing under the real archive is read. */
  function baseOptions(ceilingStateFileName: string): ComputeBestEffortsOptions {
    return {
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
      exclusionsPath: path.join(tmpDir, 'no-such-exclusions.json'),
      ceilingStatePath: path.join(tmpDir, ceilingStateFileName),
    };
  }

  /**
   * Writes a valid, PARSEABLE, but DELIBERATELY WRONG committed
   * ceiling-state file — its `400m` `p90Mps`/`populationN` disagree with
   * what the fixture above will derive — and returns its exact raw bytes,
   * so the CAN-FAIL direction (an unguarded write clobbering a real prior
   * baseline) is actually exercised, not merely a missing-file case.
   */
  function writeStaleDisagreeingFile(absPath: string): string {
    const stale: BestEffortCeilingStateFile = {
      schemaVersion: 1,
      note: 'stale fixture value, deliberately disagreeing with the fresh derivation',
      generatedAt: '2019-01-01T00:00:00.000Z',
      ceilings: {
        '400m': { ceilingMps: 99, p90Mps: 50, populationN: 5 },
        '1k': { ceilingMps: null, p90Mps: null, populationN: 0 },
        '1mi': { ceilingMps: null, p90Mps: null, populationN: 0 },
        '5k': { ceilingMps: null, p90Mps: null, populationN: 0 },
        '10k': { ceilingMps: null, p90Mps: null, populationN: 0 },
        half: { ceilingMps: null, p90Mps: null, populationN: 0 },
        marathon: { ceilingMps: null, p90Mps: null, populationN: 0 },
      },
    };
    const bytes = JSON.stringify(stale, null, 2);
    writeFileSync(absPath, bytes, 'utf-8');
    return bytes;
  }

  it('writeCeilingState absent, no prior file: a real ceiling is derived but the committed file is never created — the CAN-FAIL direction (diffCeilingState(null, ...) returns one first-run row, so ceilingMovement.length > 0 holds and today\'s ungated code WOULD have written here)', async () => {
    const ceilingStatePath = path.join(tmpDir, 'a-no-prior-flag-absent.json');

    const doc = await computeBestEfforts({
      ...baseOptions('a-no-prior-flag-absent.json'),
      // writeCeilingState omitted entirely — exercises the option's own
      // documented default, not merely an explicit `false`.
    });

    expect(doc.ceilings['400m'].ceilingMps).not.toBeNull();
    expect(() => readFileSync(ceilingStatePath, 'utf-8')).toThrow();
  });

  it('writeCeilingState: true, no prior file: the committed file is created, parses, and carries the run\'s own derived 400m ceiling', async () => {
    const ceilingStatePath = path.join(tmpDir, 'b-no-prior-flag-present.json');

    const doc = await computeBestEfforts({
      ...baseOptions('b-no-prior-flag-present.json'),
      writeCeilingState: true,
    });

    const raw = readFileSync(ceilingStatePath, 'utf-8');
    const parsed = JSON.parse(raw) as BestEffortCeilingStateFile;
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.ceilings['400m'].ceilingMps).toBe(doc.ceilings['400m'].ceilingMps);
  });

  it('writeCeilingState absent, an existing disagreeing file: the committed file\'s bytes are IDENTICAL afterwards (raw string, not the parsed object, so a re-serialization with a new generatedAt cannot pass), while the returned document still carries the NEWLY derived ceiling', async () => {
    const ceilingStatePath = path.join(tmpDir, 'c-existing-flag-absent.json');
    const beforeBytes = writeStaleDisagreeingFile(ceilingStatePath);

    const doc = await computeBestEfforts({
      ...baseOptions('c-existing-flag-absent.json'),
      writeCeilingState: false,
    });

    const afterBytes = readFileSync(ceilingStatePath, 'utf-8');
    expect(afterBytes).toBe(beforeBytes);
    // Proves the gate only withholds the COMMITTED baseline write — never a
    // figure in the returned document, which is the D-11 clean-checkout bound.
    expect(doc.ceilings['400m'].ceilingMps).not.toBeNull();
    expect(doc.ceilings['400m'].ceilingMps).not.toBe(99);
  });

  it('writeCeilingState: true, an existing disagreeing file: the committed file\'s bytes CHANGE, and the new content\'s 400m p90Mps equals the run\'s own derived p90Mps', async () => {
    const ceilingStatePath = path.join(tmpDir, 'd-existing-flag-present.json');
    const beforeBytes = writeStaleDisagreeingFile(ceilingStatePath);

    const doc = await computeBestEfforts({
      ...baseOptions('d-existing-flag-present.json'),
      writeCeilingState: true,
    });

    const afterBytes = readFileSync(ceilingStatePath, 'utf-8');
    expect(afterBytes).not.toBe(beforeBytes);
    const parsed = JSON.parse(afterBytes) as BestEffortCeilingStateFile;
    expect(parsed.ceilings['400m'].p90Mps).toBe(doc.ceilings['400m'].p90Mps);
  });

  it('writeCeilingState on vs off: the two runs\' returned ceilings objects are deep-equal — the flag must not be able to change a single derived figure (D-11\'s "reproducible from a clean checkout" bound, made testable)', async () => {
    const onDoc = await computeBestEfforts({
      ...baseOptions('e-deep-equal-on.json'),
      writeCeilingState: true,
    });
    const offDoc = await computeBestEfforts({
      ...baseOptions('e-deep-equal-off.json'),
      writeCeilingState: false,
    });

    expect(onDoc.ceilings).toEqual(offDoc.ceilings);
  });
});
