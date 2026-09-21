/**
 * Guard test for the pure helpers exported by compute-unreliable-segment-severity-calibration.mjs
 * (Phase 33 plan 08, D-07). Importing this module must not run an archive read or a write to
 * 33-CALIBRATION.md — if it does, the self-execution guard documented at the bottom of that file is
 * wrong and must be fixed rather than worked around here.
 *
 * This file reads EXACTLY FOUR named stream files under `data/streams/` (the shipped-constant
 * named-activity tiering cases at the bottom, plan 33-14 Task 4) — 3475734189, 10146303423,
 * 3475724402, 3475740390 — and still never scans the archive: every other fixture above those cases
 * is hand-built, mirroring compute-unreliable-segment-calibration.test.mjs's own "no archive reads"
 * contract. The archive-shaped fixtures used by `buildFlaggedCohort`/`severityDistribution` DO run
 * the real `detectUnreliableSegments` (imported from `dist/`), because that IS what those functions
 * call — but their `t`/`d`/`gaps` inputs are all synthetic, never a read from `data/streams/`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { classifyGapsThreeWay, quantile } from '../dist/analytics/pace-derivation.js';
import { UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION } from '../dist/analytics/pace-quality.js';
import { DEFAULT_DETECTOR_PARAMS, detectUnreliableSegments } from '../dist/analytics/unreliable-segments.js';
import {
  ANCHOR_CONTROL_ACTIVITY_ID,
  ANCHOR_SEVERE_ACTIVITY_ID,
  CANDIDATE_OUTER_PERCENTILES,
  FINDING_ACTIVITY_IDS,
  INSENSITIVITY_TOLERANCE,
  PLANT_COUNT,
  PLANT_MULTIPLIER,
  PLANT_SOURCE_ACTIVITY_ID,
  PREDECLARED_SHAPES,
  REJECTED_SHAPES,
  STRAWMAN_PERCENTILE,
  activityExcessFraction,
  anchorCheck,
  buildBaseViews,
  buildFlaggedCohort,
  buildPlantedViews,
  buildRemovedViews,
  candidateCut,
  ceilToSignificant,
  classifyActivityTier,
  decideOutcome,
  evaluateShape,
  formatShippedConstant,
  insensitivityForCandidate,
  renderCalibrationMarkdown,
  runShapeArbitration,
  selectShape,
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

/** A minimal, hand-built `arbitration`-shaped fixture for `renderCalibrationMarkdown` tests — the
 * rendering function's own unit tests exercise the RENDERING logic, not shape derivation (that's
 * `reference shape R1..R4` and `D-13 harness` above), mirroring 33-08's own render-test idiom of
 * hand-building `selection`/`strawman` objects directly. */
function buildArbitrationFixture({ chosenId = 'R1', strawmanPasses = false } = {}) {
  return {
    tolerance: INSENSITIVITY_TOLERANCE,
    strawman: {
      base: 0.05,
      baseN: 10,
      removed: strawmanPasses ? 0.05 : 0.09,
      removedN: 9,
      planted: strawmanPasses ? 0.05 : 0.2,
      plantedN: 15,
      removedDelta: strawmanPasses ? 0 : 0.8,
      plantedDelta: strawmanPasses ? 0 : 3,
      pass: strawmanPasses,
    },
    rows: PREDECLARED_SHAPES.map((shape) => ({
      id: shape.id,
      label: shape.label,
      meaning: shape.meaning,
      nonCircularityArgument: shape.nonCircularityArgument,
      caveats: shape.caveats,
      base: 0.02,
      baseN: 100,
      baseExcluded: 0,
      removed: shape.id === chosenId ? 0.02 : 0.09,
      removedN: 90,
      planted: shape.id === chosenId ? 0.02 : 0.2,
      plantedN: 125,
      removedDelta: shape.id === chosenId ? 0 : 0.9,
      plantedDelta: shape.id === chosenId ? 0 : 3,
      pass: shape.id === chosenId,
    })),
    nonVacuity: {
      removedStepCount: 5,
      plantedCount: 3,
      detectedSegmentCount: 3,
      sourceBurstPartCount: 2,
      removedChangedDistanceActivityCount: 3,
      plantedChangedDistanceActivityCount: 3,
    },
  };
}

function buildLegacyFixture() {
  const fractions = buildPlateauWithTailFractions();
  return {
    cohort: { members: [{ id: 'X' }], fractions, cohortSize: 1, notComputableInCohort: 0 },
    selection: selectSevereCut(fractions, { tolerance: INSENSITIVITY_TOLERANCE }),
    strawman: strawmanCandidate(fractions, { tolerance: INSENSITIVITY_TOLERANCE }),
  };
}

describe('shape arbitration: renderCalibrationMarkdown', () => {
  it('renders every required section and a named Chosen constant when a shape clears', () => {
    const archive = { activities: [{ id: 'X' }], streamFileCount: 1, notComputable: 0 };
    const arbitration = buildArbitrationFixture({ chosenId: 'R1' });
    const chosen = { row: arbitration.rows[0], rawValue: 0.02, roundedValue: 0.0201 };
    const shippedComparison = {
      liveDerivedFormatted: '0.0201',
      shipped: undefined,
      shippedFormatted: null,
      equal: false,
      notYetShipped: true,
    };
    const anchor = {
      severe: {
        id: '3475734189',
        found: true,
        segmentCount: 1,
        excessMetresSum: 122.7,
        totalDistanceM: 6830.3,
        fraction: 0.017964,
        tier: 'severe',
      },
      control: {
        id: '10146303423',
        found: true,
        segmentCount: 0,
        excessMetresSum: 0,
        totalDistanceM: 7096.6,
        fraction: null,
        tier: 'none',
      },
      findings: [],
      pass: true,
    };
    const distribution = { none: 1800, minor: 60, severe: 14, notComputable: 0, total: 1874 };

    const markdown = renderCalibrationMarkdown({
      archive,
      provenance: { streamsTree: 'abc123' },
      arbitration,
      chosen,
      shippedComparison,
      anchor,
      distribution,
      legacy: buildLegacyFixture(),
      exitReason: null,
    });

    expect(markdown).toContain('## Statistic');
    expect(markdown).toContain('## Pre-declared reference shapes (D-16)');
    expect(markdown).toContain('## Non-circularity');
    expect(markdown).toContain('## Strawman watched failing (D-13 harness)');
    expect(markdown).toContain('## Shape arbitration (D-13 insensitivity)');
    expect(markdown).toContain('## Chosen constant');
    expect(markdown).toMatch(/\*\*UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION = 0\.0201\*\*/);
    expect(markdown).toContain('## D-07 anchor check');
    expect(markdown).toContain('## Archive-wide severe/minor/none distribution');
    expect(markdown).toContain('## Recorded negative finding');
    expect(markdown).toContain('### Why not a tail percentile of the population itself (33-08)');
    expect(markdown).toContain('## Inputs');
    expect(markdown).not.toContain('## NO SHAPE CLEARS');
  });

  it('renders a NO SHAPE CLEARS section and never a "Chosen constant" value when nothing clears', () => {
    const archive = { activities: [{ id: 'X' }], streamFileCount: 1, notComputable: 0 };
    const arbitration = buildArbitrationFixture({ chosenId: null });

    const markdown = renderCalibrationMarkdown({
      archive,
      provenance: { streamsTree: 'abc123' },
      arbitration,
      chosen: null,
      shippedComparison: null,
      anchor: null,
      distribution: null,
      legacy: buildLegacyFixture(),
      exitReason: 'no-shape-clears',
    });

    expect(markdown).toContain('## NO SHAPE CLEARS');
    expect(markdown).not.toContain('## Chosen constant\n');
    expect(markdown).not.toMatch(/\*\*UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION = /);
    expect(markdown).toContain('## Non-circularity');
    expect(markdown).toContain('## Recorded negative finding');
    expect(markdown).toContain('### Why not a tail percentile of the population itself (33-08)');
  });

  it('renders a BLOCKER outcome and no constant when the strawman itself passes', () => {
    const archive = { activities: [{ id: 'X' }], streamFileCount: 1, notComputable: 0 };
    const arbitration = buildArbitrationFixture({ chosenId: null, strawmanPasses: true });

    const markdown = renderCalibrationMarkdown({
      archive,
      provenance: { streamsTree: 'abc123' },
      arbitration,
      chosen: null,
      shippedComparison: null,
      anchor: null,
      distribution: null,
      legacy: buildLegacyFixture(),
      exitReason: 'strawman-blocker',
    });

    expect(markdown).toContain('## NO SHAPE CLEARS');
    expect(markdown).toContain('BLOCKER');
    expect(markdown).not.toMatch(/\*\*UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION = /);
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

// ===========================================================================
// Task 2: first-clearing arbitration, direction-safe rounding, generated
// prose, and the exit-code contract (all named so `-t "shape arbitration"`
// selects them)
// ===========================================================================

describe('shape arbitration: selectShape (anti-quota)', () => {
  it('selects the first passing row in array order — a later pass never beats an earlier one', () => {
    const rows = [
      { id: 'R1', pass: false },
      { id: 'R2', pass: true },
      { id: 'R3', pass: true },
    ];
    expect(selectShape(rows)).toBe('R2');
  });

  it('returns null when no row passes', () => {
    expect(
      selectShape([
        { id: 'R1', pass: false },
        { id: 'R2', pass: false },
      ])
    ).toBeNull();
  });

  it('returns null on an empty row list', () => {
    expect(selectShape([])).toBeNull();
  });

  it("its own source text reads only `.id` and `.pass` — structurally incapable of a cut, count, rate or activity id reaching it", () => {
    const source = selectShape.toString();
    const propertyReads = [...source.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_]*)/g)].map((m) => m[1]);
    expect(propertyReads.length).toBeGreaterThan(0);
    for (const prop of propertyReads) {
      expect(['id', 'pass']).toContain(prop);
    }
  });
});

describe('shape arbitration: ceilToSignificant', () => {
  it('0.0123401 gives 0.0124', () => {
    expect(ceilToSignificant(0.0123401)).toBeCloseTo(0.0124, 12);
  });

  it('a value already exact at 3 significant figures comes back UNCHANGED', () => {
    expect(ceilToSignificant(0.0123)).toBeCloseTo(0.0123, 12);
    expect(ceilToSignificant(0.00999)).toBeCloseTo(0.00999, 12);
    expect(ceilToSignificant(0.1)).toBeCloseTo(0.1, 12);
  });

  it('0.00099901 gives 0.001', () => {
    expect(ceilToSignificant(0.00099901)).toBeCloseTo(0.001, 12);
  });

  it('null gives null; 0 gives 0', () => {
    expect(ceilToSignificant(null)).toBeNull();
    expect(ceilToSignificant(0)).toBe(0);
  });

  it('rounds UP, never down, so it can only ever call FEWER activities severe', () => {
    const raw = 0.035713802737883264; // 33-08's own legacy q=0.99 cut, an irrational-looking real value
    const rounded = ceilToSignificant(raw);
    expect(rounded).toBeGreaterThanOrEqual(raw);
  });
});

describe('shape arbitration: formatShippedConstant', () => {
  it('renders plain decimal notation with exactly 3 significant figures, trailing zeros included', () => {
    expect(formatShippedConstant(0.0124)).toBe('0.0124');
    expect(formatShippedConstant(0.001)).toBe('0.00100');
    expect(formatShippedConstant(0.1)).toBe('0.100');
  });

  it('never renders exponent notation, even for a very small value', () => {
    const formatted = formatShippedConstant(0.0000123);
    expect(formatted).not.toMatch(/e/i);
  });

  it('null renders as an em dash', () => {
    expect(formatShippedConstant(null)).toBe('—');
  });
});

describe('shape arbitration: classifyActivityTier', () => {
  it('zero segments -> none, under any cut', () => {
    expect(classifyActivityTier([], 100, 0.001)).toBe('none');
    expect(classifyActivityTier([], 100, 999)).toBe('none');
  });

  it('fraction strictly greater than cut -> severe; equal to cut -> minor', () => {
    expect(classifyActivityTier([{ excessMetres: 10 }], 100, 0.05)).toBe('severe'); // 0.1 > 0.05
    expect(classifyActivityTier([{ excessMetres: 5 }], 100, 0.05)).toBe('minor'); // 0.05 == 0.05
  });

  it('a degenerate totalDistanceM with at least one segment -> not-computable, never none', () => {
    expect(classifyActivityTier([{ excessMetres: 10 }], 0, 0.05)).toBe('not-computable');
    expect(classifyActivityTier([{ excessMetres: 10 }], -5, 0.05)).toBe('not-computable');
    expect(classifyActivityTier([{ excessMetres: 10 }], NaN, 0.05)).toBe('not-computable');
  });

  it('accepts a plain excess-value array identically to a segment array', () => {
    expect(classifyActivityTier([10], 100, 0.05)).toBe('severe');
  });
});

describe('shape arbitration: anchorCheck', () => {
  it('passes when the severe anchor tiers severe and the control anchor tiers none', () => {
    const severeActivity = buildSyntheticActivity(ANCHOR_SEVERE_ACTIVITY_ID, { burstAt: 3, burstMetres: 200 });
    const controlActivity = buildSyntheticActivity(ANCHOR_CONTROL_ACTIVITY_ID, { numSteps: 5 });
    const archive = { activities: [severeActivity, controlActivity] };

    const result = anchorCheck(archive, 0.01);
    expect(result.severe.found).toBe(true);
    expect(result.severe.tier).toBe('severe');
    expect(result.control.found).toBe(true);
    expect(result.control.tier).toBe('none');
    expect(result.pass).toBe(true);
  });

  it('fails when the severe anchor does not tier severe under the given cut', () => {
    const severeActivity = buildSyntheticActivity(ANCHOR_SEVERE_ACTIVITY_ID, { burstAt: 3, burstMetres: 200 });
    const controlActivity = buildSyntheticActivity(ANCHOR_CONTROL_ACTIVITY_ID, { numSteps: 5 });
    const archive = { activities: [severeActivity, controlActivity] };

    const result = anchorCheck(archive, 100); // a cut nothing clears
    expect(result.severe.tier).toBe('minor');
    expect(result.pass).toBe(false);
  });

  it('reports found: false for a missing named activity, never coercing to a pass', () => {
    const result = anchorCheck({ activities: [] }, 0.01);
    expect(result.severe.found).toBe(false);
    expect(result.control.found).toBe(false);
    expect(result.pass).toBe(false);
  });

  it('renders FINDING_ACTIVITY_IDS as findings without gating pass/fail on them', () => {
    const severeActivity = buildSyntheticActivity(ANCHOR_SEVERE_ACTIVITY_ID, { burstAt: 3, burstMetres: 200 });
    const controlActivity = buildSyntheticActivity(ANCHOR_CONTROL_ACTIVITY_ID, { numSteps: 5 });
    const archive = { activities: [severeActivity, controlActivity] };

    const result = anchorCheck(archive, 0.01);
    expect(result.findings).toHaveLength(FINDING_ACTIVITY_IDS.length);
    expect(result.findings.every((f) => f.found === false)).toBe(true); // absent from this synthetic archive
    expect(result.pass).toBe(true); // findings never gate pass/fail
  });
});

describe('shape arbitration: runShapeArbitration', () => {
  it('selects the FIRST passing row in table order — never a later-passing row, never the strawman', () => {
    const archive = buildBulkDominatedArchive();
    const result = runShapeArbitration(archive, { tolerance: INSENSITIVITY_TOLERANCE });

    expect(result.rows).toHaveLength(4);
    expect(result.strawmanBlocked).toBe(false);
    // On this bulk-dominated fixture, R2/R3/R4 all clear trivially (0%/0% deltas) but R1 does not
    // (its base value is exactly 0 on a wholly constant-speed population, which is verdict FAIL by
    // the null-is-FAIL rule) — the selection must be the FIRST passing row, not just any passing row.
    const firstPassingId = result.rows.find((r) => r.pass)?.id ?? null;
    expect(firstPassingId).not.toBeNull();
    expect(result.selectedId).toBe(firstPassingId);
    expect(result.chosenRow.id).toBe(firstPassingId);
    expect(result.nonVacuityOk).toBe(true);
  });
});

describe('shape arbitration: strawmanBlocked forces null selection (structural)', () => {
  it("runShapeArbitration's own source short-circuits selection to null when the strawman passes", () => {
    // buildRemovedViews always empties EVERY flagged activity's excessList entirely (never
    // partially), so the strawman's own removed population is always null by construction — it can
    // never actually pass through the real harness on any archive (a structural guarantee, not a
    // coincidence of any one fixture), which is why this forcing rule can only be pinned by reading
    // the production source rather than constructing a live pass — a rendering-level test
    // (`shape arbitration: renderCalibrationMarkdown`, "BLOCKER outcome") exercises the resulting
    // artifact text via a hand-built `strawmanPasses: true` fixture instead.
    const source = runShapeArbitration.toString();
    expect(source).toMatch(/strawmanBlocked\s*\?\s*null\s*:\s*selectShape/);
  });
});

describe('shape arbitration: decideOutcome (exit-code contract)', () => {
  it('exit 1 on an empty archive', () => {
    const result = decideOutcome({ activities: [] }, { shippedValue: undefined });
    expect(result.exitCode).toBe(1);
    expect(result.exitReason).toBe('empty-archive');
  });

  it('exit 1 when no shape clears', () => {
    // A single activity, no burst at all: R1..R4 and the strawman all degrade to n<=1 populations
    // that cannot pass a non-trivial insensitivity check meaningfully, and — decisively — the
    // non-vacuity assertion itself fails (zero detected segments archive-wide), which this
    // contract also routes to exit 1.
    const archive = { activities: [buildSyntheticActivity('LONE', { numSteps: 5 })] };
    const result = decideOutcome(archive, { shippedValue: undefined });
    expect(result.exitCode).toBe(1);
    expect(['non-vacuity-failed', 'no-shape-clears']).toContain(result.exitReason);
  });

  /** `buildBulkDominatedArchive` plus the two D-07 anchor activities, tiered to PASS the anchor
   * check (3475734189 severe, 10146303423 none) under whatever cut the bulk archive clears at. */
  function buildArchiveWithPassingAnchors() {
    const archive = buildBulkDominatedArchive();
    archive.activities.push(buildSyntheticActivity(ANCHOR_SEVERE_ACTIVITY_ID, { burstAt: 3, burstMetres: 200 }));
    archive.activities.push(buildSyntheticActivity(ANCHOR_CONTROL_ACTIVITY_ID, { numSteps: 5 }));
    return archive;
  }

  it('exit 2 when a shape clears but the shipped constant is absent', () => {
    const archive = buildArchiveWithPassingAnchors();
    const result = decideOutcome(archive, { tolerance: INSENSITIVITY_TOLERANCE, shippedValue: undefined });
    expect(result.exitCode).toBe(2);
    expect(result.chosen).not.toBeNull();
    expect(result.anchor.pass).toBe(true);
    expect(result.shippedComparison.notYetShipped).toBe(true);
  });

  it('exit 2 when a shape clears but the shipped constant differs from the derived one', () => {
    const archive = buildArchiveWithPassingAnchors();
    const result = decideOutcome(archive, { tolerance: INSENSITIVITY_TOLERANCE, shippedValue: 0.999 });
    expect(result.exitCode).toBe(2);
    expect(result.shippedComparison.equal).toBe(false);
  });

  it('exit 0 when a shape clears and the shipped constant equals the derived one', () => {
    const archive = buildArchiveWithPassingAnchors();
    const probe = decideOutcome(archive, { tolerance: INSENSITIVITY_TOLERANCE, shippedValue: undefined });
    const result = decideOutcome(archive, {
      tolerance: INSENSITIVITY_TOLERANCE,
      shippedValue: probe.chosen.roundedValue,
    });
    expect(result.exitCode).toBe(0);
    expect(result.shippedComparison.equal).toBe(true);
  });

  it('exit 1 when the D-07 anchor check fails on the winning shape', () => {
    // A bulk-dominated archive whose 3475734189 activity is deliberately CLEAN (no burst at all) —
    // R3 still clears D-13, but the anchor requirement (3475734189 must tier severe) fails.
    const archive = buildBulkDominatedArchive();
    archive.activities.push(buildSyntheticActivity(ANCHOR_SEVERE_ACTIVITY_ID, { numSteps: 5 }));
    archive.activities.push(buildSyntheticActivity(ANCHOR_CONTROL_ACTIVITY_ID, { numSteps: 5 }));
    const result = decideOutcome(archive, { tolerance: INSENSITIVITY_TOLERANCE, shippedValue: undefined });
    expect(result.exitCode).toBe(1);
    expect(result.exitReason).toBe('anchor-check-failed');
    expect(result.anchor.pass).toBe(false);
  });
});

// ===========================================================================
// Task 4: shipped-constant named-activity tiering. Reads EXACTLY FOUR named
// stream files under data/streams/ — never the archive.
// ===========================================================================

function readNamedStream(id) {
  return JSON.parse(readFileSync(join('data', 'streams', `${id}.json`), 'utf-8'));
}

function segmentsForNamedActivity(id) {
  const { t, d } = readNamedStream(id);
  const gaps = classifyGapsThreeWay(t, d).gapIntervals;
  const segments = detectUnreliableSegments(t, d, gaps, DEFAULT_DETECTOR_PARAMS);
  const totalDistanceM = d[d.length - 1] - d[0];
  return { segments, totalDistanceM };
}

describe('shipped constant named-activity tiering (plan 33-14 Task 4)', () => {
  it('3475734189 tiers severe against the independent fraction 122.70 / 6830.3', () => {
    const { segments, totalDistanceM } = segmentsForNamedActivity('3475734189');
    expect(segments).toHaveLength(1);
    const fraction = activityExcessFraction(segments, totalDistanceM);
    expect(fraction).toBeCloseTo(122.7 / 6830.3, 3);
    expect(classifyActivityTier(segments, totalDistanceM, UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION)).toBe(
      'severe'
    );
  });

  it('10146303423 tiers none (zero detected segments, the clean control)', () => {
    const { segments, totalDistanceM } = segmentsForNamedActivity('10146303423');
    expect(segments).toHaveLength(0);
    expect(classifyActivityTier(segments, totalDistanceM, UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION)).toBe(
      'none'
    );
  });

  it('3475724402 tiers minor with fraction exactly 0 (every segment clamped to excess 0, gap dilution — a finding)', () => {
    const { segments, totalDistanceM } = segmentsForNamedActivity('3475724402');
    expect(segments.length).toBeGreaterThan(0);
    const fraction = activityExcessFraction(segments, totalDistanceM);
    expect(fraction).toBe(0);
    expect(classifyActivityTier(segments, totalDistanceM, UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION)).toBe(
      'minor'
    );
  });

  it('the cross-segment summation property is asserted on 3475740390 (N=5: 55.95 / 10571.1), never a one-segment fixture', () => {
    const { segments, totalDistanceM } = segmentsForNamedActivity('3475740390');
    expect(segments).toHaveLength(5);
    const summedExcess = segments.reduce((sum, s) => sum + s.excessMetres, 0);
    expect(summedExcess).toBeCloseTo(55.95, 1);
    expect(totalDistanceM).toBeCloseTo(10571.1, 0);
    const fraction = activityExcessFraction(segments, totalDistanceM);
    expect(fraction).toBeCloseTo(55.95 / 10571.1, 3);
  });
});
