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
import {
  CANDIDATE_OUTER_PERCENTILES,
  INSENSITIVITY_TOLERANCE,
  PLANT_COUNT,
  PLANT_MULTIPLIER,
  STRAWMAN_PERCENTILE,
  activityExcessFraction,
  buildFlaggedCohort,
  candidateCut,
  insensitivityForCandidate,
  renderCalibrationMarkdown,
  selectSevereCut,
  severityDistribution,
  strawmanCandidate,
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
