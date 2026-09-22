/**
 * Phase 34 plan 04 (PAUSE-01, STOP-02, D-05..D-08, D-10, D-12, D-13): the HALT-capable calibration
 * generator for the three constants this phase ships — STATIONARY_MAX_SPEED_MPS (G family, also
 * STOP-02's near-zero threshold), FORGOTTEN_STOP_MIN_SEC (M family) and WALK_RUN_BOUNDARY_MPS
 * (W family) — plus D-10's recording-mechanism rule verification, D-12's developer-confirmed
 * walking-break anchor, and the per-interval class table for 3475724402 plan 34-07's independent
 * recount reads.
 *
 * THIS FILE IMPLEMENTS 34-04-PLAN.md's <predeclared_shapes> BLOCK LITERALLY. That text was written
 * on argument, before any measurement — if the implementation and that text ever disagree, the text
 * wins and this file is the bug.
 *
 * This generator is never run against the real archive in this plan (D-08: no peeking). `main()` is
 * gated behind the standard self-execution guard at the bottom so
 * compute-pause-classification-calibration.test.mjs can import every pure function without
 * triggering an archive read or a write to 34-CALIBRATION.md as an import-time side effect.
 *
 * No wall-clock timestamp or generated-at field appears anywhere in the rendered output — a re-run
 * against an unchanged archive is byte-identical.
 */

import assert from 'assert';

import { advanceSteps } from '../dist/analytics/unreliable-segments.js';
import {
  advanceIntervals,
  classifyGapsWithSegments,
  PAUSE_GAP_P90_MULTIPLIER,
  quantile,
  RECORDING_GAP_ABS_THRESHOLD_SEC,
} from '../dist/analytics/pace-derivation.js';
// Namespace import (never named): STATIONARY_MAX_SPEED_MPS / FORGOTTEN_STOP_MIN_SEC /
// WALK_RUN_BOUNDARY_MPS do not exist on the shipped module until plan 34-06 ships them — a named
// import would be a link error on every run before that. Task 1 only needs
// pc.collectPauseIntervals and pc.SIGNATURE_MIN_COVERED_PAIRS.
import * as pc from '../dist/analytics/pause-classification.js';

// ---------------------------------------------------------------------------
// Fixed constants — pre-declared before any measurement
// ---------------------------------------------------------------------------

/** D-13's tolerance, fixed before any check runs. */
export const INSENSITIVITY_TOLERANCE = 0.01;

/** The neighbourhood width, reused from the imported recording-gap threshold — never a literal 10. */
export const NEIGHBOURHOOD_SEC = RECORDING_GAP_ABS_THRESHOLD_SEC;

/** The W-family valley histogram's fixed bin width. */
export const VALLEY_BIN_WIDTH_MPS = 0.1;

/** The activity whose real J-interval shapes are cloned into the D-13 planting step, every family. */
export const INSENSITIVITY_SOURCE_ACTIVITY_ID = '3475724402';

function sortAsc(values) {
  return [...values].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Views: buildBaseViews / removeNeighbourhoods / plantShapes
// ---------------------------------------------------------------------------

/**
 * Per-activity base view (COMMON DEFINITIONS): `r = classifyGapsWithSegments(t, d)`. An activity
 * with `r.coverage.spanSec === 0` is `computable: false` — counted, contributes to no population.
 * Otherwise builds J (recording-gap / merged-segment `collectPauseIntervals` entries, with speed),
 * zero-advance pause intervals, every covered pair (with cadence-silence when both endpoint samples
 * carry a finite cadence of exactly 0), the folded covered steps (`advanceSteps` over ALL THREE
 * gapIntervals kinds), and the positioned advance intervals — asserted (throws on mismatch) to equal
 * the imported `advanceIntervals(t, d)` as a sorted multiset.
 */
export function buildBaseViews(archive) {
  const views = [];

  for (const activity of archive.activities) {
    const { t, d, cadence } = activity;
    const r = classifyGapsWithSegments(t, d);

    if (r.coverage.spanSec === 0) {
      views.push({ id: activity.id, computable: false });
      continue;
    }

    const collected = pc.collectPauseIntervals(t, d, r.coverage, r.segments);
    const J = collected.intervals
      .filter((iv) => iv.source === 'recording-gap' || iv.source === 'merged-segment')
      .map((iv) => ({ ...iv, speedMps: iv.metres / iv.seconds }));
    const pauseIntervals = collected.intervals.filter((iv) => iv.source === 'zero-advance-pause');

    const cadenceArr = Array.isArray(cadence) ? cadence : null;
    const coveredPairs = [];
    for (const run of r.coveredRuns) {
      for (let i = run.startIndex; i < run.endIndex; i++) {
        const seconds = t[i + 1] - t[i];
        if (!(seconds > 0)) continue;
        const metres = d[i + 1] - d[i];
        const cadenceSilent =
          cadenceArr !== null &&
          Number.isFinite(cadenceArr[i]) &&
          Number.isFinite(cadenceArr[i + 1]) &&
          cadenceArr[i] === 0 &&
          cadenceArr[i + 1] === 0;
        coveredPairs.push({
          index: i,
          startSec: t[i],
          endSec: t[i + 1],
          metres,
          seconds,
          speedMps: metres / seconds,
          cadenceSilent,
        });
      }
    }

    const spans = r.coverage.gapIntervals.map((g) => ({ startSec: g.startSec, endSec: g.endSec }));
    const foldedSteps = advanceSteps(t, d, spans);

    const positionedAdvanceIntervals = [];
    let lastAdvanceT = t[0];
    for (let i = 1; i < t.length; i++) {
      if (d[i] > d[i - 1]) {
        positionedAdvanceIntervals.push({ seconds: t[i] - lastAdvanceT, startSec: lastAdvanceT, endSec: t[i] });
        lastAdvanceT = t[i];
      }
    }
    const positionedSeconds = sortAsc(positionedAdvanceIntervals.map((iv) => iv.seconds));
    const imported = advanceIntervals(t, d);
    assert.deepStrictEqual(
      positionedSeconds,
      imported,
      `buildBaseViews: positioned advance intervals for activity ${activity.id} do not match the ` +
        'imported advanceIntervals(t, d) exactly — the views are wrong.'
    );

    views.push({
      id: activity.id,
      computable: true,
      t,
      d,
      coverage: r.coverage,
      segments: r.segments,
      coveredRuns: r.coveredRuns,
      J,
      pauseIntervals,
      coveredPairs,
      foldedSteps,
      positionedAdvanceIntervals,
      notClassifiableCount: collected.notClassifiableCount,
      joinViolations: collected.joinViolations,
    });
  }

  return views;
}

function neighbourhoodsFromIntervals(intervals) {
  return intervals.map((iv) => [iv.startSec - NEIGHBOURHOOD_SEC, iv.endSec + NEIGHBOURHOOD_SEC]);
}

function intersectsAny(startSec, endSec, neighbourhoods) {
  return neighbourhoods.some(([ns, ne]) => startSec <= ne && endSec >= ns);
}

/**
 * A creep candidate (REMOVED view, M family, and STRAWMAN M's own population): a maximal run of
 * consecutive covered pairs (contiguous `index`) each with pair speed `<= floor`, of any duration.
 * `floor === null` (upstream G HALT) returns no candidates.
 */
function creepCandidates(coveredPairs, floor) {
  if (floor === null || floor === undefined) return [];
  const sorted = [...coveredPairs].sort((a, b) => a.index - b.index);
  const candidates = [];
  let current = null;
  for (const p of sorted) {
    if (p.speedMps <= floor) {
      if (current !== null && p.index === current.lastIndex + 1) {
        current.endSec = p.endSec;
        current.lastIndex = p.index;
      } else {
        if (current !== null) candidates.push(current);
        current = { startSec: p.startSec, endSec: p.endSec, lastIndex: p.index };
      }
    } else if (current !== null) {
      candidates.push(current);
      current = null;
    }
  }
  if (current !== null) candidates.push(current);
  return candidates.map(({ startSec, endSec }) => ({ startSec, endSec, seconds: endSec - startSec }));
}

/**
 * REMOVED perturbation (D-13 harness): G/W drop items (coveredPairs / foldedSteps respectively)
 * intersecting the neighbourhood of any J interval of the same activity; M drops
 * positionedAdvanceIntervals intersecting the neighbourhood of any creep candidate (at `shippedFloor`,
 * the upstream-chosen G value) of the same activity.
 */
export function removeNeighbourhoods(views, family, shippedFloor) {
  let removedCount = 0;
  let changedActivityCount = 0;

  const outViews = views.map((view) => {
    if (!view.computable) return view;
    let changed = false;

    if (family === 'G') {
      const neighbourhoods = neighbourhoodsFromIntervals(view.J);
      const keptPairs = view.coveredPairs.filter((p) => !intersectsAny(p.startSec, p.endSec, neighbourhoods));
      removedCount += view.coveredPairs.length - keptPairs.length;
      if (keptPairs.length !== view.coveredPairs.length) changed = true;
      // J's own removed view (STRAWMAN G's population): every J item trivially intersects its own
      // padded neighbourhood, so this always empties J — the "unfalsifiable-fail" property.
      const keptJ = view.J.filter((j) => !intersectsAny(j.startSec, j.endSec, neighbourhoods));
      removedCount += view.J.length - keptJ.length;
      if (keptJ.length !== view.J.length) changed = true;
      if (changed) changedActivityCount++;
      return { ...view, coveredPairs: keptPairs, J: keptJ };
    }

    if (family === 'W') {
      const neighbourhoods = neighbourhoodsFromIntervals(view.J);
      const keptSteps = view.foldedSteps.filter((s) => !intersectsAny(s.startSec, s.endSec, neighbourhoods));
      removedCount += view.foldedSteps.length - keptSteps.length;
      if (keptSteps.length !== view.foldedSteps.length) changed = true;
      // STRAWMAN W's population is also J (count-weighted) — same trivial self-emptying.
      const keptJ = view.J.filter((j) => !intersectsAny(j.startSec, j.endSec, neighbourhoods));
      removedCount += view.J.length - keptJ.length;
      if (keptJ.length !== view.J.length) changed = true;
      if (changed) changedActivityCount++;
      return { ...view, foldedSteps: keptSteps, J: keptJ };
    }

    if (family === 'M') {
      const candidates = creepCandidates(view.coveredPairs, shippedFloor);
      const neighbourhoods = neighbourhoodsFromIntervals(candidates);
      const keptAdvance = view.positionedAdvanceIntervals.filter(
        (iv) => !intersectsAny(iv.startSec, iv.endSec, neighbourhoods)
      );
      removedCount += view.positionedAdvanceIntervals.length - keptAdvance.length;
      if (keptAdvance.length !== view.positionedAdvanceIntervals.length) changed = true;
      // STRAWMAN M's population (creep-candidate durations) is recomputed from coveredPairs — drop
      // exactly the covered pairs that FORMED each candidate (a candidate's own pairs trivially
      // intersect its own padded neighbourhood), so recomputing candidates on the kept pairs finds
      // none there — the same trivial self-emptying property as G/W above.
      const keptPairs = view.coveredPairs.filter((p) => !intersectsAny(p.startSec, p.endSec, neighbourhoods));
      removedCount += view.coveredPairs.length - keptPairs.length;
      if (keptPairs.length !== view.coveredPairs.length) changed = true;
      if (changed) changedActivityCount++;
      return { ...view, positionedAdvanceIntervals: keptAdvance, coveredPairs: keptPairs };
    }

    return view;
  });

  return { views: outViews, removedCount, changedActivityCount };
}

/**
 * PLANTED perturbation (D-13 harness, all families at once): clones `sourceShapes` (every J
 * interval's `{ metres, seconds }` on 3475724402) round-robin into activities sorted by id until the
 * planted count equals the archive-wide `|J|`. Each plant enters coveredPairs (cadence-silent),
 * foldedSteps and positionedAdvanceIntervals of its target activity — one item per population, per
 * plant — with negative sentinel indices so it can never be index-contiguous with a real item.
 */
export function plantShapes(views, sourceShapes) {
  const jTotal = views.reduce((sum, v) => sum + (v.computable ? v.J.length : 0), 0);
  const computableIds = views.filter((v) => v.computable).map((v) => v.id).sort();

  if (sourceShapes.length === 0 || computableIds.length === 0 || jTotal === 0) {
    return { views, plantedCount: 0, sourceShapeCount: sourceShapes.length };
  }

  const byId = new Map(
    views.map((v) => [
      v.id,
      v.computable
        ? {
            ...v,
            coveredPairs: v.coveredPairs.slice(),
            foldedSteps: v.foldedSteps.slice(),
            positionedAdvanceIntervals: v.positionedAdvanceIntervals.slice(),
          }
        : v,
    ])
  );

  let plantedCount = 0;
  let cursor = 0;
  while (plantedCount < jTotal) {
    const targetId = computableIds[cursor % computableIds.length];
    const template = sourceShapes[plantedCount % sourceShapes.length];
    const target = byId.get(targetId);
    const sentinel = -(plantedCount + 1);
    const speed = template.metres / template.seconds;

    target.coveredPairs.push({
      index: sentinel,
      startSec: 0,
      endSec: template.seconds,
      metres: template.metres,
      seconds: template.seconds,
      speedMps: speed,
      cadenceSilent: true,
    });
    target.foldedSteps.push({
      startIndex: sentinel,
      endIndex: sentinel,
      startSec: 0,
      endSec: template.seconds,
      metres: template.metres,
      seconds: template.seconds,
    });
    target.positionedAdvanceIntervals.push({ seconds: template.seconds, startSec: 0, endSec: template.seconds });

    plantedCount++;
    cursor++;
  }

  return { views: [...byId.values()], plantedCount, sourceShapeCount: sourceShapes.length };
}

// ---------------------------------------------------------------------------
// D-13 harness: evaluateShape
// ---------------------------------------------------------------------------

/**
 * D-13's two-direction insensitivity check for one shape's `fn`, over already-built base/removed/
 * planted view arrays. `pass` requires BOTH relative deltas (raw, unrounded) to clear `tolerance`; a
 * null/zero base or a null perturbed value is FAIL (an emptied population is the most extreme
 * sensitivity there is).
 */
export function evaluateShape(fn, { base, removed, planted }, { tolerance, ctx } = {}) {
  const baseResult = fn(base, ctx);
  const removedResult = fn(removed, ctx);
  const plantedResult = fn(planted, ctx);

  const baseValue = baseResult.value;
  const removedValue = removedResult.value;
  const plantedValue = plantedResult.value;

  const removedDelta =
    baseValue === null || baseValue === 0 || removedValue === null
      ? null
      : Math.abs(removedValue - baseValue) / Math.abs(baseValue);
  const plantedDelta =
    baseValue === null || baseValue === 0 || plantedValue === null
      ? null
      : Math.abs(plantedValue - baseValue) / Math.abs(baseValue);

  const pass =
    removedDelta !== null && plantedDelta !== null && removedDelta <= tolerance && plantedDelta <= tolerance;

  return {
    base: baseValue,
    baseN: baseResult.n,
    baseExcluded: baseResult.excluded ?? 0,
    removed: removedValue,
    removedN: removedResult.n,
    planted: plantedValue,
    plantedN: plantedResult.n,
    removedDelta,
    plantedDelta,
    pass,
  };
}

// ---------------------------------------------------------------------------
// G family
// ---------------------------------------------------------------------------

export function shapeG1(views) {
  const speeds = [];
  for (const v of views) {
    if (!v.computable) continue;
    for (const p of v.coveredPairs) if (p.cadenceSilent) speeds.push(p.speedMps);
  }
  const sorted = sortAsc(speeds);
  return { value: sorted.length === 0 ? null : quantile(sorted, 0.9), n: sorted.length, excluded: 0 };
}

export function shapeG2(views) {
  const perActivity = [];
  let excluded = 0;
  for (const v of views) {
    if (!v.computable) continue;
    const silentSpeeds = v.coveredPairs.filter((p) => p.cadenceSilent).map((p) => p.speedMps);
    if (silentSpeeds.length < pc.SIGNATURE_MIN_COVERED_PAIRS) {
      excluded++;
      continue;
    }
    perActivity.push(quantile(sortAsc(silentSpeeds), 0.5));
  }
  const sorted = sortAsc(perActivity);
  return { value: sorted.length === 0 ? null : quantile(sorted, 0.9), n: sorted.length, excluded };
}

export function shapeG3(views) {
  const speeds = [];
  for (const v of views) {
    if (!v.computable) continue;
    for (const pause of v.pauseIntervals) {
      const leadStart = pause.startSec - NEIGHBOURHOOD_SEC;
      const leadEnd = pause.startSec;
      const trailStart = pause.endSec;
      const trailEnd = pause.endSec + NEIGHBOURHOOD_SEC;
      for (const p of v.coveredPairs) {
        const inLead = p.startSec >= leadStart && p.endSec <= leadEnd;
        const inTrail = p.startSec >= trailStart && p.endSec <= trailEnd;
        if (inLead || inTrail) speeds.push(p.speedMps);
      }
    }
  }
  const sorted = sortAsc(speeds);
  return { value: sorted.length === 0 ? null : quantile(sorted, 0.5), n: sorted.length, excluded: 0 };
}

export function strawmanG(views) {
  const speeds = [];
  for (const v of views) {
    if (!v.computable) continue;
    for (const j of v.J) speeds.push(j.speedMps);
  }
  const sorted = sortAsc(speeds);
  return { value: sorted.length === 0 ? null : quantile(sorted, 0.9), n: sorted.length, excluded: 0 };
}

// ---------------------------------------------------------------------------
// M family
// ---------------------------------------------------------------------------

function perActivityPa(view) {
  const seconds = view.positionedAdvanceIntervals.map((iv) => iv.seconds);
  if (seconds.length === 0) return null;
  return PAUSE_GAP_P90_MULTIPLIER * quantile(sortAsc(seconds), 0.9);
}

function pooledPa(views) {
  const perActivity = [];
  let excluded = 0;
  for (const v of views) {
    if (!v.computable) continue;
    const pa = perActivityPa(v);
    if (pa === null) {
      excluded++;
      continue;
    }
    perActivity.push(pa);
  }
  return { sorted: sortAsc(perActivity), excluded };
}

export function shapeM1(views) {
  const { sorted, excluded } = pooledPa(views);
  return { value: sorted.length === 0 ? null : quantile(sorted, 0.9), n: sorted.length, excluded };
}

export function shapeM2(views) {
  const { sorted, excluded } = pooledPa(views);
  return { value: sorted.length === 0 ? null : quantile(sorted, 0.5), n: sorted.length, excluded };
}

export function strawmanM(views, ctx) {
  const floor = ctx && ctx.shippedFloor;
  const durations = [];
  for (const v of views) {
    if (!v.computable) continue;
    for (const c of creepCandidates(v.coveredPairs, floor)) durations.push(c.seconds);
  }
  const sorted = sortAsc(durations);
  return { value: sorted.length === 0 ? null : quantile(sorted, 0.9), n: sorted.length, excluded: 0 };
}

// ---------------------------------------------------------------------------
// W family (VALLEY DEFINITION)
// ---------------------------------------------------------------------------

/**
 * The one valley definition every W shape and the W strawman share: a histogram over `[lo, hi)`,
 * bin width `VALLEY_BIN_WIDTH_MPS`, edges starting at `floor(lo / 0.1) * 0.1`. A bin qualifies as a
 * dip iff `leftMax > 0`, `rightMax > 0` and `counts[i] <= 0.5 * min(leftMax, rightMax)`. The valley
 * is the qualifying bin with the LOWEST count (ties go to the lowest edge); its value is the bin
 * centre. `null` on no qualifying bin (a monotone histogram or an empty population) — deliberately
 * the MINIMUM qualifying bin, not the first (`findValley`'s own rule), since the first qualifying bin
 * is a shoulder of the walking hump, not the minimum.
 */
export function valleyOf(items, lo, hi) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return null;

  const edgeStart = Math.floor(lo / VALLEY_BIN_WIDTH_MPS) * VALLEY_BIN_WIDTH_MPS;
  const binCount = Math.max(0, Math.round((hi - edgeStart) / VALLEY_BIN_WIDTH_MPS));
  if (binCount === 0) return null;

  const counts = new Array(binCount).fill(0);
  for (const { value, weight } of items) {
    if (!(value >= lo) || !(value < hi)) continue;
    let idx = Math.floor((value - edgeStart) / VALLEY_BIN_WIDTH_MPS + 1e-9);
    if (idx < 0) idx = 0;
    if (idx >= binCount) idx = binCount - 1;
    counts[idx] += weight;
  }

  let bestIdx = null;
  for (let i = 0; i < binCount; i++) {
    let leftMax = 0;
    for (let k = 0; k < i; k++) leftMax = Math.max(leftMax, counts[k]);
    let rightMax = 0;
    for (let k = i + 1; k < binCount; k++) rightMax = Math.max(rightMax, counts[k]);
    if (leftMax > 0 && rightMax > 0 && counts[i] <= 0.5 * Math.min(leftMax, rightMax)) {
      if (
        bestIdx === null ||
        counts[i] < counts[bestIdx] ||
        (counts[i] === counts[bestIdx] && i < bestIdx)
      ) {
        bestIdx = i;
      }
    }
  }

  if (bestIdx === null) return null;
  return edgeStart + bestIdx * VALLEY_BIN_WIDTH_MPS + VALLEY_BIN_WIDTH_MPS / 2;
}

function inRangeCount(items, lo, hi) {
  return items.filter((i) => i.value >= lo && i.value < hi).length;
}

export function shapeW1(views, ctx) {
  const items = [];
  for (const v of views) {
    if (!v.computable) continue;
    for (const s of v.foldedSteps) items.push({ value: s.metres / s.seconds, weight: s.seconds });
  }
  const value = valleyOf(items, ctx.lo, ctx.hi);
  const n = inRangeCount(items, ctx.lo, ctx.hi);
  return { value, n, excluded: items.length - n };
}

export function shapeW2(views, ctx) {
  const items = [];
  for (const v of views) {
    if (!v.computable) continue;
    for (const s of v.foldedSteps) items.push({ value: s.metres / s.seconds, weight: 1 });
  }
  const value = valleyOf(items, ctx.lo, ctx.hi);
  const n = inRangeCount(items, ctx.lo, ctx.hi);
  return { value, n, excluded: items.length - n };
}

export function strawmanW(views, ctx) {
  const items = [];
  for (const v of views) {
    if (!v.computable) continue;
    for (const j of v.J) items.push({ value: j.speedMps, weight: 1 });
  }
  const value = valleyOf(items, ctx.lo, ctx.hi);
  const n = inRangeCount(items, ctx.lo, ctx.hi);
  return { value, n, excluded: items.length - n };
}

// ---------------------------------------------------------------------------
// PREDECLARED_SHAPES / REJECTED_SHAPES — prose copied from 34-04-PLAN.md verbatim in spirit
// ---------------------------------------------------------------------------

const DEVICE_FAMILY_NOTE =
  'Why this is not device-family relabelling: cadence here only selects which covered PAIRS enter a ' +
  'calibration sample for one speed cut. It never labels a stream or device, never gates a stream ' +
  "into or out of D-10's recordingMechanismSignature, and never enters the shipped classifier, which " +
  'stays a pure function of t/d and reads only the derived constant. The D-10 rule and this population ' +
  'stay separate functions with separately-stated non-circularity arguments; the D-10 rule only ever ' +
  "gates the STOP-01 flag's own computability, never the PAUSE-01 band derivation (device-family " +
  'reasoning creeping in is exactly what this avoids, per Pitfall 5).';

export const PREDECLARED_SHAPES = Object.freeze({
  G: Object.freeze([
    Object.freeze({
      id: 'G1',
      name: 'cadence-silent covered pairs, pooled',
      fn: shapeG1,
      meaning:
        "90% of the odometer's advance rate while the athlete takes no steps sits at or below it. " +
        'Above that, something is moving.',
      nonCircularity:
        'Membership is decided by the cadence channel, which no detector, pause rule, classifier or ' +
        'band reads. Covered pairs exclude every J interval and pause by construction, so J cannot ' +
        `enter the population. ${DEVICE_FAMILY_NOTE}`,
      caveat:
        'Cadence is present on a subset of streams; a cadence of 0 can also be a sensor dropout while ' +
        'moving, which inflates the tail. The D-12 anchor gate exists to catch that.',
    }),
    Object.freeze({
      id: 'G2',
      name: 'cadence-silent covered pairs, per activity',
      fn: shapeG2,
      meaning:
        'Guards criterion (2): a few long cadence-silent activities cannot dominate the pooled G1 ' +
        'statistic.',
      nonCircularity: `As G1, including the device-family relabelling sentence. ${DEVICE_FAMILY_NOTE}`,
      caveat: 'Ranks below G1 on criterion (3) — a two-level statistic.',
    }),
    Object.freeze({
      id: 'G3',
      name: 'pause-boundary run-in',
      fn: shapeG3,
      meaning:
        'The speed of covered pairs immediately bracketing an established zero-advance pause interval.',
      nonCircularity:
        'The pause rule is a duration-only rule with no speed term, so it is independent of any band; ' +
        'no band or class enters it.',
      caveat:
        'Ranks last: the population mixes deceleration and acceleration pairs, so its upper tail is ' +
        'contaminated by construction — the median is used for that reason.',
    }),
  ]),
  M: Object.freeze([
    Object.freeze({
      id: 'M1',
      name: 'pause-rule scale, conservative',
      fn: shapeM1,
      meaning:
        "A creep standstill is recognised at the duration the archive's own zero-advance pause rule " +
        'recognises a standstill, for all but the sparsest-sampled tenth of activities. One duration ' +
        'definition for both D-09 sources.',
      nonCircularity:
        "P_a comes from each activity's full advance-interval distribution (thousands of intervals) " +
        'under the already-calibrated PAUSE_GAP_P90_MULTIPLIER. No creep stretch, band or class enters it.',
      caveat: 'Conservative — the p90 across activities.',
    }),
    Object.freeze({
      id: 'M2',
      name: 'pause-rule scale, typical',
      fn: shapeM2,
      meaning: 'The same population, at a typical (not conservative) scale.',
      nonCircularity: 'As M1.',
      caveat: 'Ranks second on criterion (2): typical, not conservative.',
    }),
  ]),
  W: Object.freeze([
    Object.freeze({
      id: 'W1',
      name: 'covered time by speed',
      fn: shapeW1,
      meaning: "The valley in the athlete's own covered-time speed distribution, time-weighted.",
      nonCircularity:
        "Covered steps exclude every J interval, pause and unreliable segment by construction (D-06: " +
        '"disjoint from what it judges"); the harness measures leakage directly.',
      caveat: 'Disclosed property: the value is quantised to 0.1 m/s.',
    }),
    Object.freeze({
      id: 'W2',
      name: 'covered steps by speed',
      fn: shapeW2,
      meaning: 'The same valley, count-weighted rather than time-weighted.',
      nonCircularity: 'As W1.',
      caveat:
        'Ranks second: sampling rate biases counts, since a 1 Hz stream contributes more steps per ' +
        'minute than a decimated one — a structurally different weighting, a genuine second opinion.',
    }),
  ]),
});

export const REJECTED_SHAPES = Object.freeze([
  'G (rejected on argument): a low percentile of ALL pooled covered speeds — that population overlaps ' +
    'the walking cluster W judges, the 33-08 failure shape.',
  'G (rejected on argument): HR-band stillness — HR stays elevated for minutes after a stop, so it ' +
    'cannot mark stillness onset.',
  'M (rejected on argument): run lengths of pre-pause creep — the same mixed population G3 discloses as ' +
    'contaminated.',
  "M (rejected on argument): any round-number duration, including the scoping probe's 30s and 120s, " +
    'which are references only and never a shape.',
  'W (rejected on argument): a per-activity valley percentile — most activities contain no walking ' +
    'hump, so the population would be selected by the property being measured.',
  'W (rejected on argument): a cadence-split anchor, which needs its own uncalibrated cadence constant.',
]);

