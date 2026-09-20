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

import { UNRELIABLE_SPEED_LIMIT_MPS } from '../dist/analytics/unreliable-segments.js';
import {
  INSENSITIVITY_SOURCE_ACTIVITY_ID,
  NAMED_ITEMS,
  RECOUNT_TARGET_ACTIVITY_ID,
  SCOPING_PROBE_REFERENCE,
  SUUNTO_ACTIVITY_ID,
  buildFindingsResults,
  buildHeadline,
  buildReconciliationLadder,
  checkFeasibility,
  computeFeasibleFloor,
  d04Statement,
  deriveExcessFloor,
  deriveHiddenPauseBoundary,
  deriveSpeedLimit,
  deriveSpeedLimitAt,
  excessFloorDeriveFn,
  excessFloorStrawmanDeriveFn,
  findNegativeControlCandidates,
  findValley,
  fixtureHeadroom,
  gapSampleIndexList,
  hiddenPauseBoundaryDeriveFn,
  hiddenPauseStrawmanDeriveFn,
  insensitivityCheck,
  loadDecision,
  measureDecimationOverlap,
  mustFlagItems,
  mustSpareItems,
  nearMissSweep,
  parseDecisionText,
  perSampleFastRuns,
  renderCalibrationMarkdown,
  renderFindingsSections,
  renderPerSegmentTable,
  selectSpeedLimitMultiplier,
  speedLimitMultiplierAt,
  statisticSA,
  suuntoDisclosure,
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
  it('renders the required headings, including "## Chosen constants" under option-jitter\'s not-rendered note (plan 32-06)', () => {
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
      decision: { disposition: 'option-jitter', statistic: 'S-A', fixtures: [] },
      chosenConstants: null,
      headline: null,
      reconciliationLadder: null,
      decimationOverlap: null,
      nearMiss: null,
      headroom: null,
      suunto: null,
      perSegmentSegments: [],
      streamFileCount: 0,
      notComputable: 0,
    };

    const markdown = renderCalibrationMarkdown(fakeReport);

    expect(markdown).toContain('## Reachability of D-10(d) (pre-calibration evidence)');
    expect(markdown).toContain("## Negative-control candidates at the detector's judging scale (D-05)");
    expect(markdown).toContain('## Candidate speed-limit statistics (D-10) and insensitivity (D-13)');
    expect(markdown).toContain('## Inputs');
    // option-jitter renders the heading with a "not rendered" note rather than omitting it —
    // 32-CALIBRATION.md's real, non-option-jitter run always carries the full contract rows.
    expect(markdown).toContain('## Chosen constants');
    expect(markdown).toContain('option-jitter');
    // Rendered exactly twice, per Task 1's behaviour ("with and without the research fixtures").
    expect(markdown.split('## Reachability of D-10(d) (pre-calibration evidence)').length - 1).toBe(2);
  });
});

describe('renderFindingsSections — live-denominator contract (D-16, never a hard-coded 1,873/1,874)', () => {
  it('renders every headline percentage against report.streamFileCount, not a hard-coded archive size', () => {
    const fakeReport = {
      decision: { disposition: 'option-refixture', statistic: 'S-A', fixtures: [] },
      headline: buildHeadline([
        { id: 'A', segments: [{ mechanism: 'gap-adjacent', metres: 10, seconds: 5 }] },
      ]),
      reconciliationLadder: null,
      decimationOverlap: null,
      nearMiss: null,
      headroom: null,
      suunto: null,
      perSegmentSegments: [],
      streamFileCount: 42, // deliberately NOT 1873/1874
      notComputable: 2,
    };

    const markdown = renderFindingsSections(fakeReport);

    expect(markdown).toContain('**42**');
    expect(markdown).toContain('of 42');
    expect(markdown).not.toContain('1873');
    expect(markdown).not.toContain('1874');
    // computableCount = streamFileCount - notComputable, also live, never hard-coded.
    expect(markdown).toContain('**40**');
  });
});

// ---------------------------------------------------------------------------
// Plan 32-06: constant derivation (D-08/D-09/D-10/D-13) — hand-built fixtures only
// ---------------------------------------------------------------------------

describe('parseDecisionText', () => {
  it('parses the three grep-able Decision lines verbatim', () => {
    const text = [
      'Some prose before the Decision block.',
      '',
      '```',
      'disposition: option-refixture',
      'fixtures: 7409028052:586-624, 3647739864:945-971',
      'statistic: S-A',
      '```',
      '',
      'Some prose after.',
    ].join('\n');

    const decision = parseDecisionText(text);

    expect(decision.disposition).toBe('option-refixture');
    expect(decision.statistic).toBe('S-A');
    expect(decision.fixtures).toEqual([
      { id: '7409028052', startSec: 586, endSec: 624 },
      { id: '3647739864', startSec: 945, endSec: 971 },
    ]);
  });

  it('throws when a required Decision line is missing rather than silently defaulting', () => {
    expect(() => parseDecisionText('disposition: option-refixture\nstatistic: S-A')).toThrow();
  });
});

describe('mustFlagItems / mustSpareItems', () => {
  const decision = { disposition: 'option-refixture', statistic: 'S-A', fixtures: [
    { id: '7409028052', startSec: 586, endSec: 624 },
    { id: '3647739864', startSec: 945, endSec: 971 },
  ] };

  it('mustFlagItems returns all six named must-flag items under option-refixture', () => {
    expect(mustFlagItems(decision)).toBe(NAMED_ITEMS.mustFlag);
    expect(mustFlagItems(decision).length).toBe(6);
  });

  it('mustSpareItems combines the D-09 trivial pair with the Decision\'s locked fixtures, never 4556693525', () => {
    const items = mustSpareItems(decision);
    expect(items.length).toBe(3);
    const ids = items.map((i) => `${i.id}@${i.window.startSec}`);
    expect(ids).toEqual(['3475734189@1581', '7409028052@586', '3647739864@945']);
    expect(items.map((i) => i.id)).not.toContain('4556693525');
  });
});

describe('checkFeasibility (against NAMED_ITEMS with a synthetic decision)', () => {
  // NAMED_ITEMS.mustFlag/mustSpare reference real archive ids; checkFeasibility calls
  // mustFlagItems/mustSpareItems(decision), which read those real ids. This test builds synthetic
  // ACTIVITIES under those SAME real ids (mirroring how `insensitivityCheck`'s own existing tests
  // reuse `INSENSITIVITY_SOURCE_ACTIVITY_ID`) so the module's real named windows resolve against
  // hand-built, controllable streams instead of the live archive.
  const decision = {
    disposition: 'option-refixture',
    statistic: 'S-A',
    fixtures: [{ id: 'FIX1', startSec: 0, endSec: 20 }],
  };

  // `advanceSteps` folds a ZERO-metres pair FORWARD into whichever pair eventually clears the
  // bar — so a naive "jump straight to the next burst's start with distance unchanged" padding
  // would fold the entire lead-in time into the burst's own step, diluting its speed toward zero.
  // Padding at a small positive `padSpeed` (well below any `L` used in these tests) closes out its
  // own step first, so each burst starts its own fresh, correctly-timed step.
  function buildArchiveFromBursts(id, bursts, { padSpeed = 0.5 } = {}) {
    const t = [];
    const d = [];
    let time = 0;
    let dist = 0;
    t.push(time);
    d.push(dist);
    const sorted = [...bursts].sort((a, b) => a.startSec - b.startSec);
    for (const b of sorted) {
      if (b.startSec > time) {
        dist += (b.startSec - time) * padSpeed;
        time = b.startSec;
        t.push(time);
        d.push(dist);
      }
      time = b.endSec;
      dist += b.metres;
      t.push(time);
      d.push(dist);
    }
    return { id, t, d, gaps: [] };
  }

  it('names the blocking must-spare item and mechanism ("floor") when its excess exceeds the must-flag minimum', () => {
    const L = 4;
    // Must-flag activity 3475734189 carries the hidden-pause window (1353-1360) at excess 12
    // (the deliberate minimum) and 3475740390 carries the five jump windows each with excess > 12.
    const hiddenPauseActivity = buildArchiveFromBursts(
      '3475734189',
      [
        { startSec: 1353, endSec: 1360, metres: 40 }, // excess = 40 - 4*7 = 12
        { startSec: 1581, endSec: 1583, metres: 8.65 * 2 }, // D-09 trivial pair window, excess = 17.3-8=9.3
      ],
      L
    );
    const jumpsActivity = buildArchiveFromBursts(
      '3475740390',
      [
        { startSec: 2347, endSec: 2350, metres: 30 }, // excess = 30-12=18
        { startSec: 2508, endSec: 2513, metres: 40 }, // excess = 40-20=20
        { startSec: 2536, endSec: 2538, metres: 20 }, // excess = 20-8=12 (ties the hidden-pause minimum but not below it)
        { startSec: 2580, endSec: 2583, metres: 25 }, // excess = 25-12=13
        { startSec: 2587, endSec: 2589, metres: 22 }, // excess = 22-8=14
      ],
      L
    );
    // The locked fixture FIX1 carries MORE excess (50) than the must-flag minimum (12) — exactly
    // this plan's own live-archive finding, reproduced as a controllable fixture.
    const fixtureActivity = buildArchiveFromBursts('FIX1', [{ startSec: 0, endSec: 20, metres: 4 * 20 + 50 }], L);

    const archive = { activities: [hiddenPauseActivity, jumpsActivity, fixtureActivity] };

    const infeasible = checkFeasibility(archive, L, 30, decision); // any F must be < 12 to admit every must-flag item
    expect(infeasible.pass).toBe(false);
    const blockingRow = infeasible.rows.find((r) => r.kind === 'mustSpare' && r.item.id === 'FIX1');
    expect(blockingRow.spared).toBe(false); // excess 50 > F=30: FIX1 is NOT spared, the blocking row
    expect(blockingRow.mechanism).toBeNull(); // not excluded by either mechanism — it IS the blocker
  });

  it('reports pass:true with every row correctly admitted/spared at a feasible F', () => {
    const L = 4;
    const hiddenPauseActivity = buildArchiveFromBursts(
      '3475734189',
      [
        { startSec: 1353, endSec: 1360, metres: 40 }, // excess 12
        { startSec: 1581, endSec: 1583, metres: 17.3 }, // excess = 17.3-8=9.3
      ],
      L
    );
    const jumpsActivity = buildArchiveFromBursts(
      '3475740390',
      [
        { startSec: 2347, endSec: 2350, metres: 30 }, // excess 18
        { startSec: 2508, endSec: 2513, metres: 40 }, // excess 20
        { startSec: 2536, endSec: 2538, metres: 20 }, // excess 12
        { startSec: 2580, endSec: 2583, metres: 25 }, // excess 13
        { startSec: 2587, endSec: 2589, metres: 22 }, // excess 14
      ],
      L
    );
    const fixtureActivity = buildArchiveFromBursts('FIX1', [{ startSec: 0, endSec: 20, metres: 4 * 20 + 5 }], L); // excess 5

    const archive = { activities: [hiddenPauseActivity, jumpsActivity, fixtureActivity] };

    const F = 10; // between the trivia/fixture excess (9.3, 5) and the must-flag minimum (12)
    const result = checkFeasibility(archive, L, F, decision);

    expect(result.pass).toBe(true);
    for (const row of result.rows) {
      if (row.kind === 'mustFlag') expect(row.admitted).toBe(true);
      else expect(row.spared).toBe(true);
    }
    const fixtureRow = result.rows.find((r) => r.item.id === 'FIX1');
    expect(fixtureRow.mechanism).toBe('floor');
  });
});

describe('deriveSpeedLimit', () => {
  it('rounds the Decision\'s statistic UP to 0.01 m/s (never down)', () => {
    // Two clean activities whose folded-step speeds put S-A's raw value strictly between two
    // hundredths, so ceil-rounding is observable and distinguishable from round()/floor().
    const activities = [
      { id: 'A', t: [0, 10], d: [0, 30.05], gaps: [] }, // speed 3.005
      { id: 'B', t: [0, 10], d: [0, 30.05], gaps: [] },
    ];
    const archive = { activities };
    const stepsIndex = new Map(
      archive.activities.map((a) => [a.id, [{ startIndex: 0, endIndex: 1, startSec: 0, endSec: 10, metres: 30.05, seconds: 10 }]])
    );
    const rawSA = statisticSA(stepsIndex).value;
    expect(rawSA).toBeCloseTo(3.005, 6);

    const L = deriveSpeedLimit(archive, 'S-A');
    expect(L).toBe(Math.ceil(rawSA * 100) / 100);
    expect(L).toBeGreaterThanOrEqual(rawSA);
    expect(L).toBe(3.01);
  });

  it('returns null for an unknown statistic label', () => {
    const archive = { activities: [{ id: 'A', t: [0, 10], d: [0, 30], gaps: [] }] };
    expect(deriveSpeedLimit(archive, 'S-Z')).toBeNull();
  });
});

describe('speedLimitMultiplierAt / selectSpeedLimitMultiplier (D-10 multiplier, D-13 insensitivity)', () => {
  function flatStepsIndex(speedMps, activityIds) {
    const idx = new Map();
    for (const id of activityIds) {
      idx.set(
        id,
        Array.from({ length: 10 }, (_, i) => ({
          startIndex: i,
          endIndex: i + 1,
          startSec: i * 10,
          endSec: (i + 1) * 10,
          metres: speedMps * 10,
          seconds: 10,
        }))
      );
    }
    return idx;
  }

  it('returns exactly 1 when every activity has perfectly uniform step speeds (p95 === p50)', () => {
    const idx = flatStepsIndex(3, ['A', 'B', 'C']);
    expect(speedLimitMultiplierAt(0.9)(idx)).toBe(1);
    expect(speedLimitMultiplierAt(0.97)(idx)).toBe(1);
  });

  it('returns a multiplier greater than 1 once at least one activity has real speed spread (p95 > p50)', () => {
    const idx = flatStepsIndex(3, ['A', 'B', 'C']);
    // Overwrite one activity with a spread-out speed distribution (1..10 m/s).
    idx.set(
      'SPIKY',
      Array.from({ length: 10 }, (_, i) => ({
        startIndex: i,
        endIndex: i + 1,
        startSec: i * 10,
        endSec: (i + 1) * 10,
        metres: (i + 1) * 10,
        seconds: 10,
      }))
    );
    const k = speedLimitMultiplierAt(0.9)(idx);
    expect(k).toBeGreaterThan(1);
  });

  it('returns null when no activity has any step', () => {
    expect(speedLimitMultiplierAt(0.9)(new Map())).toBeNull();
  });

  it('selectSpeedLimitMultiplier PASSES insensitivity on a dominant-bulk hand-built archive and returns a candidate from the fixed outer-percentile list', () => {
    // Mirrors the `insensitivityCheck` describe block's own bulk archive: two clean bulk
    // activities plus the source activity's one genuine burst — a rare minority the multiplier's
    // own bulk-of-bulk shape should not move under removal or planting.
    function bulkActivity(id, speedMps) {
      const t = [0, 10, 20, 30, 40, 50, 60];
      const d = t.map((sec) => sec * speedMps);
      return { id, t, d, gaps: [] };
    }
    function sourceActivityWithBurst() {
      const t = [0, 10, 20, 30, 32, 42, 52, 62];
      const d = [0, 30, 60, 90, 120, 150, 180, 210];
      return { id: INSENSITIVITY_SOURCE_ACTIVITY_ID, t, d, gaps: [] };
    }
    const bulk = Array.from({ length: 50 }, (_, i) => bulkActivity(`bulk-${i}`, 3 + (i % 3) * 0.1));
    const archive = { activities: [...bulk, sourceActivityWithBurst()] };

    const selection = selectSpeedLimitMultiplier(archive, 'S-A');

    expect(selection).not.toBeNull();
    expect(selection.check).not.toBeNull();
    expect(selection.check.pass).toBe(true);
    expect([0.9, 0.95, 0.97, 0.99]).toContain(selection.outerPercentile);
    expect(deriveSpeedLimit(archive, 'S-A')).toBe(selection.L);
  });

  it('deriveSpeedLimitAt composes the Decision statistic and the multiplier (never a bare ceil(statistic))', () => {
    const idx = flatStepsIndex(4, ['A', 'B']);
    const L = deriveSpeedLimitAt('S-A', 0.9)(idx);
    const rawSA = statisticSA(idx).value;
    // Uniform speeds -> multiplier is exactly 1, so this degenerates to ceil(S-A), but via the
    // multiplier code path (not a hard-coded skip) — proven by calling the SAME function real
    // 32-06 code exercises for a non-trivial multiplier above.
    expect(L).toBe(Math.ceil(rawSA * 100) / 100);
  });
});

describe('findValley (D-08 valley search)', () => {
  it('finds a valley in a hand-built BIMODAL histogram (dense near each anchor, empty in the middle)', () => {
    const values = [...Array(4).fill(32), ...Array(4).fill(97)];

    const result = findValley(values, 20, 100);

    expect(result.valleyFound).toBe(true);
    expect(result.B).not.toBeNull();
    expect(result.B).toBeGreaterThan(20);
    expect(result.B).toBeLessThan(100);
  });

  it('reports valleyFound false (never a manufactured valley) on a completely EMPTY population — bug fix, plan 32-06 continuation', () => {
    // Regression test for a live-archive finding: every interior bin's count is 0 against
    // maxLeft=0/maxRight=0, so the ORIGINAL `counts[i] <= 0.5 * min(0, 0) === 0` condition
    // trivially matched at the very first interior edge — a manufactured "valley" over zero real
    // data. D-13's own removal arm hits exactly this (it can legitimately strip an entire
    // no-gap-segment population), so this must report `valleyFound: false`, not a random edge.
    const result = findValley([], 20, 100);

    expect(result.valleyFound).toBe(false);
    expect(result.B).toBeNull();
  });

  it('reports valleyFound false on a hand-built MONOTONE-DECAY histogram (no clean dip anywhere)', () => {
    // Every 5m bin from 20 to 95 populated with a strictly decreasing, never-near-zero count —
    // no bin is ever <= half the smaller of its left/right maxima.
    const values = [];
    const counts = [20, 18, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4];
    let edge = 25;
    for (const count of counts) {
      for (let i = 0; i < count; i++) values.push(edge + 0.5);
      edge += 5;
    }

    const result = findValley(values, 20, 100);

    expect(result.valleyFound).toBe(false);
    expect(result.B).toBeNull();
  });
});

describe('deriveExcessFloor / strawmanExcessFloorTailPercentile with D-13 insensitivity', () => {
  // NEW population (plan 32-06 continuation, live-archive finding): EVERY folded step's own
  // metres, pooled archive-wide — NOT restricted to fast/excess runs (the original rule used the
  // excess of already-fast runs directly and failed D-13 by 50-450% on the real archive, because
  // that population is nearly identical to what insensitivityCheck's own removal strips out).
  const L = 6;

  function bulkActivity(id) {
    // Single clean NON-fast step: 4m in 10s at L=6 (0.4 m/s) — the dominant "ordinary step" value.
    return { id, t: [0, 10], d: [0, 4], gaps: [] };
  }
  function outlierActivity(id) {
    // Single FAST step: 200m in 5s (40 m/s at L=6) — excess = 200 - 30 = 170, comfortably flagged
    // at any reasonable F, so `insensitivityCheck`'s removal strips it entirely.
    return { id, t: [0, 5], d: [0, 200], gaps: [] };
  }
  function sourceActivity() {
    // Six NON-fast steps at 3 m/s (metres=30 each) plus one FAST burst step at 15 m/s
    // (30m/2s, excess=30-12=18) — the same shape prior fixtures in this file use.
    const t = [0, 10, 20, 30, 32, 42, 52, 62];
    const d = [0, 30, 60, 90, 120, 150, 180, 210];
    return { id: INSENSITIVITY_SOURCE_ACTIVITY_ID, t, d, gaps: [] };
  }

  function buildArchive() {
    const bulk = Array.from({ length: 1000 }, (_, i) => bulkActivity(`bulk-${i}`));
    const outliers = Array.from({ length: 10 }, (_, i) => outlierActivity(`outlier-${i}`));
    return { activities: [...bulk, ...outliers, sourceActivity()] };
  }

  it('deriveExcessFloor is the archive-wide p10 of ALL pooled step metres, rounded DOWN to 0.1 m', () => {
    const archive = buildArchive();
    const F = deriveExcessFloor(archive, L);
    // The 1000-strong bulk cluster (metres exactly 4) comfortably contains the 10th percentile —
    // the 10 outliers (200) and the source's 7 steps (30) are all far above it.
    expect(F).toBe(4);
  });

  it('PASSES insensitivity for the real bulk (p10) derivation — a dominant bulk cluster is not moved by removing or planting a small minority', () => {
    const archive = buildArchive();
    const F = deriveExcessFloor(archive, L);

    const result = insensitivityCheck(excessFloorDeriveFn(L), archive, {
      detectAtL: L,
      excessFloorMetres: F,
      tolerance: 0.01,
    });

    expect(result.pass).toBe(true);
    expect(result.removedDelta).toBeLessThanOrEqual(0.01);
    expect(result.plantedDelta).toBeLessThanOrEqual(0.01);
  });

  it('FAILS insensitivity for the deliberately circular tail (p99) strawman — watched failing first (D-13)', () => {
    const archive = buildArchive();
    const F = deriveExcessFloor(archive, L);

    const result = insensitivityCheck(excessFloorStrawmanDeriveFn(L), archive, {
      detectAtL: L,
      excessFloorMetres: F,
      tolerance: 0.01,
    });

    // The p99 tail sits in the source's/outliers' minority clusters (30s/200s), which removal
    // strips down to almost nothing — a dramatic, watched-failing move.
    expect(result.pass).toBe(false);
    expect(result.removedDelta).toBeGreaterThan(0.01);
  });
});

describe('deriveHiddenPauseBoundary (D-08) — anchor emptiness and valley integration', () => {
  // See the identically-named helper above for why padding needs a small positive speed rather
  // than a zero-metres jump (`advanceSteps` folds zero-metres pairs forward, diluting the burst).
  function buildArchiveFromBursts(id, bursts, { padSpeed = 0.5 } = {}) {
    const t = [];
    const d = [];
    let time = 0;
    let dist = 0;
    t.push(time);
    d.push(dist);
    const sorted = [...bursts].sort((a, b) => a.startSec - b.startSec);
    for (const b of sorted) {
      if (b.startSec > time) {
        dist += (b.startSec - time) * padSpeed;
        time = b.startSec;
        t.push(time);
        d.push(dist);
      }
      time = b.endSec;
      dist += b.metres;
      t.push(time);
      d.push(dist);
    }
    return { id, t, d, gaps: [] };
  }

  const L = 4;
  const F = 0;

  function namedFlagActivities({ jumpMetres, hiddenPauseMetres }) {
    // NAMED_ITEMS.mustFlag's five isolated-jump windows all belong to 3475740390; give each a
    // small, distinct metres so `largestJumpMetres` is deterministic; the hidden-pause window
    // belongs to 3475734189.
    const jumps = buildArchiveFromBursts('3475740390', [
      { startSec: 2347, endSec: 2350, metres: jumpMetres[0] },
      { startSec: 2508, endSec: 2513, metres: jumpMetres[1] },
      { startSec: 2536, endSec: 2538, metres: jumpMetres[2] },
      { startSec: 2580, endSec: 2583, metres: jumpMetres[3] },
      { startSec: 2587, endSec: 2589, metres: jumpMetres[4] },
    ]);
    const hiddenPause = buildArchiveFromBursts('3475734189', [
      { startSec: 1353, endSec: 1360, metres: hiddenPauseMetres },
    ]);
    return [jumps, hiddenPause];
  }

  it('reports anchorEmpty (STOP condition c) when the largest jump\'s metres is not strictly less than the hidden pause\'s', () => {
    const activities = namedFlagActivities({ jumpMetres: [20, 25, 15, 100, 18], hiddenPauseMetres: 50 });
    const archive = { activities };

    const result = deriveHiddenPauseBoundary(archive, L, F);

    expect(result.anchorEmpty).toBe(true);
    expect(result.valleyFound).toBe(false);
    expect(result.B).toBeNull();
  });

  it('finds a real valley when a bimodal no-gap-metres population exists inside the anchor interval', () => {
    const [jumps, hiddenPause] = namedFlagActivities({ jumpMetres: [20, 30, 15, 25, 18], hiddenPauseMetres: 100 });
    // largestJumpMetres = 30, hiddenPauseMetres = 100 -> anchorInterval [30, 100)
    const background = [
      ...Array.from({ length: 4 }, (_, i) => buildArchiveFromBursts(`bg-low-${i}`, [{ startSec: 0, endSec: 5, metres: 32 }])),
      ...Array.from({ length: 4 }, (_, i) => buildArchiveFromBursts(`bg-high-${i}`, [{ startSec: 0, endSec: 15, metres: 97 }])),
    ];
    const archive = { activities: [jumps, hiddenPause, ...background] };

    const result = deriveHiddenPauseBoundary(archive, L, F);

    expect(result.anchorEmpty).toBe(false);
    expect(result.anchorInterval).toEqual({ low: 30, high: 100 });
    expect(result.valleyFound).toBe(true);
    expect(result.B).toBeGreaterThan(30);
    expect(result.B).toBeLessThan(100);
  });
});

describe('B (hidden-pause boundary) insensitivity (D-13)', () => {
  const L = 6;
  const F = 1;
  const anchorInterval = { low: 20, high: 100 };

  function lowClusterActivity(id) {
    // metres=32, seconds=5 -> excess = 32 - 30 = 2 (qualifies at F=1, safe from a removal floor of 17)
    return { id, t: [0, 5, 20], d: [0, 32, 34], gaps: [] };
  }
  function highClusterActivity(id) {
    // metres=97, seconds=15 -> excess = 97 - 90 = 7 (qualifies at F=1, safe from a removal floor of 17)
    return { id, t: [0, 15, 40], d: [0, 97, 100], gaps: [] };
  }
  function sourceActivity() {
    // Bulk steps at 3 m/s (non-fast), one burst step at 15 m/s (30m/2s, excess=30-12=18).
    const t = [0, 10, 20, 30, 32, 42, 52, 62];
    const d = [0, 30, 60, 90, 120, 150, 180, 210];
    return { id: INSENSITIVITY_SOURCE_ACTIVITY_ID, t, d, gaps: [] };
  }

  function buildArchive() {
    const low = Array.from({ length: 4 }, (_, i) => lowClusterActivity(`low-${i}`));
    const high = Array.from({ length: 4 }, (_, i) => highClusterActivity(`high-${i}`));
    return { activities: [...low, ...high, sourceActivity()] };
  }

  it('PASSES insensitivity for the real valley/fallback derivation — removing/planting a minor minority does not move the found valley', () => {
    const archive = buildArchive();

    const result = insensitivityCheck(hiddenPauseBoundaryDeriveFn(archive, L, F, anchorInterval), archive, {
      detectAtL: L,
      excessFloorMetres: 17, // strips only the source's own burst (excess 18); both clusters (2, 7) survive
      tolerance: 0.01,
    });

    expect(result.pass).toBe(true);
    expect(result.removedDelta).toBeLessThanOrEqual(0.01);
    expect(result.plantedDelta).toBeLessThanOrEqual(0.01);
  });

  it('FAILS insensitivity for the deliberately circular tail (p99) strawman — watched failing first (D-13)', () => {
    const archive = buildArchive();

    const result = insensitivityCheck(hiddenPauseStrawmanDeriveFn(archive, L, F), archive, {
      detectAtL: L,
      excessFloorMetres: 5, // strips the high cluster (excess 7) and the source's burst (excess 18)
      tolerance: 0.01,
    });

    expect(result.pass).toBe(false);
    expect(result.removedDelta).toBeGreaterThan(0.01);
  });
});

// ---------------------------------------------------------------------------
// Plan 32-07: findings (D-16 headline/reconciliation, D-11 overlap, D-06
// near-miss, D-05 headroom, Suunto disclosure, D-04, per-segment table)
// ---------------------------------------------------------------------------

describe('gapSampleIndexList / perSampleFastRuns', () => {
  it('gapSampleIndexList maps each gap span to its own [startIndex, endIndex] sample indices', () => {
    const activity = { t: [0, 5, 15, 20], d: [0, 5, 5, 10], gaps: [{ startSec: 5, endSec: 15 }] };
    expect(gapSampleIndexList(activity)).toEqual([{ startIndex: 1, endIndex: 2, startSec: 5, endSec: 15 }]);
  });

  it('perSampleFastRuns groups consecutive RAW pairs above the limit WITHOUT folding zero-advance pairs', () => {
    // Pairs: 0-2 (8m/2s=4), 2-4 (0m/2s=0, zero-advance BREAKS the per-sample run), 4-6 (8m/2s=4).
    const t = [0, 2, 4, 6];
    const d = [0, 8, 8, 16];
    const runs = perSampleFastRuns(t, d, [], 3);
    expect(runs.length).toBe(2);
    expect(runs[0]).toMatchObject({ startIndex: 0, endIndex: 1, metres: 8, seconds: 2 });
    expect(runs[1]).toMatchObject({ startIndex: 2, endIndex: 3, metres: 8, seconds: 2 });
  });

  it('perSampleFastRuns never counts a pair lying entirely inside a gap span', () => {
    const t = [0, 2, 4];
    const d = [0, 20, 40];
    const runs = perSampleFastRuns(t, d, [{ startSec: 0, endSec: 4 }], 3);
    expect(runs).toEqual([]);
  });
});

describe('buildReconciliationLadder (D-16)', () => {
  it('R0 vs R1 isolates per-sample vs run-level grouping (a zero-advance pair dilutes the folded step differently than it fragments a per-sample run)', () => {
    // Raw pairs: 0-2 (16m,speed8,fast@L7), 2-4 (0m, zero-advance), 4-6/6-8/8-10 (16m each,speed8,fast@L7).
    const archive = {
      activities: [
        { id: INSENSITIVITY_SOURCE_ACTIVITY_ID, t: [0, 2, 4, 6, 8, 10], d: [0, 16, 16, 32, 48, 64], gaps: [] },
      ],
    };

    const ladder = buildReconciliationLadder(archive);
    const r0 = ladder.rows.find((r) => r.key === 'R0');
    const r1 = ladder.rows.find((r) => r.key === 'R1');

    // R0 (per-sample): run1=[pair0] (16m/2s), run2=[pair2,pair3,pair4] (48m/6s) -> excess 2+6=8.
    expect(r0.source.bursts).toBe(2);
    expect(r0.source.burstMetres).toBeCloseTo(64, 6);
    expect(r0.source.burstSeconds).toBeCloseTo(8, 6);

    // R1 (run-level, folded): the zero pair folds INTO the following step, diluting its speed to
    // 16m/4s=4 (not fast at L=7) -> run1=[step0-1] (16m/2s) alone, run2=[step3-4,step4-5] (32m/4s).
    expect(r1.source.bursts).toBe(2);
    expect(r1.source.burstMetres).toBeCloseTo(48, 6);
    expect(r1.source.burstSeconds).toBeCloseTo(6, 6);

    expect(r0.changedFactor).toContain('archive growth');
    expect(r1.changedFactor).toContain('per-sample grouping -> run-level grouping');
  });

  it('R1 vs R2 isolates the speed-limit change; R2 vs R3 isolates the excess floor', () => {
    // Three sequential bursts (A: 8 m/s, B: 7.1 m/s, C: 7.45 m/s), each separated by a clean
    // (near-zero speed) step so they never chain into one run regardless of L.
    const t = [0, 20, 40, 60, 80, 100, 120];
    const d = [0, 160, 161, 303, 304, 453, 454];
    const archive = { activities: [{ id: INSENSITIVITY_SOURCE_ACTIVITY_ID, t, d, gaps: [] }] };

    const ladder = buildReconciliationLadder(archive);
    const r1 = ladder.rows.find((r) => r.key === 'R1'); // L=7, F=0
    const r2 = ladder.rows.find((r) => r.key === 'R2'); // L=7.35 (shipped), F=0
    const r3 = ladder.rows.find((r) => r.key === 'R3'); // L=7.35 (shipped), F=3.0 (shipped)

    // At L=7 all three (8, 7.1, 7.45 m/s) clear the limit.
    expect(r1.source.bursts).toBe(3);
    expect(r1.source.burstMetres).toBeCloseTo(160 + 142 + 149, 6);

    // At L=7.35, B (7.1 m/s) no longer clears the limit at all — removed entirely by the speed
    // change alone (F unchanged at 0).
    expect(r2.source.bursts).toBe(2);
    expect(r2.source.burstMetres).toBeCloseTo(160 + 149, 6);

    // At F=3.0 (still L=7.35), C's excess (149 - 7.35*20 = 2) no longer clears the floor —
    // removed by the floor change alone (L unchanged from R2).
    expect(r3.source.bursts).toBe(1);
    expect(r3.source.burstMetres).toBeCloseTo(160, 6);

    expect(r2.changedFactor).toContain('the calibrated speed limit');
    expect(r3.changedFactor).toContain('the calibrated excess floor');
  });

  it('carries the scoping-probe reference figures verbatim, never asserted', () => {
    const archive = { activities: [] };
    const ladder = buildReconciliationLadder(archive);
    expect(ladder.probe).toEqual(SCOPING_PROBE_REFERENCE);
    expect(ladder.probe.streamCount).toBe(1873);
    expect(ladder.probe.excessCount).toBe(259);
    expect(ladder.probe.gapAdjacentCount).toBe(121);
    expect(ladder.probe.source.id).toBe(INSENSITIVITY_SOURCE_ACTIVITY_ID);
  });
});

describe('buildHeadline (D-16)', () => {
  it('sums activities/segments/metres/seconds per mechanism, plus a total row deduping activities across mechanisms', () => {
    const results = [
      {
        id: 'A',
        segments: [
          { mechanism: 'gap-adjacent', metres: 10, seconds: 5 },
          { mechanism: 'isolated-jump', metres: 20, seconds: 8 },
        ],
      },
      { id: 'B', segments: [{ mechanism: 'isolated-jump', metres: 5, seconds: 2 }] },
      { id: 'C', segments: [] },
    ];

    const rows = buildHeadline(results);
    const byMechanism = Object.fromEntries(rows.map((r) => [r.mechanism, r]));

    expect(byMechanism['gap-adjacent']).toEqual({ mechanism: 'gap-adjacent', activities: 1, segments: 1, metres: 10, seconds: 5 });
    expect(byMechanism['hidden-pause']).toEqual({ mechanism: 'hidden-pause', activities: 0, segments: 0, metres: 0, seconds: 0 });
    expect(byMechanism['isolated-jump']).toEqual({ mechanism: 'isolated-jump', activities: 2, segments: 2, metres: 25, seconds: 10 });
    // total.activities counts A and B ONCE each even though A carries two mechanisms.
    expect(byMechanism.total).toEqual({ mechanism: 'total', activities: 2, segments: 3, metres: 35, seconds: 15 });
  });
});

describe('measureDecimationOverlap (D-11)', () => {
  it('computes both overlap denominators and the severe-vs-non-severe flagged-rate ratio', () => {
    const results = [
      { id: 'A', segments: [{}], decimationTier: 'severe' }, // flagged & severe
      { id: 'B', segments: [], decimationTier: 'severe' }, // severe, not flagged
      { id: 'C', segments: [{}], decimationTier: 'none' }, // flagged, not severe
      { id: 'D', segments: [], decimationTier: 'none' }, // neither
    ];

    const result = measureDecimationOverlap(results);

    expect(result.flagged).toBe(2);
    expect(result.severe).toBe(2);
    expect(result.intersection).toBe(1);
    expect(result.overlapOverFlagged).toBeCloseTo(0.5, 6);
    expect(result.overlapOverSevere).toBeCloseTo(0.5, 6);
    expect(result.severeFlagRate).toBeCloseTo(0.5, 6);
    expect(result.nonSevereFlagRate).toBeCloseTo(0.5, 6);
    expect(result.ratio).toBeCloseTo(1, 6);
  });

  it('reports ratio Infinity (never a silent null) when the non-severe cohort never flags but the severe cohort does', () => {
    const results = [
      { id: 'A', segments: [{}], decimationTier: 'severe' },
      { id: 'B', segments: [], decimationTier: 'none' },
    ];
    const result = measureDecimationOverlap(results);
    expect(result.nonSevereFlagRate).toBe(0);
    expect(result.ratio).toBe(Infinity);
  });

  it('flags a >=2 ratio as the plan\'s own STOP-condition statistic', () => {
    const results = [
      { id: 'A', segments: [{}], decimationTier: 'severe' },
      { id: 'B', segments: [{}], decimationTier: 'severe' },
      { id: 'C', segments: [], decimationTier: 'severe' },
      { id: 'D', segments: [], decimationTier: 'severe' },
      { id: 'E', segments: [{}], decimationTier: 'none' },
      { id: 'F', segments: [], decimationTier: 'none' },
      { id: 'G', segments: [], decimationTier: 'none' },
      { id: 'H', segments: [], decimationTier: 'none' },
    ];
    // severe flagged-rate = 2/4 = 0.5; non-severe flagged-rate = 1/4 = 0.25; ratio = 2.
    const result = measureDecimationOverlap(results);
    expect(result.ratio).toBeCloseTo(2, 6);
    expect(result.ratio >= 2).toBe(true);
  });
});

describe('nearMissSweep (D-06)', () => {
  function step(i) {
    return { startIndex: i, endIndex: i + 1, startSec: i * 10, endSec: (i + 1) * 10, metres: 1, seconds: 10 };
  }

  it('counts a trailing near-miss at k=2 clean steps, and finds no leading near-miss when no gap follows', () => {
    const steps = [step(0), step(1), step(2), step(3), step(4)];
    const gapList = [{ startIndex: -2, endIndex: -1, startSec: -20, endSec: -10 }];
    const segments = [
      { startIndex: 2, endIndex: 3, startSec: 20, endSec: 30, gapCount: 0, metres: 50, seconds: 10, mechanism: 'isolated-jump' },
    ];

    const result = nearMissSweep([{ id: 'A', steps, gapList, segments }]);

    expect(result.counts).toEqual({ 1: 0, 2: 1, 3: 0 });
    expect(result.examples).toEqual([{ id: 'A', t: 20, side: 'trailing', k: 2 }]);
  });

  it('skips gap-adjacent segments entirely (gapCount > 0)', () => {
    const steps = [step(0), step(1), step(2)];
    const gapList = [{ startIndex: -2, endIndex: -1, startSec: -20, endSec: -10 }];
    const segments = [
      { startIndex: 1, endIndex: 2, startSec: 10, endSec: 20, gapCount: 1, metres: 50, seconds: 10, mechanism: 'gap-adjacent' },
    ];

    const result = nearMissSweep([{ id: 'A', steps, gapList, segments }]);

    expect(result.counts).toEqual({ 1: 0, 2: 0, 3: 0 });
    expect(result.examples).toEqual([]);
  });

  it('never counts a TOUCHING boundary (k=0) as a near-miss — D-06 stays touching-only', () => {
    const steps = [step(0), step(1)];
    const gapList = [{ startIndex: -1, endIndex: 0, startSec: -10, endSec: 0 }];
    const segments = [
      { startIndex: 0, endIndex: 1, startSec: 0, endSec: 10, gapCount: 0, metres: 50, seconds: 10, mechanism: 'isolated-jump' },
    ];

    const result = nearMissSweep([{ id: 'A', steps, gapList, segments }]);

    expect(result.counts).toEqual({ 1: 0, 2: 0, 3: 0 });
  });

  it('does not count a gap more than 3 clean steps away', () => {
    const steps = [step(0), step(1), step(2), step(3), step(4), step(5), step(6)];
    const gapList = [{ startIndex: -2, endIndex: -1, startSec: -20, endSec: -10 }];
    const segments = [
      { startIndex: 6, endIndex: 7, startSec: 60, endSec: 70, gapCount: 0, metres: 50, seconds: 10, mechanism: 'isolated-jump' },
    ];

    const result = nearMissSweep([{ id: 'A', steps, gapList, segments }]);

    expect(result.counts).toEqual({ 1: 0, 2: 0, 3: 0 });
  });
});

describe('fixtureHeadroom (D-05)', () => {
  const decision = {
    disposition: 'option-refixture',
    statistic: 'S-A',
    fixtures: [
      { id: 'FIX1', startSec: 0, endSec: 20 },
      { id: 'FIX2', startSec: 100, endSec: 120 },
    ],
  };

  function buildArchiveFromBursts(id, bursts, { padSpeed = 0.5 } = {}) {
    const t = [];
    const d = [];
    let time = 0;
    let dist = 0;
    t.push(time);
    d.push(dist);
    const sorted = [...bursts].sort((a, b) => a.startSec - b.startSec);
    for (const b of sorted) {
      if (b.startSec > time) {
        dist += (b.startSec - time) * padSpeed;
        time = b.startSec;
        t.push(time);
        d.push(dist);
      }
      time = b.endSec;
      dist += b.metres;
      t.push(time);
      d.push(dist);
    }
    return { id, t, d, gaps: [] };
  }

  it('names the slowest admitted must-flag item and reports each fixture\'s excess/headroom at the SHIPPED speed limit', () => {
    const L = UNRELIABLE_SPEED_LIMIT_MPS;
    const hiddenPauseActivity = buildArchiveFromBursts('3475734189', [
      { startSec: 1353, endSec: 1360, metres: L * 7 + 50 }, // excess 50 (comfortably not the slowest)
    ]);
    const jumpsActivity = buildArchiveFromBursts('3475740390', [
      { startSec: 2347, endSec: 2350, metres: L * 3 + 10 }, // excess 10
      { startSec: 2508, endSec: 2513, metres: L * 5 + 20 }, // excess 20
      { startSec: 2536, endSec: 2538, metres: L * 2 + 8 }, // excess 8 -- deliberately the SLOWEST
      { startSec: 2580, endSec: 2583, metres: L * 3 + 15 }, // excess 15
      { startSec: 2587, endSec: 2589, metres: L * 2 + 12 }, // excess 12
    ]);
    // FIX1: excess 1.5 (safely below the slowest must-flag item's 8, wide headroom).
    const fix1Activity = buildArchiveFromBursts('FIX1', [{ startSec: 0, endSec: 20, metres: L * 20 + 1.5 }]);
    // FIX2: average speed strictly BELOW L -- never a candidate at all (excess null).
    const fix2Activity = buildArchiveFromBursts('FIX2', [{ startSec: 100, endSec: 120, metres: L * 20 - 5 }]);

    const archive = { activities: [hiddenPauseActivity, jumpsActivity, fix1Activity, fix2Activity] };

    const result = fixtureHeadroom(archive, decision);

    expect(result.L).toBe(L);
    expect(result.slowest.item.window).toEqual({ startSec: 2536, endSec: 2538 });
    expect(result.slowest.excess).toBeCloseTo(8, 6);

    const fix1 = result.fixtures.find((f) => f.id === 'FIX1');
    expect(fix1.excess).toBeCloseTo(1.5, 6);
    expect(fix1.absoluteHeadroom).toBeCloseTo(6.5, 6);
    expect(fix1.relativeHeadroom).toBeCloseTo(6.5 / 8, 6);

    const fix2 = result.fixtures.find((f) => f.id === 'FIX2');
    expect(fix2.excess).toBeNull();
    expect(fix2.absoluteHeadroom).toBeNull();
    expect(fix2.relativeHeadroom).toBeNull();
  });
});

describe('suuntoDisclosure (D-01/D-02/D-03)', () => {
  it('discloses samples, overlapping segments, detected status and the second-span finding for a present activity', () => {
    // 253-263 and 300-310 are both big (20 m/s) bursts; only the first overlaps the primary
    // disclosure window [253,293], but BOTH overlap the second, wider low-HR span [239,319].
    const t = [0, 253, 263, 293, 300, 310, 400];
    const d = [0, 253, 453, 483, 490, 690, 780];
    const archive = { activities: [{ id: SUUNTO_ACTIVITY_ID, t, d, gaps: [] }] };

    const result = suuntoDisclosure(archive);

    expect(result.found).toBe(true);
    expect(result.samples.map((s) => s.t)).toEqual([253, 263, 293]);
    expect(result.samples[1]).toMatchObject({ t: 263, dt: 10, dd: 200, impliedSpeed: 20 });
    expect(result.detected).toBe(true);
    expect(result.overlapping.length).toBe(1);
    expect(result.overlapping[0]).toMatchObject({ startSec: 253, endSec: 263 });
    expect(result.secondSpanSegments.length).toBe(2);
    expect(result.sentence).toContain('cannot tell');
    expect(result.sentence).toContain('17 m/s');
    expect(result.sentence).toContain('DETECTED');
    expect(result.sentence).toContain('ALSO fired');
  });

  it('fails closed with found:false when the activity is absent from the current archive', () => {
    const result = suuntoDisclosure({ activities: [] });
    expect(result).toEqual({ found: false });
  });
});

describe('renderPerSegmentTable (D-15 ARTIFACT CONTRACT)', () => {
  it('renders the exact contract header and one row per segment, matching the recount\'s own format', () => {
    const segments = [
      {
        startIndex: 1,
        endIndex: 2,
        startSec: 10,
        endSec: 20,
        seconds: 10,
        metres: 29.4,
        gapSeconds: 8,
        gapMetres: 5.123,
        burstSeconds: 2,
        burstMetres: 24.277,
        gapCount: 1,
        burstCount: 1,
        mechanism: 'gap-adjacent',
      },
    ];

    const table = renderPerSegmentTable(segments);
    const lines = table.split('\n');

    expect(lines[0]).toBe(
      '| # | startIndex | endIndex | startSec | endSec | seconds | metres | gapSeconds | gapMetres | burstSeconds | burstMetres | gaps | bursts | mechanism |'
    );
    expect(lines[1]).toBe('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    expect(lines[2].trim()).toBe(
      '| 1 | 1 | 2 | 10 | 20 | 10 | 29.4 | 8 | 5.1 | 2 | 24.3 | 1 | 1 | gap-adjacent |'
    );
  });

  it('renders zero rows (just header + separator) for an empty segment list', () => {
    const table = renderPerSegmentTable([]);
    expect(table.split('\n').length).toBe(2);
  });
});

describe('d04Statement (D-04)', () => {
  it('states one downstream treatment for every segment regardless of mechanism, and never alters distance/totals/splits', () => {
    const sentence = d04Statement();
    expect(sentence).toContain('ONE downstream treatment');
    expect(sentence).toContain('distance');
    expect(sentence).toContain('totals');
    expect(sentence).toContain('splits');
    expect(sentence).not.toContain('per-mechanism branch treatment'); // no per-mechanism dispatch endorsed
  });
});

describe('buildFindingsResults', () => {
  it('builds one record per activity with segments/decimationTier/steps/gapList', () => {
    const archive = {
      activities: [{ id: 'A', t: [0, 10, 20], d: [0, 10, 20], gaps: [] }],
    };
    const results = buildFindingsResults(archive);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('A');
    expect(Array.isArray(results[0].segments)).toBe(true);
    expect(typeof results[0].decimationTier).toBe('string');
    expect(Array.isArray(results[0].steps)).toBe(true);
    expect(Array.isArray(results[0].gapList)).toBe(true);
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
