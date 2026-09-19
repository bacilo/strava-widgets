/**
 * D-15's classifier-independent recount — the standalone verifier ROADMAP Criterion 5 requires:
 * it opens the SHIPPED `data/stats/best-efforts.json` and `data/dashboard/index.json` off disk
 * with `readFileSync` + `JSON.parse` and counts demoted efforts, and the PR-05 impossible-sample
 * cohort, with its OWN arithmetic.
 *
 * FORBIDDEN, DELIBERATELY: this file has zero `import`/`require`/dynamic-`import()` statements
 * naming the ceiling module (`dist/analytics/best-effort-ceiling.js` or its `src/` equivalent),
 * the compute step (`dist/analytics/compute-best-efforts.js` / `src/` equivalent), the
 * best-effort utils (`dist/analytics/best-effort-utils.js` / `src/` equivalent), or the
 * best-effort types (`dist/analytics/best-effort.types.js` / `src/` equivalent), by any spelling.
 * The reason: a verifier that pulls in the classifier that produced the numbers it is checking
 * agrees with itself by construction — the exact failure mode D-15 exists to rule out, mirroring
 * D-03's discipline for Phase 27's `compute-pace-quality-recount.mjs`.
 *
 * THE BOUND ON ITS CLAIM: this script verifies that what shipped matches what the diff and the
 * document's own totals claim — nothing more. It does NOT and CANNOT arbitrate whether the
 * ceiling multiplier or the world-record/max-speed guards themselves are right; that question
 * belongs to `compute-pr-ceiling-calibration.mjs` and `28-DIFF.md`, which DO import the ceiling
 * logic because that is their job. `recountDemotedActivities`'s flagged-activity count (D-16) is
 * a live measurement that grows with the nightly sync, so no caller may hardcode today's value
 * into shipped source — it must always be re-derived at the moment it is needed.
 *
 * Distance keys come from the documents themselves (`Object.keys(doc.rankings).sort()`), never
 * from `best-effort.types.js`, so this recount shares no vocabulary module with the code it
 * checks.
 *
 * Two populations that must never be conflated (see 28-RESEARCH.md "Ground Truth: the 662-cohort
 * and the pinned fixture"): PR-05's cohort is "activities carrying at least one impossible
 * SAMPLE anywhere in their stream" — a stream-level, per-sample-pair check against the 100m
 * world-record floor. The demoted population is "efforts at one of the seven target distances
 * rejected by a guard" — an effort-level check. A sample can be impossible mid-run without ever
 * landing inside a swept target window. This script reports both numbers and their overlap in
 * both directions; it never treats them as interchangeable. The historically cited 662-of-1,865
 * figure is a 2026-09-10 measurement that drifts as the archive grows via nightly CI sync — it
 * must never become a hardcoded assertion in this file; the cohort count below is always
 * recomputed from the live `data/dashboard/index.json` denominator.
 *
 * Shape follows `scripts/compute-pace-quality-recount.mjs` (Phase 27, D-03): pure exported
 * functions, a guarded `main()` behind the self-execution check, so
 * `compute-pr-ceiling-recount.test.mjs` can import the counting functions without triggering a
 * real file read as an import-time side effect.
 *
 * Default read targets are `data/stats/best-efforts.json` and `data/dashboard/index.json`,
 * overridable via the `--best-efforts <path>` and `--index <path>` CLI flags (`parseInputPaths`)
 * so the same script can be pointed at an archive copy or a worktree where `data/` is absent.
 * Writes nothing, ever.
 *
 * THE CEILING SWEEP (`recountCeilingSweep`, D-15, WR-05, closing 28-VERIFICATION.md gaps 1/3):
 * `recountDemoted` above only reads `effort.demotion` as written by the classifier under test —
 * it agrees with itself by construction if the classifier silently skips an effort. The sweep is
 * the classifier-independent check that catches exactly that shape (CR-01): it walks every effort
 * in the shipped document, recomputes `TARGET_METERS_LOCAL[distance] / durationSec` itself, and
 * compares that against `doc.ceilings[distance].ceilingMps` — never reading `effort.demotion` as
 * the answer to "is this effort over the ceiling", only as the answer to "did something demote
 * it". A pinned fixture whose own `guardIsCeiling` is false is exactly the shape this sweep and
 * `evaluateReport`'s pinned-fixture checks now turn into a verdict failure, not just a printed line.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BEST_EFFORTS_PATH = join(__dirname, '../data/stats/best-efforts.json');
const DASHBOARD_INDEX_PATH = join(__dirname, '../data/dashboard/index.json');
const EXCLUSIONS_PATH = join(__dirname, '../data/best-effort-exclusions.json');

/** The closed set of guard values the shared demotion path is known to emit. */
const KNOWN_GUARDS = new Set(['world-record', 'max-speed', 'ceiling']);

/** The pinned regression activity (D-04): its 400m effort is 45.2s / 8.85 m/s. */
const PINNED_ACTIVITY_ID = '4556693525';
const PINNED_DISTANCE = '400m';
const PINNED_DURATION_SEC = 45.2;

/**
 * Distance meters, declared LOCALLY on purpose (D-15): this file must not import
 * `best-effort.types.js`/`.ts` or any other classifier module for these numbers, even though
 * that module defines the same mapping. Duplicating this tiny constant table is the price of
 * staying a genuinely independent recount rather than sharing vocabulary with the code it checks.
 */
const TARGET_METERS_LOCAL = {
  '400m': 400,
  '1k': 1000,
  '1mi': 1609.344,
  '5k': 5000,
  '10k': 10000,
  half: 21097.5,
  marathon: 42195,
};

/**
 * The two-sentence do-not-conflate caution, printed in `main()`'s output — not only stated in a
 * source comment — naming both PR-05 populations and stating they are different measurements
 * with an overlap, not two views of one number.
 */
const COHORT_VS_DEMOTED_CAUTION =
  'CAUTION: the impossible-sample cohort (activities carrying at least one physically impossible ' +
  'SAMPLE anywhere in their stream) and the demoted-effort population (efforts at one of the seven ' +
  'target distances rejected by a guard) are two different measurements, not two views of one ' +
  'number. A sample can be impossible mid-run without ever landing inside a swept target window, ' +
  'and a demoted effort can occur in an activity whose other samples never crossed the per-sample floor.';

/**
 * Reads and parses a shipped JSON document off disk. Never throws an unhandled error — returns
 * a `{ ok: false, reason }` shape on any failure (missing file, malformed JSON) so `main()` can
 * exit non-zero with a named reason instead of an unhandled exception (T-28-08-A).
 */
export function readShippedJson(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    return { ok: false, reason: `could not read ${path}: ${err.message}` };
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (err) {
    return { ok: false, reason: `could not parse ${path} as JSON: ${err.message}` };
  }
  return { ok: true, doc };
}

/**
 * The recount's own arithmetic over `data/stats/best-efforts.json`, driven entirely off
 * `activities[*].efforts[*].demotion` — never a read of `totals.effortsDemoted` as an answer.
 * Pure: no I/O, hand-testable on any document shape.
 */
export function recountDemoted(bestEffortsDoc) {
  const activities =
    bestEffortsDoc && bestEffortsDoc.activities && typeof bestEffortsDoc.activities === 'object'
      ? bestEffortsDoc.activities
      : {};
  const rankings =
    bestEffortsDoc && bestEffortsDoc.rankings && typeof bestEffortsDoc.rankings === 'object'
      ? bestEffortsDoc.rankings
      : {};
  const distances = Object.keys(rankings).sort();

  const byGuard = { 'world-record': 0, 'max-speed': 0, ceiling: 0, unrecognisedGuards: [] };
  const byDistance = {};
  for (const distance of distances) byDistance[distance] = 0;

  let ownDemotedTotal = 0;
  const demotedWithoutReason = [];

  for (const activityId of Object.keys(activities)) {
    const activity = activities[activityId];
    const efforts = activity && Array.isArray(activity.efforts) ? activity.efforts : [];
    for (const effort of efforts) {
      const demotion = effort.demotion;
      if (!demotion || typeof demotion !== 'object' || typeof demotion.guard !== 'string') continue;

      ownDemotedTotal += 1;
      const label = `${activityId}@${effort.distance}`;

      if (KNOWN_GUARDS.has(demotion.guard)) {
        byGuard[demotion.guard] += 1;
      } else {
        byGuard.unrecognisedGuards.push(`${label} (guard=${JSON.stringify(demotion.guard)})`);
      }

      if (byDistance[effort.distance] === undefined) byDistance[effort.distance] = 0;
      byDistance[effort.distance] += 1;

      if (!demotion.reason || typeof demotion.reason !== 'string' || demotion.reason.length === 0) {
        demotedWithoutReason.push(label);
      }
    }
  }

  const rejected = Array.isArray(bestEffortsDoc?.rejected) ? bestEffortsDoc.rejected : [];
  const ownRejectedNonErrorRows = rejected.filter(
    (r) => typeof r.reason === 'string' && !r.reason.startsWith('unexpected error:')
  ).length;

  // Cross-check: every ranked row's matching effort at that distance must NOT be demoted. A
  // non-empty list here means a demoted effort is still ranked in the top 10.
  const rankedButDemotedIds = [];
  for (const distance of distances) {
    const rows = Array.isArray(rankings[distance]) ? rankings[distance] : [];
    for (const row of rows) {
      const activity = activities[row.activityId];
      const effort =
        activity && Array.isArray(activity.efforts)
          ? activity.efforts.find((e) => e.distance === distance)
          : undefined;
      if (effort && effort.demotion && typeof effort.demotion === 'object') {
        rankedButDemotedIds.push(`${row.activityId}@${distance}`);
      }
    }
  }

  const totalsEffortsDemoted = bestEffortsDoc?.totals ? bestEffortsDoc.totals.effortsDemoted : undefined;
  const disagreesWithTotals = {
    effortsDemotedMismatch: totalsEffortsDemoted !== ownDemotedTotal,
    ownDemotedTotal,
    totalsEffortsDemoted,
    rejectedMismatch: ownRejectedNonErrorRows !== ownDemotedTotal,
    ownRejectedNonErrorRows,
  };

  const pinnedActivity = activities[PINNED_ACTIVITY_ID];
  let pinnedFixture;
  if (!pinnedActivity) {
    pinnedFixture = {
      present: false,
      note: `activity ${PINNED_ACTIVITY_ID} is absent from the shipped document`,
    };
  } else {
    const effort =
      Array.isArray(pinnedActivity.efforts)
        ? pinnedActivity.efforts.find((e) => e.distance === PINNED_DISTANCE)
        : undefined;
    if (!effort) {
      pinnedFixture = {
        present: false,
        note: `activity ${PINNED_ACTIVITY_ID} has no ${PINNED_DISTANCE} effort in the shipped document`,
      };
    } else {
      const guard = effort.demotion && typeof effort.demotion === 'object' ? effort.demotion.guard : null;
      pinnedFixture = {
        present: true,
        durationSec: effort.durationSec,
        guard,
        durationMatches45_2: effort.durationSec === PINNED_DURATION_SEC,
        guardIsCeiling: guard === 'ceiling',
      };
    }
  }

  return {
    ownDemotedTotal,
    byGuard,
    byDistance,
    ownRejectedNonErrorRows,
    rankedButDemotedIds,
    demotedWithoutReason,
    disagreesWithTotals,
    pinnedFixture,
  };
}

/**
 * D-16's activity-level flagged count: deliberately derived by this script's own arithmetic, and
 * the value the Phase 29 review queue header is checked against. Counts an ACTIVITY once when at
 * least one of its efforts carries a non-null object `demotion` — all three guards
 * (world-record/max-speed/ceiling), never a ceiling-only subset (D-01). Does not require
 * `typeof demotion.guard === 'string'`: a malformed guard still qualifies the activity, since
 * `recountDemoted` already reports malformed guards separately via `unrecognisedGuards` and D-01's
 * population is "any non-null demotion", not "any demotion with a recognised guard string". Adds
 * no new `import` (D-15's zero-import guard stays green).
 */
export function recountDemotedActivities(bestEffortsDoc, exclusionsDoc) {
  const activities =
    bestEffortsDoc && bestEffortsDoc.activities && typeof bestEffortsDoc.activities === 'object'
      ? bestEffortsDoc.activities
      : {};

  const flaggedActivityIds = [];
  for (const activityId of Object.keys(activities)) {
    const activity = activities[activityId];
    const efforts = activity && Array.isArray(activity.efforts) ? activity.efforts : [];
    const isFlagged = efforts.some(
      (effort) => effort && effort.demotion !== null && typeof effort.demotion === 'object'
    );
    if (isFlagged) flaggedActivityIds.push(activityId);
  }
  flaggedActivityIds.sort();

  let excludedWithinFlaggedCount = null;
  let exclusionsTotal = null;
  const malformedExclusions = [];
  if (exclusionsDoc !== null && exclusionsDoc !== undefined) {
    const flaggedSet = new Set(flaggedActivityIds);
    const exclusions = Array.isArray(exclusionsDoc.exclusions) ? exclusionsDoc.exclusions : [];
    exclusionsTotal = 0;
    excludedWithinFlaggedCount = 0;
    // D-08 (Phase 31): four malformation classes, each surfaced by name rather
    // than silently skipped — a hand-maintained JSON file crossing into the
    // verifier that gates the phase's own numbers (T-31-02). Keyed storage
    // stays a Set/Map, never a plain object indexed by an untrusted id, so a
    // literal `__proto__` activityId cannot reach Object.prototype even before
    // it is reported here.
    const seenActivityIds = new Set();
    for (let i = 0; i < exclusions.length; i++) {
      const entry = exclusions[i];
      if (!entry || typeof entry !== 'object') {
        malformedExclusions.push(`index ${i}: entry is not an object`);
        continue;
      }

      const hasStringId = typeof entry.activityId === 'string';
      const offender = hasStringId ? entry.activityId : `index ${i}`;

      if (!hasStringId) {
        malformedExclusions.push(`${offender}: activityId is not a string`);
        continue;
      }
      if (entry.activityId === '__proto__') {
        malformedExclusions.push(`${offender}: activityId is the literal "__proto__"`);
        continue;
      }
      if (seenActivityIds.has(entry.activityId)) {
        malformedExclusions.push(`${offender}: duplicate activityId`);
        continue;
      }
      seenActivityIds.add(entry.activityId);

      if (typeof entry.reason !== 'string' || entry.reason.trim() === '') {
        malformedExclusions.push(`${offender}: reason is missing, non-string, or empty`);
        continue;
      }

      exclusionsTotal += 1;
      if (flaggedSet.has(entry.activityId)) excludedWithinFlaggedCount += 1;
    }
  }

  return {
    flaggedActivityCount: flaggedActivityIds.length,
    flaggedActivityIds,
    excludedWithinFlaggedCount,
    exclusionsTotal,
    malformedExclusions,
  };
}

/**
 * D-15's classifier-independent ceiling sweep (WR-05, IN-03, closing 28-VERIFICATION.md gaps
 * 1/3). Walks EVERY effort in the shipped document and compares its OWN arithmetic
 * (`TARGET_METERS_LOCAL[distance] / durationSec`) against `doc.ceilings[distance].ceilingMps` —
 * it never reads `effort.demotion` as the answer to "is this effort over the ceiling", only as
 * the answer to "did something already demote it". This is what catches CR-01's shape: an
 * owner-excluded, over-ceiling effort whose `demotion` was never set because Pass 3 only walked
 * non-excluded survivors.
 *
 * Null-safe in the same style as `recountDemoted` (IN-03): never throws on `null`, `{}`, or a
 * document missing `ceilings`/`activities`.
 */
export function recountCeilingSweep(bestEffortsDoc) {
  const ceilings =
    bestEffortsDoc && bestEffortsDoc.ceilings && typeof bestEffortsDoc.ceilings === 'object'
      ? bestEffortsDoc.ceilings
      : null;

  if (!ceilings) {
    return {
      overCeilingWithoutDemotion: [],
      ceilingDemotedButNotOverCeiling: [],
      independentCeilingCount: 0,
      unevaluable: [],
      failOpenDistances: [],
      ceilingsMissing: true,
      perDistanceOverCeilingWithoutDemotion: {},
    };
  }

  const activities =
    bestEffortsDoc && bestEffortsDoc.activities && typeof bestEffortsDoc.activities === 'object'
      ? bestEffortsDoc.activities
      : {};

  const overCeilingWithoutDemotion = [];
  const ceilingDemotedButNotOverCeiling = [];
  const unevaluable = [];
  const perDistanceOverCeilingWithoutDemotion = {};
  let independentCeilingCount = 0;

  for (const activityId of Object.keys(activities).sort()) {
    const activity = activities[activityId];
    const efforts = activity && Array.isArray(activity.efforts) ? activity.efforts : [];
    for (const effort of efforts) {
      const label = `${activityId}@${effort.distance}`;
      const meters = TARGET_METERS_LOCAL[effort.distance];
      const durationSec = effort.durationSec;
      const durationIsPositiveFinite =
        typeof durationSec === 'number' && Number.isFinite(durationSec) && durationSec > 0;

      if (meters === undefined || !durationIsPositiveFinite) {
        unevaluable.push(label);
        continue;
      }

      const ceiling = ceilings[effort.distance] ? ceilings[effort.distance].ceilingMps : undefined;
      if (ceiling === null || ceiling === undefined || !Number.isFinite(ceiling)) {
        // Fail-open distance (or a distance with no ceiling entry at all): contributes nothing.
        continue;
      }

      const implied = meters / durationSec;
      const over = implied > ceiling;
      const guard = effort.demotion && typeof effort.demotion === 'object' ? effort.demotion.guard : null;

      if (over && guard === null) {
        overCeilingWithoutDemotion.push(label);
        perDistanceOverCeilingWithoutDemotion[effort.distance] =
          (perDistanceOverCeilingWithoutDemotion[effort.distance] || 0) + 1;
      }
      if (guard === 'ceiling' && !over) {
        ceilingDemotedButNotOverCeiling.push(label);
      }
      if (over && guard !== 'world-record' && guard !== 'max-speed') {
        independentCeilingCount += 1;
      }
    }
  }

  const failOpenDistances = Object.keys(ceilings)
    .sort()
    .filter((d) => ceilings[d] && (ceilings[d].ceilingMps === null || ceilings[d].ceilingMps === undefined));

  return {
    overCeilingWithoutDemotion,
    ceilingDemotedButNotOverCeiling,
    independentCeilingCount,
    unevaluable,
    failOpenDistances,
    ceilingsMissing: false,
    perDistanceOverCeilingWithoutDemotion,
  };
}

/**
 * PR-05's cohort, reported archive-wide against a live denominator recomputed from
 * `data/dashboard/index.json`'s own row count — never a literal. A row with no `quality` object
 * is counted separately (`rowsMissingQuality`) rather than silently treated as clean, because
 * Phase 27's own G-02 showed a cohort figure drifting once and being carried forward unexamined.
 */
export function recountImpossibleSampleCohort(indexDoc) {
  const activities = Array.isArray(indexDoc.activities) ? indexDoc.activities : [];
  const archiveDenominator = activities.length;

  let rowsWithQuality = 0;
  let rowsMissingQuality = 0;
  const cohortIds = [];

  for (const row of activities) {
    if (!row || !row.quality || typeof row.quality !== 'object') {
      rowsMissingQuality += 1;
      continue;
    }
    rowsWithQuality += 1;

    const impossibleSamples = row.quality.impossibleSamples;
    const count = impossibleSamples ? impossibleSamples.count : undefined;
    if (Number.isInteger(count) && count >= 1) {
      cohortIds.push(String(row.id));
    }
  }

  cohortIds.sort();
  const cohortCount = cohortIds.length;
  const cohortPct = archiveDenominator > 0 ? Number(((cohortCount / archiveDenominator) * 100).toFixed(1)) : 0;

  return { archiveDenominator, rowsWithQuality, rowsMissingQuality, cohortCount, cohortPct, cohortIds };
}

/**
 * The overlap between PR-05's cohort and the demoted-effort population, reported in both
 * directions per the do-not-conflate caution: an activity can carry an impossible sample without
 * ever landing inside a swept target window (`cohortWithoutDemotedEffort`), and the ceiling can
 * demote an effort in an activity whose other samples never crossed the per-sample floor
 * (`demotedNotInCohort`).
 */
export function computeCohortOverlap(cohortIds, bestEffortsDoc) {
  const activities =
    bestEffortsDoc && bestEffortsDoc.activities && typeof bestEffortsDoc.activities === 'object'
      ? bestEffortsDoc.activities
      : {};

  const cohortSet = new Set(cohortIds);
  const demotedActivityIds = new Set();
  for (const activityId of Object.keys(activities)) {
    const efforts = Array.isArray(activities[activityId].efforts) ? activities[activityId].efforts : [];
    if (efforts.some((e) => e.demotion && typeof e.demotion === 'object')) {
      demotedActivityIds.add(activityId);
    }
  }

  let cohortWithDemotedEffort = 0;
  let cohortWithoutDemotedEffort = 0;
  for (const id of cohortIds) {
    if (demotedActivityIds.has(id)) cohortWithDemotedEffort += 1;
    else cohortWithoutDemotedEffort += 1;
  }

  let demotedNotInCohort = 0;
  for (const id of demotedActivityIds) {
    if (!cohortSet.has(id)) demotedNotInCohort += 1;
  }

  const biteRatePct =
    cohortIds.length > 0 ? Number(((cohortWithDemotedEffort / cohortIds.length) * 100).toFixed(1)) : 0;

  return {
    cohortWithDemotedEffort,
    cohortWithoutDemotedEffort,
    demotedNotInCohort,
    biteRatePct,
  };
}

/**
 * Assembles the full pass/fail verdict for the combined report, plus optional `--expect-demoted`
 * / `--expect-cohort` pins. Pure — no `process.exit`, no console — so tests can assert on the
 * verdict shape directly. `readErrors` (any unreadable/unparseable input) are always reported as
 * problems regardless of what else could be computed.
 */
export function evaluateReport(report, expectedDemoted, expectedCohort, expectedFlaggedActivities) {
  const problems = [];

  for (const err of report.readErrors || []) {
    problems.push(`unreadable input: ${err}`);
  }

  const demoted = report.demoted;
  if (demoted) {
    if (demoted.rankedButDemotedIds.length > 0) {
      problems.push(
        `${demoted.rankedButDemotedIds.length} ranked-but-demoted effort(s) found (a demoted effort is still ranked): ${demoted.rankedButDemotedIds.join(', ')}`
      );
    }
    if (demoted.demotedWithoutReason.length > 0) {
      problems.push(
        `${demoted.demotedWithoutReason.length} demoted effort(s) missing a reason string: ${demoted.demotedWithoutReason.join(', ')}`
      );
    }
    if (demoted.disagreesWithTotals.effortsDemotedMismatch) {
      problems.push(
        `recomputed ownDemotedTotal (${demoted.disagreesWithTotals.ownDemotedTotal}) disagrees with doc.totals.effortsDemoted (${demoted.disagreesWithTotals.totalsEffortsDemoted})`
      );
    }
    if (demoted.disagreesWithTotals.rejectedMismatch) {
      problems.push(
        `ownRejectedNonErrorRows (${demoted.disagreesWithTotals.ownRejectedNonErrorRows}) disagrees with ownDemotedTotal (${demoted.disagreesWithTotals.ownDemotedTotal})`
      );
    }
    if (demoted.byGuard.unrecognisedGuards.length > 0) {
      problems.push(
        `${demoted.byGuard.unrecognisedGuards.length} unrecognised guard value(s) found: ${demoted.byGuard.unrecognisedGuards.join(', ')}`
      );
    }
    if (expectedDemoted !== undefined && demoted.ownDemotedTotal !== expectedDemoted) {
      problems.push(
        `recomputed ownDemotedTotal (${demoted.ownDemotedTotal}) does not equal --expect-demoted ${expectedDemoted}`
      );
    }

    // Pinned-fixture problems (D-04, WR-05): a missing, guard-mismatched, or duration-mismatched
    // pinned fixture makes PR-05's regression check vacuous or wrong — this must fail the verdict,
    // not just print a line, which is exactly what 28-VERIFICATION.md gap 1 found missing.
    const pf = demoted.pinnedFixture;
    if (pf) {
      if (!pf.present) {
        problems.push(
          `pinned fixture ${PINNED_ACTIVITY_ID}@${PINNED_DISTANCE} is absent from the shipped document (PR-05 check is vacuous)`
        );
      } else {
        if (!pf.guardIsCeiling) {
          problems.push(
            `pinned fixture ${PINNED_ACTIVITY_ID}@${PINNED_DISTANCE} guard is ${JSON.stringify(pf.guard)}, not "ceiling" (guardIsCeiling=false)`
          );
        }
        if (!pf.durationMatches45_2) {
          problems.push(
            `pinned fixture ${PINNED_ACTIVITY_ID}@${PINNED_DISTANCE} durationSec is ${pf.durationSec}, not ${PINNED_DURATION_SEC} (D-04)`
          );
        }
      }
    }

    // The sweep can never be silently skipped: if a demoted report was computed but no sweep
    // accompanies it, that is itself a problem (T-28-10-B).
    if (!report.sweep) {
      problems.push('ceiling sweep was not run');
    }
  }

  const sweep = report.sweep;
  if (sweep) {
    if (sweep.overCeilingWithoutDemotion.length > 0) {
      problems.push(
        `${sweep.overCeilingWithoutDemotion.length} over-ceiling effort(s) carry no demotion (CR-01 shape): ${sweep.overCeilingWithoutDemotion.join(', ')}`
      );
    }
    if (sweep.ceilingDemotedButNotOverCeiling.length > 0) {
      problems.push(
        `${sweep.ceilingDemotedButNotOverCeiling.length} ceiling-guard demotion(s) whose implied speed is not over the ceiling: ${sweep.ceilingDemotedButNotOverCeiling.join(', ')}`
      );
    }
    if (demoted && sweep.independentCeilingCount !== demoted.byGuard.ceiling) {
      problems.push(
        `independent ceiling count (${sweep.independentCeilingCount}) disagrees with byGuard.ceiling (${demoted.byGuard.ceiling})`
      );
    }
    if (sweep.unevaluable.length > 0) {
      problems.push(
        `${sweep.unevaluable.length} effort(s) could not be evaluated by the sweep (no local meters entry or invalid durationSec): ${sweep.unevaluable.join(', ')}`
      );
    }
    if (sweep.ceilingsMissing) {
      problems.push('the shipped document has no ceilings object; the sweep could not run');
    }
  }

  const cohort = report.cohort;
  if (cohort && expectedCohort !== undefined && cohort.cohortCount !== expectedCohort) {
    problems.push(
      `recomputed cohortCount (${cohort.cohortCount}) does not equal --expect-cohort ${expectedCohort}`
    );
  }

  const flaggedActivities = report.flaggedActivities;
  if (
    flaggedActivities &&
    expectedFlaggedActivities !== undefined &&
    flaggedActivities.flaggedActivityCount !== expectedFlaggedActivities
  ) {
    problems.push(
      `recomputed flaggedActivityCount (${flaggedActivities.flaggedActivityCount}) does not equal --expect-flagged-activities ${expectedFlaggedActivities}`
    );
  }

  // D-08 (Phase 31): a malformed data/best-effort-exclusions.json entry fails
  // the verdict closed, matching this function's existing treatment of
  // malformed demotions — the same problems[] channel, no new error path.
  if (
    flaggedActivities &&
    Array.isArray(flaggedActivities.malformedExclusions) &&
    flaggedActivities.malformedExclusions.length > 0
  ) {
    problems.push(
      `${flaggedActivities.malformedExclusions.length} malformed exclusions entry/entries found: ${flaggedActivities.malformedExclusions.join(', ')}`
    );
  }

  return { pass: problems.length === 0, problems };
}

/**
 * Parses `--expect-demoted <n>`, `--expect-cohort <n>` and `--expect-flagged-activities <n>`, all
 * optional, all integers, returning `undefined` for whichever is absent so nothing is hardcoded.
 * Throws on a malformed (non-integer) value, mirroring the analog's `parseExpectFlag`.
 */
export function parseExpectFlags(argv) {
  function parseOne(flagName) {
    const idx = argv.indexOf(flagName);
    if (idx === -1) return undefined;
    const value = argv[idx + 1];
    const parsed = Number(value);
    if (value === undefined || !Number.isInteger(parsed)) {
      throw new Error(`${flagName} requires an integer argument, got ${JSON.stringify(value)}`);
    }
    return parsed;
  }

  return {
    expectDemoted: parseOne('--expect-demoted'),
    expectCohort: parseOne('--expect-cohort'),
    expectFlaggedActivities: parseOne('--expect-flagged-activities'),
  };
}

/**
 * Parses `--best-efforts <path>`, `--index <path>` and `--exclusions <path>`, all optional,
 * defaulting to `BEST_EFFORTS_PATH`, `DASHBOARD_INDEX_PATH` and `EXCLUSIONS_PATH`. Lets the
 * recount be pointed at an absolute primary-tree path when run from a worktree where `data/` is
 * gitignored and absent, and lets an operator point it at an archive copy. `parseExpectFlags`
 * ignores these flag names — it only looks up its own `--expect-*` names, so the two parsers
 * never collide.
 */
export function parseInputPaths(argv) {
  function parseOne(flagName, fallback) {
    const idx = argv.indexOf(flagName);
    if (idx === -1) return fallback;
    const value = argv[idx + 1];
    if (value === undefined) {
      throw new Error(`${flagName} requires a path argument`);
    }
    return value;
  }

  return {
    bestEffortsPath: parseOne('--best-efforts', BEST_EFFORTS_PATH),
    indexPath: parseOne('--index', DASHBOARD_INDEX_PATH),
    exclusionsPath: parseOne('--exclusions', EXCLUSIONS_PATH),
  };
}

function main() {
  let bestEffortsPath;
  let indexPath;
  let exclusionsPath;
  try {
    ({ bestEffortsPath, indexPath, exclusionsPath } = parseInputPaths(process.argv.slice(2)));
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }

  console.log(
    `D-15 independent recount: reading ${bestEffortsPath}, ${indexPath} and ${exclusionsPath} off disk (no ceiling/compute/utils/types import)...\n`
  );

  let expectDemoted;
  let expectCohort;
  let expectFlaggedActivities;
  try {
    ({ expectDemoted, expectCohort, expectFlaggedActivities } = parseExpectFlags(
      process.argv.slice(2)
    ));
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }

  const readErrors = [];

  const bestEffortsRead = readShippedJson(bestEffortsPath);
  if (!bestEffortsRead.ok) readErrors.push(bestEffortsRead.reason);

  const exclusionsRead = readShippedJson(exclusionsPath);
  if (!exclusionsRead.ok) readErrors.push(exclusionsRead.reason);

  const indexRead = readShippedJson(indexPath);
  if (!indexRead.ok) readErrors.push(indexRead.reason);

  const demoted = bestEffortsRead.ok ? recountDemoted(bestEffortsRead.doc) : null;
  const sweep = bestEffortsRead.ok ? recountCeilingSweep(bestEffortsRead.doc) : null;
  const cohort = indexRead.ok ? recountImpossibleSampleCohort(indexRead.doc) : null;
  const overlap =
    demoted && cohort && bestEffortsRead.ok
      ? computeCohortOverlap(cohort.cohortIds, bestEffortsRead.doc)
      : null;
  const flaggedActivities = bestEffortsRead.ok
    ? recountDemotedActivities(bestEffortsRead.doc, exclusionsRead.ok ? exclusionsRead.doc : undefined)
    : null;

  const report = { readErrors, demoted, cohort, overlap, sweep, flaggedActivities };
  const verdict = evaluateReport(report, expectDemoted, expectCohort, expectFlaggedActivities);

  if (readErrors.length > 0) {
    console.error('FAILED to read one or more shipped documents:');
    for (const err of readErrors) console.error(`  - ${err}`);
  }

  if (demoted) {
    console.log(`Recomputed demoted total (own arithmetic, activities[*].efforts[*].demotion): ${demoted.ownDemotedTotal}`);
    console.log('  Per-guard breakdown (own arithmetic):');
    console.log(`    world-record: ${demoted.byGuard['world-record']}`);
    console.log(`    max-speed:    ${demoted.byGuard['max-speed']}`);
    console.log(`    ceiling:      ${demoted.byGuard.ceiling}`);
    console.log(`    unrecognised guards: ${demoted.byGuard.unrecognisedGuards.length}`);
    console.log('  Per-distance breakdown (own arithmetic):');
    for (const distance of Object.keys(demoted.byDistance).sort()) {
      console.log(`    ${distance}: ${demoted.byDistance[distance]}`);
    }
    console.log(
      `  Cross-check vs. doc.totals.effortsDemoted: own=${demoted.disagreesWithTotals.ownDemotedTotal} totals=${demoted.disagreesWithTotals.totalsEffortsDemoted} disagrees=${demoted.disagreesWithTotals.effortsDemotedMismatch}`
    );
    console.log(
      `  Cross-check ownRejectedNonErrorRows vs. ownDemotedTotal: rejected=${demoted.disagreesWithTotals.ownRejectedNonErrorRows} demoted=${demoted.disagreesWithTotals.ownDemotedTotal} disagrees=${demoted.disagreesWithTotals.rejectedMismatch}`
    );
    console.log(`  rankedButDemotedIds (${demoted.rankedButDemotedIds.length}): ${demoted.rankedButDemotedIds.join(', ') || '(none)'}`);
    console.log(`  demotedWithoutReason (${demoted.demotedWithoutReason.length}): ${demoted.demotedWithoutReason.join(', ') || '(none)'}`);
    if (demoted.pinnedFixture.present) {
      console.log(
        `  Pinned fixture ${PINNED_ACTIVITY_ID}@${PINNED_DISTANCE}: durationSec=${demoted.pinnedFixture.durationSec} guard=${JSON.stringify(demoted.pinnedFixture.guard)} durationMatches45_2=${demoted.pinnedFixture.durationMatches45_2} guardIsCeiling=${demoted.pinnedFixture.guardIsCeiling}`
      );
    } else {
      console.log(`  Pinned fixture ${PINNED_ACTIVITY_ID}@${PINNED_DISTANCE}: ${demoted.pinnedFixture.note}`);
    }
    if (expectDemoted !== undefined) {
      console.log(`  --expect-demoted ${expectDemoted}: ${demoted.ownDemotedTotal === expectDemoted ? 'MATCH' : 'MISMATCH'}`);
    }
  }

  if (flaggedActivities) {
    console.log(
      `  Flagged ACTIVITIES (own arithmetic, >=1 non-null demotion, all guards): ${flaggedActivities.flaggedActivityCount}`
    );
    if (flaggedActivities.excludedWithinFlaggedCount === null) {
      console.log('    of which already excluded (data/best-effort-exclusions.json): unavailable (exclusions document unreadable)');
    } else {
      console.log(
        `    of which already excluded (data/best-effort-exclusions.json): ${flaggedActivities.excludedWithinFlaggedCount} of ${flaggedActivities.exclusionsTotal} total exclusions`
      );
    }
    console.log(
      '    CAUTION: this activity count is a superset of the ceiling-only cohort and is the population the Phase 29 review queue lists (D-01).'
    );
    if (expectFlaggedActivities !== undefined) {
      console.log(
        `  --expect-flagged-activities ${expectFlaggedActivities}: ${flaggedActivities.flaggedActivityCount === expectFlaggedActivities ? 'MATCH' : 'MISMATCH'}`
      );
    }
  }

  if (sweep) {
    console.log('\nCeiling sweep (own arithmetic, doc.ceilings vs TARGET/durationSec):');
    console.log(`  independentCeilingCount: ${sweep.independentCeilingCount}`);
    console.log(
      `  overCeilingWithoutDemotion (${sweep.overCeilingWithoutDemotion.length}): ${sweep.overCeilingWithoutDemotion.join(', ') || '(none)'}`
    );
    console.log('  Per-distance overCeilingWithoutDemotion counts:');
    for (const distance of Object.keys(sweep.perDistanceOverCeilingWithoutDemotion).sort()) {
      console.log(`    ${distance}: ${sweep.perDistanceOverCeilingWithoutDemotion[distance]}`);
    }
    console.log(
      `  ceilingDemotedButNotOverCeiling (${sweep.ceilingDemotedButNotOverCeiling.length}): ${sweep.ceilingDemotedButNotOverCeiling.join(', ') || '(none)'}`
    );
    console.log(`  failOpenDistances: ${sweep.failOpenDistances.join(', ') || '(none)'}`);
    console.log(`  unevaluable (${sweep.unevaluable.length}): ${sweep.unevaluable.join(', ') || '(none)'}`);
    console.log(`  ceilingsMissing: ${sweep.ceilingsMissing}`);
  }

  if (cohort) {
    console.log('\nPR-05 impossible-sample cohort (own arithmetic, live denominator):');
    console.log(`  archiveDenominator: ${cohort.archiveDenominator}`);
    console.log(`  rowsWithQuality:    ${cohort.rowsWithQuality}`);
    console.log(`  rowsMissingQuality: ${cohort.rowsMissingQuality}`);
    console.log(`  cohortCount:        ${cohort.cohortCount}`);
    console.log(`  cohortPct:          ${cohort.cohortPct}%`);
    if (expectCohort !== undefined) {
      console.log(`  --expect-cohort ${expectCohort}: ${cohort.cohortCount === expectCohort ? 'MATCH' : 'MISMATCH'}`);
    }
    console.log(`\n  ${COHORT_VS_DEMOTED_CAUTION}`);
    if (overlap) {
      console.log('  Overlap with the demoted-effort population:');
      console.log(`    cohortWithDemotedEffort:    ${overlap.cohortWithDemotedEffort}`);
      console.log(`    cohortWithoutDemotedEffort: ${overlap.cohortWithoutDemotedEffort}`);
      console.log(`    demotedNotInCohort:         ${overlap.demotedNotInCohort}`);
      console.log(`    biteRatePct (finding, not a threshold): ${overlap.biteRatePct}%`);
    }
  }

  if (verdict.pass) {
    console.log('\nPASS: recount agrees with the shipped totals; no disagreements found.');
  } else {
    console.error('\nFAIL:');
    for (const problem of verdict.problems) {
      console.error(`  - ${problem}`);
    }
    process.exitCode = 1;
  }
}

// Self-execution guard, mirroring compute-pace-quality-recount.mjs: main() runs only under
// direct invocation, so compute-pr-ceiling-recount.test.mjs can import the pure functions above
// without triggering a real file read as an import-time side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
