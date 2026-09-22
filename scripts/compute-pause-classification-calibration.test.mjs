/**
 * Synthetic-fixture tests for compute-pause-classification-calibration.mjs (34-04-PLAN.md). No real
 * committed stream file is read anywhere in this file — every fixture below is hand-built. Importing
 * the generator must not run an archive read or a write to 34-CALIBRATION.md; `main()` is never
 * invoked here (D-08: the generator is not run against the real archive in this plan).
 */

import { describe, expect, it } from 'vitest';

import { UNRELIABLE_SPEED_LIMIT_MPS } from '../dist/analytics/pace-derivation.js';
import {
  INSENSITIVITY_SOURCE_ACTIVITY_ID,
  INSENSITIVITY_TOLERANCE,
  NEIGHBOURHOOD_SEC,
  PREDECLARED_SHAPES,
  REJECTED_SHAPES,
  VALLEY_BIN_WIDTH_MPS,
  applyGates,
  archiveFindings,
  buildBaseViews,
  d10Section,
  decideOutcome,
  driftSection,
  evaluateShape,
  joinSection,
  perIntervalTable,
  plantShapes,
  removeNeighbourhoods,
  renderCalibrationMarkdown,
  runCalibration,
  runFamily,
  shapeG1,
  shapeG2,
  shapeG3,
  shapeM1,
  shapeM2,
  shapeW1,
  shapeW2,
  strawmanG,
  strawmanM,
  strawmanW,
  valleyOf,
} from './compute-pause-classification-calibration.mjs';

// ---------------------------------------------------------------------------
// Shared synthetic fixture builders — no real stream is ever read
// ---------------------------------------------------------------------------

/**
 * The canonical "bulk-dominated" background activity: a long cadence-silent creep block (phase 1,
 * feeds G1/G2/M1/M2), a single recording gap (feeds J/strawmen), a walking hump (phase 3, ~1.0 m/s)
 * and a running hump (phase 4, ~3.0 m/s) separated by an empty speed band (feeds W1/W2's valley).
 * `dt` and `phase1Speed` are deliberately non-round (1.3s, 0.12345 m/s) so the rounding rule
 * (`ceilToSignificant` for G/W, `Math.ceil` for M) is genuinely exercised, not a no-op on an
 * already-round input.
 */
function buildBackgroundActivity(id, { gapMetres = 1.0, dt = 1.3, phase1Speed = 0.12345 } = {}) {
  const t = [];
  const d = [];
  const cadence = [];
  let time = 0;
  let dist = 0;

  for (let i = 0; i <= 600; i++) {
    t.push(time);
    d.push(dist);
    cadence.push(0);
    time += dt;
    dist += phase1Speed * dt;
  }
  time += 15 - dt; // total gap dt = 15s > RECORDING_GAP_ABS_THRESHOLD_SEC (10s)
  dist += gapMetres;
  for (let i = 0; i < 300; i++) {
    t.push(time);
    d.push(dist);
    cadence.push(80);
    time += dt;
    dist += 1.0 * dt;
  }
  for (let i = 0; i < 300; i++) {
    t.push(time);
    d.push(dist);
    cadence.push(160);
    time += dt;
    dist += 3.0 * dt;
  }
  t.push(time);
  d.push(dist);
  cadence.push(160);

  return { id, t, d, cadence };
}

/** No cadence anywhere and no zero-advance pause interval anywhere: every G shape's population is
 * empty, so G HALTs (no shape clears — there is nothing to clear) and M/W never run. */
function buildHaltArchive() {
  function noCadenceActivity(id) {
    const t = [];
    const d = [];
    let time = 0;
    let dist = 0;
    for (let i = 0; i <= 200; i++) {
      t.push(time);
      d.push(dist);
      time += 1;
      dist += 3.0; // always "moving" — no cadence-silent population anywhere
    }
    return { id, t, d, cadence: null };
  }
  const activities = [noCadenceActivity('h0'), noCadenceActivity('h1'), noCadenceActivity(INSENSITIVITY_SOURCE_ACTIVITY_ID)];
  return { activities, streamFileCount: activities.length, notComputable: 0 };
}

/** A single activity shaped for the D-12 anchor gate: rest-of-activity (t 0-100, 400-500) runs at
 * 3.0 m/s, the control window (t 100-400) walks at 1.0 m/s, no recording gap anywhere. */
function buildControlActivity(id) {
  const t = [];
  const d = [];
  for (let i = 0; i <= 100; i++) {
    t.push(i);
    d.push(3 * i);
  }
  for (let i = 101; i <= 400; i++) {
    t.push(i);
    d.push(300 + 1 * (i - 100));
  }
  for (let i = 401; i <= 500; i++) {
    t.push(i);
    d.push(600 + 3 * (i - 400));
  }
  return { id, t, d, cadence: null };
}

/** Distance-triggered D-10 signature: constant dd, varying dt (cvDd = 0, so ratio = 0 < 0.8). */
function buildDistanceTriggered(id) {
  const t = [];
  const d = [];
  let time = 0;
  let dist = 0;
  const dts = [1, 3, 1, 5, 1, 2, 1, 4];
  for (let i = 0; i < 41; i++) {
    t.push(time);
    d.push(dist);
    time += dts[i % dts.length];
    dist += 10;
  }
  return { id, t, d, cadence: null };
}

/** Time-triggered D-10 signature: constant dt, varying dd (cvDt = 0, so ratio = Infinity). */
function buildTimeTriggered(id) {
  const t = [];
  const d = [];
  let time = 0;
  let dist = 0;
  const dds = [3, 5, 2, 7, 1, 4, 6, 2];
  for (let i = 0; i < 41; i++) {
    t.push(time);
    d.push(dist);
    time += 1;
    dist += dds[i % dds.length];
  }
  return { id, t, d, cadence: null };
}

/** The full "everything clears, every gate passes" archive: the control activity plus the four named
 * D-10 anchors. */
function buildGatesPassArchive() {
  const activities = [
    buildControlActivity('CTRL1'),
    buildDistanceTriggered('3475740390'),
    buildTimeTriggered('3475724402'),
    buildTimeTriggered('3475734189'),
    buildTimeTriggered('4556693525'),
  ];
  return { activities, streamFileCount: activities.length, notComputable: 0 };
}
const GATES_PASS_SHIPPED = { STATIONARY_MAX_SPEED_MPS: 0.5, WALK_RUN_BOUNDARY_MPS: 2.0, FORGOTTEN_STOP_MIN_SEC: 30 };
const GATES_PASS_CONTROL_TEXT = 'CONFIRMED_CONTROL: CTRL1 t=100-400\n';

/**
 * 15 bulk background activities plus one literally named 3475724402 (the D-13 plant source and a
 * genuine time-triggered D-10 control), the other three named D-10 anchors, and the D-12 control
 * activity — every G/M/W family clears D-13 insensitivity AND every post-selection gate passes on
 * this archive (verified below), when run with `GATES_PASS_CONTROL_TEXT`.
 */
function buildClearArchive() {
  const activities = [];
  for (let i = 0; i < 15; i++) {
    activities.push(buildBackgroundActivity(`bg${i}`, { gapMetres: i % 2 === 0 ? 2.0 : 45.0 }));
  }
  activities.push(buildBackgroundActivity(INSENSITIVITY_SOURCE_ACTIVITY_ID));
  activities.push(buildDistanceTriggered('3475740390'));
  activities.push(buildTimeTriggered('3475734189'));
  activities.push(buildTimeTriggered('4556693525'));
  activities.push(buildControlActivity('CTRL1'));
  return { activities, streamFileCount: activities.length, notComputable: 0 };
}

// ---------------------------------------------------------------------------
// reference shape
// ---------------------------------------------------------------------------

describe('reference shape', () => {
  const views = buildBaseViews(buildClearArchive());

  it('G1: R-7 p90 of cadence-silent covered pairs, pooled', () => {
    const result = shapeG1(views);
    expect(result.value).toBeCloseTo(0.12345, 5);
    expect(result.n).toBeGreaterThan(0);
  });

  it('G2: per-activity median of cadence-silent speeds, archive p90', () => {
    const result = shapeG2(views);
    expect(result.value).toBeCloseTo(0.12345, 5);
  });

  it('G3: median speed of covered pairs run-in around a zero-advance pause — empty on this archive', () => {
    // This archive has no zero-advance `pause` gapIntervals anywhere, so G3's population is empty.
    const result = shapeG3(views);
    expect(result.value).toBeNull();
  });

  it('strawman G: R-7 p90 of J speeds, pooled', () => {
    const result = strawmanG(views);
    expect(result.value).not.toBeNull();
    expect(result.n).toBe(16);
  });

  it('M1: R-7 p90 across activities of each activity\'s own P_a', () => {
    const result = shapeM1(views);
    // Every advance interval in this fixture is exactly dt=1.3s (a constant array), so
    // P_a = PAUSE_GAP_P90_MULTIPLIER * 1.3 for every activity — the same value archive-wide.
    expect(result.value).toBeCloseTo(6.5, 5);
  });

  it('M2: R-7 p50 across activities of each activity\'s own P_a', () => {
    const result = shapeM2(views);
    expect(result.value).toBeCloseTo(6.5, 5);
  });

  it('strawman M: R-7 p90 of creep-candidate durations archive-wide, at the shipped G floor', () => {
    const result = strawmanM(views, { shippedFloor: 0.124 });
    expect(result.value).not.toBeNull();
    expect(result.value).toBeGreaterThan(0);
  });

  it('W1: the valley in covered time by speed, time-weighted, over [lo, hi)', () => {
    const result = shapeW1(views, { lo: 0.124, hi: UNRELIABLE_SPEED_LIMIT_MPS });
    expect(result.value).not.toBeNull();
    expect(result.value).toBeGreaterThan(1.0);
    expect(result.value).toBeLessThan(3.0);
  });

  it('W2: the same valley, count-weighted', () => {
    const result = shapeW2(views, { lo: 0.124, hi: UNRELIABLE_SPEED_LIMIT_MPS });
    expect(result.value).not.toBeNull();
  });

  it('strawman W: the valley over J speeds (count-weighted)', () => {
    const result = strawmanW(views, { lo: 0.124, hi: UNRELIABLE_SPEED_LIMIT_MPS });
    // The two-cluster J population (one low, one high) DOES admit a real valley on this fixture —
    // the D-13 harness below is what shows it FAILing under removal, not an empty base here.
    expect(result.value).not.toBeNull();
  });

  describe('valleyOf', () => {
    it('picks the MINIMUM qualifying bin, not the first qualifying (shallow-shoulder) bin', () => {
      // 5 bins of width 0.1 starting at edge 0: [10, 3, 10, 0, 10]. Bin 1 (count 3) is a shallow
      // shoulder that qualifies first; bin 3 (count 0) is the true, deeper minimum.
      const items = [];
      for (let i = 0; i < 10; i++) items.push({ value: 0.05, weight: 1 }); // bin 0
      for (let i = 0; i < 3; i++) items.push({ value: 0.15, weight: 1 }); // bin 1
      for (let i = 0; i < 10; i++) items.push({ value: 0.25, weight: 1 }); // bin 2
      // bin 3 (0.3-0.4): intentionally empty
      for (let i = 0; i < 10; i++) items.push({ value: 0.45, weight: 1 }); // bin 4
      const value = valleyOf(items, 0, 0.5);
      expect(value).toBeCloseTo(0.35, 5); // bin 3's centre, not bin 1's (0.15)
    });

    it('returns null on a monotone histogram (no qualifying bin)', () => {
      const items = [];
      const counts = [1, 2, 3, 4, 5];
      counts.forEach((count, bin) => {
        for (let i = 0; i < count; i++) items.push({ value: bin * 0.1 + 0.05, weight: 1 });
      });
      expect(valleyOf(items, 0, 0.5)).toBeNull();
    });

    it('returns null on an empty population', () => {
      expect(valleyOf([], 0, 1)).toBeNull();
    });
  });

  describe('evaluateShape', () => {
    const fn = (population) => ({ value: population.value, n: population.n ?? 0, excluded: 0 });

    it('pass iff both deltas are at or below the tolerance', () => {
      const result = evaluateShape(
        fn,
        { base: { value: 100 }, removed: { value: 100.5 }, planted: { value: 100.5 } },
        { tolerance: 0.01 }
      );
      expect(result.removedDelta).toBeCloseTo(0.005, 5);
      expect(result.plantedDelta).toBeCloseTo(0.005, 5);
      expect(result.pass).toBe(true);
    });

    it('FAILs on a null base', () => {
      const result = evaluateShape(fn, { base: { value: null }, removed: { value: 1 }, planted: { value: 1 } }, { tolerance: 0.01 });
      expect(result.pass).toBe(false);
      expect(result.removedDelta).toBeNull();
    });

    it('FAILs on a zero base', () => {
      const result = evaluateShape(fn, { base: { value: 0 }, removed: { value: 0 }, planted: { value: 0 } }, { tolerance: 0.01 });
      expect(result.pass).toBe(false);
    });

    it('FAILs on a null perturbed value', () => {
      const result = evaluateShape(fn, { base: { value: 100 }, removed: { value: null }, planted: { value: 100 } }, { tolerance: 0.01 });
      expect(result.pass).toBe(false);
      expect(result.removedDelta).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// D-13 harness
// ---------------------------------------------------------------------------

describe('D-13 harness', () => {
  it('buildBaseViews: positioned advance intervals match the imported advanceIntervals(t, d) exactly', () => {
    expect(() => buildBaseViews(buildClearArchive())).not.toThrow();
    const views = buildBaseViews(buildClearArchive());
    for (const v of views) {
      expect(v.computable).toBe(true);
      expect(v.positionedAdvanceIntervals.length).toBeGreaterThan(0);
    }
  });

  it('buildBaseViews: an activity with spanSec === 0 is computable: false, contributes to no population', () => {
    const archive = { activities: [{ id: 'flat', t: [0, 0], d: [0, 0], cadence: null }], streamFileCount: 1, notComputable: 0 };
    const views = buildBaseViews(archive);
    expect(views[0].computable).toBe(false);
  });

  it('removeNeighbourhoods (G): drops exactly the coveredPairs AND J items intersecting a J neighbourhood', () => {
    const views = buildBaseViews(buildClearArchive());
    const result = removeNeighbourhoods(views, 'G', null);
    expect(result.removedCount).toBeGreaterThan(0);
    expect(result.changedActivityCount).toBeGreaterThan(0);
    for (const v of result.views) {
      if (!v.computable) continue;
      // STRAWMAN G's own population is trivially emptied by removal (every J item intersects its
      // own padded neighbourhood).
      expect(v.J.length).toBe(0);
      // The real G1/G2/G3 population loses only a small fraction (bulk-dominated).
      expect(v.coveredPairs.length).toBeGreaterThan(0);
    }
  });

  it('removeNeighbourhoods (M): drops positionedAdvanceIntervals AND coveredPairs near a creep candidate', () => {
    const views = buildBaseViews(buildClearArchive());
    const result = removeNeighbourhoods(views, 'M', 0.124);
    expect(result.removedCount).toBeGreaterThan(0);
    for (const v of result.views) {
      if (!v.computable) continue;
      // The whole cadence-silent block (the creep candidate at floor 0.124) is removed, so no
      // creep candidate can be recomputed from what remains — STRAWMAN M's own unfalsifiable-fail.
      const remainingLowSpeed = v.coveredPairs.filter((p) => p.speedMps <= 0.124);
      expect(remainingLowSpeed.length).toBe(0);
    }
  });

  it('plantShapes: plants round-robin by id until planted count equals archive |J|; plants carry negative sentinel indices and are cadence-silent', () => {
    const views = buildBaseViews(buildClearArchive());
    const jTotal = views.reduce((sum, v) => sum + (v.computable ? v.J.length : 0), 0);
    const sourceShapes = views
      .find((v) => v.id === INSENSITIVITY_SOURCE_ACTIVITY_ID)
      .J.map((iv) => ({ metres: iv.metres, seconds: iv.seconds }));

    const result = plantShapes(views, sourceShapes);
    expect(result.plantedCount).toBe(jTotal);

    let plantedFound = 0;
    for (const v of result.views) {
      if (!v.computable) continue;
      for (const p of v.coveredPairs) {
        if (p.index < 0) {
          plantedFound++;
          expect(p.cadenceSilent).toBe(true);
        }
      }
    }
    expect(plantedFound).toBe(jTotal);
  });

  it('plantShapes: zero source shapes plants nothing', () => {
    const views = buildBaseViews(buildClearArchive());
    const result = plantShapes(views, []);
    expect(result.plantedCount).toBe(0);
    expect(result.views).toBe(views);
  });

  describe('CAN PASS / CAN FAIL (bulk-dominated synthetic archive)', () => {
    // Built directly from Task 1's own primitives (buildBaseViews / removeNeighbourhoods /
    // plantShapes / evaluateShape) — this harness-level demonstration does not need runFamily or
    // runCalibration (both Task 2 deliverables).
    const base = buildBaseViews(buildClearArchive());
    const gShippedFloor = null; // G itself needs no upstream floor
    const gRemoved = removeNeighbourhoods(base, 'G', gShippedFloor).views;
    const sourceShapes = base
      .find((v) => v.id === INSENSITIVITY_SOURCE_ACTIVITY_ID)
      .J.map((iv) => ({ metres: iv.metres, seconds: iv.seconds }));
    const gPlanted = plantShapes(base, sourceShapes).views;

    const mShippedFloor = 0.124; // the archive's own derived G value (see "reference shape" above)
    const mRemoved = removeNeighbourhoods(base, 'M', mShippedFloor).views;
    const mPlanted = plantShapes(base, sourceShapes).views;

    const wCtx = { lo: mShippedFloor, hi: UNRELIABLE_SPEED_LIMIT_MPS };
    const wRemoved = removeNeighbourhoods(base, 'W', mShippedFloor).views;
    const wPlanted = plantShapes(base, sourceShapes).views;

    it('CAN PASS: G1, M1 and W1 each PASS on the bulk-dominated archive', () => {
      const g1 = evaluateShape(shapeG1, { base, removed: gRemoved, planted: gPlanted }, { tolerance: INSENSITIVITY_TOLERANCE });
      const m1 = evaluateShape(shapeM1, { base, removed: mRemoved, planted: mPlanted }, { tolerance: INSENSITIVITY_TOLERANCE });
      const w1 = evaluateShape(shapeW1, { base, removed: wRemoved, planted: wPlanted }, { tolerance: INSENSITIVITY_TOLERANCE, ctx: wCtx });
      expect(g1.pass).toBe(true);
      expect(m1.pass).toBe(true);
      expect(w1.pass).toBe(true);
    });

    it('CAN FAIL: every strawman FAILs on the same archive (removal empties its own population)', () => {
      const sg = evaluateShape(strawmanG, { base, removed: gRemoved, planted: gPlanted }, { tolerance: INSENSITIVITY_TOLERANCE });
      expect(sg.base).not.toBeNull();
      expect(sg.removed).toBeNull();
      expect(sg.pass).toBe(false);

      const sm = evaluateShape(strawmanM, { base, removed: mRemoved, planted: mPlanted }, { tolerance: INSENSITIVITY_TOLERANCE, ctx: { shippedFloor: mShippedFloor } });
      expect(sm.base).not.toBeNull();
      expect(sm.removed).toBeNull();
      expect(sm.pass).toBe(false);

      const sw = evaluateShape(strawmanW, { base, removed: wRemoved, planted: wPlanted }, { tolerance: INSENSITIVITY_TOLERANCE, ctx: wCtx });
      expect(sw.base).not.toBeNull();
      expect(sw.removed).toBeNull();
      expect(sw.pass).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// shape arbitration
// ---------------------------------------------------------------------------

describe('shape arbitration', () => {
  it('PREDECLARED_SHAPES ids and order are pinned exactly: G [G1,G2,G3], M [M1,M2], W [W1,W2]', () => {
    expect(PREDECLARED_SHAPES.G.map((s) => s.id)).toEqual(['G1', 'G2', 'G3']);
    expect(PREDECLARED_SHAPES.M.map((s) => s.id)).toEqual(['M1', 'M2']);
    expect(PREDECLARED_SHAPES.W.map((s) => s.id)).toEqual(['W1', 'W2']);
  });

  it('G1 and G2 nonCircularity both carry the device-family-relabelling argument verbatim', () => {
    const g1 = PREDECLARED_SHAPES.G.find((s) => s.id === 'G1');
    const g2 = PREDECLARED_SHAPES.G.find((s) => s.id === 'G2');
    for (const shape of [g1, g2]) {
      expect(shape.nonCircularity).toContain('Why this is not device-family relabelling');
      expect(shape.nonCircularity).toContain('device-family reasoning creeping in');
    }
  });

  it('runFamily returns { strawman, rows, chosen } with chosen = first PASS or null', () => {
    const views = buildBaseViews(buildClearArchive());
    const family = runFamily('G', views, { plantedViews: views });
    expect(family).toHaveProperty('strawman');
    expect(family).toHaveProperty('rows');
    expect(family.rows.length).toBe(3);
    expect(family.chosen).not.toBeNull();
    expect(family.selectedId).toBe(family.chosen.id);
  });

  it('selectShape receives only { id, pass } rows at the runFamily call site', () => {
    // Source-scan: the call site maps rows to { id, pass } before calling selectShape, never
    // passing the full row (which would carry base/removed/planted/meaning/etc).
    return import('node:fs').then(({ readFileSync }) => {
      const text = readFileSync(new URL('./compute-pause-classification-calibration.mjs', import.meta.url), 'utf8');
      expect(text).toContain('rows.map((r) => ({ id: r.id, pass: r.pass }))');
    });
  });

  it('rounding: G and W round via ceilToSignificant(raw, 3); M rounds via Math.ceil(raw)', () => {
    const result = runCalibration(buildClearArchive(), null);
    expect(result.allCleared).toBe(true);
    // 0.12345 rounds UP to 3 significant figures as 0.124 (never 0.123, which a standard
    // round-to-nearest would give) — proves ceilToSignificant, not Math.round, is used.
    expect(result.shipped.STATIONARY_MAX_SPEED_MPS).toBeCloseTo(0.124, 6);
    // 6.5 rounds via Math.ceil to 7, not 6 (Math.floor).
    expect(result.shipped.FORGOTTEN_STOP_MIN_SEC).toBe(7);
  });

  it('a G HALT makes M and W render "not computed: upstream HALT" — families are null and the ' +
    'markdown says so', () => {
    const result = runCalibration(buildHaltArchive(), null);
    expect(result.families.G.chosen).toBeNull();
    expect(result.families.M).toBeNull();
    expect(result.families.W).toBeNull();
    expect(result.allCleared).toBe(false);

    const markdown = renderCalibrationMarkdown({ ...result, provenance: {} });
    expect(markdown).toContain('not computed: upstream HALT');
    expect(markdown).not.toContain('STATIONARY_MAX_SPEED_MPS = ');
  });
});

// ---------------------------------------------------------------------------
// gates
// ---------------------------------------------------------------------------

describe('gates', () => {
  it('ORDER gate passes iff 0 <= stationary < walkRun < UNRELIABLE_SPEED_LIMIT_MPS', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    const okShipped = { STATIONARY_MAX_SPEED_MPS: 0.5, WALK_RUN_BOUNDARY_MPS: 2.0, FORGOTTEN_STOP_MIN_SEC: 30 };
    const badShipped = { STATIONARY_MAX_SPEED_MPS: 2.0, WALK_RUN_BOUNDARY_MPS: 0.5, FORGOTTEN_STOP_MIN_SEC: 30 };
    expect(applyGates(views, okShipped, GATES_PASS_CONTROL_TEXT).gates.find((g) => g.id === 'order').pass).toBe(true);
    expect(applyGates(views, badShipped, GATES_PASS_CONTROL_TEXT).gates.find((g) => g.id === 'order').pass).toBe(false);
  });

  it('D-12 anchor with no CONFIRMED_CONTROL line fails every sub-gate with reason "no developer-confirmed control"', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    const result = applyGates(views, GATES_PASS_SHIPPED, null);
    for (const id of ['d12-anchor-i', 'd12-anchor-ii', 'd12-anchor-iii']) {
      const gate = result.gates.find((g) => g.id === id);
      expect(gate.pass).toBe(false);
      expect(gate.reason).toBe('no developer-confirmed control');
    }
  });

  it('D-12 anchor (i)/(ii)/(iii) all pass on a genuine walking-break control window', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    const result = applyGates(views, GATES_PASS_SHIPPED, GATES_PASS_CONTROL_TEXT);
    expect(result.gates.find((g) => g.id === 'd12-anchor-i').pass).toBe(true);
    expect(result.gates.find((g) => g.id === 'd12-anchor-i').measured).toBe('walked');
    expect(result.gates.find((g) => g.id === 'd12-anchor-ii').pass).toBe(true);
    expect(result.gates.find((g) => g.id === 'd12-anchor-iii').pass).toBe(true);
  });

  it('D-10 rule: named anchors classify correctly and the archive margin is clear', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    const d10 = d10Section(views);
    expect(d10.anchorsPass).toBe(true);
    expect(d10.marginClear).toBe(true);
    expect(d10.pass).toBe(true);
  });

  it('D-10 rule: a wrong-signature named anchor fails the anchor check', () => {
    // Swap the named distance-triggered anchor for a time-triggered stream.
    const views = buildBaseViews({
      activities: [
        buildTimeTriggered('3475740390'), // wrong: should be distance-triggered
        buildTimeTriggered('3475724402'),
        buildTimeTriggered('3475734189'),
        buildTimeTriggered('4556693525'),
      ],
      streamFileCount: 4,
      notComputable: 0,
    });
    const d10 = d10Section(views);
    expect(d10.anchorsPass).toBe(false);
    expect(d10.pass).toBe(false);
  });

  it('JOIN gate passes iff summed joinViolations is 0', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    expect(joinSection(views).total).toBe(0);
    expect(joinSection(views).pass).toBe(true);

    const withViolation = views.map((v) => (v.computable ? { ...v, joinViolations: 1 } : v));
    expect(joinSection(withViolation).total).toBeGreaterThan(0);
    expect(joinSection(withViolation).pass).toBe(false);
  });

  it('applyGates: every gate passes on the full gates-pass archive', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    const result = applyGates(views, GATES_PASS_SHIPPED, GATES_PASS_CONTROL_TEXT);
    expect(result.pass).toBe(true);
  });

  it('driftSection: "matters" iff the shipped G value is > 0; not computed on upstream HALT', () => {
    const views = buildBaseViews(buildClearArchive());
    expect(driftSection(views, null).computed).toBe(false);
    const drift = driftSection(views, 0.124);
    expect(drift.computed).toBe(true);
    expect(drift.matters).toBe(true);
    expect(drift.pairCount).toBeGreaterThan(0);

    const zeroDrift = driftSection(views, 0);
    expect(zeroDrift.matters).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------

describe('render', () => {
  const clearResult = { ...runCalibration(buildClearArchive(), GATES_PASS_CONTROL_TEXT) };
  clearResult.provenance = { streamsTree: 'abc123', newestActivityStartDate: '2026-01-01T00:00:00Z', controlFilePath: 'x.md' };

  const haltResult = { ...runCalibration(buildHaltArchive(), null) };
  haltResult.provenance = { streamsTree: 'def456', newestActivityStartDate: '2026-01-01T00:00:00Z', controlFilePath: 'x.md' };

  it('a clear fixture renders every heading in the contract order, then Chosen constants', () => {
    const markdown = renderCalibrationMarkdown(clearResult);
    const headings = [...markdown.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    const expectedPrefix = [
      'Statistic and scope',
      'Pre-declared shapes',
      'Rejected on argument',
      'Non-circularity',
      'Strawmen watched failing',
      'Shape arbitration',
    ];
    expect(headings.slice(0, expectedPrefix.length)).toEqual(expectedPrefix);
    expect(headings).toContain('Chosen constants');
    const expectedSuffix = [
      'Gates',
      'D-10 blind-spot rule',
      'Drift-while-stationary',
      'Join exhaustiveness',
      'Per-interval class table — 3475724402 (classifier output)',
      'Archive-wide findings (never an input to selection)',
      'Inputs',
    ];
    expect(headings.slice(headings.length - expectedSuffix.length)).toEqual(expectedSuffix);
  });

  it('the Chosen constants block contains the exact contract lines', () => {
    const markdown = renderCalibrationMarkdown(clearResult);
    expect(markdown).toContain(`STATIONARY_MAX_SPEED_MPS = ${clearResult.shipped.STATIONARY_MAX_SPEED_MPS}`);
    expect(markdown).toContain(`FORGOTTEN_STOP_MIN_SEC = ${clearResult.shipped.FORGOTTEN_STOP_MIN_SEC}`);
    expect(markdown).toContain(`WALK_RUN_BOUNDARY_MPS = ${clearResult.shipped.WALK_RUN_BOUNDARY_MPS}`);
    expect(markdown).toContain(`UNRELIABLE_SPEED_LIMIT_MPS = ${UNRELIABLE_SPEED_LIMIT_MPS} (imported, 32-CALIBRATION.md)`);
  });

  it('the per-interval table header string equals the contract exactly', () => {
    const markdown = renderCalibrationMarkdown(clearResult);
    expect(markdown).toContain('| # | source | startSec | endSec | seconds | metres | speedMps | class |');
    expect(markdown).toContain('## Per-interval class table — 3475724402 (classifier output)');
  });

  it('a HALT fixture contains ## NO SHAPE CLEARS and NO "STATIONARY_MAX_SPEED_MPS = " line', () => {
    const markdown = renderCalibrationMarkdown(haltResult);
    expect(markdown).toContain('## NO SHAPE CLEARS');
    expect(markdown).not.toContain('STATIONARY_MAX_SPEED_MPS = ');
  });

  it('a GATE FAILED fixture renders ## GATE FAILED, not ## NO SHAPE CLEARS, and no Chosen constants', () => {
    // All three families clear on the gates-pass archive when given synthetic shipped-band-shaped
    // context, but withholding the control text fails the D-12 gate.
    const views = buildBaseViews(buildGatesPassArchive());
    const gateFailedResult = {
      archive: { streamFileCount: 5, notComputable: 0 },
      families: {
        G: { strawman: { pass: false, base: 1, removed: null, planted: 1, removedDelta: null, plantedDelta: 0, baseN: 1, removedN: 0, plantedN: 1 }, rows: PREDECLARED_SHAPES.G.map((s) => ({ id: s.id, pass: false, base: null, removed: null, planted: null, removedDelta: null, plantedDelta: null, baseN: 0, removedN: 0, plantedN: 0 })), selectedId: 'G1', chosen: { id: 'G1', base: 0.5 } },
        M: { strawman: { pass: false, base: 1, removed: null, planted: 1, removedDelta: null, plantedDelta: 0, baseN: 1, removedN: 0, plantedN: 1 }, rows: PREDECLARED_SHAPES.M.map((s) => ({ id: s.id, pass: false, base: null, removed: null, planted: null, removedDelta: null, plantedDelta: null, baseN: 0, removedN: 0, plantedN: 0 })), selectedId: 'M1', chosen: { id: 'M1', base: 30 } },
        W: { strawman: { pass: false, base: 1, removed: null, planted: 1, removedDelta: null, plantedDelta: 0, baseN: 1, removedN: 0, plantedN: 1 }, rows: PREDECLARED_SHAPES.W.map((s) => ({ id: s.id, pass: false, base: null, removed: null, planted: null, removedDelta: null, plantedDelta: null, baseN: 0, removedN: 0, plantedN: 0 })), selectedId: 'W1', chosen: { id: 'W1', base: 2.0 } },
      },
      shipped: GATES_PASS_SHIPPED,
      allCleared: true,
      gates: applyGates(views, GATES_PASS_SHIPPED, null),
      d10: d10Section(views),
      join: joinSection(views),
      drift: driftSection(views, GATES_PASS_SHIPPED.STATIONARY_MAX_SPEED_MPS),
      perIntervalTable: perIntervalTable(views, { stationaryMaxMps: 0.5, walkRunMps: 2.0 }),
      archiveFindings: archiveFindings(views, { stationaryMaxMps: 0.5, walkRunMps: 2.0 }, { stationaryMaxMps: 0.5, minSec: 30 }),
      provenance: {},
    };
    expect(gateFailedResult.gates.pass).toBe(false);
    const markdown = renderCalibrationMarkdown(gateFailedResult);
    expect(markdown).toContain('## GATE FAILED');
    expect(markdown).not.toContain('## NO SHAPE CLEARS');
    expect(markdown).not.toContain('STATIONARY_MAX_SPEED_MPS = ');
  });

  it("the ## Non-circularity section's G rows contain the device-family substrings on both the clear and the HALT fixtures", () => {
    for (const result of [clearResult, haltResult]) {
      const markdown = renderCalibrationMarkdown(result);
      expect(markdown).toContain('Why this is not device-family relabelling');
      expect(markdown).toContain('device-family reasoning creeping in');
    }
  });

  it('rendering the same fixture twice is byte-identical', () => {
    const first = renderCalibrationMarkdown(clearResult);
    const second = renderCalibrationMarkdown(clearResult);
    expect(first).toBe(second);
  });

  it('the rendered Markdown contains no wall-clock date pattern, no bare rev-parse HEAD commit id, and no source-file hash', () => {
    const markdown = renderCalibrationMarkdown(clearResult);
    // No ISO-8601 timestamp literal anywhere except the one explicitly provided as a fixed
    // provenance INPUT (not a wall-clock read) — the generator itself calls Date.now()/new Date()
    // nowhere, verified by source-scan below.
    expect(markdown).not.toMatch(/\b[0-9a-f]{40}\b/); // no 40-hex commit id
  });

  it("the generator's own source never calls Date.now() or `new Date()`, and never runs `rev-parse HEAD'` alone", () => {
    return import('node:fs').then(({ readFileSync }) => {
      const text = readFileSync(new URL('./compute-pause-classification-calibration.mjs', import.meta.url), 'utf8');
      expect(text).not.toMatch(/Date\.now\(\)|new Date\(/);
      expect(text).not.toContain("rev-parse HEAD'");
    });
  });
});

// ---------------------------------------------------------------------------
// exit contract
// ---------------------------------------------------------------------------

describe('exit contract', () => {
  it('decideOutcome: 0 when every family cleared, every gate passed, and no shipped constant is present', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    const result = {
      allCleared: true,
      gates: applyGates(views, GATES_PASS_SHIPPED, GATES_PASS_CONTROL_TEXT),
      shipped: GATES_PASS_SHIPPED,
    };
    expect(decideOutcome(result, {}).exitCode).toBe(0);
  });

  it('decideOutcome: 0 when the shipped constant is present and exactly equal to the derived value', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    const result = {
      allCleared: true,
      gates: applyGates(views, GATES_PASS_SHIPPED, GATES_PASS_CONTROL_TEXT),
      shipped: GATES_PASS_SHIPPED,
    };
    expect(decideOutcome(result, { STATIONARY_MAX_SPEED_MPS: 0.5 }).exitCode).toBe(0);
  });

  it('decideOutcome: 1 on NO SHAPE CLEARS (allCleared false)', () => {
    const result = { allCleared: false, gates: null, shipped: {} };
    expect(decideOutcome(result, {}).exitCode).toBe(1);
    expect(decideOutcome(result, {}).reason).toBe('no-shape-clears');
  });

  it('decideOutcome: 1 on a failed gate (allCleared true, gates.pass false)', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    const result = {
      allCleared: true,
      gates: applyGates(views, GATES_PASS_SHIPPED, null), // no control text -> D-12 gate fails
      shipped: GATES_PASS_SHIPPED,
    };
    expect(decideOutcome(result, {}).exitCode).toBe(1);
    expect(decideOutcome(result, {}).reason).toBe('gate-failed');
  });

  it('decideOutcome: 2 when a shipped constant is present and differs from the derived value', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    const result = {
      allCleared: true,
      gates: applyGates(views, GATES_PASS_SHIPPED, GATES_PASS_CONTROL_TEXT),
      shipped: GATES_PASS_SHIPPED,
    };
    expect(decideOutcome(result, { STATIONARY_MAX_SPEED_MPS: 0.999 }).exitCode).toBe(2);
    expect(decideOutcome(result, { STATIONARY_MAX_SPEED_MPS: 0.999 }).reason).toBe('shipped-mismatch');
  });
});

// ---------------------------------------------------------------------------
// D-13 constants sanity (also exercised implicitly above)
// ---------------------------------------------------------------------------

describe('predeclared constants', () => {
  it('INSENSITIVITY_TOLERANCE is fixed at 1%', () => {
    expect(INSENSITIVITY_TOLERANCE).toBe(0.01);
  });

  it('NEIGHBOURHOOD_SEC is imported from RECORDING_GAP_ABS_THRESHOLD_SEC, never a literal 10', () => {
    expect(NEIGHBOURHOOD_SEC).toBe(10);
  });

  it('VALLEY_BIN_WIDTH_MPS is fixed at 0.1', () => {
    expect(VALLEY_BIN_WIDTH_MPS).toBe(0.1);
  });

  it('INSENSITIVITY_SOURCE_ACTIVITY_ID is fixed at 3475724402', () => {
    expect(INSENSITIVITY_SOURCE_ACTIVITY_ID).toBe('3475724402');
  });

  it('REJECTED_SHAPES is non-empty', () => {
    expect(REJECTED_SHAPES.length).toBeGreaterThan(0);
  });
});
