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
  PLANT_FRACTION,
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
  shapeG4,
  shapeG5,
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

  it('rounding: G and W round via ceilToSignificant(raw, 3); M rounds via Math.ceil(raw)', () => {
    const result = runCalibration(buildClearArchive(), null);
    expect(result.allCleared).toBe(true);
    // G4's raw rate 3/23 = 0.130434... rounds UP to 3 significant figures as 0.131 (never 0.130,
    // which a standard round-to-nearest would give) — proves ceilToSignificant, not Math.round.
    expect(result.shipped.STATIONARY_MAX_SPEED_MPS).toBeCloseTo(0.131, 6);
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

  it('[D-19] rendered drift section states "Drift matters" when the shipped G value is > 0, and ' +
    'names the standstill counts as the HALT reason when G HALTed with zero chained episodes', () => {
    const clear = runCalibration(buildClearArchive(), null);
    const clearMarkdown = renderCalibrationMarkdown({ ...clear, provenance: {} });
    expect(clearMarkdown).toContain('Drift matters: the shipped G value is > 0.');

    const halt = runCalibration(buildHaltArchive(), null);
    const haltMarkdown = renderCalibrationMarkdown({ ...halt, provenance: {} });
    expect(haltMarkdown).toContain('No chained episode exists: the base is null and G HALTs');
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
