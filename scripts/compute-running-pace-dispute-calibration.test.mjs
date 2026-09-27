/**
 * Phase 35 plan 06 (RPACE-03, D-02/D-05/D-06/D-07): tests for
 * `compute-running-pace-dispute-calibration.mjs`. Every test in this file runs against SYNTHETIC
 * in-memory populations. None reads the real stream archive on disk — this file exercises the
 * generator's own mechanisms (populations, the two statistics, the seven pre-declared shapes, the
 * three D-13 insensitivity axes, the clearing predicate, arbitration, the basis gate, and the
 * renderer) independently of any archive content, per 35-06-PLAN.md's own instruction that the
 * generator is never run against the real archive in this plan.
 *
 * Mirrors `compute-pause-classification-calibration.test.mjs`'s own plant-accounting assertions,
 * renderer-determinism test, and synthetic-population fixture conventions; and
 * `unreliable-segment-import-guards.test.mjs`'s import-time certification mechanism (extended below
 * to cover this generator too).
 */

import { describe, expect, it } from 'vitest';

import {
  INSENSITIVITY_TOLERANCE,
  STRAWMAN_TARGET_ACTIVITY_ID,
  NAMED_ACTIVITY_IDS,
  STATISTICS,
  SHAPES,
  buildPopulations,
  assertPopulationsDisjoint,
  strawmanCutS0,
  plantMaxStatistic,
  evaluateAxisBFromPlanted,
  axisBForShape,
  trimBaseTail,
  evaluateAxisCFromTrimmed,
  axisCForShape,
  shapeClears,
  evaluateShapeAxes,
  runCalibration,
  decideOutcome,
  applyBasisGate,
  constantNameForStatistic,
  renderCalibrationMarkdown,
} from './compute-running-pace-dispute-calibration.mjs';

// ---------------------------------------------------------------------------
// Fixture helpers — every population here is fabricated, never read from disk
// ---------------------------------------------------------------------------

function makeRecord(id, runningPaceSecPerKm, metadataPaceSecPerKm, excludedM, excludedSec) {
  return {
    id,
    computable: true,
    notComputableReason: null,
    runningPaceSecPerKm,
    metadataPaceSecPerKm,
    excludedM,
    excludedSec,
  };
}

/** An eligible-for-E population (excludedM > 0) that always includes the strawman target, at a
 * caller-controlled delta above the rest of the population. */
function buildEPopulationWithTarget({ n = 50, targetDelta = 50, otherDeltaSpread = 7 } = {}) {
  const records = [makeRecord(STRAWMAN_TARGET_ACTIVITY_ID, 300 + targetDelta, 300, 500, 50)];
  for (let i = 0; i < n - 1; i++) {
    records.push(makeRecord(`e-${i}`, 300 + (i % otherDeltaSpread), 300, 100 + i, 10));
  }
  return records;
}

/** An eligible-for-C population (excludedM === 0, excludedSec === 0). */
function buildCPopulation(n = 60) {
  const records = [];
  for (let i = 0; i < n; i++) records.push(makeRecord(`c-${i}`, 300 + (i % 9), 300, 0, 0));
  return records;
}

/** An eligible-for-B population (excludedM === 0, excludedSec may be nonzero). */
function buildBPopulation(n = 60) {
  const records = [];
  for (let i = 0; i < n; i++) records.push(makeRecord(`b-${i}`, 300 + (i % 9), 300, 0, i % 3));
  return records;
}

function populationForKey(key) {
  if (key === 'E') return buildEPopulationWithTarget();
  if (key === 'C') return buildCPopulation();
  return buildBPopulation();
}

/** A shape stand-in whose `cut` ALWAYS returns `returnValue`, regardless of population content —
 * used only to pin an Axis C/B movement to an exact, hand-computed number, independent of the R-7
 * quantile machinery. */
function fixedCutShape(statistic, returnValue) {
  return { statistic, cut: () => returnValue };
}

// ---------------------------------------------------------------------------
// 1-2. Axis B plant accounting: watched RED first, then real, plus boundary counts
// ---------------------------------------------------------------------------

describe('Axis B plant accounting', () => {
  it('WATCHED RED FIRST: a broken planter that claims plants entered without actually growing the read population reports invalid, never cleared', () => {
    const basePopulation = buildCPopulation(50);
    const shape = SHAPES.find((s) => s.id === 'C1');
    const baseCut = shape.cut(basePopulation);

    // The broken planter: it claims 5 plants entered, but the population array it hands back is
    // unchanged -- exactly "adds plants to a list the shape does not read".
    const brokenPlantResult = { population: [...basePopulation], plantsEntered: 5 };
    const axisB = evaluateAxisBFromPlanted(shape, basePopulation, baseCut, brokenPlantResult);

    expect(axisB.accountingOk).toBe(false);
    expect(axisB.plantedItems).toBe(basePopulation.length); // the read population never grew
    expect(axisB.movement).toBe(0); // the shape of a perfect, meaningless clear
    // Verbatim failure message this test records (quoted in 35-06-SUMMARY.md):
    expect(axisB.status).toBe('invalid (plant accounting failed)');
  });

  it('the REAL planter passes the same accounting check for every shape, including S0', () => {
    for (const shape of SHAPES) {
      const basePopulation = populationForKey(shape.basePopulation);
      const baseCut = shape.cut(basePopulation);
      const N = basePopulation.length;
      const plantCount = Math.ceil(INSENSITIVITY_TOLERANCE * N);

      const plantResult = plantMaxStatistic(basePopulation, shape.statistic, plantCount);
      const axisB = evaluateAxisBFromPlanted(shape, basePopulation, baseCut, plantResult);

      // planted items === base items + plants entered, for EVERY shape including S0
      expect(axisB.plantedItems).toBe(basePopulation.length + axisB.plantsEntered);
      expect(axisB.accountingOk).toBe(true);
      expect(axisB.plantsEntered).toBe(plantCount);
    }
  });

  it('plants exactly ceil(0.01 * N) items, and each plant carries the base population\'s own observed maximum statistic value, for N = 1, 99, 100 and 101', () => {
    const expected = { 1: 1, 99: 1, 100: 1, 101: 2 };
    for (const N of [1, 99, 100, 101]) {
      const population = [];
      for (let i = 0; i < N; i++) population.push(makeRecord(`r-${i}`, 300 + i, 300, 0, 0));
      const maxDelta = Math.max(...population.map(STATISTICS.delta));

      const plantCount = Math.ceil(INSENSITIVITY_TOLERANCE * N);
      expect(plantCount).toBe(expected[N]);

      const { population: planted, plantsEntered } = plantMaxStatistic(population, 'delta', plantCount);
      expect(plantsEntered).toBe(plantCount);
      expect(planted.length).toBe(N + plantCount);

      const addedPlants = planted.slice(N);
      for (const plant of addedPlants) {
        expect(STATISTICS.delta(plant)).toBe(maxDelta);
      }
    }
  });

  it('axisBForShape end-to-end derives the same plant count from the one INSENSITIVITY_TOLERANCE constant', () => {
    const shape = SHAPES.find((s) => s.id === 'B1');
    const basePopulation = buildBPopulation(150);
    const baseCut = shape.cut(basePopulation);
    const axisB = axisBForShape(shape, basePopulation, baseCut);
    expect(axisB.plantCount).toBe(Math.ceil(INSENSITIVITY_TOLERANCE * basePopulation.length));
  });
});

// ---------------------------------------------------------------------------
// 3. Axis C watched FAILING and CLEARING, on the two declared synthetic fixtures, in that order
// ---------------------------------------------------------------------------

describe('Axis C — base-tail removal, watched failing and clearing', () => {
  const quantileDeltaShape = {
    statistic: 'delta',
    cut: (population) => {
      // Reuses the shape's own statistic function; deliberately hand-rolled here (independent of
      // SHAPES' own quantileCut closures) so this describe block does not depend on any particular
      // real shape's identity, only on the R-7 quantile contract.
      const sorted = population.map(STATISTICS.delta).sort((a, b) => a - b);
      const n = sorted.length;
      if (n === 0) return NaN;
      if (n === 1) return sorted[0];
      const pos = (n - 1) * 0.95;
      const lo = Math.floor(pos);
      const hi = Math.ceil(pos);
      if (lo === hi) return sorted[lo];
      const frac = pos - lo;
      return sorted[lo] + frac * (sorted[hi] - sorted[lo]);
    },
  };

  function makeDeltaRecord(id, deltaValue) {
    return makeRecord(id, 1 + deltaValue, 1, 0, 0);
  }

  it('FAIL direction: N=100, 95 members at statistic 10 and 5 at 1000 -- untrimmed q95 is 59.5, trimmed (membersRemoved=1) is 10.0, movement ~83.2%, status failed', () => {
    const population = [];
    for (let i = 0; i < 95; i++) population.push(makeDeltaRecord(`ten-${i}`, 10));
    for (let i = 0; i < 5; i++) population.push(makeDeltaRecord(`th-${i}`, 1000));

    const baseCut = quantileDeltaShape.cut(population);
    expect(baseCut).toBeCloseTo(59.5, 5);

    const membersRemoved = Math.ceil(INSENSITIVITY_TOLERANCE * population.length);
    expect(membersRemoved).toBe(1);

    const { trimmedPopulation } = trimBaseTail(population, 'delta', membersRemoved);
    const axisC = evaluateAxisCFromTrimmed(
      quantileDeltaShape,
      population,
      baseCut,
      trimmedPopulation,
      membersRemoved
    );

    expect(axisC.trimmedCut).toBeCloseTo(10.0, 5);
    expect(axisC.movement).toBeCloseTo(0.8319, 3);
    expect(axisC.status).toBe('failed');

    // Axis C alone can block a shape, even when Axis B is forced to cleared.
    const forcedAxes = { axisB: { status: 'cleared' }, axisC };
    expect(shapeClears(forcedAxes)).toBe(false);
  });

  it('CLEAR direction: N=1000, statistic = 1000 + i*0.001 -- membersRemoved=10, movement < 0.0001, status cleared', () => {
    const population = [];
    for (let i = 0; i < 1000; i++) population.push(makeDeltaRecord(`i-${i}`, 1000 + i * 0.001));

    const baseCut = quantileDeltaShape.cut(population);
    const membersRemoved = Math.ceil(INSENSITIVITY_TOLERANCE * population.length);
    expect(membersRemoved).toBe(10);

    const { trimmedPopulation } = trimBaseTail(population, 'delta', membersRemoved);
    const axisC = evaluateAxisCFromTrimmed(
      quantileDeltaShape,
      population,
      baseCut,
      trimmedPopulation,
      membersRemoved
    );

    expect(axisC.movement).toBeLessThan(0.0001);
    expect(axisC.status).toBe('cleared');

    const forcedAxes = { axisB: { status: 'cleared' }, axisC };
    expect(shapeClears(forcedAxes)).toBe(true);
  });

  it('WATCHED RED: removal accounting -- a broken trimmer that removes members from a list the shape does not read produces a movement of exactly 0, yet reports invalid, never cleared', () => {
    const population = [];
    for (let i = 0; i < 95; i++) population.push(makeDeltaRecord(`ten-${i}`, 10));
    for (let i = 0; i < 5; i++) population.push(makeDeltaRecord(`th-${i}`, 1000));

    const baseCut = quantileDeltaShape.cut(population);
    // The broken trimmer: claims membersRemoved=1, but hands back the population UNCHANGED --
    // exactly "a trimmer that removes from a list the shape does not read".
    const axisC = evaluateAxisCFromTrimmed(quantileDeltaShape, population, baseCut, population, 1);

    expect(axisC.movement).toBe(0); // the shape of a perfect, meaningless clear
    // Verbatim failure message this test records (quoted in 35-06-SUMMARY.md):
    expect(axisC.status).toBe('invalid (removal accounting failed)');
    expect(shapeClears({ axisB: { status: 'cleared' }, axisC })).toBe(false);
  });

  it('never-vacuous status: an empty base population reports membersRemoved=0 and invalid (no member removed), never cleared, even at a zero movement', () => {
    const population = [];
    const baseCut = quantileDeltaShape.cut(population); // NaN
    const membersRemoved = Math.ceil(INSENSITIVITY_TOLERANCE * population.length);
    expect(membersRemoved).toBe(0);

    const { trimmedPopulation } = trimBaseTail(population, 'delta', membersRemoved);
    const axisC = evaluateAxisCFromTrimmed(
      quantileDeltaShape,
      population,
      baseCut,
      trimmedPopulation,
      membersRemoved
    );

    expect(axisC.status).toBe('invalid (no member removed)');
    expect(shapeClears({ axisB: { status: 'cleared' }, axisC })).toBe(false);
  });

  it('tolerance boundary: movements just below and just above INSENSITIVITY_TOLERANCE clear then fail, reading the tolerance from the module\'s own exported constant, never a pinned literal', () => {
    const baseCut = 100;
    const basePopulation = [makeDeltaRecord('a', 1), makeDeltaRecord('b', 2), makeDeltaRecord('c', 3)];
    const trimmedPopulation = [makeDeltaRecord('a', 1), makeDeltaRecord('b', 2)];

    const justBelow = INSENSITIVITY_TOLERANCE - 0.0005;
    const belowShape = fixedCutShape('delta', baseCut * (1 + justBelow));
    const axisCBelow = evaluateAxisCFromTrimmed(belowShape, basePopulation, baseCut, trimmedPopulation, 1);
    expect(axisCBelow.movement).toBeCloseTo(justBelow, 6);
    expect(axisCBelow.status).toBe('cleared');

    const justAbove = INSENSITIVITY_TOLERANCE + 0.0005;
    const aboveShape = fixedCutShape('delta', baseCut * (1 + justAbove));
    const axisCAbove = evaluateAxisCFromTrimmed(aboveShape, basePopulation, baseCut, trimmedPopulation, 1);
    expect(axisCAbove.movement).toBeCloseTo(justAbove, 6);
    expect(axisCAbove.status).toBe('failed');
  });

  it('axisCForShape end-to-end derives membersRemoved from the one INSENSITIVITY_TOLERANCE constant, for every shape', () => {
    for (const shape of SHAPES) {
      const basePopulation = populationForKey(shape.basePopulation);
      const baseCut = shape.cut(basePopulation);
      const axisC = axisCForShape(shape, basePopulation, baseCut);
      expect(axisC.membersRemoved).toBe(Math.ceil(INSENSITIVITY_TOLERANCE * basePopulation.length));
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Disjointness — watched firing against a planted overlapping activity
// ---------------------------------------------------------------------------

describe('population disjointness (D-05 non-circularity)', () => {
  it('a real archive produces E, C and B disjoint from each other (E vs C, E vs B)', () => {
    const records = [
      ...buildEPopulationWithTarget({ n: 5 }),
      ...buildCPopulation(5),
      ...buildBPopulation(5),
    ];
    const { E, C, B } = buildPopulations(records);
    expect(E.length).toBeGreaterThan(0);
    expect(C.length).toBeGreaterThan(0);
    expect(B.length).toBeGreaterThan(0);
    expect(() => assertPopulationsDisjoint(E, C, B)).not.toThrow();
  });

  it('WATCHED FIRING: a synthetic activity landing in both C and E aborts the run with a named reason', () => {
    const overlapping = { id: 'overlap-1' };
    const E = [overlapping];
    const C = [overlapping];
    const B = [];

    let caught = null;
    try {
      assertPopulationsDisjoint(E, C, B);
    } catch (error) {
      caught = error;
    }

    expect(caught).not.toBeNull();
    expect(caught.message).toContain('D-05 disjointness violated');
    expect(caught.message).toContain('overlap-1');
  });

  it('WATCHED FIRING: a synthetic activity landing in both B and E aborts the run with a named reason', () => {
    const overlapping = { id: 'overlap-2' };
    const E = [overlapping];
    const B = [overlapping];
    const C = [];

    expect(() => assertPopulationsDisjoint(E, C, B)).toThrow(/D-05 disjointness violated/);
    expect(() => assertPopulationsDisjoint(E, C, B)).toThrow(/overlap-2/);
  });
});

// ---------------------------------------------------------------------------
// 5. Terminal branches, driven by hand-built result objects
// ---------------------------------------------------------------------------

function dummyAxisA(structural) {
  return structural
    ? { status: 'structural (0 by construction)', badgedCount: null, baseCut: null, removedCut: null, movement: null }
    : { status: 'failed', badgedCount: 1, baseCut: 10, removedCut: null, movement: null };
}
function dummyAxisB(cleared) {
  return {
    plantCount: 1,
    baseItems: 10,
    plantedItems: 11,
    plantsEntered: 1,
    accountingOk: true,
    baseCut: 10,
    plantedCut: 10,
    movement: 0,
    status: cleared ? 'cleared' : 'failed',
  };
}
function dummyAxisC(cleared) {
  return {
    baseItems: 10,
    membersRemoved: 1,
    trimmedItems: 9,
    removedStatisticValues: [5],
    baseCut: 10,
    trimmedCut: 10,
    movement: 0,
    status: cleared ? 'cleared' : 'failed',
  };
}
function dummyRow(id, statistic, basePopulationKey, cleared) {
  return {
    id,
    statistic,
    basePopulationKey,
    basePopulationSize: 10,
    cutValue: 10,
    axisA: dummyAxisA(basePopulationKey !== 'E'),
    axisB: dummyAxisB(cleared),
    axisC: dummyAxisC(cleared),
    cleared,
  };
}
function dummyEvaluated(clearedIds) {
  return SHAPES.map((shape) => dummyRow(shape.id, shape.statistic, shape.basePopulation, clearedIds.includes(shape.id)));
}
function dummyFindings(constantShipped) {
  return {
    newlyDisputedCount: constantShipped ? 5 : null,
    fasterSideCount: constantShipped ? 2 : null,
    gateExcludedCount: 3,
    gateExcludedDeltaSummary: { n: 3, q50: 1, min: 0, max: 2 },
    notComputable: { total: 0, reasons: {} },
    namedActivities: NAMED_ACTIVITY_IDS.map((id) => ({ id, found: false })),
  };
}

describe('renderCalibrationMarkdown terminal branches', () => {
  it('(a) a cleared shape with a passing basis gate renders ## Chosen constants with exactly one constant line matching the cleared family', () => {
    const evaluated = dummyEvaluated(['C1']);
    const chosenRow = evaluated.find((r) => r.id === 'C1');
    const result = {
      evaluated,
      strawmanCleared: false,
      selectedId: 'C1',
      chosenRow,
      noShapeClears: false,
      gate: { pass: true, targetFound: true, eligible: true, targetValue: 20, cut: 10, statistic: 'delta', reason: null },
      gateFailed: false,
      constantShipped: true,
      findings: dummyFindings(true),
      archive: {},
      provenance: {},
    };

    const md = renderCalibrationMarkdown(result);
    expect(md).toContain('## Chosen constants');
    const constantLines = md.match(/^PACE_DISAGREEMENT_RUNNING_\w+ = .+$/gm) ?? [];
    expect(constantLines.length).toBe(1);
    expect(constantLines[0]).toContain(constantNameForStatistic('delta'));
  });

  it('(b) no shape clearing renders ## NO SHAPE CLEARS and NO PACE_DISAGREEMENT_RUNNING_ line anywhere in the whole rendered string', () => {
    const evaluated = dummyEvaluated([]);
    const result = {
      evaluated,
      strawmanCleared: false,
      selectedId: null,
      chosenRow: null,
      noShapeClears: true,
      gate: null,
      gateFailed: false,
      constantShipped: false,
      findings: dummyFindings(false),
      archive: {},
      provenance: {},
    };

    const md = renderCalibrationMarkdown(result);
    expect(md).toContain('## NO SHAPE CLEARS');
    expect(/PACE_DISAGREEMENT_RUNNING_/.test(md)).toBe(false);
  });

  it('(c) a cleared shape with a FAILING basis gate renders ## GATE FAILED and NO PACE_DISAGREEMENT_RUNNING_ line anywhere in the whole rendered string', () => {
    const evaluated = dummyEvaluated(['C1']);
    const chosenRow = evaluated.find((r) => r.id === 'C1');
    const result = {
      evaluated,
      strawmanCleared: false,
      selectedId: 'C1',
      chosenRow,
      noShapeClears: false,
      gate: {
        pass: false,
        targetFound: true,
        eligible: false,
        targetValue: null,
        cut: 10,
        statistic: 'delta',
        reason: `target activity failed the eligibility gate (excludedM must be > 0; got 0)`,
      },
      gateFailed: true,
      constantShipped: false,
      findings: dummyFindings(false),
      archive: {},
      provenance: {},
    };

    const md = renderCalibrationMarkdown(result);
    expect(md).toContain('## GATE FAILED');
    expect(/PACE_DISAGREEMENT_RUNNING_/.test(md)).toBe(false);
  });

  it('a rendered shape block contains all three axis labels, and the Axis C row prints membersRemoved and its status verbatim', () => {
    const evaluated = dummyEvaluated(['C1']);
    const chosenRow = evaluated.find((r) => r.id === 'C1');
    const result = {
      evaluated,
      strawmanCleared: false,
      selectedId: 'C1',
      chosenRow,
      noShapeClears: false,
      gate: { pass: true, targetFound: true, eligible: true, targetValue: 20, cut: 10, statistic: 'delta', reason: null },
      gateFailed: false,
      constantShipped: true,
      findings: dummyFindings(true),
      archive: {},
      provenance: {},
    };

    const md = renderCalibrationMarkdown(result);
    expect(md).toContain('Axis A — judged-contribution removal');
    expect(md).toContain('Axis B — proportional planting');
    expect(md).toContain('Axis C — base-tail removal');
    expect(md).toMatch(/Axis C — base-tail removal \| membersRemoved=\d+[^|]*\| (cleared|failed|invalid[^|]*) \|/);
  });
});

// ---------------------------------------------------------------------------
// 6. Strawman handling — a genuine synthetic archive where S0 clears both axes
// ---------------------------------------------------------------------------

describe('strawman S0 clearing invalidates the round', () => {
  it('when S0 clears Axis B and Axis C, the round HALTs before ever selecting C1 (or any real shape)', () => {
    // Crafted so the smallest positive delta gap in E sits between two unrelated members far below
    // the target, and the population's own maximum sits far above the target -- so neither
    // plants-at-the-max (Axis B) nor trimming-the-top-1% (Axis C) disturbs the gap S0's cut reads.
    const records = [
      makeRecord(STRAWMAN_TARGET_ACTIVITY_ID, 350, 300, 500, 100), // delta = 50
      makeRecord('pair-a', 310, 300, 500, 100), // delta = 10
      makeRecord('pair-b', 310.0001, 300, 500, 100), // delta = 10.0001 -- smallest positive gap
    ];
    for (let i = 0; i < 987; i++) {
      records.push(makeRecord(`filler-${i}`, 300 + 1000 + i, 300, 500, 100)); // delta = 1000+i
    }

    const result = runCalibration(records);
    const s0 = result.evaluated[0];
    expect(s0.id).toBe('S0');
    expect(s0.axisB.status).toBe('cleared');
    expect(s0.axisC.status).toBe('cleared');
    expect(s0.cleared).toBe(true);

    expect(result.strawmanCleared).toBe(true);
    expect(result.selectedId).toBeNull(); // never proceeds to C1, even though real shapes exist
    expect(result.noShapeClears).toBe(true);
    expect(result.constantShipped).toBe(false);

    expect(decideOutcome(result)).toEqual({ exitCode: 1, reason: 'strawman-s0-passed' });

    const md = renderCalibrationMarkdown({ ...result, archive: {}, provenance: {} });
    expect(md).toContain('## NO SHAPE CLEARS');
    expect(md).toContain('strawmanCleared: true');
    expect(/PACE_DISAGREEMENT_RUNNING_/.test(md)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. Renderer determinism
// ---------------------------------------------------------------------------

describe('renderCalibrationMarkdown determinism', () => {
  it('renders the same result object identically twice, with no wall-clock date pattern', () => {
    const evaluated = dummyEvaluated(['C1']);
    const chosenRow = evaluated.find((r) => r.id === 'C1');
    const result = {
      evaluated,
      strawmanCleared: false,
      selectedId: 'C1',
      chosenRow,
      noShapeClears: false,
      gate: { pass: true, targetFound: true, eligible: true, targetValue: 20, cut: 10, statistic: 'delta', reason: null },
      gateFailed: false,
      constantShipped: true,
      findings: dummyFindings(true),
      archive: {},
      provenance: {},
    };

    const first = renderCalibrationMarkdown(result);
    const second = renderCalibrationMarkdown(result);
    expect(first).toBe(second);

    expect(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(first)).toBe(false);
    expect(/\d{4}-\d{2}-\d{2}/.test(first)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Miscellaneous: strawman cut function, basis gate, statistics
// ---------------------------------------------------------------------------

describe('strawmanCutS0 and applyBasisGate', () => {
  it('returns null when the target activity is absent from the population', () => {
    const population = [makeRecord('someone-else', 310, 300, 100, 10)];
    expect(strawmanCutS0(population)).toBeNull();
  });

  it('applyBasisGate fails closed when the target activity is not found in the archive at all', () => {
    const chosenRow = { statistic: 'delta', cutValue: 10 };
    const gate = applyBasisGate(chosenRow, [makeRecord('someone-else', 310, 300, 100, 10)]);
    expect(gate.pass).toBe(false);
    expect(gate.targetFound).toBe(false);
    expect(gate.reason).toContain(STRAWMAN_TARGET_ACTIVITY_ID);
  });

  it('applyBasisGate fails when the target fails the eligibility gate (excludedM === 0)', () => {
    const chosenRow = { statistic: 'delta', cutValue: 1 };
    const records = [makeRecord(STRAWMAN_TARGET_ACTIVITY_ID, 305, 300, 0, 0)];
    const gate = applyBasisGate(chosenRow, records);
    expect(gate.pass).toBe(false);
    expect(gate.eligible).toBe(false);
    expect(gate.reason).toContain('eligibility gate');
  });

  it('applyBasisGate passes when the target is eligible and its statistic exceeds the cut', () => {
    const chosenRow = { statistic: 'delta', cutValue: 1 };
    const records = [makeRecord(STRAWMAN_TARGET_ACTIVITY_ID, 320, 300, 100, 10)]; // delta=20 > 1
    const gate = applyBasisGate(chosenRow, records);
    expect(gate.pass).toBe(true);
  });
});

describe('shapeClears never reads axisA', () => {
  it('returns true only when both axisB and axisC report cleared, regardless of axisA', () => {
    expect(shapeClears({ axisA: { status: 'failed' }, axisB: { status: 'cleared' }, axisC: { status: 'cleared' } })).toBe(true);
    expect(shapeClears({ axisA: { status: 'cleared' }, axisB: { status: 'failed' }, axisC: { status: 'cleared' } })).toBe(false);
    expect(shapeClears({ axisA: { status: 'structural (0 by construction)' }, axisB: { status: 'cleared' }, axisC: { status: 'cleared' } })).toBe(true);
  });
});

describe('evaluateShapeAxes: Axis A is structural for every C/B-based shape, and genuinely evaluated for S0', () => {
  it('renders structural (0 by construction) for C1..B2', () => {
    for (const shape of SHAPES.filter((s) => s.id !== 'S0')) {
      const basePopulation = populationForKey(shape.basePopulation);
      const row = evaluateShapeAxes(shape, buildPopulations([...basePopulation, ...buildEPopulationWithTarget({ n: 3 })]));
      expect(row.axisA.status).toBe('structural (0 by construction)');
    }
  });
});
