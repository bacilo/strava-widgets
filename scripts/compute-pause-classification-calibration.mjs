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
 * [AMENDED 2026-09-22 — D-19, plan 34-12.] Family G is re-declared (G4/G5, "standstill episodes")
 * per 34-12-PLAN.md's <predeclared_shapes_amendment>, and the D-13 PLANTED perturbation is now
 * proportional (`ceil(PLANT_FRACTION x the shape's own base items)`, uniform across G/M/W) rather
 * than a fixed `|J|` count — see `PLANT_FRACTION` and `plantShapes` below. HALT-1's vacuous planted
 * rows (`34-06-HALT-1.md`) are fixed here: every plant now enters its shape's own population
 * unconditionally.
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
import { execSync } from 'child_process';
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { advanceSteps } from '../dist/analytics/unreliable-segments.js';
import {
  advanceIntervals,
  classifyGapsWithSegments,
  PAUSE_GAP_P90_MULTIPLIER,
  quantile,
  RECORDING_GAP_ABS_THRESHOLD_SEC,
  UNRELIABLE_SPEED_LIMIT_MPS,
} from '../dist/analytics/pace-derivation.js';
import { validateStreamSeries } from '../dist/analytics/best-effort-utils.js';
import { isStreamFile, idFromFilename } from './lib/stream-files.mjs';
import { ceilToSignificant, selectShape } from './compute-unreliable-segment-severity-calibration.mjs';
import { parseControlFile } from './compute-walking-break-evidence.mjs';
// Namespace import (never named): STATIONARY_MAX_SPEED_MPS / FORGOTTEN_STOP_MIN_SEC /
// WALK_RUN_BOUNDARY_MPS do not exist on the shipped module until plan 34-06 ships them — a named
// import would be a link error on every run before that. This reads `undefined` instead and the
// artifact/decideOutcome state "not yet shipped".
import * as pc from '../dist/analytics/pause-classification.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const STREAMS_DIR = join(ROOT_DIR, 'data/streams');
const ACTIVITIES_DIR = join(ROOT_DIR, 'data/activities');
const CONTROL_FILE_PATH = join(
  ROOT_DIR,
  '.planning/phases/34-pause-classification-forgotten-stop/34-WALKING-BREAK-CONTROL.md'
);
const OUTPUT_PATH = join(
  ROOT_DIR,
  '.planning/phases/34-pause-classification-forgotten-stop/34-CALIBRATION.md'
);
const REGENERATE_COMMAND = 'npm run compute-pause-classification-calibration';

// ---------------------------------------------------------------------------
// Fixed constants — pre-declared before any measurement
// ---------------------------------------------------------------------------

/** D-13's tolerance, fixed before any check runs. */
export const INSENSITIVITY_TOLERANCE = 0.01;

/**
 * [D-19, plan 34-12] The PLANTED perturbation's fraction, ASSIGNED from the tolerance itself, never
 * a literal — a plant count of `ceil(PLANT_FRACTION x N)` asks exactly "does a leak equal to the
 * tolerance move the statistic by more than the tolerance?", no free number.
 */
export const PLANT_FRACTION = INSENSITIVITY_TOLERANCE;

/** The neighbourhood width, reused from the imported recording-gap threshold — never a literal 10. */
export const NEIGHBOURHOOD_SEC = RECORDING_GAP_ABS_THRESHOLD_SEC;

/** The W-family valley histogram's fixed bin width. */
export const VALLEY_BIN_WIDTH_MPS = 0.1;

/** The activity whose real J-interval shapes are cloned into the D-13 planting step, every family. */
export const INSENSITIVITY_SOURCE_ACTIVITY_ID = '3475724402';

/**
 * [D-20, plan 34-13] STATIONARY_MAX_SPEED_MPS is DEVELOPER-DECLARED, not calibrated. Two independent
 * Family G population designs (G1/G2/G3, `34-06-HALT-1.md`; G4/G5, `34-06-HALT-2.md`) were each
 * measured against the real archive and neither could clear D-13 — this archive's standstills accrue
 * essentially no distance, the finding STOP-02's own text anticipates ("otherwise drift is recorded
 * as a measured non-issue"). The value below is chosen on PHYSICAL grounds alone, argued in
 * `34-CONTEXT.md` D-20 (2026-09-22): far above the measured drift on this archive and far below the
 * slowest developer-confirmed walking control. It is NOT derived from any measured Phase 34 figure.
 * `DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT` is the ONE source-text literal this generator ships for
 * this constant; the module asserts its parsed numeric sibling round-trips back to the same text at
 * load. Family G still measures and renders G4/G5 (see `runFamily`'s `arbitrate: false` call below)
 * as evidence for the non-issue finding — it no longer arbitrates a cut. This constant is
 * developer-declared, never calibrated: no docblock, heading or summary line naming it may contain
 * the word "calibrated" except inside the phrase "not calibrated".
 */
export const DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT = '0.5';
export const DECLARED_STATIONARY_MAX_SPEED_MPS = Number(DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT);
assert(
  String(DECLARED_STATIONARY_MAX_SPEED_MPS) === DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT,
  `DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT ('${DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT}') does not ` +
    'round-trip through Number() parsing — the source text and its parsed numeric sibling have drifted.'
);
/** The provenance line's exact text, D-20. Never say "calibrated" of this constant anywhere else. */
export const STATIONARY_PROVENANCE_TEXT = 'developer-declared (D-20), not calibrated';

function sortAsc(values) {
  return [...values].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// [D-19, plan 34-12] STANDSTILL DEFINITIONS: chained standstill episodes (Family G's new
// population, G4/G5)
// ---------------------------------------------------------------------------

/**
 * Builds this activity's standstill episodes from BASE data only, never perturbed. A bridge is a
 * `CoveredRun` whose real-time span runs EXACTLY from one pause interval's `endSec` to the next
 * pause interval's `startSec` (sample-time equality, the same convention `intervalFromGapInterval`
 * uses), with `seconds < paSec`. A standstill episode is a maximal alternating chain of pause
 * intervals and bridges; anything else between two pauses (a recording gap, a merged/unreliable
 * segment, or a covered run of `paSec` or longer) breaks the chain. `chained` iff the episode's
 * chain has >= 2 pauses — a chained episode's `rateMps` is strictly > 0 by the bridge invariant
 * below, so G4/G5 can never produce a zero base from a real item. `paSec === null` (no advance
 * interval at all) disables bridging entirely — every pause becomes its own single-pause episode.
 */
function buildStandstillEpisodes(t, d, coveredRuns, pauseIntervals, paSec, activityId) {
  if (pauseIntervals.length === 0) return [];

  const sortedPauses = [...pauseIntervals].sort((a, b) => a.startSec - b.startSec);

  const runByBounds = new Map();
  for (const run of coveredRuns) {
    const startSec = t[run.startIndex];
    const endSec = t[run.endIndex];
    runByBounds.set(`${startSec}|${endSec}`, {
      seconds: endSec - startSec,
      metres: d[run.endIndex] - d[run.startIndex],
    });
  }

  function findBridge(prevEndSec, nextStartSec) {
    const candidate = runByBounds.get(`${prevEndSec}|${nextStartSec}`);
    if (!candidate) return null;
    if (paSec === null || !(candidate.seconds < paSec)) return null;
    // Bridge invariant (D-19): every bridge has metres > 0. Two distinct maximal zero-advance runs
    // must be separated by at least one advance, or they would be one run — a zero-metre bridge
    // means the views are wrong.
    assert(
      candidate.metres > 0,
      `buildStandstillEpisodes: activity ${activityId} has a zero-or-negative-metres bridge ` +
        `[${prevEndSec}, ${nextStartSec}] (seconds=${candidate.seconds}) — the bridge invariant is violated.`
    );
    return candidate;
  }

  function finalizeEpisode(pauses, metres) {
    const startSec = pauses[0].startSec;
    const endSec = pauses[pauses.length - 1].endSec;
    const seconds = endSec - startSec;
    const chained = pauses.length >= 2;
    return {
      startSec,
      endSec,
      seconds,
      metres,
      rateMps: seconds > 0 ? metres / seconds : 0,
      pauseCount: pauses.length,
      chained,
    };
  }

  const episodes = [];
  let chainPauses = [sortedPauses[0]];
  let chainMetres = 0;
  for (let i = 0; i < sortedPauses.length - 1; i++) {
    const p = sortedPauses[i];
    const pn = sortedPauses[i + 1];
    const bridge = findBridge(p.endSec, pn.startSec);
    if (bridge) {
      chainPauses.push(pn);
      chainMetres += bridge.metres;
    } else {
      episodes.push(finalizeEpisode(chainPauses, chainMetres));
      chainPauses = [pn];
      chainMetres = 0;
    }
  }
  episodes.push(finalizeEpisode(chainPauses, chainMetres));
  return episodes;
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
 * the imported `advanceIntervals(t, d)` as a sorted multiset. `plantedCreepDurations` starts empty —
 * it exists only so `plantShapes` can plant unconditionally into strawman M's own duration
 * population, which (unlike every other shape) is not itself a stored view array (D-19).
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

    // [D-19, plan 34-12] STANDSTILL DEFINITIONS: P_a (paSec) and the chained-episode chain over
    // this activity's own zero-advance pauses and bridges.
    const paSec = positionedSeconds.length === 0 ? null : PAUSE_GAP_P90_MULTIPLIER * quantile(positionedSeconds, 0.9);
    const standstillEpisodes = buildStandstillEpisodes(t, d, r.coveredRuns, pauseIntervals, paSec, activity.id);

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
      plantedCreepDurations: [],
      paSec,
      standstillEpisodes,
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
 * A creep candidate (REMOVED view, M family, and STRAWMAN M's own real-item population): a maximal
 * run of consecutive covered pairs (contiguous `index`) each with pair speed `<= floor`, of any
 * duration. `floor === null` (upstream G HALT) returns no candidates. Never includes planted items —
 * those are unconditional, in `plantedCreepDurations` (D-19).
 */
function creepCandidates(coveredPairs, floor) {
  if (floor === null || floor === undefined) return [];
  const sorted = [...coveredPairs].filter((p) => !p.planted).sort((a, b) => a.index - b.index);
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
      // [D-19, plan 34-12] REMOVED VIEW for G4/G5: drop every standstill episode whose span
      // [p1.startSec, pk.endSec] intersects the neighbourhood of any J interval of the same
      // activity. Episodes are built once from base data and never re-chained after removal.
      const keptEpisodes = view.standstillEpisodes.filter(
        (ep) => !intersectsAny(ep.startSec, ep.endSec, neighbourhoods)
      );
      removedCount += view.standstillEpisodes.length - keptEpisodes.length;
      if (keptEpisodes.length !== view.standstillEpisodes.length) changed = true;
      // J's own removed view (STRAWMAN G's population): every J item trivially intersects its own
      // padded neighbourhood, so this always empties J — the "unfalsifiable-fail" property.
      const keptJ = view.J.filter((j) => !intersectsAny(j.startSec, j.endSec, neighbourhoods));
      removedCount += view.J.length - keptJ.length;
      if (keptJ.length !== view.J.length) changed = true;
      if (changed) changedActivityCount++;
      return { ...view, standstillEpisodes: keptEpisodes, J: keptJ };
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
      // STRAWMAN M's own real-item population (creep-candidate durations) is recomputed from
      // coveredPairs — drop exactly the covered pairs that FORMED each candidate (a candidate's own
      // pairs trivially intersect its own padded neighbourhood), so recomputing candidates on the
      // kept pairs finds none there — the same trivial self-emptying property as G/W above.
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
 * [D-19, plan 34-12] PLANTED perturbation (D-13 harness): plants `count` clones of `sourceShapes`
 * ({ metres, seconds } of every J interval on 3475724402, cycled in order) round-robin into
 * `population.arrayKey` of every activity, sorted by id, that CONTRIBUTES AT LEAST ONE BASE ITEM to
 * that population per `population.baseItemCount` — a leak enters a population where it lives. Every
 * plant is `planted: true`, built by `population.buildItem`, and enters that population
 * UNCONDITIONALLY: no shape may filter it out by position, cadence or adjacency (this generalises
 * 34-04's "treated as cadence-silent (worst case)"). `count === 0` or zero member activities plants
 * nothing. Replaces 34-04's family-wide `plantShapes(views, sourceShapes)` (HALT-1's own defect:
 * plants at span `[0, seconds]` pushed only into coveredPairs/foldedSteps/positionedAdvanceIntervals,
 * so they never reached G3's window-filtered population or strawman G/W's J population — both
 * planted rows tested nothing).
 */
export function plantShapes(views, sourceShapes, { population, count } = {}) {
  if (!population || !count || sourceShapes.length === 0) {
    return { views, plantedCount: 0, sourceShapeCount: sourceShapes.length };
  }

  const memberIds = views
    .filter((v) => v.computable && population.baseItemCount(v) > 0)
    .map((v) => v.id)
    .sort();

  if (memberIds.length === 0) {
    return { views, plantedCount: 0, sourceShapeCount: sourceShapes.length };
  }

  const byId = new Map(
    views.map((v) => [
      v.id,
      v.computable ? { ...v, [population.arrayKey]: v[population.arrayKey].slice() } : v,
    ])
  );

  let plantedCount = 0;
  let cursor = 0;
  while (plantedCount < count) {
    const targetId = memberIds[cursor % memberIds.length];
    const template = sourceShapes[plantedCount % sourceShapes.length];
    const target = byId.get(targetId);
    const sentinel = -(plantedCount + 1);

    target[population.arrayKey].push(population.buildItem(template, sentinel));

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
 * sensitivity there is). Also threads through each call's `items` (the pre-qualification count in
 * the shape's plant unit, D-19) as `baseItems`/`plantedItems`.
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
    baseItems: baseResult.items ?? null,
    removed: removedValue,
    removedN: removedResult.n,
    planted: plantedValue,
    plantedN: plantedResult.n,
    plantedItems: plantedResult.items ?? null,
    removedDelta,
    plantedDelta,
    pass,
  };
}

// ---------------------------------------------------------------------------
// G family — [D-19, plan 34-12] re-declared: G4 "standstill episodes, pooled", then G5 "standstill
// episodes, per activity". G1/G2/G3 (cadence-silent covered pairs) are RETIRED, recorded in
// REJECTED_SHAPES below. Admits `planted: true` standstill episodes unconditionally — no positional
// filter exists on this population, so no special-casing is needed (unlike the retired G3).
// ---------------------------------------------------------------------------

function countChainedEpisodes(views) {
  let count = 0;
  for (const v of views) {
    if (!v.computable) continue;
    for (const ep of v.standstillEpisodes) if (ep.chained) count++;
  }
  return count;
}

export function shapeG4(views) {
  const rates = [];
  for (const v of views) {
    if (!v.computable) continue;
    for (const ep of v.standstillEpisodes) if (ep.chained) rates.push(ep.rateMps);
  }
  const sorted = sortAsc(rates);
  return { value: sorted.length === 0 ? null : quantile(sorted, 0.9), n: sorted.length, excluded: 0, items: sorted.length };
}

export function shapeG5(views) {
  const perActivity = [];
  let totalChainedEpisodes = 0;
  for (const v of views) {
    if (!v.computable) continue;
    let metres = 0;
    let seconds = 0;
    let count = 0;
    for (const ep of v.standstillEpisodes) {
      if (!ep.chained) continue;
      metres += ep.metres;
      seconds += ep.seconds;
      count++;
    }
    totalChainedEpisodes += count;
    if (count > 0 && seconds > 0) perActivity.push(metres / seconds);
  }
  const sorted = sortAsc(perActivity);
  return {
    value: sorted.length === 0 ? null : quantile(sorted, 0.9),
    n: sorted.length,
    excluded: 0,
    items: totalChainedEpisodes,
  };
}

export function strawmanG(views) {
  const speeds = [];
  for (const v of views) {
    if (!v.computable) continue;
    for (const j of v.J) speeds.push(j.speedMps);
  }
  const sorted = sortAsc(speeds);
  return { value: sorted.length === 0 ? null : quantile(sorted, 0.9), n: sorted.length, excluded: 0, items: sorted.length };
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

function countAdvanceIntervals(views) {
  let count = 0;
  for (const v of views) {
    if (!v.computable) continue;
    count += v.positionedAdvanceIntervals.length;
  }
  return count;
}

export function shapeM1(views) {
  const { sorted, excluded } = pooledPa(views);
  return { value: sorted.length === 0 ? null : quantile(sorted, 0.9), n: sorted.length, excluded, items: countAdvanceIntervals(views) };
}

export function shapeM2(views) {
  const { sorted, excluded } = pooledPa(views);
  return { value: sorted.length === 0 ? null : quantile(sorted, 0.5), n: sorted.length, excluded, items: countAdvanceIntervals(views) };
}

export function strawmanM(views, ctx) {
  const floor = ctx && ctx.shippedFloor;
  const durations = [];
  let baseItemCount = 0;
  for (const v of views) {
    if (!v.computable) continue;
    const candidates = creepCandidates(v.coveredPairs, floor);
    baseItemCount += candidates.length;
    for (const c of candidates) durations.push(c.seconds);
    // Plants (D-19) enter via `plantedCreepDurations`, unconditionally — never filtered by the
    // `speedMps <= floor` creep-candidate rule.
    for (const p of v.plantedCreepDurations ?? []) durations.push(p.seconds);
  }
  const sorted = sortAsc(durations);
  return {
    value: sorted.length === 0 ? null : quantile(sorted, 0.9),
    n: sorted.length,
    excluded: 0,
    items: baseItemCount + views.reduce((sum, v) => sum + (v.computable ? (v.plantedCreepDurations ?? []).length : 0), 0),
  };
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
  let totalSteps = 0;
  for (const v of views) {
    if (!v.computable) continue;
    totalSteps += v.foldedSteps.length;
    for (const s of v.foldedSteps) items.push({ value: s.metres / s.seconds, weight: s.seconds });
  }
  const value = valleyOf(items, ctx.lo, ctx.hi);
  const n = inRangeCount(items, ctx.lo, ctx.hi);
  return { value, n, excluded: items.length - n, items: totalSteps };
}

export function shapeW2(views, ctx) {
  const items = [];
  let totalSteps = 0;
  for (const v of views) {
    if (!v.computable) continue;
    totalSteps += v.foldedSteps.length;
    for (const s of v.foldedSteps) items.push({ value: s.metres / s.seconds, weight: 1 });
  }
  const value = valleyOf(items, ctx.lo, ctx.hi);
  const n = inRangeCount(items, ctx.lo, ctx.hi);
  return { value, n, excluded: items.length - n, items: totalSteps };
}

export function strawmanW(views, ctx) {
  const items = [];
  let totalJ = 0;
  for (const v of views) {
    if (!v.computable) continue;
    totalJ += v.J.length;
    for (const j of v.J) items.push({ value: j.speedMps, weight: 1 });
  }
  const value = valleyOf(items, ctx.lo, ctx.hi);
  const n = inRangeCount(items, ctx.lo, ctx.hi);
  return { value, n, excluded: items.length - n, items: totalJ };
}

// ---------------------------------------------------------------------------
// PLANT populations — where each shape's plants live (D-19)
// ---------------------------------------------------------------------------

const G4_G5_POPULATION = Object.freeze({
  arrayKey: 'standstillEpisodes',
  baseItemCount: (v) => v.standstillEpisodes.filter((ep) => ep.chained).length,
  buildItem: (template, sentinel) => ({
    startSec: 0,
    endSec: template.seconds,
    seconds: template.seconds,
    metres: template.metres,
    rateMps: template.metres / template.seconds,
    pauseCount: 2,
    chained: true,
    planted: true,
    sentinel,
  }),
});

const M_POPULATION = Object.freeze({
  arrayKey: 'positionedAdvanceIntervals',
  baseItemCount: (v) => v.positionedAdvanceIntervals.length,
  buildItem: (template, sentinel) => ({
    seconds: template.seconds,
    startSec: 0,
    endSec: template.seconds,
    planted: true,
    sentinel,
  }),
});

const W_POPULATION = Object.freeze({
  arrayKey: 'foldedSteps',
  baseItemCount: (v) => v.foldedSteps.length,
  buildItem: (template, sentinel) => ({
    startIndex: sentinel,
    endIndex: sentinel,
    startSec: 0,
    endSec: template.seconds,
    metres: template.metres,
    seconds: template.seconds,
    planted: true,
  }),
});

const J_POPULATION = Object.freeze({
  arrayKey: 'J',
  baseItemCount: (v) => v.J.length,
  buildItem: (template, sentinel) => ({
    source: 'planted',
    startSec: 0,
    endSec: template.seconds,
    seconds: template.seconds,
    metres: template.metres,
    speedMps: template.metres / template.seconds,
    planted: true,
    sentinel,
  }),
});

function creepDurationPopulation(shippedFloor) {
  return Object.freeze({
    arrayKey: 'plantedCreepDurations',
    baseItemCount: (v) => creepCandidates(v.coveredPairs, shippedFloor).length,
    buildItem: (template, sentinel) => ({ seconds: template.seconds, planted: true, sentinel }),
  });
}

// ---------------------------------------------------------------------------
// PREDECLARED_SHAPES / REJECTED_SHAPES — prose copied from 34-04-PLAN.md verbatim in spirit
// ---------------------------------------------------------------------------

/**
 * [D-19, plan 34-12] G4/G5's shared non-circularity argument (STANDSTILL DEFINITIONS, G FAMILY in
 * 34-12-PLAN.md's <predeclared_shapes_amendment>): membership comes only from the pause rule
 * (duration-only, no speed term) and covered-run adjacency, never a band, class or speed. Includes
 * the half-bridge-speed structural bound and the explicit "not G3 with the neighbourhood removed"
 * disclaimer (D-19's own overlap-with-G3 caveat).
 */
const G4_G5_NON_CIRCULARITY =
  'Membership comes only from the pause rule (Phase 26, duration-only, no speed term) and ' +
  'covered-run adjacency. Neither reads a band, a class or a speed. No J interval can lie inside an ' +
  'episode, because a bridge is a covered run and any gap-bearing interval between two pauses ' +
  'breaks the chain. The band judges J (never pause intervals, D-01) and, through STOP-01, ' +
  'individual covered pairs. The statistic is an aggregate over whole standstills including their ' +
  'zero-advance time, never a percentile of judged items. The unchanged REMOVED view measures what ' +
  'leakage remains. By the structural bound, an episode\'s rate is strictly less than half the ' +
  "fastest speed of its bridges (each pause lasts more than P_a and each bridge less than P_a, so " +
  "bridges occupy strictly less than half of any episode's seconds). Overlap with the retired G3: " +
  "bridges can lie inside G3's old pause-boundary windows whenever they are shorter than the " +
  'neighbourhood width, so the two populations share covered pairs — but this population is ' +
  'not "G3 with the neighbourhood removed": it pre-excludes nothing near J (its REMOVED row is ' +
  'live), its statistic is a whole-standstill aggregate including zero-advance time (not a pair ' +
  "median), and a single stop's run-in/run-out pairs never enter (only covered runs sandwiched " +
  'between two pauses qualify).';

const G4_G5_CAVEAT =
  'Sees light drift only (heavier drift forms no pause, so it is invisible here — conservative for ' +
  'walking breaks, forgotten stops with dense drift may be under-detected). Aggregate versus pair: ' +
  "a single drift tick's pair speed exceeds an episode's average, so ticks can split creep runs (same " +
  'under-detection direction, disclosed and not corrected). Conditional on drift: a single-pause ' +
  'standstill accrues 0 by construction and is excluded — including it would risk a zero base. Small ' +
  "population: at most half the archive's pause intervals (pauses often adjoin recording gaps).";

export const PREDECLARED_SHAPES = Object.freeze({
  G: Object.freeze([
    Object.freeze({
      id: 'G4',
      name: 'standstill episodes, pooled',
      fn: shapeG4,
      population: G4_G5_POPULATION,
      meaning:
        "90% of the archive's established standstills in which the odometer drifted at all accrued " +
        'drift at or below this rate. Above it the odometer is advancing faster than all but the top ' +
        'tenth of real standstills, so something is moving.',
      nonCircularity: G4_G5_NON_CIRCULARITY,
      caveat: G4_G5_CAVEAT,
    }),
    Object.freeze({
      id: 'G5',
      name: 'standstill episodes, per activity',
      fn: shapeG5,
      population: G4_G5_POPULATION,
      meaning:
        "The same ceiling, with each activity voting once (total chained-episode metres / total " +
        "chained-episode seconds, R-7 p90 across activities), so an activity with many stops cannot " +
        "dominate G4's pooled statistic. Each planted item lifts exactly one host activity's ratio.",
      nonCircularity: G4_G5_NON_CIRCULARITY,
      caveat: `${G4_G5_CAVEAT} Ranks below G4 on criterion (2), being a two-level statistic.`,
    }),
  ]),
  M: Object.freeze([
    Object.freeze({
      id: 'M1',
      name: 'pause-rule scale, conservative',
      fn: shapeM1,
      population: M_POPULATION,
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
      population: M_POPULATION,
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
      population: W_POPULATION,
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
      population: W_POPULATION,
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
  // [D-19, plan 34-12] appended after HALT-1 (34-06-HALT-1.md), 34-12-PLAN.md's REJECTED ON ARGUMENT:
  'G (rejected on argument, D-19): (c) pause-interval interiors alone — zero-advance by definition, so ' +
    'the rate is exactly 0: a degenerate population and a zero base.',
  'G (rejected on argument, D-19): (d) G3\'s population restricted to pairs outside every J ' +
    'neighbourhood — it makes the REMOVED axis vacuous by construction, and a measured HALT-1 view of ' +
    'nearly that population already exists, so declaring it would be choosing by outcome.',
  'G (rejected on argument, D-19): (e) pre-start / post-finish stationary tails — no speed-free rule ' +
    'tells a stationary tail from a start or finish effort except the pause rule itself, which reduces ' +
    'to G4.',
  'G (rejected on argument, D-19): (f) chained plus single-pause standstills together — a single-pause ' +
    'standstill accrues 0 by construction and is excluded (see G4/G5 caveats).',
  'G (rejected on argument, D-19): (g) pair speeds of drift ticks inside bridges — a tick\'s pair speed ' +
    'is one sample\'s odometer jump, not a drift rate over standing time; wrong unit for a boundary that ' +
    'judges interval aggregates.',
  'RETIRED (D-19, not argued, recorded in 34-06-HALT-1.md): G1 (cadence-silent covered pairs, pooled), ' +
    'G2 (cadence-silent covered pairs, per activity), G3 (pause-boundary run-in). All three measured ' +
    'walking/jogging speeds, not stationary-drift speeds, and failed D-13 insensitivity on the real ' +
    'archive.',
]);

const STRAWMEN = Object.freeze({
  G: Object.freeze({ fn: strawmanG, population: J_POPULATION }),
  M: Object.freeze({ fn: strawmanM, population: (ctx) => creepDurationPopulation(ctx && ctx.shippedFloor) }),
  W: Object.freeze({ fn: strawmanW, population: J_POPULATION }),
});

// ---------------------------------------------------------------------------
// Arbitration
// ---------------------------------------------------------------------------

/**
 * Evaluates one family's strawman (first) then every pre-declared shape in fixed order. When
 * `upstream.arbitrate` is NOT false (default `true`), selects the first PASS via `selectShape`, fed
 * ONLY `{ id, pass }` rows — nothing else can reach it. [D-20, plan 34-13] `arbitrate: false` (used
 * for Family G only, see `runCalibration`) evaluates every row exactly the same way but never calls
 * `selectShape` at all — `selectedId`/`chosen` stay `null` and `arbitrated: false` is returned, so
 * the rows exist purely as EVIDENCE, never as a candidate that could select or influence a constant.
 * `upstream.shippedFloor` is the shipped G value (required for M/W; unused for G itself).
 * `upstream.sourceShapes` (D-19) is 3475724402's own J-interval `{ metres, seconds }` shapes — the
 * SAME source list every family/shape reads, cycled in order, cloned proportionally to EACH shape's
 * own base item count (`ceil(PLANT_FRACTION x items)`) — never a single family-wide plant.
 */
export function runFamily(familyId, views, upstream = {}) {
  const shippedFloor = upstream.shippedFloor ?? null;
  const sourceShapes = upstream.sourceShapes ?? [];
  const arbitrate = upstream.arbitrate !== false;
  const removedResult = removeNeighbourhoods(views, familyId, shippedFloor);
  const ctx =
    familyId === 'M'
      ? { shippedFloor }
      : familyId === 'W'
        ? { lo: shippedFloor, hi: UNRELIABLE_SPEED_LIMIT_MPS }
        : undefined;

  function evalEntry(id, fn, populationSpec, extra) {
    const population = typeof populationSpec === 'function' ? populationSpec(ctx) : populationSpec;
    const baseResult = fn(views, ctx);
    const plantCount = Math.ceil(PLANT_FRACTION * (baseResult.items ?? 0));
    const plantResult = plantShapes(views, sourceShapes, { population, count: plantCount });
    const viewSets = { base: views, removed: removedResult.views, planted: plantResult.views };
    const evaluated = evaluateShape(fn, viewSets, { tolerance: INSENSITIVITY_TOLERANCE, ctx });
    return { id, plantCount, ...extra, ...evaluated };
  }

  const strawmanSpec = STRAWMEN[familyId];
  const strawman = evalEntry(`strawman ${familyId}`, strawmanSpec.fn, strawmanSpec.population, {});

  const rows = PREDECLARED_SHAPES[familyId].map((shape) =>
    evalEntry(shape.id, shape.fn, shape.population, {
      name: shape.name,
      meaning: shape.meaning,
      nonCircularity: shape.nonCircularity,
      caveat: shape.caveat,
    })
  );

  // [D-20, plan 34-13] Not arbitrated (Family G only): selectShape is never called, so no row can
  // select or influence a constant — the rows above exist purely as evidence.
  const selectedId = arbitrate ? selectShape(rows.map((r) => ({ id: r.id, pass: r.pass }))) : null;
  const chosen = selectedId === null ? null : rows.find((r) => r.id === selectedId);

  return {
    familyId,
    arbitrated: arbitrate,
    strawman,
    rows,
    selectedId,
    chosen,
    nonVacuity: {
      removedCount: removedResult.removedCount,
      removedChangedActivityCount: removedResult.changedActivityCount,
    },
  };
}

// ---------------------------------------------------------------------------
// D-10 blind-spot rule verification
// ---------------------------------------------------------------------------

const D10_NAMED_ANCHORS = Object.freeze([
  { id: '3475740390', expected: true },
  { id: '3475724402', expected: false },
  { id: '3475734189', expected: false },
  { id: '4556693525', expected: false },
]);
const D10_MARGIN = 0.02;

/**
 * Verifies D-10's pre-declared `recordingMechanismSignature` constants against named anchors (the
 * imported `pc.recordingMechanismSignature` — never re-derived here) and against an empty margin
 * around the ratio cut in the archive's own distribution. Failure is a HALT, never a retune.
 */
export function d10Section(views) {
  const signatures = views
    .filter((v) => v.computable)
    .map((v) => ({ id: v.id, sig: pc.recordingMechanismSignature(v.t, v.d) }));

  const anchorRows = D10_NAMED_ANCHORS.map(({ id, expected }) => {
    const found = signatures.find((s) => s.id === id);
    const actual = found && found.sig.computable ? found.sig.distanceTriggered : null;
    return { id, expected, actual, pass: actual === expected };
  });
  const anchorsPass = anchorRows.every((r) => r.pass);

  const inCvBand = signatures.filter((s) => s.sig.computable && s.sig.cvDd < pc.DISTANCE_TRIGGERED_MAX_CV_DD);
  const lo = pc.DISTANCE_TRIGGERED_MAX_CV_RATIO - D10_MARGIN;
  const hi = pc.DISTANCE_TRIGGERED_MAX_CV_RATIO + D10_MARGIN;
  const inMargin = inCvBand.filter((s) => s.sig.ratio >= lo && s.sig.ratio <= hi);

  let nearestBelow = null;
  let nearestAbove = null;
  for (const s of inCvBand) {
    if (s.sig.ratio < lo && (nearestBelow === null || s.sig.ratio > nearestBelow.sig.ratio)) nearestBelow = s;
    if (s.sig.ratio > hi && (nearestAbove === null || s.sig.ratio < nearestAbove.sig.ratio)) nearestAbove = s;
  }
  const marginClear = inMargin.length === 0;

  const distanceTriggeredCount = signatures.filter((s) => s.sig.computable && s.sig.distanceTriggered).length;
  const insufficientCount = signatures.filter((s) => !s.sig.computable).length;
  const computableCount = signatures.filter((s) => s.sig.computable).length;

  const pass = anchorsPass && marginClear;
  return {
    anchorRows,
    anchorsPass,
    marginClear,
    nearestBelow,
    nearestAbove,
    distanceTriggeredCount,
    insufficientCount,
    computableCount,
    summary: `anchors ${anchorsPass ? 'pass' : 'FAIL'}, margin ${marginClear ? 'clear' : 'VIOLATED'}`,
    pass,
  };
}

// ---------------------------------------------------------------------------
// Drift and join sections
// ---------------------------------------------------------------------------

/**
 * [D-20, plan 34-13] DRIFT MEASUREMENT — a MEASURED NON-ISSUE finding, rendered UNCONDITIONALLY,
 * independent of whether Family G "clears" (it no longer arbitrates at all, D-20). Computed over the
 * BASE standstill episodes only: episodes total, chained count, single-pause count, chained share,
 * total standstill seconds, total chained-episode metres, plus G4's and G5's own measured base
 * values (the same functions Family G's evidence rows use) — kept as the evidence for the
 * disposition, never as a selection input. [D-19, plan 34-12] replaced 34-04's G1-population
 * version; this replaces D-19's own `shippedG`-gated "drift matters" branch.
 */
export function driftSection(views) {
  let episodesTotal = 0;
  let chainedCount = 0;
  let singlePauseCount = 0;
  let totalStandstillSeconds = 0;
  let totalChainedMetres = 0;

  for (const v of views) {
    if (!v.computable) continue;
    for (const ep of v.standstillEpisodes) {
      episodesTotal++;
      totalStandstillSeconds += ep.seconds;
      if (ep.chained) {
        chainedCount++;
        totalChainedMetres += ep.metres;
      } else {
        singlePauseCount++;
      }
    }
  }

  return {
    episodesTotal,
    chainedCount,
    singlePauseCount,
    chainedShare: episodesTotal > 0 ? chainedCount / episodesTotal : null,
    totalStandstillSeconds,
    totalChainedMetres,
    g4Base: shapeG4(views).value,
    g5Base: shapeG5(views).value,
  };
}

/** JOIN gate's own facts: the archive-wide summed `joinViolations` from `collectPauseIntervals`. */
export function joinSection(views) {
  const total = views.reduce((sum, v) => sum + (v.computable ? v.joinViolations : 0), 0);
  return { total, pass: total === 0 };
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

function buildIndexByTime(t) {
  const map = new Map();
  for (let i = 0; i < t.length; i++) map.set(t[i], i);
  return map;
}

function windowAggregateSpeed(view, startSec, endSec) {
  const index = buildIndexByTime(view.t);
  const startIdx = index.get(startSec);
  const endIdx = index.get(endSec);
  if (startIdx === undefined || endIdx === undefined) return null;
  const seconds = endSec - startSec;
  if (!(seconds > 0)) return null;
  return { metres: view.d[endIdx] - view.d[startIdx], seconds };
}

function restOfActivityCoveredSpeed(view, startSec, endSec) {
  let metres = 0;
  let seconds = 0;
  for (const p of view.coveredPairs) {
    const inWindow = p.startSec < endSec && p.endSec > startSec;
    if (inWindow) continue;
    metres += p.metres;
    seconds += p.seconds;
  }
  if (!(seconds > 0)) return null;
  return metres / seconds;
}

/**
 * POST-SELECTION GATES, run on the shipped, rounded values only: ORDER, D-12 ANCHOR (i)/(ii)/(iii)
 * (parsed via the FIRST `CONFIRMED_CONTROL` in `controlText`), D-10 RULE, JOIN. ANY failure is a
 * HALT — there is no fallback to a later shape.
 */
export function applyGates(views, shipped, controlText) {
  const gates = [];

  const orderPass =
    shipped.STATIONARY_MAX_SPEED_MPS !== null &&
    shipped.WALK_RUN_BOUNDARY_MPS !== null &&
    0 <= shipped.STATIONARY_MAX_SPEED_MPS &&
    shipped.STATIONARY_MAX_SPEED_MPS < shipped.WALK_RUN_BOUNDARY_MPS &&
    shipped.WALK_RUN_BOUNDARY_MPS < UNRELIABLE_SPEED_LIMIT_MPS;
  gates.push({
    id: 'order',
    measured: `${shipped.STATIONARY_MAX_SPEED_MPS} < ${shipped.WALK_RUN_BOUNDARY_MPS} < ${UNRELIABLE_SPEED_LIMIT_MPS}`,
    bound: '0 <= STATIONARY_MAX_SPEED_MPS < WALK_RUN_BOUNDARY_MPS < UNRELIABLE_SPEED_LIMIT_MPS',
    pass: orderPass,
  });

  let controls = [];
  try {
    controls = controlText ? parseControlFile(controlText) : [];
  } catch {
    controls = [];
  }

  if (controls.length === 0) {
    const reason = 'no developer-confirmed control';
    gates.push({ id: 'd12-anchor-i', measured: null, bound: 'walked', pass: false, reason });
    gates.push({ id: 'd12-anchor-ii', measured: null, bound: '> WALK_RUN_BOUNDARY_MPS', pass: false, reason });
    gates.push({
      id: 'd12-anchor-iii',
      measured: null,
      bound: 'no creep intersecting window',
      pass: false,
      reason,
    });
  } else {
    const control = controls[0];
    const view = views.find((v) => v.id === control.id);
    if (!view || !view.computable) {
      const reason = `control activity ${control.id} not found or not computable`;
      gates.push({ id: 'd12-anchor-i', measured: null, bound: 'walked', pass: false, reason });
      gates.push({ id: 'd12-anchor-ii', measured: null, bound: '> WALK_RUN_BOUNDARY_MPS', pass: false, reason });
      gates.push({
        id: 'd12-anchor-iii',
        measured: null,
        bound: 'no creep intersecting window',
        pass: false,
        reason,
      });
    } else {
      const bands = { stationaryMaxMps: shipped.STATIONARY_MAX_SPEED_MPS, walkRunMps: shipped.WALK_RUN_BOUNDARY_MPS };
      const window = windowAggregateSpeed(view, control.startSec, control.endSec);
      const windowClass = window === null ? null : pc.classifyPauseSpeed(window.metres, window.seconds, bands);
      gates.push({ id: 'd12-anchor-i', measured: windowClass, bound: 'walked', pass: windowClass === 'walked' });

      const restSpeed = restOfActivityCoveredSpeed(view, control.startSec, control.endSec);
      const iiPass = restSpeed !== null && restSpeed > shipped.WALK_RUN_BOUNDARY_MPS;
      gates.push({
        id: 'd12-anchor-ii',
        measured: restSpeed,
        bound: `> ${shipped.WALK_RUN_BOUNDARY_MPS}`,
        pass: iiPass,
      });

      const stopParams = { stationaryMaxMps: shipped.STATIONARY_MAX_SPEED_MPS, minSec: shipped.FORGOTTEN_STOP_MIN_SEC };
      const stopResult = pc.classifyForgottenStop(view.t, view.d, view.coverage, view.coveredRuns, stopParams);
      let iiiPass = false;
      let iiiMeasured = 'not computable';
      if (stopResult.computable) {
        const intersects = stopResult.creep.some((c) => c.startSec < control.endSec && c.endSec > control.startSec);
        iiiPass = !intersects;
        iiiMeasured = intersects ? 'creep intersects window' : 'no creep intersects window';
      }
      gates.push({
        id: 'd12-anchor-iii',
        measured: iiiMeasured,
        bound: 'no creep intersecting window',
        pass: iiiPass,
      });
    }
  }

  const d10 = d10Section(views);
  gates.push({ id: 'd10-rule', measured: d10.summary, bound: 'anchors match; margin clear', pass: d10.pass });

  const totalJoinViolations = views.reduce((sum, v) => sum + (v.computable ? v.joinViolations : 0), 0);
  gates.push({ id: 'join', measured: totalJoinViolations, bound: 0, pass: totalJoinViolations === 0 });

  // [D-20, plan 34-13] BASIS gate: the declared stationary constant must exceed the measured drift
  // statistic (G4's base) whenever that base is non-null. A null base (no chained standstill
  // anywhere) means nothing accrued — PASSES with a stated reason, since there is no basis to
  // exceed. A failure HALTs for a developer revisit of D-20 — it is NEVER retuned or widened.
  const g4Base = shapeG4(views).value;
  const basisPass =
    g4Base === null ||
    (shipped.STATIONARY_MAX_SPEED_MPS !== null &&
      shipped.STATIONARY_MAX_SPEED_MPS !== undefined &&
      shipped.STATIONARY_MAX_SPEED_MPS > g4Base);
  gates.push({
    id: 'd20-basis',
    measured: g4Base,
    bound: `< STATIONARY_MAX_SPEED_MPS (${shipped.STATIONARY_MAX_SPEED_MPS})`,
    pass: basisPass,
    reason: g4Base === null ? 'no chained standstill means nothing accrued' : undefined,
  });

  const pass = gates.every((g) => g.pass);
  return { gates, pass };
}

// ---------------------------------------------------------------------------
// Per-interval class table and archive-wide findings
// ---------------------------------------------------------------------------

/**
 * D-18's per-interval class table for 3475724402, computed via the imported `pc.classifyPauses`
 * (never re-implemented) at the shipped-rounded bands. Rendered whenever all three families cleared,
 * even if a gate failed.
 */
export function perIntervalTable(views, shippedBands) {
  const view = views.find((v) => v.id === '3475724402');
  if (!view || !view.computable) return { rows: [], found: false };

  const result = pc.classifyPauses(view.t, view.d, view.coverage, view.segments, shippedBands);
  const rows = result.intervals
    .map((iv, idx) => ({
      index: idx + 1,
      source: iv.source,
      startSec: iv.startSec,
      endSec: iv.endSec,
      seconds: iv.seconds,
      metres: iv.metres,
      speedMps: iv.metres / iv.seconds,
      pauseClass: iv.pauseClass,
    }))
    .sort((a, b) => a.startSec - b.startSec)
    .map((row, idx) => ({ ...row, index: idx + 1 }));

  return { rows, found: true };
}

/**
 * Archive-wide class distribution and forgotten-stop counts, rendered strictly AFTER selection
 * (D-08 anti-quota) and never consulted by any selection function.
 */
export function archiveFindings(views, shippedBands, shippedStop) {
  const classCounts = { stationary: 0, walked: 0, 'ran-through': 0, transported: 0 };
  const activitySets = {
    stationary: new Set(),
    walked: new Set(),
    'ran-through': new Set(),
    transported: new Set(),
  };
  let notClassifiableTotal = 0;
  let stopComputableCount = 0;
  let stopNotComputableCount = 0;
  const stopNotComputableReasons = {};
  let creepActivityCount = 0;
  let creepIntervalCount = 0;
  let pauseActivityCount = 0;
  let pauseIntervalCount = 0;

  for (const v of views) {
    if (!v.computable) continue;

    const result = pc.classifyPauses(v.t, v.d, v.coverage, v.segments, shippedBands);
    notClassifiableTotal += result.notClassifiableCount;
    for (const iv of result.intervals) {
      classCounts[iv.pauseClass]++;
      activitySets[iv.pauseClass].add(v.id);
    }

    const stopResult = pc.classifyForgottenStop(v.t, v.d, v.coverage, v.coveredRuns, shippedStop);
    if (!stopResult.computable) {
      stopNotComputableCount++;
      stopNotComputableReasons[stopResult.reason] = (stopNotComputableReasons[stopResult.reason] ?? 0) + 1;
    } else {
      stopComputableCount++;
      if (stopResult.creep.length > 0) {
        creepActivityCount++;
        creepIntervalCount += stopResult.creep.length;
      }
      if (stopResult.pauses.length > 0) {
        pauseActivityCount++;
        pauseIntervalCount += stopResult.pauses.length;
      }
    }
  }

  return {
    classCounts,
    activityCounts: Object.fromEntries(Object.entries(activitySets).map(([k, s]) => [k, s.size])),
    notClassifiableTotal,
    stopComputableCount,
    stopNotComputableCount,
    stopNotComputableReasons,
    creepActivityCount,
    creepIntervalCount,
    pauseActivityCount,
    pauseIntervalCount,
  };
}

// ---------------------------------------------------------------------------
// Top-level orchestration: runCalibration / decideOutcome
// ---------------------------------------------------------------------------

function jShapesForActivity(views, id) {
  const view = views.find((v) => v.id === id);
  if (!view || !view.computable) return [];
  return view.J.map((iv) => ({ metres: iv.metres, seconds: iv.seconds }));
}

/**
 * [D-20, plan 34-13] M and W are gated on the declared stationary constant being PRESENT and
 * FINITE — they run on the declared floor, never on a null floor. Module load always provides a
 * real, finite `DECLARED_STATIONARY_MAX_SPEED_MPS`; this pure function is exported so the gate
 * itself can be exercised directly with an injected non-finite/absent value in tests, without
 * mutating module state.
 */
export function mwFloorFromDeclared(declaredValue) {
  return Number.isFinite(declaredValue) ? declaredValue : null;
}

/**
 * Runs the whole pipeline (pure — no I/O beyond what `archive`/`controlText` already carry): builds
 * base views once, then runs G, M, W. [D-20, plan 34-13] Family G is evidence-only (`arbitrate:
 * false`) — it always measures and renders G4/G5/strawman G, but never selects a constant. The
 * shipped stationary constant is the DEVELOPER-DECLARED value (never `ceilToSignificant` on a G
 * row); M and W run on that declared floor, gated on it being present and finite
 * (`mwFloorFromDeclared`), and keep their own D-06/D-08/D-13 arbitration, shapes, tolerance,
 * strawmen and HALT branch exactly as pre-declared, unchanged. [D-19, plan 34-12] The D-13 PLANTED
 * perturbation is per-shape (built inside `runFamily`, proportional to each shape's own base items),
 * never a single family-wide plant built once here.
 */
export function runCalibration(archive, controlText) {
  const baseViews = buildBaseViews(archive);
  const sourceShapes = jShapesForActivity(baseViews, INSENSITIVITY_SOURCE_ACTIVITY_ID);

  // [D-20, plan 34-13] Family G no longer arbitrates — it is evaluated purely as evidence for the
  // drift-while-stationary finding (see `driftSection`/`renderDrift`).
  const gFamily = runFamily('G', baseViews, { sourceShapes, arbitrate: false });
  const shippedG = mwFloorFromDeclared(DECLARED_STATIONARY_MAX_SPEED_MPS);
  const gPresent = shippedG !== null;

  let mFamily = null;
  let shippedM = null;
  let mHalted = true;
  let wFamily = null;
  let shippedW = null;
  let wHalted = true;

  if (gPresent) {
    mFamily = runFamily('M', baseViews, { sourceShapes, shippedFloor: shippedG });
    mHalted = mFamily.chosen === null;
    shippedM = mHalted ? null : Math.ceil(mFamily.chosen.base);

    wFamily = runFamily('W', baseViews, { sourceShapes, shippedFloor: shippedG });
    wHalted = wFamily.chosen === null;
    shippedW = wHalted ? null : ceilToSignificant(wFamily.chosen.base, 3);
  }

  const allCleared = gPresent && !mHalted && !wHalted;
  const shipped = {
    STATIONARY_MAX_SPEED_MPS: shippedG,
    FORGOTTEN_STOP_MIN_SEC: shippedM,
    WALK_RUN_BOUNDARY_MPS: shippedW,
  };

  const d10 = d10Section(baseViews);
  const join = joinSection(baseViews);
  // [D-19, plan 34-12] Always computed from BASE standstill episodes, whether or not G cleared.
  const drift = driftSection(baseViews);

  let gates = null;
  let perIntervalTableResult = null;
  let archiveFindingsResult = null;

  if (allCleared) {
    gates = applyGates(baseViews, shipped, controlText);
    perIntervalTableResult = perIntervalTable(baseViews, {
      stationaryMaxMps: shippedG,
      walkRunMps: shippedW,
    });
    archiveFindingsResult = archiveFindings(
      baseViews,
      { stationaryMaxMps: shippedG, walkRunMps: shippedW },
      { stationaryMaxMps: shippedG, minSec: shippedM }
    );
  }

  return {
    archive,
    baseViews,
    sourceShapes,
    families: { G: gFamily, M: mFamily, W: wFamily },
    shipped,
    allCleared,
    gates,
    d10,
    join,
    drift,
    perIntervalTable: perIntervalTableResult,
    archiveFindings: archiveFindingsResult,
    controlText,
  };
}

/**
 * The exit-code contract: 0 only when M and W both cleared, every gate passed, and each shipped
 * production constant (`shippedProduction`, keyed by name — `undefined` values are ignored, never
 * treated as a mismatch) equals its derived rounded value — including the declared stationary
 * constant; 1 on any NO SHAPE CLEARS, a failed gate, or [D-20, plan 34-13] a PASSING strawman G
 * (the non-issue evidence rests on the harness being able to tell a circular population apart from a
 * real one — a passing strawman means it cannot, regardless of Family G no longer arbitrating); 2
 * when a shipped constant is present and differs.
 */
export function decideOutcome(result, shippedProduction = {}) {
  if (result.families && result.families.G && result.families.G.strawman.pass) {
    return { exitCode: 1, reason: 'strawman-g-passed' };
  }
  if (!result.allCleared) {
    return { exitCode: 1, reason: 'no-shape-clears' };
  }
  if (!result.gates || !result.gates.pass) {
    return { exitCode: 1, reason: 'gate-failed' };
  }

  const keys = ['STATIONARY_MAX_SPEED_MPS', 'FORGOTTEN_STOP_MIN_SEC', 'WALK_RUN_BOUNDARY_MPS'];
  let mismatch = false;
  for (const key of keys) {
    const shippedVal = shippedProduction[key];
    if (shippedVal === undefined) continue;
    if (Number(shippedVal) !== result.shipped[key]) mismatch = true;
  }

  return { exitCode: mismatch ? 2 : 0, reason: mismatch ? 'shipped-mismatch' : null };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function fmtNum(v, decimals = 6) {
  return v === null || v === undefined ? '—' : Number(v).toFixed(decimals);
}

function fmtPct(v, decimals = 4) {
  return v === null || v === undefined ? '—' : `${(v * 100).toFixed(decimals)}%`;
}

function renderShapeRow(id, r) {
  return (
    `| ${id} | ${r.baseN} | ${fmtNum(r.base)} | ${fmtNum(r.removed)} (${r.removedN}) | ` +
    `${fmtPct(r.removedDelta)} | ${fmtNum(r.planted)} (${r.plantedN}) | ${fmtPct(r.plantedDelta)} | ` +
    `${r.plantCount ?? '—'} | ${r.pass ? 'PASS' : 'FAIL'} |`
  );
}

function renderShapeTable(rows) {
  const lines = [
    '| id | n | base | removed (n) | removedDelta | planted (n) | plantedDelta | plants | Verdict |',
    '|---|---|---|---|---|---|---|---|---|',
  ];
  for (const r of rows) lines.push(renderShapeRow(r.id, r));
  return lines.join('\n');
}

function renderGatesTable(gates) {
  const lines = ['| gate | measured | bound | Verdict |', '|---|---|---|---|'];
  for (const g of gates) {
    const reasonSuffix = g.reason ? ` (${g.reason})` : '';
    lines.push(`| ${g.id} | ${g.measured ?? '—'} | ${g.bound ?? '—'} | ${g.pass ? 'PASS' : 'FAIL'}${reasonSuffix} |`);
  }
  return lines.join('\n');
}

function renderD10(d10) {
  const lines = [];
  lines.push('Named anchors:');
  lines.push('');
  lines.push('| id | expected distanceTriggered | actual | Verdict |');
  lines.push('|---|---|---|---|');
  for (const row of d10.anchorRows) {
    lines.push(`| ${row.id} | ${row.expected} | ${row.actual} | ${row.pass ? 'PASS' : 'FAIL'} |`);
  }
  lines.push('');
  lines.push(
    `Among computable streams with cvDd < ${pc.DISTANCE_TRIGGERED_MAX_CV_DD}, the ±${D10_MARGIN} margin ` +
      `around DISTANCE_TRIGGERED_MAX_CV_RATIO (${pc.DISTANCE_TRIGGERED_MAX_CV_RATIO}) is ` +
      `${d10.marginClear ? 'CLEAR' : 'VIOLATED'}. Nearest ratio below: ` +
      `${d10.nearestBelow ? `${d10.nearestBelow.id} (${d10.nearestBelow.sig.ratio})` : '—'}; nearest above: ` +
      `${d10.nearestAbove ? `${d10.nearestAbove.id} (${d10.nearestAbove.sig.ratio})` : '—'}.`
  );
  lines.push('');
  lines.push(
    `Findings (never expected values): distance-triggered ${d10.distanceTriggeredCount}, insufficient-data ` +
      `${d10.insufficientCount}, computable ${d10.computableCount}.`
  );
  return lines.join('\n');
}

/**
 * [D-20, plan 34-13] Renders drift-while-stationary as a MEASURED NON-ISSUE finding, ALWAYS —
 * independent of whether Family G "clears" (it no longer arbitrates at all). Reports the live
 * standstill-episode evidence (including G4's and G5's own measured bases), the D-20 disposition and
 * date, the declared bound stated in PROSE (never a `STATIONARY_MAX_SPEED_MPS = ` line — that
 * pattern is reserved for `## Chosen constants`), and the definitional caveat that a single-pause
 * standstill is zero-advance by construction. Replaces D-19's `shippedG`-gated "drift matters" line.
 */
function renderDrift(drift) {
  const evidence =
    `Standstill episodes: total=${drift.episodesTotal}, chained=${drift.chainedCount}, ` +
    `single-pause=${drift.singlePauseCount}, chainedShare=${fmtPct(drift.chainedShare)}, ` +
    `totalStandstillSeconds=${fmtNum(drift.totalStandstillSeconds, 1)}, ` +
    `totalChainedMetres=${fmtNum(drift.totalChainedMetres, 2)}. G4 measured base (pooled, chained-` +
    `episode rate, R-7 p90) = ${fmtNum(drift.g4Base)} m/s; G5 measured base (per-activity) = ` +
    `${fmtNum(drift.g5Base)} m/s.`;

  const disposition =
    'Disposition (D-20, 2026-09-22): drift-while-stationary is a MEASURED NON-ISSUE on this archive. ' +
    'Family G still measures and renders the G4/G5 rows above, under Shape arbitration, as evidence ' +
    'for this finding; it no longer arbitrates a cut for this constant. The stationary/walked ' +
    `boundary sits at the developer-declared ${DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT} m/s bound, ` +
    'stated (never re-stated as a value line) in the Chosen constants section when every family ' +
    'clears, chosen on physical grounds, far above what the evidence above measures.';

  const caveat =
    'Definitional caveat: a single-pause standstill (no qualifying bridge on either side) is ' +
    'zero-advance BY CONSTRUCTION — the pause rule only marks zero-advance runs — so the single-' +
    'pause share of the counts above is partly definitional. The chained share and the G4/G5 rates ' +
    'above are the measured, non-definitional part of this finding.';

  return `${evidence}\n\n${disposition}\n\n${caveat}`;
}

function renderFindings(findings) {
  const lines = [];
  lines.push(
    `Class distribution: stationary=${findings.classCounts.stationary} ` +
      `(${findings.activityCounts.stationary} activities), walked=${findings.classCounts.walked} ` +
      `(${findings.activityCounts.walked} activities), ran-through=${findings.classCounts['ran-through']} ` +
      `(${findings.activityCounts['ran-through']} activities), transported=${findings.classCounts.transported} ` +
      `(${findings.activityCounts.transported} activities). Not-classifiable intervals: ` +
      `${findings.notClassifiableTotal}.`
  );
  lines.push('');
  lines.push(
    `Forgotten-stop: computable ${findings.stopComputableCount}, not-computable ` +
      `${findings.stopNotComputableCount} (${JSON.stringify(findings.stopNotComputableReasons)}). ` +
      `Covered-creep flagged on ${findings.creepActivityCount} activities (${findings.creepIntervalCount} ` +
      `stretches); zero-advance-pause flagged on ${findings.pauseActivityCount} activities ` +
      `(${findings.pauseIntervalCount} intervals).`
  );
  return lines.join('\n');
}

/**
 * Renders the full calibration artifact. `result.allCleared === false` renders `## NO SHAPE CLEARS`
 * and NO `Chosen constants` lines; `result.allCleared === true && !result.gates.pass` renders
 * `## GATE FAILED` instead. Deterministic — no wall-clock timestamp, no bare `rev-parse HEAD`
 * commit id, no source-file hash: a re-render of the same `result` is byte-identical.
 */
export function renderCalibrationMarkdown(result) {
  const lines = [];

  lines.push('# Phase 34 Plan 4: pause-classification / forgotten-stop calibration (PAUSE-01, STOP-02)');
  lines.push('');
  lines.push(
    `Regenerate with \`${REGENERATE_COMMAND}\`. This artifact carries no wall-clock timestamp or ` +
      "generated-at field — provenance is content-addressed to data/streams' own git tree. A re-run " +
      'against an unchanged archive is byte-identical.'
  );
  lines.push('');

  lines.push('## Statistic and scope');
  lines.push('');
  lines.push(
    'Families run in the fixed order G, then M, then W (34-04-PLAN.md <predeclared_shapes>, as ' +
      'amended by 34-12-PLAN.md (D-19)). Downstream families use the upstream chosen value AS ' +
      'SHIPPED (rounded). If a family HALTs, every downstream family renders "not computed: ' +
      'upstream HALT". The D-13 PLANTED perturbation plants ceil(PLANT_FRACTION x the shape\'s own ' +
      'base items) items into that shape\'s own population, uniform across G, M and W (D-19) — ' +
      'never a single family-wide plant.'
  );
  lines.push('');

  lines.push('## Pre-declared shapes');
  lines.push('');
  for (const familyId of ['G', 'M', 'W']) {
    lines.push(`### Family ${familyId}`);
    lines.push('');
    for (const shape of PREDECLARED_SHAPES[familyId]) {
      lines.push(`#### ${shape.id} — ${shape.name}`);
      lines.push('');
      lines.push(`**Meaning:** ${shape.meaning}`);
      lines.push('');
      lines.push(`**Non-circularity:** ${shape.nonCircularity}`);
      lines.push('');
      lines.push(`**Caveats:** ${shape.caveat}`);
      lines.push('');
    }
  }

  lines.push('## Rejected on argument');
  lines.push('');
  for (const entry of REJECTED_SHAPES) lines.push(`- ${entry}`);
  lines.push('');

  lines.push('## Non-circularity');
  lines.push('');
  for (const familyId of ['G', 'M', 'W']) {
    for (const shape of PREDECLARED_SHAPES[familyId]) {
      lines.push(`- **${shape.id}:** ${shape.nonCircularity}`);
    }
  }
  lines.push('');

  lines.push('## Strawmen watched failing');
  lines.push('');
  lines.push(
    'Removal empties a strawman by construction — its population IS the population the boundary/' +
      'duration later judges.'
  );
  lines.push('');
  for (const familyId of ['G', 'M', 'W']) {
    const family = result.families[familyId];
    lines.push(`### Strawman ${familyId}`);
    lines.push('');
    if (family) {
      lines.push(renderShapeTable([{ id: `strawman ${familyId}`, ...family.strawman }]));
      lines.push('');
      lines.push(
        family.strawman.pass
          ? '**BLOCKER: the strawman PASSED the insensitivity tolerance.**'
          : `**FAILED** — removedDelta ${fmtPct(family.strawman.removedDelta)}, plantedDelta ` +
              `${fmtPct(family.strawman.plantedDelta)} (expected).`
      );
    } else {
      lines.push('not computed: upstream HALT');
    }
    lines.push('');
  }

  lines.push('## Shape arbitration');
  lines.push('');
  for (const familyId of ['G', 'M', 'W']) {
    const family = result.families[familyId];
    lines.push(`### Family ${familyId}`);
    lines.push('');
    if (family) {
      if (family.arbitrated === false) {
        // [D-20, plan 34-13] Family G: not arbitrated. The rows below are evidence for the
        // drift-while-stationary finding, never candidates — no row here can select or influence a
        // constant.
        lines.push(
          'NOT ARBITRATED (D-20): STATIONARY_MAX_SPEED_MPS is developer-declared, not calibrated. ' +
            'The rows below are EVIDENCE for the drift-while-stationary finding, never candidates — ' +
            'no row here can select or influence a constant.'
        );
        lines.push('');
      }
      lines.push(renderShapeTable(family.rows));
      lines.push('');
      lines.push(
        family.arbitrated === false
          ? 'Selected: not applicable — not arbitrated (D-20)'
          : `Selected: ${family.selectedId ?? 'NO SHAPE CLEARS'}`
      );
    } else {
      lines.push('not computed: upstream HALT');
    }
    lines.push('');
  }

  const gateFailed = result.allCleared && result.gates && !result.gates.pass;

  if (result.allCleared && !gateFailed) {
    lines.push('## Chosen constants');
    lines.push('');
    // [D-20, plan 34-13] STATIONARY_MAX_SPEED_MPS ships the DECLARED source text verbatim, never
    // `String(result.shipped.STATIONARY_MAX_SPEED_MPS)` — 33-14's ship-from-artifact precedent pins
    // to source text, not a runtime-derived string.
    lines.push(`STATIONARY_MAX_SPEED_MPS = ${DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT}`);
    lines.push(`STATIONARY_MAX_SPEED_MPS provenance: ${STATIONARY_PROVENANCE_TEXT}`);
    lines.push(`FORGOTTEN_STOP_MIN_SEC = ${result.shipped.FORGOTTEN_STOP_MIN_SEC}`);
    lines.push(
      `FORGOTTEN_STOP_MIN_SEC provenance: calibrated (M family, ${result.families.M.selectedId})`
    );
    lines.push(`WALK_RUN_BOUNDARY_MPS = ${result.shipped.WALK_RUN_BOUNDARY_MPS}`);
    lines.push(
      `WALK_RUN_BOUNDARY_MPS provenance: calibrated (W family, ${result.families.W.selectedId})`
    );
    lines.push(`UNRELIABLE_SPEED_LIMIT_MPS = ${UNRELIABLE_SPEED_LIMIT_MPS} (imported, 32-CALIBRATION.md)`);
    lines.push('');
  } else if (!result.allCleared) {
    lines.push('## NO SHAPE CLEARS');
    lines.push('');
    lines.push(
      'At least one family failed to select a shape clearing D-13 insensitivity. No constant is named ' +
        'for that family or any family downstream of it. Nothing is widened or loosened.'
    );
    lines.push('');
  } else {
    lines.push('## GATE FAILED');
    lines.push('');
    lines.push(
      'All three families cleared, but a post-selection gate failed (see `## Gates` below). No constant ' +
        'is confirmed shipped — there is no fallback to a later shape.'
    );
    lines.push('');
  }

  lines.push('## Gates');
  lines.push('');
  if (result.gates) {
    lines.push(renderGatesTable(result.gates.gates));
  } else {
    lines.push('Not evaluated — not every family cleared (see `## NO SHAPE CLEARS` above).');
  }
  lines.push('');

  lines.push('## D-10 blind-spot rule');
  lines.push('');
  lines.push(renderD10(result.d10));
  lines.push('');

  lines.push('## Drift-while-stationary');
  lines.push('');
  lines.push(renderDrift(result.drift));
  lines.push('');

  lines.push('## Join exhaustiveness');
  lines.push('');
  lines.push(
    `Summed joinViolations archive-wide: ${result.join.total}. ${result.join.pass ? 'PASS' : 'FAIL'}.`
  );
  lines.push('');

  lines.push('## Per-interval class table — 3475724402 (classifier output)');
  lines.push('');
  if (result.allCleared && result.perIntervalTable && result.perIntervalTable.found) {
    lines.push('| # | source | startSec | endSec | seconds | metres | speedMps | class |');
    lines.push('|---|---|---|---|---|---|---|---|');
    for (const row of result.perIntervalTable.rows) {
      lines.push(
        `| ${row.index} | ${row.source} | ${row.startSec} | ${row.endSec} | ${row.seconds} | ` +
          `${row.metres.toFixed(1)} | ${row.speedMps.toFixed(3)} | ${row.pauseClass} |`
      );
    }
  } else {
    lines.push('Not rendered — not every family cleared.');
  }
  lines.push('');

  lines.push('## Archive-wide findings (never an input to selection)');
  lines.push('');
  lines.push(
    result.allCleared && result.archiveFindings
      ? renderFindings(result.archiveFindings)
      : 'Not computed — not every family cleared.'
  );
  lines.push('');

  lines.push('## Inputs');
  lines.push('');
  lines.push(`- Streams scanned: ${result.archive.streamFileCount}, not computable: ${result.archive.notComputable}`);
  const provenance = result.provenance ?? {};
  lines.push(`- data/streams git tree: \`${provenance.streamsTree ?? 'unknown'}\``);
  lines.push(`- Newest activity start date: ${provenance.newestActivityStartDate ?? 'unknown'}`);
  lines.push(`- Control file: ${provenance.controlFilePath ?? CONTROL_FILE_PATH}`);
  lines.push(`- Regenerate: \`${REGENERATE_COMMAND}\``);
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// main() — gated behind the self-execution guard
// ---------------------------------------------------------------------------

/** Content-addressed provenance: names the run's actual input (the committed stream archive's git
 * tree), never `rev-parse HEAD` alone, never a wall-clock read, never a classifier source hash. */
function gitId(args) {
  try {
    return execSync(`git ${args}`, { cwd: ROOT_DIR, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown (git failed)';
  }
}

function loadArchive(streamsDir) {
  const files = readdirSync(streamsDir).filter(isStreamFile).sort();
  const activities = [];
  let notComputable = 0;

  for (const filename of files) {
    const id = idFromFilename(filename);
    let stream;
    try {
      stream = JSON.parse(readFileSync(join(streamsDir, filename), 'utf8'));
    } catch {
      notComputable++;
      continue;
    }
    const t = Array.isArray(stream.t) ? stream.t : [];
    const d = Array.isArray(stream.d) ? stream.d : [];
    if (!validateStreamSeries(t, d).ok) {
      notComputable++;
      continue;
    }
    const cadence = Array.isArray(stream.cadence) ? stream.cadence : null;
    activities.push({ id, t, d, cadence });
  }

  return { activities, streamFileCount: files.length, notComputable };
}

function newestActivityStartDate(activitiesDir) {
  let newest = null;
  let files;
  try {
    files = readdirSync(activitiesDir);
  } catch {
    return null;
  }
  for (const filename of files) {
    if (!filename.endsWith('.json')) continue;
    try {
      const doc = JSON.parse(readFileSync(join(activitiesDir, filename), 'utf8'));
      if (typeof doc.start_date === 'string' && (newest === null || doc.start_date > newest)) {
        newest = doc.start_date;
      }
    } catch {
      // skip malformed activity docs — not this script's concern
    }
  }
  return newest;
}

function main() {
  console.log('Computing the pause-classification / forgotten-stop calibration (plan 34-04, amended 34-12)...\n');

  let archive;
  try {
    archive = loadArchive(STREAMS_DIR);
  } catch (error) {
    console.error(`Error: could not read the archive: ${error.message}`);
    console.error('Run `npm run build` first, then re-run `npm run compute-pause-classification-calibration`.');
    process.exitCode = 1;
    return;
  }

  console.log(`Streams scanned: ${archive.streamFileCount}, not computable: ${archive.notComputable}`);

  let controlText = null;
  try {
    controlText = readFileSync(CONTROL_FILE_PATH, 'utf8');
  } catch {
    controlText = null;
  }

  const result = runCalibration(archive, controlText);
  result.provenance = {
    streamsTree: gitId('rev-parse HEAD:data/streams'),
    newestActivityStartDate: newestActivityStartDate(ACTIVITIES_DIR),
    controlFilePath: CONTROL_FILE_PATH,
  };

  const shippedProduction = {
    STATIONARY_MAX_SPEED_MPS: pc.STATIONARY_MAX_SPEED_MPS,
    FORGOTTEN_STOP_MIN_SEC: pc.FORGOTTEN_STOP_MIN_SEC,
    WALK_RUN_BOUNDARY_MPS: pc.WALK_RUN_BOUNDARY_MPS,
  };
  const outcome = decideOutcome(result, shippedProduction);

  for (const familyId of ['G', 'M', 'W']) {
    const family = result.families[familyId];
    if (family) {
      console.log(`Family ${familyId}: strawman pass=${family.strawman.pass}`);
      for (const r of family.rows) {
        console.log(`  ${r.id}: base=${r.base} removedDelta=${r.removedDelta} plantedDelta=${r.plantedDelta} pass=${r.pass}`);
      }
      console.log(`  selected: ${family.selectedId ?? 'none'}`);
    } else {
      console.log(`Family ${familyId}: not computed (upstream HALT)`);
    }
  }

  const markdown = renderCalibrationMarkdown(result);
  writeFileSync(OUTPUT_PATH, markdown, 'utf8');
  console.log(`\nWrote ${OUTPUT_PATH}`);

  process.exitCode = outcome.exitCode;
  if (outcome.exitCode !== 0) {
    console.error(`\nExit ${outcome.exitCode}: ${outcome.reason}. See the artifact for full detail.`);
  }
}

// Self-execution guard: main() runs only under direct invocation, so
// compute-pause-classification-calibration.test.mjs can import every pure function above without
// triggering an archive read or a write to 34-CALIBRATION.md as an import-time side effect. This
// plan never runs main() against the real archive (D-08: no peeking) — that is plan 34-06's job.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
