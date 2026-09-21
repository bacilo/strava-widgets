/**
 * Phase 33 plan 08 / D-07: the unreliable-segment SEVERITY-tier calibration generator.
 *
 * Derives the one new D-07 constant SEG-06 needs: the excess-metres fraction above which an
 * activity's unreliable-segment signal is `severe` rather than `minor`. `none` (zero detected
 * segments) needs no calibration — it is a presence fact, not a magnitude judgement (33-08-PLAN.md
 * "PLANNER DECISION"). This is a calibration GENERATOR, not a recount: unlike
 * `scripts/compute-coverage-identity-recount.mjs` (plan 33-07, deliberately forbidden from
 * importing the detector), this script IS allowed to import `detectUnreliableSegments` —
 * calibrating the detector's own downstream tier is exactly this generator's job.
 *
 * Imports `classifyGapsThreeWay`/`quantile` from `../dist/analytics/pace-derivation.js` (the ONE
 * pre-detector gap list and the ONE R-7 percentile implementation this codebase uses — this file
 * never writes a second percentile function) and `detectUnreliableSegments`/
 * `DEFAULT_DETECTOR_PARAMS` from `../dist/analytics/unreliable-segments.js`. The detector is fed
 * the pre-detector `classifyGapsThreeWay` gap list, never the POST-detector `classifyGaps` output —
 * `classifyGaps` now folds `detectUnreliableSegments` into its own output (Phase 33 D-14), so
 * feeding that back in would be the detector judging its own prior output (plan 33-01 Task 2's
 * circularity rule).
 *
 * ANTI-QUOTA (T-33-11b): the archive-wide severe/minor/none distribution the chosen cut produces is
 * a REPORTED FINDING, computed and rendered only AFTER the candidate is selected, never consulted
 * while selecting it. A candidate is chosen by clearing the D-13 insensitivity tolerance at the
 * SMALLEST outer-percentile order that does — never by the count or rate it yields. This file's
 * `selectSevereCut` takes the excess-fraction population and a fixed candidate list; it has no
 * parameter through which a flagged count could reach it.
 *
 * CIRCULARITY (T-33-11): a deliberately circular strawman — a raw tail percentile (q=0.99) of the
 * excess-fraction population ITSELF — is computed and run through the exact same insensitivity
 * check as every real candidate, and its `pass: false` verdict is rendered as a blocker if it
 * should ever come back true (mirroring Phase 32's own `strawmanTailPercentile` precedent).
 *
 * No wall-clock timestamp or generated-at field appears anywhere in the rendered output: a re-run
 * against an unchanged archive is byte-identical.
 *
 * Shape follows `compute-unreliable-segment-calibration.mjs`: pure exported functions with zero
 * file I/O, plus a `main()` gated behind the standard self-execution guard so
 * `compute-unreliable-segment-severity-calibration.test.mjs` can import every pure function below
 * without triggering an archive read or a write to `33-CALIBRATION.md` as an import-time side
 * effect.
 *
 * No import-time `fs`-mock no-side-effect guard was written for this file (33-08-SUMMARY.md
 * records this decision explicitly) — plan 33-07's own precedent already established that the
 * self-execution guard below (`import.meta.url === pathToFileURL(...)`) is what actually prevents a
 * real file read as an import-time side effect, and this repo's own recorded memory ("fs spy cannot
 * observe named imports") disqualifies a `vi.spyOn(fs, ...)` guard for a module consuming `fs` via
 * named imports without ALSO writing the full `vi.mock('fs')` + two-positive-control apparatus
 * `scripts/unreliable-segment-import-guards.test.mjs` already built and demonstrated OBSERVED for
 * the sibling calibration/recount generators — duplicating that apparatus a third time for this
 * file adds no new coverage shape, only a third copy of the same mechanism.
 *
 * PLAN 33-14 EXTENSION (D-16, closing 33-08's HALT): every function above this comment is 33-08's
 * own, kept verbatim so its recorded negative finding (the outer-percentile table) stays generable.
 * Below it, a NON-SELF-REFERENTIAL derivation of the same D-07 cut: four pre-declared reference
 * shapes (`PREDECLARED_SHAPES`, R1..R4), each reading ordinary folded covered steps and per-activity
 * distances over ALL computable activities — never the flagged cohort's own excess-fraction
 * population 33-08 measured circular — plus a step-level D-13 harness (`buildBaseViews` /
 * `buildRemovedViews` / `buildPlantedViews` / `evaluateShape`) and first-clearing arbitration
 * (`selectShape`). The shape list, its order, its percentile orders and the 1% tolerance are FIXED
 * by 33-14-PLAN.md's `<predeclared_shapes>` block before any measurement; this file implements that
 * text literally — if the two ever disagree, the plan text wins and this file is the bug.
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import {
  advanceSteps,
  detectUnreliableSegments,
  DEFAULT_DETECTOR_PARAMS,
} from '../dist/analytics/unreliable-segments.js';
import { classifyGapsThreeWay, quantile } from '../dist/analytics/pace-derivation.js';
import { validateStreamSeries } from '../dist/analytics/best-effort-utils.js';
import { isStreamFile, idFromFilename } from './lib/stream-files.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const STREAMS_DIR = join(ROOT_DIR, 'data/streams');
const OUTPUT_PATH = join(
  ROOT_DIR,
  '.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-CALIBRATION.md'
);

const REGENERATE_COMMAND = 'npm run build && npm run compute-unreliable-segment-severity-calibration';

/** D-13's tolerance, fixed BEFORE any insensitivity check runs (never adjusted after seeing a delta) — the
 * same 1% Phase 32 used, per this plan's own `removedDelta` convention. */
export const INSENSITIVITY_TOLERANCE = 0.01;

/** The candidate outer-percentile list, fixed and round BEFORE any check runs (32-CONTEXT.md D-10's
 * own multiplier-selection precedent). Smallest-clearing-q wins (33-08-PLAN.md § interfaces). */
export const CANDIDATE_OUTER_PERCENTILES = [0.9, 0.95, 0.97, 0.99];

/** The strawman's own tail-percentile order — deliberately the population's own top order, the
 * circular shape D-07's real rule is NOT. */
export const STRAWMAN_PERCENTILE = 0.99;

/** Deterministic planted-synthetic batch size and multiplier (33-08-PLAN.md's own "say 25, at 10x
 * the cohort maximum"). Both fixed constants, never derived from a flagged count. */
export const PLANT_COUNT = 25;
export const PLANT_MULTIPLIER = 10;

// ---------------------------------------------------------------------------
// Pure functions — importable without I/O
// ---------------------------------------------------------------------------

/**
 * One activity's excess fraction: the summed `excessMetres` of every detected segment, over the
 * activity's own total distance (`totalDistanceM`, the caller's job to compute — this function
 * takes no `t`/`d`). Returns `null`, NEVER `0`, when `totalDistanceM` is not a positive finite
 * number — a zero-or-negative denominator is unmeasurable, not "zero excess".
 */
export function activityExcessFraction(segments, totalDistanceM) {
  if (!Number.isFinite(totalDistanceM) || !(totalDistanceM > 0)) return null;
  let sum = 0;
  for (const segment of segments) sum += segment.excessMetres;
  return sum / totalDistanceM;
}

/**
 * The R-7 percentile (imported `quantile`, no local percentile implementation) of `fractions` at
 * order `q`, over a freshly sorted-ascending copy — never mutates the caller's array.
 */
export function candidateCut(fractions, q) {
  const sorted = [...fractions].sort((a, b) => a - b);
  return quantile(sorted, q);
}

/**
 * D-13's two-direction insensitivity check for ONE candidate order `q`, over an already-built
 * excess-fraction population (`fractions`, the flagged cohort's own values — the caller decides
 * which population this is, so the same function serves both a real candidate and the strawman).
 *
 * (a) removal: re-derives the cut over the population with its OWN top decile removed (the
 *     highest-valued 10%, by sorted rank) — never a fixed absolute cut.
 * (b) planted synthetics: re-derives the cut over the population plus `PLANT_COUNT` synthetic
 *     values, each equal to `PLANT_MULTIPLIER x` the population's own maximum — a deterministic
 *     plant, so two runs over the same archive are byte-identical.
 *
 * `pass` requires BOTH relative deltas to clear `tolerance`. An empty or degenerate population
 * (fewer than 2 values, so a top-decile removal would empty it, or a `null`/zero base) reports both
 * deltas as `null` and `pass: false` — never divides by zero.
 */
export function insensitivityForCandidate(fractions, q, { tolerance }) {
  const sorted = [...fractions].sort((a, b) => a - b);
  const base = sorted.length === 0 ? null : candidateCut(sorted, q);

  const keepCount = Math.floor(sorted.length * 0.9);
  const removedPopulation = sorted.slice(0, keepCount);
  const removedCut = removedPopulation.length > 0 ? candidateCut(removedPopulation, q) : null;
  const removedDelta =
    base === null || base === 0 || removedCut === null
      ? null
      : Math.abs(removedCut - base) / Math.abs(base);

  const maxValue = sorted.length > 0 ? sorted[sorted.length - 1] : 0;
  const plantedValue = maxValue * PLANT_MULTIPLIER;
  const plantedPopulation = [...sorted, ...Array(PLANT_COUNT).fill(plantedValue)];
  const plantedCut = candidateCut(plantedPopulation, q);
  const plantedDelta =
    base === null || base === 0 ? null : Math.abs(plantedCut - base) / Math.abs(base);

  const pass =
    removedDelta !== null &&
    plantedDelta !== null &&
    removedDelta <= tolerance &&
    plantedDelta <= tolerance;

  return {
    q,
    base,
    n: sorted.length,
    removedCut,
    removedN: removedPopulation.length,
    removedDelta,
    plantedCut,
    plantedN: plantedPopulation.length,
    plantedDelta,
    pass,
  };
}

/**
 * Runs every candidate in `CANDIDATE_OUTER_PERCENTILES` (in order) through
 * `insensitivityForCandidate`, and selects the SMALLEST `q` whose `pass` is `true` — mirroring
 * `32-CALIBRATION.md`'s own multiplier-selection rule ("smallest candidate that clears the
 * tolerance wins"). `chosen` is `null` when no candidate passes; `results` always carries every
 * candidate's full row for rendering, regardless of outcome.
 */
export function selectSevereCut(fractions, { tolerance = INSENSITIVITY_TOLERANCE } = {}) {
  const results = CANDIDATE_OUTER_PERCENTILES.map((q) =>
    insensitivityForCandidate(fractions, q, { tolerance })
  );
  const chosen = results.find((r) => r.pass) ?? null;
  return { results, chosen, tolerance };
}

/**
 * STRAWMAN (Pitfall C, watched failing before any real candidate is trusted): the raw
 * `STRAWMAN_PERCENTILE` tail percentile of the excess-fraction population itself, run through the
 * SAME `insensitivityForCandidate` two-direction check. Deliberately circular — the top X% is
 * "severe" by construction regardless of X, so this population is exactly the one D-07's real rule
 * must NOT threshold against.
 */
export function strawmanCandidate(fractions, { tolerance = INSENSITIVITY_TOLERANCE } = {}) {
  return insensitivityForCandidate(fractions, STRAWMAN_PERCENTILE, { tolerance });
}

/**
 * Builds the flagged cohort — every archive activity with at least one detected segment — and each
 * member's own excess fraction. `gaps` MUST be the caller's pre-detector `classifyGapsThreeWay`
 * list (D-02/D-14); this function does not compute gaps itself, it only consumes `activity.gaps`.
 * Activities whose fraction comes back `null` (a zero/degenerate total distance) are counted in
 * `notComputableInCohort` and excluded from `fractions` — never silently coerced to `0`.
 */
export function buildFlaggedCohort(archive) {
  const members = [];
  let notComputableInCohort = 0;

  for (const activity of archive.activities) {
    const segments = detectUnreliableSegments(
      activity.t,
      activity.d,
      activity.gaps,
      DEFAULT_DETECTOR_PARAMS
    );
    if (segments.length === 0) continue;

    const totalDistanceM = activity.d[activity.d.length - 1] - activity.d[0];
    const fraction = activityExcessFraction(segments, totalDistanceM);
    if (fraction === null) {
      notComputableInCohort++;
      continue;
    }
    members.push({ id: activity.id, segmentCount: segments.length, totalDistanceM, fraction });
  }

  return {
    members,
    fractions: members.map((m) => m.fraction),
    cohortSize: members.length + notComputableInCohort,
    notComputableInCohort,
  };
}

/**
 * The archive-wide severe/minor/none/not-computable distribution the chosen `cut` produces — a
 * REPORTED FINDING computed only from an already-selected `cut`, never consulted while selecting
 * one. `none` = zero detected segments (a presence fact); `minor` = at least one segment with
 * `fraction <= cut`; `severe` = `fraction > cut`; `not-computable` = at least one segment but a
 * `null` fraction (degenerate total distance).
 */
export function severityDistribution(archive, cut) {
  let none = 0;
  let minor = 0;
  let severe = 0;
  let notComputable = 0;

  for (const activity of archive.activities) {
    const segments = detectUnreliableSegments(
      activity.t,
      activity.d,
      activity.gaps,
      DEFAULT_DETECTOR_PARAMS
    );
    if (segments.length === 0) {
      none++;
      continue;
    }
    const totalDistanceM = activity.d[activity.d.length - 1] - activity.d[0];
    const fraction = activityExcessFraction(segments, totalDistanceM);
    if (fraction === null) {
      notComputable++;
      continue;
    }
    if (fraction > cut) severe++;
    else minor++;
  }

  return { none, minor, severe, notComputable, total: archive.activities.length };
}

/**
 * Loads the archive: every `data/streams/*.json` file (via `isStreamFile`, never `manifest.json`),
 * classified as `notComputable` (and excluded from `activities`) on a parse failure or a
 * `validateStreamSeries` rejection — never silently dropped without a trace, since both counts
 * always reach the rendered `## Inputs` section. `gaps` is `classifyGapsThreeWay(t, d).gapIntervals`
 * — the ONE pre-detector shape the detector is ever fed (D-02/D-14).
 */
export function loadArchive(streamsDir) {
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

    const gaps = classifyGapsThreeWay(t, d).gapIntervals;
    activities.push({ id, t, d, gaps });
  }

  return { activities, streamFileCount: files.length, notComputable };
}

// ---------------------------------------------------------------------------
// Plan 33-14 (D-16): perturbation views, the four pre-declared reference
// shapes, the step-level D-13 harness, first-clearing arbitration
// ---------------------------------------------------------------------------

/** The activity whose real detected burst shapes are cloned into the D-13 planting step —
 * mirroring `compute-unreliable-segment-calibration.mjs`'s own `INSENSITIVITY_SOURCE_ACTIVITY_ID`.
 * Fixed by the plan text, never derived from a flagged count. */
export const PLANT_SOURCE_ACTIVITY_ID = '3475724402';

/**
 * One view per activity: `{ id, steps, totalDistanceM, excessList }` (33-14-PLAN.md
 * `<predeclared_shapes>`, "A view of an activity is..."). `steps` is the ONE folded covered-step
 * definition (`advanceSteps`, imported — never re-implemented). `totalDistanceM` is the stream's own
 * endpoint difference. `excessList` is each detected segment's own `excessMetres` at
 * `DEFAULT_DETECTOR_PARAMS` — the SAME field D-07's statistic reads, unchanged by this plan.
 */
export function buildBaseViews(archive) {
  const views = [];
  for (const activity of archive.activities) {
    const steps = advanceSteps(activity.t, activity.d, activity.gaps);
    const totalDistanceM =
      Array.isArray(activity.d) && activity.d.length > 0
        ? activity.d[activity.d.length - 1] - activity.d[0]
        : NaN;
    const segments = detectUnreliableSegments(
      activity.t,
      activity.d,
      activity.gaps,
      DEFAULT_DETECTOR_PARAMS
    );
    views.push({
      id: activity.id,
      steps,
      totalDistanceM,
      excessList: segments.map((s) => s.excessMetres),
    });
  }
  return views;
}

/**
 * REMOVED views (D-13 harness, per 33-14-PLAN.md `<d13_harness>`): for each activity, drops exactly
 * the steps lying wholly inside a `kind: 'burst'` part of a detected segment (Phase 32's own
 * `part.startIndex >= step... `, mirrored here as `step.startIndex >= part.startIndex &&
 * step.endIndex <= part.endIndex`), subtracts exactly their metres from `totalDistanceM`, and empties
 * `excessList` (every detected segment is gone — the perturbation removes the thing the statistic
 * would otherwise attribute to it). An activity detecting no segment at all is returned UNCHANGED
 * (nothing to remove). Denominators are re-derived (never held at the base value): the returned
 * `totalDistanceM` is the base value minus exactly the dropped steps' own metres.
 */
export function buildRemovedViews(archive, baseViews) {
  const baseById = new Map(baseViews.map((v) => [v.id, v]));
  const views = [];
  let removedStepCount = 0;
  let changedDistanceActivityCount = 0;

  for (const activity of archive.activities) {
    const base = baseById.get(activity.id);
    if (!base) continue;

    const segments = detectUnreliableSegments(
      activity.t,
      activity.d,
      activity.gaps,
      DEFAULT_DETECTOR_PARAMS
    );
    if (segments.length === 0) {
      views.push(base);
      continue;
    }

    const burstRanges = [];
    for (const segment of segments) {
      for (const part of segment.parts) {
        if (part.kind === 'burst') burstRanges.push([part.startIndex, part.endIndex]);
      }
    }

    const kept = [];
    let droppedMetres = 0;
    let droppedCount = 0;
    for (const step of base.steps) {
      const insideBurst = burstRanges.some(
        ([s, e]) => step.startIndex >= s && step.endIndex <= e
      );
      if (insideBurst) {
        droppedMetres += step.metres;
        droppedCount++;
      } else {
        kept.push(step);
      }
    }
    removedStepCount += droppedCount;
    if (droppedMetres !== 0) changedDistanceActivityCount++;

    views.push({
      id: activity.id,
      steps: kept,
      totalDistanceM: base.totalDistanceM - droppedMetres,
      excessList: [],
    });
  }

  return { views, removedStepCount, changedDistanceActivityCount };
}

/**
 * PLANTED views (D-13 harness): collects `{ metres, seconds }` of every `kind: 'burst'` part
 * detected on `PLANT_SOURCE_ACTIVITY_ID` at `DEFAULT_DETECTOR_PARAMS` (real shapes, no synthetic
 * look-alikes), and clones them round-robin into the activities sorted by id until the planted count
 * equals the archive-wide detected SEGMENT count (at least doubling the contamination, per the
 * archive's own segments-per-activity ratio). Each plant is appended as a step with negative
 * sentinel indices (`-(plantedCount)`, never index-contiguous with a real step, so `shapeR1`'s
 * contiguity test cannot fold a residual across it); its metres are added to `totalDistanceM`; its
 * own burst-level excess (`metres - speedLimitMps*seconds`, counted only when strictly above
 * `excessFloorMetres`) is appended to that activity's `excessList`. With zero source burst shapes
 * (`sourceBurstPartCount === 0`) or zero detected segments archive-wide, this function plants
 * nothing (`plantedCount: 0`) and returns the base views unchanged — `evaluateShape`'s null-is-FAIL
 * rule (via a `planted` value identical to `base`, still subject to the delta check) is what turns
 * that into a FAIL, never a vacuous PASS; the harness's own non-vacuity assertion is a SEPARATE,
 * stronger guard the caller applies before trusting any delta at all.
 */
export function buildPlantedViews(archive, baseViews) {
  let detectedSegmentCount = 0;
  for (const activity of archive.activities) {
    detectedSegmentCount += detectUnreliableSegments(
      activity.t,
      activity.d,
      activity.gaps,
      DEFAULT_DETECTOR_PARAMS
    ).length;
  }

  const source = archive.activities.find((a) => a.id === PLANT_SOURCE_ACTIVITY_ID);
  const sourceBurstParts = [];
  if (source) {
    const sourceSegments = detectUnreliableSegments(
      source.t,
      source.d,
      source.gaps,
      DEFAULT_DETECTOR_PARAMS
    );
    for (const segment of sourceSegments) {
      for (const part of segment.parts) {
        if (part.kind === 'burst') {
          sourceBurstParts.push({ metres: part.metres, seconds: part.seconds });
        }
      }
    }
  }

  const working = new Map(
    baseViews.map((v) => [
      v.id,
      { id: v.id, steps: v.steps.slice(), totalDistanceM: v.totalDistanceM, excessList: v.excessList.slice() },
    ])
  );
  const sortedIds = [...working.keys()].sort();
  const changedDistanceIds = new Set();

  let plantedCount = 0;
  if (sourceBurstParts.length > 0 && sortedIds.length > 0 && detectedSegmentCount > 0) {
    let cursor = 0;
    while (plantedCount < detectedSegmentCount) {
      const targetId = sortedIds[cursor % sortedIds.length];
      const template = sourceBurstParts[plantedCount % sourceBurstParts.length];
      const target = working.get(targetId);

      target.steps.push({
        startIndex: -(plantedCount + 1),
        endIndex: -(plantedCount + 1),
        startSec: 0,
        endSec: template.seconds,
        metres: template.metres,
        seconds: template.seconds,
      });
      target.totalDistanceM += template.metres;
      changedDistanceIds.add(targetId);

      const burstExcess = template.metres - DEFAULT_DETECTOR_PARAMS.speedLimitMps * template.seconds;
      if (burstExcess > DEFAULT_DETECTOR_PARAMS.excessFloorMetres) {
        target.excessList.push(burstExcess);
      }

      plantedCount++;
      cursor++;
    }
  }

  return {
    views: [...working.values()],
    plantedCount,
    detectedSegmentCount,
    sourceBurstPartCount: sourceBurstParts.length,
    changedDistanceActivityCount: changedDistanceIds.size,
  };
}

/**
 * Shared activity-level exclusion every reference shape applies (33-14-PLAN.md `<predeclared_shapes>`
 * common definitions): an activity with `totalDistanceM <= 0` or zero steps contributes to no
 * reference population and is counted (`excluded`), never coerced to a 0 contribution.
 */
function isDegenerateView(view) {
  return !(view.totalDistanceM > 0) || view.steps.length === 0;
}

/**
 * R1 — "accumulated ordinary step noise". Reference population: ALL computable activities, one
 * value each. For each activity, every INTERIOR step whose two neighbours are index-contiguous
 * contributes a residual `r_i = |v_i - (v_(i-1)+v_(i+1))/2| * seconds_i`; `sigma_a = 1.4826 *
 * median(r) * sqrt(2/3)` (a normal-consistency MAD undoing a centred-second-difference's 3/2
 * variance inflation — mathematical identities of the stated random-walk model, not tunables);
 * `epsilon_a = sigma_a * sqrt(steps.length) / totalDistanceM`. Cut = R-7 p90 across activities of
 * `epsilon_a`. An activity with no interior residual (too few contiguous steps) is excluded and
 * counted, never coerced to 0.
 *
 * Non-circularity: `sigma_a` is a MEDIAN over thousands of ordinary residuals per activity (50%
 * breakdown point), so a handful of burst steps cannot move it; the across-activity p90 is taken
 * over every activity, most of which carry no segment at all; nothing in the statistic references
 * the speed limit, the excess floor, a segment, or the flagged set. Disclosed model assumption:
 * independent per-step errors accumulating as a random walk.
 */
export function shapeR1(views) {
  const perActivity = [];
  let excluded = 0;

  for (const view of views) {
    if (isDegenerateView(view)) {
      excluded++;
      continue;
    }

    const residuals = [];
    for (let i = 1; i < view.steps.length - 1; i++) {
      const prev = view.steps[i - 1];
      const cur = view.steps[i];
      const next = view.steps[i + 1];
      if (prev.endIndex !== cur.startIndex || cur.endIndex !== next.startIndex) continue;

      const vPrev = prev.metres / prev.seconds;
      const vCur = cur.metres / cur.seconds;
      const vNext = next.metres / next.seconds;
      residuals.push(Math.abs(vCur - (vPrev + vNext) / 2) * cur.seconds);
    }

    if (residuals.length === 0) {
      excluded++;
      continue;
    }

    residuals.sort((a, b) => a - b);
    const sigma = 1.4826 * quantile(residuals, 0.5) * Math.sqrt(2 / 3);
    perActivity.push((sigma * Math.sqrt(view.steps.length)) / view.totalDistanceM);
  }

  perActivity.sort((a, b) => a - b);
  return {
    value: perActivity.length === 0 ? null : quantile(perActivity, 0.9),
    n: perActivity.length,
    excluded,
  };
}

/**
 * R2 — "own-distance step share, bulk-of-bulk" (the S-A shape with speed replaced by distance
 * share). Reference population: ALL computable activities, one value each. Per activity, R-7 p95 of
 * `step.metres / totalDistanceM` over its own steps; cut = R-7 p90 across activities of those
 * per-activity values.
 *
 * Non-circularity: the population is every ordinary step of every activity (the same bulk-dominated
 * population `statisticSA` and `deriveExcessFloor` both already proved robust); a per-activity p95
 * over thousands of steps shifts by a rank or two when a few burst steps leave or arrive; no
 * detector constant and no flagged membership enters it. Disclosed caveat: a SAMPLE-level scale, the
 * same population `UNRELIABLE_EXCESS_FLOOR_M` was drawn from (its p10) — closer to a detection scale
 * than R1, which is why it ranks below R1 on unit-match.
 */
export function shapeR2(views) {
  const perActivity = [];
  let excluded = 0;

  for (const view of views) {
    if (isDegenerateView(view)) {
      excluded++;
      continue;
    }
    const shares = view.steps.map((s) => s.metres / view.totalDistanceM).sort((a, b) => a - b);
    perActivity.push(quantile(shares, 0.95));
  }

  perActivity.sort((a, b) => a - b);
  return {
    value: perActivity.length === 0 ? null : quantile(perActivity, 0.9),
    n: perActivity.length,
    excluded,
  };
}

/**
 * R3 — "bulk step over bulk distance" (R2's reference idea with the two scales decoupled):
 * `quantile(all steps' metres pooled archive-wide, 0.90) / quantile(all activities' totalDistanceM,
 * 0.50)`. Meaning: one high-ordinary step as a share of a typical-length activity.
 *
 * Non-circularity: the numerator is the very population `deriveExcessFloor` reads, measured at
 * 0.00%/0.00% under the equivalent removal-and-planting harness in `32-CALIBRATION.md`; the
 * denominator is a median over all activities of a quantity segments alter by well under 1%. Ranks
 * below R2 because it judges every activity against a TYPICAL distance rather than through each
 * activity's own distance (D-07's own framing).
 */
export function shapeR3(views) {
  const metres = [];
  const distances = [];
  let excluded = 0;

  for (const view of views) {
    if (isDegenerateView(view)) {
      excluded++;
      continue;
    }
    distances.push(view.totalDistanceM);
    for (const s of view.steps) metres.push(s.metres);
  }

  metres.sort((a, b) => a - b);
  distances.sort((a, b) => a - b);
  if (metres.length === 0 || distances.length === 0) {
    return { value: null, n: distances.length, excluded };
  }

  const denominator = quantile(distances, 0.5);
  const value = denominator === 0 ? null : quantile(metres, 0.9) / denominator;
  return { value, n: distances.length, excluded };
}

/**
 * R4 — "hidden-pause boundary over bulk distance": `HIDDEN_PAUSE_MIN_METRES /
 * quantile(all activities' totalDistanceM, 0.50)`, reading the constant from
 * `params.hiddenPauseMinMetres` — never a literal (`pace-single-source.test.ts`'s own detector-param
 * confinement needles would trip on a literal here).
 *
 * Ranks LAST: its numerator is a DETECTOR constant whose own derivation found no clean valley and
 * fell back to an anchor-interval midpoint whose upper end is 3475734189's own segment, so (a) its
 * D-13 insensitivity is partly insensitivity-of-a-constant, weak evidence, and (b) the D-07 anchor
 * check on 3475734189 is not independent of it; and it compares an excess-metres quantity against a
 * segment-metres scale. Non-circularity: neither factor is a statistic of the flagged cohort's
 * excess fractions; the denominator is R3's.
 */
export function shapeR4(views, params) {
  const distances = [];
  let excluded = 0;

  for (const view of views) {
    if (isDegenerateView(view)) {
      excluded++;
      continue;
    }
    distances.push(view.totalDistanceM);
  }
  distances.sort((a, b) => a - b);
  if (distances.length === 0) return { value: null, n: 0, excluded };

  const denominator = quantile(distances, 0.5);
  const value = denominator === 0 ? null : params.hiddenPauseMinMetres / denominator;
  return { value, n: distances.length, excluded };
}

/** The pre-declared reference shapes, FROZEN, in the fixed order the plan's `<predeclared_shapes>`
 * ORDER block sets: R1 (activity-level distance-error unit, fewest caveats), R2 (a sample-level
 * scale one rank down), R3 (R2's idea with scales decoupled, judged through a typical rather than
 * each activity's own distance), R4 (a detector constant, ranked last, two disclosed independence
 * caveats). Every prose field below is this plan's own text, generated into the artifact — never
 * hand-written there. */
export const PREDECLARED_SHAPES = Object.freeze([
  Object.freeze({
    id: 'R1',
    label: 'accumulated ordinary step noise',
    derive: shapeR1,
    meaning:
      "The share of its own distance that an ordinary activity's sample-to-sample distance noise " +
      'could plausibly accumulate to. Severe = the impossible excess is larger than that.',
    nonCircularityArgument:
      "`sigma_a` is a MEDIAN over thousands of ordinary residuals per activity (50% breakdown " +
      'point), so the handful of burst steps a flagged activity carries cannot move it; the ' +
      "across-activity p90 is taken over every activity, most of which carry no segment at all; " +
      'and nothing in the statistic references the speed limit, the floor, a segment, or the ' +
      'flagged set. Removing detected bursts changes `steps.length` and `totalDistanceM` by ' +
      'fractions of a percent; planting one burst into an activity adds one non-contiguous step ' +
      'that enters no residual.',
    caveats: 'Disclosed model assumption: independent per-step errors accumulating as a random walk.',
  }),
  Object.freeze({
    id: 'R2',
    label: 'own-distance step share, bulk-of-bulk',
    derive: shapeR2,
    meaning:
      'The share of its own activity that one high-ordinary recorded step carries - the ' +
      'granularity at which the stream resolves distance at all. Severe = the impossible excess ' +
      'exceeds what a single ordinary sample step could ever account for.',
    nonCircularityArgument:
      'The population is every ordinary step of every activity (the population `statisticSA` and ' +
      '`deriveExcessFloor` both already proved bulk-dominated); a per-activity p95 over thousands ' +
      'of steps shifts by a rank or two when a few burst steps leave or arrive; no detector ' +
      'constant and no flagged membership enters it.',
    caveats:
      'Disclosed caveat: this is a SAMPLE-level scale, the same population `UNRELIABLE_EXCESS_FLOOR_M` ' +
      'was drawn from (its p10), so it sits closer to a detection scale than R1 does.',
  }),
  Object.freeze({
    id: 'R3',
    label: 'bulk step over bulk distance',
    derive: shapeR3,
    meaning: 'One high-ordinary step as a share of a typical-length activity.',
    nonCircularityArgument:
      'The numerator is the very population `deriveExcessFloor` reads, measured at 0.00%/0.00% ' +
      "under this same removal-and-planting harness in 32-CALIBRATION.md; the denominator is a " +
      'median over all activities of a quantity segments alter by well under 1%.',
    caveats:
      'Ranks below R2 because it judges every activity against a TYPICAL distance rather than ' +
      "through each activity's own distance (D-07's framing).",
  }),
  Object.freeze({
    id: 'R4',
    label: 'hidden-pause boundary over bulk distance',
    derive: shapeR4,
    meaning: 'The share of a typical activity that a pause-scale distance lie represents.',
    nonCircularityArgument:
      "Neither factor is a statistic of the flagged cohort's excess fractions; the denominator is R3's.",
    caveats:
      'Ranks LAST on independence and inherited caveats: its numerator is a DETECTOR constant whose ' +
      'own derivation found no clean valley and fell back to the midpoint of an anchor interval ' +
      "whose upper end is 3475734189's own segment, so (a) its D-13 insensitivity is partly " +
      'insensitivity-of-a-constant, weak evidence, and (b) the D-07 anchor check on 3475734189 is ' +
      'not independent of it; and it compares an excess-metres quantity against a segment-metres scale.',
  }),
]);

/** REJECTED ON ARGUMENT before measurement (33-14-PLAN.md `<predeclared_shapes>`), recorded as
 * considered-and-rejected — never measured, never a candidate row. */
export const REJECTED_SHAPES = Object.freeze([
  'Stream-distance versus summary-distance disagreement: measured DEGENERATE by the planner - the ' +
    "summary distance is the stream's own final value (exactly equal on 1,499 of 1,788 numeric-id " +
    'activities, within 1 m on 239 more), so it is not a second record of distance.',
  "The detector's own sub-floor \"trivia\" excess: bounded above by `UNRELIABLE_EXCESS_FLOOR_M` by " +
    'construction while every detected burst exceeds it, so the cut could only restate presence.',
  'Any statistic over unflagged activities ONLY: membership is defined by the detector, and the ' +
    'planting step would evict most of the population.',
  'An across-activity percentile of an ordinary fast-side overshoot SUM: bursts dominate the sum in ' +
    'exactly the share of activities the removal step edits.',
]);

/**
 * STRAWMAN over views (D-13 harness): R-7 `STRAWMAN_PERCENTILE` of the excess fractions
 * (`sum(excessList) / totalDistanceM`) of views with a non-empty `excessList` — deliberately the
 * SAME computation as 33-08's own `strawmanCandidate`, restated over the view shape this plan's
 * shapes need. Its BASE value must equal 33-08's legacy q=0.99 cut exactly (same population, same
 * quantile) — asserted by the caller; a mismatch means the views are wrong.
 */
export function strawmanFromViews(views) {
  const fractions = [];
  for (const view of views) {
    if (view.excessList.length === 0 || !(view.totalDistanceM > 0)) continue;
    const sum = view.excessList.reduce((a, b) => a + b, 0);
    fractions.push(sum / view.totalDistanceM);
  }
  fractions.sort((a, b) => a - b);
  return { value: fractions.length === 0 ? null : quantile(fractions, STRAWMAN_PERCENTILE), n: fractions.length };
}

/**
 * D-13's two-direction insensitivity check for one shape's `deriveFn` (any of `shapeR1`..`shapeR4`,
 * or a view-shaped strawman deriver), evaluated over ALREADY-BUILT base/removed/planted view arrays
 * — the perturbation itself lives in `buildRemovedViews`/`buildPlantedViews`, never here. `pass`
 * requires BOTH relative deltas (computed on RAW, unrounded values) to clear `tolerance`; a `null`
 * or zero base, or a `null` perturbed value, is verdict FAIL (an emptied population is the most
 * extreme sensitivity there is, never a pass) — mirroring `insensitivityForCandidate`'s own rule.
 */
export function evaluateShape(deriveFn, { base, removed, planted }, { tolerance }) {
  const baseResult = deriveFn(base, DEFAULT_DETECTOR_PARAMS);
  const removedResult = deriveFn(removed, DEFAULT_DETECTOR_PARAMS);
  const plantedResult = deriveFn(planted, DEFAULT_DETECTOR_PARAMS);

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
    removedDelta !== null &&
    plantedDelta !== null &&
    removedDelta <= tolerance &&
    plantedDelta <= tolerance;

  return {
    base: baseValue,
    baseN: baseResult.n,
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
// Rendering
// ---------------------------------------------------------------------------

function fmtPct(v, decimals = 4) {
  return v === null || v === undefined ? '—' : `${(v * 100).toFixed(decimals)}%`;
}

function fmtNum(v, decimals = 6) {
  return v === null || v === undefined ? '—' : v.toFixed(decimals);
}

function renderInsensitivityTable(rows) {
  const lines = [];
  lines.push('| q | n | cut | removedCut (n) | removedDelta | plantedCut (n) | plantedDelta | Verdict |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    lines.push(
      `| ${r.q} | ${r.n} | ${fmtNum(r.base)} | ${fmtNum(r.removedCut)} (${r.removedN}) | ` +
        `${fmtPct(r.removedDelta)} | ${fmtNum(r.plantedCut)} (${r.plantedN}) | ${fmtPct(r.plantedDelta)} | ` +
        `${r.pass ? 'PASS' : 'FAIL'} |`
    );
  }
  return lines.join('\n');
}

/**
 * Renders the full artifact. `selection.chosen` is `null` on a NO CANDIDATE CLEARS outcome — that
 * branch omits any "Chosen constant" value and states the halt condition instead (33-08-PLAN.md
 * Task 3 step 5), never inventing a fallback constant.
 */
export function renderCalibrationMarkdown({ archive, cohort, selection, strawman, distribution }) {
  const lines = [];

  lines.push('# Phase 33 Plan 8: D-07 severity-tier calibration (SEG-06)');
  lines.push('');
  lines.push(
    `Regenerate with \`${REGENERATE_COMMAND}\`. This artifact carries no wall-clock timestamp or ` +
      'generated-at field — a re-run against an unchanged archive is byte-identical.'
  );
  lines.push('');

  lines.push('## Statistic');
  lines.push('');
  lines.push(
    'For each activity with at least one detected unreliable segment, `excessFraction = ' +
      'sum(segment.excessMetres) / (d[n-1] - d[0])` — the summed merged-segment excess over the ' +
      "activity's own total distance (D-07: a fraction of the activity's OWN distance, never " +
      'unreliable-seconds over span). The candidate cut is `quantile(sortedAsc(excessFractions), q)` ' +
      `for \`q\` drawn in order from \`[${CANDIDATE_OUTER_PERCENTILES.join(', ')}]\`; the smallest ` +
      'passing candidate wins.'
  );
  lines.push('');

  lines.push('## Non-circularity');
  lines.push('');
  lines.push(
    `The cut is derived from the flagged cohort's own excess-fraction population — ${cohort.members.length} ` +
      `of ${archive.activities.length} activities with at least one detected segment ` +
      `(cohort size ${cohort.cohortSize}, ${cohort.notComputableInCohort} not computable within it). This ` +
      "population IS the population the cut later judges (every flagged activity's own fraction), so a " +
      'percentile of it is PARTIALLY circular by construction — stated plainly here rather than argued away. ' +
      'The insensitivity check below is what adjudicates whether that partial circularity is disqualifying: ' +
      'a candidate clears D-13 only when removing its own top decile, or planting extreme synthetic ' +
      'contamination, barely moves it — evidence the cut is not merely restating an arbitrary rank of its own ' +
      'judged population.'
  );
  lines.push('');

  lines.push('## Candidate excess-fraction cuts (D-13 insensitivity)');
  lines.push('');
  lines.push(
    `Tolerance: ${fmtPct(selection.tolerance, 0)}. Selection rule: the SMALLEST \`q\` whose both deltas ` +
      'clear the tolerance wins — never the count or severe rate it produces.'
  );
  lines.push('');
  lines.push(renderInsensitivityTable(selection.results));
  lines.push('');

  if (selection.chosen) {
    lines.push('## Chosen constant');
    lines.push('');
    lines.push(
      `**SEG_SEVERE_EXCESS_FRACTION = ${fmtNum(selection.chosen.base)}** (q=${selection.chosen.q}, the ` +
        'smallest candidate clearing the tolerance).'
    );
    lines.push('');
  } else {
    lines.push('## NO CANDIDATE CLEARS');
    lines.push('');
    lines.push(
      `None of \`[${CANDIDATE_OUTER_PERCENTILES.join(', ')}]\` cleared the ${fmtPct(selection.tolerance, 0)} ` +
        'tolerance in both directions — see the candidate table above for every measured delta. No constant ' +
        'is named; this is a HALT condition for a developer decision (33-08-PLAN.md Task 3 step 5), not a ' +
        'widened candidate list or a loosened tolerance chosen unilaterally.'
    );
    lines.push('');
  }

  lines.push('## Why not a tail percentile of the population itself');
  lines.push('');
  lines.push(
    `The deliberately circular strawman — \`quantile(excessFractions, ${STRAWMAN_PERCENTILE})\`, a raw tail ` +
      'percentile of the excess-fraction population ITSELF — is run through the identical two-direction ' +
      'insensitivity check as every real candidate:'
  );
  lines.push('');
  lines.push(renderInsensitivityTable([strawman]));
  lines.push('');
  lines.push(
    strawman.pass
      ? '**BLOCKER: the strawman PASSED the insensitivity tolerance.** An unfalsifiable candidate clearing ' +
          'this check means the check itself is not discriminating — the constant above cannot be trusted ' +
          'until this is understood. Do not ship it as-is.'
      : `**FAILED** — removedDelta ${fmtPct(strawman.removedDelta)}, plantedDelta ${fmtPct(strawman.plantedDelta)}, ` +
          `both measured against the ${fmtPct(selection.tolerance, 0)} tolerance. The strawman's own top rank ` +
          'moves with its own top decile and with planted contamination close to exactly as much as removing or ' +
          'planting would move any other tail percentile of the same population — it fails for the same ' +
          'structural reason Phase 32\'s two strawmen did.'
  );
  lines.push('');

  lines.push('## Archive-wide severe/minor/none distribution (reported finding)');
  lines.push('');
  if (selection.chosen) {
    lines.push(
      `At the chosen cut (${fmtNum(selection.chosen.base)}): **severe ${distribution.severe}**, ` +
        `**minor ${distribution.minor}**, **none ${distribution.none}**, not-computable ` +
        `${distribution.notComputable}, of ${distribution.total} activities.`
    );
    lines.push('');
    lines.push(
      'This rate is reported as a finding, never tuned toward. Nothing in `selectSevereCut` or this ' +
        'rendering step adjusts `q`, the tolerance, the statistic, or the synthetic plant in response to it.'
    );
  } else {
    lines.push('Not computed — no candidate cleared the tolerance, so no cut exists to classify against.');
  }
  lines.push('');

  lines.push('## Inputs');
  lines.push('');
  lines.push(`- Streams scanned: ${archive.streamFileCount}, not computable: ${archive.notComputable}`);
  lines.push(
    `- Flagged cohort: ${cohort.members.length} activities with ≥1 detected segment ` +
      `(cohort size ${cohort.cohortSize}, ${cohort.notComputableInCohort} not computable within it)`
  );
  lines.push(`- Candidate outer percentiles: [${CANDIDATE_OUTER_PERCENTILES.join(', ')}]`);
  lines.push(`- Insensitivity tolerance: ${fmtPct(selection.tolerance, 0)}`);
  lines.push(`- Planted-synthetic batch: ${PLANT_COUNT} values at ${PLANT_MULTIPLIER}x the population's own maximum`);
  lines.push(`- Detector constants (imported, never re-derived here): speedLimitMps=${DEFAULT_DETECTOR_PARAMS.speedLimitMps}, excessFloorMetres=${DEFAULT_DETECTOR_PARAMS.excessFloorMetres}, hiddenPauseMinMetres=${DEFAULT_DETECTOR_PARAMS.hiddenPauseMinMetres}`);
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// main() — gated behind the self-execution guard
// ---------------------------------------------------------------------------

function main() {
  console.log('Computing the D-07 unreliable-segment severity-tier calibration...\n');

  let archive;
  try {
    archive = loadArchive(STREAMS_DIR);
  } catch (error) {
    console.error(`Error: could not read the archive: ${error.message}`);
    console.error(`Run \`npm run build\` first, then re-run \`npm run compute-unreliable-segment-severity-calibration\`.`);
    process.exitCode = 1;
    return;
  }

  console.log(`Streams scanned: ${archive.streamFileCount}, not computable: ${archive.notComputable}`);

  const cohort = buildFlaggedCohort(archive);
  console.log(`Flagged cohort: ${cohort.members.length} activities (cohort size ${cohort.cohortSize})`);
  if (cohort.members.length === 0) {
    console.error('Error: the flagged cohort is empty — cannot derive a percentile over zero activities.');
    process.exitCode = 1;
    return;
  }

  const selection = selectSevereCut(cohort.fractions, { tolerance: INSENSITIVITY_TOLERANCE });
  for (const r of selection.results) {
    console.log(
      `  q=${r.q}: cut=${r.base} removedDelta=${r.removedDelta} plantedDelta=${r.plantedDelta} pass=${r.pass}`
    );
  }

  const strawman = strawmanCandidate(cohort.fractions, { tolerance: INSENSITIVITY_TOLERANCE });
  console.log(
    `  strawman (q=${STRAWMAN_PERCENTILE}): cut=${strawman.base} removedDelta=${strawman.removedDelta} plantedDelta=${strawman.plantedDelta} pass=${strawman.pass}`
  );

  const distribution = selection.chosen
    ? severityDistribution(archive, selection.chosen.base)
    : { none: 0, minor: 0, severe: 0, notComputable: 0, total: archive.activities.length };

  const markdown = renderCalibrationMarkdown({ archive, cohort, selection, strawman, distribution });
  writeFileSync(OUTPUT_PATH, markdown, 'utf8');
  console.log(`\nWrote ${OUTPUT_PATH}`);

  if (!selection.chosen) {
    console.error('\nNO CANDIDATE CLEARS — no constant named. See the artifact for the full candidate table.');
    process.exitCode = 1;
  }
}

// Self-execution guard, mirroring compute-unreliable-segment-calibration.mjs / compute-coverage-identity-recount.mjs:
// main() runs only under direct invocation, so compute-unreliable-segment-severity-calibration.test.mjs can import
// every pure function above without triggering an archive read or a write to 33-CALIBRATION.md as an import-time
// side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
