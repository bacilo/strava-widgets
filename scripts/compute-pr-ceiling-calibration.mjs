/**
 * Phase 28 PR-plausibility ceiling calibration — measures the two open
 * constants (D-01's multiplier K, D-02's minimum-population floor) against
 * the live archive and writes the committed, regenerable
 * `28-CEILING-CALIBRATION.md` deliverable (D-13).
 *
 * Structure follows `scripts/compute-pace-quality-calibration.mjs` (the
 * sibling calibration precedent): pure exported functions with zero file
 * I/O, plus a `main()` gated behind the standard self-execution guard so
 * `compute-pr-ceiling-calibration.test.mjs` can import the pure functions
 * without triggering an archive read or a write to the artifact.
 *
 * Only write target: `.planning/phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md`.
 * Reads `data/stats/best-efforts.json` and `data/dashboard/index.json`
 * read-only; never writes into `data/`.
 *
 * T-28-01-A (mitigate): main()'s preconditions catch a missing or
 * unparseable input file, print a named remediation command, and set
 * `process.exitCode = 1` — the script never throws, mirroring
 * `loadExclusions`'s never-throws discipline.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { TARGET_ORDER, TARGET_METERS } from '../dist/analytics/best-effort.types.js';
import { riegelPredict } from '../dist/analytics/riegel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const BEST_EFFORTS_PATH = join(ROOT_DIR, 'data/stats/best-efforts.json');
const DASHBOARD_INDEX_PATH = join(ROOT_DIR, 'data/dashboard/index.json');
const OUTPUT_PATH = join(
  ROOT_DIR,
  '.planning/phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md'
);

const REGENERATE_COMMAND = 'npm run compute-pr-ceiling-calibration';
const REMEDIATION_COMMAND = 'npm run build && npm run compute-all-stats';

/** T-28-01-B: an activity id is only ever emitted after matching this shape. */
const VALID_ACTIVITY_ID = /^i?\d{1,20}$/;

/** The default order-statistic argument D-02 asks be reported, not hard-coded. */
const DEFAULT_MIN_POINTS_ABOVE_BOUNDARY = 10;

// ---------------------------------------------------------------------------
// Pure functions — importable without I/O (the guard test's contract)
// ---------------------------------------------------------------------------

/**
 * PR-02's non-circularity seam. Returns a `Map<TargetDistanceKey, Array<{
 * activityId, startDate, durationSec, speedMps }>>` built from
 * `bestEffortsDoc.activities` only.
 *
 * Membership rule (stated here, not derived from any other document):
 * include `activities[id].efforts[j]` only when BOTH
 * `activities[id].excludedFromRecords` is false AND
 * `efforts[j].excludedFromRecords` is false. The shipped `efforts` array is
 * already post-`isPlausible` (the absolute world-record/max_speed guard has
 * already run), so this population is exactly "already filtered by the
 * absolute guard and the exclusion list" — PR-02's required starting point.
 * `rankings` (top-10 only, would silently truncate the population) and
 * `rejected` (already-deleted efforts, the opposite of this population) are
 * never read for membership.
 */
export function buildFilteredPopulations(bestEffortsDoc) {
  const populations = new Map();
  for (const key of TARGET_ORDER) populations.set(key, []);

  const activities = bestEffortsDoc?.activities ?? {};
  for (const activityId of Object.keys(activities)) {
    const activity = activities[activityId];
    if (!activity || activity.excludedFromRecords) continue;

    const efforts = activity.efforts ?? [];
    for (const effort of efforts) {
      if (!effort || effort.excludedFromRecords) continue;

      const meters = TARGET_METERS[effort.distance];
      if (!meters || !(effort.durationSec > 0)) continue;

      const list = populations.get(effort.distance);
      if (!list) continue;

      list.push({
        activityId,
        startDate: activity.startDate,
        durationSec: effort.durationSec,
        speedMps: meters / effort.durationSec,
      });
    }
  }

  return populations;
}

/**
 * Deterministic, interpolation-free nearest-rank percentile: the index is
 * `Math.ceil(fraction * n) - 1`, clamped to `[0, n - 1]`, returning `null`
 * for `n === 0`. Because there is no interpolation the returned value is
 * always an observed data point and cannot move under a floating-point
 * tie-break — PR-01 requires the derived ceiling be reproducible
 * byte-for-byte across runs, which an interpolated percentile (a weighted
 * average of two neighbours) cannot guarantee at the bit level.
 */
export function nearestRankPercentile(sortedAscending, fraction) {
  const n = sortedAscending.length;
  if (n === 0) return null;
  const rawIndex = Math.ceil(fraction * n) - 1;
  const index = Math.min(Math.max(rawIndex, 0), n - 1);
  return sortedAscending[index];
}

/**
 * `{ n, p50, p90, p99, p995, max, maxOverP90 }` for one distance's
 * population, each percentile via `nearestRankPercentile` over an ascending
 * copy sorted by `speedMps` with `activityId` as the tie-break (a total
 * order, so the sort is deterministic even when two efforts share a speed).
 */
export function describeDistribution(population) {
  const sorted = [...population].sort(
    (a, b) => a.speedMps - b.speedMps || a.activityId.localeCompare(b.activityId)
  );
  const speeds = sorted.map((entry) => entry.speedMps);

  const n = speeds.length;
  const p50 = nearestRankPercentile(speeds, 0.5);
  const p90 = nearestRankPercentile(speeds, 0.9);
  const p99 = nearestRankPercentile(speeds, 0.99);
  const p995 = nearestRankPercentile(speeds, 0.995);
  const max = nearestRankPercentile(speeds, 1.0);
  const maxOverP90 = max !== null && p90 !== null && p90 > 0 ? max / p90 : null;

  return { n, p50, p90, p99, p995, max, maxOverP90 };
}

/**
 * Splits the seven distances into `mechanismClean` / `mechanismVulnerable`
 * by a criterion stated independently of any ratio being measured:
 * `TARGET_METERS[key] >= 5000`.
 *
 * Justification (restated verbatim in the artifact): the corruption
 * mechanism is a single aliased distance-advance interval landing inside
 * the swept target window. Phase 26 measured per-activity distance-advance
 * intervals with medians of 2s, 16s, 24s and 60s, and at this archive's
 * roughly 3.4 m/s bulk pace a 60s advance displaces about 200 m. A target
 * of at least 5,000 m therefore bounds single-jump inflation below about 4%
 * (200 / 5000), while a 400 m target admits up to 50% (200 / 400). The
 * partition is fixed by target length alone, never by observed spread — it
 * does not read `populations`' contents, only the caller's distance keys.
 */
export function partitionMechanismClean(populations) {
  const mechanismClean = [];
  const mechanismVulnerable = [];

  for (const key of TARGET_ORDER) {
    if (!populations.has(key)) continue;
    if (TARGET_METERS[key] >= 5000) {
      mechanismClean.push(key);
    } else {
      mechanismVulnerable.push(key);
    }
  }

  return { mechanismClean, mechanismVulnerable };
}

/**
 * D-02's order-statistic floor: the smallest integer `n` such that
 * `n - Math.ceil(0.90 * n) >= minPointsAboveBoundary`.
 *
 * Mechanism: the p90 boundary is a bulk descriptor only when enough
 * observations lie strictly above it that no single artifact can move
 * where it falls. Ten (the default) is the smallest count at which one
 * contaminated point is a bounded minority (at most 1-in-10) of the points
 * above the boundary. The result is computed, never hard-coded.
 */
export function deriveMinimumPopulation(minPointsAboveBoundary = DEFAULT_MIN_POINTS_ABOVE_BOUNDARY) {
  let n = 1;
  let pointsAboveBoundary = n - Math.ceil(0.9 * n);
  while (pointsAboveBoundary < minPointsAboveBoundary) {
    n++;
    pointsAboveBoundary = n - Math.ceil(0.9 * n);
  }
  return { n, minPointsAboveBoundary, pointsAboveBoundary };
}

/**
 * D-01's multiplier: `k` is the maximum of `max / p90` over the
 * mechanism-clean distances (`partitionMechanismClean`) that also clear
 * `deriveMinimumPopulation()`'s floor, rounded UP to two decimals
 * (`Math.ceil(x * 100) / 100` — direction-safe, since rounding up can only
 * admit more efforts, never demote more). `perDistance` carries every
 * distance's `n`, `max`, `p90` and ratio so the argmax is auditable.
 *
 * Structurally single-parameter: this function never accepts, reads, or is
 * influenced by any demotion count. The anti-quota guarantee (Phase 27's
 * D-02 rule that a threshold tuned to a target count is a quota, not a
 * claim) is enforced by this signature, not by a promise.
 */
export function deriveCeilingMultiplier(populations) {
  const { n: minPopulation } = deriveMinimumPopulation();
  const { mechanismClean } = partitionMechanismClean(populations);
  const mechanismCleanSet = new Set(mechanismClean);

  const perDistance = {};
  for (const key of TARGET_ORDER) {
    const population = populations.get(key) ?? [];
    const dist = describeDistribution(population);
    perDistance[key] = {
      n: dist.n,
      max: dist.max,
      p90: dist.p90,
      ratio: dist.maxOverP90,
      mechanismClean: mechanismCleanSet.has(key),
      floorEligible: dist.n >= minPopulation,
    };
  }

  let k = null;
  let argmaxDistance = null;
  for (const key of mechanismClean) {
    const entry = perDistance[key];
    if (!entry.floorEligible || entry.ratio === null) continue;
    if (k === null || entry.ratio > k) {
      k = entry.ratio;
      argmaxDistance = key;
    }
  }

  return {
    k: k === null ? null : Math.ceil(k * 100) / 100,
    argmaxDistance,
    perDistance,
  };
}

/**
 * Applies the chosen `k` and `minPopulation` to every distance's
 * population. `ceilingMps` is `null` when `n < minPopulation` (D-02's
 * fail-open — the existing world-record/max_speed guard is the only guard
 * left standing for that distance); otherwise
 * `Math.ceil(k * p90 * 1e4) / 1e4`. An effort is demoted when
 * `speedMps > ceilingMps` STRICTLY — strict comparison plus upward rounding
 * is what keeps the argmax distance's own maximum admitted.
 */
export function applyCeiling(populations, k, minPopulation) {
  const result = {};

  for (const key of TARGET_ORDER) {
    const population = populations.get(key) ?? [];
    const dist = describeDistribution(population);
    const eligible = dist.n >= minPopulation && dist.p90 !== null;
    const ceilingMps = eligible ? Math.ceil(k * dist.p90 * 1e4) / 1e4 : null;

    let demotedCount = 0;
    if (ceilingMps !== null) {
      for (const effort of population) {
        if (effort.speedMps > ceilingMps) demotedCount++;
      }
    }

    const top10 = [...population]
      .sort((a, b) => b.speedMps - a.speedMps || a.activityId.localeCompare(b.activityId))
      .slice(0, 10);
    const demotedTop10Count =
      ceilingMps === null ? 0 : top10.filter((effort) => effort.speedMps > ceilingMps).length;

    result[key] = { ceilingMps, eligible, n: dist.n, demotedCount, demotedTop10Count };
  }

  return result;
}

/**
 * D-01's REPORTED FINDING (never a shortlist): projects a ceiling down from
 * the fastest 10k effort via `riegelPredict`, and reports per distance how
 * many efforts a Riegel-projected gate would demote that this script's own
 * ratio-to-bulk ceiling (`deriveCeilingMultiplier` + `applyCeiling`,
 * self-derived here) does not, and vice versa. 400m is outside Riegel's
 * calibrated range and reports `outOfRange: true` with no number. This
 * function's output feeds only the artifact's evidence section — it is
 * never read by `deriveCeilingMultiplier`.
 */
export function compareRiegelGate(populations) {
  const { n: minPopulation } = deriveMinimumPopulation();
  const { k } = deriveCeilingMultiplier(populations);
  const ourCeiling = k === null ? {} : applyCeiling(populations, k, minPopulation);

  const tenK = populations.get('10k') ?? [];
  const fastest10k =
    [...tenK].sort((a, b) => b.speedMps - a.speedMps || a.activityId.localeCompare(b.activityId))[0] ?? null;

  const perDistance = {};
  for (const key of TARGET_ORDER) {
    if (key === '400m') {
      perDistance[key] = { outOfRange: true };
      continue;
    }

    const population = populations.get(key) ?? [];
    if (!fastest10k) {
      perDistance[key] = { riegelCeilingMps: null, riegelOnlyDemotions: 0, ourOnlyDemotions: 0 };
      continue;
    }

    const predictedSec = riegelPredict(fastest10k.durationSec, TARGET_METERS['10k'], TARGET_METERS[key]);
    const riegelCeilingMps = predictedSec > 0 ? TARGET_METERS[key] / predictedSec : null;
    const ourCeilingMps = ourCeiling[key] ? ourCeiling[key].ceilingMps : null;

    let riegelOnlyDemotions = 0;
    let ourOnlyDemotions = 0;
    for (const effort of population) {
      const riegelDemotes = riegelCeilingMps !== null && effort.speedMps > riegelCeilingMps;
      const ourDemotes = ourCeilingMps !== null && effort.speedMps > ourCeilingMps;
      if (riegelDemotes && !ourDemotes) riegelOnlyDemotions++;
      if (ourDemotes && !riegelDemotes) ourOnlyDemotions++;
    }

    perDistance[key] = { riegelCeilingMps, riegelOnlyDemotions, ourOnlyDemotions };
  }

  return {
    fastest10kActivityId: fastest10k ? fastest10k.activityId : null,
    fastest10kDurationSec: fastest10k ? fastest10k.durationSec : null,
    perDistance,
  };
}

// ---------------------------------------------------------------------------
// I/O — archive read + report build + markdown render (not imported by the
// guard test as "pure", though renderCalibrationMarkdown itself is pure)
// ---------------------------------------------------------------------------

function readJsonDocument(path) {
  const content = readFileSync(path, 'utf8');
  return JSON.parse(content);
}

/** T-28-01-B: renders an activity id only after validating its shape. */
function safeActivityId(activityId) {
  if (typeof activityId === 'string' && VALID_ACTIVITY_ID.test(activityId)) return activityId;
  return '(malformed id)';
}

function main() {
  console.log('Computing the PR-plausibility ceiling calibration...\n');

  let bestEffortsDoc;
  let indexDoc;

  try {
    bestEffortsDoc = readJsonDocument(BEST_EFFORTS_PATH);
  } catch (error) {
    console.error(`Error: could not read or parse ${BEST_EFFORTS_PATH}: ${error.message}`);
    console.error(`Run \`${REMEDIATION_COMMAND}\` first, then re-run \`${REGENERATE_COMMAND}\`.`);
    process.exitCode = 1;
    return;
  }

  try {
    indexDoc = readJsonDocument(DASHBOARD_INDEX_PATH);
  } catch (error) {
    console.error(`Error: could not read or parse ${DASHBOARD_INDEX_PATH}: ${error.message}`);
    console.error(`Run \`${REMEDIATION_COMMAND}\` first, then re-run \`${REGENERATE_COMMAND}\`.`);
    process.exitCode = 1;
    return;
  }

  const populations = buildFilteredPopulations(bestEffortsDoc);
  const { k, argmaxDistance, perDistance } = deriveCeilingMultiplier(populations);
  const { n: minPopulation, pointsAboveBoundary } = deriveMinimumPopulation();

  console.log(`Minimum population floor: ${minPopulation} (${pointsAboveBoundary} points above p90 boundary)`);
  console.log(`Chosen K: ${k} (argmax distance: ${argmaxDistance})`);
  for (const key of TARGET_ORDER) {
    const entry = perDistance[key];
    console.log(
      `  ${key}: n=${entry.n} max=${entry.max ?? '—'} p90=${entry.p90 ?? '—'} ratio=${entry.ratio ?? '—'} ` +
        `mechanismClean=${entry.mechanismClean} floorEligible=${entry.floorEligible}`
    );
  }

  if (k === null) {
    console.error('Error: no mechanism-clean distance cleared the minimum population floor.');
    process.exitCode = 1;
    return;
  }

  const applied = applyCeiling(populations, k, minPopulation);
  console.log('\nApplied ceiling:');
  for (const key of TARGET_ORDER) {
    const entry = applied[key];
    console.log(
      `  ${key}: ceilingMps=${entry.ceilingMps ?? 'no personal ceiling'} eligible=${entry.eligible} ` +
        `n=${entry.n} demotedCount=${entry.demotedCount} demotedTop10Count=${entry.demotedTop10Count}`
    );
  }

  const riegel = compareRiegelGate(populations);
  console.log(`\nRiegel cross-distance gate (fastest 10k: ${safeActivityId(riegel.fastest10kActivityId)}):`);
  for (const key of TARGET_ORDER) {
    const entry = riegel.perDistance[key];
    if (entry.outOfRange) {
      console.log(`  ${key}: outside Riegel's calibrated range`);
    } else {
      console.log(
        `  ${key}: riegelCeilingMps=${entry.riegelCeilingMps ?? '—'} riegelOnly=${entry.riegelOnlyDemotions} ourOnly=${entry.ourOnlyDemotions}`
      );
    }
  }
}

// Self-execution guard, mirroring compute-pace-quality-calibration.mjs:
// main() runs only under direct invocation, so
// scripts/compute-pr-ceiling-calibration.test.mjs can import the pure
// functions above without triggering an archive read or a write to
// 28-CEILING-CALIBRATION.md as an import-time side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
