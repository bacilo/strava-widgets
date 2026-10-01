/**
 * PR-09's third, genuinely independent reconciliation leg (D-13, 36-RESEARCH.md § D-13).
 *
 * FORBIDDEN, DELIBERATELY: this file has zero `import`/`require`/dynamic-`import()` statements
 * naming any of the following, by any spelling (`dist/analytics/...` or its `src/` equivalent):
 *   - `compute-best-efforts.js` — the orchestration under test (the "search" itself)
 *   - `best-effort-ceiling.js` and `best-effort-ceiling-state.js` — the ceiling derivation/state
 *   - `best-effort-utils.js` — `findBestEffort`, the two-pointer sweep the search reuses
 *   - `best-effort.types.js` — the shared vocabulary module (`TARGET_METERS`, `EffortDemotionGuard`,
 *     etc.) — reusing its constants would make this leg share vocabulary with the code it checks
 *   - `unreliable-segments.js` — `detectUnreliableSegments`, the detector itself
 *   - `pace-derivation.js` — named explicitly, with its own stated reason: `classifyGapsWithSegments`
 *     in this module is the SOLE call site of `detectUnreliableSegments` (36-RESEARCH.md § D-13's
 *     own mid-paragraph reversal: "this needs a sharper reading"). Importing
 *     `classifyGapsWithSegments` "just to get the segments alongside coverage" is importing the
 *     detector by any reasonable reading of this bar — it would make this leg a re-derivation of
 *     the detector, not an independent algorithm, defeating D-13's entire purpose.
 * Also barred, because neither is independent of the search either:
 *   - `scripts/compute-ceiling-recalibration.mjs` (the OLD-state reconstruction plan 36-11's diff
 *     imports — sharing it here would make legs 2 and 3 share a dependency, leaving only leg 1
 *     genuinely separate from the other two)
 *   - `scripts/compute-clean-window-diff.mjs` (PR-09 leg 1, the diff this leg reconciles against —
 *     a leg that imports the artifact it is meant to independently check is not independent)
 *
 * THE REASON, stated once rather than per-module: the diff (leg 1) and the walked guard count
 * inside that same artifact (leg 2) both read the SAME generated document, produced by the SAME
 * classifier under test — so if the search is wrong, they agree with each other AND with the
 * defect. This is Pitfall 11's "18 = 18" exactly. This project has twice shipped a Critical past a
 * guard that only checked the changed code against itself (Phase 23's extent clamp, Phase 32's
 * cross-segment conservation). This leg exists to be the one check that structurally cannot make
 * that mistake, because it shares no module with what it checks.
 *
 * THE BOUND ON ITS CLAIM: this leg confirms that an anomaly really is inside each window the
 * shipped document calls contaminated (via a non-null `contaminated` record, or a
 * `demotion.guard === 'unreliable-segment'` no-clean-window record), and that the shipped
 * document's own counts and record shapes are internally consistent (the two-homes invariant, the
 * finite-numbers invariant, `totals.effortsDemoted` against a plain walk). It does NOT and CANNOT
 * arbitrate whether Phase 32's calibrated detector thresholds (`UNRELIABLE_SPEED_LIMIT_MPS`,
 * `excessFloorMetres`, `hiddenPauseMinMetres`) are exactly right — that question belongs to Phase
 * 32's own `32-CALIBRATION.md` and its generator, which DOES import the detector because that is
 * its job. This leg's own statistic is deliberately COARSER than the detector's boundary: it never
 * attempts to reproduce where the detector drew the line, only to confirm something anomalous
 * really sits inside the window the shipped document names as contaminated.
 *
 * DECLARED VALUE, with its measured basis (D-13's "measured, not guessed" bound — never widened to
 * make a run pass): the verdict rule is "a contaminated window PASSES when its per-window outlier
 * ratio (max pair-speed / median pair-speed, computed fresh from the raw committed stream) exceeds
 * the CONTROL population's own `CONTROL_PERCENTILE_LOCAL`th-percentile ratio, computed in the SAME
 * run". This was measured 2026-10-01, BEFORE this rule was declared, by a scratchpad-only
 * throwaway probe (never committed — see 36-12-SUMMARY.md for the full figures and the probe's own
 * description) against the live archive (1,874 streams; `data/stats/best-efforts.json` regenerated
 * the same session):
 *   CONTAMINATED (contaminated != null OR demotion.guard === 'unreliable-segment'), n=1627:
 *     min=1.0071  p05=2.5962  p25=3.4829  median=4.7911  p75=7.8667  p95=12.4286  max=301.0000
 *   CONTROL (contaminated === null AND demotion === null), n=7340:
 *     min=1.0291  p05=1.1587  p25=1.3542  median=1.6114  p75=2.0476  p95=3.0000   max=12.8000
 * Separation check: the contaminated median (4.7911) exceeds the control p95 (3.0000) — the two
 * distributions SEPARATE, so the rule below was declared rather than halting. `CONTROL_PERCENTILE_
 * LOCAL` and `CONTROL_BASIS_MINIMUM_LOCAL` encode exactly this measured rule. THIS RULE MAY NOT BE
 * WIDENED, and its minimums may not be lowered, to make a future run pass — a failing run is a
 * finding about the shipped document (or a drifted archive), never a reason to move the bar.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BEST_EFFORTS_PATH = join(__dirname, '../data/stats/best-efforts.json');
const STREAMS_DIR = join(__dirname, '../data/streams');

/**
 * Distance meters, declared LOCALLY on purpose (D-13): this file must not import
 * `best-effort.types.js`/`.ts` for this mapping, even though that module defines the same table.
 * Duplicating this tiny constant table is the price of staying a genuinely independent recount.
 * Used only as a membership check inside `checkInternalConsistency` below — this leg's own
 * statistic needs no target-meters arithmetic, unlike the search it checks.
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
 * The percentile of the CONTROL population's outlier-ratio distribution a contaminated window's
 * own ratio must exceed to pass (D-13's declared, measured rule — see the header docblock). 95 was
 * chosen because it is the measured basis's own separating percentile: the control p95 (3.0000) is
 * comfortably below the contaminated median (4.7911), giving genuine separation without being so
 * loose a typical clean window would clear it.
 */
const CONTROL_PERCENTILE_LOCAL = 95;

/**
 * The smallest CONTROL population (of windows with an assessable ratio) this leg will trust to
 * establish a `CONTROL_PERCENTILE_LOCAL`th percentile. Below this, fewer than ~1.5 points sit at or
 * above the 95th percentile band, making the estimate unreliable rather than merely noisy — the
 * basis gate fails closed rather than judging against a threshold computed from too little data.
 */
const CONTROL_BASIS_MINIMUM_LOCAL = 30;

/**
 * The fewest sample-to-sample pairs a window must contain before `windowOutlierRatio` will compute
 * a ratio at all. A ratio from 1 pair is undefined (no "rest of the distribution" to compare
 * against); a ratio from 2 pairs reduces to comparing one value against itself or its neighbour,
 * which is maximally sensitive to a single sample and carries no real statistical content. 3 is the
 * smallest count that leaves at least one pair as "the rest" once the max is set aside.
 */
const MIN_PAIRS_FOR_RATIO_LOCAL = 3;

/**
 * ROADMAP Criterion 4's three scoping-activity pinned regression fixtures (the only exception to
 * "every figure in 36-CONTEXT.md is a reference to reconcile against, never an expected value" —
 * these three ARE pinned). Each BEFORE pace string is independently re-derivable from the shipped
 * document's own `contaminated.paceSecPerKm` via this file's own local mm:ss arithmetic, with no
 * import of any pace-formatting helper.
 */
const PINNED_FIXTURES = [
  { activityId: '3475740390', distance: '400m', beforePace: '3:20' },
  { activityId: '3475724402', distance: '400m', beforePace: '3:21' },
  { activityId: '3475734189', distance: '400m', beforePace: '3:22' },
];

/**
 * Local mm:ss conversion, duplicated deliberately rather than importing any shared pace-formatting
 * helper. Rounds to the nearest whole second before splitting into minutes/seconds, matching how
 * the pinned BEFORE strings were derived from the shipped `paceSecPerKm` figures.
 */
function paceSecToMinSecLocal(paceSecPerKm) {
  if (typeof paceSecPerKm !== 'number' || !Number.isFinite(paceSecPerKm)) return null;
  const totalSec = Math.round(paceSecPerKm);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

/**
 * A local percentile over an ALREADY-SORTED-ASCENDING array, nearest-rank style: index =
 * round((p/100) * (n-1)), clamped into range. Stated in prose, deliberately, so a reader can see
 * this may differ from the shipped `percentileNearestRank` by a rank convention without that
 * affecting this leg's claim (THE BOUND ON ITS CLAIM above) — this leg never needs to reproduce the
 * shipped percentile exactly, only to measure its OWN control population consistently run to run.
 * Returns `null` for an empty array.
 */
function percentileLocal(sorted, p) {
  if (!Array.isArray(sorted) || sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

/** Local median, duplicated deliberately rather than importing any shared statistics helper. */
function medianLocal(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return percentileLocal(sorted, 50);
}

/**
 * The per-pair implied speeds (`dd / dt`) for every sample-to-sample pair FULLY inside
 * `[startSec, endSec]` — a pair `[t[i], t[i+1]]` qualifies when `t[i] >= startSec` AND
 * `t[i+1] <= endSec`. A pair whose `dt` is exactly 0 is skipped (no division by zero). Returns `[]`
 * for a degenerate window (no qualifying pairs, or `t`/`d` too short) rather than throwing.
 */
export function pairSpeeds(t, d, startSec, endSec) {
  if (!Array.isArray(t) || !Array.isArray(d) || t.length < 2 || d.length < 2) return [];
  const speeds = [];
  const n = Math.min(t.length, d.length);
  for (let i = 0; i < n - 1; i++) {
    const t0 = t[i];
    const t1 = t[i + 1];
    if (t0 < startSec || t1 > endSec) continue;
    const dt = t1 - t0;
    if (dt === 0) continue;
    const dd = d[i + 1] - d[i];
    speeds.push(dd / dt);
  }
  return speeds;
}

/**
 * The window's own self-referential outlier ratio: `max(speeds) / median(speeds)`. Returns `null`
 * (never `Infinity`, never a throw) when fewer than `MIN_PAIRS_FOR_RATIO_LOCAL` pairs are available,
 * or when the median is exactly 0 (a flat/degenerate window — dividing by it would produce
 * `Infinity`, which would silently look like an extreme, "very anomalous" ratio instead of the
 * genuinely unassessable result it is).
 */
export function windowOutlierRatio(speeds) {
  if (!Array.isArray(speeds) || speeds.length < MIN_PAIRS_FOR_RATIO_LOCAL) return null;
  const max = Math.max(...speeds);
  const med = medianLocal(speeds);
  if (med === null || med === 0) return null;
  return max / med;
}

/**
 * Splits every effort in the shipped document into the CONTAMINATED and CONTROL populations (D-13's
 * own two populations, measured in Task 1's throwaway probe), each entry carrying enough to render
 * and to judge: activity id, distance, the window judged, the computed ratio (or `null` if
 * unassessable), the pair count, and a human-readable label.
 *
 * CONTAMINATED: every effort with `contaminated != null` (window = `contaminated.startOffsetSec`/
 * `.endOffsetSec`), PLUS every effort whose `demotion.guard === 'unreliable-segment'` (window = the
 * effort's own top-level `startOffsetSec`/`endOffsetSec`, since a no-clean-window effort's top-level
 * figures ARE the contaminated window).
 * CONTROL: every effort with `contaminated === null` AND `demotion === null` — a ranked effort
 * carrying no claim of any kind.
 *
 * `readStream` is injected (not a direct `fs` call) so `compute-clean-window-recount.test.mjs` can
 * supply hand-built streams without touching disk. Must return `{ t, d }` or a falsy value (stream
 * unavailable) for a given activity id.
 */
export function classifyWindows(shippedDoc, readStream) {
  const activities =
    shippedDoc && shippedDoc.activities && typeof shippedDoc.activities === 'object'
      ? shippedDoc.activities
      : {};

  const contaminated = [];
  const control = [];

  for (const activityId of Object.keys(activities).sort()) {
    const activity = activities[activityId];
    const efforts = activity && Array.isArray(activity.efforts) ? activity.efforts : [];
    if (efforts.length === 0) continue;

    let streamFetched = false;
    let stream = null;
    function getStream() {
      if (!streamFetched) {
        stream = readStream(activityId);
        streamFetched = true;
      }
      return stream;
    }

    for (const effort of efforts) {
      const isContaminated = effort.contaminated != null && typeof effort.contaminated === 'object';
      const isUnreliableSegmentGuard =
        effort.demotion != null &&
        typeof effort.demotion === 'object' &&
        effort.demotion.guard === 'unreliable-segment';
      const isControl = effort.contaminated == null && effort.demotion == null;

      if (!isContaminated && !isUnreliableSegmentGuard && !isControl) continue;

      let startSec;
      let endSec;
      if (isContaminated) {
        startSec = effort.contaminated.startOffsetSec;
        endSec = effort.contaminated.endOffsetSec;
      } else {
        startSec = effort.startOffsetSec;
        endSec = effort.endOffsetSec;
      }

      const label = `${activityId}@${effort.distance}`;
      const s = getStream();
      if (!s || !Array.isArray(s.t) || !Array.isArray(s.d)) {
        const entry = {
          activityId,
          distance: effort.distance,
          window: { startSec, endSec },
          ratio: null,
          pairCount: 0,
          label,
          unreadableStream: true,
        };
        (isContaminated || isUnreliableSegmentGuard ? contaminated : control).push(entry);
        continue;
      }

      const speeds = pairSpeeds(s.t, s.d, startSec, endSec);
      const ratio = windowOutlierRatio(speeds);
      const entry = {
        activityId,
        distance: effort.distance,
        window: { startSec, endSec },
        ratio,
        pairCount: speeds.length,
        label,
      };
      (isContaminated || isUnreliableSegmentGuard ? contaminated : control).push(entry);
    }
  }

  return { contaminated, control };
}

/**
 * FAILS CLOSED (D-13's basis gate) when: the contaminated population is empty; the control
 * population (of windows with an assessable ratio) is below `CONTROL_BASIS_MINIMUM_LOCAL`; or the
 * two distributions do not separate (contaminated median does not exceed the control
 * `CONTROL_PERCENTILE_LOCAL`th percentile). A verdict computed over a degenerate basis is worse than
 * no verdict — it would either be unfailable (threshold near zero) or unpassable (threshold absurdly
 * high), both of which have already shipped once on this milestone.
 */
export function checkBasisGate(populations) {
  const controlRatios = populations.control
    .map((e) => e.ratio)
    .filter((r) => r !== null)
    .sort((a, b) => a - b);
  const contaminatedRatios = populations.contaminated
    .map((e) => e.ratio)
    .filter((r) => r !== null)
    .sort((a, b) => a - b);

  if (populations.contaminated.length === 0) {
    return {
      ok: false,
      reason: 'the contaminated population is empty — there is no window to verify',
      controlN: controlRatios.length,
      contaminatedN: contaminatedRatios.length,
      controlThresholdBasis: null,
      contaminatedMedian: null,
    };
  }

  if (controlRatios.length < CONTROL_BASIS_MINIMUM_LOCAL) {
    return {
      ok: false,
      reason: `the control population (${controlRatios.length} assessable window(s)) is below the stated minimum of ${CONTROL_BASIS_MINIMUM_LOCAL} — too small to establish a reliable p${CONTROL_PERCENTILE_LOCAL}`,
      controlN: controlRatios.length,
      contaminatedN: contaminatedRatios.length,
      controlThresholdBasis: null,
      contaminatedMedian: null,
    };
  }

  const controlThresholdBasis = percentileLocal(controlRatios, CONTROL_PERCENTILE_LOCAL);
  const contaminatedMedian = medianLocal(contaminatedRatios);

  if (
    contaminatedMedian === null ||
    controlThresholdBasis === null ||
    !(contaminatedMedian > controlThresholdBasis)
  ) {
    return {
      ok: false,
      reason: `the two distributions do not separate: the contaminated median (${contaminatedMedian}) does not exceed the control p${CONTROL_PERCENTILE_LOCAL} (${controlThresholdBasis})`,
      controlN: controlRatios.length,
      contaminatedN: contaminatedRatios.length,
      controlThresholdBasis,
      contaminatedMedian,
    };
  }

  return {
    ok: true,
    reason: null,
    controlN: controlRatios.length,
    contaminatedN: contaminatedRatios.length,
    controlThresholdBasis,
    contaminatedMedian,
  };
}

/**
 * Computes the control threshold (the same `CONTROL_PERCENTILE_LOCAL`th percentile `checkBasisGate`
 * measures) and the per-window verdict for every contaminated-population entry: PASS when its ratio
 * exceeds the threshold, FAIL when it does not, NOT-ASSESSABLE when its own ratio is `null`. Callers
 * must run `checkBasisGate` first and only trust this when it returns `ok: true` — this function
 * does not itself refuse to run on a degenerate basis, so the two are deliberately separate checks.
 */
export function deriveVerdict(populations) {
  const controlRatios = populations.control
    .map((e) => e.ratio)
    .filter((r) => r !== null)
    .sort((a, b) => a - b);
  const controlThreshold = percentileLocal(controlRatios, CONTROL_PERCENTILE_LOCAL);

  let pass = 0;
  let fail = 0;
  let notAssessable = 0;
  const offendingEntries = [];

  for (const entry of populations.contaminated) {
    if (entry.ratio === null || controlThreshold === null) {
      notAssessable += 1;
      continue;
    }
    if (entry.ratio > controlThreshold) {
      pass += 1;
    } else {
      fail += 1;
      offendingEntries.push(entry);
    }
  }

  return {
    controlThreshold,
    controlPopulationSize: controlRatios.length,
    contaminatedPopulationSize: populations.contaminated.length,
    pass,
    fail,
    notAssessable,
    offendingEntries,
  };
}

/**
 * Walks the shipped document and confirms its own invariants with NO import of the module that
 * produced it:
 * - no effort carries BOTH a non-null `contaminated` record AND a non-null `demotion` (the
 *   two-homes rule — this also covers the narrower "a `demotion.guard === 'unreliable-segment'`
 *   effort has `contaminated === null`" case, since that is one instance of the same pair of
 *   fields being non-null together);
 * - every `contaminated` record's four numeric fields (`durationSec`, `paceSecPerKm`,
 *   `startOffsetSec`, `endOffsetSec`) are finite numbers;
 * - every effort's `distance` is one of the seven known target distances (`TARGET_METERS_LOCAL`);
 * - `totals.effortsDemoted`, if present, equals the walked count of non-null `demotion` records.
 * Each violation is reported with its activity id and distance. Never throws on a malformed or
 * missing document — returns an empty `violations` array for `{}` or `null`.
 */
export function checkInternalConsistency(shippedDoc) {
  const activities =
    shippedDoc && shippedDoc.activities && typeof shippedDoc.activities === 'object'
      ? shippedDoc.activities
      : {};

  const violations = [];
  let walkedDemotedCount = 0;

  for (const activityId of Object.keys(activities).sort()) {
    const efforts = Array.isArray(activities[activityId].efforts) ? activities[activityId].efforts : [];
    for (const effort of efforts) {
      const label = `${activityId}@${effort.distance}`;
      const hasContaminated = effort.contaminated != null && typeof effort.contaminated === 'object';
      const hasDemotion = effort.demotion != null && typeof effort.demotion === 'object';

      if (hasDemotion) walkedDemotedCount += 1;

      if (hasContaminated && hasDemotion) {
        violations.push(
          `${label}: carries both a non-null contaminated record and a non-null demotion (guard=${JSON.stringify(effort.demotion.guard)}) — the two-homes rule forbids this`
        );
      }

      if (hasContaminated) {
        for (const field of ['durationSec', 'paceSecPerKm', 'startOffsetSec', 'endOffsetSec']) {
          const value = effort.contaminated[field];
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            violations.push(`${label}: contaminated.${field} is not a finite number (${JSON.stringify(value)})`);
          }
        }
      }

      if (effort.distance !== undefined && TARGET_METERS_LOCAL[effort.distance] === undefined) {
        violations.push(`${label}: distance ${JSON.stringify(effort.distance)} is not one of the seven known target distances`);
      }
    }
  }

  const totalsEffortsDemoted =
    shippedDoc && shippedDoc.totals && typeof shippedDoc.totals === 'object'
      ? shippedDoc.totals.effortsDemoted
      : undefined;
  if (totalsEffortsDemoted !== undefined && totalsEffortsDemoted !== walkedDemotedCount) {
    violations.push(
      `totals.effortsDemoted (${totalsEffortsDemoted}) disagrees with the walked non-null-demotion count (${walkedDemotedCount})`
    );
  }

  return { violations, walkedDemotedCount };
}

/**
 * Checks ROADMAP Criterion 4's three pinned scoping-activity fixtures: each one's
 * `contaminated.paceSecPerKm` must convert, via this file's own local mm:ss arithmetic, to its
 * pinned BEFORE string. Reports both directions — present-and-matching, and present-but-mismatched
 * or absent — never throwing on a missing activity/effort/contaminated record.
 */
export function checkPinnedFixtures(shippedDoc) {
  const activities =
    shippedDoc && shippedDoc.activities && typeof shippedDoc.activities === 'object'
      ? shippedDoc.activities
      : {};

  return PINNED_FIXTURES.map((fixture) => {
    const activity = activities[fixture.activityId];
    const effort =
      activity && Array.isArray(activity.efforts)
        ? activity.efforts.find((e) => e.distance === fixture.distance)
        : undefined;

    if (!effort || effort.contaminated == null || typeof effort.contaminated !== 'object') {
      return {
        ...fixture,
        ok: false,
        converted: null,
        reason: `activity ${fixture.activityId}@${fixture.distance} has no contaminated record in the shipped document`,
      };
    }

    const converted = paceSecToMinSecLocal(effort.contaminated.paceSecPerKm);
    const ok = converted === fixture.beforePace;
    return {
      ...fixture,
      ok,
      converted,
      reason: ok
        ? null
        : `contaminated.paceSecPerKm=${effort.contaminated.paceSecPerKm} converts to ${JSON.stringify(converted)}, expected ${JSON.stringify(fixture.beforePace)}`,
    };
  });
}

/**
 * Console output only — this leg writes NO artifact to disk; it reports and exits. Takes the
 * assembled `result` shape from `main()` (basis gate, verdict, consistency, pinned fixtures,
 * populations) and prints every figure a reader needs to corroborate or contest this leg's verdict.
 */
export function renderVerdict(result) {
  const { basisGate, verdict, consistency, pinned, populations } = result;

  console.log('=== compute-clean-window-recount: PR-09 third reconciliation leg (D-13) ===');
  console.log(
    `contaminated population: ${populations.contaminated.length} (assessable: ${populations.contaminated.filter((e) => e.ratio !== null).length})`
  );
  console.log(
    `control population: ${populations.control.length} (assessable: ${populations.control.filter((e) => e.ratio !== null).length})`
  );

  console.log(`\nbasis gate: ${basisGate.ok ? 'OK' : `FAILED — ${basisGate.reason}`}`);
  console.log(
    `  controlN=${basisGate.controlN} contaminatedN=${basisGate.contaminatedN} controlP${CONTROL_PERCENTILE_LOCAL}=${basisGate.controlThresholdBasis} contaminatedMedian=${basisGate.contaminatedMedian}`
  );

  if (verdict) {
    console.log(`\ncontrol threshold (p${CONTROL_PERCENTILE_LOCAL}): ${verdict.controlThreshold}`);
    console.log(
      `verdict: pass=${verdict.pass} fail=${verdict.fail} notAssessable=${verdict.notAssessable} (of ${verdict.contaminatedPopulationSize})`
    );
    if (verdict.offendingEntries.length > 0) {
      console.log(`offending entries (ratio <= control threshold), ${verdict.offendingEntries.length} total:`);
      for (const entry of verdict.offendingEntries) {
        console.log(`  ${entry.label}: ratio=${entry.ratio} pairCount=${entry.pairCount}`);
      }
    }
  } else {
    console.log('\nverdict: not computed (basis gate failed)');
  }

  console.log(
    `\ninternal consistency: ${consistency.violations.length === 0 ? 'OK, no violations' : `${consistency.violations.length} violation(s)`}`
  );
  for (const violation of consistency.violations) {
    console.log(`  - ${violation}`);
  }
  console.log(`walked non-null-demotion count: ${consistency.walkedDemotedCount}`);

  console.log('\npinned fixtures (ROADMAP Criterion 4):');
  for (const fixture of pinned) {
    console.log(
      `  ${fixture.activityId}@${fixture.distance}: expected ${fixture.beforePace} -> ${fixture.ok ? 'MATCH' : `MISMATCH — ${fixture.reason}`}`
    );
  }
}

function main() {
  let doc;
  try {
    doc = JSON.parse(readFileSync(BEST_EFFORTS_PATH, 'utf8'));
  } catch (err) {
    console.error(`FAILED: could not read or parse the shipped document at ${BEST_EFFORTS_PATH}: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  function readStream(activityId) {
    try {
      return JSON.parse(readFileSync(join(STREAMS_DIR, `${activityId}.json`), 'utf8'));
    } catch {
      return null;
    }
  }

  const populations = classifyWindows(doc, readStream);
  const basisGate = checkBasisGate(populations);
  const verdict = basisGate.ok ? deriveVerdict(populations) : null;
  const consistency = checkInternalConsistency(doc);
  const pinned = checkPinnedFixtures(doc);

  renderVerdict({ basisGate, verdict, consistency, pinned, populations });

  const pinnedFailures = pinned.filter((p) => !p.ok);
  const failed =
    !basisGate.ok ||
    consistency.violations.length > 0 ||
    pinnedFailures.length > 0 ||
    (verdict !== null && verdict.fail > 0);

  if (failed) {
    console.error('\nFAIL: see above for the specific reason(s). This is a finding to report, never a threshold to adjust.');
    process.exitCode = 1;
  } else {
    console.log(
      '\nPASS: every contaminated window clears the self-referential outlier-ratio rule, the shipped document is internally consistent, and all three pinned fixtures match.'
    );
  }
}

// Self-execution guard: main() runs only under direct invocation, so
// compute-clean-window-recount.test.mjs can import the pure functions above without triggering a
// real file read as an import-time side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
