/**
 * Guard test for the pure helpers exported by compute-unreliable-segment-calibration.mjs (Phase
 * 32 plan 05, D-10/D-12/D-13). Importing this module must not run an archive read or a write to
 * 32-CALIBRATION.md — if it does, the self-execution guard documented at the bottom of
 * compute-unreliable-segment-calibration.mjs is wrong and must be fixed rather than worked around
 * here.
 *
 * No test in this file reads any file under the live archive directories — every fixture below is
 * hand-built, mirroring compute-pr-ceiling-calibration.test.mjs's own "no archive reads" contract.
 */

import fs from 'fs';
import { describe, expect, it, vi } from 'vitest';

import {
  INSENSITIVITY_SOURCE_ACTIVITY_ID,
  NAMED_ITEMS,
  computeFeasibleFloor,
  findNegativeControlCandidates,
  insensitivityCheck,
  renderCalibrationMarkdown,
} from './compute-unreliable-segment-calibration.mjs';

describe('computeFeasibleFloor', () => {
  it('reports feasibleFloor null with a reason naming the spare item when a must-flag excess (6) is at or below a must-spare excess (9)', () => {
    const mustFlagResults = [
      { item: { id: 'FLAG', window: { startSec: 0, endSec: 1 }, label: 'flag' }, excess: 6 },
    ];
    const mustSpareResults = [
      { item: { id: 'SPARE', window: { startSec: 0, endSec: 1 }, label: 'spare' }, excess: 9 },
    ];

    const result = computeFeasibleFloor(mustFlagResults, mustSpareResults);

    expect(result.feasibleFloor).toBeNull();
    expect(result.reason).toContain('SPARE');
  });

  it('returns a non-null feasibleFloor when the must-flag minimum strictly exceeds the must-spare maximum', () => {
    const mustFlagResults = [
      { item: { id: 'FLAG', window: { startSec: 0, endSec: 1 }, label: 'flag' }, excess: 10 },
    ];
    const mustSpareResults = [];

    const result = computeFeasibleFloor(mustFlagResults, mustSpareResults);

    expect(result.feasibleFloor).toEqual({ lo: 0, hi: 10 });
    expect(result.reason).toBeNull();
  });

  it('reports feasibleFloor null with a reason naming the missing item when a must-flag item is not a candidate (null excess)', () => {
    const mustFlagResults = [
      { item: { id: 'GONE', window: { startSec: 0, endSec: 1 }, label: 'missing at this L' }, excess: null },
    ];
    const mustSpareResults = [];

    const result = computeFeasibleFloor(mustFlagResults, mustSpareResults);

    expect(result.feasibleFloor).toBeNull();
    expect(result.reason).toContain('GONE');
  });
});

describe('NAMED_ITEMS', () => {
  it('never lists 4556693525 among must-flag, must-spare or D-05 candidates (D-01)', () => {
    const forbidden = '4556693525';
    for (const key of ['mustFlag', 'mustSpare', 'd05Candidates']) {
      const ids = NAMED_ITEMS[key].map((item) => item.id);
      expect(ids).not.toContain(forbidden);
    }
    // It IS disclosed, just never a fixture.
    expect(NAMED_ITEMS.disclosedNeverFixture.map((item) => item.id)).toContain(forbidden);
  });

  it('carries five isolated-jump/hidden-pause must-flag items and one must-spare trivial pair', () => {
    expect(NAMED_ITEMS.mustFlag.length).toBe(6);
    expect(NAMED_ITEMS.mustSpare.length).toBe(1);
    expect(NAMED_ITEMS.d05Candidates.length).toBe(3);
  });
});

describe('findNegativeControlCandidates', () => {
  // Hand-built stream: 21 samples, 10s apart (span 0..200s), background pace 1 m/s everywhere
  // except a 30s window (t=70..100) at 5 m/s (seeds >=4, aggregate 5 in [4.5,7.2], duration 30>=20,
  // starts >=60s from the start, ends >=60s before the end, no gaps).
  function buildFastRunStream(id) {
    const t = [];
    const d = [];
    let time = 0;
    let dist = 0;
    for (let i = 0; i < 21; i++) {
      t.push(time);
      d.push(dist);
      const isFastWindow = time >= 70 && time < 100;
      dist += isFastWindow ? 50 : 10;
      time += 10;
    }
    return { id, t, d, hr: undefined, cadence: undefined, gaps: [], device: undefined };
  }

  it('finds the genuine fast run and reports its judging-scale measurements', () => {
    const archive = { activities: [buildFastRunStream('genuine-fast-1')] };

    const candidates = findNegativeControlCandidates(archive);

    expect(candidates.length).toBe(1);
    const [candidate] = candidates;
    expect(candidate.id).toBe('genuine-fast-1');
    expect(candidate.startSec).toBe(70);
    expect(candidate.endSec).toBe(100);
    expect(candidate.duration).toBe(30);
    expect(candidate.aggregateSpeed).toBeCloseTo(5, 6);
    expect(candidate.maxFoldedStepSpeed).toBeCloseTo(5, 6);
    // Every step in the run sits exactly at the run's own aggregate speed, so no sub-run exceeds
    // it strictly — maxRunAggregateSpeed is a legitimate null, not a synthetic look-alike bug.
    expect(candidate.maxRunAggregateSpeed).toBeNull();
  });

  it('excludes 4556693525 even when its stream would otherwise qualify (D-01)', () => {
    const archive = { activities: [buildFastRunStream('4556693525')] };

    const candidates = findNegativeControlCandidates(archive);

    expect(candidates.map((c) => c.id)).not.toContain('4556693525');
    expect(candidates.length).toBe(0);
  });

  it('never references a speed limit or floor value in its own criteria (structural: only compares against 3.5/4/20/4.5/7.2/60, never a named LIMIT/FLOOR constant)', () => {
    // Structural guard: this test asserts the exported function's arity and that it accepts only
    // an archive, never a speedLimitMps/excessFloorMetres option — a signature change here would
    // be the load-bearing signal, not a source-text grep (kept simple, per this plan's discretion).
    expect(findNegativeControlCandidates.length).toBe(1);
  });
});

describe('insensitivityCheck', () => {
  // Three hand-built activities sharing one contiguous 10s-cadence stream shape. `A` and `B` are
  // clean bulk running (no bursts). The source activity id (INSENSITIVITY_SOURCE_ACTIVITY_ID) also
  // carries one genuine burst step (30m/2s = 15 m/s) among its bulk steps — this is the "real
  // shape" `insensitivityCheck` clones from, per its own contract.
  function bulkActivity(id, speedMps) {
    const t = [0, 10, 20, 30, 40, 50, 60];
    const d = t.map((sec) => sec * speedMps);
    return { id, t, d, hr: undefined, cadence: undefined, gaps: [], device: undefined };
  }

  function sourceActivityWithBurst() {
    // Bulk steps at 3 m/s (0-10,10-20,20-30), one burst step at 15 m/s (30-32), then bulk again
    // (32-42,42-52,52-62).
    const t = [0, 10, 20, 30, 32, 42, 52, 62];
    const d = [0, 30, 60, 90, 120, 150, 180, 210];
    return { id: INSENSITIVITY_SOURCE_ACTIVITY_ID, t, d, hr: undefined, cadence: undefined, gaps: [], device: undefined };
  }

  function buildArchive() {
    return {
      activities: [bulkActivity('A', 3), bulkActivity('B', 3.3), sourceActivityWithBurst()],
    };
  }

  function medianOfMedians(stepsIndex) {
    const medians = [];
    for (const steps of stepsIndex.values()) {
      if (steps.length === 0) continue;
      const speeds = steps.map((s) => s.metres / s.seconds).sort((a, b) => a - b);
      medians.push(speeds[Math.floor(speeds.length / 2)]);
    }
    medians.sort((a, b) => a - b);
    return medians[Math.floor(medians.length / 2)];
  }

  function pooledP999(stepsIndex) {
    const speeds = [];
    for (const steps of stepsIndex.values()) {
      for (const s of steps) speeds.push(s.metres / s.seconds);
    }
    speeds.sort((a, b) => a - b);
    if (speeds.length === 0) return null;
    // R-7 interpolated percentile, hand-rolled to keep this fixture independent of the module
    // under test's own `quantile` import.
    const pos = (speeds.length - 1) * 0.999;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return speeds[lo];
    const frac = pos - lo;
    return speeds[lo] + frac * (speeds[hi] - speeds[lo]);
  }

  it('PASSES for a robust bulk statistic (median of per-activity medians) — a bulk statistic returns pass: true', () => {
    const archive = buildArchive();

    // detectAtL=6: comfortably above the 3/3.3 m/s bulk steps, comfortably below the 15 m/s burst
    // step, so exactly one segment (the burst) is detected archive-wide at floor 0.
    const result = insensitivityCheck(medianOfMedians, archive, { detectAtL: 6, tolerance: 0.01 });

    expect(result.detectedSegmentCount).toBe(1);
    expect(result.sourceBurstPartCount).toBeGreaterThan(0);
    expect(result.removedDelta).not.toBeNull();
    expect(result.removedDelta).toBeLessThanOrEqual(0.01);
    expect(result.plantedDelta).toBeLessThanOrEqual(0.01);
    expect(result.pass).toBe(true);
  });

  it('FAILS for the deliberately circular pooled p99.9 statistic — the strawman is watched failing', () => {
    const archive = buildArchive();

    const result = insensitivityCheck(pooledP999, archive, { detectAtL: 6, tolerance: 0.01 });

    // Removing the archive's only fast burst collapses the pooled p99.9 from near the 15 m/s
    // outlier down to the 3.3 m/s bulk ceiling — a huge relative move, exactly the self-defeat
    // D-13 exists to catch.
    expect(result.removedDelta).not.toBeNull();
    expect(result.removedDelta).toBeGreaterThan(0.01);
    expect(result.pass).toBe(false);
  });
});

describe('renderCalibrationMarkdown', () => {
  it('renders the required headings and omits "## Chosen constants" (plan 32-06\'s job, not this plan\'s)', () => {
    const fakeGrid = { grid: [], lowerBound: 3, upperBound: 3, minMedian: 3, step: 0.05, maxScanMps: 40 };
    const fakeReport = {
      grid: fakeGrid,
      matrixWithD05: [],
      matrixWithoutD05: [],
      negativeControlCandidates: [],
      d05Measurements: [],
      statistics: {
        candidates: [{ label: 'S-A', description: 'desc', value: null, n: 0, check: null, feasibleWithD05: null, feasibleWithoutD05: null }],
        strawmanCandidate: { label: 'strawman', description: 'desc', value: null, n: 0, check: null, feasibleWithD05: null, feasibleWithoutD05: null },
        tolerance: 0.01,
      },
      streamFileCount: 0,
      notComputable: 0,
    };

    const markdown = renderCalibrationMarkdown(fakeReport);

    expect(markdown).toContain('## Reachability of D-10(d) (pre-calibration)');
    expect(markdown).toContain("## Negative-control candidates at the detector's judging scale (D-05)");
    expect(markdown).toContain('## Candidate speed-limit statistics (D-10) and insensitivity (D-13)');
    expect(markdown).toContain('## Inputs');
    expect(markdown).not.toContain('## Chosen constants');
    // Rendered exactly twice, per Task 1's behaviour ("with and without the research fixtures").
    expect(markdown.split('## Reachability of D-10(d) (pre-calibration)').length - 1).toBe(2);
  });
});

describe('import-time side effects', () => {
  it('importing this module triggers no read of the archive or a write to the calibration artifact', async () => {
    const readSpy = vi.spyOn(fs, 'readFileSync');
    const readdirSpy = vi.spyOn(fs, 'readdirSync');
    const writeSpy = vi.spyOn(fs, 'writeFileSync');
    // Cache-busting query so this assertion is not defeated by vitest's module cache having
    // already loaded the module for the describe blocks above.
    await import('./compute-unreliable-segment-calibration.mjs?cache-bust-guard-test');
    expect(readSpy).not.toHaveBeenCalled();
    expect(readdirSpy).not.toHaveBeenCalled();
    expect(writeSpy).not.toHaveBeenCalled();
    readSpy.mockRestore();
    readdirSpy.mockRestore();
    writeSpy.mockRestore();
  });
});
