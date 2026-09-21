/**
 * Guard test for the pure helpers exported by compute-unreliable-segment-severity-calibration.mjs
 * (Phase 33 plan 08, D-07). Importing this module must not run an archive read or a write to
 * 33-CALIBRATION.md — if it does, the self-execution guard documented at the bottom of that file is
 * wrong and must be fixed rather than worked around here.
 *
 * No test in this file reads any file under `data/streams/` — every fixture below is hand-built,
 * mirroring compute-unreliable-segment-calibration.test.mjs's own "no archive reads" contract. The
 * archive-shaped fixtures used by `buildFlaggedCohort`/`severityDistribution` below DO run the real
 * `detectUnreliableSegments` (imported from `dist/`), because that IS what those functions call —
 * but the `t`/`d`/`gaps` inputs are all synthetic, never a read from `data/streams/`.
 */

import { describe, expect, it } from 'vitest';

import { quantile } from '../dist/analytics/pace-derivation.js';
import { DEFAULT_DETECTOR_PARAMS } from '../dist/analytics/unreliable-segments.js';
import {
  CANDIDATE_OUTER_PERCENTILES,
  INSENSITIVITY_TOLERANCE,
  PLANT_COUNT,
  PLANT_MULTIPLIER,
  PLANT_SOURCE_ACTIVITY_ID,
  PREDECLARED_SHAPES,
  REJECTED_SHAPES,
  STRAWMAN_PERCENTILE,
  activityExcessFraction,
  buildBaseViews,
  buildFlaggedCohort,
  buildPlantedViews,
  buildRemovedViews,
  candidateCut,
  evaluateShape,
  insensitivityForCandidate,
  renderCalibrationMarkdown,
  selectSevereCut,
  severityDistribution,
  shapeR1,
  shapeR2,
  shapeR3,
  shapeR4,
  strawmanCandidate,
  strawmanFromViews,
} from './compute-unreliable-segment-severity-calibration.mjs';

// ---------------------------------------------------------------------------
// activityExcessFraction
// ---------------------------------------------------------------------------

describe('activityExcessFraction', () => {
  it('sums segment.excessMetres over totalDistanceM', () => {
    const segments = [{ excessMetres: 3 }, { excessMetres: 7 }];
    expect(activityExcessFraction(segments, 100)).toBeCloseTo(0.1, 9);
  });

  it('returns null, never 0, when totalDistanceM is 0', () => {
    const segments = [{ excessMetres: 5 }];
    expect(activityExcessFraction(segments, 0)).toBeNull();
  });

  it('returns null on a negative or non-finite totalDistanceM', () => {
    expect(activityExcessFraction([{ excessMetres: 5 }], -10)).toBeNull();
    expect(activityExcessFraction([{ excessMetres: 5 }], NaN)).toBeNull();
    expect(activityExcessFraction([{ excessMetres: 5 }], Infinity)).toBeNull();
  });

  it('returns 0 (not null) for an activity with segments carrying zero total excess over a positive distance', () => {
    expect(activityExcessFraction([{ excessMetres: 0 }], 500)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// candidateCut — the ONE R-7 percentile definition, imported, never re-implemented
// ---------------------------------------------------------------------------

describe('candidateCut', () => {
  it('matches the imported quantile function exactly over a sorted-ascending copy', () => {
    const fractions = [0.5, 0.1, 0.3, 0.9, 0.2];
    const sorted = [...fractions].sort((a, b) => a - b);
    expect(candidateCut(fractions, 0.9)).toBe(quantile(sorted, 0.9));
  });

  it('does not mutate the caller-supplied array', () => {
    const fractions = [0.5, 0.1, 0.3];
    const copy = [...fractions];
    candidateCut(fractions, 0.5);
    expect(fractions).toEqual(copy);
  });
});

// ---------------------------------------------------------------------------
// insensitivityForCandidate — D-13 two-direction check for one candidate order
// ---------------------------------------------------------------------------

/**
 * A realistic-shaped fixture: 9,500 values sit on a flat plateau (0.05 — most flagged activities
 * carry near-identical, small dilution), and 500 values form an ascending tail from 0.10 to 1.0
 * (a genuine minority of outliers). Hand-verified (via a standalone Node probe during planning,
 * recorded in 33-08-SUMMARY.md) that q=0.90 clears BOTH insensitivity directions cleanly (both
 * deltas exactly 0 — its cut sits exactly on the plateau both before and after removal/planting),
 * while q=0.95/0.97/0.99 each land inside the ascending tail and move well past the 1% tolerance —
 * a genuine, non-trivial differential rather than "all pass" or "all fail" by construction.
 */
function buildPlateauWithTailFractions() {
  const fractions = [];
  for (let i = 0; i < 9500; i++) fractions.push(0.05);
  for (let i = 0; i < 500; i++) fractions.push(0.1 + (i / 499) * (1.0 - 0.1));
  return fractions;
}

/**
 * A shorter, evenly-split variant of the same plateau/tail shape (500 plateau + 500 tail) where
 * EVERY candidate order fails both insensitivity directions — used as the deterministic
 * "no candidate clears" fixture below. Hand-verified the same way.
 */
function buildNoCandidateClearsFractions() {
  const fractions = [];
  for (let i = 0; i < 500; i++) fractions.push(0.05);
  for (let i = 0; i < 500; i++) fractions.push(0.1 + (i / 499) * (1.0 - 0.1));
  return fractions;
}

describe('insensitivityForCandidate', () => {
  it('q=0.90 on the plateau-with-tail fixture: both deltas exactly 0, PASS', () => {
    const fractions = buildPlateauWithTailFractions();
    const result = insensitivityForCandidate(fractions, 0.9, { tolerance: INSENSITIVITY_TOLERANCE });

    expect(result.base).toBeCloseTo(0.05, 9);
    expect(result.removedDelta).toBeCloseTo(0, 9);
    expect(result.plantedDelta).toBeCloseTo(0, 9);
    expect(result.pass).toBe(true);
  });

  it('q=0.95/0.97/0.99 on the same fixture: removedDelta exceeds the 1% tolerance, FAIL', () => {
    const fractions = buildPlateauWithTailFractions();
    for (const q of [0.95, 0.97, 0.99]) {
      const result = insensitivityForCandidate(fractions, q, { tolerance: INSENSITIVITY_TOLERANCE });
      expect(result.removedDelta, `q=${q}`).toBeGreaterThan(INSENSITIVITY_TOLERANCE);
      expect(result.pass, `q=${q}`).toBe(false);
    }
  });

  it('the removal step keeps exactly floor(n*0.9) of the sorted-ascending population', () => {
    const fractions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = insensitivityForCandidate(fractions, 0.5, { tolerance: 1 });
    expect(result.removedN).toBe(9); // floor(10*0.9)
  });

  it('the planted step appends PLANT_COUNT values at PLANT_MULTIPLIER x the population maximum', () => {
    const fractions = [1, 2, 3];
    const result = insensitivityForCandidate(fractions, 0.5, { tolerance: 1 });
    expect(result.plantedN).toBe(3 + PLANT_COUNT);
    // The planted values (30 = 3*10) sit above every original value, so the new max is 30.
    const sorted = [1, 2, 3, ...Array(PLANT_COUNT).fill(3 * PLANT_MULTIPLIER)];
    expect(result.plantedCut).toBe(quantile(sorted, 0.5));
  });

  it('reports null deltas (never divides by zero) on an empty population', () => {
    const result = insensitivityForCandidate([], 0.9, { tolerance: 0.01 });
    expect(result.base).toBeNull();
    expect(result.removedDelta).toBeNull();
    expect(result.plantedDelta).toBeNull();
    expect(result.pass).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// strawmanCandidate — the deliberately circular tail percentile, watched FAILING (Pitfall C)
// ---------------------------------------------------------------------------

describe('strawmanCandidate', () => {
  it('is a raw tail percentile (STRAWMAN_PERCENTILE) of the population itself, marked FAILED when its delta exceeds tolerance', () => {
    const fractions = buildPlateauWithTailFractions();
    const result = strawmanCandidate(fractions, { tolerance: INSENSITIVITY_TOLERANCE });

    expect(result.q).toBe(STRAWMAN_PERCENTILE);
    expect(result.base).toBeCloseTo(candidateCut(fractions, STRAWMAN_PERCENTILE), 9);
    expect(result.removedDelta).toBeGreaterThan(INSENSITIVITY_TOLERANCE);
    expect(result.pass).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// selectSevereCut — smallest-passing-q selection rule
// ---------------------------------------------------------------------------

describe('selectSevereCut', () => {
  it('selects the smallest q clearing the tolerance when multiple candidates are computed, skipping the failing ones', () => {
    const fractions = buildPlateauWithTailFractions();
    const selection = selectSevereCut(fractions, { tolerance: INSENSITIVITY_TOLERANCE });

    expect(selection.results).toHaveLength(CANDIDATE_OUTER_PERCENTILES.length);
    expect(selection.chosen).not.toBeNull();
    expect(selection.chosen.q).toBe(0.9);
    expect(selection.chosen.pass).toBe(true);
    // The three higher candidates are present in the full table but not chosen.
    const failingQs = selection.results.filter((r) => !r.pass).map((r) => r.q);
    expect(failingQs).toEqual([0.95, 0.97, 0.99]);
  });

  it('reports chosen: null and every candidate deltas when no candidate clears the tolerance (NO CANDIDATE CLEARS)', () => {
    const fractions = buildNoCandidateClearsFractions();
    const selection = selectSevereCut(fractions, { tolerance: INSENSITIVITY_TOLERANCE });

    expect(selection.chosen).toBeNull();
    expect(selection.results).toHaveLength(CANDIDATE_OUTER_PERCENTILES.length);
    for (const r of selection.results) {
      expect(r.pass).toBe(false);
      expect(r.removedDelta).not.toBeNull();
      expect(r.plantedDelta).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// buildFlaggedCohort / severityDistribution — real detectUnreliableSegments over synthetic streams
// ---------------------------------------------------------------------------

describe('buildFlaggedCohort', () => {
  it('includes only activities with >=1 detected segment, and reports a non-zero cohort size before any percentile is taken', () => {
    // Activity A: one clean isolated-jump burst (30 m in 1 s, well above the 7.35 m/s limit and
    // the 3 m excess floor; 30 m < 116.95 m hidden-pause boundary, so isolated-jump).
    const activityA = { id: 'A', t: [0, 1], d: [0, 30], gaps: [] };
    // Activity B: ordinary walking pace, no burst — detects nothing.
    const activityB = { id: 'B', t: [0, 1, 2], d: [0, 1, 2], gaps: [] };

    const archive = { activities: [activityA, activityB] };
    const cohort = buildFlaggedCohort(archive);

    expect(cohort.cohortSize).toBeGreaterThan(0);
    expect(cohort.members).toHaveLength(1);
    expect(cohort.members[0].id).toBe('A');
    // excess = 30 - 7.35*1 = 22.65; totalDistanceM = 30 - 0 = 30.
    expect(cohort.members[0].fraction).toBeCloseTo(22.65 / 30, 6);
    expect(cohort.fractions).toEqual([cohort.members[0].fraction]);
  });

  it('an archive with no flagged activity at all yields an empty cohort (cohortSize 0)', () => {
    const activityB = { id: 'B', t: [0, 1, 2], d: [0, 1, 2], gaps: [] };
    const cohort = buildFlaggedCohort({ activities: [activityB] });

    expect(cohort.members).toHaveLength(0);
    expect(cohort.fractions).toEqual([]);
    expect(cohort.cohortSize).toBe(0);
  });
});

describe('severityDistribution', () => {
  it('classifies none (zero segments) / minor (fraction <= cut) / severe (fraction > cut), reported finding only, never a selection input', () => {
    // A: isolated jump, fraction = 22.65/30 = 0.755
    const activityA = { id: 'A', t: [0, 1], d: [0, 30], gaps: [] };
    // B: no burst at all -> none
    const activityB = { id: 'B', t: [0, 1, 2], d: [0, 1, 2], gaps: [] };
    // C: a smaller isolated jump, excess = 20 - 7.35 = 12.65, fraction = 12.65/20 = 0.6325
    const activityC = { id: 'C', t: [0, 1], d: [0, 20], gaps: [] };

    const archive = { activities: [activityA, activityB, activityC] };

    // Cut of 0.7 puts A (0.755) above it (severe) and C (0.6325) at/below it (minor).
    const distribution = severityDistribution(archive, 0.7);

    expect(distribution.total).toBe(3);
    expect(distribution.none).toBe(1);
    expect(distribution.severe).toBe(1);
    expect(distribution.minor).toBe(1);
    expect(distribution.notComputable).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// renderCalibrationMarkdown — both the Chosen-constant and NO CANDIDATE CLEARS branches
// ---------------------------------------------------------------------------

describe('renderCalibrationMarkdown', () => {
  it('renders every required section and a named Chosen constant when a candidate clears', () => {
    const fractions = buildPlateauWithTailFractions();
    const selection = selectSevereCut(fractions, { tolerance: INSENSITIVITY_TOLERANCE });
    const strawman = strawmanCandidate(fractions, { tolerance: INSENSITIVITY_TOLERANCE });

    const archive = { activities: [{ id: 'X' }], streamFileCount: 1, notComputable: 0 };
    const cohort = { members: [{ id: 'X' }], fractions, cohortSize: 1, notComputableInCohort: 0 };
    const distribution = { none: 0, minor: 900, severe: 100, notComputable: 0, total: 1000 };

    const markdown = renderCalibrationMarkdown({ archive, cohort, selection, strawman, distribution });

    expect(markdown).toContain('## Non-circularity');
    expect(markdown).toContain('## Chosen constant');
    expect(markdown).toContain('## Why not a tail percentile of the population itself');
    expect(markdown).toContain('tail percentile');
    expect(markdown).toContain('## Archive-wide severe/minor/none distribution');
    expect(markdown).toContain('## Inputs');
    expect(markdown).not.toContain('NO CANDIDATE CLEARS');
    expect(markdown).toContain('FAILED');
  });

  it('renders a NO CANDIDATE CLEARS section and never a "Chosen constant" value when nothing passes', () => {
    const fractions = buildNoCandidateClearsFractions();
    const selection = selectSevereCut(fractions, { tolerance: INSENSITIVITY_TOLERANCE });
    const strawman = strawmanCandidate(fractions, { tolerance: INSENSITIVITY_TOLERANCE });

    const archive = { activities: [{ id: 'X' }], streamFileCount: 1, notComputable: 0 };
    const cohort = { members: [{ id: 'X' }], fractions, cohortSize: 1, notComputableInCohort: 0 };
    const distribution = { none: 0, minor: 0, severe: 0, notComputable: 0, total: 1 };

    const markdown = renderCalibrationMarkdown({ archive, cohort, selection, strawman, distribution });

    expect(markdown).toContain('## NO CANDIDATE CLEARS');
    expect(markdown).not.toContain('## Chosen constant\n');
    expect(markdown).toContain('## Non-circularity');
    expect(markdown).toContain('## Why not a tail percentile of the population itself');
  });
});

// ===========================================================================
// Plan 33-14 (D-16): perturbation views, the four pre-declared reference
// shapes, the step-level D-13 harness, first-clearing arbitration
// ===========================================================================

/** A single clean or bursty synthetic activity: `numSteps` pairs of `cleanStepMetres` m/1s each,
 * except at `burstAt` (if in range) where the pair jumps `burstMetres` m/1s instead — well above
 * `DEFAULT_DETECTOR_PARAMS.speedLimitMps` and its excess floor, so it detects as one isolated-jump
 * segment. `burstAt: -1` (default) never matches, giving a wholly clean activity. */
function buildSyntheticActivity(
  id,
  { numSteps = 20, burstAt = -1, burstMetres = 50, cleanStepMetres = 2 } = {}
) {
  const t = [0];
  const d = [0];
  for (let i = 0; i < numSteps; i++) {
    t.push(i + 1);
    d.push(d[d.length - 1] + (i === burstAt ? burstMetres : cleanStepMetres));
  }
  return { id, t, d, gaps: [] };
}

/** A bulk-dominated archive (D-13 harness's own CAN-PASS shape): 100 activities of 20 steps each
 * (2,000 pooled ordinary steps), exactly 3 of which (the source activity plus two others) carry one
 * detected isolated-jump burst apiece — a genuine minority, never a majority, of the population. */
function buildBulkDominatedArchive() {
  const activities = [
    buildSyntheticActivity(PLANT_SOURCE_ACTIVITY_ID, { burstAt: 10 }),
    buildSyntheticActivity('A010', { burstAt: 5 }),
    buildSyntheticActivity('A020', { burstAt: 15 }),
  ];
  for (let i = 0; i < 97; i++) {
    activities.push(buildSyntheticActivity(`A${String(i + 100).padStart(3, '0')}`));
  }
  return { activities };
}

describe('reference shape order (PREDECLARED_SHAPES)', () => {
  it('is a frozen array whose ids are, in order, R1, R2, R3, R4 — pinned by a literal', () => {
    expect(PREDECLARED_SHAPES.map((s) => s.id)).toEqual(['R1', 'R2', 'R3', 'R4']);
    expect(Object.isFrozen(PREDECLARED_SHAPES)).toBe(true);
    for (const shape of PREDECLARED_SHAPES) {
      expect(Object.isFrozen(shape)).toBe(true);
      expect(typeof shape.derive).toBe('function');
      expect(typeof shape.meaning).toBe('string');
      expect(typeof shape.nonCircularityArgument).toBe('string');
      expect(typeof shape.caveats).toBe('string');
    }
  });

  it('the REJECTED_SHAPES list is a non-empty array of considered-and-rejected prose, never a candidate row', () => {
    expect(Array.isArray(REJECTED_SHAPES)).toBe(true);
    expect(REJECTED_SHAPES.length).toBeGreaterThan(0);
    for (const entry of REJECTED_SHAPES) expect(typeof entry).toBe('string');
  });
});

describe('D-13 harness: buildBaseViews', () => {
  it('one view per activity: steps from advanceSteps, totalDistanceM = d[n-1]-d[0], excessList = detected excessMetres', () => {
    const burstActivity = buildSyntheticActivity('BURST', { burstAt: 0, numSteps: 1 });
    const cleanActivity = buildSyntheticActivity('CLEAN', { numSteps: 2 });
    const archive = { activities: [burstActivity, cleanActivity] };

    const views = buildBaseViews(archive);
    expect(views).toHaveLength(2);

    const burstView = views.find((v) => v.id === 'BURST');
    // metres=50, seconds=1 -> excess = 50 - 7.35*1 = 42.65
    expect(burstView.steps).toHaveLength(1);
    expect(burstView.totalDistanceM).toBe(50);
    expect(burstView.excessList).toHaveLength(1);
    expect(burstView.excessList[0]).toBeCloseTo(50 - DEFAULT_DETECTOR_PARAMS.speedLimitMps * 1, 9);

    const cleanView = views.find((v) => v.id === 'CLEAN');
    expect(cleanView.steps).toHaveLength(2);
    expect(cleanView.totalDistanceM).toBe(4);
    expect(cleanView.excessList).toEqual([]);
  });
});

describe('D-13 harness: buildRemovedViews', () => {
  it('drops exactly the steps inside a burst part, subtracts their metres, empties excessList', () => {
    // Step0 (0-1): 30m/1s burst (isolated jump, excess 30-7.35=22.65). Step1 (1-2): 2m/1s clean.
    const activity = { id: 'X', t: [0, 1, 2], d: [0, 30, 32], gaps: [] };
    const archive = { activities: [activity] };
    const base = buildBaseViews(archive);
    expect(base[0].steps).toHaveLength(2);
    expect(base[0].excessList).toHaveLength(1);

    const { views, removedStepCount, changedDistanceActivityCount } = buildRemovedViews(archive, base);
    expect(views).toHaveLength(1);
    expect(views[0].steps).toHaveLength(1);
    expect(views[0].steps[0].metres).toBe(2); // the clean step survives
    expect(views[0].totalDistanceM).toBe(2); // 32 - 30 dropped
    expect(views[0].excessList).toEqual([]);
    expect(removedStepCount).toBe(1);
    expect(changedDistanceActivityCount).toBe(1);
  });

  it('an activity with no detected segment is returned unchanged', () => {
    const activity = buildSyntheticActivity('CLEAN', { numSteps: 3 });
    const archive = { activities: [activity] };
    const base = buildBaseViews(archive);

    const { views, removedStepCount, changedDistanceActivityCount } = buildRemovedViews(archive, base);
    expect(views[0]).toEqual(base[0]);
    expect(removedStepCount).toBe(0);
    expect(changedDistanceActivityCount).toBe(0);
  });
});

describe('D-13 harness: buildPlantedViews', () => {
  it('plants round-robin by sorted id until plantedCount equals the archive-wide detected segment count', () => {
    const source = buildSyntheticActivity(PLANT_SOURCE_ACTIVITY_ID, { burstAt: 5 });
    const other = buildSyntheticActivity('Z', { numSteps: 3 });
    const archive = { activities: [source, other] };
    const base = buildBaseViews(archive);

    const result = buildPlantedViews(archive, base);
    expect(result.sourceBurstPartCount).toBe(1);
    expect(result.detectedSegmentCount).toBe(1); // only the source has a segment
    expect(result.plantedCount).toBe(1);
    expect(result.changedDistanceActivityCount).toBe(1);

    // sortedIds = ['3475724402', 'Z'] (digits sort before letters) -> the plant lands on the source
    // itself (cursor 0 % 2 === 0).
    const plantedSource = result.views.find((v) => v.id === PLANT_SOURCE_ACTIVITY_ID);
    const plantedOther = result.views.find((v) => v.id === 'Z');
    expect(plantedSource.steps.length).toBe(base.find((v) => v.id === PLANT_SOURCE_ACTIVITY_ID).steps.length + 1);
    expect(plantedOther.steps.length).toBe(base.find((v) => v.id === 'Z').steps.length);

    const plantedStep = plantedSource.steps[plantedSource.steps.length - 1];
    expect(plantedStep.startIndex).toBeLessThan(0);
    expect(plantedStep.endIndex).toBeLessThan(0);
    expect(plantedStep.metres).toBe(50);
    expect(plantedSource.totalDistanceM).toBe(
      base.find((v) => v.id === PLANT_SOURCE_ACTIVITY_ID).totalDistanceM + 50
    );
    // burst excess 50 - 7.35*1 = 42.65 > excessFloorMetres(3) -> appended
    expect(plantedSource.excessList).toHaveLength(2); // the original detected excess + the planted one
  });

  it('with zero source burst shapes, plants nothing (plantedCount 0), never a vacuous pass', () => {
    const noSource = buildSyntheticActivity('OTHER1', { burstAt: 2 }); // has a segment, but wrong id
    const clean = buildSyntheticActivity('OTHER2', { numSteps: 2 });
    const archive = { activities: [noSource, clean] };
    const base = buildBaseViews(archive);

    const result = buildPlantedViews(archive, base);
    expect(result.sourceBurstPartCount).toBe(0);
    expect(result.plantedCount).toBe(0);
    expect(result.views).toEqual(base);
  });
});

describe('reference shape R1 (accumulated ordinary step noise)', () => {
  function step(startIndex, endIndex, metres, seconds) {
    return { startIndex, endIndex, startSec: startIndex, endSec: endIndex, metres, seconds };
  }

  it('a hand-built activity of constant-speed steps has sigma 0 (epsilon 0)', () => {
    const steps = [
      step(0, 1, 5, 1),
      step(1, 2, 5, 1),
      step(2, 3, 5, 1),
      step(3, 4, 5, 1),
      step(4, 5, 5, 1),
    ];
    const view = { id: 'A', steps, totalDistanceM: 25, excessList: [] };
    const result = shapeR1([view]);
    expect(result.value).toBeCloseTo(0, 9);
    expect(result.n).toBe(1);
  });

  it('adding a known alternating residual yields the hand-computed epsilon', () => {
    // Speeds 4,6,4,6,4 m/s at 1s each -> interior residuals (i=1,2,3) all |Δ|=2.
    const steps = [step(0, 1, 4, 1), step(1, 2, 6, 1), step(2, 3, 4, 1), step(3, 4, 6, 1), step(4, 5, 4, 1)];
    const totalDistanceM = 4 + 6 + 4 + 6 + 4;
    const view = { id: 'A', steps, totalDistanceM, excessList: [] };

    const result = shapeR1([view]);
    const sigma = 1.4826 * 2 * Math.sqrt(2 / 3);
    const expectedEpsilon = (sigma * Math.sqrt(5)) / totalDistanceM;
    expect(result.value).toBeCloseTo(expectedEpsilon, 9);
  });

  it('a planted non-contiguous step enters n and totalDistanceM but contributes NO residual', () => {
    const steps = [
      step(0, 1, 4, 1),
      step(1, 2, 6, 1),
      step(2, 3, 4, 1),
      step(3, 4, 6, 1),
      step(4, 5, 4, 1),
      { startIndex: -1, endIndex: -1, startSec: 0, endSec: 5, metres: 50, seconds: 5 }, // sentinel plant
    ];
    const totalDistanceM = 4 + 6 + 4 + 6 + 4 + 50;
    const view = { id: 'A', steps, totalDistanceM, excessList: [] };

    const result = shapeR1([view]);
    // Same three residuals (2,2,2) survive — the sentinel breaks contiguity at i=4 (its
    // startIndex -1 !== the real step's endIndex 5) so it contributes no fourth residual.
    const sigma = 1.4826 * 2 * Math.sqrt(2 / 3);
    const expectedEpsilon = (sigma * Math.sqrt(6)) / totalDistanceM;
    expect(result.value).toBeCloseTo(expectedEpsilon, 9);
  });

  it('a removed burst leaves no residual spanning the hole (excluded, not coerced to 0)', () => {
    // The alternating fixture with its middle step (index 2) deleted — the survivors' indices no
    // longer touch across the hole, so every interior triple fails the contiguity test.
    const steps = [step(0, 1, 4, 1), step(1, 2, 6, 1), step(3, 4, 6, 1), step(4, 5, 4, 1)];
    const view = { id: 'A', steps, totalDistanceM: 20, excessList: [] };

    const result = shapeR1([view]);
    expect(result.value).toBeNull();
    expect(result.n).toBe(0);
    expect(result.excluded).toBe(1);
  });

  it('returns null, never 0, on an empty reference population', () => {
    expect(shapeR1([])).toEqual({ value: null, n: 0, excluded: 0 });
  });

  it('excludes and counts a zero-distance or zero-step activity, never coercing it to 0', () => {
    const degenerate = { id: 'D', steps: [], totalDistanceM: 0, excessList: [] };
    const result = shapeR1([degenerate]);
    expect(result.value).toBeNull();
    expect(result.excluded).toBe(1);
  });
});

describe('reference shape R2 (own-distance step share, bulk-of-bulk)', () => {
  it('hand-computed value: per-activity R-7 p95 of step-share, then R-7 p90 across activities', () => {
    const viewX = {
      id: 'X',
      totalDistanceM: 100,
      steps: [10, 5, 20].map((metres) => ({ metres })),
      excessList: [],
    };
    const viewY = {
      id: 'Y',
      totalDistanceM: 50,
      steps: [8, 2].map((metres) => ({ metres })),
      excessList: [],
    };

    const sharesX = [10 / 100, 5 / 100, 20 / 100].sort((a, b) => a - b);
    const sharesY = [8 / 50, 2 / 50].sort((a, b) => a - b);
    const perActivity = [quantile(sharesX, 0.95), quantile(sharesY, 0.95)].sort((a, b) => a - b);
    const expected = quantile(perActivity, 0.9);

    const result = shapeR2([viewX, viewY]);
    expect(result.value).toBeCloseTo(expected, 9);
    expect(result.n).toBe(2);
  });

  it('excludes and counts a zero-distance or zero-step activity', () => {
    const degenerate = { id: 'D', steps: [], totalDistanceM: 0, excessList: [] };
    const result = shapeR2([degenerate]);
    expect(result.value).toBeNull();
    expect(result.excluded).toBe(1);
  });

  it('returns null, never 0, on an empty reference population', () => {
    expect(shapeR2([])).toEqual({ value: null, n: 0, excluded: 0 });
  });
});

describe('reference shape R3 (bulk step over bulk distance)', () => {
  it('hand-computed value: p90 of pooled step metres over p50 of activity distances', () => {
    const viewX = {
      id: 'X',
      totalDistanceM: 100,
      steps: [10, 5, 20].map((metres) => ({ metres })),
      excessList: [],
    };
    const viewY = {
      id: 'Y',
      totalDistanceM: 50,
      steps: [8, 2].map((metres) => ({ metres })),
      excessList: [],
    };

    const pooledMetres = [10, 5, 20, 8, 2].sort((a, b) => a - b);
    const distances = [100, 50].sort((a, b) => a - b);
    const expected = quantile(pooledMetres, 0.9) / quantile(distances, 0.5);

    const result = shapeR3([viewX, viewY]);
    expect(result.value).toBeCloseTo(expected, 9);
    expect(result.n).toBe(2);
  });

  it('excludes and counts a zero-distance or zero-step activity', () => {
    const degenerate = { id: 'D', steps: [], totalDistanceM: 0, excessList: [] };
    const result = shapeR3([degenerate]);
    expect(result.value).toBeNull();
    expect(result.excluded).toBe(1);
  });

  it('returns null, never 0, on an empty reference population', () => {
    expect(shapeR3([])).toEqual({ value: null, n: 0, excluded: 0 });
  });
});

describe('reference shape R4 (hidden-pause boundary over bulk distance)', () => {
  it('hand-computed value: hiddenPauseMinMetres (from params, never a literal) over p50 of distances', () => {
    const viewX = { id: 'X', totalDistanceM: 100, steps: [{ metres: 1 }], excessList: [] };
    const viewY = { id: 'Y', totalDistanceM: 50, steps: [{ metres: 1 }], excessList: [] };

    const distances = [100, 50].sort((a, b) => a - b);
    const expected = DEFAULT_DETECTOR_PARAMS.hiddenPauseMinMetres / quantile(distances, 0.5);

    const result = shapeR4([viewX, viewY], DEFAULT_DETECTOR_PARAMS);
    expect(result.value).toBeCloseTo(expected, 9);
  });

  it('reads the constant from params, not a literal — a different params value moves the result', () => {
    const view = { id: 'X', totalDistanceM: 100, steps: [{ metres: 1 }], excessList: [] };
    const resultDefault = shapeR4([view], DEFAULT_DETECTOR_PARAMS);
    const resultOverridden = shapeR4([view], { ...DEFAULT_DETECTOR_PARAMS, hiddenPauseMinMetres: 200 });
    expect(resultOverridden.value).toBeCloseTo(200 / 100, 9);
    expect(resultOverridden.value).not.toBeCloseTo(resultDefault.value, 9);
  });

  it('excludes and counts a zero-distance or zero-step activity', () => {
    const degenerate = { id: 'D', steps: [], totalDistanceM: 0, excessList: [] };
    const result = shapeR4([degenerate], DEFAULT_DETECTOR_PARAMS);
    expect(result.value).toBeNull();
    expect(result.excluded).toBe(1);
  });

  it('returns null, never 0, on an empty reference population', () => {
    const result = shapeR4([], DEFAULT_DETECTOR_PARAMS);
    expect(result.value).toBeNull();
  });
});

describe('D-13 harness: CAN PASS (R3 on a bulk-dominated synthetic archive)', () => {
  it('both deltas are at or below 1% — three bursts among 2,000 pooled ordinary steps barely move R3', () => {
    const archive = buildBulkDominatedArchive();
    const base = buildBaseViews(archive);
    const removed = buildRemovedViews(archive, base);
    const planted = buildPlantedViews(archive, base);

    // Non-vacuity, asserted before any delta is trusted.
    expect(removed.removedStepCount).toBeGreaterThan(0);
    expect(planted.plantedCount).toBeGreaterThanOrEqual(planted.detectedSegmentCount);
    expect(planted.detectedSegmentCount).toBeGreaterThan(0);
    expect(planted.sourceBurstPartCount).toBeGreaterThan(0);

    const result = evaluateShape(
      shapeR3,
      { base, removed: removed.views, planted: planted.views },
      { tolerance: INSENSITIVITY_TOLERANCE }
    );

    expect(result.removedDelta).not.toBeNull();
    expect(result.plantedDelta).not.toBeNull();
    expect(result.removedDelta).toBeLessThanOrEqual(INSENSITIVITY_TOLERANCE);
    expect(result.plantedDelta).toBeLessThanOrEqual(INSENSITIVITY_TOLERANCE);
    expect(result.pass).toBe(true);
  });
});

describe('D-13 harness: CAN FAIL (permanent negative control — the strawman on the same archive)', () => {
  it('the strawman statistic run through the SAME evaluateShape is verdict FAIL (removal empties its own population)', () => {
    const archive = buildBulkDominatedArchive();
    const base = buildBaseViews(archive);
    const removed = buildRemovedViews(archive, base);
    const planted = buildPlantedViews(archive, base);

    const baseStrawman = strawmanFromViews(base);
    expect(baseStrawman.value).not.toBeNull();
    expect(baseStrawman.value).toBeGreaterThan(0);

    const result = evaluateShape(
      (views) => strawmanFromViews(views),
      { base, removed: removed.views, planted: planted.views },
      { tolerance: INSENSITIVITY_TOLERANCE }
    );

    // Removing every detected burst empties the excess-fraction population entirely (all three
    // flagged activities lose their only excessList entries) — the most extreme sensitivity there
    // is, verdict FAIL by the null-is-FAIL rule, never a vacuous pass.
    expect(result.removed).toBeNull();
    expect(result.removedDelta).toBeNull();
    expect(result.pass).toBe(false);
  });
});

describe('strawmanFromViews', () => {
  it('is the R-7 STRAWMAN_PERCENTILE of excess fractions over views with a non-empty excessList', () => {
    const flagged = { id: 'A', totalDistanceM: 100, steps: [], excessList: [10, 5] };
    const clean = { id: 'B', totalDistanceM: 50, steps: [], excessList: [] };
    const result = strawmanFromViews([flagged, clean]);
    expect(result.value).toBeCloseTo(15 / 100, 9);
    expect(result.n).toBe(1);
  });

  it('returns null, never 0, when no view carries a non-empty excessList', () => {
    const clean = { id: 'B', totalDistanceM: 50, steps: [], excessList: [] };
    expect(strawmanFromViews([clean])).toEqual({ value: null, n: 0 });
  });
});

describe('evaluateShape', () => {
  it('a null base makes both deltas null and pass false, never dividing by zero', () => {
    const nullDerive = () => ({ value: null, n: 0 });
    const result = evaluateShape(nullDerive, { base: [], removed: [], planted: [] }, { tolerance: 0.01 });
    expect(result.removedDelta).toBeNull();
    expect(result.plantedDelta).toBeNull();
    expect(result.pass).toBe(false);
  });

  it('a zero base makes both deltas null and pass false (never a divide-by-zero)', () => {
    const zeroDerive = () => ({ value: 0, n: 1 });
    const result = evaluateShape(zeroDerive, { base: [], removed: [], planted: [] }, { tolerance: 0.01 });
    expect(result.removedDelta).toBeNull();
    expect(result.plantedDelta).toBeNull();
    expect(result.pass).toBe(false);
  });
});
