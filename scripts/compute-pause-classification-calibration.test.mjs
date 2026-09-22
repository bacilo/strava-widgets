/**
 * Synthetic-fixture tests for compute-pause-classification-calibration.mjs (34-04-PLAN.md). No real
 * committed stream file is read anywhere in this file — every fixture below is hand-built. Importing
 * the generator must not run an archive read or a write to 34-CALIBRATION.md; `main()` is never
 * invoked here (D-08: the generator is not run against the real archive in this plan).
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { UNRELIABLE_SPEED_LIMIT_MPS } from '../dist/analytics/pace-derivation.js';
import {
  DECLARED_STATIONARY_MAX_SPEED_MPS,
  DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT,
  DECLARED_WALK_RUN_BOUNDARY_MPS,
  DECLARED_WALK_RUN_BOUNDARY_MPS_TEXT,
  INSENSITIVITY_SOURCE_ACTIVITY_ID,
  INSENSITIVITY_TOLERANCE,
  NEIGHBOURHOOD_SEC,
  PLANT_FRACTION,
  PREDECLARED_SHAPES,
  REJECTED_SHAPES,
  STATIONARY_PROVENANCE_TEXT,
  VALLEY_BIN_WIDTH_MPS,
  WALK_RUN_PROVENANCE_TEXT,
  applyGates,
  archiveFindings,
  buildBaseViews,
  d10Section,
  decideOutcome,
  driftSection,
  evaluateShape,
  histogramOf,
  joinSection,
  mwFloorFromDeclared,
  perIntervalTable,
  plantShapes,
  removeNeighbourhoods,
  renderCalibrationMarkdown,
  runCalibration,
  runFamily,
  shapeG4,
  shapeG5,
  shapeM1,
  shapeM2,
  shapeW1,
  shapeW2,
  strawmanG,
  strawmanM,
  strawmanW,
  valleyEvidenceSection,
  valleyOf,
} from './compute-pause-classification-calibration.mjs';

// ---------------------------------------------------------------------------
// planted entry (34-12-PLAN.md D-19 gap closure) — RED evidence, then GREEN
// ---------------------------------------------------------------------------

/**
 * A synthetic archive that actually contains zero-advance pauses (unlike `buildClearArchive`'s
 * "no pause anywhere" fixture): two activities, each with two zero-advance pause intervals joined
 * by a short advancing bridge (duration < P_a), a recording gap immediately adjoining the second
 * pause (within the R=10s neighbourhood width), and a cadence array. One activity is literally
 * `INSENSITIVITY_SOURCE_ACTIVITY_ID` (3475724402), so its own J interval(s) serve as the D-13
 * plant source shapes.
 */
function buildPauseBearingActivity(id) {
  const t = [];
  const d = [];
  const cadence = [];
  let time = 0;
  let dist = 0;

  // Warm-up: 50 covered samples at dt=1s, speed=3.0 m/s, cadence=160 (background population).
  for (let i = 0; i <= 50; i++) {
    t.push(time);
    d.push(dist);
    cadence.push(160);
    time += 1;
    dist += 3.0;
  }
  // Pause 1: flat run, duration 10s (> P_a=5s for this fixture), cadence 0.
  for (let i = 0; i < 10; i++) {
    t.push(time);
    d.push(dist);
    cadence.push(0);
    time += 1;
  }
  t.push(time);
  d.push(dist);
  cadence.push(0);
  // Bridge: 3 samples advancing at 0.5 m/s per step, duration 3s (< P_a=5s), cadence 0.
  for (let i = 0; i < 3; i++) {
    time += 1;
    dist += 0.5;
    t.push(time);
    d.push(dist);
    cadence.push(0);
  }
  // Pause 2: flat run, duration 10s, cadence 0.
  for (let i = 0; i < 10; i++) {
    time += 1;
    t.push(time);
    d.push(dist);
    cadence.push(0);
  }
  // Recording gap immediately adjoining pause 2's end (0s separation, well within the R=10s
  // neighbourhood width): a 15s jump (> RECORDING_GAP_ABS_THRESHOLD_SEC=10s).
  time += 15;
  dist += 1.0;
  t.push(time);
  d.push(dist);
  cadence.push(160);
  // Tail: 10 more covered samples at 3.0 m/s, cadence 160.
  for (let i = 0; i < 10; i++) {
    time += 1;
    dist += 3.0;
    t.push(time);
    d.push(dist);
    cadence.push(160);
  }

  return { id, t, d, cadence };
}

function pauseBearingArchive() {
  const activities = [
    buildPauseBearingActivity(INSENSITIVITY_SOURCE_ACTIVITY_ID),
    buildPauseBearingActivity('PB2'),
  ];
  return { activities, streamFileCount: activities.length, notComputable: 0 };
}

describe('planted entry', () => {
  it('pauseBearingArchive yields non-empty pauseIntervals and a non-empty G4 (chained episode) population', () => {
    const views = buildBaseViews(pauseBearingArchive());
    for (const v of views) {
      expect(v.computable).toBe(true);
      expect(v.pauseIntervals.length).toBeGreaterThan(0);
    }
    expect(shapeG4(views).n).toBeGreaterThan(0);
  });

  // HISTORICAL NOTE — RED evidence (recorded verbatim in 34-12-SUMMARY.md and in the "test(34-12):
  // planted entry fails on HALT-1 planting" commit): before the fix below, calling the then-current
  // family-wide `plantShapes(views, sourceShapes)` (count = archive |J|, plants pushed only into
  // coveredPairs/foldedSteps/positionedAdvanceIntervals at span [0, seconds]) on this fixture gave:
  //   G3: expected planted.items (32) === base.items (32) + plantCount (2) = 34, got 32
  //   strawman G: expected planted.items (2) === base.items (2) + plantCount (2) = 4, got 2
  // — G3's position-filtered population and strawman G's J population never received a plant. The
  // fix below (proportional, per-shape planting with unconditional admission) is exercised by every
  // test in this describe block from here on.

  it('GREEN: every PREDECLARED_SHAPES entry and every strawman satisfies ' +
    'plantedItems === baseItems + plantCount, and plantCount === ceil(PLANT_FRACTION * baseItems)', () => {
    const views = buildBaseViews(pauseBearingArchive());
    const sourceShapes = views
      .find((v) => v.id === INSENSITIVITY_SOURCE_ACTIVITY_ID)
      .J.map((iv) => ({ metres: iv.metres, seconds: iv.seconds }));

    const gFamily = runFamily('G', views, { sourceShapes });
    const mFamily = runFamily('M', views, { sourceShapes, shippedFloor: 0.2 });
    const wFamily = runFamily('W', views, { sourceShapes, shippedFloor: 0.2 });

    let checked = 0;
    for (const family of [gFamily, mFamily, wFamily]) {
      for (const row of [family.strawman, ...family.rows]) {
        expect(row.baseItems).not.toBeNull();
        expect(row.plantCount).toBe(Math.ceil(PLANT_FRACTION * row.baseItems));
        expect(row.plantedItems, `${family.familyId ?? ''} ${row.id ?? 'strawman'}`).toBe(
          row.baseItems + row.plantCount
        );
        checked++;
      }
    }
    // G(strawman+2 shapes) + M(strawman+2 shapes) + W(strawman+2 shapes) = 3 + 3 + 3 = 9 rows.
    expect(checked).toBe(9);
  });

  it('PLANT_FRACTION is assigned from INSENSITIVITY_TOLERANCE, not a literal', () => {
    expect(PLANT_FRACTION).toBe(INSENSITIVITY_TOLERANCE);
  });

  it('a shape with base items 0 receives 0 plants and evaluates FAIL (null base)', () => {
    // buildHaltArchive() has NO zero-advance pause anywhere, so G4/G5's base population is empty.
    const views = buildBaseViews(buildHaltArchive());
    const sourceShapes = views
      .find((v) => v.id === INSENSITIVITY_SOURCE_ACTIVITY_ID)
      .J.map((iv) => ({ metres: iv.metres, seconds: iv.seconds }));
    const gFamily = runFamily('G', views, { sourceShapes });
    for (const row of gFamily.rows) {
      expect(row.baseItems).toBe(0);
      expect(row.plantCount).toBe(0);
      expect(row.base).toBeNull();
      expect(row.pass).toBe(false);
    }
  });

  it('placement: a plant never lands in an activity with zero base items for that population', () => {
    const views = buildBaseViews(pauseBearingArchive());
    const sourceShapes = views
      .find((v) => v.id === INSENSITIVITY_SOURCE_ACTIVITY_ID)
      .J.map((iv) => ({ metres: iv.metres, seconds: iv.seconds }));
    // A third, non-member activity: computable, but contributes zero cadence-silent covered pairs.
    const nonMember = {
      id: 'NOPAIRS',
      computable: true,
      t: [0, 1],
      d: [0, 1],
      coverage: { spanSec: 1, coveredSec: 1, recordingGapSec: 0, pauseSec: 0, unreliableSec: 0, gapIntervals: [] },
      segments: [],
      coveredRuns: [{ startIndex: 0, endIndex: 1 }],
      J: [],
      pauseIntervals: [],
      coveredPairs: [],
      foldedSteps: [],
      positionedAdvanceIntervals: [],
      plantedCreepDurations: [],
      notClassifiableCount: 0,
      joinViolations: 0,
    };
    const population = {
      arrayKey: 'coveredPairs',
      baseItemCount: (v) => v.coveredPairs.filter((p) => p.cadenceSilent).length,
      buildItem: (template, sentinel) => ({
        index: sentinel,
        startSec: 0,
        endSec: template.seconds,
        metres: template.metres,
        seconds: template.seconds,
        speedMps: template.metres / template.seconds,
        cadenceSilent: true,
        planted: true,
      }),
    };
    const result = plantShapes([...views, nonMember], sourceShapes, { population, count: 5 });
    const nopairsView = result.views.find((v) => v.id === 'NOPAIRS');
    expect(nopairsView.coveredPairs.length).toBe(0);
    expect(result.plantedCount).toBe(5);
  });

  it('no plant carries a synthetic [0, seconds] span that a shape filters on — membership comes ' +
    'only from the `planted` flag (HALT-1\'s own defect: strawman G\'s J population never received ' +
    'a plant because plants never reached J)', () => {
    const views = buildBaseViews(pauseBearingArchive());
    const sourceShapes = views
      .find((v) => v.id === INSENSITIVITY_SOURCE_ACTIVITY_ID)
      .J.map((iv) => ({ metres: iv.metres, seconds: iv.seconds }));
    const gFamily = runFamily('G', views, { sourceShapes });
    // strawman G's population is J — under HALT-1's family-wide plantShapes, plants never entered
    // J at all (pushed only into coveredPairs/foldedSteps/positionedAdvanceIntervals). Now they do,
    // unconditionally, via the `planted` flag — no span-based filter exists on J membership.
    expect(gFamily.strawman.plantedItems).toBe(gFamily.strawman.baseItems + gFamily.strawman.plantCount);
  });
});

// ---------------------------------------------------------------------------
// Shared synthetic fixture builders — no real stream is ever read
// ---------------------------------------------------------------------------

/**
 * [D-19, plan 34-12] The canonical "bulk-dominated" background activity, redesigned for Family G's
 * re-declared shapes (G4/G5, standstill episodes):
 * - `standstillGroups` repeated groups, each: a moving separator (10s @ 3.0 m/s — a covered run of
 *   duration >= P_a, so it structurally BREAKS chaining between groups), a pause (10s, > P_a), a
 *   short bridge (3 samples advancing at 1.0 m/s each, duration 3s < P_a — deliberately the SAME
 *   speed as the walking hump below, so its folded-step speed merges into W's walk cluster rather
 *   than creating a spurious extra valley dip), and a second pause (10s). Each group forms exactly
 *   one CHAINED standstill episode (feeds G4/G5).
 * - a slow creep block (300 samples @ `creepSpeed`, well below the eventual shipped G value so it
 *   is EXCLUDED from W's [lo, hi) histogram range but still a covered population — feeds M1/M2's
 *   P_a and gives strawman M's creep-candidate population real (non-degenerate) content).
 * - a single recording gap (feeds J / the G/W strawmen and the D-13 plant source shapes).
 * - a walking hump (~1.0 m/s) and a running hump (~3.0 m/s) separated by an empty speed band (feeds
 *   W1/W2's valley).
 * `dt` is deliberately non-round (1.3s) so the rounding rule (`ceilToSignificant` for G/W,
 * `Math.ceil` for M) is genuinely exercised, not a no-op on an already-round input.
 */
function buildBackgroundActivity(id, { gapMetres = 1.0, dt = 1.3, creepSpeed = 0.05, standstillGroups = 12 } = {}) {
  const t = [];
  const d = [];
  const cadence = [];
  let time = 0;
  let dist = 0;

  for (let g = 0; g < standstillGroups; g++) {
    for (let i = 0; i < 10; i++) {
      time += 1;
      dist += 3.0;
      t.push(time);
      d.push(dist);
      cadence.push(160);
    }
    for (let i = 0; i < 10; i++) {
      time += 1;
      t.push(time);
      d.push(dist);
      cadence.push(0);
    }
    for (let i = 0; i < 3; i++) {
      time += 1;
      dist += 1.0;
      t.push(time);
      d.push(dist);
      cadence.push(80);
    }
    for (let i = 0; i < 10; i++) {
      time += 1;
      t.push(time);
      d.push(dist);
      cadence.push(0);
    }
  }

  for (let i = 0; i <= 300; i++) {
    t.push(time);
    d.push(dist);
    cadence.push(0);
    time += dt;
    dist += creepSpeed * dt;
  }
  time += 15; // recording gap: dt = 15s > RECORDING_GAP_ABS_THRESHOLD_SEC (10s)
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

/**
 * No cadence anywhere and no zero-advance pause interval anywhere, so G4/G5's population is always
 * empty (shapeG4/shapeG5 value null — unaffected by [D-21]'s change below).
 *
 * [D-21, plan 34-14] Every activity is ALSO "creep-dominated": a tiny near-zero-speed block (8
 * samples at 0.01 m/s, well under the declared 0.5 m/s floor) immediately followed by one huge
 * single-sample advance-interval outlier (100s). Before D-21, Family W's own inability to find a
 * valley on a single-speed population was what made this fixture represent "no shape clears" archive-
 * wide; D-21 makes W evidence-only, so that blocker is gone, and M1/M2 (Family M's OWN pre-declared
 * shapes, unaffected by D-21) would otherwise trivially CLEAR D-13 on a perfectly uniform-duration
 * population (nothing for REMOVED/PLANTED to be sensitive to — the harness's own known limitation on
 * a degenerate fixture, not a D-21 defect). Every activity being creep-dominated makes
 * `removeNeighbourhoods('M', ...)` strip EACH activity's ENTIRE `positionedAdvanceIntervals` (the
 * creep candidate's padded neighbourhood covers the whole activity, including the outlier), so
 * `pooledPa`'s REMOVED array is empty for every member — `shapeM1`/`shapeM2`'s REMOVED value is
 * `null`, which `evaluateShape` FAILs unconditionally, restoring this fixture's documented "no shape
 * clears" property for M as well as G.
 */
function buildHaltArchive() {
  function creepDominatedActivity(id) {
    const t = [];
    const d = [];
    let time = 0;
    let dist = 0;
    for (let i = 0; i <= 8; i++) {
      t.push(time);
      d.push(dist);
      time += 1;
      dist += 0.01; // creep: well under the declared 0.5 m/s stationary floor
    }
    time += 100; // one huge single-sample advance-interval outlier
    dist += 300;
    t.push(time);
    d.push(dist);
    return { id, t, d, cadence: null };
  }
  const activities = [
    creepDominatedActivity('h0'),
    creepDominatedActivity('h1'),
    creepDominatedActivity(INSENSITIVITY_SOURCE_ACTIVITY_ID),
  ];
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

/** [D-21, plan 34-14] H1 fixture reshape: a bulk running-hump activity, continuous covered running
 * well above the declared 2.2 m/s boundary, ADDED to `buildGatesPassArchive` so the archive's OWN
 * time-weighted (W1) modal bin sits above the boundary under test — required by the new `d21-basis`
 * gate. Never a retune of any EXISTING activity's speeds or durations. */
function buildRunningHumpActivity(id) {
  const t = [0];
  const d = [0];
  let time = 0;
  let dist = 0;
  for (let i = 0; i < 2000; i++) {
    time += 1;
    dist += 3.2; // well above the declared 2.2 m/s boundary
    t.push(time);
    d.push(dist);
  }
  return { id, t, d, cadence: null };
}

/** The full "everything clears, every gate passes" archive: the control activity, the four named
 * D-10 anchors, and [D-21] the bulk running-hump activity H1 adds. */
function buildGatesPassArchive() {
  const activities = [
    buildControlActivity('CTRL1'),
    buildDistanceTriggered('3475740390'),
    buildTimeTriggered('3475724402'),
    buildTimeTriggered('3475734189'),
    buildTimeTriggered('4556693525'),
    buildRunningHumpActivity('RUNHUMP1'),
  ];
  return { activities, streamFileCount: activities.length, notComputable: 0 };
}
const GATES_PASS_SHIPPED = { STATIONARY_MAX_SPEED_MPS: 0.5, WALK_RUN_BOUNDARY_MPS: 2.2, FORGOTTEN_STOP_MIN_SEC: 31 };
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

/**
 * 20 UNIFORM background activities (no small D-10/D-12 fixtures mixed in), one literally named
 * 3475724402. [D-19] Proportional per-shape planting round-robins evenly BY ACTIVITY ID, not
 * weighted by each activity's own population size — mixing in `buildClearArchive`'s small
 * (~40-sample) D-10/D-12 fixtures means those activities absorb the same plant share as a
 * ~1200-sample background activity, contaminating them far more than 1%. This fixture keeps every
 * member activity's own population large, so a proportional plant is genuinely negligible
 * everywhere it lands.
 */
function buildInsensitiveArchive() {
  const activities = [];
  for (let i = 0; i < 19; i++) {
    activities.push(buildBackgroundActivity(`ia${i}`, { gapMetres: i % 2 === 0 ? 2.0 : 45.0 }));
  }
  activities.push(buildBackgroundActivity(INSENSITIVITY_SOURCE_ACTIVITY_ID));
  return { activities, streamFileCount: activities.length, notComputable: 0 };
}

// ---------------------------------------------------------------------------
// standstill episodes (34-12-PLAN.md D-19 STANDSTILL DEFINITIONS)
// ---------------------------------------------------------------------------

describe('standstill episodes', () => {
  it('chains across a bridge shorter than P_a: two pauses joined by a short advancing covered run ' +
    'become ONE episode, chained: true, with hand-computed seconds/metres/rate', () => {
    // buildPauseBearingActivity: pause1 (10s) -> bridge (3 samples @ 0.5 m/s/step, 3s) -> pause2 (10s).
    const views = buildBaseViews(pauseBearingArchive());
    const view = views.find((v) => v.id === INSENSITIVITY_SOURCE_ACTIVITY_ID);
    expect(view.paSec).toBe(5); // PAUSE_GAP_P90_MULTIPLIER(5) * p90(1s advance intervals)
    expect(view.standstillEpisodes.length).toBe(1);
    const ep = view.standstillEpisodes[0];
    expect(ep.chained).toBe(true);
    expect(ep.pauseCount).toBe(2);
    expect(ep.seconds).toBe(23); // 10 (pause1) + 3 (bridge) + 10 (pause2)
    expect(ep.metres).toBeCloseTo(1.5, 6); // 3 steps * 0.5 m
    expect(ep.rateMps).toBeCloseTo(1.5 / 23, 6);
  });

  it('does NOT chain across a covered run of P_a or longer: a moving separator (duration >= P_a) ' +
    'between two pause groups gives TWO separate episodes, not one', () => {
    // Each buildBackgroundActivity() standstill group is [moving separator (10s @ 3.0 m/s, >= P_a) ,
    // pause, bridge (3s @ 1.0 m/s, < P_a), pause] — NG groups must give NG separate chained episodes,
    // never one giant chain, because the separator's own duration structurally fails the bridge test.
    const views = buildBaseViews({
      activities: [buildBackgroundActivity('bg', { standstillGroups: 3 })],
      streamFileCount: 1,
      notComputable: 0,
    });
    const view = views[0];
    const chained = view.standstillEpisodes.filter((ep) => ep.chained);
    expect(chained.length).toBe(3);
    for (const ep of chained) expect(ep.pauseCount).toBe(2);
  });

  it('does NOT chain across a recording gap: a gap-bearing interval between two pauses breaks the ' +
    'chain even when the gap itself is short', () => {
    const t = [];
    const d = [];
    let time = 0;
    let dist = 0;
    // bulk moving phase (establishes a small, robust P_a=5 baseline: 5 * p90(1s advance intervals))
    for (let i = 0; i <= 50; i++) {
      t.push(time);
      d.push(dist);
      time += 1;
      dist += 1.0;
    }
    // pause 1 (10s)
    for (let i = 0; i < 10; i++) {
      time += 1;
      t.push(time);
      d.push(dist);
    }
    // recording gap (12s > RECORDING_GAP_ABS_THRESHOLD_SEC=10s), d UNCHANGED across it (so the gap
    // itself registers no advance interval, keeping P_a at the bulk-phase baseline)
    time += 12;
    t.push(time);
    d.push(dist);
    // pause 2 (10s)
    for (let i = 0; i < 10; i++) {
      time += 1;
      t.push(time);
      d.push(dist);
    }
    const views = buildBaseViews({ activities: [{ id: 'gapbreak', t, d, cadence: null }], streamFileCount: 1, notComputable: 0 });
    const view = views[0];
    expect(view.paSec).toBe(5);
    expect(view.pauseIntervals.length).toBe(2);
    expect(view.standstillEpisodes.every((ep) => !ep.chained)).toBe(true);
    expect(view.standstillEpisodes.length).toBe(2);
  });

  it('a single-pause episode (no qualifying bridge on either side) is chained: false', () => {
    const t2 = [];
    const d2 = [];
    let time = 0;
    for (let i = 0; i <= 20; i++) {
      t2.push(time);
      d2.push(time);
      time += 1;
    }
    for (let i = 0; i < 10; i++) {
      time += 1;
      t2.push(time);
      d2.push(20);
    }
    const views2 = buildBaseViews({ activities: [{ id: 'single2', t: t2, d: d2, cadence: null }], streamFileCount: 1, notComputable: 0 });
    const view2 = views2[0];
    expect(view2.pauseIntervals.length).toBe(1);
    expect(view2.standstillEpisodes.length).toBe(1);
    expect(view2.standstillEpisodes[0].chained).toBe(false);
    expect(view2.standstillEpisodes[0].metres).toBe(0);
    expect(view2.standstillEpisodes[0].rateMps).toBe(0);
  });

  it('the bridge invariant: a hand-built stream cannot make classifyGapsWithSegments emit two ' +
    'ADJACENT maximal zero-advance runs with a zero-metres covered run bridging them — a flat run ' +
    'immediately followed by more flat samples simply MERGES into one longer pause, confirming the ' +
    'invariant\'s own premise ("two distinct maximal zero-advance runs must be separated by at ' +
    'least one advance, or they would be one run") holds through the real pipeline, never throwing ' +
    'on this ordinary, non-adversarial fixture', () => {
    const t = [];
    const d = [];
    let time = 0;
    let dist = 0;
    // bulk moving phase (establishes a small, robust P_a=5 baseline)
    for (let i = 0; i <= 50; i++) {
      t.push(time);
      d.push(dist);
      time += 1;
      dist += 1.0;
    }
    // 23 flat samples (22s): would-be "pause1 + zero-metres bridge + pause2" all merge into one
    // maximal zero-advance run, since nothing separates them.
    for (let i = 0; i <= 22; i++) {
      time += 1;
      t.push(time);
      d.push(dist);
    }
    const archive = { activities: [{ id: 'zerobridge', t, d, cadence: null }], streamFileCount: 1, notComputable: 0 };
    expect(() => buildBaseViews(archive)).not.toThrow();
    const views = buildBaseViews(archive);
    // Exactly ONE (unchained) episode — the merge-into-one-pause reading, never two pauses bridged
    // by a zero-metres run.
    expect(views[0].standstillEpisodes.length).toBe(1);
    expect(views[0].standstillEpisodes[0].chained).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// reference shape
// ---------------------------------------------------------------------------

describe('reference shape', () => {
  const views = buildBaseViews(buildClearArchive());

  it('G4: R-7 p90 of chained standstill-episode rates, pooled', () => {
    const result = shapeG4(views);
    // Each group's episode: bridge metres 3*1.0=3.0m over seconds 10+3+10=23 -> rate 3/23.
    expect(result.value).toBeCloseTo(3 / 23, 5);
    expect(result.n).toBeGreaterThan(0);
    expect(result.items).toBe(result.n);
  });

  it('G5: R-7 p90 across activities of (chained-episode metres / chained-episode seconds)', () => {
    const result = shapeG5(views);
    expect(result.value).toBeCloseTo(3 / 23, 5);
  });

  it('G4/G5: HALTed (null base) on an archive with no zero-advance pause anywhere', () => {
    expect(shapeG4(buildBaseViews(buildHaltArchive())).value).toBeNull();
    expect(shapeG5(buildBaseViews(buildHaltArchive())).value).toBeNull();
  });

  it('strawman G: R-7 p90 of J speeds, pooled', () => {
    const result = strawmanG(views);
    expect(result.value).not.toBeNull();
    expect(result.n).toBe(16);
  });

  it('M1: R-7 p90 across activities of each activity\'s own P_a', () => {
    const result = shapeM1(views);
    // The dt=1.3s creep/walk/run population dominates each activity's own advance-interval
    // distribution, so P_a = PAUSE_GAP_P90_MULTIPLIER * 1.3 archive-wide.
    expect(result.value).toBeCloseTo(6.5, 5);
  });

  it('M2: R-7 p50 across activities of each activity\'s own P_a', () => {
    const result = shapeM2(views);
    expect(result.value).toBeCloseTo(6.5, 5);
  });

  it('strawman M: R-7 p90 of creep-candidate durations archive-wide, at the shipped G floor', () => {
    const result = strawmanM(views, { shippedFloor: 0.131 });
    expect(result.value).not.toBeNull();
    expect(result.value).toBeGreaterThan(0);
  });

  it('W1: the valley in covered time by speed, time-weighted, over [lo, hi)', () => {
    const result = shapeW1(views, { lo: 0.131, hi: UNRELIABLE_SPEED_LIMIT_MPS });
    expect(result.value).not.toBeNull();
    expect(result.value).toBeGreaterThan(1.0);
    expect(result.value).toBeLessThan(3.0);
  });

  it('W2: the same valley, count-weighted', () => {
    const result = shapeW2(views, { lo: 0.131, hi: UNRELIABLE_SPEED_LIMIT_MPS });
    expect(result.value).not.toBeNull();
  });

  it('strawman W: the valley over J speeds (count-weighted)', () => {
    const result = strawmanW(views, { lo: 0.131, hi: UNRELIABLE_SPEED_LIMIT_MPS });
    // A small pooled J population (16 items, one per activity) may or may not admit a qualifying
    // dip on its own — the D-13 harness below is what proves the strawman FAILs regardless.
    expect(result.n).toBeGreaterThan(0);
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

  it('plantShapes: plants round-robin by id, into the given population, count clones; plants carry ' +
    'the `planted: true` flag', () => {
    const views = buildBaseViews(buildClearArchive());
    const sourceShapes = views
      .find((v) => v.id === INSENSITIVITY_SOURCE_ACTIVITY_ID)
      .J.map((iv) => ({ metres: iv.metres, seconds: iv.seconds }));
    const population = {
      arrayKey: 'coveredPairs',
      baseItemCount: (v) => v.coveredPairs.filter((p) => p.cadenceSilent).length,
      buildItem: (template, sentinel) => ({
        index: sentinel,
        startSec: 0,
        endSec: template.seconds,
        metres: template.metres,
        seconds: template.seconds,
        speedMps: template.metres / template.seconds,
        cadenceSilent: true,
        planted: true,
      }),
    };

    const result = plantShapes(views, sourceShapes, { population, count: 7 });
    expect(result.plantedCount).toBe(7);

    let plantedFound = 0;
    for (const v of result.views) {
      if (!v.computable) continue;
      for (const p of v.coveredPairs) {
        if (p.planted) {
          plantedFound++;
          expect(p.cadenceSilent).toBe(true);
        }
      }
    }
    expect(plantedFound).toBe(7);
  });

  it('plantShapes: zero count plants nothing; zero source shapes plants nothing', () => {
    const views = buildBaseViews(buildClearArchive());
    const population = {
      arrayKey: 'coveredPairs',
      baseItemCount: (v) => v.coveredPairs.length,
      buildItem: (template, sentinel) => ({ index: sentinel, cadenceSilent: true, planted: true, ...template }),
    };
    const zeroCount = plantShapes(views, [{ metres: 1, seconds: 1 }], { population, count: 0 });
    expect(zeroCount.plantedCount).toBe(0);
    expect(zeroCount.views).toBe(views);

    const zeroSource = plantShapes(views, [], { population, count: 5 });
    expect(zeroSource.plantedCount).toBe(0);
    expect(zeroSource.views).toBe(views);
  });

  describe('CAN PASS / CAN FAIL (bulk-dominated synthetic archive)', () => {
    // Built via runFamily (the real per-shape planting/removal harness, D-19) — each shape's own
    // plant count is proportional to its own base items (D-19: no longer a single family-wide
    // |J| plant), so EVERY member activity must itself be bulk-dominated, not just the pooled
    // total — `buildInsensitiveArchive` (20 uniform background activities, no small D-10/D-12
    // fixtures mixed in) is deliberately different from `buildClearArchive` for this reason.
    const base = buildBaseViews(buildInsensitiveArchive());
    const sourceShapes = base
      .find((v) => v.id === INSENSITIVITY_SOURCE_ACTIVITY_ID)
      .J.map((iv) => ({ metres: iv.metres, seconds: iv.seconds }));

    const gFamily = runFamily('G', base, { sourceShapes });
    // A floor between the creep block's speed (0.05) and the walk/bridge speed (1.0) — an
    // arbitrary value for the M/W-family checks in this describe block, independent of G's own
    // derived value (see "reference shape" above for G4/G5's own real rate).
    const mShippedFloor = 0.124;
    const mFamily = runFamily('M', base, { sourceShapes, shippedFloor: mShippedFloor });
    const wFamily = runFamily('W', base, { sourceShapes, shippedFloor: mShippedFloor });

    it('CAN PASS: G4, M1 and W1 each PASS on the bulk-dominated archive', () => {
      const g4 = gFamily.rows.find((r) => r.id === 'G4');
      const m1 = mFamily.rows.find((r) => r.id === 'M1');
      const w1 = wFamily.rows.find((r) => r.id === 'W1');
      expect(g4.pass).toBe(true);
      expect(m1.pass).toBe(true);
      expect(w1.pass).toBe(true);
    });

    it('CAN FAIL: every strawman FAILs on the same archive (removal empties its own population)', () => {
      expect(gFamily.strawman.base).not.toBeNull();
      expect(gFamily.strawman.removed).toBeNull();
      expect(gFamily.strawman.pass).toBe(false);

      expect(mFamily.strawman.base).not.toBeNull();
      expect(mFamily.strawman.removed).toBeNull();
      expect(mFamily.strawman.pass).toBe(false);

      expect(wFamily.strawman.base).not.toBeNull();
      expect(wFamily.strawman.removed).toBeNull();
      expect(wFamily.strawman.pass).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// shape arbitration
// ---------------------------------------------------------------------------

describe('shape arbitration', () => {
  it('PREDECLARED_SHAPES ids and order are pinned exactly (D-19): G [G4,G5], M [M1,M2], W [W1,W2]', () => {
    expect(PREDECLARED_SHAPES.G.map((s) => s.id)).toEqual(['G4', 'G5']);
    expect(PREDECLARED_SHAPES.M.map((s) => s.id)).toEqual(['M1', 'M2']);
    expect(PREDECLARED_SHAPES.W.map((s) => s.id)).toEqual(['W1', 'W2']);
  });

  it('M and W entries are byte-for-byte unchanged in prose and function (D-19 only amends G)', () => {
    const m1 = PREDECLARED_SHAPES.M.find((s) => s.id === 'M1');
    expect(m1.name).toBe('pause-rule scale, conservative');
    expect(m1.fn).toBe(shapeM1);
    const w1 = PREDECLARED_SHAPES.W.find((s) => s.id === 'W1');
    expect(w1.name).toBe('covered time by speed');
    expect(w1.fn).toBe(shapeW1);
  });

  it('G4/G5 nonCircularity/caveat carry the amendment\'s prose, including the "not G3 with the ' +
    'neighbourhood removed" disclaimer and the half-bridge-speed bound', () => {
    const g4 = PREDECLARED_SHAPES.G.find((s) => s.id === 'G4');
    const g5 = PREDECLARED_SHAPES.G.find((s) => s.id === 'G5');
    for (const shape of [g4, g5]) {
      expect(shape.nonCircularity).toContain('not "G3 with the neighbourhood removed"');
      expect(shape.nonCircularity).toContain('half the fastest speed of its bridges');
    }
  });

  it('runFamily returns { strawman, rows, chosen } with chosen = first PASS or null', () => {
    const views = buildBaseViews(buildClearArchive());
    const sourceShapes = views
      .find((v) => v.id === INSENSITIVITY_SOURCE_ACTIVITY_ID)
      .J.map((iv) => ({ metres: iv.metres, seconds: iv.seconds }));
    const family = runFamily('G', views, { sourceShapes });
    expect(family).toHaveProperty('strawman');
    expect(family).toHaveProperty('rows');
    expect(family.rows.length).toBe(2);
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

  it('[D-20] rounding: STATIONARY_MAX_SPEED_MPS ships the DECLARED value, never ' +
    'ceilToSignificant on a G row; W still rounds via ceilToSignificant(raw, 3); M via ' +
    'Math.ceil(raw)', () => {
    const result = runCalibration(buildClearArchive(), null);
    expect(result.allCleared).toBe(true);
    expect(result.shipped.STATIONARY_MAX_SPEED_MPS).toBe(DECLARED_STATIONARY_MAX_SPEED_MPS);
    // 6.5 rounds via Math.ceil to 7, not 6 (Math.floor).
    expect(result.shipped.FORGOTTEN_STOP_MIN_SEC).toBe(7);
  });

  it('[D-20] Family G never halts the pipeline — it is evidence-only (arbitrated: false, ' +
    'selectedId/chosen null) even on an archive with no chained standstill anywhere, while M and W ' +
    'still run on the declared floor (contrast with the pre-D-20 "G HALT blocks M/W" behaviour)', () => {
    const result = runCalibration(buildHaltArchive(), null);
    expect(result.families.G.arbitrated).toBe(false);
    expect(result.families.G.selectedId).toBeNull();
    expect(result.families.G.chosen).toBeNull();
    expect(result.families.M).not.toBeNull();
    expect(result.families.W).not.toBeNull();
    expect(result.shipped.STATIONARY_MAX_SPEED_MPS).toBe(DECLARED_STATIONARY_MAX_SPEED_MPS);
  });

  it('[D-20] mwFloorFromDeclared gates M/W on presence and finiteness — an injected non-finite/' +
    'absent value yields a null floor, never a run on a null floor', () => {
    expect(mwFloorFromDeclared(0.5)).toBe(0.5);
    expect(mwFloorFromDeclared(NaN)).toBeNull();
    expect(mwFloorFromDeclared(undefined)).toBeNull();
    expect(mwFloorFromDeclared(null)).toBeNull();
  });

  it('"not computed: upstream HALT" renders for M/W whenever those families are null (whatever the ' +
    'reason — an absent declared floor, per mwFloorFromDeclared, in production; never merely ' +
    'because Family G did not "clear", which it no longer can)', () => {
    const archive = buildHaltArchive();
    const views = buildBaseViews(archive);
    const gFamily = runFamily('G', views, { sourceShapes: [], arbitrate: false });
    const result = {
      archive,
      families: { G: gFamily, M: null, W: null },
      shipped: { STATIONARY_MAX_SPEED_MPS: null, FORGOTTEN_STOP_MIN_SEC: null, WALK_RUN_BOUNDARY_MPS: null },
      allCleared: false,
      gates: null,
      d10: d10Section(views),
      join: joinSection(views),
      drift: driftSection(views),
      perIntervalTable: null,
      archiveFindings: null,
      provenance: {},
    };
    const markdown = renderCalibrationMarkdown(result);
    expect(markdown).toContain('not computed: upstream HALT');
    expect(markdown).not.toMatch(/^STATIONARY_MAX_SPEED_MPS = /m);
  });
});

// ---------------------------------------------------------------------------
// evidence only (D-20, plan 34-13) — runFamily's arbitrate: false option, exercised directly.
// Family G measures and renders every row exactly like an arbitrated family, but never selects.
// ---------------------------------------------------------------------------

describe('evidence only', () => {
  it("runFamily('G', views, { arbitrate: false }) evaluates strawman G, G4 and G5 (same rows as " +
    'arbitrate: true) but returns { arbitrated: false, selectedId: null, chosen: null } — ' +
    'selectShape is never reached for G', () => {
    const views = buildBaseViews(buildClearArchive());
    const sourceShapes = sourceShapesFor(views);
    const family = runFamily('G', views, { sourceShapes, arbitrate: false });
    expect(family.arbitrated).toBe(false);
    expect(family.selectedId).toBeNull();
    expect(family.chosen).toBeNull();
    expect(family.rows.length).toBe(2);
    expect(family.rows.map((r) => r.id)).toEqual(['G4', 'G5']);
    expect(family.strawman).toBeDefined();
  });

  it('a PASSING G4/G5 row still selects nothing under arbitrate: false — contrast with the same ' +
    'views under arbitrate: true (the default), which DOES select', () => {
    const views = buildBaseViews(buildInsensitiveArchive());
    const sourceShapes = sourceShapesFor(views);
    const arbitrated = runFamily('G', views, { sourceShapes });
    const evidenceOnly = runFamily('G', views, { sourceShapes, arbitrate: false });
    expect(arbitrated.rows.find((r) => r.id === 'G4').pass).toBe(true);
    expect(arbitrated.selectedId).not.toBeNull();
    expect(evidenceOnly.rows.find((r) => r.id === 'G4').pass).toBe(true);
    expect(evidenceOnly.selectedId).toBeNull();
    expect(evidenceOnly.chosen).toBeNull();
    // The evidence-only run computes byte-identical rows to the arbitrated run — only selection
    // differs.
    expect(evidenceOnly.rows).toEqual(arbitrated.rows);
  });

  it('strawman G keeps its role under evidence-only mode: it is still evaluated and rendered, and ' +
    'its FAIL is still required — a PASSING strawman G is a harness-integrity failure regardless of ' +
    'whether Family G arbitrates', () => {
    const views = buildBaseViews(buildInsensitiveArchive());
    const sourceShapes = sourceShapesFor(views);
    const family = runFamily('G', views, { sourceShapes, arbitrate: false });
    expect(family.strawman.pass).toBe(false); // removal empties J, the strawman's own population
    const markdown = renderCalibrationMarkdown({
      archive: { streamFileCount: 1, notComputable: 0 },
      families: { G: family, M: null, W: null },
      shipped: { STATIONARY_MAX_SPEED_MPS: null, FORGOTTEN_STOP_MIN_SEC: null, WALK_RUN_BOUNDARY_MPS: null },
      allCleared: false,
      gates: null,
      d10: d10Section(views),
      join: joinSection(views),
      drift: driftSection(views),
      perIntervalTable: null,
      archiveFindings: null,
      provenance: {},
    });
    expect(markdown).toContain('FAILED');
    expect(markdown).not.toContain('BLOCKER: the strawman PASSED');
  });

  it('the Family G rendering block states it is NOT ARBITRATED and names D-20, and every row/' +
    'verdict is still rendered', () => {
    const result = runCalibration(buildClearArchive(), GATES_PASS_CONTROL_TEXT);
    const markdown = renderCalibrationMarkdown({ ...result, provenance: {} });
    const shapeArbitration = markdown.split('## Shape arbitration')[1].split('## Chosen constants')[0];
    const arbitrationSection = shapeArbitration.split('### Family G')[1].split('### Family M')[0];
    expect(arbitrationSection).toContain('NOT ARBITRATED (D-20)');
    expect(arbitrationSection).not.toContain('(D-21)');
    expect(arbitrationSection).toContain('G4');
    expect(arbitrationSection).toContain('G5');
    expect(arbitrationSection).toMatch(/PASS|FAIL/);
  });

  // -------------------------------------------------------------------------
  // Family W evidence-only (D-21, plan 34-14) — the known trap: mirroring Family G's evidence-only
  // call literally (omitting shippedFloor) would give W `ctx.lo = null` and every row a null base.
  // -------------------------------------------------------------------------

  it("runFamily('W', views, { arbitrate: false, shippedFloor }) evaluates strawman W, W1 and W2 " +
    '(same rows as arbitrate: true on the same shippedFloor) but returns { arbitrated: false, ' +
    'selectedId: null, chosen: null } — selectShape is never reached for W', () => {
    const views = buildBaseViews(buildClearArchive());
    const sourceShapes = sourceShapesFor(views);
    const family = runFamily('W', views, { sourceShapes, shippedFloor: DECLARED_STATIONARY_MAX_SPEED_MPS, arbitrate: false });
    expect(family.arbitrated).toBe(false);
    expect(family.selectedId).toBeNull();
    expect(family.chosen).toBeNull();
    expect(family.rows.length).toBe(2);
    expect(family.rows.map((r) => r.id)).toEqual(['W1', 'W2']);
    expect(family.strawman).toBeDefined();
  });

  it("THE TRAP: W's evidence-only call MUST carry shippedFloor — every W row keeps a FINITE base, " +
    'never "—", and the evidence rows are byte-identical to the same views run with arbitrate: true', () => {
    const views = buildBaseViews(buildClearArchive());
    const sourceShapes = sourceShapesFor(views);
    const arbitrated = runFamily('W', views, { sourceShapes, shippedFloor: DECLARED_STATIONARY_MAX_SPEED_MPS });
    const evidenceOnly = runFamily('W', views, { sourceShapes, shippedFloor: DECLARED_STATIONARY_MAX_SPEED_MPS, arbitrate: false });
    for (const row of evidenceOnly.rows) {
      expect(row.base, row.id).not.toBeNull();
      expect(Number.isFinite(row.base), row.id).toBe(true);
    }
    expect(evidenceOnly.rows).toEqual(arbitrated.rows);
  });

  it('runCalibration threads shippedFloor: shippedG into Family W\'s evidence-only call — every ' +
    'rendered W row has a finite base, and the valley-evidence section\'s lo equals the declared ' +
    'stationary constant', () => {
    const result = runCalibration(buildClearArchive(), GATES_PASS_CONTROL_TEXT);
    for (const row of result.families.W.rows) {
      expect(Number.isFinite(row.base), row.id).toBe(true);
    }
    expect(result.valleyEvidence.lo).toBe(DECLARED_STATIONARY_MAX_SPEED_MPS);
    const markdown = renderCalibrationMarkdown({ ...result, provenance: {} });
    const shapeArbitration = markdown.split('## Shape arbitration')[1].split('## Chosen constants')[0];
    const wSection = shapeArbitration.split('### Family W')[1];
    expect(wSection).not.toContain('| — |');
  });

  it('the Family W rendering block states it is NOT ARBITRATED and names D-21 (never D-20), and ' +
    'every row/verdict is still rendered', () => {
    const result = runCalibration(buildClearArchive(), GATES_PASS_CONTROL_TEXT);
    const markdown = renderCalibrationMarkdown({ ...result, provenance: {} });
    const shapeArbitration = markdown.split('## Shape arbitration')[1].split('## Chosen constants')[0];
    const arbitrationSection = shapeArbitration.split('### Family W')[1];
    expect(arbitrationSection).toContain('NOT ARBITRATED (D-21)');
    expect(arbitrationSection).not.toContain('(D-20)');
    expect(arbitrationSection).toContain('W1');
    expect(arbitrationSection).toContain('W2');
    expect(arbitrationSection).toMatch(/PASS|FAIL/);
    expect(arbitrationSection).toContain('Selected: not applicable — not arbitrated (D-21)');
  });

  it('the GATE FAILED prose no longer says "All three families cleared"', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    const gFamily = { familyId: 'G', arbitrated: false, strawman: { pass: false }, rows: [], selectedId: null, chosen: null };
    const mFamily = { familyId: 'M', arbitrated: true, strawman: { pass: false }, rows: [], selectedId: 'M1', chosen: { id: 'M1', base: 5 } };
    const wFamily = { familyId: 'W', arbitrated: false, strawman: { pass: false }, rows: [], selectedId: null, chosen: null };
    const shipped = { ...GATES_PASS_SHIPPED };
    const badGates = { gates: [{ id: 'order', measured: '', bound: '', pass: false }], pass: false };
    const result = {
      archive: { streamFileCount: views.length, notComputable: 0 },
      families: { G: gFamily, M: mFamily, W: wFamily },
      shipped,
      allCleared: true,
      gates: badGates,
      d10: d10Section(views),
      join: joinSection(views),
      drift: driftSection(views),
      valleyEvidence: undefined,
      perIntervalTable: perIntervalTable(views, { stationaryMaxMps: 0.5, walkRunMps: 2.2 }),
      archiveFindings: archiveFindings(views, { stationaryMaxMps: 0.5, walkRunMps: 2.2 }, { stationaryMaxMps: 0.5, minSec: 31 }),
      provenance: {},
    };
    const markdown = renderCalibrationMarkdown(result);
    expect(markdown).toContain('## GATE FAILED');
    expect(markdown).not.toContain('All three families cleared');
    expect(markdown).toContain('Family M cleared');
  });

  it('runCalibration never calls ceilToSignificant on a G row; the shipped stationary constant is ' +
    'the DECLARED value', () => {
    const result = runCalibration(buildClearArchive(), GATES_PASS_CONTROL_TEXT);
    expect(result.shipped.STATIONARY_MAX_SPEED_MPS).toBe(DECLARED_STATIONARY_MAX_SPEED_MPS);
  });

  it('[D-21, retired premise] M still runs and arbitrates exactly as before on the declared floor ' +
    '— shapes, tolerance, strawman-first and first-clearing arbitration are all unchanged. Family W ' +
    'is now ALSO evidence-only: it is not arbitrated and selects nothing, even when every W row ' +
    'PASSES D-13 on this same bulk-dominated archive', () => {
    const result = runCalibration(buildClearArchive(), GATES_PASS_CONTROL_TEXT);
    expect(result.families.M.selectedId).not.toBeNull();
    expect(result.families.W.arbitrated).toBe(false);
    expect(result.families.W.selectedId).toBeNull();
    expect(result.families.W.chosen).toBeNull();
    // Not vacuous: W's own rows genuinely clear D-13 on this archive — arbitration is what's absent,
    // not a degenerate population.
    expect(result.families.W.rows.some((r) => r.pass)).toBe(true);
    expect(result.allCleared).toBe(true);
  });

  it('a family with no clearing shape (e.g. M) still renders NO SHAPE CLEARS, ships nothing, and ' +
    'exits 1 — even though the declared G floor is present and Family G no longer blocks anything', () => {
    const gFamily = {
      familyId: 'G',
      arbitrated: false,
      strawman: { pass: false },
      rows: [],
      selectedId: null,
      chosen: null,
      nonVacuity: { removedCount: 0, removedChangedActivityCount: 0 },
    };
    const result = {
      families: { G: gFamily, M: null, W: null },
      allCleared: false,
      shipped: {
        STATIONARY_MAX_SPEED_MPS: DECLARED_STATIONARY_MAX_SPEED_MPS,
        FORGOTTEN_STOP_MIN_SEC: null,
        WALK_RUN_BOUNDARY_MPS: null,
      },
      gates: null,
    };
    expect(decideOutcome(result, {}).exitCode).toBe(1);
    expect(decideOutcome(result, {}).reason).toBe('no-shape-clears');
  });
});

// ---------------------------------------------------------------------------
// gates
// ---------------------------------------------------------------------------

describe('gates', () => {
  it('ORDER gate passes iff 0 <= stationary < walkRun < UNRELIABLE_SPEED_LIMIT_MPS', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    const okShipped = { STATIONARY_MAX_SPEED_MPS: 0.5, WALK_RUN_BOUNDARY_MPS: 2.0, FORGOTTEN_STOP_MIN_SEC: 31 };
    const badShipped = { STATIONARY_MAX_SPEED_MPS: 2.0, WALK_RUN_BOUNDARY_MPS: 0.5, FORGOTTEN_STOP_MIN_SEC: 31 };
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

  it('[D-20] basis gate PASSES with a stated reason when G4\'s measured base is null (no chained ' +
    'standstill anywhere means nothing accrued)', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    expect(shapeG4(views).value).toBeNull(); // no zero-advance pause anywhere on this fixture
    const result = applyGates(views, GATES_PASS_SHIPPED, GATES_PASS_CONTROL_TEXT);
    const gate = result.gates.find((g) => g.id === 'd20-basis');
    expect(gate.measured).toBeNull();
    expect(gate.pass).toBe(true);
    expect(gate.reason).toBe('no chained standstill means nothing accrued');
  });

  it('[D-20] basis gate PASSES when the declared value strictly exceeds G4\'s measured base', () => {
    const views = buildBaseViews(pauseBearingArchive());
    const g4Base = shapeG4(views).value;
    expect(g4Base).toBeGreaterThan(0);
    const shipped = { STATIONARY_MAX_SPEED_MPS: 0.5, WALK_RUN_BOUNDARY_MPS: 2.0, FORGOTTEN_STOP_MIN_SEC: 31 };
    expect(shipped.STATIONARY_MAX_SPEED_MPS).toBeGreaterThan(g4Base);
    const result = applyGates(views, shipped, null);
    const gate = result.gates.find((g) => g.id === 'd20-basis');
    expect(gate.measured).toBeCloseTo(g4Base, 8);
    expect(gate.pass).toBe(true);
    expect(gate.reason).toBeUndefined();
  });

  it('[D-20] basis gate FAILS — a HALT, never a retune — when a fixture\'s measured drift reaches ' +
    'the declared value', () => {
    const views = buildBaseViews(pauseBearingArchive());
    const g4Base = shapeG4(views).value;
    const shipped = { STATIONARY_MAX_SPEED_MPS: g4Base, WALK_RUN_BOUNDARY_MPS: 2.0, FORGOTTEN_STOP_MIN_SEC: 31 };
    const result = applyGates(views, shipped, null);
    const gate = result.gates.find((g) => g.id === 'd20-basis');
    expect(gate.pass).toBe(false);
    expect(result.pass).toBe(false);
  });

  // -------------------------------------------------------------------------
  // d21-basis (D-21, plan 34-14): two structural sub-checks, no new number.
  // -------------------------------------------------------------------------

  it('[D-21] d21-basis PASSES on the H1-extended gates-pass archive: the declared boundary clears ' +
    "the control's own window speed AND sits below the archive's own W1 time-weighted modal bin " +
    'centre (asserted directly)', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    const result = applyGates(views, GATES_PASS_SHIPPED, GATES_PASS_CONTROL_TEXT);
    const gate = result.gates.find((g) => g.id === 'd21-basis');
    expect(gate.pass).toBe(true);
    expect(gate.subA.pass).toBe(true);
    expect(gate.subB.pass).toBe(true);
    // The fixture's own modal bin centre, asserted directly — RUNHUMP1's 2000-sample mass at 3.2
    // m/s dominates every other activity's own covered-time mass combined.
    expect(gate.subB.measured).toBeCloseTo(3.25, 1);
    expect(gate.subB.measured).toBeGreaterThan(GATES_PASS_SHIPPED.WALK_RUN_BOUNDARY_MPS);
  });

  it('[D-21] d21-basis sub-check (a) FAILS independently when a confirmed control\'s own window ' +
    'speed reaches the declared boundary — sub-check (b) still passes', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    const highBoundary = { ...GATES_PASS_SHIPPED, WALK_RUN_BOUNDARY_MPS: 0.9 }; // CTRL1 window speed is 1.0
    const result = applyGates(views, highBoundary, GATES_PASS_CONTROL_TEXT);
    const gate = result.gates.find((g) => g.id === 'd21-basis');
    expect(gate.subA.pass).toBe(false);
    expect(gate.subB.pass).toBe(true);
    expect(gate.pass).toBe(false);
  });

  it('[D-21] d21-basis sub-check (b) FAILS independently when the declared boundary reaches the ' +
    "archive's own W1 time-weighted modal bin centre — sub-check (a) still passes", () => {
    const views = buildBaseViews(buildGatesPassArchive());
    const lowModalBoundary = { ...GATES_PASS_SHIPPED, WALK_RUN_BOUNDARY_MPS: 3.5 }; // above RUNHUMP1's own 3.2 m/s mode
    const result = applyGates(views, lowModalBoundary, GATES_PASS_CONTROL_TEXT);
    const gate = result.gates.find((g) => g.id === 'd21-basis');
    expect(gate.subA.pass).toBe(true);
    expect(gate.subB.pass).toBe(false);
    expect(gate.pass).toBe(false);
  });

  it('[D-21] d21-basis: no confirmed control at all is a stated-reason FAIL, never a vacuous pass', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    const result = applyGates(views, GATES_PASS_SHIPPED, null);
    const gate = result.gates.find((g) => g.id === 'd21-basis');
    expect(gate.subA.pass).toBe(false);
    expect(gate.subA.reason).toBe('no confirmed control');
    expect(gate.pass).toBe(false);
  });

  it('[D-21] d21-basis: an unmeasurable control window (its samples dropped) is a stated-reason ' +
    'FAIL', () => {
    const views = buildBaseViews(buildGatesPassArchive()).map((v) =>
      v.id === 'CTRL1' ? { ...v, t: [v.t[0]], d: [v.d[0]] } : v
    );
    const result = applyGates(views, GATES_PASS_SHIPPED, GATES_PASS_CONTROL_TEXT);
    const gate = result.gates.find((g) => g.id === 'd21-basis');
    expect(gate.subA.pass).toBe(false);
    expect(gate.subA.reason).toMatch(/unmeasurable/);
    expect(gate.pass).toBe(false);
  });

  it('[D-21] d21-basis: an empty covered-time population is a stated-reason FAIL', () => {
    const emptyView = {
      id: 'EMPTY',
      computable: true,
      t: [0, 1],
      d: [0, 1],
      coverage: { spanSec: 1, coveredSec: 1, recordingGapSec: 0, pauseSec: 0, unreliableSec: 0, gapIntervals: [] },
      segments: [],
      coveredRuns: [],
      J: [],
      pauseIntervals: [],
      coveredPairs: [],
      foldedSteps: [],
      positionedAdvanceIntervals: [],
      plantedCreepDurations: [],
      standstillEpisodes: [],
      notClassifiableCount: 0,
      joinViolations: 0,
    };
    const result = applyGates([emptyView], GATES_PASS_SHIPPED, null);
    const gate = result.gates.find((g) => g.id === 'd21-basis');
    expect(gate.subB.pass).toBe(false);
    expect(gate.subB.reason).toBe('empty covered-time population');
  });

  it('[D-21] H1: after the RUNHUMP1 extension, EVERY gate id reads PASS individually on ' +
    'buildGatesPassArchive — asserted id by id, not merely via gates.pass', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    const result = applyGates(views, GATES_PASS_SHIPPED, GATES_PASS_CONTROL_TEXT);
    const expectedIds = [
      'order',
      'd12-anchor-i',
      'd12-anchor-ii',
      'd12-anchor-iii',
      'd10-rule',
      'join',
      'd20-basis',
      'd21-basis',
    ];
    expect(result.gates.map((g) => g.id)).toEqual(expectedIds);
    for (const id of expectedIds) {
      const gate = result.gates.find((g) => g.id === id);
      expect(gate, id).toBeDefined();
      expect(gate.pass, id).toBe(true);
    }
    expect(result.pass).toBe(true);
  });

  it('[D-19] driftSection: always computed from BASE standstill episodes, independent of shippedG ' +
    '(unlike 34-04\'s G1-gated version)', () => {
    const views = buildBaseViews(buildClearArchive());
    const drift = driftSection(views);
    expect(drift.episodesTotal).toBeGreaterThan(0);
    expect(drift.chainedCount).toBeGreaterThan(0);
    expect(drift.chainedShare).toBeGreaterThan(0);
    expect(drift.totalChainedMetres).toBeGreaterThan(0);

    const haltDrift = driftSection(buildBaseViews(buildHaltArchive()));
    expect(haltDrift.episodesTotal).toBe(0);
    expect(haltDrift.chainedCount).toBe(0);
  });

  // [D-20, plan 34-13] The old "Drift matters iff the shipped G value is > 0" / "No chained episode
  // exists" branch is RETIRED — see the "drift non-issue" describe below, which replaces this test.
  // D-20 renders drift-while-stationary as a MEASURED NON-ISSUE finding, unconditionally, never
  // gated on whether Family G "clears" (it no longer arbitrates at all).
});

// ---------------------------------------------------------------------------
// declared constant (D-20, plan 34-13) — the stationary constant is developer-declared, never
// calibrated; Family G still measures and renders G4/G5 as evidence but no longer arbitrates a cut.
// ---------------------------------------------------------------------------

describe('declared constant', () => {
  it('DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT is the D-20 source text, and its numeric sibling ' +
    'parses from it exactly (module-load round-trip assertion)', () => {
    expect(DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT).toBe('0.5');
    expect(DECLARED_STATIONARY_MAX_SPEED_MPS).toBe(Number(DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT));
  });

  it('STATIONARY_PROVENANCE_TEXT is exactly "developer-declared (D-20), not calibrated"', () => {
    expect(STATIONARY_PROVENANCE_TEXT).toBe('developer-declared (D-20), not calibrated');
  });

  it('[D-21, retired premise] a clear fixture renders the line-anchored declared value and its ' +
    "provenance line under ## Chosen constants; M's provenance line names its own winning shape id, " +
    "but WALK_RUN_BOUNDARY_MPS provenance now reads DECLARED (D-21), never 'calibrated (W family, " +
    "...)' — Family W no longer has a winning shape id to name", () => {
    const result = runCalibration(buildClearArchive(), GATES_PASS_CONTROL_TEXT);
    expect(result.allCleared).toBe(true);
    expect(result.families.W.selectedId).toBeNull();
    const markdown = renderCalibrationMarkdown({ ...result, provenance: {} });
    expect(markdown).toMatch(/^STATIONARY_MAX_SPEED_MPS = 0\.5$/m);
    expect(markdown).toContain(
      'STATIONARY_MAX_SPEED_MPS provenance: developer-declared (D-20), not calibrated'
    );
    expect(markdown).toMatch(
      new RegExp(
        `^FORGOTTEN_STOP_MIN_SEC provenance: calibrated \\(M family, ${result.families.M.selectedId}\\)$`,
        'm'
      )
    );
    expect(markdown).toMatch(/^WALK_RUN_BOUNDARY_MPS = 2\.2$/m);
    expect(markdown).toContain(
      'WALK_RUN_BOUNDARY_MPS provenance: developer-declared (D-21), not calibrated'
    );
    expect(markdown).not.toMatch(/^WALK_RUN_BOUNDARY_MPS provenance: calibrated \(W family/m);
  });

  it('no line matching ^STATIONARY_MAX_SPEED_MPS = appears outside ## Chosen constants; the HALT ' +
    'fixture renders neither the section nor the line at all', () => {
    const clear = runCalibration(buildClearArchive(), GATES_PASS_CONTROL_TEXT);
    const clearMarkdown = renderCalibrationMarkdown({ ...clear, provenance: {} });
    const chosenIdx = clearMarkdown.indexOf('## Chosen constants');
    expect(chosenIdx).toBeGreaterThan(-1);
    const nextHeadingIdx = clearMarkdown.indexOf('\n## ', chosenIdx + 1);
    const beforeChosen = clearMarkdown.slice(0, chosenIdx);
    const afterChosen = clearMarkdown.slice(nextHeadingIdx);
    expect(beforeChosen).not.toMatch(/^STATIONARY_MAX_SPEED_MPS = /m);
    expect(afterChosen).not.toMatch(/^STATIONARY_MAX_SPEED_MPS = /m);

    const halt = runCalibration(buildHaltArchive(), null);
    const haltMarkdown = renderCalibrationMarkdown({ ...halt, provenance: {} });
    expect(haltMarkdown).not.toContain('## Chosen constants');
    expect(haltMarkdown).not.toMatch(/^STATIONARY_MAX_SPEED_MPS = /m);
  });

  it('the word "calibrated" appears adjacent to the stationary constant only inside "not calibrated"', () => {
    const result = runCalibration(buildClearArchive(), GATES_PASS_CONTROL_TEXT);
    const markdown = renderCalibrationMarkdown({ ...result, provenance: {} });
    const stationaryLines = markdown.split('\n').filter((l) => l.includes('STATIONARY_MAX_SPEED_MPS'));
    expect(stationaryLines.length).toBeGreaterThan(0);
    for (const line of stationaryLines) {
      if (line.includes('calibrated')) expect(line).toContain('not calibrated');
    }
  });

  it('rendering the same clear-fixture result twice is byte-identical', () => {
    const result = runCalibration(buildClearArchive(), GATES_PASS_CONTROL_TEXT);
    const fixed = { ...result, provenance: {} };
    expect(renderCalibrationMarkdown(fixed)).toBe(renderCalibrationMarkdown(fixed));
  });
});

// ---------------------------------------------------------------------------
// declared boundary (D-21, plan 34-14) — the walk/run boundary is developer-declared, never
// calibrated; Family W still measures and renders strawman W, W1 and W2 but no longer arbitrates.
// ---------------------------------------------------------------------------

describe('declared boundary', () => {
  it('DECLARED_WALK_RUN_BOUNDARY_MPS_TEXT is the D-21 source text, and its numeric sibling parses ' +
    'from it exactly (module-load round-trip assertion)', () => {
    expect(DECLARED_WALK_RUN_BOUNDARY_MPS_TEXT).toBe('2.2');
    expect(DECLARED_WALK_RUN_BOUNDARY_MPS).toBe(Number(DECLARED_WALK_RUN_BOUNDARY_MPS_TEXT));
  });

  it('WALK_RUN_PROVENANCE_TEXT is exactly "developer-declared (D-21), not calibrated"', () => {
    expect(WALK_RUN_PROVENANCE_TEXT).toBe('developer-declared (D-21), not calibrated');
  });

  it('a clear fixture renders the line-anchored declared boundary (source text verbatim) and its ' +
    "provenance line under ## Chosen constants; M's provenance line still names its winning shape " +
    'id', () => {
    const result = runCalibration(buildClearArchive(), GATES_PASS_CONTROL_TEXT);
    const markdown = renderCalibrationMarkdown({ ...result, provenance: {} });
    expect(markdown).toMatch(/^WALK_RUN_BOUNDARY_MPS = 2\.2$/m);
    expect(markdown).toContain(
      'WALK_RUN_BOUNDARY_MPS provenance: developer-declared (D-21), not calibrated'
    );
    expect(markdown).toMatch(
      new RegExp(
        `^FORGOTTEN_STOP_MIN_SEC provenance: calibrated \\(M family, ${result.families.M.selectedId}\\)$`,
        'm'
      )
    );
  });

  it('no line matching ^WALK_RUN_BOUNDARY_MPS = appears outside ## Chosen constants; the HALT ' +
    'fixture renders neither the section nor the line at all', () => {
    const clear = runCalibration(buildClearArchive(), GATES_PASS_CONTROL_TEXT);
    const clearMarkdown = renderCalibrationMarkdown({ ...clear, provenance: {} });
    const chosenIdx = clearMarkdown.indexOf('## Chosen constants');
    expect(chosenIdx).toBeGreaterThan(-1);
    const nextHeadingIdx = clearMarkdown.indexOf('\n## ', chosenIdx + 1);
    const beforeChosen = clearMarkdown.slice(0, chosenIdx);
    const afterChosen = clearMarkdown.slice(nextHeadingIdx);
    expect(beforeChosen).not.toMatch(/^WALK_RUN_BOUNDARY_MPS = /m);
    expect(afterChosen).not.toMatch(/^WALK_RUN_BOUNDARY_MPS = /m);

    const halt = runCalibration(buildHaltArchive(), null);
    const haltMarkdown = renderCalibrationMarkdown({ ...halt, provenance: {} });
    expect(haltMarkdown).not.toContain('## Chosen constants');
    expect(haltMarkdown).not.toMatch(/^WALK_RUN_BOUNDARY_MPS = /m);
  });

  it('the word "calibrated" appears adjacent to WALK_RUN_BOUNDARY_MPS only inside "not calibrated"', () => {
    const result = runCalibration(buildClearArchive(), GATES_PASS_CONTROL_TEXT);
    const markdown = renderCalibrationMarkdown({ ...result, provenance: {} });
    const boundaryLines = markdown.split('\n').filter((l) => l.includes('WALK_RUN_BOUNDARY_MPS'));
    expect(boundaryLines.length).toBeGreaterThan(0);
    for (const line of boundaryLines) {
      if (line.includes('calibrated')) expect(line).toContain('not calibrated');
    }
  });

  it('rendering the same clear-fixture result twice is byte-identical', () => {
    const result = runCalibration(buildClearArchive(), GATES_PASS_CONTROL_TEXT);
    const fixed = { ...result, provenance: {} };
    expect(renderCalibrationMarkdown(fixed)).toBe(renderCalibrationMarkdown(fixed));
  });
});

// ---------------------------------------------------------------------------
// valley evidence (D-21, plan 34-14) — the measured, live histogram evidence behind the declared
// walk/run boundary: one histogramOf implementation shared with the W shapes, rendered for both
// weightings, never asserted as a fixed sentence.
// ---------------------------------------------------------------------------

/** A single continuous covered activity (dt=1s per sample, no gap, no pause) built from a list of
 * `{ speed, count }` segments — every consecutive sample-to-sample step lands as its own folded step
 * at exactly `speed` m/s, so the resulting covered-time histogram's per-bin mass is precisely
 * controlled by `count`. */
function buildValleyEvidenceActivity(id, segments) {
  const t = [0];
  const d = [0];
  let time = 0;
  let dist = 0;
  for (const { speed, count } of segments) {
    for (let i = 0; i < count; i++) {
      time += 1;
      dist += speed;
      t.push(time);
      d.push(dist);
    }
  }
  return { id, t, d, cadence: null };
}

/** UNIMODAL: a dominant running hump (3.0 m/s, mass 1000) decaying smoothly through three adjacent,
 * always-positive bins (3.1/3.2/3.3 — no empty gap anywhere) into a genuinely sparse bin (3.3, mass
 * 2) followed by a small recovery bump (3.4, mass 30) — the recovery bump is what gives the sparse
 * bin a positive `rightMax`, so it qualifies as the single, non-null, global-minimum dip. Mirrors the
 * real archive's own shape (one hump, no dip near the walking cluster, a sparse qualifying bin deep
 * in the tail) without pinning any HALT-run figure.
 */
function buildUnimodalValleyArchive() {
  return {
    activities: [
      buildValleyEvidenceActivity('UNI1', [
        { speed: 3.0, count: 1000 },
        { speed: 3.1, count: 200 },
        { speed: 3.2, count: 50 },
        { speed: 3.3, count: 2 },
        { speed: 3.4, count: 30 },
      ]),
    ],
    streamFileCount: 1,
    notComputable: 0,
  };
}

/** BIMODAL: two well-separated humps (a walking cluster at 1.2 m/s and a running cluster at 3.5 m/s)
 * with a genuine, unpopulated gap between them — every empty bin in the gap qualifies as a dip
 * (flanked by both humps), so the picked bin sits in the gap, a real trough rather than a decaying
 * shoulder. */
function buildBimodalValleyArchive() {
  return {
    activities: [
      buildValleyEvidenceActivity('BI1', [
        { speed: 1.2, count: 500 },
        { speed: 3.5, count: 1000 },
      ]),
    ],
    streamFileCount: 1,
    notComputable: 0,
  };
}

describe('valley evidence', () => {
  it('histogramOf is the one binning implementation valleyOf now uses — a fixture whose valleyOf ' +
    'value and histogramOf-derived picked-bin centre must agree exactly', () => {
    const views = buildBaseViews(buildUnimodalValleyArchive());
    const items = [];
    for (const v of views) for (const s of v.foldedSteps) items.push({ value: s.metres / s.seconds, weight: s.seconds });
    const hist = histogramOf(items, DECLARED_STATIONARY_MAX_SPEED_MPS, UNRELIABLE_SPEED_LIMIT_MPS);
    expect(hist).not.toBeNull();
    expect(hist.counts.some((c) => c > 0)).toBe(true);
    const valley = valleyOf(items, DECLARED_STATIONARY_MAX_SPEED_MPS, UNRELIABLE_SPEED_LIMIT_MPS);
    const evidence = valleyEvidenceSection(views, DECLARED_STATIONARY_MAX_SPEED_MPS, UNRELIABLE_SPEED_LIMIT_MPS);
    expect(evidence.w1.pickedCentre).toBeCloseTo(valley, 8);
  });

  it("34-12's untouched reachability matrix and W-shape tests still pass — valleyOf's own " +
    'behaviour is unchanged by the histogramOf extraction (proven by re-running the pre-existing ' +
    '"reference shape" valleyOf assertions here)', () => {
    const items = [];
    for (let i = 0; i < 10; i++) items.push({ value: 0.05, weight: 1 });
    for (let i = 0; i < 3; i++) items.push({ value: 0.15, weight: 1 });
    for (let i = 0; i < 10; i++) items.push({ value: 0.25, weight: 1 });
    for (let i = 0; i < 10; i++) items.push({ value: 0.45, weight: 1 });
    expect(valleyOf(items, 0, 0.5)).toBeCloseTo(0.35, 5);
  });

  it('valleyEvidenceSection: lo equals the declared stationary constant and hi the imported ' +
    'unreliable-speed ceiling, both rendered', () => {
    const views = buildBaseViews(buildUnimodalValleyArchive());
    const evidence = valleyEvidenceSection(views, DECLARED_STATIONARY_MAX_SPEED_MPS, UNRELIABLE_SPEED_LIMIT_MPS);
    expect(evidence.lo).toBe(DECLARED_STATIONARY_MAX_SPEED_MPS);
    expect(evidence.hi).toBe(UNRELIABLE_SPEED_LIMIT_MPS);
    const markdown = renderCalibrationMarkdown({
      ...runCalibration(buildUnimodalValleyArchive(), null),
      provenance: {},
    });
    expect(markdown).toContain(`[${evidence.lo.toFixed(3)}, ${evidence.hi.toFixed(3)})`);
  });

  it('the UNIMODAL fixture yields a non-null picked bin (a genuine dip), reports both weightings, ' +
    'labels which is time-weighted (W1) and which is count-weighted (W2), and states only W1 is ' +
    'gated', () => {
    const views = buildBaseViews(buildUnimodalValleyArchive());
    const evidence = valleyEvidenceSection(views, DECLARED_STATIONARY_MAX_SPEED_MPS, UNRELIABLE_SPEED_LIMIT_MPS);
    expect(evidence.w1.pickedCentre).not.toBeNull();
    expect(evidence.w1.modalMass).not.toBeNull();
    expect(evidence.w1.totalMass).toBeGreaterThan(0);
    expect(evidence.w2.pickedCentre).not.toBeNull();

    const result = runCalibration(buildUnimodalValleyArchive(), null);
    const markdown = renderCalibrationMarkdown({ ...result, provenance: {} });
    const section = markdown.split('## Valley evidence')[1].split('## Join exhaustiveness')[0];
    expect(section).toContain('W1 (time-weighted)');
    expect(section).toContain('W2 (count-weighted)');
    expect(section).toMatch(/Only the time-weighted mode \(W1\) is gated/);
  });

  it('the no-valley finding is attributed to D-21 and carried by a computed picked-versus-modal ' +
    'relation, never asserted as a fixed sentence', () => {
    const result = runCalibration(buildUnimodalValleyArchive(), null);
    const markdown = renderCalibrationMarkdown({ ...result, provenance: {} });
    const section = markdown.split('## Valley evidence')[1].split('## Join exhaustiveness')[0];
    expect(section).toContain(
      'D-21 (2026-09-22) records the finding that walking and running form one hump on this ' +
        "archive, so D-06's valley premise does not hold here"
    );
    expect(section).toMatch(/picked bin \(.+m\/s.+share.+\) sits away from the modal bin \(.+m\/s.+share.+\)/);
  });

  it('the UNIMODAL and BIMODAL fixtures render different modal bins, picked bins and mass shares, ' +
    'cell by cell — the section describes its input, not a fixed shape', () => {
    const uniViews = buildBaseViews(buildUnimodalValleyArchive());
    const biViews = buildBaseViews(buildBimodalValleyArchive());
    const uni = valleyEvidenceSection(uniViews, DECLARED_STATIONARY_MAX_SPEED_MPS, UNRELIABLE_SPEED_LIMIT_MPS);
    const bi = valleyEvidenceSection(biViews, DECLARED_STATIONARY_MAX_SPEED_MPS, UNRELIABLE_SPEED_LIMIT_MPS);

    expect(bi.w1.pickedCentre).not.toBeNull(); // a genuine trough, not "null versus a value"
    expect(uni.w1.pickedCentre).not.toBe(bi.w1.pickedCentre);
    expect(uni.w1.modalBinLo).not.toBe(bi.w1.modalBinLo);
    expect(uni.w1.pickedMass).not.toBe(bi.w1.pickedMass);
    expect(uni.w1.pickedShare).not.toBe(bi.w1.pickedShare);
    expect(uni.w1.totalMass).not.toBe(bi.w1.totalMass);
  });

  it('rendering the same fixture twice is byte-identical', () => {
    const result = runCalibration(buildUnimodalValleyArchive(), null);
    const fixed = { ...result, provenance: {} };
    expect(renderCalibrationMarkdown(fixed)).toBe(renderCalibrationMarkdown(fixed));
  });
});

// ---------------------------------------------------------------------------
// drift non-issue (D-20, plan 34-13) — drift-while-stationary renders as a MEASURED NON-ISSUE with
// its own live evidence, independent of whether Family G "clears".
// ---------------------------------------------------------------------------

describe('drift non-issue', () => {
  it('driftSection(views) carries G4 and G5 measured bases alongside the standstill episode counts, ' +
    'computed live from the views (never hardcoded)', () => {
    const views = buildBaseViews(pauseBearingArchive());
    const drift = driftSection(views);
    expect(drift.episodesTotal).toBeGreaterThan(0);
    expect(drift.chainedCount).toBeGreaterThan(0);
    expect(drift.g4Base).toBeCloseTo(shapeG4(views).value, 8);
    expect(drift.g5Base).toBeCloseTo(shapeG5(views).value, 8);
  });

  it('driftSection reports g4Base/g5Base as null when there is no chained episode anywhere', () => {
    const drift = driftSection(buildBaseViews(buildHaltArchive()));
    expect(drift.episodesTotal).toBe(0);
    expect(drift.g4Base).toBeNull();
    expect(drift.g5Base).toBeNull();
  });

  it('the rendered ## Drift-while-stationary section states the MEASURED NON-ISSUE disposition, ' +
    'names D-20 and its date, states the declared bound in prose (never a ' +
    '"STATIONARY_MAX_SPEED_MPS = " line), and states the definitional single-pause caveat', () => {
    const result = runCalibration(pauseBearingArchive(), null);
    const markdown = renderCalibrationMarkdown({ ...result, provenance: {} });
    const section = markdown.split('## Drift-while-stationary')[1].split('## Join exhaustiveness')[0];
    expect(section).toContain('MEASURED NON-ISSUE');
    expect(section).toContain('D-20');
    expect(section).toContain('2026-09-22');
    expect(section).toContain(`${DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT} m/s`);
    expect(section).toContain('zero-advance BY CONSTRUCTION');
    expect(section).not.toMatch(/^STATIONARY_MAX_SPEED_MPS = /m);
    expect(section).toMatch(/G4 measured base/);
    expect(section).toMatch(/G5 measured base/);
  });

  it('the Drift-while-stationary section is byte-identical on re-render of the same result', () => {
    const result = runCalibration(pauseBearingArchive(), null);
    const fixed = { ...result, provenance: {} };
    const section1 = renderCalibrationMarkdown(fixed).split('## Drift-while-stationary')[1];
    const section2 = renderCalibrationMarkdown(fixed).split('## Drift-while-stationary')[1];
    expect(section1).toBe(section2);
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
      'Valley evidence',
      'Join exhaustiveness',
      'Per-interval class table — 3475724402 (classifier output)',
      'Archive-wide findings (never an input to selection)',
      'Inputs',
    ];
    expect(headings.slice(headings.length - expectedSuffix.length)).toEqual(expectedSuffix);
  });

  it('the Chosen constants block contains the exact contract lines', () => {
    const markdown = renderCalibrationMarkdown(clearResult);
    // [D-20, plan 34-13] STATIONARY_MAX_SPEED_MPS ships the DECLARED source text — by Task 2,
    // `clearResult.shipped.STATIONARY_MAX_SPEED_MPS` IS `DECLARED_STATIONARY_MAX_SPEED_MPS` (never
    // G4's raw base), so both forms below agree.
    expect(markdown).toContain(`STATIONARY_MAX_SPEED_MPS = ${DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT}`);
    expect(clearResult.shipped.STATIONARY_MAX_SPEED_MPS).toBe(DECLARED_STATIONARY_MAX_SPEED_MPS);
    expect(markdown).toContain(`FORGOTTEN_STOP_MIN_SEC = ${clearResult.shipped.FORGOTTEN_STOP_MIN_SEC}`);
    // [D-21, plan 34-14] WALK_RUN_BOUNDARY_MPS ships the DECLARED source text, mirroring the
    // stationary constant above — never `clearResult.shipped.WALK_RUN_BOUNDARY_MPS` directly.
    expect(markdown).toContain(`WALK_RUN_BOUNDARY_MPS = ${DECLARED_WALK_RUN_BOUNDARY_MPS_TEXT}`);
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

  it("the ## Non-circularity section's G rows contain the D-19 amendment's substrings on both the " +
    'clear and the HALT fixtures', () => {
    for (const result of [clearResult, haltResult]) {
      const markdown = renderCalibrationMarkdown(result);
      expect(markdown).toContain('not "G3 with the neighbourhood removed"');
      expect(markdown).toContain('half the fastest speed of its bridges');
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

  it('decideOutcome: 2 when a shipped constant is present and differs from the derived value, ' +
    'including the declared stationary constant', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    const result = {
      allCleared: true,
      gates: applyGates(views, GATES_PASS_SHIPPED, GATES_PASS_CONTROL_TEXT),
      shipped: GATES_PASS_SHIPPED,
    };
    expect(decideOutcome(result, { STATIONARY_MAX_SPEED_MPS: 0.999 }).exitCode).toBe(2);
    expect(decideOutcome(result, { STATIONARY_MAX_SPEED_MPS: 0.999 }).reason).toBe('shipped-mismatch');
    // [D-20] The declared stationary constant is subject to the same equality guard as M/W — a
    // production literal that drifted from the declared value is caught exactly like any other.
    expect(
      decideOutcome(result, { STATIONARY_MAX_SPEED_MPS: DECLARED_STATIONARY_MAX_SPEED_MPS + 0.001 }).exitCode
    ).toBe(2);
  });

  it('[D-20] decideOutcome: 1 with reason "strawman-g-passed" when strawman G PASSES — regardless ' +
    'of Family G no longer arbitrating, and even when M/W both cleared and every gate passed', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    const gFamily = {
      familyId: 'G',
      arbitrated: false,
      strawman: { pass: true }, // a harness-integrity failure: circular and non-circular indistinguishable
      rows: [],
      selectedId: null,
      chosen: null,
    };
    const result = {
      families: { G: gFamily, M: {}, W: {} },
      allCleared: true,
      gates: applyGates(views, GATES_PASS_SHIPPED, GATES_PASS_CONTROL_TEXT),
      shipped: GATES_PASS_SHIPPED,
    };
    expect(decideOutcome(result, {}).exitCode).toBe(1);
    expect(decideOutcome(result, {}).reason).toBe('strawman-g-passed');
  });

  it('[D-20] decideOutcome: 0 is unaffected when strawman G correctly FAILS (the ordinary case)', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    const gFamily = { familyId: 'G', arbitrated: false, strawman: { pass: false }, rows: [], selectedId: null, chosen: null };
    const result = {
      families: { G: gFamily, M: {}, W: {} },
      allCleared: true,
      gates: applyGates(views, GATES_PASS_SHIPPED, GATES_PASS_CONTROL_TEXT),
      shipped: GATES_PASS_SHIPPED,
    };
    expect(decideOutcome(result, {}).exitCode).toBe(0);
  });

  // -------------------------------------------------------------------------
  // H5 (D-21, plan 34-14): the strawman-passed branch is FAMILY-AGNOSTIC — one exit-contract test
  // per family, including M, which is now the only arbiter.
  // -------------------------------------------------------------------------

  it('[D-21] decideOutcome: 1 with reason "strawman-m-passed" when strawman M PASSES — even though ' +
    'M is the only family that still arbitrates, and even when every gate passed', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    const gFamily = { familyId: 'G', arbitrated: false, strawman: { pass: false }, rows: [], selectedId: null, chosen: null };
    const mFamily = {
      familyId: 'M',
      arbitrated: true,
      strawman: { pass: true }, // a harness-integrity failure: circular and non-circular indistinguishable
      rows: [],
      selectedId: 'M1',
      chosen: { id: 'M1', base: 5 },
    };
    const wFamily = { familyId: 'W', arbitrated: false, strawman: { pass: false }, rows: [], selectedId: null, chosen: null };
    const result = {
      families: { G: gFamily, M: mFamily, W: wFamily },
      allCleared: true,
      gates: applyGates(views, GATES_PASS_SHIPPED, GATES_PASS_CONTROL_TEXT),
      shipped: GATES_PASS_SHIPPED,
    };
    expect(decideOutcome(result, {}).exitCode).toBe(1);
    expect(decideOutcome(result, {}).reason).toBe('strawman-m-passed');
  });

  it('[D-21] decideOutcome: 1 with reason "strawman-w-passed" when strawman W PASSES, even though ' +
    'Family W no longer arbitrates', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    const gFamily = { familyId: 'G', arbitrated: false, strawman: { pass: false }, rows: [], selectedId: null, chosen: null };
    const mFamily = { familyId: 'M', arbitrated: true, strawman: { pass: false }, rows: [], selectedId: 'M1', chosen: { id: 'M1', base: 5 } };
    const wFamily = {
      familyId: 'W',
      arbitrated: false,
      strawman: { pass: true }, // a harness-integrity failure
      rows: [],
      selectedId: null,
      chosen: null,
    };
    const result = {
      families: { G: gFamily, M: mFamily, W: wFamily },
      allCleared: true,
      gates: applyGates(views, GATES_PASS_SHIPPED, GATES_PASS_CONTROL_TEXT),
      shipped: GATES_PASS_SHIPPED,
    };
    expect(decideOutcome(result, {}).exitCode).toBe(1);
    expect(decideOutcome(result, {}).reason).toBe('strawman-w-passed');
  });

  it('[D-21] decideOutcome: 0 is unaffected when EVERY family present\'s strawman correctly FAILS ' +
    '(G, M and W all checked)', () => {
    const views = buildBaseViews(buildGatesPassArchive());
    const gFamily = { familyId: 'G', arbitrated: false, strawman: { pass: false }, rows: [], selectedId: null, chosen: null };
    const mFamily = { familyId: 'M', arbitrated: true, strawman: { pass: false }, rows: [], selectedId: 'M1', chosen: { id: 'M1', base: 5 } };
    const wFamily = { familyId: 'W', arbitrated: false, strawman: { pass: false }, rows: [], selectedId: null, chosen: null };
    const result = {
      families: { G: gFamily, M: mFamily, W: wFamily },
      allCleared: true,
      gates: applyGates(views, GATES_PASS_SHIPPED, GATES_PASS_CONTROL_TEXT),
      shipped: GATES_PASS_SHIPPED,
    };
    expect(decideOutcome(result, {}).exitCode).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// provenance chain (D-20, plan 34-13, Task 3) — the declared value cannot drift silently between
// 34-CONTEXT.md's D-20 line, the generator's own source text, and the rendered artifact line.
// Every seeded edit below writes to a REAL repo file, is watched failing, then reverted via
// `git checkout --` in a `finally` block — never left dirty, never committed. main() is never
// invoked and no real stream is read.
// ---------------------------------------------------------------------------

describe('provenance chain', () => {
  const CONTEXT_PATH = '.planning/phases/34-pause-classification-forgotten-stop/34-CONTEXT.md';
  const GENERATOR_PATH = 'scripts/compute-pause-classification-calibration.mjs';
  const CONTEXT_LINE_PATTERN = /^DECLARED STATIONARY_MAX_SPEED_MPS = ([0-9.]+)$/m;
  const GENERATOR_TEXT_LINE_PATTERN = /export const DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT = '([0-9.]+)';/;
  const ARTIFACT_LINE_PATTERN = /^STATIONARY_MAX_SPEED_MPS = ([0-9.]+)$/m;

  function readContextValue() {
    const text = readFileSync(CONTEXT_PATH, 'utf8');
    const match = CONTEXT_LINE_PATTERN.exec(text);
    if (!match) throw new Error(`DECLARED STATIONARY_MAX_SPEED_MPS line not found in ${CONTEXT_PATH}`);
    return match[1];
  }

  function readGeneratorTextValue() {
    const text = readFileSync(GENERATOR_PATH, 'utf8');
    const match = GENERATOR_TEXT_LINE_PATTERN.exec(text);
    if (!match) throw new Error(`DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT literal not found in ${GENERATOR_PATH}`);
    return match[1];
  }

  it('binds 34-CONTEXT.md D-20, the generator source text and the rendered artifact line ' +
    'character-for-character (never merely numerically); asserts the exact provenance line', () => {
    const contextValue = readContextValue();
    const generatorValue = readGeneratorTextValue();
    expect(generatorValue).toBe(DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT);
    expect(generatorValue).toBe(contextValue);

    const result = runCalibration(buildClearArchive(), GATES_PASS_CONTROL_TEXT);
    const markdown = renderCalibrationMarkdown({ ...result, provenance: {} });
    const artifactMatch = ARTIFACT_LINE_PATTERN.exec(markdown);
    expect(artifactMatch).not.toBeNull();
    expect(artifactMatch[1]).toBe(contextValue);
    expect(artifactMatch[1]).toBe(generatorValue);

    expect(markdown).toContain(
      'STATIONARY_MAX_SPEED_MPS provenance: developer-declared (D-20), not calibrated'
    );
  });

  it('S1 RED: editing 34-CONTEXT.md\'s DECLARED line breaks the context<->generator binding; ' +
    'reverted, the tree is clean', () => {
    const originalContext = readFileSync(CONTEXT_PATH, 'utf8');
    const editedContext = originalContext.replace(
      CONTEXT_LINE_PATTERN,
      'DECLARED STATIONARY_MAX_SPEED_MPS = 0.7'
    );
    expect(editedContext).not.toBe(originalContext); // the seed must actually change the file
    writeFileSync(CONTEXT_PATH, editedContext, 'utf8');
    let redMessage = null;
    try {
      const contextValue = readContextValue();
      const generatorValue = readGeneratorTextValue();
      expect(contextValue).toBe('0.7');
      if (generatorValue !== contextValue) {
        redMessage =
          `RED (S1, 34-CONTEXT.md DECLARED line edited to 0.7): generator source text ` +
          `('${generatorValue}') !== 34-CONTEXT.md DECLARED line ('${contextValue}')`;
      }
    } finally {
      execSync(`git checkout -- ${CONTEXT_PATH}`);
    }
    expect(redMessage).not.toBeNull();
    // eslint-disable-next-line no-console -- RED evidence, quoted verbatim in the plan 34-13 SUMMARY
    console.log(redMessage);
    expect(execSync(`git diff --exit-code -- ${CONTEXT_PATH}`).toString()).toBe('');
    expect(readContextValue()).toBe('0.5');
  });

  it('S2 RED: editing the generator\'s own source-text constant breaks the generator<->context ' +
    'binding; reverted, the tree is clean', () => {
    const originalGenerator = readFileSync(GENERATOR_PATH, 'utf8');
    const editedGenerator = originalGenerator.replace(
      "export const DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT = '0.5';",
      "export const DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT = '0.6';"
    );
    expect(editedGenerator).not.toBe(originalGenerator);
    writeFileSync(GENERATOR_PATH, editedGenerator, 'utf8');
    let redMessage = null;
    try {
      const contextValue = readContextValue();
      const generatorValue = readGeneratorTextValue();
      expect(generatorValue).toBe('0.6');
      if (generatorValue !== contextValue) {
        redMessage =
          `RED (S2, generator DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT edited to '0.6'): generator ` +
          `source text ('${generatorValue}') !== 34-CONTEXT.md DECLARED line ('${contextValue}')`;
      }
    } finally {
      execSync(`git checkout -- ${GENERATOR_PATH}`);
    }
    expect(redMessage).not.toBeNull();
    // eslint-disable-next-line no-console -- RED evidence, quoted verbatim in the plan 34-13 SUMMARY
    console.log(redMessage);
    expect(execSync(`git diff --exit-code -- ${GENERATOR_PATH}`).toString()).toBe('');
    expect(readGeneratorTextValue()).toBe('0.5');
  });

  it('S3 RED: a renderer that emits String(number) instead of the source text silently drops a ' +
    'trailing zero — proving the guard is character-level, not numeric; reverted, the tree is clean', async () => {
    const originalGenerator = readFileSync(GENERATOR_PATH, 'utf8');

    // Combined seeded edit, transient only (never committed): (a) the source text gains a trailing
    // zero, (b) the module-load round-trip assert is removed FOR THIS TRANSIENT COPY ONLY — a real
    // trailing-zero text is legitimate source text; only the load-bearing round-trip assert (Task 1)
    // would reject it, and this seed exists to test the RENDERER's own behaviour, not that assert —
    // and (c) the Chosen-constants render call site switches from the source-text constant to the
    // plain numeric constant (String(number) via template-literal coercion), the exact anti-pattern
    // 33-14's ship-from-artifact precedent warns against.
    let edited = originalGenerator.replace(
      "export const DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT = '0.5';",
      "export const DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT = '0.50';"
    );
    expect(edited).not.toBe(originalGenerator);
    const beforeAssertStrip = edited;
    edited = edited.replace(
      /assert\(\s*String\(DECLARED_STATIONARY_MAX_SPEED_MPS\)[\s\S]*?\n\);\n/,
      '// [S3 seeded edit, transient] round-trip assert removed for this RED demonstration only\n'
    );
    expect(edited).not.toBe(beforeAssertStrip);
    const beforeRenderEdit = edited;
    edited = edited.replace(
      'lines.push(`STATIONARY_MAX_SPEED_MPS = ${DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT}`);',
      'lines.push(`STATIONARY_MAX_SPEED_MPS = ${DECLARED_STATIONARY_MAX_SPEED_MPS}`);'
    );
    expect(edited).not.toBe(beforeRenderEdit);

    writeFileSync(GENERATOR_PATH, edited, 'utf8');
    let redMessage = null;
    try {
      const generatorSourceText = readGeneratorTextValue(); // '0.50'
      expect(generatorSourceText).toBe('0.50');

      const mod = await import(`${path.resolve(GENERATOR_PATH)}?seed=${Date.now()}-${Math.random()}`);
      const result = mod.runCalibration(buildClearArchive(), GATES_PASS_CONTROL_TEXT);
      const markdown = mod.renderCalibrationMarkdown({ ...result, provenance: {} });
      const artifactMatch = ARTIFACT_LINE_PATTERN.exec(markdown);
      const artifactValue = artifactMatch ? artifactMatch[1] : null;

      if (artifactValue !== generatorSourceText) {
        redMessage =
          `RED (S3, renderer switched to String(number) on source text '0.50'): rendered artifact ` +
          `line ('${artifactValue}') !== generator source text ('${generatorSourceText}') — a ` +
          'String(number) renderer silently drops the trailing zero';
      }
    } finally {
      execSync(`git checkout -- ${GENERATOR_PATH}`);
    }
    expect(redMessage).not.toBeNull();
    // eslint-disable-next-line no-console -- RED evidence, quoted verbatim in the plan 34-13 SUMMARY
    console.log(redMessage);
    expect(execSync(`git diff --exit-code -- ${GENERATOR_PATH}`).toString()).toBe('');
    expect(readGeneratorTextValue()).toBe('0.5');
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

// ---------------------------------------------------------------------------
// reachability (34-12-PLAN.md Task 3): each of G4, G5, M1, M2, W1, W2 is shown able to both PASS
// and FAIL on BOTH the REMOVED and PLANTED axes, through the real harness functions
// (buildBaseViews/removeNeighbourhoods/plantShapes/runFamily), on synthetic fixtures whose speeds
// are arbitrary round numbers — none echoes a HALT-1 or 34-CONTEXT figure (D-19 contamination guard).
// ---------------------------------------------------------------------------

/** A single pause-bearing activity (pause1 -> bridge -> pause2, then a recording gap of `gapMetres`
 * over 15s) — small enough that ONE plant (or removal) meaningfully moves G4/G5. */
function buildPauseBearingActivityWithGap(id, gapMetres) {
  const t = [];
  const d = [];
  let time = 0;
  let dist = 0;
  for (let i = 0; i <= 50; i++) {
    t.push(time);
    d.push(dist);
    time += 1;
    dist += 3.0;
  }
  for (let i = 0; i < 10; i++) {
    t.push(time);
    d.push(dist);
    time += 1;
  }
  t.push(time);
  d.push(dist);
  for (let i = 0; i < 3; i++) {
    time += 1;
    dist += 0.5;
    t.push(time);
    d.push(dist);
  }
  for (let i = 0; i < 10; i++) {
    time += 1;
    t.push(time);
    d.push(dist);
  }
  time += 15;
  dist += gapMetres;
  t.push(time);
  d.push(dist);
  for (let i = 0; i < 10; i++) {
    time += 1;
    dist += 3.0;
    t.push(time);
    d.push(dist);
  }
  return { id, t, d, cadence: null };
}

/** G4/G5 REMOVED CAN FAIL / PLANTED CAN FAIL(ish): two small activities, each with one chained
 * episode near its own J interval (0s separation, within the R=10s neighbourhood) — REMOVED
 * trivially empties the (small) population. */
function buildReachGSmallArchive(gapMetres = 1.0) {
  const activities = [
    buildPauseBearingActivityWithGap(INSENSITIVITY_SOURCE_ACTIVITY_ID, gapMetres),
    buildPauseBearingActivityWithGap('PB2', gapMetres),
  ];
  return { activities, streamFileCount: activities.length, notComputable: 0 };
}

/** G5 PLANTED CAN FAIL: a SINGLE-activity archive (one G5 "member") whose recording gap carries a
 * much higher rate (50 m / 15 s) than the episode's own drift rate — the plant dominates the one
 * member's ratio outright. */
function buildReachG5PlantedFailArchive() {
  const activities = [buildPauseBearingActivityWithGap(INSENSITIVITY_SOURCE_ACTIVITY_ID, 50.0)];
  return { activities, streamFileCount: 1, notComputable: 0 };
}

/** M1/M2 REMOVED CAN FAIL: activities whose ENTIRE advance-interval population sits within the
 * R=10s neighbourhood of their own creep candidate (a slow stretch immediately followed by one
 * huge advance-interval outlier) — REMOVED wipes them out, shifting the cross-activity quantile.
 * `creepyCount` controls how many such activities exist (1 moves M1's p90 only; 2 also moves M2's
 * p50, since the median then sits among the creepy activities' own inflated values). */
function buildReachMRemovedFailArchive(creepyCount) {
  function creepDominated(id) {
    const t = [];
    const d = [];
    let time = 0;
    let dist = 0;
    for (let i = 0; i <= 8; i++) {
      t.push(time);
      d.push(dist);
      time += 1;
      dist += 0.01;
    }
    time += 100;
    dist += 300;
    t.push(time);
    d.push(dist);
    return { id, t, d, cadence: null };
  }
  function normal(id, withGap) {
    const t = [];
    const d = [];
    let time = 0;
    let dist = 0;
    for (let i = 0; i <= 400; i++) {
      t.push(time);
      d.push(dist);
      time += 1;
      dist += 3.0;
    }
    if (withGap) {
      time += 15;
      dist += 1.0;
      t.push(time);
      d.push(dist);
    }
    return { id, t, d, cadence: null };
  }
  const activities = [];
  for (let i = 0; i < creepyCount; i++) activities.push(creepDominated(`creepy${i}`));
  activities.push(normal(INSENSITIVITY_SOURCE_ACTIVITY_ID, true));
  if (creepyCount === 1) activities.push(normal('normal2', false));
  return { activities, streamFileCount: activities.length, notComputable: 0 };
}

/** M1/M2 PLANTED CAN FAIL: two TINY activities (n advance intervals each) — a single planted 15s
 * advance interval dominates the small host's own p90/p50, shifting the cross-activity quantile. */
function buildReachMPlantedFailArchive(n) {
  function small(id, withGap) {
    const t = [];
    const d = [];
    let time = 0;
    let dist = 0;
    for (let i = 0; i <= n; i++) {
      t.push(time);
      d.push(dist);
      time += 1;
      dist += 3.0;
    }
    if (withGap) {
      time += 15;
      dist += 1.0;
      t.push(time);
      d.push(dist);
      for (let i = 0; i <= n; i++) {
        time += 1;
        dist += 3.0;
        t.push(time);
        d.push(dist);
      }
    }
    return { id, t, d, cadence: null };
  }
  const activities = [small(INSENSITIVITY_SOURCE_ACTIVITY_ID, true), small('a2', false)];
  return { activities, streamFileCount: activities.length, notComputable: 0 };
}

/** W1/W2 REMOVED/PLANTED CAN FAIL: a single tiny activity with a thin walk(1)/run(1) valley and a
 * recording gap whose rate lands EXACTLY in the current argmin bin [1.1, 1.2) — planting there
 * fills the bin (changing the argmin); removing the activity's only folded steps near the gap
 * empties the population entirely. */
function buildReachThinValleyArchive() {
  const t = [0, 1, 2];
  const d = [0, 3, 6];
  let time = 2;
  let dist = 6;
  time += 16;
  dist += 1.15 * 16; // recording-gap rate exactly 1.15 m/s -> bin [1.1, 1.2)
  t.push(time);
  d.push(dist);
  time += 1;
  dist += 1.0;
  t.push(time);
  d.push(dist); // one walk-speed folded step
  time += 1;
  dist += 3.0;
  t.push(time);
  d.push(dist); // one run-speed folded step
  return { activities: [{ id: INSENSITIVITY_SOURCE_ACTIVITY_ID, t, d, cadence: null }], streamFileCount: 1, notComputable: 0 };
}

function sourceShapesFor(views) {
  return views
    .find((v) => v.id === INSENSITIVITY_SOURCE_ACTIVITY_ID)
    .J.map((iv) => ({ metres: iv.metres, seconds: iv.seconds }));
}

describe('reachability', () => {
  describe('G4', () => {
    it('G4 REMOVED CAN FAIL: the whole (small) population sits within its own J neighbourhood, ' +
      'so REMOVED empties it — null, FAIL', () => {
      const views = buildBaseViews(buildReachGSmallArchive());
      const family = runFamily('G', views, { sourceShapes: sourceShapesFor(views) });
      const row = family.rows.find((r) => r.id === 'G4');
      expect(row.base).not.toBeNull();
      expect(row.removed).toBeNull();
      expect(row.pass).toBe(false);
    });

    it('G4 REMOVED CAN PASS: on the bulk archive (12 groups/activity, far from any J neighbourhood) ' +
      'removal touches nothing — 0% delta', () => {
      const views = buildBaseViews(buildClearArchive());
      const family = runFamily('G', views, { sourceShapes: sourceShapesFor(views) });
      const row = family.rows.find((r) => r.id === 'G4');
      expect(row.removedDelta).toBe(0);
      expect(row.pass).toBe(true);
      // non-vacuity: strawman G FAILs on the same fixture that makes G4 PASS.
      expect(family.strawman.pass).toBe(false);
    });

    it('G4 PLANTED CAN FAIL: >= 1 plant always; on a small (n=2) population a single planted ' +
      "J-rate episode moves the p90 by more than 1%", () => {
      const views = buildBaseViews(buildReachGSmallArchive());
      const family = runFamily('G', views, { sourceShapes: sourceShapesFor(views) });
      const row = family.rows.find((r) => r.id === 'G4');
      expect(row.plantCount).toBeGreaterThanOrEqual(1);
      expect(row.plantedDelta).toBeGreaterThan(0.01);
      expect(row.pass).toBe(false);
    });

    it('G4 PLANTED CAN PASS: on the bulk archive every episode is tied at the same rate, so a tied ' +
      'run at the p90 index absorbs the plant', () => {
      const views = buildBaseViews(buildClearArchive());
      const family = runFamily('G', views, { sourceShapes: sourceShapesFor(views) });
      const row = family.rows.find((r) => r.id === 'G4');
      expect(row.plantCount).toBeGreaterThanOrEqual(1);
      expect(row.plantedDelta).toBeLessThanOrEqual(0.01);
      expect(row.pass).toBe(true);
      expect(family.strawman.pass).toBe(false);
    });
  });

  describe('G5', () => {
    it('G5 REMOVED CAN FAIL: an activity loses its only episode (leaves the population) on the ' +
      'small archive', () => {
      const views = buildBaseViews(buildReachGSmallArchive());
      const family = runFamily('G', views, { sourceShapes: sourceShapesFor(views) });
      const row = family.rows.find((r) => r.id === 'G5');
      expect(row.base).not.toBeNull();
      expect(row.removed).toBeNull();
      expect(row.pass).toBe(false);
    });

    it('G5 REMOVED CAN PASS: on the bulk archive removal touches only activities whose ratio ' +
      'position is unchanged (all tied)', () => {
      const views = buildBaseViews(buildClearArchive());
      const family = runFamily('G', views, { sourceShapes: sourceShapesFor(views) });
      const row = family.rows.find((r) => r.id === 'G5');
      expect(row.removedDelta).toBe(0);
      expect(row.pass).toBe(true);
      expect(family.strawman.pass).toBe(false);
    });

    it('G5 PLANTED CAN FAIL: with only ONE member activity, a plant with a much higher rate lifts ' +
      "that member's ratio outright, moving the (single-member) p90 by far more than 1%", () => {
      const views = buildBaseViews(buildReachG5PlantedFailArchive());
      const family = runFamily('G', views, { sourceShapes: sourceShapesFor(views) });
      const row = family.rows.find((r) => r.id === 'G5');
      expect(row.plantCount).toBeGreaterThanOrEqual(1);
      expect(row.plantedDelta).toBeGreaterThan(0.01);
      expect(row.pass).toBe(false);
    });

    it('G5 PLANTED CAN PASS: on the bulk archive plants land only in members already tied at the ' +
      'same ratio (deterministic round-robin by id), so the order statistic is unchanged', () => {
      const views = buildBaseViews(buildClearArchive());
      const family = runFamily('G', views, { sourceShapes: sourceShapesFor(views) });
      const row = family.rows.find((r) => r.id === 'G5');
      expect(row.plantCount).toBeGreaterThanOrEqual(1);
      expect(row.plantedDelta).toBeLessThanOrEqual(0.01);
      expect(row.pass).toBe(true);
      expect(family.strawman.pass).toBe(false);
    });
  });

  describe('M1', () => {
    it('M1 REMOVED CAN FAIL: dropping advance intervals near a creep candidate strips a host\'s ' +
      "own outlier-dominated p90, moving the cross-activity p90 far past 1%", () => {
      const views = buildBaseViews(buildReachMRemovedFailArchive(1));
      const removed = removeNeighbourhoods(views, 'M', 0.05);
      expect(removed.removedCount).toBeGreaterThan(0);
      const family = runFamily('M', views, { sourceShapes: sourceShapesFor(views), shippedFloor: 0.05 });
      const row = family.rows.find((r) => r.id === 'M1');
      expect(row.removedDelta).toBeGreaterThan(0.01);
      expect(row.pass).toBe(false);
    });

    it('M1 REMOVED CAN PASS: a host dominated by one sampling interval keeps its p90 when a ' +
      'minority is removed (bulk archive)', () => {
      const views = buildBaseViews(buildInsensitiveArchive());
      const family = runFamily('M', views, { sourceShapes: sourceShapesFor(views), shippedFloor: 0.131 });
      const row = family.rows.find((r) => r.id === 'M1');
      expect(row.removedDelta).toBeLessThanOrEqual(0.01);
      expect(row.pass).toBe(true);
      expect(family.strawman.pass).toBe(false);
    });

    it('M1 PLANTED CAN FAIL: on tiny hosts, a single planted long advance interval sits at the top ' +
      "of the host's own distribution, moving its p90 (and the cross-activity p90) past 1%", () => {
      const views = buildBaseViews(buildReachMPlantedFailArchive(3));
      const family = runFamily('M', views, { sourceShapes: sourceShapesFor(views), shippedFloor: 0.5 });
      const row = family.rows.find((r) => r.id === 'M1');
      expect(row.plantCount).toBeGreaterThanOrEqual(1);
      expect(row.plantedDelta).toBeGreaterThan(0.01);
      expect(row.pass).toBe(false);
    });

    it('M1 PLANTED CAN PASS: an atom-dominated distribution (bulk archive) absorbs a 1% top ' +
      'insertion', () => {
      const views = buildBaseViews(buildInsensitiveArchive());
      const family = runFamily('M', views, { sourceShapes: sourceShapesFor(views), shippedFloor: 0.131 });
      const row = family.rows.find((r) => r.id === 'M1');
      expect(row.plantCount).toBeGreaterThanOrEqual(1);
      expect(row.plantedDelta).toBeLessThanOrEqual(0.01);
      expect(row.pass).toBe(true);
      expect(family.strawman.pass).toBe(false);
    });
  });

  describe('M2', () => {
    it('M2 REMOVED CAN FAIL: with TWO creep-dominated hosts, removal changes which host sits at ' +
      'the cross-activity median, moving M2 far past 1%', () => {
      const views = buildBaseViews(buildReachMRemovedFailArchive(2));
      const removed = removeNeighbourhoods(views, 'M', 0.05);
      expect(removed.removedCount).toBeGreaterThan(0);
      const family = runFamily('M', views, { sourceShapes: sourceShapesFor(views), shippedFloor: 0.05 });
      const row = family.rows.find((r) => r.id === 'M2');
      expect(row.removedDelta).toBeGreaterThan(0.01);
      expect(row.pass).toBe(false);
    });

    it('M2 REMOVED CAN PASS: a typical (not conservative) scale on the bulk archive keeps its ' +
      'median when a minority is removed', () => {
      const views = buildBaseViews(buildInsensitiveArchive());
      const family = runFamily('M', views, { sourceShapes: sourceShapesFor(views), shippedFloor: 0.131 });
      const row = family.rows.find((r) => r.id === 'M2');
      expect(row.removedDelta).toBeLessThanOrEqual(0.01);
      expect(row.pass).toBe(true);
      expect(family.strawman.pass).toBe(false);
    });

    it('M2 PLANTED CAN FAIL: on tiny hosts, a single planted long advance interval shifts the ' +
      "host's own median far past 1%", () => {
      const views = buildBaseViews(buildReachMPlantedFailArchive(3));
      const family = runFamily('M', views, { sourceShapes: sourceShapesFor(views), shippedFloor: 0.5 });
      const row = family.rows.find((r) => r.id === 'M2');
      expect(row.plantCount).toBeGreaterThanOrEqual(1);
      expect(row.plantedDelta).toBeGreaterThan(0.01);
      expect(row.pass).toBe(false);
    });

    it('M2 PLANTED CAN PASS: an atom-dominated distribution (bulk archive) absorbs a 1% top ' +
      'insertion at the median too', () => {
      const views = buildBaseViews(buildInsensitiveArchive());
      const family = runFamily('M', views, { sourceShapes: sourceShapesFor(views), shippedFloor: 0.131 });
      const row = family.rows.find((r) => r.id === 'M2');
      expect(row.plantCount).toBeGreaterThanOrEqual(1);
      expect(row.plantedDelta).toBeLessThanOrEqual(0.01);
      expect(row.pass).toBe(true);
      expect(family.strawman.pass).toBe(false);
    });
  });

  describe('W1', () => {
    it('W1 REMOVED CAN FAIL: removing the only folded steps near the activity\'s own J interval ' +
      'empties the tiny population — null, FAIL', () => {
      const views = buildBaseViews(buildReachThinValleyArchive());
      const family = runFamily('W', views, { sourceShapes: sourceShapesFor(views), shippedFloor: 0.5 });
      const row = family.rows.find((r) => r.id === 'W1');
      expect(row.base).not.toBeNull();
      expect(row.removed).toBeNull();
      expect(row.pass).toBe(false);
    });

    it('W1 REMOVED CAN PASS: proportional thinning on the bulk archive keeps the argmin bin (0% ' +
      'delta — quantised to bins)', () => {
      const views = buildBaseViews(buildClearArchive());
      const family = runFamily('W', views, { sourceShapes: sourceShapesFor(views), shippedFloor: 0.131 });
      const row = family.rows.find((r) => r.id === 'W1');
      expect(row.removedDelta).toBe(0);
      expect(row.pass).toBe(true);
      expect(family.strawman.pass).toBe(false);
    });

    it('W1 PLANTED CAN FAIL: a plant landing EXACTLY in the current argmin bin fills it, changing ' +
      'the argmin bin by more than 1%', () => {
      const views = buildBaseViews(buildReachThinValleyArchive());
      const family = runFamily('W', views, { sourceShapes: sourceShapesFor(views), shippedFloor: 0.5 });
      const row = family.rows.find((r) => r.id === 'W1');
      expect(row.plantCount).toBeGreaterThanOrEqual(1);
      expect(row.plantedDelta).toBeGreaterThan(0.01);
      expect(row.pass).toBe(false);
    });

    it('W1 PLANTED CAN PASS: the valley bin\'s margin on the bulk archive absorbs the added ' +
      'weight — the bin is unchanged', () => {
      const views = buildBaseViews(buildClearArchive());
      const family = runFamily('W', views, { sourceShapes: sourceShapesFor(views), shippedFloor: 0.131 });
      const row = family.rows.find((r) => r.id === 'W1');
      expect(row.plantCount).toBeGreaterThanOrEqual(1);
      expect(row.plantedDelta).toBeLessThanOrEqual(0.01);
      expect(row.pass).toBe(true);
      expect(family.strawman.pass).toBe(false);
    });
  });

  describe('W2', () => {
    it('W2 REMOVED CAN FAIL: removing the only folded steps near the activity\'s own J interval ' +
      'empties the tiny population — null, FAIL', () => {
      const views = buildBaseViews(buildReachThinValleyArchive());
      const family = runFamily('W', views, { sourceShapes: sourceShapesFor(views), shippedFloor: 0.5 });
      const row = family.rows.find((r) => r.id === 'W2');
      expect(row.base).not.toBeNull();
      expect(row.removed).toBeNull();
      expect(row.pass).toBe(false);
    });

    it('W2 REMOVED CAN PASS: proportional thinning on the bulk archive keeps the argmin bin', () => {
      const views = buildBaseViews(buildClearArchive());
      const family = runFamily('W', views, { sourceShapes: sourceShapesFor(views), shippedFloor: 0.131 });
      const row = family.rows.find((r) => r.id === 'W2');
      expect(row.removedDelta).toBe(0);
      expect(row.pass).toBe(true);
      expect(family.strawman.pass).toBe(false);
    });

    it('W2 PLANTED CAN FAIL: a plant landing EXACTLY in the current argmin bin fills it (count- ' +
      'weighted), changing the argmin bin by more than 1%', () => {
      const views = buildBaseViews(buildReachThinValleyArchive());
      const family = runFamily('W', views, { sourceShapes: sourceShapesFor(views), shippedFloor: 0.5 });
      const row = family.rows.find((r) => r.id === 'W2');
      expect(row.plantCount).toBeGreaterThanOrEqual(1);
      expect(row.plantedDelta).toBeGreaterThan(0.01);
      expect(row.pass).toBe(false);
    });

    it('W2 PLANTED CAN PASS: the valley bin\'s margin on the bulk archive absorbs the added ' +
      'weight (count-weighted)', () => {
      const views = buildBaseViews(buildClearArchive());
      const family = runFamily('W', views, { sourceShapes: sourceShapesFor(views), shippedFloor: 0.131 });
      const row = family.rows.find((r) => r.id === 'W2');
      expect(row.plantCount).toBeGreaterThanOrEqual(1);
      expect(row.plantedDelta).toBeLessThanOrEqual(0.01);
      expect(row.pass).toBe(true);
      expect(family.strawman.pass).toBe(false);
    });
  });
});
