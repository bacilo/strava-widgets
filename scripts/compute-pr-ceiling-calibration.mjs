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
 * Membership rule (stated here, not derived from any other document): this
 * mirrors `compute-best-efforts.ts` Pass 1's `byDistance` population EXACTLY —
 * per-effort exclusion only, absolute-guard demotions dropped, ceiling
 * demotions and missing-or-null demotions kept.
 *
 * - include `activities[id].efforts[j]` only when
 *   `efforts[j].excludedFromRecords` is false. The activity-level flag is
 *   NOT consulted: it is true for the whole activity once any exclusion
 *   entry names it, even one scoped to a single distance, while the
 *   pipeline's own exclusion is distance-scoped (WR-04) — an activity
 *   partially excluded still contributes its other, non-excluded efforts.
 * - additionally drop an effort whose `demotion?.guard` is `'world-record'`
 *   or `'max-speed'`: these are the absolute-guard rejections Pass 1 never
 *   sees, because they are decided by the SAME guard that ran before Pass 1
 *   accumulated.
 * - keep an effort whose `demotion?.guard` is `'ceiling'`, or whose
 *   `demotion` is `null`/absent: the ceiling did not exist yet when Pass 1
 *   accumulated its population, so a ceiling demotion cannot have removed it.
 *
 * Since D-08 the shipped `efforts` array no longer reflects `isPlausible`'s
 * verdict by omission — it retains every demotion (world-record, max-speed
 * AND ceiling) so the demoted-but-visible invariant holds. Only
 * world-record/max-speed were ever excluded from Pass 1's accumulation;
 * ceiling demotions are decided AFTER Pass 1, from Pass 1's own output.
 *
 * `rankings` (top-10 only, would silently truncate the population) and
 * `rejected` (now always empty — nothing is deleted post-D-08) are never
 * read for membership.
 */
export function buildFilteredPopulations(bestEffortsDoc) {
  const populations = new Map();
  for (const key of TARGET_ORDER) populations.set(key, []);

  const activities = bestEffortsDoc?.activities ?? {};
  for (const activityId of Object.keys(activities)) {
    const activity = activities[activityId];
    if (!activity) continue;

    const efforts = activity.efforts ?? [];
    for (const effort of efforts) {
      if (!effort || effort.excludedFromRecords) continue;

      const guard = effort.demotion?.guard;
      if (guard === 'world-record' || guard === 'max-speed') continue;

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
 * WR-07's fix: selects the distance with the greatest ABSOLUTE drift from
 * `report.reconciliation` (never a signed comparison — a drift of -7 outranks
 * a drift of +5), breaking ties deterministically by `TARGET_ORDER` position
 * (the first tied distance in `TARGET_ORDER` wins, so the same input always
 * produces the same selection). Returns `null` when every distance's drift is
 * exactly zero — the all-zero case is a distinct outcome, never a distance
 * named "largest" by default.
 *
 * Never hard-codes a distance: this is the selection WR-07's fix replaces the
 * old hard-coded "400m always shows the largest drift" opening clause with.
 */
export function largestAbsoluteDrift(reconciliation) {
  let best = null;

  for (const key of TARGET_ORDER) {
    const entry = reconciliation[key];
    if (!entry) continue;
    const magnitude = Math.abs(entry.drift);
    if (magnitude === 0) continue;
    if (best === null || magnitude > best.magnitude) {
      best = { key, drift: entry.drift, magnitude };
    }
  }

  return best === null ? null : { key: best.key, drift: best.drift };
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
// I/O — archive read + report build + markdown render
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

/**
 * 28-CONTEXT.md's own "Measurements taken during this discussion
 * (2026-09-10, re-derivable)" table — quoted verbatim so this script's
 * `## Per-distance distributions` section can state, per distance, whether
 * the live archive's `n` has drifted from it and by how much (D-13's
 * reconciliation requirement: drift is reported, never silently absorbed).
 * This constant is never read by any derivation function above — it feeds
 * only the reconciliation text in the rendered artifact.
 */
const CONTEXT_REFERENCE_TABLE = {
  '400m': { n: 1831, p90: 4.0, max: 8.85, maxOverP90: 2.21 },
  '1k': { n: 1849, p90: 3.72, max: 6.2, maxOverP90: 1.66 },
  '1mi': { n: 1848, p90: 3.62, max: 5.61, maxOverP90: 1.55 },
  '5k': { n: 1786, p90: 3.39, max: 4.24, maxOverP90: 1.25 },
  '10k': { n: 1464, p90: 3.3, max: 4.19, maxOverP90: 1.27 },
  half: { n: 105, p90: 3.44, max: 4.05, maxOverP90: 1.18 },
  marathon: { n: 0, p90: null, max: null, maxOverP90: null },
};

/** The context's own quoted shipped 400m top-10 (durations, seconds), for the D-03 comparison. */
const CONTEXT_400M_TENTH_FASTEST_SEC = 65.5;

/** `n` seconds formatted to one decimal with an `s` suffix. */
function formatSec(sec) {
  return sec === null || sec === undefined ? '—' : `${sec.toFixed(1)}s`;
}

/** `n` m/s formatted to four decimals. */
function formatMps(mps) {
  return mps === null || mps === undefined ? '—' : mps.toFixed(4);
}

function secondsFromSpeed(distanceKey, speedMps) {
  return speedMps === null || speedMps === undefined || speedMps <= 0
    ? null
    : TARGET_METERS[distanceKey] / speedMps;
}

/**
 * Builds the full calibration report object `renderCalibrationMarkdown`
 * renders. All measurement happens HERE, once, against `bestEffortsDoc` and
 * `indexDoc` — `renderCalibrationMarkdown` only formats fields already on
 * this object and must remain a pure function of it (D-13's idempotence
 * contract: the only field that may vary between two runs over unchanged
 * input is `generatedAt`).
 */
export function buildCalibrationReport(bestEffortsDoc, indexDoc) {
  const populations = buildFilteredPopulations(bestEffortsDoc);
  const { k, argmaxDistance, perDistance: kPerDistance } = deriveCeilingMultiplier(populations);
  const { n: minPopulation, minPointsAboveBoundary, pointsAboveBoundary } = deriveMinimumPopulation();
  const applied = k === null ? null : applyCeiling(populations, k, minPopulation);
  const riegel = compareRiegelGate(populations);

  // "## Why not a percentile" — the p99.5 self-defeat finding, recomputed
  // live (never copied from 28-CONTEXT.md's own version of this finding).
  const percentileFinding = {};
  for (const key of TARGET_ORDER) {
    const population = populations.get(key) ?? [];
    const dist = describeDistribution(population);
    const top10 = [...population]
      .sort((a, b) => b.speedMps - a.speedMps || a.activityId.localeCompare(b.activityId))
      .slice(0, 10);
    const demotedTop10AtP995 = dist.p995 === null ? 0 : top10.filter((e) => e.speedMps > dist.p995).length;
    percentileFinding[key] = { p995: dist.p995, demotedTop10AtP995, top10Count: top10.length };
  }

  // "## Sensitivity" — the chosen K and two neighbouring multipliers, fixed
  // BEFORE this table is computed (the table can only observe K, never move it).
  const sensitivity = [];
  if (k !== null) {
    const candidateKs = [Math.round((k - 0.05) * 100) / 100, k, Math.round((k + 0.05) * 100) / 100];
    for (const candidateK of candidateKs) {
      const appliedAtK = applyCeiling(populations, candidateK, minPopulation);
      const perDistanceCounts = {};
      for (const key of TARGET_ORDER) perDistanceCounts[key] = appliedAtK[key].demotedCount;
      sensitivity.push({ k: candidateK, isChosen: candidateK === k, perDistanceCounts });
    }
  }

  // "## Per-distance distributions" — reconciliation against 28-CONTEXT.md's table.
  const reconciliation = {};
  for (const key of TARGET_ORDER) {
    const live = kPerDistance[key];
    const reference = CONTEXT_REFERENCE_TABLE[key];
    reconciliation[key] = {
      liveN: live.n,
      referenceN: reference.n,
      drift: live.n - reference.n,
    };
  }

  const fourHundred = applied ? applied['400m'] : null;
  const fourHundredCeilingSec = fourHundred ? secondsFromSpeed('400m', fourHundred.ceilingMps) : null;

  return {
    generatedAt: new Date().toISOString(),
    bestEffortsGeneratedAt: bestEffortsDoc?.generatedAt ?? null,
    indexGeneratedAt: indexDoc?.generatedAt ?? null,
    liveActivitiesConsidered: bestEffortsDoc?.totals?.activitiesConsidered ?? null,
    liveArchiveActivityCount: indexDoc?.totals?.activities ?? null,
    minPopulation,
    minPointsAboveBoundary,
    pointsAboveBoundary,
    k,
    argmaxDistance,
    kPerDistance,
    applied,
    riegel,
    percentileFinding,
    sensitivity,
    reconciliation,
    fourHundredCeilingSec,
  };
}

/**
 * Renders `.planning/phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md`
 * from a `report` object built by `buildCalibrationReport`. Pure string
 * assembly: no `Date`, no `Math.random`, no `process` read, and no
 * unsorted object-key/Set/Map iteration reaches the output — every loop
 * below iterates `TARGET_ORDER` explicitly. The only field that may vary
 * between two calls over an unchanged `report` (aside from `generatedAt`
 * itself) would be a bug in this function.
 */
export function renderCalibrationMarkdown(report) {
  const lines = [];

  lines.push('# Phase 28 — PR Plausibility Ceiling Calibration');
  lines.push('');
  lines.push(
    'This file is machine-written and regenerated by `npm run compute-pr-ceiling-calibration`. ' +
      'It records the two open constants D-01 delegated to this phase — the ceiling multiplier ' +
      '`CEILING_K` and the minimum-population floor `CEILING_MIN_POPULATION` — together with the ' +
      'live-archive evidence that justifies them, before any production code hard-codes either number.'
  );
  lines.push('');
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push('');

  // ## Chosen constants
  lines.push('## Chosen constants');
  lines.push('');
  lines.push('| Constant | Value |');
  lines.push('|---|---|');
  lines.push(`| \`CEILING_K\` | ${report.k ?? 'undefined — no distance cleared the floor'} |`);
  lines.push(`| \`CEILING_MIN_POPULATION\` | ${report.minPopulation} |`);
  lines.push('');
  if (report.k !== null && report.argmaxDistance !== null) {
    const argmax = report.kPerDistance[report.argmaxDistance];
    lines.push(
      `\`CEILING_K\` is the largest observed \`max / p90\` ratio among the mechanism-clean, ` +
        `floor-eligible distances: the argmax is **${report.argmaxDistance}**, with ` +
        `\`max\` = ${formatMps(argmax.max)} m/s and \`p90\` = ${formatMps(argmax.p90)} m/s ` +
        `(ratio ${(argmax.max / argmax.p90).toFixed(4)}, rounded UP to ${report.k}).`
    );
  } else {
    lines.push('No mechanism-clean distance cleared the minimum population floor in this run.');
  }
  lines.push('');
  lines.push(
    `\`CEILING_MIN_POPULATION\` = **${report.minPopulation}** is the smallest integer \`n\` such that ` +
      `\`n - Math.ceil(0.90 * n) >= ${report.minPointsAboveBoundary}\` — at n = ${report.minPopulation}, ` +
      `${report.pointsAboveBoundary} observations lie strictly above the p90 boundary, the smallest ` +
      'count at which one contaminated point is a bounded minority of the points above it.'
  );
  lines.push('');
  const half = report.kPerDistance.half;
  const marathon = report.kPerDistance.marathon;
  lines.push(
    `Consequence stated, not implied: the floor (${report.minPopulation}) sits strictly between 0 and ` +
      `half-marathon's live population (n = ${half.n}), so half ` +
      `${half.n >= report.minPopulation ? 'CLEARS the floor and stays eligible for its own ceiling' : 'falls BELOW the floor and fails open'}. ` +
      `Marathon's live population (n = ${marathon.n}) ` +
      `${marathon.n >= report.minPopulation ? 'also clears the floor.' : 'falls below the floor and fails open — the existing world-record/max_speed guard is the only guard left standing for marathon.'}`
  );
  lines.push('');
  lines.push(
    'Neither `CEILING_K` nor `CEILING_MIN_POPULATION` was adjusted after any demotion count was seen: ' +
      '`deriveCeilingMultiplier` and `deriveMinimumPopulation` both take no demotion-count argument, ' +
      'structurally, not by promise (Phase 27 D-02\'s anti-quota rule).'
  );
  lines.push('');

  // ## Per-distance distributions
  lines.push('## Per-distance distributions');
  lines.push('');
  lines.push('| Distance | n | p50 | p90 | p99 | p99.5 | max | max/p90 | mechanism | floor |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const key of TARGET_ORDER) {
    const d = report.kPerDistance[key];
    const pf = report.percentileFinding[key];
    lines.push(
      `| ${key} | ${d.n} | — | ${formatMps(d.p90)} | — | ${formatMps(pf.p995)} | ${formatMps(d.max)} | ` +
        `${d.ratio === null ? '—' : d.ratio.toFixed(4)} | ${d.mechanismClean ? 'clean' : 'vulnerable'} | ` +
        `${d.floorEligible ? 'eligible' : 'fail-open'} |`
    );
  }
  lines.push('');
  lines.push(
    'Reconciliation against `28-CONTEXT.md`\'s "Measurements taken during this discussion ' +
      '(2026-09-10, re-derivable)" table — drift is reported, never silently absorbed:'
  );
  lines.push('');
  lines.push('| Distance | Live n | 28-CONTEXT.md n | Drift |');
  lines.push('|---|---|---|---|');
  for (const key of TARGET_ORDER) {
    const r = report.reconciliation[key];
    const driftStr = r.drift === 0 ? 'none' : `${r.drift > 0 ? '+' : ''}${r.drift}`;
    lines.push(`| ${key} | ${r.liveN} | ${r.referenceN} | ${driftStr} |`);
  }
  lines.push('');
  {
    const drift = largestAbsoluteDrift(report.reconciliation);
    if (drift === null) {
      lines.push(
        'No distance drifted from `28-CONTEXT.md`\'s quoted table in this run: every live n matches ' +
          'its reference figure exactly, so no distance is named "largest" here.'
      );
    } else {
      const driftEntry = report.reconciliation[drift.key];
      const driftStr = `${drift.drift > 0 ? '+' : ''}${drift.drift}`;
      const mechanismSentence =
        drift.key === '400m'
          ? 'The most plausible mechanism is that `data/stats/` is gitignored and locally regenerated ' +
            'on demand, while `data/best-effort-exclusions.json` is git-tracked and already carried a ' +
            'curation-tickbox exclusion of several fast 400m efforts (including activity 4556693525, ' +
            'D-04\'s pinned case) committed 2026-09-08 — two days before this session — via the shipped ' +
            'local curation mode. If the `best-efforts.json` consulted while drafting `28-CONTEXT.md` ' +
            'had not been regenerated since before that commit, its "filtered population" table would ' +
            'still show the pre-exclusion figures even though the exclusion itself was already ' +
            'committed. This run reads the live, freshly regenerated archive, so it reflects the ' +
            'current exclusion state rather than that stale snapshot.'
          : 'The curation-tickbox-exclusion mechanism recorded for 400m in an earlier run of this ' +
            'report does not apply here: this run\'s largest drift falls at a different distance, so ' +
            'no committed exclusion or regeneration-timing explanation is asserted for it. Continued ' +
            'archive growth since `28-CONTEXT.md` was drafted is the more likely cause, stated as a ' +
            'hypothesis, not a claim.';
      lines.push(
        `**${drift.key}** shows the largest drift (${driftStr}, live n = ${driftEntry.liveN} vs ` +
          `28-CONTEXT.md's ${driftEntry.referenceN}): the live population and its top-10 differ from ` +
          `28-CONTEXT.md's quoted figures. ${mechanismSentence}`
      );
    }
  }
  lines.push('');

  // ## Why not a percentile
  lines.push('## Why not a percentile');
  lines.push('');
  lines.push(
    'A plain percentile of the filtered population is self-defeating: at n in the thousands, p99.5 ' +
      'lands close to the 9th-or-10th-fastest effort by construction, so it demotes genuine records ' +
      'at the clean distances along with the contaminated ones at the vulnerable distances. ' +
      'Recomputed live against the current archive (not copied from any prior table):'
  );
  lines.push('');
  lines.push('| Distance | p99.5 (m/s) | Top-10 demoted at p99.5 |');
  lines.push('|---|---|---|');
  for (const key of TARGET_ORDER) {
    const pf = report.percentileFinding[key];
    lines.push(`| ${key} | ${formatMps(pf.p995)} | ${pf.demotedTop10AtP995} of ${pf.top10Count} |`);
  }
  lines.push('');
  lines.push(
    'This is the mechanism `deriveCeilingMultiplier` avoids by consulting only the mechanism-clean, ' +
      'floor-eligible distances\' bulk (p90), never the tail the percentile itself is used to cut.'
  );
  lines.push('');

  // ## Resulting coverage and demotions (reported, not targeted)
  lines.push('## Resulting coverage and demotions (reported, not targeted)');
  lines.push('');
  lines.push('| Distance | Ceiling (m/s) | Ceiling (time) | Eligible | n | Demoted | Demoted of top 10 |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const key of TARGET_ORDER) {
    const a = report.applied ? report.applied[key] : null;
    if (!a || !a.eligible) {
      lines.push(
        `| ${key} | — | no personal ceiling — population below floor | ${a ? a.eligible : false} | ` +
          `${a ? a.n : report.kPerDistance[key].n} | 0 | 0 |`
      );
    } else {
      const ceilingSec = secondsFromSpeed(key, a.ceilingMps);
      lines.push(
        `| ${key} | ${formatMps(a.ceilingMps)} | ${formatSec(ceilingSec)} | true | ${a.n} | ` +
          `${a.demotedCount} | ${a.demotedTop10Count} of 10 |`
      );
    }
  }
  lines.push('');
  if (report.fourHundredCeilingSec !== null && report.applied) {
    const a400 = report.applied['400m'];
    lines.push(
      `**D-03's accepted outcome, stated with numbers:** the live 400m ceiling is ` +
        `${formatMps(a400.ceilingMps)} m/s (${formatSec(report.fourHundredCeilingSec)}), compared against ` +
        `28-CONTEXT.md's quoted shipped tenth-fastest 400m of ${CONTEXT_400M_TENTH_FASTEST_SEC}s. This run's ` +
        `ceiling demotes ${a400.demotedTop10Count} of the CURRENT top 10 (400m population n = ${a400.n}). ` +
        `Whether that reaches a fully emptied top-10 table depends on the live population at run time — ` +
        'this is the reportable, not-silently-absorbed consequence of the archive drift noted above: ' +
        `the current top 10 (post curation-tickbox exclusions) is materially slower than the figures ` +
        `28-CONTEXT.md quoted for D-03's discussion, so fewer of today's top 10 are demoted than the ` +
        'near-total emptying anticipated at discussion time. The demotion mechanism itself is unchanged ' +
        'and un-tuned; the population it is applied to has moved.'
    );
  } else {
    lines.push('400m has no personal ceiling in this run — see the table above.');
  }
  lines.push('');

  // ## Sensitivity (reported, not used to choose K)
  lines.push('## Sensitivity (reported, not used to choose K)');
  lines.push('');
  lines.push(
    '`CEILING_K` was fixed by `deriveCeilingMultiplier` BEFORE this table was computed. Phase 27\'s ' +
      'D-02 forbids moving it to change the counts below; this table exists to disclose sensitivity, ' +
      'never to select a different value.'
  );
  lines.push('');
  if (report.sensitivity.length > 0) {
    const header = ['K', ...TARGET_ORDER].map((h) => (h === 'K' ? 'K' : h));
    lines.push(`| ${header.join(' | ')} |`);
    lines.push(`|${header.map(() => '---').join('|')}|`);
    for (const row of report.sensitivity) {
      const cells = [
        `${row.k}${row.isChosen ? ' (chosen)' : ''}`,
        ...TARGET_ORDER.map((key) => String(row.perDistanceCounts[key])),
      ];
      lines.push(`| ${cells.join(' | ')} |`);
    }
  } else {
    lines.push('No sensitivity table — `CEILING_K` was undefined in this run.');
  }
  lines.push('');

  // ## Riegel cross-distance gate — measured, not shipped
  lines.push('## Riegel cross-distance gate — measured, not shipped');
  lines.push('');
  lines.push(
    `Projected down from the fastest 10k effort (activity ${safeActivityId(report.riegel.fastest10kActivityId)}, ` +
      `${formatSec(report.riegel.fastest10kDurationSec)}) via \`riegelPredict\`. This phase ships the ` +
      'ratio-to-bulk statistic alone; this table is measured evidence for that choice, never fed back ' +
      'into `deriveCeilingMultiplier`.'
  );
  lines.push('');
  lines.push('| Distance | Riegel ceiling (m/s) | Riegel-only demotions | Our-ceiling-only demotions |');
  lines.push('|---|---|---|---|');
  for (const key of TARGET_ORDER) {
    const r = report.riegel.perDistance[key];
    if (r.outOfRange) {
      lines.push(`| ${key} | outside Riegel's calibrated range | — | — |`);
    } else {
      lines.push(
        `| ${key} | ${formatMps(r.riegelCeilingMps)} | ${r.riegelOnlyDemotions} | ${r.ourOnlyDemotions} |`
      );
    }
  }
  lines.push('');
  lines.push(
    'The concrete measurement that would reopen this question: a mechanism-clean distance where the ' +
      'ratio-to-bulk ceiling admits an effort the Riegel gate would demote (a positive ' +
      '"Riegel-only demotions" count at 5k, 10k or half above).'
  );
  lines.push('');

  // ## Inputs
  lines.push('## Inputs');
  lines.push('');
  lines.push(`- \`data/stats/best-efforts.json\` — generatedAt: ${report.bestEffortsGeneratedAt}`);
  lines.push(`- \`data/dashboard/index.json\` — generatedAt: ${report.indexGeneratedAt}`);
  lines.push(
    `- Live archive denominator: ${report.liveActivitiesConsidered} activities considered ` +
      `(\`best-efforts.json\` totals), ${report.liveArchiveActivityCount} activities indexed ` +
      '(`dashboard/index.json` totals).'
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

  const report = buildCalibrationReport(bestEffortsDoc, indexDoc);

  console.log(`Minimum population floor: ${report.minPopulation} (${report.pointsAboveBoundary} points above p90 boundary)`);
  console.log(`Chosen K: ${report.k} (argmax distance: ${report.argmaxDistance})`);
  for (const key of TARGET_ORDER) {
    const entry = report.kPerDistance[key];
    console.log(
      `  ${key}: n=${entry.n} max=${entry.max ?? '—'} p90=${entry.p90 ?? '—'} ratio=${entry.ratio ?? '—'} ` +
        `mechanismClean=${entry.mechanismClean} floorEligible=${entry.floorEligible}`
    );
  }

  if (report.k === null) {
    console.error('Error: no mechanism-clean distance cleared the minimum population floor.');
    process.exitCode = 1;
    return;
  }

  console.log('\nApplied ceiling:');
  for (const key of TARGET_ORDER) {
    const entry = report.applied[key];
    console.log(
      `  ${key}: ceilingMps=${entry.ceilingMps ?? 'no personal ceiling'} eligible=${entry.eligible} ` +
        `n=${entry.n} demotedCount=${entry.demotedCount} demotedTop10Count=${entry.demotedTop10Count}`
    );
  }

  console.log(`\nRiegel cross-distance gate (fastest 10k: ${safeActivityId(report.riegel.fastest10kActivityId)}):`);
  for (const key of TARGET_ORDER) {
    const entry = report.riegel.perDistance[key];
    if (entry.outOfRange) {
      console.log(`  ${key}: outside Riegel's calibrated range`);
    } else {
      console.log(
        `  ${key}: riegelCeilingMps=${entry.riegelCeilingMps ?? '—'} riegelOnly=${entry.riegelOnlyDemotions} ourOnly=${entry.ourOnlyDemotions}`
      );
    }
  }

  const markdown = renderCalibrationMarkdown(report);
  writeFileSync(OUTPUT_PATH, markdown, 'utf8');
  console.log(`\nWrote ${OUTPUT_PATH}`);
}

// Self-execution guard, mirroring compute-pace-quality-calibration.mjs:
// main() runs only under direct invocation, so
// scripts/compute-pr-ceiling-calibration.test.mjs can import the pure
// functions above without triggering an archive read or a write to
// 28-CEILING-CALIBRATION.md as an import-time side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
