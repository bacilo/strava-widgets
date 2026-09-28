/**
 * Phase 36 D-09 — the ceiling RECALIBRATION artifact of record (PR-08).
 *
 * Phase 28's `28-CEILING-CALIBRATION.md` (and its generator,
 * `compute-pr-ceiling-calibration.mjs`) records how the personal plausibility
 * ceiling was DERIVED — the constants `CEILING_K`/`CEILING_MIN_POPULATION`
 * and the archive evidence that justified them. This script and its artifact
 * (`.planning/phases/36-.../36-CEILING-RECALIBRATION.md`) record something
 * different: how every per-distance ceiling MOVED once Phase 36's
 * clean-window search began partitioning contaminated timings out of the
 * ceiling's own input population. Neither constant changes; only the
 * population each distance's ceiling is derived from does.
 *
 * PROVENANCE RULE (the only one this file obeys): the artifact's
 * `**Generated:**` line is a wall-clock `new Date().toISOString()` plus each
 * input document's own `generatedAt` — NEVER the current commit's own
 * identifying hash (queried via the version-control CLI) and NEVER a hash of
 * any source file. A committed artifact embedding a commit-changing value
 * can never regenerate clean, and a source hash breaks the same
 * byte-identity proof for a different reason (a content hash moves every
 * time the described content moves, which is exactly what this artifact is
 * FOR). Neither a version-control-hash query nor Node's hashing module
 * appear anywhere below, by construction, not merely by omission — there is
 * no `import` of `child_process` or a cryptographic-hash module anywhere in
 * this file.
 *
 * STRUCTURE mirrors `scripts/compute-pr-ceiling-diff.mjs` (the direct
 * precedent named in 36-CONTEXT.md D-11): pure exported functions with zero
 * file I/O, plus one `main()` gated behind the standard self-execution guard
 * so `compute-ceiling-recalibration.test.mjs` can import every pure function
 * without triggering an archive sweep or a write to the artifact as an
 * import-time side effect.
 *
 * MUTATION SAFETY (T-36-54): `main()` runs the real `computeBestEfforts`
 * exactly once, against a throwaway `statsDir` AND a throwaway
 * ceiling-state path (both under `os.tmpdir()`, removed in a `finally`) — so
 * generating this report can never rewrite `data/stats/best-efforts.json`
 * or the committed `data/best-effort-ceiling.json`. The ceiling-state
 * write-gate's own opt-in flag (36-07) is never passed here; this generator
 * only ever READS the committed baseline (via `loadCeilingState`), which
 * plan 36-07's own docblock states is safe — "reading is safe; only the
 * write was the hazard."
 *
 * Only write target: this script's own OUTPUT_PATH. No other filesystem
 * write call exists anywhere below — the synchronous write function is
 * imported once and called exactly once, at the bottom of `main()`.
 *
 * T-36-57 (mitigate): an activity id or a reason string is only ever
 * rendered into a markdown table cell through `safeActivityId`/`safeCell`,
 * reused verbatim from `compute-pr-ceiling-diff.mjs`'s own sanitizers.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { computeBestEfforts } from '../dist/analytics/compute-best-efforts.js';
import { TARGET_METERS, TARGET_ORDER } from '../dist/analytics/best-effort.types.js';
import { isPlausible, WORLD_RECORD_SPEED_MPS } from '../dist/analytics/best-effort-utils.js';
import {
  CEILING_MIN_POPULATION,
  deriveCeilings,
  percentileNearestRank,
} from '../dist/analytics/best-effort-ceiling.js';
import { loadCeilingState } from '../dist/analytics/best-effort-ceiling-state.js';
import { FileStore } from '../dist/storage/file-store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const OUTPUT_PATH = join(
  ROOT_DIR,
  '.planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-CEILING-RECALIBRATION.md'
);
const COMMITTED_BASELINE_PATH = 'data/best-effort-ceiling.json';

const REGENERATE_COMMAND = 'npm run compute-ceiling-recalibration';

/** T-36-57: an activity id is only ever emitted after matching this shape. */
const VALID_ACTIVITY_ID = /^i?\d{1,20}$/;

/**
 * D-07-style bound on the departures list rendered per distance: a
 * population can lose or gain hundreds of members (10k: 1468 -> 1147 in the
 * probe), and an unbounded per-effort listing would make the artifact
 * unreadable. Mirrors the discipline `CONTAMINATION_REASON_SEGMENT_CAP`
 * already established in `compute-best-efforts.ts` for the same reason —
 * bound the RENDERING, state the true count regardless.
 */
const DEPARTURES_RENDER_CAP = 10;

/**
 * 36-CONTEXT.md's own "Archive-wide, per-distance ceiling recalibration"
 * probe table (section "Measured during this discussion (throwaway probe)")
 * — quoted verbatim so the artifact's `## Reconciliation` section can state,
 * per distance, how this run's own measured figures compare to that
 * throwaway probe. Per ROADMAP criterion 1 and 36-CONTEXT.md's own repeated
 * instruction, this is a REFERENCE TO RECONCILE AGAINST, never a pinned
 * expected value — never read by any derivation function above, feeds only
 * the Reconciliation section's rendered text.
 */
const CONTEXT_PROBE_TABLE = {
  '400m': { populationBefore: 1834, populationAfter: 1858, ceilingBefore: 5.1108, ceilingAfter: 5.0297 },
  '1k': { populationBefore: 1852, populationAfter: 1854, ceilingBefore: 4.7497, ceilingAfter: 4.7106 },
  '1mi': { populationBefore: 1851, populationAfter: 1848, ceilingBefore: 4.6282, ceilingAfter: 4.5977 },
  '5k': { populationBefore: 1788, populationAfter: 1726, ceilingBefore: 4.3453, ceilingAfter: 4.3384 },
  '10k': { populationBefore: 1468, populationAfter: 1147, ceilingBefore: 4.2204, ceilingAfter: 4.2522 },
  half: { populationBefore: 104, populationAfter: 69, ceilingBefore: 4.4017, ceilingAfter: null },
  marathon: { populationBefore: 0, populationAfter: 0, ceilingBefore: null, ceilingAfter: null },
};

/**
 * `best-effort-ceiling.ts:191`'s own quoted 1mi docblock figures — "4.628
 * m/s derived from 1,851 filtered efforts with p90 3.616 m/s". This is the
 * ONE available cross-check that `reconstructOldEfforts`'s BEFORE population
 * is on the same footing as the shipped pre-Phase-36 pipeline (36-CONTEXT.md
 * § "Validation that the probe is on the same footing as the shipped
 * pipeline"). Quoted at the docblock's own 3-decimal precision.
 */
const ONE_MI_DOCBLOCK_REFERENCE = { ceilingMps: 4.628, p90Mps: 3.616, populationN: 1851 };

// ---------------------------------------------------------------------------
// Pure functions — importable without I/O (the guard test's contract)
// ---------------------------------------------------------------------------

/** T-36-57: renders an activity id only after validating its shape. */
function safeActivityId(activityId) {
  if (typeof activityId === 'string' && VALID_ACTIVITY_ID.test(activityId)) return activityId;
  return '(malformed id)';
}

/** T-36-57: strips characters that would break a markdown table cell or inject a link. */
function safeCell(value) {
  return String(value).replace(/[\n\r|]/g, ' ').trim();
}

/**
 * The OLD-STATE RECONSTRUCTION rule (Phase 36, genuinely NEW — NOT a copy of
 * `compute-pr-ceiling-diff.mjs`'s `reconstructOldDocument`, which reconstructs
 * OLD *demotions* from a document whose *durations* never moved). Phase 36's
 * wrinkle: the clean-window search moves the DURATION itself, so the OLD
 * duration must first be recovered before OLD plausibility can even be
 * re-evaluated. For every effort in `newDoc`, exactly one of three cases
 * applies (stated here so a reader can audit which one fired):
 *
 *   1. `effort.contaminated != null` (Branch 2, D-05): a clean sub-interval
 *      was found and the effort now ranks on the CLEAN figure, but its
 *      ORIGINAL unpartitioned window is preserved verbatim in
 *      `contaminated.durationSec` — that IS the pre-Phase-36 duration, no
 *      recomputation needed.
 *   2. `effort.demotion?.guard === 'unreliable-segment'` (Branch 3, D-06): no
 *      clean sub-interval covers the distance, so the effort is kept with
 *      its CONTAMINATED (raw, unconstrained) figure living in its own
 *      top-level `durationSec` — already the unconstrained figure by D-06's
 *      own construction, so no recomputation is needed here either.
 *   3. Neither: the window never intersected a segment (Branch 1), so
 *      today's top-level `durationSec` IS the pre-Phase-36 duration
 *      unchanged.
 *
 * Once the OLD duration is known, the OLD DEMOTION is RECOMPUTED — never
 * copied from `effort.demotion` — because the pre-Phase-36 code evaluated
 * `isPlausible` against the UNCONSTRAINED figure, and for case 1 that figure
 * differs from what `isPlausible` was actually evaluated against in the NEW
 * document (the clean figure). `isPlausible`/`WORLD_RECORD_SPEED_MPS` are
 * imported from the shipped `dist/analytics/` modules — never
 * re-implemented — and `activityMaxSpeeds` supplies each activity's own
 * `max_speed`, read by the caller from `data/activities/{id}.json` (this
 * document carries no `max_speed` field at all).
 *
 * The OLD reconstruction can only ever produce `demotion: null` or a
 * `{ guard: 'world-record' | 'max-speed', reason }` pair — never `'ceiling'`
 * (no OLD ceiling exists yet at this point; deriving it is exactly what this
 * script's caller does NEXT, from this function's own output) and never
 * `'unreliable-segment'` (that guard, and the clean-window search producing
 * it, is the Phase 36 change this reconstruction is undoing).
 *
 * Returns a flat array (not grouped by distance) — one row per effort — each
 * carrying `activityId`, `distance`, `durationSec` (the OLD figure),
 * `impliedSpeedMps`, `demotion` (the RECOMPUTED old demotion) and
 * `excludedFromRecords` (read straight off the NEW document: the exclusions
 * file is unchanged between OLD and NEW, so this flag cannot differ).
 */
export function reconstructOldEfforts(newDoc, activityMaxSpeeds) {
  const rows = [];
  const activities = newDoc?.activities ?? {};

  for (const activityId of Object.keys(activities)) {
    const activity = activities[activityId];
    if (!activity) continue;

    const maxSpeedMps =
      activityMaxSpeeds instanceof Map ? activityMaxSpeeds.get(activityId) : activityMaxSpeeds?.[activityId];

    for (const effort of activity.efforts ?? []) {
      if (!effort) continue;
      const distance = effort.distance;
      const meters = TARGET_METERS[distance];
      if (!meters) continue;

      // The three-case rule, stated above in this function's own docblock.
      let oldDurationSec;
      if (effort.contaminated != null) {
        oldDurationSec = effort.contaminated.durationSec; // case 1
      } else {
        oldDurationSec = effort.durationSec; // cases 2 and 3 — already the unconstrained figure
      }

      if (!(oldDurationSec > 0)) continue;

      const impliedSpeedMps = meters / oldDurationSec;
      const worldRecordSpeedMps = WORLD_RECORD_SPEED_MPS[distance];
      const plausibility = isPlausible(impliedSpeedMps, maxSpeedMps, worldRecordSpeedMps);
      const demotion = plausibility.ok ? null : { guard: plausibility.guard, reason: plausibility.reason };

      rows.push({
        activityId,
        distance,
        durationSec: oldDurationSec,
        impliedSpeedMps,
        demotion,
        excludedFromRecords: effort.excludedFromRecords === true,
      });
    }
  }

  return rows;
}

/**
 * Flattens the NEW document's `activities` into the SAME per-effort shape
 * `reconstructOldEfforts` returns, plus `contaminated` (needed by
 * `buildRecalibrationReport` to classify a departure's reason). Not exported
 * — the test file builds this shape by hand, mirroring
 * `compute-pr-ceiling-diff.test.mjs`'s own `makeEffort`/`makeActivity`
 * pattern, so `buildRecalibrationReport` can be tested without a real
 * archive read.
 */
function flattenNewEfforts(newDoc) {
  const rows = [];
  const activities = newDoc?.activities ?? {};

  for (const activityId of Object.keys(activities)) {
    const activity = activities[activityId];
    if (!activity) continue;

    for (const effort of activity.efforts ?? []) {
      if (!effort) continue;
      rows.push({
        activityId,
        distance: effort.distance,
        durationSec: effort.durationSec,
        impliedSpeedMps:
          TARGET_METERS[effort.distance] && effort.durationSec > 0
            ? TARGET_METERS[effort.distance] / effort.durationSec
            : null,
        demotion: effort.demotion ?? null,
        excludedFromRecords: effort.excludedFromRecords === true,
        contaminated: effort.contaminated ?? null,
      });
    }
  }

  return rows;
}

/**
 * Builds `Map<TargetDistanceKey, number[]>` of implied speeds under
 * PRODUCTION'S OWN Pass-1 accumulation rule (mirrored from Phase 28's own
 * `compute-pr-ceiling-calibration.mjs`'s `buildFilteredPopulations`, whose
 * docblock states this exact membership precisely): an effort enters only
 * when it is NOT owner-excluded and its demotion is `null` OR its guard is
 * `'ceiling'` — a ceiling demotion happens AFTER Pass 1 accumulates, so it
 * cannot have removed an effort from the population the ceiling is itself
 * derived from. A `'world-record'`, `'max-speed'` or `'unreliable-segment'`
 * guard DOES exclude — all three are decided before/independent of Pass 1's
 * own accumulation (the absolute guards at construction time; D-06's
 * no-clean-window guard structurally never reaches `byDistance` either).
 *
 * `useOld` selects which of the two callers' inputs this is being applied
 * to, and is asserted, not merely documented: `reconstructOldEfforts` can
 * never produce a `'ceiling'` or `'unreliable-segment'` guard (see its own
 * docblock), so a `useOld: true` record carrying either is a broken
 * reconstruction, not a legitimate old-guard value — this function throws
 * rather than silently accepting one, so a future regression in
 * `reconstructOldEfforts` cannot pass unnoticed by only ever being fed
 * through the lenient `useOld: false` path.
 */
export function buildPopulations(efforts, { useOld }) {
  const populations = new Map();
  for (const key of TARGET_ORDER) populations.set(key, []);

  for (const effort of efforts) {
    const guard = effort.demotion ? effort.demotion.guard : null;

    if (useOld && (guard === 'ceiling' || guard === 'unreliable-segment')) {
      throw new Error(
        `buildPopulations: a useOld:true record for ${effort.activityId}|${effort.distance} carries guard ` +
          `'${guard}', which reconstructOldEfforts never assigns — the OLD reconstruction rule is broken.`
      );
    }

    if (effort.excludedFromRecords) continue;
    if (guard === 'world-record' || guard === 'max-speed' || guard === 'unreliable-segment') continue;

    const meters = TARGET_METERS[effort.distance];
    if (!meters || !(effort.durationSec > 0)) continue;

    const list = populations.get(effort.distance);
    if (!list) continue;
    list.push(meters / effort.durationSec);
  }

  return populations;
}

/**
 * The same membership rule `buildPopulations` applies, but keeping
 * `activityId` (and the per-effort speed) rather than collapsing to a bare
 * `number[]` — needed for `buildRecalibrationReport`'s departures set
 * difference (WHICH activity/distance pairs left the population, not merely
 * how many). Not exported; `buildPopulations` above is the public,
 * plan-named surface for the count-only view.
 */
function buildMembership(efforts, distanceKey) {
  const membership = new Map();
  for (const effort of efforts) {
    if (effort.distance !== distanceKey) continue;
    if (effort.excludedFromRecords) continue;
    const guard = effort.demotion ? effort.demotion.guard : null;
    if (guard === 'world-record' || guard === 'max-speed' || guard === 'unreliable-segment') continue;
    const meters = TARGET_METERS[effort.distance];
    if (!meters || !(effort.durationSec > 0)) continue;
    membership.set(effort.activityId, meters / effort.durationSec);
  }
  return membership;
}

/** The median (p50) of an unsorted speed array, via the shipped `percentileNearestRank` — never a second percentile definition. */
function medianMps(speedsMps) {
  const sorted = [...speedsMps].sort((a, b) => a - b);
  return percentileNearestRank(sorted, 0.5);
}

/**
 * D-12's "which matters more than how many": one entry per activity/distance
 * pair present in the OLD ranked population (per `buildMembership`'s rule)
 * but ABSENT from the NEW one, for exactly one distance. Classified by
 * inspecting the corresponding NEW effort (`newEfforts`, already flattened):
 * `contaminated != null` -> `'moved-to-clean-window'` (the effort still
 * ranks, but on a different — here, population-excluding — figure);
 * `demotion?.guard === 'unreliable-segment'` -> `'no-clean-window'` (the
 * effort no longer ranks at all). Neither case fires for a real departure ->
 * `'other-membership-change'`, a defensive fallback this repository's own
 * measured evidence (`best-effort.types.ts`'s `ComputedEffort.demotion`
 * docblock: "0 of 440 no-clean-window occurrences independently fail an
 * absolute guard") suggests should not occur on the live archive, but which
 * this function reports honestly rather than mis-attributing to one of the
 * two named mechanisms.
 */
function buildDepartures(distance, oldMembership, newMembership, newEfforts) {
  const departingIds = [...oldMembership.keys()]
    .filter((id) => !newMembership.has(id))
    .sort((a, b) => a.localeCompare(b));

  return departingIds.map((activityId) => {
    const meta = newEfforts.find((e) => e.activityId === activityId && e.distance === distance);
    let reason = 'other-membership-change';
    if (meta?.contaminated != null) reason = 'moved-to-clean-window';
    else if (meta?.demotion?.guard === 'unreliable-segment') reason = 'no-clean-window';

    return { activityId, oldSpeedMps: oldMembership.get(activityId), reason };
  });
}

/**
 * TEMPLATED prose (D-12), parameterised entirely by `row`'s own measured
 * values — never a fixed string, and non-empty for every `movementKind`.
 * `'rose'` states the mechanism in terms of the row's OWN numbers (the
 * departing efforts' median OLD implied speed vs the retained population's
 * own median), never asserted, always computed. `'unchanged'` states a
 * MACHINE-CHECKED count of efforts at this distance whose window intersected
 * a segment (`row.segmentIntersectionCount`, derived from `newEfforts` by
 * the caller) — never assumed to be zero; the sentence states whatever the
 * count actually is, honestly, even though on the real archive no distance
 * currently reaches `'unchanged'` (every probed distance's ceiling moved by
 * a nonzero amount) and the count is exercised only by this file's own test
 * fixture.
 */
export function describeMovementCause(row) {
  const { distance, populationBefore, populationAfter, p90Before, p90After, ceilingBefore, ceilingAfter, movementKind, departures } = row;

  const movedToCleanWindow = departures.filter((d) => d.reason === 'moved-to-clean-window').length;
  const noCleanWindow = departures.filter((d) => d.reason === 'no-clean-window').length;
  const otherDepartures = departures.filter((d) => d.reason === 'other-membership-change').length;
  const departureBreakdown =
    `${movedToCleanWindow} moved to a slower clean sub-interval, ${noCleanWindow} lost every clean ` +
    `sub-interval and no longer rank` + (otherDepartures > 0 ? `, ${otherDepartures} left for another reason` : '');

  switch (movementKind) {
    case 'fell':
      return (
        `${distance}'s ceiling FELL from ${fmtMps(ceilingBefore)} m/s to ${fmtMps(ceilingAfter)} m/s ` +
        `(p90 ${fmtMps(p90Before)} -> ${fmtMps(p90After)} m/s, population ${populationBefore} -> ${populationAfter}): ` +
        `${departures.length} effort(s) left the ranked population at this distance (${departureBreakdown}), ` +
        `pulling the bulk (p90) of what remains downward.`
      );
    case 'rose': {
      const departingMedian = medianMps(departures.map((d) => d.oldSpeedMps));
      return (
        `${distance}'s ceiling ROSE from ${fmtMps(ceilingBefore)} m/s to ${fmtMps(ceilingAfter)} m/s ` +
        `(p90 ${fmtMps(p90Before)} -> ${fmtMps(p90After)} m/s, population ${populationBefore} -> ${populationAfter}): ` +
        `the ${departures.length} departing effort(s) (${departureBreakdown}) carried a median OLD implied speed of ` +
        `${fmtMps(departingMedian)} m/s, against the RETAINED population's own median of ` +
        `${fmtMps(row.retainedMedianMps)} m/s — removing members slower than the retained median raises the p90 ` +
        `of what remains; no retained effort itself got faster.`
      );
    }
    case 'unchanged':
      return (
        `${distance}'s ceiling is unchanged at ${fmtMps(ceilingAfter)} m/s (p90 ${fmtMps(p90After)} m/s, ` +
        `population ${populationAfter}): a machine-checked count of ${row.segmentIntersectionCount} effort(s) at ` +
        `this distance had a window intersecting a segment, so the clean-window search made no change to this ` +
        `distance's ranked population.`
      );
    case 'lost-ceiling':
      return (
        `${distance} LOST its personal ceiling: population fell from ${populationBefore} to ${populationAfter}, ` +
        `below \`CEILING_MIN_POPULATION\` (${CEILING_MIN_POPULATION}) — see "## Fail-Open Findings" below. ` +
        `${departures.length} effort(s) left the ranked population (${departureBreakdown}).`
      );
    case 'gained-ceiling':
      return (
        `${distance} newly GAINED a personal ceiling: population rose from ${populationBefore} to ${populationAfter}, ` +
        `now at or above \`CEILING_MIN_POPULATION\` (${CEILING_MIN_POPULATION}), so a ceiling of ` +
        `${fmtMps(ceilingAfter)} m/s (p90 ${fmtMps(p90After)} m/s) is now derivable where none existed before.`
      );
    case 'never-derivable':
      return (
        `${distance}'s population was empty both before (${populationBefore}) and after (${populationAfter}) this ` +
        `run — no personal ceiling has ever been derivable for this distance.`
      );
    default:
      throw new Error(`describeMovementCause: unknown movementKind '${movementKind}' for distance ${distance}`);
  }
}

/**
 * Renders `row.departures` (built by `buildRecalibrationReport`) as a
 * single-line, capped, sanitized string — D-12's "names WHICH efforts left
 * the population, not only how many". Each entry carries its activity id
 * (through `safeActivityId`), its OLD implied speed and its departure
 * reason. Capped at `DEPARTURES_RENDER_CAP` with a trailing count, mirroring
 * `segmentIntersectionReason`'s own `+N more` convention in
 * `compute-best-efforts.ts`.
 */
export function describeDepartures(row) {
  const departures = row.departures ?? [];
  if (departures.length === 0) {
    return 'No effort left the ranked population at this distance.';
  }

  const shown = departures.slice(0, DEPARTURES_RENDER_CAP);
  const rendered = shown
    .map((d) => `${safeActivityId(d.activityId)} (OLD implied ${fmtMps(d.oldSpeedMps)} m/s, ${safeCell(d.reason)})`)
    .join('; ');
  const remainder = departures.length - shown.length;
  const moreClause = remainder > 0 ? `; +${remainder} more` : '';

  return `${departures.length} effort(s) left the ranked population: ${rendered}${moreClause}.`;
}

/**
 * D-10: one entry per distance whose ceiling is `null` AFTER this run —
 * whether it WAS non-null before (`'lost-ceiling'`, the half-marathon case)
 * or has ALWAYS been null (`'never-derivable'`, marathon) — carrying both
 * populations and the floor. Both are named findings here: a distance that
 * has always had zero population is not "movement" in the sense the other
 * six rows describe, but it shares the same auditable shape (no personal
 * ceiling exists), so it is not silently excluded from this section either.
 */
export function findFailOpenFindings(report) {
  const findings = [];
  for (const row of report.rows) {
    if (row.ceilingAfter === null) {
      findings.push({
        distance: row.distance,
        populationBefore: row.populationBefore,
        populationAfter: row.populationAfter,
        floor: CEILING_MIN_POPULATION,
        movementKind: row.movementKind,
      });
    }
  }
  return findings;
}

/**
 * D-09/D-11's "drift is reported, never silently absorbed" half: compares
 * the RECONSTRUCTED old ceilings (`oldCeilings`, this run's own
 * `reconstructOldEfforts` + `deriveCeilings` output) against the COMMITTED
 * `data/best-effort-ceiling.json` (`committedBaseline`, as loaded by
 * `loadCeilingState` — `null` when no usable file exists). Exact-equality
 * comparison (`!==`), never an epsilon, mirroring
 * `best-effort-ceiling-state.ts`'s own `diffCeilingState` precedent — both
 * are order-statistic-derived, four-decimal-rounded values, so an epsilon
 * would hide exactly the drift this function exists to catch.
 *
 * Returns `{ available, rows }`: `available: false` when there was nothing
 * durable to compare against at all (distinct from `available: true, rows:
 * []`, which means a comparison WAS made and found no disagreement — a
 * missing baseline and a perfectly-agreeing one must not render the same
 * way).
 */
export function diffAgainstCommittedBaseline(committedBaseline, oldCeilings) {
  if (!committedBaseline) {
    return { available: false, rows: [] };
  }

  const rows = [];
  for (const distance of TARGET_ORDER) {
    const committed = committedBaseline.ceilings ? committedBaseline.ceilings[distance] : undefined;
    const reconstructed = oldCeilings[distance];
    if (!committed || !reconstructed) continue;

    const ceilingChanged = committed.ceilingMps !== reconstructed.ceilingMps;
    const p90Changed = committed.p90Mps !== reconstructed.p90Mps;
    const populationChanged = committed.populationN !== reconstructed.populationN;
    if (!ceilingChanged && !p90Changed && !populationChanged) continue;

    rows.push({
      distance,
      reconstructedCeilingMps: reconstructed.ceilingMps,
      committedCeilingMps: committed.ceilingMps,
      reconstructedP90Mps: reconstructed.p90Mps,
      committedP90Mps: committed.p90Mps,
      reconstructedPopulationN: reconstructed.populationN,
      committedPopulationN: committed.populationN,
    });
  }

  return { available: true, rows };
}

/** `n` m/s formatted to four decimals, or an em dash for `null`/`undefined`. */
function fmtMps(mps) {
  return mps === null || mps === undefined ? '—' : mps.toFixed(4);
}

/** A signed delta formatted to four decimals, or an em dash for `null`. */
function fmtDelta(delta) {
  if (delta === null || delta === undefined) return '—';
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(4)}`;
}

/**
 * Builds the full recalibration report `renderRecalibrationMarkdown` renders.
 * ALL measurement happens HERE, once — the renderer only formats fields
 * already on this object and must remain a pure function of it (the same
 * idempotence contract `renderCalibrationMarkdown` states in
 * `compute-pr-ceiling-calibration.mjs`: the only field that may vary between
 * two calls over an unchanged `report` is `generatedAt` itself).
 *
 * `oldCeilings`/`newCeilings` (both `Record<TargetDistanceKey,
 * CeilingDerivation>`) and `oldEfforts`/`newEfforts` (flat per-effort arrays,
 * the shapes `reconstructOldEfforts`/`flattenNewEfforts` produce) are all
 * computed by the caller — this function performs no file I/O and calls
 * `deriveCeilings` nowhere (it is handed both derivations already made, so a
 * ceiling is never derived twice by two different code paths with two
 * chances to disagree). `committedBaseline` and `inputs` (the `## Inputs`
 * section's own fields — archive size, each document's own `generatedAt`,
 * the committed baseline's path) are likewise supplied by the caller.
 */
export function buildRecalibrationReport({ oldCeilings, newCeilings, oldEfforts, newEfforts, committedBaseline, inputs }) {
  const rows = TARGET_ORDER.map((distance) => {
    const oldC = oldCeilings[distance];
    const newC = newCeilings[distance];

    const populationBefore = oldC.populationN;
    const populationAfter = newC.populationN;
    const p90Before = oldC.p90Mps;
    const p90After = newC.p90Mps;
    const ceilingBefore = oldC.ceilingMps;
    const ceilingAfter = newC.ceilingMps;

    let movementKind;
    let delta = null;
    if (ceilingBefore === null && ceilingAfter === null) {
      movementKind = 'never-derivable';
    } else if (ceilingBefore !== null && ceilingAfter === null) {
      movementKind = 'lost-ceiling';
    } else if (ceilingBefore === null && ceilingAfter !== null) {
      movementKind = 'gained-ceiling';
    } else {
      delta = ceilingAfter - ceilingBefore;
      // Exact equality, never an epsilon — mirroring diffCeilingState's own
      // precedent; both figures are already rounded to 4dp by deriveCeiling.
      movementKind = ceilingAfter === ceilingBefore ? 'unchanged' : delta > 0 ? 'rose' : 'fell';
    }

    const oldMembership = buildMembership(oldEfforts, distance);
    const newMembership = buildMembership(newEfforts, distance);
    const departures = buildDepartures(distance, oldMembership, newMembership, newEfforts);
    const retainedMedianMps = medianMps([...newMembership.values()]);
    const segmentIntersectionCount = newEfforts.filter(
      (e) => e.distance === distance && (e.contaminated != null || e.demotion?.guard === 'unreliable-segment')
    ).length;

    const row = {
      distance,
      populationBefore,
      populationAfter,
      p90Before,
      p90After,
      ceilingBefore,
      ceilingAfter,
      delta,
      movementKind,
      departures,
      retainedMedianMps,
      segmentIntersectionCount,
    };
    row.cause = describeMovementCause(row);
    return row;
  });

  const partialReport = { rows };
  const failOpenFindings = findFailOpenFindings(partialReport);
  const baselineDrift = diffAgainstCommittedBaseline(committedBaseline, oldCeilings);

  const reconciliation = TARGET_ORDER.map((distance) => {
    const row = rows.find((r) => r.distance === distance);
    const probe = CONTEXT_PROBE_TABLE[distance];
    return {
      distance,
      populationBefore: row.populationBefore,
      populationAfter: row.populationAfter,
      probePopulationBefore: probe.populationBefore,
      probePopulationAfter: probe.populationAfter,
      ceilingBefore: row.ceilingBefore,
      ceilingAfter: row.ceilingAfter,
      probeCeilingBefore: probe.ceilingBefore,
      probeCeilingAfter: probe.ceilingAfter,
    };
  });

  const oneMiOld = oldCeilings['1mi'];
  const oneMiCrossCheck = {
    referenceCeilingMps: ONE_MI_DOCBLOCK_REFERENCE.ceilingMps,
    referenceP90Mps: ONE_MI_DOCBLOCK_REFERENCE.p90Mps,
    referencePopulationN: ONE_MI_DOCBLOCK_REFERENCE.populationN,
    measuredCeilingMps: oneMiOld.ceilingMps,
    measuredP90Mps: oneMiOld.p90Mps,
    measuredPopulationN: oneMiOld.populationN,
    matches:
      oneMiOld.populationN === ONE_MI_DOCBLOCK_REFERENCE.populationN &&
      oneMiOld.ceilingMps !== null &&
      Math.abs(oneMiOld.ceilingMps - ONE_MI_DOCBLOCK_REFERENCE.ceilingMps) < 0.0005 &&
      oneMiOld.p90Mps !== null &&
      Math.abs(oneMiOld.p90Mps - ONE_MI_DOCBLOCK_REFERENCE.p90Mps) < 0.0005,
  };

  return {
    generatedAt: new Date().toISOString(),
    rows,
    failOpenFindings,
    baselineDrift,
    reconciliation,
    oneMiCrossCheck,
    inputs,
  };
}

/**
 * Renders `36-CEILING-RECALIBRATION.md` from a `report` built by
 * `buildRecalibrationReport`. Pure string assembly: no `Date`, no
 * `Math.random`, no `process` read, and no unsorted object-key/Set/Map
 * iteration reaches the output — every loop below iterates `report.rows` (in
 * `TARGET_ORDER`, fixed by `buildRecalibrationReport`) or an already-sorted
 * array. The only field that may vary between two calls over an unchanged
 * `report` (aside from `generatedAt` itself, read from `report`, never
 * generated HERE) would be a bug in this function. NO sign-off block, no
 * approval checkbox and no sha256 — this artifact stays purely generated and
 * therefore idempotent; a signature, when one is needed, belongs to a
 * separate VALIDATION-style document bound to this file's content, never
 * embedded in it.
 */
export function renderRecalibrationMarkdown(report) {
  const lines = [];

  lines.push('# Phase 36 — Ceiling Recalibration');
  lines.push('');
  lines.push(
    'This file is machine-written and regenerated by `npm run compute-ceiling-recalibration`. It ' +
      'records how every per-distance personal plausibility ceiling MOVED once the clean-window search ' +
      '(Phase 36 PR-06/PR-07) began partitioning contaminated timings out of the ceiling\'s own input ' +
      'population — a companion to Phase 28\'s `28-CEILING-CALIBRATION.md`, which records how the ' +
      'ceiling was DERIVED, not how it moved. Neither `CEILING_K` nor `CEILING_MIN_POPULATION` changes; ' +
      'only the population each distance\'s ceiling is derived from does.'
  );
  lines.push('');
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push('');

  // ## Headline
  lines.push('## Headline: per-distance ceiling before -> after');
  lines.push('');
  lines.push('| Distance | Ceiling before (m/s) | Ceiling after (m/s) | Delta | Movement | Population before -> after |');
  lines.push('|---|---|---|---|---|---|');
  for (const row of report.rows) {
    lines.push(
      `| ${row.distance} | ${fmtMps(row.ceilingBefore)} | ${fmtMps(row.ceilingAfter)} | ${fmtDelta(row.delta)} | ` +
        `${row.movementKind} | ${row.populationBefore} -> ${row.populationAfter} |`
    );
  }
  lines.push('');

  // ## Per-distance detail
  lines.push('## Per-distance detail');
  lines.push('');
  for (const row of report.rows) {
    lines.push(`### ${row.distance}`);
    lines.push('');
    lines.push(`- Population: ${row.populationBefore} -> ${row.populationAfter}`);
    lines.push(`- p90: ${fmtMps(row.p90Before)} -> ${fmtMps(row.p90After)} m/s`);
    lines.push(`- Ceiling: ${fmtMps(row.ceilingBefore)} -> ${fmtMps(row.ceilingAfter)} m/s (${fmtDelta(row.delta)})`);
    lines.push(`- Movement: ${row.movementKind}`);
    lines.push(`- Cause: ${row.cause}`);
    lines.push(`- Departures: ${describeDepartures(row)}`);
    lines.push('');
  }

  // ## Fail-Open Findings
  lines.push('## Fail-Open Findings');
  lines.push('');
  if (report.failOpenFindings.length === 0) {
    lines.push(
      'None in this run — every distance retains a derivable ceiling on both sides, or has always been empty.'
    );
  } else {
    lines.push(
      `\`CEILING_MIN_POPULATION\` = ${CEILING_MIN_POPULATION}. The floor may NOT be moved to rescue a distance ` +
        'below it — barred by Phase 28 D-02 and Phase 27 D-02\'s anti-quota rule; the constant is fixed by ' +
        'order-statistic arithmetic and takes no population-count argument.'
    );
    lines.push('');
    lines.push('| Distance | Population before | Population after | Floor |');
    lines.push('|---|---|---|---|');
    for (const f of report.failOpenFindings) {
      lines.push(`| ${f.distance} | ${f.populationBefore} | ${f.populationAfter} | ${f.floor} |`);
    }
  }
  lines.push('');

  // ## Baseline Drift
  lines.push('## Baseline Drift');
  lines.push('');
  if (!report.baselineDrift.available) {
    lines.push(
      'No committed baseline was available to compare against (`data/best-effort-ceiling.json` missing or ' +
        'malformed) — this run has nothing durable to diff.'
    );
  } else if (report.baselineDrift.rows.length === 0) {
    lines.push(
      'None — the reconstructed OLD ceilings agree with the committed `data/best-effort-ceiling.json` at every distance.'
    );
  } else {
    lines.push(
      'The reconstruction and the shipped baseline are two different things; any gap belongs here, never silently absorbed:'
    );
    lines.push('');
    lines.push(
      '| Distance | Reconstructed ceiling | Committed ceiling | Reconstructed p90 | Committed p90 | Reconstructed n | Committed n |'
    );
    lines.push('|---|---|---|---|---|---|---|');
    for (const d of report.baselineDrift.rows) {
      lines.push(
        `| ${d.distance} | ${fmtMps(d.reconstructedCeilingMps)} | ${fmtMps(d.committedCeilingMps)} | ` +
          `${fmtMps(d.reconstructedP90Mps)} | ${fmtMps(d.committedP90Mps)} | ${d.reconstructedPopulationN} | ` +
          `${d.committedPopulationN} |`
      );
    }
  }
  lines.push('');

  // ## Reconciliation
  lines.push('## Reconciliation');
  lines.push('');
  lines.push(
    'Every figure below is a reference to reconcile against, never a pinned expected value (ROADMAP ' +
      'criterion 1) — `36-CONTEXT.md`\'s own probe table was a throwaway measurement, not a fixture this ' +
      'run is required to reproduce exactly. Drift is reported, never silently absorbed.'
  );
  lines.push('');
  lines.push(
    '| Distance | Live pop before/after | Probe pop before/after | Live ceiling before/after | Probe ceiling before/after |'
  );
  lines.push('|---|---|---|---|---|');
  for (const r of report.reconciliation) {
    lines.push(
      `| ${r.distance} | ${r.populationBefore} / ${r.populationAfter} | ${r.probePopulationBefore} / ` +
        `${r.probePopulationAfter} | ${fmtMps(r.ceilingBefore)} / ${fmtMps(r.ceilingAfter)} | ` +
        `${fmtMps(r.probeCeilingBefore)} / ${fmtMps(r.probeCeilingAfter)} |`
    );
  }
  lines.push('');
  const c = report.oneMiCrossCheck;
  lines.push(
    `**1mi BEFORE cross-check against \`best-effort-ceiling.ts:191\`'s own docblock** ("4.628 m/s derived ` +
      `from 1,851 filtered efforts with p90 3.616 m/s"): this run's reconstructed 1mi BEFORE ceiling is ` +
      `${fmtMps(c.measuredCeilingMps)} m/s over a population of ${c.measuredPopulationN} with p90 ` +
      `${fmtMps(c.measuredP90Mps)} m/s — ${c.matches ? 'REPRODUCES the docblock figures' : 'DOES NOT reproduce the docblock figures exactly; the gap is recorded as a finding, the generator was not tuned to force a match'}.`
  );
  lines.push('');

  // ## Inputs
  //
  // Deliberately does NOT render `report.inputs.newDocGeneratedAt` (the
  // fresh computeBestEfforts sweep's own wall-clock stamp): that value is
  // re-minted on every regeneration, milliseconds apart from this artifact's
  // own `**Generated:**` line above, and rendering it would introduce a
  // SECOND run-varying value the idempotence proof's own line-strip (which
  // only strips the `**Generated:**` line) cannot account for — an artifact
  // that is idempotent modulo exactly one stated line, not two undocumented
  // ones. The archive's IDENTITY (its activity count) is stable across
  // consecutive runs of an unchanged archive and is what actually matters
  // for reconciliation; the wall-clock "when did this run happen" question
  // is already answered once, at the top of this file.
  lines.push('## Inputs');
  lines.push('');
  lines.push(
    `- \`data/streams/manifest.json\` + per-activity streams/activities — archive denominator: ` +
      `${report.inputs.archiveSize} activities considered`
  );
  lines.push(
    `- \`${report.inputs.committedBaselinePath}\` — generatedAt: ` +
      `${report.inputs.committedBaselineGeneratedAt ? safeCell(report.inputs.committedBaselineGeneratedAt) : '(no committed baseline available)'}`
  );
  lines.push('');
  lines.push('Regenerate this report against the live committed archive with:');
  lines.push('');
  lines.push('```');
  lines.push(REGENERATE_COMMAND);
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// I/O — one computeBestEfforts sweep, report build, markdown render, write
// ---------------------------------------------------------------------------

async function main() {
  console.log('Computing the Phase 36 ceiling recalibration...\n');

  // T-36-54: both statsDir and the ceiling-state path are throwaway temp
  // paths under os.tmpdir() — this run never writes data/stats/best-efforts.json
  // and never touches the committed data/best-effort-ceiling.json. The
  // ceiling-state write-gate's own opt-in (36-07) is never passed, so this
  // generator is doubly safe even without the throwaway path.
  const tempDir = mkdtempSync(join(tmpdir(), 'ceiling-recalibration-'));
  const throwawayStatsDir = join(tempDir, 'stats');
  const throwawayCeilingStatePath = join(tempDir, 'ceiling-state.json');

  try {
    let newDoc;
    try {
      newDoc = await computeBestEfforts({
        statsDir: throwawayStatsDir,
        ceilingStatePath: throwawayCeilingStatePath,
      });
    } catch (error) {
      console.error(`Error: computeBestEfforts failed: ${error.message}`);
      process.exitCode = 1;
      return;
    }

    // Each activity's own max_speed, for the OLD reconstruction's
    // isPlausible re-evaluation — data/activities/{id}.json is the only
    // place max_speed lives; the best-efforts document never carries it.
    const activityMaxSpeeds = new Map();
    for (const activityId of Object.keys(newDoc.activities)) {
      try {
        const raw = readFileSync(join(ROOT_DIR, 'data/activities', `${activityId}.json`), 'utf8');
        const parsed = JSON.parse(raw);
        activityMaxSpeeds.set(activityId, typeof parsed.max_speed === 'number' ? parsed.max_speed : undefined);
      } catch (error) {
        console.warn(
          `  ${activityId}: could not read max_speed (${error.message}); OLD reconstruction treats it as undefined`
        );
        activityMaxSpeeds.set(activityId, undefined);
      }
    }

    const oldEfforts = reconstructOldEfforts(newDoc, activityMaxSpeeds);
    const newEfforts = flattenNewEfforts(newDoc);

    const oldPopulations = buildPopulations(oldEfforts, { useOld: true });
    const oldCeilings = deriveCeilings(oldPopulations);
    const newCeilings = newDoc.ceilings;

    const fileStore = new FileStore(ROOT_DIR);
    const committedBaseline = await loadCeilingState(fileStore, COMMITTED_BASELINE_PATH);

    const inputs = {
      archiveSize: newDoc.totals.activitiesConsidered,
      newDocGeneratedAt: newDoc.generatedAt,
      committedBaselinePath: COMMITTED_BASELINE_PATH,
      committedBaselineGeneratedAt: committedBaseline ? committedBaseline.generatedAt : null,
    };

    const report = buildRecalibrationReport({
      oldCeilings,
      newCeilings,
      oldEfforts,
      newEfforts,
      committedBaseline,
      inputs,
    });

    console.log('Per-distance movement:');
    for (const row of report.rows) {
      console.log(
        `  ${row.distance}: ${row.movementKind} (${fmtMps(row.ceilingBefore)} -> ${fmtMps(row.ceilingAfter)} m/s, ` +
          `pop ${row.populationBefore} -> ${row.populationAfter})`
      );
    }
    if (report.failOpenFindings.length > 0) {
      console.log(`Fail-open findings: ${report.failOpenFindings.map((f) => f.distance).join(', ')}`);
    }

    const markdown = renderRecalibrationMarkdown(report);

    // The one and only write this script performs.
    writeFileSync(OUTPUT_PATH, markdown, 'utf8');
    console.log(`\nWrote ${OUTPUT_PATH}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

// Self-execution guard, mirroring compute-pr-ceiling-diff.mjs: main() runs
// only under direct invocation, so compute-ceiling-recalibration.test.mjs
// can import every pure function above without triggering an archive sweep
// or a write to 36-CEILING-RECALIBRATION.md as an import-time side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
